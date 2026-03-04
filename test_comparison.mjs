import { queryOne, initDB } from './server/db.js';

async function testComparison() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;

    if (!apiKey) return;

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

    for (const model of models) {
        console.log(`--- Testing model: ${model} ---`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
            });
            const data = await res.json();

            if (res.ok) {
                console.log(`✅ ${model} SUCCESS!`);
            } else {
                console.log(`❌ ${model} FAILED:`, data.error?.message || data);
            }
        } catch (err) {
            console.log(`Error during ${model} test:`, err.message);
        }
    }
}

testComparison();
