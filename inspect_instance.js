import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: 'test' });
console.log("Instance keys:", Object.keys(genAI));
if (genAI.models) {
    console.log("models keys:", Object.getOwnPropertyNames(genAI.models));
    console.log("models.generateContent type:", typeof genAI.models.generateContent);
}

// Check for other potential methods
for (const key in genAI) {
    console.log(`Key: ${key}, Type: ${typeof genAI[key]}`);
}
