import fetch from 'node-fetch';

async function testApi() {
    const url = 'http://localhost:3001/api/analysis/gaps/deep';
    const body = {
        catX: '산업 / 기술 변화',
        catY: '경제 종합',
        groupX: '경제(메인)',
        groupY: '경제(메인)',
        isEconomy: true
    };

    console.log("🚀 Sending request to:", url);
    const start = Date.now();
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const duration = Date.now() - start;
        console.log(`⏱️ Duration: ${duration}ms`);
        console.log(`📡 Status: ${res.status}`);

        const data = await res.json();
        console.log("📦 Data:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("❌ Request Failed:", err.message);
    }
}

testApi();
