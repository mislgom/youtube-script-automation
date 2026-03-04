import { Router } from 'express';
import { queryAll, queryOne, runSQL, getDB, saveDB } from '../db.js';
import { resetClient } from '../services/gemini-service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// GET /api/settings
router.get('/', (req, res) => {
    try {
        const settings = queryAll('SELECT * FROM settings');
        const obj = {};
        for (const s of settings) {
            // Mask API keys for security
            if (s.key.includes('api_key') && s.value) {
                const val = s.value.trim();
                obj[s.key] = val.length > 4 ? '***' + val.substring(val.length - 4) : '***' + val;
                obj[s.key + '_set'] = true;
                if (s.key === 'gemini_api_key' && val.startsWith('AQ')) {
                    obj.is_gemini_vertex_token = true;
                }
            } else {
                obj[s.key] = s.value;
            }
        }
        res.json(obj);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings
router.put('/', (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            // Don't update if masked value is sent back
            if (key.includes('api_key') && value.includes('***')) continue;
            runSQL('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
            if (key === 'gemini_api_key') resetClient();
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/apikey — dedicated endpoint for API keys
router.put('/apikey', (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || !value) return res.status(400).json({ error: 'key와 value를 입력해주세요.' });
        runSQL('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
        if (key === 'gemini_api_key') resetClient();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/categories — list all categories
router.get('/categories', (req, res) => {
    try {
        const categories = queryAll('SELECT * FROM categories ORDER BY group_name, sort_order');
        const groups = {};
        for (const c of categories) {
            if (!groups[c.group_name]) groups[c.group_name] = [];
            groups[c.group_name].push(c);
        }
        res.json(groups);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/categories — add category
router.post('/categories', (req, res) => {
    try {
        const { group_name, name, color } = req.body;
        if (!group_name || !name) return res.status(400).json({ error: '그룹명과 카테고리명을 입력해주세요.' });
        const { lastId } = runSQL('INSERT OR IGNORE INTO categories (group_name, name, color) VALUES (?, ?, ?)',
            [group_name, name, color || '#7c5cff']);
        const cat = queryOne('SELECT * FROM categories WHERE id = ?', [lastId]);
        res.json(cat);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/categories/:id
router.delete('/categories/:id', (req, res) => {
    try {
        runSQL('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/categories/preset — load a genre preset
router.post('/categories/preset', (req, res) => {
    try {
        const { preset } = req.body;
        const presets = {
            '야담/역사': {
                '시대': ['삼국시대', '고려', '조선 전기', '조선 후기', '구한말', '일제강점기', '근현대'],
                '지역': ['한양/서울', '경기', '충청', '전라', '경상', '강원', '평안', '함경', '제주', '해외'],
                '사건유형': ['살인/범죄', '괴담/미스터리', '로맨스', '복수극', '풍속/일상', '전쟁', '사기', '기행', '동물'],
                '인물유형': ['왕/왕비', '궁녀', '기생', '양반', '승려', '무관', '상인', '의적', '평민', '귀신'],
                '소재출처': ['야사', '실록', '구전', '신문기사', '판결문', '향토사', '번안', '창작']
            },
            '괴담/호러': {
                '괴현상유형': ['유령/귀신', '저주', '괴물/요괴', '빙의', '초자연현상', '도시전설', 'UFO/외계', '실종'],
                '장소': ['학교', '병원', '폐건물', '산/숲', '아파트', '군대', '도로/터널', '바다', '지하'],
                '시간대': ['심야', '새벽', '황혼', '비오는날', '보름달', '명절'],
                '결말유형': ['열린결말', '반전', '비극', '해결', '실화기반']
            },
            '요리/먹방': {
                '요리종류': ['한식', '중식', '일식', '양식', '디저트', '음료', '퓨전', '길거리음식'],
                '재료': ['육류', '해산물', '채소', '면류', '밥류', '빵/제과'],
                '난이도': ['초간단', '초보', '중급', '고급', '전문가'],
                '콘텐츠유형': ['레시피', '먹방', '맛집탐방', '재료리뷰', '요리팁']
            },
            '교육/지식': {
                '분야': ['과학', '역사', '경제', '심리', '기술', '언어', '예술', '철학'],
                '난이도': ['입문', '초급', '중급', '고급'],
                '포맷': ['강의', '실험', '다큐', '인터뷰', '애니메이션설명']
            },
            '게임': {
                '게임장르': ['RPG', 'FPS', '전략', '시뮬레이션', '레이싱', '격투', '퍼즐', '호러', '스포츠'],
                '콘텐츠유형': ['리뷰', '공략', '실황', 'e스포츠', '모딩', '뉴스'],
                '플랫폼': ['PC', 'PS5', 'Xbox', 'Switch', '모바일']
            }
        };

        const presetData = presets[preset];
        if (!presetData) return res.status(400).json({ error: '알 수 없는 프리셋입니다.', available: Object.keys(presets) });

        // Insert categories
        for (const [groupName, items] of Object.entries(presetData)) {
            items.forEach((name, i) => {
                runSQL('INSERT OR IGNORE INTO categories (group_name, name, sort_order) VALUES (?, ?, ?)', [groupName, name, i]);
            });
        }

        res.json({ success: true, message: `${preset} 프리셋이 적용되었습니다.` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/backup
router.post('/backup', (req, res) => {
    try {
        const db = getDB();
        const data = db.export();
        const buffer = Buffer.from(data);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=yadam_backup_${new Date().toISOString().slice(0, 10)}.db`);
        res.send(buffer);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/restore — restore DB from uploaded file
router.post('/restore', (req, res) => {
    try {
        // This would need multer middleware for file upload
        res.status(501).json({ error: 'DB 복원은 웹 UI에서 파일을 업로드해주세요.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
