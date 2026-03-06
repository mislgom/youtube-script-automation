// Dashboard page
import { showToast } from '../components/toast.js';

export async function renderDashboard(container, { api }) {
  container.innerHTML = `
    <div class="page-header">
      <h2>📊 대시보드</h2>
      <p>채널과 영상 데이터 현황을 한눈에 확인하세요</p>
    </div>

    <div class="bg-status-panel" id="bg-status-panel" style="background:#1a1b23;border:1px solid #2d2e3a;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;color:#e2e8f0;font-size:16px;">🔄 AI 분석 진행 현황</h3>
        <div style="display:flex;gap:8px;">
          <button id="bg-start-btn" class="btn btn-primary" style="padding:4px 12px;font-size:12px;">▶ 시작</button>
          <button id="bg-stop-btn" class="btn btn-warning" style="padding:4px 12px;font-size:12px;">⏸ 중지</button>
        </div>
      </div>
      <div style="height:8px;background:#25262d;border-radius:4px;overflow:hidden;margin-bottom:12px;">
        <div class="bg-fill" style="width:0%;height:100%;background:linear-gradient(90deg,#4f46e5,#a855f7);transition:width 0.5s ease;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;color:#7a7b85;font-size:13px;">
        <span class="bg-count">0 / 0</span>
        <span class="bg-current">대기 중</span>
        <span class="bg-speed">-</span>
        <span class="bg-eta">-</span>
      </div>
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

  // Background status polling
  function updateBackgroundStatus() {
    fetch('/api/analysis/background-status')
      .then(r => r.json())
      .then(data => {
        const panel = document.getElementById('bg-status-panel');
        if (!panel) return;

        const fill = panel.querySelector('.bg-fill');
        const count = panel.querySelector('.bg-count');
        const current = panel.querySelector('.bg-current');
        const speed = panel.querySelector('.bg-speed');
        const eta = panel.querySelector('.bg-eta');

        const pct = data.total > 0 ? Math.round((data.analyzed / data.total) * 100) : 0;

        if (fill) fill.style.width = pct + '%';
        if (count) count.textContent = data.analyzed + ' / ' + data.total + ' (' + pct + '%)';
        if (current) {
          if (data.workerStatus === 'running' && data.currentVideo) {
            current.textContent = '🔄 처리 중: ' + data.currentVideo.substring(0, 25) + '...';
          } else if (data.workerStatus === 'waiting') {
            current.textContent = '⏳ 30초 후 다음 영상...';
          } else if (data.workerStatus === 'done') {
            current.textContent = '✅ 모든 영상 분석 완료';
          } else if (data.workerStatus === 'error') {
            current.textContent = '❌ 오류 발생';
          } else {
            current.textContent = '⏸ 대기 중';
          }
        }
        const startBtn = document.getElementById('bg-start-btn');
        const stopBtn = document.getElementById('bg-stop-btn');
        if (startBtn) startBtn.disabled = data.isRunning;
        if (stopBtn) stopBtn.disabled = !data.isRunning;
        if (speed) speed.textContent = data.speed > 0 ? data.speed + '개/분' : '-';
        if (eta) {
          if (data.estimatedMinutes > 60) {
            const h = Math.floor(data.estimatedMinutes / 60);
            const m = data.estimatedMinutes % 60;
            eta.textContent = '약 ' + h + '시간 ' + m + '분 남음';
          } else if (data.estimatedMinutes > 0) {
            eta.textContent = '약 ' + data.estimatedMinutes + '분 남음';
          } else {
            eta.textContent = '-';
          }
        }
      })
      .catch(() => {});
  }

  updateBackgroundStatus();
  const bgPollInterval = setInterval(updateBackgroundStatus, 5000);

  document.getElementById('bg-start-btn')?.addEventListener('click', () => {
    fetch('/api/analysis/background-start', { method: 'POST' })
      .then(() => updateBackgroundStatus())
      .catch(() => {});
  });
  document.getElementById('bg-stop-btn')?.addEventListener('click', () => {
    fetch('/api/analysis/background-stop', { method: 'POST' })
      .then(() => updateBackgroundStatus())
      .catch(() => {});
  });

  // 페이지 이탈 시 폴링 정리
  const observer = new MutationObserver(() => {
    if (!document.getElementById('bg-status-panel')) {
      clearInterval(bgPollInterval);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
