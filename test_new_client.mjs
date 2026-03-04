import { queryOne, initDB } from './server/db.js';

async function testNewSDKClient() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;

    if (!apiKey) {
        console.error("API Key not found in DB.");
        return;
    }

    try {
        const { Client } = await import('@google/genai');
        console.log("SDK [Client] Loaded. Testing gemini-2.5-flash...");

        // Use the official Client initialization for AI Studio (API Key)
        const client = new Client({ apiKey: apiKey.trim() });

        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }]
        });

        console.log("Success! Response:", response.text);
    } catch (err) {
        console.error("SDK [Client] Test Failed:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

testNewSDKClient();
