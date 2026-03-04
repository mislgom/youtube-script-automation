import { initDB, queryOne } from './server/db.js';
import { GoogleGenAI } from '@google/genai';

await initDB();
const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
const ai = new GoogleGenAI({ apiKey: row.value });

const candidates = ['gemini-2.5-flash', 'gemini-2.5-flash-latest', 'gemini-2.5-flash-exp', 'gemini-2.5-flash-001', 'gemini-2.5-pro'];

for (const model of candidates) {
    try {
        process.stdout.write(`Testing "${model}"... `);
        const response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: 'say OK' }] }]
        });
        console.log(`✅ OK! text="${response.text?.trim()}"`);
    } catch (e) {
        const msg = JSON.parse(e.message || '{}')?.error?.message || e.message;
        console.log(`❌ ${msg?.substring(0, 80)}`);
    }
}
