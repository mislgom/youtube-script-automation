import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Cloud Run 자동 인증 (JSON 파일 불필요)
const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;

// 상태 확인용
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Gemini 중계 서버 작동 중' });
});

// Gemini API 호출 중계
app.post('/api/gemini', async (req, res) => {
    try {
        const { prompt, model, temperature, maxTokens } = req.body;
        const useModel = model || 'gemini-2.5-flash';
        const VERTEX_URL = `https://us-central1-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/us-central1/publishers/google/models/${useModel}:generateContent`;

        const client = await auth.getClient();
        const tokenObj = await client.getAccessToken();
        const token = typeof tokenObj === 'string' ? tokenObj : tokenObj?.token;

        const response = await fetch(VERTEX_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: temperature || 0.4,
                    maxOutputTokens: maxTokens || 8192
                }
            })
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`서버 실행: ${PORT}`));
