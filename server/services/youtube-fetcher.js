// YouTube Data API v3 wrapper
// Uses playlistItems.list (1 unit) instead of search.list (100 units) for quota optimization
// v4: Added searchVideos() and fetchComments()

import { queryOne } from '../db.js';
import { logToFile } from '../utils/logger.js';

function getApiKey() {
    const row = queryOne("SELECT value FROM settings WHERE key = 'youtube_api_key'");
    return row ? row.value : '';
}

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

async function apiFetch(endpoint, params) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('YouTube API 키가 설정되지 않고 빈 문자열입니다. 설정에서 API 키를 입력해주세요.');

    // Debug log (masked key)
    const maskedKey = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
    logToFile(`[YouTube API] Fetching: ${endpoint}, Key: ${maskedKey}`);

    params.key = apiKey;
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/${endpoint}?${query}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `YouTube API 오류 (${res.status})`;
        logToFile(`[YouTube API] ❌ 에러 발생 (${res.status}): ${msg}`);
        throw new Error(msg);
    }
    return res.json();
}

// Resolve any channel input (URL, ID, handle) to channel info
export async function resolveChannel(input) {
    input = input.trim();
    let channelId = null;
    let handle = null;

    if (input.includes('youtube.com')) {
        const url = new URL(input.startsWith('http') ? input : `https://${input}`);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts[0] === 'channel') channelId = pathParts[1];
        else if (pathParts[0]?.startsWith('@')) handle = pathParts[0];
        else if (pathParts[0] === 'c' || pathParts[0] === 'user') handle = `@${pathParts[1]}`;
    } else if (input.startsWith('UC') && input.length >= 20) {
        channelId = input;
    } else if (input.startsWith('@')) {
        handle = input;
    } else {
        handle = `@${input}`;
    }

    let data;
    if (channelId) {
        data = await apiFetch('channels', { part: 'snippet,contentDetails,statistics', id: channelId });
    } else if (handle) {
        data = await apiFetch('channels', { part: 'snippet,contentDetails,statistics', forHandle: handle.replace('@', '') });
    }

    if (!data?.items?.length) throw new Error('채널을 찾을 수 없습니다. URL 또는 ID를 확인해주세요.');

    const ch = data.items[0];
    return {
        channel_id: ch.id,
        name: ch.snippet.title,
        handle: ch.snippet.customUrl || handle || '',
        description: ch.snippet.description || '',
        thumbnail_url: ch.snippet.thumbnails?.default?.url || '',
        subscriber_count: parseInt(ch.statistics.subscriberCount) || 0,
        video_count: parseInt(ch.statistics.videoCount) || 0,
        uploads_playlist_id: ch.contentDetails?.relatedPlaylists?.uploads || null
    };
}

// Fetch all videos from a channel's uploads playlist
export async function fetchChannelVideos(channelId, maxResults = 5000, afterDate = null) {
    const chData = await apiFetch('channels', { part: 'contentDetails', id: channelId });
    if (!chData?.items?.length) throw new Error('채널 정보를 가져올 수 없습니다.');
    const uploadsPlaylistId = chData.items[0].contentDetails.relatedPlaylists.uploads;

    const videos = [];
    let nextPageToken = null;

    while (videos.length < maxResults) {
        const params = {
            part: 'snippet,contentDetails',
            playlistId: uploadsPlaylistId,
            maxResults: Math.min(50, maxResults - videos.length)
        };
        if (nextPageToken) params.pageToken = nextPageToken;

        const data = await apiFetch('playlistItems', params);
        if (!data.items?.length) break;

        const videoIds = data.items.map(item => item.snippet.resourceId.videoId).join(',');
        const statsData = await apiFetch('videos', { part: 'statistics,contentDetails', id: videoIds });
        const statsMap = {};
        if (statsData?.items) {
            for (const v of statsData.items) {
                statsMap[v.id] = {
                    view_count: parseInt(v.statistics.viewCount) || 0,
                    like_count: parseInt(v.statistics.likeCount) || 0,
                    comment_count: parseInt(v.statistics.commentCount) || 0,
                    duration_seconds: parseDuration(v.contentDetails.duration)
                };
            }
        }

        for (const item of data.items) {
            const videoId = item.snippet.resourceId.videoId;
            const publishedAt = item.snippet.publishedAt;
            if (afterDate && new Date(publishedAt) <= new Date(afterDate)) continue;
            if (item.snippet.title === 'Private video' || item.snippet.title === 'Deleted video') continue;

            const stats = statsMap[videoId] || {};
            videos.push({
                video_id: videoId,
                title: item.snippet.title,
                description: item.snippet.description || '',
                tags: (item.snippet.tags || []).join(','),
                published_at: publishedAt,
                thumbnail_url: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
                view_count: stats.view_count || 0,
                like_count: stats.like_count || 0,
                comment_count: stats.comment_count || 0,
                duration_seconds: stats.duration_seconds || 0
            });
        }

        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
    }

    return videos;
}

