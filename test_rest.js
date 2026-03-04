import fetch from 'node-fetch';
import { initDB, queryOne } from './server/db.js';

async function testDirectApi() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;
    if (!apiKey) return;

    // Direct REST API URL for Gemini 1.5 Flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

    console.log("🚀 Testing Direct REST API Call...");
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello" }] }]
            })
        });

        console.log("📡 Status:", response.status);
        const data = await response.json();
        console.log("📦 Response Body:", JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log("✅ REST API Success! Text:", data.candidates[0].content.parts[0].text);
        }
    } catch (err) {
        console.error("❌ REST API Call Failed:", err.message);
    }
}

testDirectApi();
