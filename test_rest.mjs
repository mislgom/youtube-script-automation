import { queryOne, initDB } from './server/db.js';

async function testREST() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;

    if (!apiKey) {
        console.error("API Key not found in DB.");
        return;
    }

    const model = 'gemini-2.5-flash';
    // Try both v1 and v1beta
    const versions = ['v1beta', 'v1'];

    for (const v of versions) {
        console.log(`Testing REST call via ${v} for ${model}...`);
        const url = `https://generativelanguage.googleapis.com/${v}/models/${model}:generateContent?key=${apiKey.trim()}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Hello' }] }]
                })
            });
            const data = await res.json();

            if (res.ok) {
                console.log(`✅ Success via ${v}! Response type:`, typeof data);
                if (data.candidates) console.log("Text:", data.candidates[0].content.parts[0].text);
                break;
            } else {
                console.error(`❌ Failed via ${v} (Status ${res.status}):`, data.error?.message || data);
            }
        } catch (err) {
            console.error(`Error during ${v} test:`, err.message);
        }
    }
}

testREST();
