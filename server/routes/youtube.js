import { Router } from 'express';
import { queryOne, queryAll, runSQL } from '../db.js';
import { fetchChannelVideos, searchVideos, fetchComments } from '../services/youtube-fetcher.js';
import { fetchTranscript } from '../services/transcript-fetcher.js';
import { extractKeywords, categorizeVideo, summarizeTranscript, fallbackKeywords } from '../services/gemini-service.js';
import { categorizeVideoByKeywords } from '../services/gap-analyzer.js';
import { classifySingleVideoSubCategory } from './analysis.js';

const router = Router();
const activeJobs = new Map();

// ═══════════════════════════════════════════════════════════
// v4: POST /api/youtube/search — trending/viral video search
// ═══════════════════════════════════════════════════════════
router.post('/search', async (req, res) => {
    try {
        const { keyword, period, videoType, maxResults, minSubscribers, minViews, order, pageToken } = req.body;
        if (!keyword) return res.status(400).json({ error: '검색 키워드를 입력해주세요.' });
        const { results, nextPageToken } = await searchVideos({ keyword, period, videoType, maxResults, minSubscribers, minViews, order, pageToken });
        res.json({ results, nextPageToken, total: results.length, keyword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
// v4: GET /api/youtube/comments/:videoId — fetch comments
// ═══════════════════════════════════════════════════════════
router.get('/comments/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const { max = 150 } = req.query;
        const comments = await fetchComments(videoId, parseInt(max));

        // Save to DB if we have a matching video
        const video = queryOne('SELECT id FROM videos WHERE video_id = ?', [videoId]);
        if (video) {
            runSQL('DELETE FROM comments WHERE video_id = ?', [video.id]);
            for (const c of comments) {
                runSQL('INSERT OR IGNORE INTO comments (video_id, comment_id, author, text, like_count, published_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [video.id, c.comment_id, c.author, c.text, c.like_count, c.published_at]);
            }
            runSQL('UPDATE videos SET comment_count = ? WHERE id = ?', [comments.length, video.id]);
        }

        res.json({ comments, total: comments.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/youtube/fetch/:channelId — start fetching videos for a channel
router.post('/fetch/:channelId', async (req, res) => {
    const channelDbId = req.params.channelId;
    const { maxResults = 5000 } = req.body;

    try {
        const channel = queryOne('SELECT * FROM channels WHERE id = ?', [channelDbId]);
        if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다.' });

        if (activeJobs.has(channelDbId)) {
            return res.status(409).json({ error: '이미 수집 중입니다.', status: 'processing' });
        }

        // 즉시 job 등록 후 백그라운드에서 독립 실행
        const job = { status: 'queued', progress: 0, total: 0, cancel: false, errors: [] };
        activeJobs.set(channelDbId, job);

        res.json({ message: '수집을 시작합니다.', jobId: channelDbId, status: 'started' });

        processChannel(channel, channelDbId, maxResults, job).catch(e => {
            console.error('[processChannel] 오류:', channelDbId, e.message);
            job.status = 'error';
            job.error = e.message;
            setTimeout(() => activeJobs.delete(channelDbId), 30000);
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/youtube/status/:channelId — get fetch job status
router.get('/status/:channelId', (req, res) => {
    const job = activeJobs.get(req.params.channelId);
    if (!job) return res.json({ status: 'idle' });
    res.json({
        status: job.status,
        progress: job.progress,
        total: job.total,
        completedCount: job.completedCount || job.progress,
        errors: job.errors
    });
});

// GET /api/youtube/status-all — 모든 활성 수집 작업 상태 일괄 반환 (개별 150회 호출 방지)
router.get('/status-all', (req, res) => {
    const result = {};
    for (const [id, job] of activeJobs.entries()) {
        result[id] = {
            status: job.status,
            progress: job.progress,
            total: job.total,
            completedCount: job.completedCount || job.progress
        };
    }
    res.json(result);
});

// POST /api/youtube/cancel/:channelId — cancel ongoing fetch
router.post('/cancel/:channelId', (req, res) => {
    const job = activeJobs.get(req.params.channelId);
    if (job) job.cancel = true;
    res.json({ success: true });
});

async function processChannel(channel, channelDbId, maxResults, job) {
    try {
        // Check transcript setting
        const transcriptSetting = queryOne("SELECT value FROM settings WHERE key = 'transcript_enabled'");
        const transcriptEnabled = transcriptSetting?.value !== 'false';

        // Fetch video list
        job.status = 'fetching_list';
        const videos = await fetchChannelVideos(channel.channel_id, maxResults, channel.last_fetched);
        job.total = videos.length;

        // Insert videos and analyze
        for (let i = 0; i < videos.length; i++) {
            if (job.cancel) {
                job.status = 'cancelled';
                job.completedCount = job.progress;
                setTimeout(() => activeJobs.delete(channelDbId), 30000);
                return;
            }

            const v = videos[i];
            try {
            job.progress = i + 1;
            job.status = 'processing';

            // Check if video already exists
            console.log(`[DEBUG-EXIST] video_id=${v.video_id}, title=${v.title}`);
            const existing = queryOne('SELECT id FROM videos WHERE video_id = ?', [v.video_id]);
            if (existing) { console.log(`[DEBUG-EXIST] SKIP: ${v.video_id} already exists`); continue; }
            console.log(`[DEBUG] video_id=${v.video_id}, existing=${!!existing}`);

            // Insert video
            const { lastId: videoDbId } = runSQL(
                `INSERT INTO videos (channel_id, video_id, title, description, tags, published_at, view_count, like_count, duration_seconds, thumbnail_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [channelDbId, v.video_id, v.title, v.description, v.tags, v.published_at, v.view_count, v.like_count, v.duration_seconds, v.thumbnail_url]
            );

            // Fetch transcript if enabled
            let transcriptText = null;
            if (transcriptEnabled) {
                try {
                    transcriptText = await fetchTranscript(v.video_id);
                    if (transcriptText) {
                        runSQL('UPDATE videos SET has_transcript = 1 WHERE id = ?', [videoDbId]);
                    }
                } catch (e) {
                    // Skip transcript errors silently
                }
            }

            // Cancel check: after transcript fetch
            if (job.cancel) {
                job.status = 'cancelled';
                job.completedCount = job.progress;
                console.log('[수집 중단] ' + channelDbId + ' - ' + job.progress + '개 수집 완료 후 중단');
                setTimeout(() => activeJobs.delete(channelDbId), 30000);
                return;
            }

            // ── 키워드 추출: fallbackKeywords 사용 (Gemini 호출 없음) ──────
            try {
                const keywords = fallbackKeywords(v.title, v.description || '');

                // [주석 처리] Gemini extractKeywords — 채널 수집 시 Gemini 호출 차단
                // const keywords = await extractKeywords(v.title, v.description, transcriptText || '');

                // [주석 처리] summarizeTranscript — 채널 수집 시 비활성화
                // let summary = '';
                // if (transcriptText) {
                //     summary = await summarizeTranscript(transcriptText) || '';
                // }
                const summary = '';

                // Save keywords
                for (const kw of keywords) {
                    runSQL('INSERT OR IGNORE INTO keywords (word) VALUES (?)', [kw]);
                    const kwRow = queryOne('SELECT id FROM keywords WHERE word = ?', [kw]);
                    if (kwRow) {
                        runSQL('INSERT OR IGNORE INTO video_keywords (video_id, keyword_id, frequency) VALUES (?, ?, 1)', [videoDbId, kwRow.id]);
                        runSQL('UPDATE keywords SET total_count = total_count + 1 WHERE id = ?', [kwRow.id]);
                    }
                }

                // Save keywords text (summary 비어있음 — Gemini 미사용)
                runSQL('UPDATE videos SET transcript_summary = ?, transcript_keywords = ?, is_analyzed = 1 WHERE id = ?',
                    [summary, keywords.join(','), videoDbId]);

                // Cancel check
                if (job.cancel) {
                    job.status = 'cancelled';
                    job.completedCount = job.progress;
                    console.log('[수집 중단] ' + channelDbId + ' - ' + job.progress + '개 수집 완료 후 중단');
                    setTimeout(() => activeJobs.delete(channelDbId), 30000);
                    return;
                }

                // ── 키워드 기반 카테고리 분류 (Gemini 없음) ──────────────────
                const allDBCats = queryAll('SELECT * FROM categories');
                if (allDBCats.length > 0) {
                    const keywordCats = categorizeVideoByKeywords({ title: v.title, description: v.description || '' }, allDBCats);
                    for (const catId of keywordCats) {
                        runSQL('INSERT OR IGNORE INTO video_categories (video_id, category_id, source) VALUES (?, ?, ?)', [videoDbId, catId, 'keyword_fallback']);
                    }
                }

                // [주석 처리] categorizeVideo (Gemini) — 채널 수집 시 비활성화
                // const catGroups = queryAll('SELECT DISTINCT group_name FROM categories');
                // if (catGroups.length > 0) {
                //     const groupsWithItems = catGroups.map(g => ({
                //         group_name: g.group_name,
                //         items: queryAll('SELECT name FROM categories WHERE group_name = ?', [g.group_name]).map(c => c.name)
                //     }));
                //     await new Promise(resolve => setTimeout(resolve, 3000));
                //     const catResult = await categorizeVideo(v.title, keywords, groupsWithItems);
                //     ... (AI fuzzy matching, economy_metadata 저장 등)
                // }

                // [주석 처리] classifySingleVideoSubCategory (Gemini) — 채널 수집 시 비활성화
                // try {
                //     const eventCatNames = queryAll(`SELECT c.name FROM video_categories vc
                //         JOIN categories c ON vc.category_id = c.id
                //         WHERE vc.video_id = ? AND c.group_name = '사건유형'`, [videoDbId]).map(r => r.name);
                //     if (eventCatNames.length > 0) {
                //         await classifySingleVideoSubCategory(v.video_id, v.title, eventCatNames);
                //     }
                // } catch (subCatErr) { ... }

            } catch (e) {
                job.errors.push(`${v.title}: ${e.message}`);
            }
            } catch (err) {
                console.error('[ERROR] 영상 처리 실패:', v.video_id, err.message);
            }

            // 수집 중지 여부 확인 (이미 저장된 영상은 유지)
            const activeCheck = queryOne('SELECT is_active, name FROM channels WHERE id = ?', [channelDbId]);
            if (activeCheck && activeCheck.is_active === 0) {
                job.status = 'cancelled';
                job.completedCount = job.progress;
                console.log(`[수집 중단] ${channelDbId} - ${job.progress}개 수집 완료 후 중단`);
                setTimeout(() => activeJobs.delete(channelDbId), 30000);
                break;
            }
        }

        // Update channel last_fetched
        runSQL('UPDATE channels SET last_fetched = ? WHERE id = ?', [new Date().toISOString(), channelDbId]);
        job.status = 'complete';

        // Cleanup job after 30 seconds
        setTimeout(() => activeJobs.delete(channelDbId), 30000);
    } catch (err) {
        job.status = 'error';
        job.error = err.message;
        setTimeout(() => activeJobs.delete(channelDbId), 30000);
    }
}

export default router;
