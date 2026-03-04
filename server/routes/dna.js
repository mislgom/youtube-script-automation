import { Router } from 'express';
import { queryAll } from '../db.js';
import { pickSpikeVideos } from '../services/spike-selector.js';
import { extractAdvancedDNA, extractGoldenKeywords, recommendTitles, generateDnaSkeleton, buildGroupDNA } from '../services/advanced-dna-extractor.js';

const router = Router();

// 간단 인메모리 캐시
const dnaCache = new Map();

function setCache(key, value) {
    dnaCache.set(key, { value, at: Date.now() });
}
function getCache(key) {
    const entry = dnaCache.get(key);
    return entry ? entry.value : null;
}

// ─────────────────────────────────────────────
// GET /api/dna/spikes?channelId=&topN=20&days=90&category=야담
// 떡상 영상 수집
// ─────────────────────────────────────────────
router.get('/spikes', (req, res) => {
    try {
        const { channelId, topN = 20, days = 90, category } = req.query;

        let videos;
        if (channelId) {
            videos = queryAll(
                'SELECT * FROM videos WHERE channel_id = ? ORDER BY view_count DESC LIMIT 100',
                [channelId]
            );
        } else {
            // 전체 DB에서 기간 필터 + 조회수 상위
            const since = days == 0 ? '1970-01-01' :
                new Date(Date.now() - Number(days) * 86400000).toISOString().split('T')[0];
            videos = queryAll(
                `SELECT * FROM videos WHERE published_at >= ? ORDER BY view_count DESC LIMIT 200`,
                [since]
            );
        }

        const { spikes, baseline } = pickSpikeVideos(videos, { minRatio: 2, topPercent: 0.3 });
        const result = spikes.slice(0, Number(topN));

        res.json({ spikes: result, baseline, total: result.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/dna/analyze
// body: { videoIds[], category }
// DNA 5종 추출
// ─────────────────────────────────────────────
router.post('/analyze', async (req, res) => {
    try {
        const { videoIds, category = '야담' } = req.body;
        if (!videoIds || videoIds.length === 0)
            return res.status(400).json({ error: 'videoIds가 필요합니다.' });

        const placeholders = videoIds.map(() => '?').join(',');
        const videos = queryAll(`SELECT * FROM videos WHERE id IN (${placeholders})`, videoIds);

        if (videos.length === 0)
            return res.status(404).json({ error: '해당 영상을 찾을 수 없습니다.' });

        const dna = await extractAdvancedDNA(videos, category);
        if (!dna) return res.status(502).json({ error: 'DNA 추출 실패 (AI 응답 없음)' });

        setCache(`dna_${category}`, dna);
        res.json({ dna, cached: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/dna/theme-analyze
// body: { topic, category }
// 특정 주제(추천주제) 기반 관련 떡상 영상 검색 + DNA 추출
// ─────────────────────────────────────────────
router.post('/theme-analyze', async (req, res) => {
    try {
        const { topic, category = '야담' } = req.body;
        if (!topic) return res.status(400).json({ error: 'topic이 필요합니다.' });

        // 1. 단어 분리하여 검색 (유연한 매칭)
        const words = topic.split(' ').filter(w => w.length > 1);
        let videos = [];

        if (words.length > 0) {
            const conditions = words.map(() => 'title LIKE ?').join(' OR ');
            const params = words.map(w => `%${w}%`);
            videos = queryAll(`SELECT * FROM videos WHERE ${conditions} ORDER BY view_count DESC LIMIT 100`, params);
        }

        // 2. 검색 결과가 부족하면 카테고리 전체 상위 영상으로 대체
        if (videos.length < 5) {
            videos = queryAll(`SELECT * FROM videos ORDER BY view_count DESC LIMIT 100`);
        }

        // 3. 떡상 영상 선정
        const { spikes } = pickSpikeVideos(videos, { minRatio: 2, topPercent: 0.3 });

        // 4. DNA 추출
        const dna = await extractAdvancedDNA(spikes, category);
        if (!dna) return res.status(502).json({ error: '추제 기반 DNA 추출 실패' });

        res.json({ dna, spikeCount: spikes.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/dna/golden-keywords
// body: { dna }
// 황금 키워드 추출
// ─────────────────────────────────────────────
router.post('/golden-keywords', async (req, res) => {
    try {
        const { dna } = req.body;
        if (!dna) return res.status(400).json({ error: 'dna 데이터가 필요합니다.' });

        const result = await extractGoldenKeywords(dna);
        setCache('golden_keywords', result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/dna/recommend-titles
// body: { dna, goldenKeywords, category, topic }
// 썸네일 후킹 제목 10개 추천
// ─────────────────────────────────────────────
router.post('/recommend-titles', async (req, res) => {
    try {
        const { dna, goldenKeywords, category = '야담', topic = '' } = req.body;
        if (!dna) return res.status(400).json({ error: 'dna 데이터가 필요합니다.' });

        const titles = await recommendTitles(dna, goldenKeywords, category, topic);
        setCache('recommended_titles', titles);
        res.json({ titles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// POST /api/dna/skeleton
// body: { dna, selectedTitle, category }
// 선택 제목 + DNA → 대본 뼈대
// ─────────────────────────────────────────────
router.post('/skeleton', async (req, res) => {
    try {
        const { dna, selectedTitle, category = '야담' } = req.body;
        if (!dna || !selectedTitle)
            return res.status(400).json({ error: 'dna와 selectedTitle이 필요합니다.' });

        const skeleton = await generateDnaSkeleton(dna, selectedTitle, category);
        if (!skeleton) return res.status(502).json({ error: '뼈대 생성 실패 (AI 응답 없음)' });

        setCache('last_skeleton', skeleton);
        res.json({ skeleton });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/dna/cache/:key
// 마지막 성공 결과 반환
// ─────────────────────────────────────────────
router.get('/cache/:key', (req, res) => {
    const cached = getCache(req.params.key);
    if (!cached) return res.status(404).json({ error: '캐시된 결과가 없습니다.' });
    res.json({ cached, fromCache: true });
});

// ─────────────────────────────────────────────
// POST /api/dna/group
// body: { dnaResults[] }
// 여러 DNA → 그룹 DNA 합산
// ─────────────────────────────────────────────
router.post('/group', (req, res) => {
    try {
        const { dnaResults } = req.body;
        if (!dnaResults || dnaResults.length === 0)
            return res.status(400).json({ error: 'dnaResults가 필요합니다.' });

        const groupDna = buildGroupDNA(dnaResults);
        res.json({ groupDna });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// GET /api/dna/channels — 채널 목록 (셀렉트용)
// ─────────────────────────────────────────────
router.get('/channels', (req, res) => {
    try {
        const channels = queryAll('SELECT id, name FROM channels ORDER BY name');
        res.json({ channels });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
