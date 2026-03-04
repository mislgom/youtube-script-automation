import { initDB, queryAll, runSQL } from './server/db.js';
import { classifyChannel } from './server/services/gemini-service.js';

async function debugSyuka() {
    await initDB();
    const ch = queryAll("SELECT * FROM channels WHERE name = '슈카월드'")[0];
    if (!ch) { console.log('슈카월드 채널을 찾을 수 없습니다.'); return; }

    console.log(`[분석 시작] 채널: ${ch.name}, 현재 태그: ${ch.group_tag}`);

    const videos = queryAll('SELECT title, description FROM videos WHERE channel_id = ? ORDER BY published_at DESC LIMIT 15', [ch.id]);
    const videoData = videos.map(v => ({ title: v.title, description: v.description }));

    console.log(`영상 데이터 수: ${videoData.length}`);
    if (videoData.length === 0) { console.log('영상 데이터가 없습니다. 분석 중단.'); return; }

    const category = await classifyChannel(ch.name, videoData, '', ch.description || '');
    console.log(`AI 판정 결과: "${category}"`);

    const finalCategory = (category === '야담' || category === '경제' || category === '심리학') ? category : '';
    console.log(`최종 저장될 태그: "${finalCategory}"`);

    if (finalCategory) {
        const updateRes = runSQL('UPDATE channels SET group_tag = ? WHERE id = ?', [finalCategory, ch.id]);
        console.log(`DB 업데이트 결과: ${updateRes.changes}건 반영됨`);

        const after = queryAll("SELECT group_tag FROM channels WHERE id = ?", [ch.id])[0];
        console.log(`업데이트 후 확인: "${after.group_tag}"`);
    } else {
        console.log('최종 태그가 비어 있어 업데이트를 건너뜁니다.');
    }
}

debugSyuka().then(() => process.exit(0));
