import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'yadam.db');

let db = null;

export async function initDB() {
  const SQL = await initSqlJs();
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=DELETE');
  db.run('PRAGMA foreign_keys=ON');

  db.run(`CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    handle TEXT,
    group_tag TEXT DEFAULT '',
    thumbnail_url TEXT,
    subscriber_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    last_fetched TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    video_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    transcript_summary TEXT DEFAULT '',
    transcript_keywords TEXT DEFAULT '',
    has_transcript INTEGER DEFAULT 0,
    published_at TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    memo TEXT DEFAULT '',
    is_analyzed INTEGER DEFAULT 0,
    fetched_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE NOT NULL,
    total_count INTEGER DEFAULT 0,
    is_saturated INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS video_keywords (
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
    tfidf_score REAL DEFAULT 0,
    frequency INTEGER DEFAULT 1,
    source TEXT DEFAULT 'title',
    PRIMARY KEY (video_id, keyword_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#7c5cff',
    sort_order INTEGER DEFAULT 0,
    UNIQUE(group_name, name)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS video_categories (
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    source TEXT DEFAULT 'ai',
    PRIMARY KEY (video_id, category_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'idea',
    priority TEXT DEFAULT 'normal',
    max_similarity REAL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idea_similar_videos (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    similarity_score REAL DEFAULT 0,
    PRIMARY KEY (idea_id, video_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tagging_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  )`);

  // v4: Comments table
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    comment_id TEXT UNIQUE,
    author TEXT DEFAULT '',
    text TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    published_at TEXT,
    fetched_at TEXT DEFAULT (datetime('now'))
  )`);

  // v4: Benchmark reports table
  db.run(`CREATE TABLE IF NOT EXISTS benchmark_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    report_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // v5: Scripts table for editing
  db.run(`CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // v4: Add transcript_raw column if missing
  try { db.run('ALTER TABLE videos ADD COLUMN transcript_raw TEXT DEFAULT ""'); } catch (e) { }
  // v4: Add comment_count column if missing
  try { db.run('ALTER TABLE videos ADD COLUMN comment_count INTEGER DEFAULT 0'); } catch (e) { }
  // v4: Make channel_id nullable for search results
  try { db.run('ALTER TABLE videos ADD COLUMN source TEXT DEFAULT "channel"'); } catch (e) { }
  // v6: Add description to channels for better AI analysis
  try { db.run('ALTER TABLE channels ADD COLUMN description TEXT DEFAULT ""'); } catch (e) { }
  // v7: Add economy_metadata for impact and age interest scores
  try { db.run('ALTER TABLE videos ADD COLUMN economy_metadata TEXT DEFAULT "{}"'); } catch (e) { }

  // Insert default settings
  const stmtSettings = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const defaults = [
    ['youtube_api_key', ''],
    ['gemini_api_key', ''],
    ['google_project_id', ''],
    ['google_location', 'us-central1'],
    ['transcript_enabled', 'true'],
    ['theme', 'dark'],
    ['genre_preset', 'custom']
  ];
  for (const [k, v] of defaults) {
    stmtSettings.run([k, v]);
  }
  stmtSettings.free();

  saveDB();
  console.log('✅ Database initialized');
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run query and return rows as array of objects
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run query and return first row
export function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE and return changes info
export function runSQL(sql, params = []) {
  const res = runSQLNoSave(sql, params);
  saveDB();
  return res;
}

// v6: High performance variant without immediate save
export function runSQLNoSave(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastId = queryOne('SELECT last_insert_rowid() as id');
  return { changes, lastId: lastId ? lastId.id : 0 };
}
