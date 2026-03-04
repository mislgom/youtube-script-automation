import { Router } from 'express';
import { queryAll, queryOne, runSQL } from '../db.js';

const router = Router();

// GET /api/scripts — list all scripts
router.get('/', (req, res) => {
    try {
        const scripts = queryAll('SELECT * FROM scripts ORDER BY updated_at DESC');
        res.json(scripts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/scripts/:id — get one script
router.get('/:id', (req, res) => {
    try {
        const script = queryOne('SELECT * FROM scripts WHERE id = ?', [req.params.id]);
        if (!script) return res.status(404).json({ error: '대본을 찾을 수 없습니다.' });
        res.json(script);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/scripts — create a new script
router.post('/', (req, res) => {
    try {
        const { title, content, idea_id } = req.body;
        if (!title) return res.status(400).json({ error: '제목을 입력해주세요.' });

        const { lastId } = runSQL(
            'INSERT INTO scripts (title, content, idea_id) VALUES (?, ?, ?)',
            [title, content || '', idea_id || null]
        );

        const script = queryOne('SELECT * FROM scripts WHERE id = ?', [lastId]);
        res.json(script);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/scripts/:id — update a script
router.put('/:id', (req, res) => {
    try {
        const { title, content } = req.body;
        runSQL(
            "UPDATE scripts SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
            [title, content, req.params.id]
        );
        const script = queryOne('SELECT * FROM scripts WHERE id = ?', [req.params.id]);
        res.json(script);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/scripts/:id — delete a script
router.delete('/:id', (req, res) => {
    try {
        runSQL('DELETE FROM scripts WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
