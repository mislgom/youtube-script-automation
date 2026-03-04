import { initDB, queryOne } from './server/db.js';
import { GoogleGenAI } from '@google/genai';

async function testGemini() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;
    if (!apiKey) {
        console.log("❌ API Key not found");
        return;
    }

    try {
        const genAI = new GoogleGenAI({ apiKey: apiKey.trim() });

        console.log("⏳ Testing with gemini-2.0-flash...");
        const result = await genAI.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'Hello, say HI and mention your model name.'
        });

        console.log("✅ Success! Response:", result.text);

    } catch (err) {
        console.error("❌ Test failed:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

testGemini();
