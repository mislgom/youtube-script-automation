import { queryOne, initDB } from './server/db.js';

async function testSDK() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;

    if (!apiKey) {
        console.error("API Key not found in DB.");
        return;
    }

    try {
        const { GoogleGenAI } = await import('@google/genai');
        console.log("SDK Loaded. Testing gemini-2.5-flash...");

        const client = new GoogleGenAI({ apiKey: apiKey.trim() });
        const result = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'Hello, are you gemini-2.5-flash?' }] }]
        });

        console.log("Success! Response:", result.text);
    } catch (err) {
        console.error("SDK Test Failed:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

testSDK();
