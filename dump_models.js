import { initDB, queryOne } from './server/db.js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function dumpModels() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;
    if (!apiKey) return;

    try {
        const genAI = new GoogleGenAI({ apiKey: apiKey.trim() });
        const result = await genAI.models.list();

        const models = result.models || result;
        const names = models.map(m => m.name);

        fs.writeFileSync('available_models.txt', names.join('\n'));
        console.log("✅ Dumped", names.length, "models to available_models.txt");

    } catch (err) {
        console.error("❌ Failed:", err.message);
    }
}

dumpModels();
