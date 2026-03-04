import { queryOne, initDB, runSQL } from './server/db.js';

async function testVertexIntegration() {
    await initDB();

    // Check if user has already set Project ID
    const projectId = queryOne("SELECT value FROM settings WHERE key = 'google_project_id'")?.value;
    const apiKey = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'")?.value;

    if (!projectId || !apiKey) {
        console.log("❌ Test aborted: Project ID or API Key (Token) is missing in DB.");
        console.log("Please set them in the UI first.");
        return;
    }

    console.log(`Testing with Project ID: ${projectId}, Key length: ${apiKey.length}`);

    try {
        const { default: geminiService } = await import('./server/services/gemini-service.js');
        const { callGemini } = await import('./server/services/gemini-service.js'); // Assuming named export exists

        console.log("Calling Gemini via Vertex AI branch...");
        const response = await geminiService.callGemini("Vertex AI 테스트 중입니다. '성공'이라고 답해주세요.");

        if (response && response.errorType) {
            console.error("❌ Vertex AI Call Error:", response.message);
        } else if (response) {
            console.log("✅ Success! Response:", response);
        } else {
            console.log("❌ Failed: No response.");
        }
    } catch (err) {
        console.error("Test execution failed:", err.message);
    }
}

testVertexIntegration();
