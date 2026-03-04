import { queryOne, initDB } from './server/db.js';

async function diagnoseKey() {
    await initDB();
    const row = queryOne("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    const apiKey = row?.value?.trim();

    if (!apiKey) {
        console.log("❌ DB에 gemini_api_key가 존재하지 않습니다.");
        return;
    }

    console.log(`Key length: ${apiKey.length}`);
    console.log(`Key starts with: ${apiKey.substring(0, 4)}...`);

    if (!apiKey.startsWith("AIza")) {
        console.log("⚠️ 경고: 키가 'AIza'로 시작하지 않습니다. (AI Studio용 키가 아닐 가능성)");
    }

    // Try a simple health check to the API
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
            console.log("✅ API Key is basically valid for listing models.");
        } else {
            console.log(`❌ API Key rejected (Status ${res.status}):`, data.error?.message);
            if (data.error?.message?.includes("API keys are not supported")) {
                console.log("👉 진단: 이 키는 현재 서비스(Generative Language API)에서 API 키 인증을 지원하지 않는 유형입니다. 서비스 계정이나 OAuth2가 필요한 키일 수 있습니다.");
            }
        }
    } catch (e) {
        console.log("Error during diagnosis:", e.message);
    }
}

diagnoseKey();
