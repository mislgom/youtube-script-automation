import { GoogleGenAI } from '@google/genai';

console.log("GoogleGenAI prototype methods:", Object.getOwnPropertyNames(GoogleGenAI.prototype));
console.log("GoogleGenAI constructor length:", GoogleGenAI.length);

try {
    const dummy = new GoogleGenAI({ apiKey: 'test' });
    console.log("Successfully created with object {apiKey}");
} catch (e) {
    console.log("Failed with object {apiKey}:", e.message);
}

try {
    const dummy = new GoogleGenAI('test');
    console.log("Successfully created with string");
} catch (e) {
    console.log("Failed with string:", e.message);
}
