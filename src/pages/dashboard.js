// Dashboard page
import { showToast } from '../components/toast.js';

export async function renderDashboard(container, { api }) {
  container.innerHTML = `
    <div class="page-header">
      <h2>📊 대시보드</h2>
      <p>채널과 영상 데이터 현황을 한눈에 확인하세요</p>
    </div>
    <div class="stat-row" id="stats">
      ${[1, 2, 3, 4].map(() => '<div class="stat-card"><div class="skeleton" style="height:80px"></div></div>').join('')}
    </div>
    <div class="two-col">
      <div class="chart-container" id="keyword-chart-area">
        <h4>🏷️ TOP 키워드</h4>
        <div class="skeleton" style="height:300px"></div>
      </div>
      <div class="chart-container" id="recent-area">
        <h4>🕐 최근 수집된 영상</h4>
        <div class="skeleton" style="height:300px"></div>
      </div>
    </div>
  `;

  try {
    const data = await api.getDashboard();

    // Stat cards
    document.getElementById('stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">📺</div>
        <div class="stat-value">${data.channelCount}</div>
        <div class="stat-label">등록된 채널</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎬</div>
        <div class="stat-value">${data.videoCount}</div>
        <div class="stat-label">수집된 영상</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏷️</div>
        <div class="stat-value">${data.keywordCount}</div>
        <div class="stat-label">추출된 키워드</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💡</div>
        <div class="stat-value">${data.ideaCount}</div>
        <div class="stat-label">진행 중 아이디어</div>
      </div>
    `;

    // Keywords chart
    const kwArea = document.getElementById('keyword-chart-area');
    if (data.topKeywords.length > 0) {
      const maxCount = data.topKeywords[0]?.total_count || 1;
      kwArea.innerHTML = `<h4>🏷️ TOP 키워드</h4>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${data.topKeywords.slice(0, 20).map(kw => `
            <div style="display:flex;align-items:center;gap:16px;">
              <span style="width:140px;font-size:1.15rem;text-align:right;color:var(--text-secondary);font-weight:700;">${kw.word}</span>
              <div style="flex:1;height:32px;background:var(--bg-input);border-radius:10px;overflow:hidden;">
                <div style="width:${(kw.total_count / maxCount) * 100}%;height:100%;background:var(--gradient);border-radius:10px;display:flex;align-items:center;padding-left:12px;">
                  <span style="font-size:1.1rem;color:white;font-weight:800;">${kw.total_count}</span>
                </div>
              </div>
              ${kw.is_saturated ? '<span class="tag danger">포화</span>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else {
      kwArea.innerHTML = `<h4>🏷️ TOP 키워드</h4>
        <div class="empty-state"><div class="icon">🏷️</div><h3>키워드 데이터 없음</h3><p>채널을 등록하고 영상을 수집하면 키워드가 표시됩니다.</p></div>`;
    }

    // Recent videos
    const recentArea = document.getElementById('recent-area');
    if (data.recentVideos.length > 0) {
      recentArea.innerHTML = `<h4>🕐 최근 수집된 영상</h4>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${data.recentVideos.map(v => `
            <div class="result-card" style="cursor:default">
              ${v.thumbnail_url ? `<img src="${v.thumbnail_url}" class="thumb" alt="">` : '<div class="thumb"></div>'}
              <div class="info" style="padding:10px 0;">
                <div class="title" style="font-size:1.15rem;font-weight:700;margin-bottom:6px;">${v.title}</div>
                <div class="meta" style="font-size:1rem;color:var(--text-secondary);font-weight:600;">${v.channel_name || ''} · 조회수 ${(v.view_count || 0).toLocaleString()}</div>
              </div>
            </div>
          `).join('')}
        </div>`;
    } else {
      recentArea.innerHTML = `<h4>🕐 최근 수집된 영상</h4>
        <div class="empty-state"><div class="icon">🎬</div><h3>수집된 영상이 없습니다</h3><p>채널을 등록하고 영상을 수집해보세요.</p></div>`;
    }

    // Unanalyzed alert
    if (data.unanalyzed > 0) {
      showToast(`분석되지 않은 영상 ${data.unanalyzed}개가 있습니다.`, 'warning');
    }
  } catch (err) {
    showToast('대시보드 로드 실패: ' + err.message, 'error');
  }
}
