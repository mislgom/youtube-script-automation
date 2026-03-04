import fetch from 'node-fetch';
import { initDB, queryOne } from './server/db.js';

async function listModels() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;
    if (!apiKey) return;

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("--- AVAILABLE MODELS ---");
            data.models.forEach(m => {
                console.log(`${m.name} | ${m.displayName}`);
            });
        } else {
            console.log("No models property in response:", data);
        }
    } catch (err) {
        console.error("Failed to list models:", err.message);
    }
}

listModels();
