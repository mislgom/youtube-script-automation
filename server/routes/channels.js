import { Router } from 'express';
import { queryAll, queryOne, runSQL, runSQLNoSave, saveDB } from '../db.js';
import { resolveChannel } from '../services/youtube-fetcher.js';

const router = Router();

// GET /api/channels — list all channels
router.get('/', (req, res) => {
    try {
        const channels = queryAll(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM videos v WHERE v.channel_id = c.id) as collected_count
      FROM channels c ORDER BY c.created_at DESC
    `);
        res.json(channels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/channels/preview — preview channel info before registering
router.post('/preview', async (req, res) => {
    try {
        const { input } = req.body;
        if (!input) return res.status(400).json({ error: '채널 URL 또는 ID를 입력해주세요.' });
        const info = await resolveChannel(input);
        res.json(info);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/channels — register a new channel
router.post('/', async (req, res) => {
    try {
        const { channel_id, name, handle, thumbnail_url, subscriber_count, video_count, group_tag, description } = req.body;
        if (!channel_id || !name) return res.status(400).json({ error: '필수 정보가 없습니다.' });

        const existing = queryOne('SELECT id FROM channels WHERE channel_id = ?', [channel_id]);
        if (existing) return res.status(409).json({ error: '이미 등록된 채널입니다.' });

        const { lastId } = runSQL(
            `INSERT INTO channels (channel_id, name, handle, thumbnail_url, subscriber_count, video_count, group_tag, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [channel_id, name, handle || '', thumbnail_url || '', subscriber_count || 0, video_count || 0, group_tag || '', description || '']
        );

        // Deep categorization: Fetch videos if missing, then analyze
        let finalGroupTag = group_tag || '';
        if (!finalGroupTag) {
            try {
                const { classifyChannel } = await import('../services/gemini-service.js');
                const { fetchChannelVideos } = await import('../services/youtube-fetcher.js');

                let videoData = req.body.initial_video_data || [];

                // If no initial data, fetch from YouTube immediately
                if (videoData.length === 0 && channel_id) {
                    const ytVideos = await fetchChannelVideos(channel_id, 15);
                    videoData = ytVideos.map(v => ({ title: v.title, description: v.description }));

                    // Save these videos to DB immediately
                    for (const v of ytVideos) {
                        try {
                            runSQL(`INSERT OR IGNORE INTO videos (
                                channel_id, video_id, title, description, published_at, 
                                view_count, like_count, comment_count, duration_seconds, thumbnail_url
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                                lastId, v.video_id, v.title, v.description, v.published_at,
                                v.view_count, v.like_count, v.comment_count, v.duration_seconds, v.thumbnail_url
                            ]);
                        } catch (vidErr) { /* ignore */ }
                    }
                }

                if (videoData.length > 0) {
                    const category = await classifyChannel(name, videoData, req.body.search_context, description || '');
                    if (category && category !== '미분류') {
                        runSQL('UPDATE channels SET group_tag = ? WHERE id = ?', [category, lastId]);
                        finalGroupTag = category;
                    }
                }
            } catch (err) {
                console.error('Deep classification during registration failed:', err.message);
            }
        }

        const channel = queryOne('SELECT * FROM channels WHERE id = ?', [lastId]);
        res.json(channel);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/channels/:id — get single channel
router.get('/:id', (req, res) => {
    try {
        const channel = queryOne('SELECT * FROM channels WHERE id = ?', [req.params.id]);
        if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
        res.json(channel);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/channels/:id/toggle-active — toggle channel active state
router.put('/:id/toggle-active', (req, res) => {
    try {
        const { id } = req.params;
        const channel = queryOne('SELECT is_active FROM channels WHERE id = ?', [id]);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        const newState = channel.is_active ? 0 : 1;
        runSQL('UPDATE channels SET is_active = ? WHERE id = ?', [newState, id]);
        res.json({ id, is_active: newState });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/channels/:id — delete channel and its videos
router.delete('/:id', (req, res) => {
    try {
        const channel = queryOne('SELECT * FROM channels WHERE id = ?', [req.params.id]);
        if (!channel) return res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
        runSQL('DELETE FROM channels WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: `${channel.name} 채널이 삭제되었습니다.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/channels/:id/categorized-videos — get videos grouped by categories
router.get('/:id/categorized-videos', (req, res) => {
    try {
        const channelId = req.params.id;

        // 1. Get all categories for context
        const categories = queryAll('SELECT * FROM categories ORDER BY group_name, sort_order');
        const groups = [...new Set(categories.map(c => c.group_name))];

        // 2. Get videos with their linked categories
        const videos = queryAll(`
            SELECT v.id, v.title, v.video_id, v.published_at, v.view_count, v.thumbnail_url,
                   c.id as cat_id, c.name as cat_name, c.group_name as group_name
            FROM videos v
            LEFT JOIN video_categories vc ON v.id = vc.video_id
            LEFT JOIN categories c ON vc.category_id = c.id
            WHERE v.channel_id = ?
            ORDER BY v.published_at DESC
        `, [channelId]);

        // 3. Structure the data: Group -> Category -> Videos
        const result = groups.map(groupName => {
            const groupCats = categories.filter(c => c.group_name === groupName);
            return {
                group: groupName,
                categories: groupCats.map(cat => {
                    const catVideos = videos.filter(v => v.cat_id === cat.id);
                    return {
                        id: cat.id,
                        name: cat.name,
                        count: catVideos.length,
                        videos: catVideos.slice(0, 50) // Limit per category for performance
                    };
                }),
                // Videos with no category in THIS group
                uncategorized: videos.filter(v => {
                    const hasCatInGroup = videos.some(v2 => v2.id === v.id && v2.group_name === groupName);
                    return !hasCatInGroup;
                }).length
            };
        });

        // 4. Special "All" category for the channel
        const totalCount = queryOne('SELECT COUNT(*) as count FROM videos WHERE channel_id = ?', [channelId]).count;

        res.json({
            channel_id: channelId,
            total_videos: totalCount,
            structure: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/channels/auto-categorize-all — analyze all channels with AI and set categories
router.post('/auto-categorize-all', async (req, res) => {
    try {
        const { classifyChannel } = await import('../services/gemini-service.js');
        const { fetchChannelVideos, resolveChannel } = await import('../services/youtube-fetcher.js');

        // Select all channels to allow re-categorization and track current tags
        const channels = queryAll('SELECT id, channel_id, name, description, group_tag FROM channels');
        if (channels.length === 0) return res.json({ success: true, count: 0 });

        let count = 0;
        const results = [];

        // v6: High speed parallel processing with batch saving
        const CHUNK_SIZE = 5;
        for (let i = 0; i < channels.length; i += CHUNK_SIZE) {
            const chunk = channels.slice(i, i + CHUNK_SIZE);
            console.log(`[AI 분류 배치] ${i + 1}~${Math.min(i + CHUNK_SIZE, channels.length)}번째 채널 분석 중...`);

            await Promise.all(chunk.map(async (ch) => {
                try {
                    // 1. Get titles AND descriptions from DB
                    const videos = queryAll('SELECT title, description FROM videos WHERE channel_id = ? ORDER BY published_at DESC LIMIT 15', [ch.id]);
                    let videoData = videos.map(v => ({ title: v.title, description: v.description }));
                    let currentDescription = ch.description || '';

                    // 2. Fetch data if missing
                    if ((videoData.length === 0 || !currentDescription) && ch.channel_id) {
                        try {
                            const ytInfo = await resolveChannel(ch.channel_id);
                            if (!currentDescription && ytInfo.description) {
                                currentDescription = ytInfo.description;
                                runSQLNoSave('UPDATE channels SET description = ? WHERE id = ?', [currentDescription, ch.id]);
                            }
                            if (videoData.length === 0) {
                                const ytVideos = await fetchChannelVideos(ch.channel_id, 15);
                                videoData = ytVideos.map(v => ({ title: v.title, description: v.description }));

                                for (const v of ytVideos) {
                                    try {
                                        runSQLNoSave(`INSERT OR IGNORE INTO videos (
                                            channel_id, video_id, title, description, published_at, 
                                            view_count, like_count, comment_count, duration_seconds, thumbnail_url
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                                            ch.id, v.video_id, v.title, v.description, v.published_at,
                                            v.view_count, v.like_count, v.comment_count, v.duration_seconds, v.thumbnail_url
                                        ]);
                                    } catch (e) { }
                                }
                            }
                        } catch (yerr) {
                            console.error(`[AI 분류] 데이터 수집 실패 (${ch.name}):`, yerr.message);
                        }
                    }

                    if (videoData.length > 0) {
                        const category = await classifyChannel(ch.name, videoData, '', currentDescription);
                        const finalCategory = (category === '야담' || category === '경제' || category === '심리학') ? category : '';

                        if (finalCategory) {
                            runSQLNoSave('UPDATE channels SET group_tag = ? WHERE id = ?', [finalCategory, ch.id]);
                            count++;
                            results.push({ id: ch.id, name: ch.name, category: finalCategory, updated: true });
                        } else {
                            results.push({ id: ch.id, name: ch.name, category: '미분류', updated: false });
                        }
                    }
                } catch (err) {
                    console.error(`[AI 분류] 오류 (${ch.name}):`, err.message);
                }
            }));

            // Sync with disk after each chunk for high performance + safety
            saveDB();
        }

        const changedCount = results.filter(r => r.updated).length;
        res.json({ success: true, count, changedCount, detail: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
