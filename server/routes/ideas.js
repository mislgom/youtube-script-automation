import { Router } from 'express';
import { queryAll, queryOne, runSQL } from '../db.js';

const router = Router();

// GET /api/ideas
router.get('/', (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM ideas';
        let params = [];
        if (status) { sql += ' WHERE status = ?'; params.push(status); }
        sql += ' ORDER BY updated_at DESC';
        const ideas = queryAll(sql, params);

        // Attach similar videos count
        for (const idea of ideas) {
            const count = queryOne('SELECT COUNT(*) as cnt FROM idea_similar_videos WHERE idea_id = ?', [idea.id]);
            idea.similarCount = count?.cnt || 0;
        }
        res.json(ideas);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ideas
router.post('/', (req, res) => {
    try {
        const { title, description, priority, notes, max_similarity, similar_videos } = req.body;
        if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });

        const { lastId } = runSQL(
            `INSERT INTO ideas (title, description, priority, notes, max_similarity) VALUES (?, ?, ?, ?, ?)`,
            [title, description || '', priority || 'normal', notes || '', max_similarity || 0]
        );

        // Save similar videos if provided
        if (similar_videos && Array.isArray(similar_videos)) {
            for (const sv of similar_videos) {
                runSQL('INSERT OR IGNORE INTO idea_similar_videos (idea_id, video_id, similarity_score) VALUES (?, ?, ?)',
                    [lastId, sv.id, sv.similarity || 0]);
            }
        }

        const idea = queryOne('SELECT * FROM ideas WHERE id = ?', [lastId]);
        res.json(idea);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/ideas/:id
router.put('/:id', (req, res) => {
    try {
        const { title, description, priority, notes } = req.body;
        runSQL(`UPDATE ideas SET title = ?, description = ?, priority = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
            [title, description || '', priority || 'normal', notes || '', req.params.id]);
        const idea = queryOne('SELECT * FROM ideas WHERE id = ?', [req.params.id]);
        res.json(idea);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/ideas/:id/status
router.put('/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['idea', 'research', 'script', 'production', 'published', 'archived'];
        if (!valid.includes(status)) return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
        runSQL("UPDATE ideas SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/ideas/:id
router.delete('/:id', (req, res) => {
    try {
        runSQL('DELETE FROM ideas WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
