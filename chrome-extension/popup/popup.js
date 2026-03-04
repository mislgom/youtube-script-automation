// Popup script — shows server status and basic stats
const SERVER_URL = 'http://localhost:3001';

async function init() {
    const content = document.getElementById('content');
    try {
        const healthRes = await fetch(`${SERVER_URL}/api/health`);
        if (!healthRes.ok) throw new Error('Server error');

        const dashRes = await fetch(`${SERVER_URL}/api/analysis/dashboard`);
        const data = await dashRes.json();

        content.innerHTML = `
      <div class="status ok">✅ 서버 연결됨</div>
      <div class="stat"><span>📺 채널</span><span class="stat-val">${data.channelCount}</span></div>
      <div class="stat"><span>🎬 영상</span><span class="stat-val">${data.videoCount}</span></div>
      <div class="stat"><span>🏷️ 키워드</span><span class="stat-val">${data.keywordCount}</span></div>
      <div class="stat"><span>💡 아이디어</span><span class="stat-val">${data.ideaCount}</span></div>
      ${data.recentVideos?.length > 0 ? `
        <div class="recent">
          <div style="font-weight:600;margin-bottom:6px;">최근 수집</div>
          ${data.recentVideos.slice(0, 3).map(v => `<div class="recent-item">${v.title}</div>`).join('')}
        </div>
      ` : ''}
    `;
    } catch (e) {
        content.innerHTML = `
      <div class="status err">❌ 서버 연결 실패</div>
      <div style="margin-top:10px;font-size:12px;color:#888;text-align:center;">
        서버를 먼저 실행해주세요:<br>
        <code style="background:#1a1a2e;padding:4px 8px;border-radius:4px;margin-top:6px;display:inline-block;">npm run server</code>
      </div>
    `;
    }
}

init();
