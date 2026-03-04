import { queryOne, initDB } from './server/db.js';

async function listModels() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;

    if (!apiKey) {
        console.error("API Key not found in DB.");
        return;
    }

    try {
        console.log("Listing available models for the provided API key...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.models) {
            console.log("Found " + data.models.length + " models.");
            const names = data.models.map(m => m.name.replace('models/', ''));
            console.log("Models:", names.join(', '));

            if (names.includes('gemini-2.5-flash')) {
                console.log("✅ gemini-2.5-flash IS available!");
            } else {
                console.log("❌ gemini-2.5-flash NOT found in list.");
                // Check if 1.5-flash or 2.0-flash is there
                const similar = names.filter(n => n.includes('flash'));
                console.log("Similar flash models found:", similar.join(', '));
            }
        } else {
            console.error("Error fetching models:", data);
        }
    } catch (err) {
        console.error("Failed to list models:", err.message);
    }
}

listModels();
