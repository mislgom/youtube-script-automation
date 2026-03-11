// API client — all backend communication
const API_BASE = '/api';

async function request(path, options = {}) {
    const { method = 'GET', body, params, signal } = options;
    let url = `${API_BASE}${path}`;
    if (params) {
        const q = new URLSearchParams(params).toString();
        url += `?${q}`;
    }
    const fetchOptions = { method, headers: { 'Content-Type': 'application/json' }, signal };
    if (body) fetchOptions.body = JSON.stringify(body);

    const res = await fetch(url, fetchOptions);

    let data = {};
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        data = await res.json();
    } else {
        const text = await res.text();
        if (!res.ok) throw new Error(`Server Error (${res.status}): ${text.slice(0, 100)}...`);
    }

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

export const api = {
    // Health
    health: () => request('/health'),

    // Channels
    getChannels: () => request('/channels'),
    previewChannel: (input) => request('/channels/preview', { method: 'POST', body: { input } }),
    addChannel: (data) => request('/channels', { method: 'POST', body: data }),
    deleteChannel: (id) => request(`/channels/${id}`, { method: 'DELETE' }),
    getChannelCategorizedVideos: (id) => request(`/channels/${id}/categorized-videos`),
    updateChannelGroup: (id, group_tag) => request(`/channels/${id}/group`, { method: 'PUT', body: { group_tag } }),
    autoCategorizeAllChannels: () => request('/channels/auto-categorize-all', { method: 'POST' }),

    // YouTube fetch
    fetchChannelVideos: (channelId, maxResults) => request(`/youtube/fetch/${channelId}`, { method: 'POST', body: { maxResults } }),
    getFetchStatus: (channelId) => request(`/youtube/status/${channelId}`),
    cancelFetch: (channelId) => request(`/youtube/cancel/${channelId}`, { method: 'POST' }),
    searchYouTube: (data) => request('/youtube/search', { method: 'POST', body: data }),

    // Videos
    getVideos: (params) => request('/videos', { params }),
    getVideo: (id) => request(`/videos/${id}`),
    updateMemo: (id, memo) => request(`/videos/${id}/memo`, { method: 'PUT', body: { memo } }),
    updateVideoCategories: (id, categoryIds) => request(`/videos/${id}/categories`, { method: 'PUT', body: { category_ids: categoryIds } }),
    deleteVideo: (id) => request(`/videos/${id}`, { method: 'DELETE' }),
    addVideoManual: (data) => request('/videos/manual', { method: 'POST', body: data }),

    // Analysis
    getDashboard: () => request('/analysis/dashboard'),
    getKeywords: (limit) => request('/analysis/keywords', { params: { limit } }),
    getCategories: (group) => request('/analysis/categories', { params: group ? { group } : {} }),
    compare: (data) => request('/analysis/compare', { method: 'POST', body: data }),
    getGaps: (params) => request('/analysis/gaps', { params }),
    getYadamGaps: () => request('/analysis/gaps/yadam'),
    getYadamDetailGrid: ({ eraId, eventId, sourceId }) => request('/analysis/gaps/yadam/detail', { params: { eraId, eventId, sourceId } }),
    getEconomyGaps: (period) => request('/analysis/gaps/economy', { params: { period } }),
    getEconomyRealtime: () => request('/analysis/gaps/economy-realtime'),
    getMultiGaps: (selectedCategoryIds) => request('/analysis/gaps/multi', { method: 'POST', body: { selectedCategoryIds } }),
    deepGapAnalysis: (data) => request('/analysis/gaps/deep', { method: 'POST', body: data }),
    getSubCategoryProgress: () => request('/analysis/sub-category-progress'),
    classifySubCategories: (body = {}) => request('/analysis/classify-sub-categories', { method: 'POST', body }),
    generateScriptPlan: (data) => request('/analysis/gaps/script-plan', { method: 'POST', body: data }),
    generateUniqueSkeleton: (keyword, requirements) => request('/analysis/unique-skeleton', { method: 'POST', body: { keyword, requirements } }),
    editScript: (content, instructions, signal) => request('/analysis/scripts/edit', { method: 'POST', body: { content, instructions }, signal }),
    getTrends: (params) => request('/analysis/trends', { params }),
    search: (q) => request('/analysis/search', { params: { q } }),

    // DNA 분석
    getDnaSpikes: (p) => request('/dna/spikes', { params: p }),
    getDnaChannels: () => request('/dna/channels'),
    analyzeDna: (data) => request('/dna/analyze', { method: 'POST', body: data }),
    analyzeThemeDna: (topic, category) => request('/dna/theme-analyze', { method: 'POST', body: { topic, category } }),
    extractGoldenKeywords: (dna) => request('/dna/golden-keywords', { method: 'POST', body: { dna } }),
    recommendDnaTitles: (dna, goldenKeywords, category, topic) => request('/dna/recommend-titles', { method: 'POST', body: { dna, goldenKeywords, category, topic } }),
    generateDnaSkeleton: (dna, selectedTitle, category) => request('/dna/skeleton', { method: 'POST', body: { dna, selectedTitle, category } }),
    getDnaCache: (key) => request(`/dna/cache/${key}`),
    buildGroupDna: (dnaResults) => request('/dna/group', { method: 'POST', body: { dnaResults } }),
    extractLocalDna: (data) => request('/dna/local-dna', { method: 'POST', body: data }),
    getUnclassifiedCount: () => request('/dna/unclassified-count'),
    batchClassify: () => request('/dna/batch-classify', { method: 'POST' }),

    // Ideas
    getIdeas: (status) => request('/ideas', { params: status ? { status } : {} }),
    addIdea: (data) => request('/ideas', { method: 'POST', body: data }),
    updateIdea: (id, data) => request(`/ideas/${id}`, { method: 'PUT', body: data }),
    updateIdeaStatus: (id, status) => request(`/ideas/${id}/status`, { method: 'PUT', body: { status } }),
    deleteIdea: (id) => request(`/ideas/${id}`, { method: 'DELETE' }),

    // Scripts
    getScripts: () => request('/scripts'),
    getScript: (id) => request(`/scripts/${id}`),
    addScript: (data) => request('/scripts', { method: 'POST', body: data }),
    updateScript: (id, data) => request(`/scripts/${id}`, { method: 'PUT', body: data }),
    deleteScript: (id) => request(`/scripts/${id}`, { method: 'DELETE' }),

    // Settings
    getSettings: () => request('/settings'),
    updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),
    updateApiKey: (key, value) => request('/settings/apikey', { method: 'PUT', body: { key, value } }),
    getSettingsCategories: () => request('/settings/categories'),
    addCategory: (data) => request('/settings/categories', { method: 'POST', body: data }),
    deleteCategory: (id) => request(`/settings/categories/${id}`, { method: 'DELETE' }),
    loadPreset: (preset) => request('/settings/categories/preset', { method: 'POST', body: { preset } }),
    backupDB: () => `${API_BASE}/settings/backup`,

    // v4: Trending search
    searchTrending: (data) => request('/youtube/search', { method: 'POST', body: data }),

    // v4: Comments
    fetchVideoComments: (videoId, max) => request(`/youtube/comments/${videoId}`, { params: max ? { max } : {} }),
    getVideoComments: (dbId) => request(`/videos/${dbId}/comments`),
    analyzeVideoComments: (videoId, title) => request(`/analysis/comments/${videoId}`, { method: 'POST', body: { title } }),

    // v4: Benchmark
    getBenchmarkReport: (dbId, force) => request(`/analysis/benchmark/${dbId}`, { method: 'POST', body: { force } }),

    // v4: Transcript
    getTranscript: (dbId) => request(`/videos/${dbId}/transcript`),

    // v4: CSV export URL
    getCSVUrl: (params) => {
        const q = new URLSearchParams(params || {}).toString();
        return `${API_BASE}/videos/export/csv${q ? '?' + q : ''}`;
    },

    // v3: Economy High-Intensity Flow
    getEconomyRealtimeV3: (params) => request('/analysis/economy/realtime-v3', { params }),
    suggestEconomyTopicsV3: (data) => request('/analysis/economy/suggest-topics-v3', { method: 'POST', body: data }),
    getThumbnailTitlesV3: (data) => request('/analysis/economy/thumbnail-titles-v3', { method: 'POST', body: data })
};
