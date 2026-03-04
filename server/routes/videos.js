import { Router } from 'express';
import { queryAll, queryOne, runSQL } from '../db.js';
import { fetchTranscript } from '../services/transcript-fetcher.js';

const router = Router();

// GET /api/videos — list videos with pagination, filtering, search
router.get('/', (req, res) => {
    try {
        const { page = 1, limit = 20, channel_id, search, category_id, video_type, sort = 'fetched_at', order = 'desc' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = [];
        let params = [];
        if (channel_id) { where.push('v.channel_id = ?'); params.push(channel_id); }
        if (search) { where.push("(v.title LIKE ? OR v.description LIKE ? OR v.transcript_summary LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        if (category_id) { where.push('EXISTS (SELECT 1 FROM video_categories vc WHERE vc.video_id = v.id AND vc.category_id = ?)'); params.push(category_id); }

        if (video_type === 'shorts') {
            where.push("(v.duration_seconds > 0 AND v.duration_seconds <= 60) OR v.title LIKE '%#shorts%' OR v.title LIKE '%#쇼츠%'");
        } else if (video_type === 'longform') {
            where.push("v.duration_seconds > 60 AND v.title NOT LIKE '%#shorts%' AND v.title NOT LIKE '%#쇼츠%'");
        }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const validSorts = ['fetched_at', 'published_at', 'view_count', 'like_count', 'title'];
        const sortCol = validSorts.includes(sort) ? sort : 'fetched_at';
        const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
        const countResult = queryOne(`SELECT COUNT(*) as total FROM videos v ${whereClause}`, params);
        const total = countResult?.total || 0;
        const videos = queryAll(`
      SELECT v.*, c.name as channel_name, c.thumbnail_url as channel_thumbnail, c.subscriber_count as channel_subscribers
      FROM videos v LEFT JOIN channels c ON v.channel_id = c.id
      ${whereClause} ORDER BY v.${sortCol} ${sortOrder} LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
        res.json({ videos, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/videos/export/json
router.get('/export/json', (req, res) => {
    try {
        const videos = queryAll('SELECT v.*, c.name as channel_name FROM videos v LEFT JOIN channels c ON v.channel_id = c.id');
        res.json(videos);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ v4: GET /api/videos/export/csv — CSV with UTF-8 BOM ═══
router.get('/export/csv', (req, res) => {
    try {
        const { search, channel_id } = req.query;
        let where = []; let params = [];
        if (channel_id) { where.push('v.channel_id = ?'); params.push(channel_id); }
        if (search) { where.push("v.title LIKE ?"); params.push(`%${search}%`); }
        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const videos = queryAll(`SELECT v.*, c.name as channel_name, c.subscriber_count as ch_subs
      FROM videos v LEFT JOIN channels c ON v.channel_id = c.id ${whereClause} ORDER BY v.view_count DESC`, params);
        const headers = ['제목', '채널', 'URL', '조회수', '좋아요', '댓글수', '구독자', '떡상지표', '업로드일', '키워드', '자막요약'];
        const rows = videos.map(v => {
            const viral = v.ch_subs > 0 ? Math.round((v.view_count / v.ch_subs) * 100) : 0;
            return [
                `"${(v.title || '').replace(/"/g, '""')}"`, `"${(v.channel_name || '').replace(/"/g, '""')}"`,
                v.video_id ? `https://youtube.com/watch?v=${v.video_id}` : '',
                v.view_count || 0, v.like_count || 0, v.comment_count || 0, v.ch_subs || 0,
                `${viral}%`, v.published_at || '',
                `"${(v.transcript_keywords || '').replace(/"/g, '""')}"`,
                `"${(v.transcript_summary || '').replace(/"/g, '""')}"`
            ];
        });
        const BOM = '\uFEFF';
        const csv = BOM + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=videos_${new Date().toISOString().slice(0, 10)}.csv`);
        res.send(csv);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/videos/:id — video detail
router.get('/:id', (req, res) => {
    try {
        const video = queryOne(`SELECT v.*, c.name as channel_name, c.subscriber_count as channel_subscribers
      FROM videos v LEFT JOIN channels c ON v.channel_id = c.id WHERE v.id = ?`, [req.params.id]);
        if (!video) return res.status(404).json({ error: '영상을 찾을 수 없습니다.' });
        const categories = queryAll(`SELECT c.* FROM categories c JOIN video_categories vc ON c.id = vc.category_id WHERE vc.video_id = ?`, [req.params.id]);
        const keywords = queryAll(`SELECT k.word, vk.tfidf_score, vk.frequency FROM keywords k JOIN video_keywords vk ON k.id = vk.keyword_id WHERE vk.video_id = ? ORDER BY vk.tfidf_score DESC`, [req.params.id]);
        res.json({ ...video, categories, keywords });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/videos/:id/memo
router.put('/:id/memo', (req, res) => {
    try {
        runSQL('UPDATE videos SET memo = ? WHERE id = ?', [req.body.memo || '', req.params.id]); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/videos/:id/categories
router.put('/:id/categories', (req, res) => {
    try {
        runSQL('DELETE FROM video_categories WHERE video_id = ?', [req.params.id]);
        for (const catId of (req.body.category_ids || [])) {
            runSQL('INSERT OR IGNORE INTO video_categories (video_id, category_id, source) VALUES (?, ?, ?)', [req.params.id, catId, 'manual']);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/videos/:id
router.delete('/:id', (req, res) => {
    try {
        runSQL('DELETE FROM videos WHERE id = ?', [req.params.id]); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/videos/manual — Collect/Add manual video
router.post('/manual', (req, res) => {
    try {
        const {
            video_id, title, description, published_at,
            view_count, like_count, comment_count, duration_seconds, thumbnail_url,
            channel_id, channel_name, channel_thumbnail, subscriber_count
        } = req.body;

        if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });

        // 1. Resolve internal channel DB ID
        let channelDbId = null;
        if (channel_id) {
            const existing = queryOne('SELECT id FROM channels WHERE channel_id = ?', [channel_id]);
            if (existing) {
                channelDbId = existing.id;
            } else if (channel_name) {
                // Auto-register channel if info provided
                const { lastId } = runSQL(
                    `INSERT INTO channels (channel_id, name, thumbnail_url, subscriber_count) VALUES (?, ?, ?, ?)`,
                    [channel_id, channel_name, channel_thumbnail || '', subscriber_count || 0]
                );
                channelDbId = lastId;
            }
        }

        // If still no channel, fallback to a global "Standalone" channel or throw error
        // For this app, videos MUST have a channel.
        if (!channelDbId) {
            // Check if "Standalone/Search" channel exists
            let standalone = queryOne('SELECT id FROM channels WHERE channel_id = ?', ['standalone']);
            if (!standalone) {
                const { lastId } = runSQL(`INSERT INTO channels (channel_id, name) VALUES (?, ?)`, ['standalone', '수집된 영상 (채널 미등록)']);
                channelDbId = lastId;
            } else {
                channelDbId = standalone.id;
            }
        }

        const vid = video_id || `manual_${Date.now()}`;

        // Check if already exists
        const existingVideo = queryOne('SELECT id FROM videos WHERE video_id = ?', [vid]);
        if (existingVideo) {
            return res.status(409).json({ error: '이미 수집된 영상입니다.' });
        }

        const { lastId } = runSQL(
            `INSERT INTO videos (
                channel_id, video_id, title, description, published_at, 
                view_count, like_count, comment_count, duration_seconds, thumbnail_url,
                source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                channelDbId, vid, title, description || '', published_at || new Date().toISOString(),
                view_count || 0, like_count || 0, comment_count || 0, duration_seconds || 0, thumbnail_url || '',
                'search'
            ]
        );

        res.json(queryOne('SELECT * FROM videos WHERE id = ?', [lastId]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══ v4: GET /api/videos/:id/transcript — on-demand transcript ═══
router.get('/:id/transcript', async (req, res) => {
    try {
        console.log(`[API] Transcript requested for DB ID: ${req.params.id}`);
        const video = queryOne('SELECT * FROM videos WHERE id = ?', [req.params.id]);
        if (!video) {
            console.error(`[API] Video not found for ID: ${req.params.id}`);
            return res.status(404).json({ error: '영상을 찾을 수 없습니다.' });
        }

        if (video.transcript_raw && video.transcript_raw.length > 50) {
            console.log(`[API] Returning cached transcript for ${video.video_id} (len: ${video.transcript_raw.length})`);
            return res.json({ text: video.transcript_raw, source: 'cached' });
        }

        if (!video.video_id || video.video_id.startsWith('manual_')) {
            console.log(`[API] Manual video or missing ID for ${video.title}`);
            return res.json({ text: null, message: '자막을 가져올 수 없는 영상입니다.' });
        }

        console.log(`[API] Fetching fresh transcript for ${video.video_id}...`);
        const text = await fetchTranscript(video.video_id);

        if (text) {
            console.log(`[API] Fetch success! Saving to DB for ID: ${req.params.id}`);
            runSQL('UPDATE videos SET transcript_raw = ?, has_transcript = 1 WHERE id = ?', [text, req.params.id]);
            return res.json({ text, source: 'fetched' });
        }

        console.log(`[API] Fetch returned null for ${video.video_id}`);
        res.json({ text: null, message: '자막이 없는 영상입니다.' });
    } catch (err) {
        console.error(`[API] Transcript Error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// ═══ v4: GET /api/videos/:id/comments — saved comments from DB ═══
router.get('/:id/comments', (req, res) => {
    try {
        const comments = queryAll('SELECT * FROM comments WHERE video_id = ? ORDER BY like_count DESC', [req.params.id]);
        res.json({ comments, total: comments.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