// ═══════════════════════════════════════════════════════════
// v4: Search YouTube for trending/viral videos by keyword
// ═══════════════════════════════════════════════════════════
export async function searchVideos(options = {}) {
    const {
        keyword,
        period = 'month',    // 'week', 'month', '3months', 'all', or ISO date
        videoType = 'any',   // 'short', 'long', 'any'
        maxResults = 50,
        minSubscribers = 0,
        minViews = 0,
        order = 'viewCount', // 'viewCount', 'date', 'relevance'
        pageToken = null
    } = options;

    // Calculate publishedAfter
    let publishedAfter = '';
    const now = new Date();
    if (period === 'week') {
        publishedAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'month') {
        publishedAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === '3months') {
        publishedAfter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period !== 'all' && period) {
        publishedAfter = new Date(period).toISOString();
    }

    // Determine video duration filter
    let videoDuration = 'any';
    if (videoType === 'short') videoDuration = 'short';    // <4min
    else if (videoType === 'long') videoDuration = 'long';  // >20min
    else if (videoType === 'medium') videoDuration = 'medium'; // 4-20min

    // Search (100 units per call)
    const searchParams = {
        part: 'snippet',
        q: keyword,
        type: 'video',
        order: order,
        maxResults: Math.min(maxResults, 50),
        videoDuration: videoDuration,
        regionCode: 'KR',
        relevanceLanguage: 'ko'
    };
    if (publishedAfter) searchParams.publishedAfter = publishedAfter;
    if (pageToken) searchParams.pageToken = pageToken;

    const searchData = await apiFetch('search', searchParams);
    if (!searchData.items?.length) return { results: [], nextPageToken: null };

    // Get detailed info for all found videos
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const detailData = await apiFetch('videos', {
        part: 'statistics,contentDetails,snippet',
        id: videoIds
    });

    if (!detailData.items?.length) return [];

    // Get channel info for subscriber counts (batch)
    const channelIds = [...new Set(detailData.items.map(v => v.snippet.channelId))].join(',');
    const channelData = await apiFetch('channels', {
        part: 'statistics,snippet',
        id: channelIds
    });
    const channelMap = {};
    if (channelData?.items) {
        for (const ch of channelData.items) {
            channelMap[ch.id] = {
                name: ch.snippet.title,
                description: ch.snippet.description || '',
                subscriber_count: parseInt(ch.statistics.subscriberCount) || 0,
                video_count: parseInt(ch.statistics.videoCount) || 0,
                thumbnail_url: ch.snippet.thumbnails?.default?.url || ''
            };
        }
    }

    // Build results with metrics
    const results = detailData.items.map(v => {
        const ch = channelMap[v.snippet.channelId] || {};
        const viewCount = parseInt(v.statistics.viewCount) || 0;
        const likeCount = parseInt(v.statistics.likeCount) || 0;
        const commentCount = parseInt(v.statistics.commentCount) || 0;
        const subCount = ch.subscriber_count || 1;
        const duration = parseDuration(v.contentDetails.duration);

        // 떡상 지표: 구독자 대비 조회수 비율
        const viralScore = Math.round((viewCount / subCount) * 100);

        return {
            video_id: v.id,
            title: v.snippet.title,
            description: v.snippet.description || '',
            channel_id: v.snippet.channelId,
            channel_name: ch.name || v.snippet.channelTitle,
            channel_description: ch.description || '',
            channel_thumbnail: ch.thumbnail_url || '',
            subscriber_count: subCount,
            published_at: v.snippet.publishedAt,
            thumbnail_url: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
            view_count: viewCount,
            like_count: likeCount,
            comment_count: commentCount,
            duration_seconds: duration,
            viral_score: viralScore,            // 떡상 지표
            engagement_rate: viewCount > 0 ? Math.round(((likeCount + commentCount) / viewCount) * 10000) / 100 : 0
        };
    });

    // Apply client-side filters
    const filtered = results.filter(v => {
        if (minSubscribers > 0 && v.subscriber_count < minSubscribers) return false;
        if (minViews > 0 && v.view_count < minViews) return false;
        return true;
    });

    // Calculate 떡상 등급
    for (const v of filtered) {
        if (v.viral_score >= 2000) v.viral_grade = 'S';
        else if (v.viral_score >= 500) v.viral_grade = 'A';
        else if (v.viral_score >= 100) v.viral_grade = 'B';
        else if (v.viral_score >= 30) v.viral_grade = 'C';
        else v.viral_grade = 'D';
    }

    // Sort by viral_score descending (default)
    filtered.sort((a, b) => b.viral_score - a.viral_score);

    return { results: filtered, nextPageToken: searchData.nextPageToken || null };
}

// ═══════════════════════════════════════════════════════════
// v4: Fetch top comments for a video
// ═══════════════════════════════════════════════════════════
export async function fetchComments(videoId, maxResults = 150) {
    const comments = [];
    let nextPageToken = null;

    while (comments.length < maxResults) {
        const params = {
            part: 'snippet',
            videoId: videoId,
            order: 'relevance',
            maxResults: Math.min(100, maxResults - comments.length),
            textFormat: 'plainText'
        };
        if (nextPageToken) params.pageToken = nextPageToken;

        try {
            const data = await apiFetch('commentThreads', params);
            if (!data.items?.length) break;

            for (const item of data.items) {
                const c = item.snippet.topLevelComment.snippet;
                comments.push({
                    comment_id: item.id,
                    author: c.authorDisplayName || '',
                    text: c.textDisplay || '',
                    like_count: parseInt(c.likeCount) || 0,
                    published_at: c.publishedAt || ''
                });
            }

            nextPageToken = data.nextPageToken;
            if (!nextPageToken) break;
        } catch (e) {
            // Comments disabled or error
            break;
        }
    }

    // Sort by likes descending
    comments.sort((a, b) => b.like_count - a.like_count);
    return comments.slice(0, maxResults);
}

// Parse ISO 8601 duration (PT1H2M3S) to seconds
function parseDuration(iso) {
    if (!iso) return 0;
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
}
