// Topic comparison page
import { showToast } from '../components/toast.js';

export async function renderCompare(container, { api }) {
  container.innerHTML = `
    <div class="page-header">
      <h2>🔍 주제 비교</h2>
      <p>새로운 아이디어가 기존 영상과 얼마나 겹치는지 확인하세요</p>
    </div>
    <div class="tabs" id="compare-tabs">
      <div class="tab active" data-mode="detailed">상세 비교</div>
      <div class="tab" data-mode="quick">빠른 비교</div>
      <div class="tab" data-mode="keywords">키워드 비교</div>
    </div>
    <div class="card" style="margin-bottom:24px;">
      <div class="input-group">
        <label>주제 제목 *</label>
        <input type="text" id="compare-title" placeholder="예: 조선시대 궁녀의 비밀 사랑">
      </div>
      <div class="input-group" id="desc-group">
        <label>줄거리 / 설명 (정확도 ↑)</label>
        <textarea id="compare-desc" style="min-height:120px;" placeholder="1,000자 이내로 상세한 줄거리나 대본의 뼈대를 입력하세요. 내용이 구체적일수록 분석이 정확해집니다."></textarea>
      </div>
      <div class="flex gap-12">
        <button class="btn btn-primary" id="compare-btn">🔍 비교 분석</button>
        <button class="btn btn-secondary" id="save-idea-btn" style="display:none;">💡 아이디어로 저장</button>
      </div>
    </div>
    <div id="compare-results"></div>
  `;

  let currentMode = 'detailed';
  let lastResult = null;

  // Tab switching
  document.getElementById('compare-tabs').addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab')) return;
    document.querySelectorAll('#compare-tabs .tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    currentMode = e.target.dataset.mode;
    const descGroup = document.getElementById('desc-group');
    const titleInput = document.getElementById('compare-title');
    if (currentMode === 'quick') {
      descGroup.style.display = 'none';
    } else if (currentMode === 'keywords') {
      descGroup.style.display = 'none';
      titleInput.placeholder = '쉼표로 구분: 조선, 궁녀, 사랑, 비극';
    } else {
      descGroup.style.display = 'block';
      titleInput.placeholder = '예: 조선시대 궁녀의 비밀 사랑';
    }
  });

  // Compare button
  document.getElementById('compare-btn').addEventListener('click', async () => {
    const title = document.getElementById('compare-title').value.trim();
    if (!title) { showToast('주제 제목을 입력해주세요.', 'warning'); return; }

    const btn = document.getElementById('compare-btn');
    btn.disabled = true;
    btn.textContent = '분석 중...';
    const resultsEl = document.getElementById('compare-results');
    resultsEl.innerHTML = `<div class="flex-center" style="padding:40px;"><div class="spinner"></div><span style="margin-left:12px;">AI 분석 중...</span></div>`;

    try {
      const data = await api.compare({
        title,
        description: document.getElementById('compare-desc')?.value || '',
        mode: currentMode
      });
      lastResult = data;
      renderResults(data, title);
      document.getElementById('save-idea-btn').style.display = 'inline-flex';
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${err.message}</p></div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 비교 분석';
    }
  });

  // Save as idea
  document.getElementById('save-idea-btn').addEventListener('click', async () => {
    const title = document.getElementById('compare-title').value;
    const description = document.getElementById('compare-desc')?.value || '';
    try {
      await api.addIdea({
        title, description,
        max_similarity: lastResult?.maxSimilarity || 0,
        similar_videos: lastResult?.results || []
      });
      showToast('아이디어로 저장되었습니다!', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Ctrl+Enter to submit
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') document.getElementById('compare-btn')?.click();
  });
}

function renderResults(data, title) {
  const el = document.getElementById('compare-results');
  const level = data.level || 'safe';
  const levelText = { safe: '✅ 참신한 주제입니다!', caution: '⚠️ 일부 유사한 영상이 있습니다', danger: '🔴 이미 많이 다뤄진 주제입니다' };
  const levelColor = { safe: 'var(--success)', caution: 'var(--warning)', danger: 'var(--danger)' };

  el.innerHTML = `
    <div class="two-col" style="gap:32px;">
      <div class="card" style="text-align:center; padding:32px;">
        <div class="gauge ${level}" style="margin:0 auto 24px;">
          <div style="position:relative; width:240px; height:240px;">
            <svg viewBox="0 0 100 100" style="width:240px; height:240px; transform:rotate(-90deg);">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" stroke-width="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="${levelColor[level]}" stroke-width="10"
                stroke-dasharray="${(data.maxSimilarity / 100) * 264} 264"
                stroke-linecap="round" style="transition:stroke-dasharray 1s;"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
              <div class="gauge-value" style="color:${levelColor[level]}; font-size:3.5rem; font-weight:900;">${data.maxSimilarity}%</div>
              <div class="gauge-label" style="font-size:1.15rem; font-weight:700;">최고 유사도</div>
            </div>
          </div>
        </div>
        <div style="font-weight:900;font-size:1.4rem;color:${levelColor[level]};margin-bottom:12px;">
          ${levelText[level]}
        </div>
        <div style="font-size:1.1rem;color:var(--text-muted);font-weight:600;">
          총 ${data.totalCompared}개 영상과 비교됨
        </div>
        ${data.commonKeywords?.length > 0 ? `
          <div style="margin-top:24px; padding-top:20px; border-top:1px dashed var(--border);">
            <div style="font-size:1.15rem;color:var(--text-secondary);margin-bottom:12px;font-weight:800;">🔍 겹치는 핵심 키워드</div>
            <div class="tag-list" style="justify-content:center;">
              ${data.commonKeywords.map(k => `<span class="tag caution" style="padding:6px 14px; font-size:1rem;">${k}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div>
        <h4 style="margin-bottom:20px;font-size:1.5rem;font-weight:900;">⚠️ 유사 영상 TOP 10</h4>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${data.results.length > 0 ? data.results.map((r, i) => {
    const scoreColor = r.similarity >= 60 ? 'var(--danger)' : r.similarity >= 30 ? 'var(--warning)' : 'var(--success)';
    return `<div class="result-card" style="flex-direction:column;align-items:stretch;gap:16px;padding:20px;border:2px solid var(--border);">
              ${r.source === 'ai' ? `<div style="font-size:0.95rem;color:var(--accent);font-weight:900;margin-bottom:-4px;">✨ AI 대본 정밀 대조 완료</div>` : ''}
              <div class="flex-between" style="align-items:center;">
                <div class="flex gap-16" style="flex:1; align-items:center;">
                  <div class="rank" style="font-size:1.25rem;">${i + 1}</div>
                  ${r.thumbnail_url ? `<img src="${r.thumbnail_url}" style="width:120px; height:68px; border-radius:8px; object-fit:cover;">` : '<div style="width:120px; height:68px; background:var(--bg-input); border-radius:8px;"></div>'}
                  <div class="info">
                    <div class="title" style="white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical; font-size:1.15rem; font-weight:800; line-height:1.4;">${r.title}</div>
                    <div class="meta" style="font-size:1rem; color:var(--text-secondary); font-weight:600; margin-top:4px;">${r.channel_name || ''} · ${(r.view_count || 0).toLocaleString()}회</div>
                  </div>
                </div>
                <div class="score" style="color:${scoreColor}; font-size:1.4rem; font-weight:900;">${r.similarity}%</div>
              </div>
              ${r.overlap_details ? `<div style="padding:16px;background:rgba(255,100,100,0.05);border-left:5px solid ${scoreColor};border-radius:12px;font-size:1.05rem;">
                <strong style="color:var(--text-primary);display:block;margin-bottom:8px;font-weight:900;font-size:1.1rem;">🔍 중복되는 주요 내용:</strong>
                <span style="color:var(--text-secondary);line-height:1.6;font-weight:600;">${r.overlap_details}</span>
              </div>` : (r.reason ? `<div style="font-size:1rem;color:var(--accent-light);font-weight:700;padding-left:8px;">💬 ${r.reason}</div>` : '')}
            </div>`;
  }).join('') : '<div class="empty-state"><p>유사한 영상이 없습니다!</p></div>'}
        </div>
      </div>
    </div>
  `;
}
