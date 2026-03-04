import { initDB, queryOne } from './server/db.js';
import { GoogleGenAI } from '@google/genai';

async function verifyFix() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;
    if (!apiKey) {
        console.log("❌ API Key not found");
        return;
    }

    try {
        const genAI = new GoogleGenAI({ apiKey: apiKey.trim() });

        console.log("⏳ Verifying gemini-2.5-flash with NEW syntax...");
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Hello, confirm you are Gemini 2.5 Flash.'
        });

        console.log("✅ Success! Response:", result.text);

    } catch (err) {
        console.error("❌ Verification failed:", err.message);
        if (err.message.includes("429")) {
            console.log("⚠️ Quota exhausted (429). The syntax itself may be correct, but the API key is limited.");
        }
    }
}

verifyFix();
