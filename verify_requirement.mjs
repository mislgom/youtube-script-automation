
async function verify() {
    try {
        console.log("--- 1. 설정 마스킹 검증 ---");
        const settingsRes = await fetch('http://localhost:3000/api/settings').then(r => r.json());
        console.log("Gemini Key Masked:", settingsRes.gemini_api_key);
        console.log("YouTube Key Masked:", settingsRes.youtube_api_key);

        console.log("\n--- 2. 야담 분석 키 부재 모드 검증 ---");
        const analysisRes = await fetch('http://localhost:3000/api/analysis/gaps/yadam').then(r => r.json());
        console.log("Drop Reason:", analysisRes.debugCounts?.dropReason);
        console.log("External Count:", analysisRes.externalSourceCount);
        console.log("Suggestions Length:", analysisRes.suggestions?.length);

        if (analysisRes.debugCounts?.dropReason === 'MISSING_KEYS') {
            console.log("✅ Success: Missing keys correctly handled.");
        } else {
            console.log("❌ Failure: Expected MISSING_KEYS.");
        }
    } catch (e) {
        console.error("Verification failed:", e.message);
    }
}

verify();
