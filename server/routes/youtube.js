import { Router } from 'express';
import { queryOne, queryAll, runSQL } from '../db.js';
import { fetchChannelVideos, searchVideos, fetchComments } from '../services/youtube-fetcher.js';
import { fetchTranscript } from '../services/transcript-fetcher.js';
import { extractKeywords, categorizeVideo, summarizeTranscript } from '../services/gemini-service.js';
import { categorizeVideoByKeywords } from '../services/gap-analyzer.js';

const router = Router();
const activeJobs = new Map();

// ═══════════════════════════════════════════════════════════
// v4: POST /api/youtube/search — trending/viral video search
// ═══════════════════════════════════════════════════════════
router.post('/search', async (req, res) => {
    try {
        const { keyword, period, videoType, maxResults, minSubscribers, minViews, order } = req.body;
        if (!keyword) return res.status(400).json({ error: '검색 키워드를 입력해주세요.' });
        const results = await searchVideos({ keyword, period, videoType, maxResults, minSubscribers, minViews, order });
        res.json({ results, total: results.length, keyword });
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
            return res.status(409).json({ error: '이미 수집 중입니다.' });
        }

        // Start job
        const job = { status: 'fetching', progress: 0, total: 0, cancel: false, errors: [] };
        activeJobs.set(channelDbId, job);
        res.json({ message: '수집을 시작합니다.', jobId: channelDbId });

        // Run in background
        processChannel(channel, channelDbId, maxResults, job).catch(err => {
            console.error('Fetch error:', err);
            job.status = 'error';
            job.error = err.message;
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/youtube/status/:channelId — get fetch job status
router.get('/status/:channelId', (req, res) => {
    const job = activeJobs.get(req.params.channelId);
    if (!job) return res.json({ status: 'idle' });
    res.json(job);
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
            if (job.cancel) { job.status = 'cancelled'; activeJobs.delete(channelDbId); return; }

            const v = videos[i];
            job.progress = i + 1;
            job.status = 'processing';

            // Check if video already exists
            const existing = queryOne('SELECT id FROM videos WHERE video_id = ?', [v.video_id]);
            if (existing) continue;

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

            // Extract keywords via Gemini (or fallback)
            try {
                const keywords = await extractKeywords(v.title, v.description, transcriptText || '');

                // Summarize transcript if available
                let summary = '';
                if (transcriptText) {
                    summary = await summarizeTranscript(transcriptText) || '';
                }

                // Save keywords
                for (const kw of keywords) {
                    // Upsert keyword
                    runSQL('INSERT OR IGNORE INTO keywords (word) VALUES (?)', [kw]);
                    const kwRow = queryOne('SELECT id FROM keywords WHERE word = ?', [kw]);
                    if (kwRow) {
                        runSQL('INSERT OR IGNORE INTO video_keywords (video_id, keyword_id, frequency) VALUES (?, ?, 1)', [videoDbId, kwRow.id]);
                        runSQL('UPDATE keywords SET total_count = total_count + 1 WHERE id = ?', [kwRow.id]);
                    }
                }

                // Save summary and keywords text
                runSQL('UPDATE videos SET transcript_summary = ?, transcript_keywords = ?, is_analyzed = 1 WHERE id = ?',
                    [summary, keywords.join(','), videoDbId]);

                // Categorize
                const catGroups = queryAll('SELECT DISTINCT group_name FROM categories');
                if (catGroups.length > 0) {
                    const groupsWithItems = catGroups.map(g => ({
                        group_name: g.group_name,
                        items: queryAll('SELECT name FROM categories WHERE group_name = ?', [g.group_name]).map(c => c.name)
                    }));
                    const catResult = await categorizeVideo(v.title, keywords, groupsWithItems);
                    let finalCategories = {};
                    let economyMetadata = {};

                    if (catResult && typeof catResult === 'object') {
                        if (catResult.categories) {
                            finalCategories = catResult.categories;
                            economyMetadata = catResult.economy_metadata || {};
                        } else {
                            finalCategories = catResult;
                        }

                        // Save categories (Fuzzy matching + Keyword fallback)
                        const allDBCats = queryAll('SELECT * FROM categories');

                        // 1. AI Results Matching (Fuzzy)
                        for (const [group, aiCatName] of Object.entries(finalCategories)) {
                            // Exact match first
                            let cat = queryOne('SELECT id FROM categories WHERE group_name = ? AND name = ?', [group, aiCatName]);

                            // If no exact match, try fuzzy (contained)
                            if (!cat) {
                                cat = queryOne('SELECT id FROM categories WHERE group_name = ? AND (name LIKE ? OR ? LIKE "%" || name || "%")', [group, `%${aiCatName}%`, aiCatName]);
                            }

                            if (cat) {
                                runSQLNoSave('INSERT OR IGNORE INTO video_categories (video_id, category_id, source) VALUES (?, ?, ?)', [videoDbId, cat.id, 'ai']);
                            }
                        }

                        // 2. Keyword-based Fallback (Always run as safety net)
                        const keywordCats = categorizeVideoByKeywords({ title: v.title, description: v.description || '' }, allDBCats);
                        for (const catId of keywordCats) {
                            runSQLNoSave('INSERT OR IGNORE INTO video_categories (video_id, category_id, source) VALUES (?, ?, ?)', [videoDbId, catId, 'keyword_fallback']);
                        }

                        // Save economy metadata if available
                        if (Object.keys(economyMetadata).length > 0) {
                            runSQLNoSave('UPDATE videos SET economy_metadata = ? WHERE id = ?', [JSON.stringify(economyMetadata), videoDbId]);
                        }
                    }
                }
            } catch (e) {
                job.errors.push(`${v.title}: ${e.message}`);
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
