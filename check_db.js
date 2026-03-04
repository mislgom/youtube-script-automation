
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = 'c:/Users/mislg/OneDrive/바탕 화면/대본자동화/대본자동화/data/yadam.db';

async function check() {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(buffer);

    console.log('--- Latest 5 Videos ---');
    const latest = db.prepare("SELECT title, published_at FROM videos ORDER BY published_at DESC LIMIT 5");
    while (latest.step()) console.log(JSON.stringify(latest.getAsObject()));
    latest.free();

    console.log('\n--- Videos in last 3 days ---');
    const count3d = db.prepare("SELECT COUNT(*) as cnt FROM videos WHERE published_at >= date('now', '-3 days')");
    if (count3d.step()) console.log('Count:', count3d.getAsObject().cnt);
    count3d.free();

    console.log('\n--- Top 5 Economy Categories (3-day window) ---');
    const economy = db.prepare(`
    SELECT c.name, COUNT(vc.video_id) as count
    FROM categories c
    JOIN video_categories vc ON c.id = vc.category_id
    JOIN videos v ON vc.video_id = v.id
    WHERE c.group_name LIKE '경제%' AND v.published_at >= date('now', '-3 days')
    GROUP BY c.id
    ORDER BY count DESC
    LIMIT 5
  `);
    while (economy.step()) console.log(JSON.stringify(economy.getAsObject()));
    economy.free();

    db.close();
}

check();
