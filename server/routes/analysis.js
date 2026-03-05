import { Router } from 'express';
import { queryAll, queryOne, runSQL } from '../db.js';
import { compareTexts, getTopKeywords } from '../services/similarity.js';
import { compareWithGemini, suggestTopics, analyzeComments, generateBenchmarkReport, generateUniqueSkeleton, deepSuggestTopics, editScript } from '../services/gemini-service.js';
import { buildGapMatrix, buildYadamGapMatrix, getEconomyTrendAnalysis, getCategoryDistribution, getCategoryGroups, getTrends, getTrendsByCategory, getNicheDetailGrid } from '../services/gap-analyzer.js';
import { fetchComments } from '../services/youtube-fetcher.js';
import { pickSpikeVideos } from '../services/spike-selector.js';
import { extractSpikeDNA, formatDNAForPrompt } from '../services/dna-extractor.js';
import { extractAdvancedDNA } from '../services/advanced-dna-extractor.js';
import { logToFile } from '../utils/logger.js';

const router = Router();



// GET /api/analysis/keywords — top keywords
router.get('/keywords', (req, res) => {
    try {
        const { limit = 30 } = req.query;
        const keywords = queryAll(`
      SELECT k.id, k.word, k.total_count, k.is_saturated 
      FROM keywords k 
      ORDER BY k.total_count DESC 
      LIMIT ?
    `, [parseInt(limit)]);
        res.json(keywords);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/categories — category distribution
router.get('/categories', (req, res) => {
    try {
        const { group } = req.query;
        const groups = getCategoryGroups();
        if (group) {
            res.json(getCategoryDistribution(group));
        } else {
            const result = {};
            for (const g of groups) { result[g] = getCategoryDistribution(g); }
            res.json({ groups, distributions: result });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/compare — compare a new idea with existing videos
router.post('/compare', async (req, res) => {
    try {
        const { title, description = '', mode = 'detailed', channel_ids } = req.body;
        if (!title) return res.status(400).json({ error: '주제 제목을 입력해주세요.' });

        // Get all videos (or filtered by channels)
        let videos;
        if (channel_ids && channel_ids.length > 0) {
            const placeholders = channel_ids.map(() => '?').join(',');
            videos = queryAll(`SELECT id, title, description, transcript_keywords, transcript_summary FROM videos WHERE channel_id IN (${placeholders})`, channel_ids);
        } else {
            videos = queryAll('SELECT id, title, description, transcript_keywords, transcript_summary FROM videos');
        }

        if (videos.length === 0) {
            return res.json({ maxSimilarity: 0, results: [], message: '비교할 영상이 없습니다. 먼저 채널을 등록하고 영상을 수집해주세요.' });
        }

        // Phase 1: TF-IDF (fast, all videos)
        const searchText = mode === 'keywords' ? title : `${title} ${description}`;
        const tfidfResults = compareTexts(searchText, videos);

        // Phase 2: Gemini AI (precise, top 30 only)
        const top30 = tfidfResults.slice(0, 30);
        const top30Full = top30.map(r => {
            const vid = videos.find(v => v.id === r.id);
            return { ...r, ...vid };
        });

        let geminiResults = [];
        try {
            const rawResults = await compareWithGemini(title, description, top30Full);
            if (Array.isArray(rawResults)) {
                geminiResults = rawResults;
            } else if (rawResults && rawResults.errorType) {
                // Return error to frontend if it's a quota issue
                if (rawResults.errorType === 'QUOTA_EXCEEDED') {
                    return res.status(429).json({ error: 'QUOTA_EXCEEDED', message: 'API 사용량이 초과되었습니다.' });
                }
            }
        } catch (e) {
            // Gemini fail → use TF-IDF only
        }

        // Merge results: prefer Gemini scores if available
        const finalResults = top30.map(r => {
            const gResult = geminiResults.find(g => String(g.id) === String(r.id));
            const vid = queryOne(`
        SELECT v.*, c.name as channel_name FROM videos v 
        LEFT JOIN channels c ON v.channel_id = c.id WHERE v.id = ?
      `, [r.id]);
            return {
                id: r.id,
                title: r.title,
                channel_name: vid?.channel_name || '',
                video_id: vid?.video_id || '',
                published_at: vid?.published_at || '',
                view_count: vid?.view_count || 0,
                thumbnail_url: vid?.thumbnail_url || '',
                similarity: gResult ? gResult.score : r.similarity,
                reason: gResult?.reason || '',
                overlap_details: gResult?.overlap_details || '',
                source: gResult ? 'ai' : 'tfidf'
            };
        });

        finalResults.sort((a, b) => b.similarity - a.similarity);
        const top10 = finalResults.slice(0, 10);
        const maxSimilarity = top10.length > 0 ? top10[0].similarity : 0;

        // Find common keywords (Prioritize AI-extracted keywords to prevent "아이" -> "천재 아이" mismatch)
        const commonKeywordsNormalized = new Set();
        const commonKeywordsOriginal = [];
        const normalize = (s) => s.replace(/\s+/g, '').trim();

        // 1. AI가 직접 뽑아준 키워드들을 우선 사용
        geminiResults.forEach(gr => {
            if (gr.common_keywords && Array.isArray(gr.common_keywords)) {
                gr.common_keywords.forEach(kw => {
                    const norm = normalize(kw);
                    if (norm && !commonKeywordsNormalized.has(norm)) {
                        commonKeywordsNormalized.add(norm);
                        commonKeywordsOriginal.push(kw.trim());
                    }
                });
            }
        });

        // 2. 만약 AI 결과가 없거나 부족할 때만 기존 방식으로 보조 (단, 더 엄격하게)
        if (commonKeywordsOriginal.length === 0) {
            const normalizedNew = searchText.split(/\s+/).filter(w => w.length >= 2).map(normalize);
            for (const result of top10.slice(0, 3)) {
                const vid = videos.find(v => v.id === result.id);
                if (vid?.transcript_keywords) {
                    vid.transcript_keywords.split(',').forEach(kw => {
                        const cleanKw = kw.trim();
                        const norm = normalize(cleanKw);
                        if (normalizedNew.includes(norm) && !commonKeywordsNormalized.has(norm)) {
                            commonKeywordsNormalized.add(norm);
                            commonKeywordsOriginal.push(cleanKw);
                        }
                    });
                }
            }
        }

        res.json({
            maxSimilarity,
            level: maxSimilarity >= 60 ? 'danger' : maxSimilarity >= 30 ? 'caution' : 'safe',
            results: top10,
            commonKeywords: commonKeywordsOriginal.slice(0, 10),
            totalCompared: videos.length
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/gaps/yadam — special yadam mode (Hybrid: DB + Real-time)
router.get('/gaps/yadam', async (req, res) => {
    try {
        console.log('[YadamGaps] 야담 하이브리드 분석 요청 수신');

        // 0. DB State for Debugging
        const channelCount = (queryOne('SELECT COUNT(*) as cnt FROM channels') || { cnt: 0 }).cnt;
        const localVideoCount = (queryOne('SELECT COUNT(*) as cnt FROM videos') || { cnt: 0 }).cnt;
        const geminiKey = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'")?.value;

        // 1. Key Check & Mode Selection
        const hasGeminiKey = geminiKey && geminiKey.trim() !== '';
        const isVertex = geminiKey?.startsWith('AQ');
        const googleProjectId = queryOne("SELECT value FROM settings WHERE key = 'google_project_id'")?.value;
        const hasProjectID = googleProjectId && googleProjectId.trim() !== '';

        if (!hasGeminiKey || (isVertex && !hasProjectID)) {
            console.log('[YadamGaps] 필수 Gemini API 키 또는 Project ID가 누락되었습니다.');
            return res.json({
                xLabels: [], yLabels: [], matrix: [], gaps: [], suggestions: [],
                externalSourceCount: 0,
                isHybrid: false,
                debugCounts: {
                    channelCount,
                    collectedVideoCountLocal: localVideoCount,
                    collectedVideoCountExternal: 0,
                    topicCount: 0,
                    dropReason: 'MISSING_GEMINI_KEY'
                }
            });
        }

        // DB에 등록된 채널의 수집 영상만으로 분석 (YouTube API 실시간 검색 제거됨)
        let externalVideos = [];

        // 2-1. Fetch Local Videos for Hybrid Merge
        const localVideos = queryAll(`
            SELECT v.*, group_concat(vc.category_id) as categoryIds
            FROM videos v
            JOIN video_categories vc ON v.id = vc.video_id
            GROUP BY v.id
        `).map(v => ({
            ...v,
            matchedCategoryIds: (v.categoryIds || '').split(',').map(Number)
        }));

        // 3. Extract Spike DNA from Combined Pool
        const combinedPool = [...localVideos, ...externalVideos];
        const spikeResult = pickSpikeVideos(combinedPool, { minRatio: 3, topPercent: 0.15 });
        const dnaSummary = extractSpikeDNA(spikeResult.spikes);
        const dnaPromptStr = formatDNAForPrompt(dnaSummary);

        logToFile(`[YadamGaps] 하이브리드 DNA 추출 완료 (Spikes: ${spikeResult.spikes.length}개)`);

        // 4. Build Hybrid Matrix
        const matrix = buildYadamGapMatrix(externalVideos);

        // 5. Determine Final Drop Reason
        let dropReason = matrix.debugCounts?.dropReason || '정상';
        if (channelCount === 0 && externalVideos.length === 0) {
            dropReason = 'NO_CHANNELS';
        } else if (localVideoCount === 0 && externalVideos.length === 0) {
            dropReason = 'NO_VIDEOS';
        }

        // 1단계: 분포도 중심 응답 (Stage 1: Distribution View)
        res.json({
            ...matrix,
            suggestions: [],
            dna_analysis: '',
            externalSourceCount: externalVideos.length,
            isHybrid: true,
            debugCounts: {
                channelCount,
                collectedVideoCountLocal: localVideoCount,
                collectedVideoCountExternal: externalVideos.length,
                spikeCount: spikeResult.spikes.length,
                topicCount: 0,
                dropReason
            }
        });
    } catch (err) {
        logToFile(`[YadamGaps] ❌ 전체 과정 에러: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analysis/gaps/yadam/detail — 특정 수퍼 니치 테마의 세부 [인물 x 지역] 분포 (드릴 다운)
router.get('/gaps/yadam/detail', (req, res) => {
    try {
        const { eraId, eventId, sourceId } = req.query;
        if (!eraId || !eventId || !sourceId) {
            return res.status(400).json({ error: '필수 파라미터(eraId, eventId, sourceId)가 누락되었습니다.' });
        }
        const data = getNicheDetailGrid(parseInt(eraId), parseInt(eventId), parseInt(sourceId));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analysis/gaps/economy — special economy mode (TREND & SCORE BASED)
router.get('/gaps/economy', async (req, res) => {
    try {
        const { period = 30 } = req.query;
        console.log(`[EconomyTrends] 경제 분석 요청 수신 (기간: ${period}일)`);

        const data = getEconomyTrendAnalysis(parseInt(period));

        // Get AI suggestions based on top scoring categories
        let suggestions = [];
        if (data.topRecommendations && data.topRecommendations.length > 0) {
            try {
                // Use top 5 categories for suggestions
                const context = data.topRecommendations.map(c => `${c.name} (점수: ${c.finalScore})`).join(', ');
                suggestions = await suggestTopics(
                    data.topRecommendations.map(c => c.name),
                    `경제 트렌드 분석 (${context})`
                );
            } catch (e) {
                console.error('[EconomyTrends] AI 추천 실패:', e.message);
            }
        }

        res.json({ ...data, suggestions, mode: 'trend' });
    } catch (err) {
        console.error('[EconomyTrends] 오류:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// YouTube 실시간 데이터 기반 경제 트렌드 분석
// ═══════════════════════════════════════════════════════════
const realtimeCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1시간


// v3: GET /api/analysis/economy/realtime-v3 — Extract keywords from hit videos of registered channels
router.get('/economy/realtime-v3', async (req, res) => {
    try {
        const { period = '7' } = req.query; // '3' or '7' days
        const days = parseInt(period);

        // 캐시 확인 (1시간 TTL)
        const cacheKey = `economy-realtime-v3-${period}`;
        const cached = realtimeCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            console.log('[EconomyV3] 캐시 사용 (남은:', Math.round((CACHE_TTL - (Date.now() - cached.timestamp)) / 60000), '분)');
            return res.json(cached.data);
        }

        // 1. Get economy channels
        const channels = queryAll("SELECT id, name FROM channels WHERE group_tag = '경제'");

        const hitVideos = [];
        let finalTitles = [];
        let fallbackMessage = "";

        if (channels.length === 0) {
            console.log('[EconomyV3] 등록된 경제 채널 없음 -> 실시간 트렌드로 바로 진행');
            fallbackMessage = "등록된 경제 채널이 없어 실시간 트렌드 정보를 기반으로 분석을 시작합니다.";
        } else {
            console.log(`[EconomyV3] 분석 시작: 채널 ${channels.length}개, 기간 ${days}일`);
        }

        for (const channel of channels) {
            // A. Get 30-day average for this channel
            const stats = queryOne(`
                SELECT AVG(view_count) as avg_views 
                FROM videos 
                WHERE channel_id = ? 
                AND published_at >= date('now', '-30 days')
            `, [channel.id]);

            const avgViews = stats?.avg_views || 0;
            const threshold = Math.max(avgViews, 100);

            // B. Find "hit" videos (try strict 2.0x -> lenient 1.3x -> top results)
            let hits = queryAll(`
                SELECT v.id, v.video_id, v.title, v.view_count, v.comment_count, v.published_at, c.name as channel_name
                FROM videos v
                JOIN channels c ON v.channel_id = c.id
                WHERE v.channel_id = ?
                AND v.published_at >= date('now', ?)
                AND v.view_count >= ? * 2.0
                ORDER BY v.view_count DESC
            `, [channel.id, `-${days} days`, threshold]);

            if (hits.length === 0) {
                hits = queryAll(`
                    SELECT v.id, v.video_id, v.title, v.view_count, v.comment_count, v.published_at, c.name as channel_name
                    FROM videos v
                    JOIN channels c ON v.channel_id = c.id
                    WHERE v.channel_id = ?
                    AND v.published_at >= date('now', ?)
                    AND v.view_count >= ? * 1.3
                    ORDER BY v.view_count DESC
                `, [channel.id, `-${days} days`, threshold]);
            }

            if (hits.length === 0) {
                hits = queryAll(`
                    SELECT v.id, v.video_id, v.title, v.view_count, v.comment_count, v.published_at, c.name as channel_name
                    FROM videos v
                    JOIN channels c ON v.channel_id = c.id
                    WHERE v.channel_id = ?
                    AND v.published_at >= date('now', ?)
                    ORDER BY v.view_count DESC
                    LIMIT 3
                `, [channel.id, `-${days} days`]);
            }

            hitVideos.push(...hits);
        }

        console.log(`[EconomyV3] 분석 대상 영상 총 ${hitVideos.length}개 확보 (등록 채널 기반)`);

        // DB에 등록된 채널의 수집 영상만으로 분석 (YouTube API 실시간 검색 제거됨)
        fallbackMessage = hitVideos.length > 0 ? "등록 채널 데이터를 기반으로 분석합니다." : "등록된 경제 채널의 수집 영상이 없습니다. 채널을 등록하고 영상을 수집해주세요.";

        finalTitles = hitVideos.map(v => v.title);

        // 최후의 보루: 만약 검색 결과조차 없다면 (API 에러 등) 하드코딩된 현재의 핫 키워드라도 제공
        if (finalTitles.length === 0) {
            console.log('[EconomyV3] 모든 데이터 부재 -> 정적 키워드 리스트 발동');
            fallbackMessage = "실시간 검색 API 응답이 원활하지 않아 주요 경제 키워드 중심으로 분석을 진행합니니다.";
            finalTitles = ['미국 금리 인하 수혜주', '반도체 시장 전망', '부동산 하락장 대응법', '비트코인 ETF 도입 영향', '삼성전자 배당금', '엔비디아 실적 발표'];
            hitVideos = finalTitles.map(t => ({
                id: 'static_' + Math.random().toString(36).substr(2, 9),
                video_id: 'sample_id',
                title: t,
                view_count: 500000,
                published_at: new Date().toISOString(),
                channel_name: '시장 트렌드'
            }));
        }

        // 2. Extract keywords using AI (Limit to top 60 to prevent timeouts)
        const { extractEconomyKeywords } = await import('../services/gemini-service.js');
        const keywordGroupsArr = await extractEconomyKeywords(finalTitles.slice(0, 60));

        let aiErrorMessage = "";
        if (keywordGroupsArr && keywordGroupsArr.errorType) {
            aiErrorMessage = `AI 분석 오류: ${keywordGroupsArr.message || '알 수 없는 오류'}`;
        } else if (!keywordGroupsArr || keywordGroupsArr.length === 0) {
            if (finalTitles.length > 0) aiErrorMessage = "AI가 영상 제목에서 키워드를 추출하지 못했습니다. (형식 오류 가능성)";
        }

        const keywordGroups = Array.isArray(keywordGroupsArr) ? keywordGroupsArr : [];

        // 3. Enrich keyword groups with stats (핫 지수 알고리즘 적용)
        const enrichedKeywords = keywordGroups.map(group => {
            const matchingVideos = hitVideos.filter(v =>
                (group.titles || []).some(t => {
                    const cleanT = (t || '').trim();
                    const cleanV = (v.title || '').trim();
                    return cleanV.includes(cleanT) || cleanT.includes(cleanV);
                })
            );

            if (matchingVideos.length === 0) return null;

            const now = new Date();
            const totalViews = matchingVideos.reduce((sum, v) => sum + (v.view_count || 0), 0);
            const avgViews = Math.round(totalViews / matchingVideos.length);
            const maxViews = Math.max(...matchingVideos.map(v => v.view_count || 0));

            // [Hot 지수 산정 로직]
            // 1. 최신성 점수: 24시간 이내 영상당 5만점, 48시간 이내 2만점
            let recencyScore = 0;
            matchingVideos.forEach(v => {
                const pubDate = new Date(v.published_at);
                const diffHours = (now - pubDate) / (1000 * 60 * 60);
                if (diffHours <= 24) recencyScore += 50000;
                else if (diffHours <= 48) recencyScore += 20000;
            });

            // 2. 채널 밀도 점수: 다루는 채널이 많을수록 고득점 (채널당 3만점)
            const uniqueChannels = new Set(matchingVideos.map(v => v.channel_name)).size;
            const densityScore = uniqueChannels * 30000;

            // 3. 최종 핫 지수: (평균 조회수) + (최신성 점수) + (밀도 점수) + (떡상수 * 1만점)
            const hotScore = avgViews + recencyScore + densityScore + (matchingVideos.length * 10000);

            return {
                keyword: group.keyword,
                hit_count: matchingVideos.length,
                avg_views: avgViews,
                max_views: maxViews,
                hot_score: hotScore, // 랭킹 기준값
                unique_channels: uniqueChannels,
                videos: matchingVideos
            };
        }).filter(item => item !== null).sort((a, b) => b.hot_score - a.hot_score);

        const responseData = {
            keywords: enrichedKeywords,
            message: fallbackMessage,
            error: aiErrorMessage
        };
        realtimeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });
        res.json(responseData);
    } catch (err) {
        console.error('[EconomyRealtimeV3] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// v3: POST /api/analysis/economy/suggest-topics-v3 — Suggest 10 differentiated topics
router.post('/economy/suggest-topics-v3', async (req, res) => {
    try {
        const { keyword, existingVideos } = req.body;
        if (!keyword) return res.status(400).json({ error: '키워드가 필요합니다.' });

        const { suggestEconomyTopics } = await import('../services/gemini-service.js');
        const result = await suggestEconomyTopics(keyword, existingVideos || []);

        res.json(result);
    } catch (err) {
        console.error('[SuggestTopicsV3] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// v3: POST /api/analysis/economy/thumbnail-titles-v3 — Suggest 3 catchy thumbnail titles
router.post('/economy/thumbnail-titles-v3', async (req, res) => {
    try {
        const { topicTitle, keyword, existingTitles } = req.body;
        const { getThumbnailTitlesV3 } = await import('../services/gemini-service.js');
        const result = await getThumbnailTitlesV3(topicTitle, keyword, existingTitles || []);
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/gaps/economy-realtime', async (req, res) => {
    try {
        const cacheKey = 'economy_realtime';
        const cached = realtimeCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
            console.log('[EconomyRealtime] 캐시 사용 (남은:', Math.round((CACHE_TTL - (Date.now() - cached.timestamp)) / 60000), '분)');
            return res.json(cached.data);
        }

        // 구형 경제 분석 — YouTube API 실시간 검색 제거됨
        res.json({ period: 7, categories: [], mainCategories: [], topRecommendations: [], dataSource: 'removed', cachedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[EconomyRealtime] 오류:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analysis/gaps — gap analysis
router.get('/gaps', async (req, res) => {
    try {
        const { groupX, groupY } = req.query;
        const groups = getCategoryGroups();

        if (groupX && groupY) {
            const matrix = buildGapMatrix(groupX, groupY);

            // Get AI suggestions for gaps
            let suggestions = [];
            if (matrix.gaps.length > 0) {
                try {
                    suggestions = await suggestTopics(
                        matrix.gaps.slice(0, 10).map(g => `${g.y} + ${g.x}`),
                        `${groupY} × ${groupX}`
                    );
                } catch (e) { }
            }

            res.json({ ...matrix, suggestions, groups });
        } else {
            res.json({ groups });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/gaps/multi — advanced tag-based gap analysis
router.post('/gaps/multi', async (req, res) => {
    try {
        const { selectedCategoryIds = [] } = req.body;
        const analysis = getMultiGapAnalysis(selectedCategoryIds);

        // Map selected IDs to names for AI context
        const allCats = queryAll('SELECT id, group_name as "group", name FROM categories');
        const selectedInfo = selectedCategoryIds.map(id => allCats.find(c => c.id === id)).filter(Boolean);

        // AI suggestions
        let suggestions = [];
        if (analysis.gaps.length > 0) {
            try {
                suggestions = await suggestMultiGapTopics(selectedInfo, analysis.gaps.slice(0, 10));
            } catch (e) { }
        }

        res.json({ ...analysis, suggestions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/gaps/deep — high-intensity deep dive for a specific pair
router.post('/gaps/deep', async (req, res) => {
    try {
        const { catX, catY, groupX, groupY, isEconomy, isYadam, meta } = req.body;
        if (!catX || !catY || !groupX || !groupY) {
            return res.status(400).json({ error: '카테고리 정보가 부족합니다.' });
        }

        // DB에서 해당 카테고리 조합에 속하는 기존 영상 목록 가져오기
        let existingVideos = [];
        let existingCount = 0;
        try {
            // 1. Meta (5-way) 정보가 있는 경우 우선 처리
            if (meta && meta.eraId && meta.eventId && meta.sourceId && meta.personId && meta.regionId) {
                existingVideos = queryAll(`
                    SELECT DISTINCT v.id, v.title, v.view_count, v.comment_count, v.published_at, v.transcript_summary, v.description, c.name as channel_name
                    FROM videos v
                    JOIN channels c ON v.channel_id = c.id
                    JOIN video_categories vc1 ON v.id = vc1.video_id AND vc1.category_id = ?
                    JOIN video_categories vc2 ON v.id = vc2.video_id AND vc2.category_id = ?
                    JOIN video_categories vc3 ON v.id = vc3.video_id AND vc3.category_id = ?
                    JOIN video_categories vc4 ON v.id = vc4.video_id AND vc4.category_id = ?
                    JOIN video_categories vc5 ON v.id = vc5.video_id AND vc5.category_id = ?
                    ORDER BY v.view_count DESC
                    LIMIT 30
                `, [meta.eraId, meta.eventId, meta.sourceId, meta.personId, meta.regionId]);
            }

            // 2. Meta 정보가 없거나 결과가 없는 경우 기존 3중/2중 교집합 로직 수행
            if (existingVideos.length === 0) {
                const catXRow = queryOne('SELECT id FROM categories WHERE name = ? AND group_name = ?', [catX, groupX]);

                if (catXRow) {
                    if (isYadam && catY.includes('[') && catY.includes(']')) {
                        const eraNameMatch = catY.match(/\[(.*?)\]/);
                        const eventNameMatch = catY.split(']')[1]?.trim();

                        if (eraNameMatch && eventNameMatch) {
                            const eraRow = queryOne('SELECT id FROM categories WHERE name = ? AND group_name = "시대"', [eraNameMatch[1]]);
                            const eventRow = queryOne('SELECT id FROM categories WHERE name = ? AND group_name = "사건유형"', [eventNameMatch]);

                            if (eraRow && eventRow) {
                                existingVideos = queryAll(`
                                    SELECT DISTINCT v.id, v.title, v.view_count, v.comment_count, v.published_at, v.transcript_summary, v.description, c.name as channel_name
                                    FROM videos v
                                    JOIN channels c ON v.channel_id = c.id
                                    JOIN video_categories vc1 ON v.id = vc1.video_id AND vc1.category_id = ?
                                    JOIN video_categories vc2 ON v.id = vc2.video_id AND vc2.category_id = ?
                                    JOIN video_categories vc3 ON v.id = vc3.video_id AND vc3.category_id = ?
                                    ORDER BY v.view_count DESC
                                    LIMIT 30
                                `, [eraRow.id, eventRow.id, catXRow.id]);
                            }
                        }
                    }

                    if (existingVideos.length === 0) {
                        const catYRow = queryOne('SELECT id FROM categories WHERE name = ? AND group_name = ?', [catY, groupY]);
                        if (catYRow) {
                            existingVideos = queryAll(`
                                SELECT DISTINCT v.id, v.title, v.view_count, v.comment_count, v.published_at, v.transcript_summary, v.description, c.name as channel_name
                                FROM videos v
                                JOIN channels c ON v.channel_id = c.id
                                JOIN video_categories vc1 ON v.id = vc1.video_id AND vc1.category_id = ?
                                JOIN video_categories vc2 ON v.id = vc2.video_id AND vc2.category_id = ?
                                ORDER BY v.view_count DESC
                                LIMIT 30
                            `, [catXRow.id, catYRow.id]);
                        }
                    }
                }
            }

            // 3. 마지막 수단: 키워드 검색 기반 Fallback
            if (existingVideos.length === 0) {
                const keywords = [
                    ...catX.split(/[\/\s,]+/).filter(k => k.length >= 2),
                    ...catY.replace(/\[|\]/g, ' ').split(/[\/\s,]+/).filter(k => k.length >= 2)
                ];
                if (keywords.length > 0) {
                    const likeClauses = keywords.map(() => '(v.title LIKE ? OR v.description LIKE ?)').join(' OR ');
                    const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);
                    existingVideos = queryAll(`
                        SELECT DISTINCT v.id, v.title, v.view_count, v.comment_count, v.published_at, v.transcript_summary, v.description, c.name as channel_name
                        FROM videos v
                        JOIN channels c ON v.channel_id = c.id
                        WHERE (${likeClauses})
                        AND v.published_at >= date('now', '-365 days')
                        ORDER BY v.view_count DESC
                        LIMIT 30
                    `, params);
                }
            }
            existingCount = existingVideos.length;
        } catch (dbErr) {
            console.warn('[deepGaps] DB 조회 실패:', dbErr.message);
        }

        console.log(`[deepGaps] ${catY} × ${catX} — 기존 영상 ${existingCount}개, 떡상 DNA 분석 시작`);

        // DNA 추출
        let dnaSummary = null;
        let spikeCount = 0;
        try {
            if (existingVideos.length > 2) {
                const spikeInfo = pickSpikeVideos(existingVideos, { minRatio: 2.5, topPercent: 0.3 });
                if (spikeInfo.spikes.length > 0) {
                    spikeCount = spikeInfo.spikes.length;
                    // 고급 DNA 추출로 교체
                    dnaSummary = await extractAdvancedDNA(spikeInfo.spikes, isYadam ? '야담' : (isEconomy ? '경제' : '일반'));
                }
            }
        } catch (e) {
            console.warn('[deepGaps] DNA 분석 실패:', e.message);
        }

        // AI 추천 생성
        const suggestions = await deepSuggestTopics(catX, catY, groupX, groupY, existingVideos, isEconomy, dnaSummary, isYadam);

        res.json({ suggestions, existingCount, dnaSummary, spikeCount, existingVideos });
    } catch (err) {
        console.error('[deepGaps] 오류:', err.message);
        // Use the status code from the error if available
        const status = err.status || 500;
        res.status(status).json({
            error: err.errorType || 'SERVER_ERROR',
            message: err.message
        });
    }
});

// POST /api/analysis/unique-skeleton — generate unique script skeleton from keyword
router.post('/unique-skeleton', async (req, res) => {
    try {
        const { keyword, requirements } = req.body;
        if (!keyword) return res.status(400).json({ error: '키워드를 입력해주세요.' });

        // Search for existing related videos
        const relatedVideos = queryAll(
            'SELECT id, title, description, transcript_summary FROM videos WHERE title LIKE ? OR description LIKE ? OR transcript_summary LIKE ? LIMIT 15',
            [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
        );

        const result = await generateUniqueSkeleton(keyword, relatedVideos, requirements);
        if (!result) return res.status(500).json({ error: 'AI 뼈대 생성에 실패했습니다.' });

        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/gaps/script-plan — generate full SEO & script package
router.post('/gaps/script-plan', async (req, res) => {
    try {
        const { title, keywords, catX, catY, groupX, groupY, type } = req.body;
        if (!title || !keywords) {
            return res.status(400).json({ error: '주제 제목과 키워드가 필요합니다.' });
        }

        // Context search: find videos in this category pair to ensure uniqueness
        let existingVideos = [];
        try {
            const catXRow = queryOne('SELECT id FROM categories WHERE name = ? AND group_name = ?', [catX, groupX]);
            const catYRow = queryOne('SELECT id FROM categories WHERE name = ? AND group_name = ?', [catY, groupY]);
            if (catXRow && catYRow) {
                existingVideos = queryAll(`
                    SELECT v.title, v.view_count, v.comment_count, v.published_at, v.transcript_summary, v.description 
                    FROM videos v
                    JOIN video_categories vc1 ON v.id = vc1.video_id AND vc1.category_id = ?
                    JOIN video_categories vc2 ON v.id = vc2.video_id AND vc2.category_id = ?
                    ORDER BY v.view_count DESC
                    LIMIT 15
                `, [catXRow.id, catYRow.id]);
            }
        } catch (dbErr) { }

        // [DNA 추출 단계]
        let dnaSummary = null;
        try {
            if (existingVideos.length > 2) {
                const spikeInfo = pickSpikeVideos(existingVideos, { minRatio: 2.5, topPercent: 0.4 });
                if (spikeInfo.spikes.length > 0) {
                    dnaSummary = extractSpikeDNA(spikeInfo.spikes);
                }
            }
        } catch (e) { }

        const { generateFullScriptPlan, generateEconomySkeletonV3 } = await import('../services/gemini-service.js');

        // v3 economy-specific skeleton integration
        if (type === 'economy-v3') {
            const { existingTitles = [], top3Titles = [], differentiation_reason = '', target_audience = '', conclusion_type = '', primary_asset = '', forbidden_keywords = [], narrative_blueprint = '' } = req.body;
            const skeletonData = await generateEconomySkeletonV3(title, keywords[0] || "", existingTitles, top3Titles, differentiation_reason, target_audience, conclusion_type, primary_asset, forbidden_keywords, narrative_blueprint);
            return res.json({ script_skeleton: skeletonData, isEconomyV3: true, dnaSummary });
        }

        const plan = await generateFullScriptPlan(title, keywords, existingVideos, type || 'all', dnaSummary);

        if (!plan) return res.status(500).json({ error: '기획안 생성에 실패했습니다.' });
        res.json({ ...plan, dnaSummary }); // Return DNA object in response
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/trends
router.get('/trends', (req, res) => {
    try {
        const { months = 12, group } = req.query;
        if (group) {
            res.json(getTrendsByCategory(group, parseInt(months)));
        } else {
            res.json(getTrends(parseInt(months)));
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/dashboard — dashboard summary
router.get('/dashboard', (req, res) => {
    try {
        const channelCount = queryOne('SELECT COUNT(*) as cnt FROM channels')?.cnt || 0;
        const videoCount = queryOne('SELECT COUNT(*) as cnt FROM videos')?.cnt || 0;
        const keywordCount = queryOne('SELECT COUNT(*) as cnt FROM keywords')?.cnt || 0;
        const ideaCount = queryOne("SELECT COUNT(*) as cnt FROM ideas WHERE status != 'archived'")?.cnt || 0;
        const unanalyzed = queryOne('SELECT COUNT(*) as cnt FROM videos WHERE is_analyzed = 0')?.cnt || 0;
        const recentVideos = queryAll(`
      SELECT v.title, v.view_count, v.published_at, v.thumbnail_url, c.name as channel_name
      FROM videos v LEFT JOIN channels c ON v.channel_id = c.id
      ORDER BY v.fetched_at DESC LIMIT 5
    `);
        const topKeywords = queryAll('SELECT word, total_count, is_saturated FROM keywords ORDER BY total_count DESC LIMIT 30');

        res.json({ channelCount, videoCount, keywordCount, ideaCount, unanalyzed, recentVideos, topKeywords });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/search — unified search
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ videos: [], channels: [], ideas: [] });

        const videos = queryAll(`
      SELECT v.id, v.title, v.video_id, 'video' as type, c.name as channel_name
      FROM videos v LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.title LIKE ? OR v.description LIKE ?
      LIMIT 10
    `, [`%${q}%`, `%${q}%`]);

        const channels = queryAll(`
      SELECT id, name, handle, 'channel' as type FROM channels
      WHERE name LIKE ? OR handle LIKE ? LIMIT 5
    `, [`%${q}%`, `%${q}%`]);

        const ideas = queryAll(`
      SELECT id, title, status, 'idea' as type FROM ideas
      WHERE title LIKE ? OR description LIKE ? LIMIT 5
    `, [`%${q}%`, `%${q}%`]);

        res.json({ videos, channels, ideas });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════
// v4: POST /api/analysis/benchmark/:videoId — AI Benchmark Report
// ═══════════════════════════════════════════════════════════
router.post('/benchmark/:videoId', async (req, res) => {
    try {
        const video = queryOne(`
      SELECT v.*, c.name as channel_name, c.subscriber_count
      FROM videos v LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.id = ?`, [req.params.videoId]);
        if (!video) return res.status(404).json({ error: '영상을 찾을 수 없습니다.' });

        // Check cache
        const cached = queryOne('SELECT * FROM benchmark_reports WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.videoId]);
        if (cached && !req.body.force) {
            return res.json({ report: JSON.parse(cached.report_json), source: 'cached' });
        }

        // Fetch comments if not already
        let commentsAnalysis = null;
        if (video.video_id && !video.video_id.startsWith('manual_')) {
            try {
                const comments = await fetchComments(video.video_id, 50);
                if (comments.length > 0) {
                    commentsAnalysis = await analyzeComments(comments, video.title);
                }
            } catch (e) { }
        }

        // Generate report
        const report = await generateBenchmarkReport({
            ...video,
            subscriber_count: video.subscriber_count || 0,
            comments_analysis: commentsAnalysis
        });

        if (!report) {
            return res.status(500).json({ error: 'AI 리포트 생성에 실패했습니다. Gemini API 키를 확인해주세요.' });
        }

        // Attach comments analysis
        report.comments_analysis = commentsAnalysis;

        // Cache
        runSQL('INSERT INTO benchmark_reports (video_id, report_json) VALUES (?, ?)',
            [req.params.videoId, JSON.stringify(report)]);

        res.json({ report, source: 'generated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ v4: POST /api/analysis/comments — analyze comments with AI ═══
router.post('/comments/:videoId', async (req, res) => {
    try {
        const video = queryOne('SELECT * FROM videos WHERE video_id = ?', [req.params.videoId]);
        const videoTitle = video?.title || req.body.title || '';

        // Fetch fresh comments
        const comments = await fetchComments(req.params.videoId, 150);
        if (comments.length === 0) return res.json({ comments: [], analysis: null, message: '댓글을 가져올 수 없습니다.' });

        // AI analysis
        let analysis = null;
        try {
            analysis = await analyzeComments(comments, videoTitle);
        } catch (e) { }

        res.json({ comments, analysis, total: comments.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/scripts/edit — AI edit script based on instructions
router.post('/scripts/edit', async (req, res) => {
    try {
        const { content, instructions } = req.body;
        if (!content) return res.status(400).json({ error: '대본 내용을 입력해주세요.' });
        const edited = await editScript(content, instructions);
        res.json({ content: edited });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
