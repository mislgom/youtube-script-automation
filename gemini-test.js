import { GoogleGenAI } from '@google/genai';
import { queryOne } from './server/db.js';

async function test() {
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value;
    if (!apiKey) {
        console.error('No API key found in DB');
        return;
    }

    try {
        const genAI = new GoogleGenAI({ apiKey });
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        console.log('Testing gemini-1.5-flash...');
        const result = await model.generateContent('Hello, are you there? Respond with "OK" if you are.');
        console.log('Response:', result.response.text());
    } catch (err) {
        console.error('Test Failed:', err.message);
    }
}

test();
