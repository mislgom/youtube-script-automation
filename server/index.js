import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import channelsRouter from './routes/channels.js';
import videosRouter from './routes/videos.js';
import youtubeRouter from './routes/youtube.js';
import analysisRouter from './routes/analysis.js';
import ideasRouter from './routes/ideas.js';
import settingsRouter from './routes/settings.js';
import scriptsRouter from './routes/scripts.js';
import { ensureYadamCategories } from './services/gap-analyzer.js';
import dnaRouter from './routes/dna.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/channels', channelsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/dna', dnaRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

async function start() {
    try {
        await initDB();
        try { ensureYadamCategories(); console.log('✅ 야담 카테고리 초기화 완료'); } catch (e) { console.error('[CategoryInit]', e.message); }
        app.listen(PORT, () => {
            console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
            console.log(`📊 API: http://localhost:${PORT}/api/health`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
