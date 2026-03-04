// Settings page
import { showToast } from '../components/toast.js';

export async function renderSettings(container, { api }) {
  container.innerHTML = `
    <div class="page-header">
      <h2>⚙️ 설정</h2>
      <p>API 키, 카테고리, 자막 수집 등을 관리하세요</p>
    </div>
    <div class="two-col">
      <div>
        <!-- API Keys -->
        <div class="card mb-24">
          <h3 style="margin-bottom:20px; font-weight:900; font-size:1.5rem;">🔑 API 키</h3>
          <div class="input-group">
            <label style="font-size:1.1rem; font-weight:800; margin-bottom:8px; display:block;">유튜브 API 키</label>
            <div class="input-with-btn">
              <input type="password" id="yt-api-key" placeholder="유튜브 API 키 입력">
              <button class="btn btn-primary" id="save-yt-key">저장</button>
            </div>
          </div>
          <div class="input-group">
            <label style="font-size:1.1rem; font-weight:800; margin-bottom:8px; display:block;">Gemini API 키 / Vertex 토큰</label>
            <div class="input-with-btn">
              <input type="password" id="gemini-api-key" placeholder="Gemini API 키 또는 AQ.A... 토큰 입력">
              <button class="btn btn-primary" id="save-gemini-key">저장</button>
            </div>
          </div>

          <!-- Vertex Fields (Hidden by default) -->
          <div id="vertex-fields" style="display:none; margin-top:20px; padding:15px; background:rgba(var(--accent-rgb), 0.05); border:1px solid var(--accent-light); border-radius:12px;">
            <div style="font-weight:700; color:var(--accent); margin-bottom:10px;">Vertex AI (Google Cloud) 전용 설정</div>
            <div class="input-group">
              <label>Project ID</label>
              <input type="text" id="google-project-id" placeholder="Google Cloud 프로젝트 ID">
            </div>
            <div class="input-group">
              <label>Location (Region)</label>
              <input type="text" id="google-location" placeholder="us-central1">
            </div>
            <button class="btn btn-secondary w-100" id="save-vertex-config">클라우드 설정 저장</button>
          </div>
          <div id="api-status" style="font-size:1rem; color:var(--text-muted); font-weight:700; margin-top:10px;"></div>
        </div>

        <!-- General Settings -->
        <div class="card mb-24">
          <h3 style="margin-bottom:20px; font-weight:900; font-size:1.5rem;">⚡ 일반 설정</h3>
          <div class="flex-between" style="margin-bottom:16px; align-items:center;">
            <div>
              <div style="font-weight:800; font-size:1.15rem; margin-bottom:4px;">자막 수집</div>
              <div style="font-size:1rem; color:var(--text-muted); font-weight:600;">영상 자막을 수집하여 분석 정확도를 높입니다</div>
            </div>
            <label style="cursor:pointer; padding:10px;">
              <input type="checkbox" id="transcript-toggle" style="width:32px; height:32px; cursor:pointer;">
            </label>
          </div>
          <div class="flex-between" style="align-items:center;">
            <div>
              <div style="font-weight:800; font-size:1.15rem; margin-bottom:4px;">테마</div>
              <div style="font-size:1rem; color:var(--text-muted); font-weight:600;">다크 / 라이트 모드 전환</div>
            </div>
            <select id="theme-select" style="width:160px; font-size:1.1rem; height:50px;">
              <option value="dark">🌙 다크</option>
              <option value="light">☀️ 라이트</option>
            </select>
          </div>
        </div>

        <!-- Backup -->
        <div class="card">
          <h4 style="margin-bottom:16px;">💾 데이터베이스</h4>
          <div class="flex gap-12">
            <a class="btn btn-secondary" id="backup-btn" href="/api/settings/backup" download>📥 DB 백업 다운로드</a>
          </div>
        </div>
      </div>

      <div>
        <!-- Genre Presets -->
        <div class="card mb-24">
          <h3 style="margin-bottom:20px; font-weight:900; font-size:1.5rem;">🎭 장르 프리셋</h3>
          <p style="font-size:1.1rem; color:var(--text-secondary); margin-bottom:20px; font-weight:600;">
            프리셋을 선택하면 해당 장르에 맞는 카테고리가 추가됩니다.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;" id="preset-buttons">
            ${['야담/역사', '괴담/호러', '요리/먹방', '교육/지식', '게임'].map(p => `
              <button class="btn btn-secondary btn-sm preset-btn" data-preset="${p}">${p}</button>
            `).join('')}
          </div>
        </div>

        <!-- Categories -->
        <div class="card">
          <h3 style="margin-bottom:20px; font-weight:900; font-size:1.5rem;">🏷️ 카테고리 관리</h3>
          <div class="input-group">
            <label style="font-size:1.1rem; font-weight:800; margin-bottom:8px; display:block;">새 카테고리 추가</label>
            <div class="flex gap-8">
              <input type="text" id="new-cat-group" placeholder="그룹명" style="flex:1;">
              <input type="text" id="new-cat-name" placeholder="카테고리명" style="flex:1;">
              <button class="btn btn-primary btn-sm" id="add-cat-btn">추가</button>
            </div>
          </div>
          <div id="categories-list" style="margin-top:16px;max-height:400px;overflow-y:auto;">
            <div class="skeleton" style="height:200px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load current settings
  try {
    const settings = await api.getSettings();
    const statusEl = document.getElementById('api-status');
    const statuses = [];
    if (settings.youtube_api_key_set) statuses.push('✅ YouTube API 키 설정됨');
    else statuses.push('❌ YouTube API 키 미설정');
    if (settings.gemini_api_key_set) statuses.push('✅ Gemini API 키 설정됨');
    else statuses.push('❌ Gemini API 키 미설정');
    statusEl.innerHTML = statuses.join(' &nbsp;&nbsp; ');

    document.getElementById('transcript-toggle').checked = settings.transcript_enabled !== 'false';
    document.getElementById('theme-select').value = settings.theme || 'dark';

    // Set Vertex fields
    document.getElementById('google-project-id').value = settings.google_project_id || '';
    document.getElementById('google-location').value = settings.google_location || 'us-central1';

    // Show Vertex fields ONLY IF project ID exists or it's a vertex token
    if (settings.google_project_id || settings.is_gemini_vertex_token) {
      document.getElementById('vertex-fields').style.display = 'block';
    }
  } catch (err) {
    showToast('설정 로드 실패: ' + err.message, 'error');
  }

  // Save YouTube API key
  document.getElementById('save-yt-key').addEventListener('click', async () => {
    const val = document.getElementById('yt-api-key').value;
    if (!val) { showToast('API 키를 입력해주세요.', 'warning'); return; }
    try {
      await api.updateApiKey('youtube_api_key', val);
      showToast('YouTube API 키가 저장되었습니다.', 'success');
      renderSettings(container, { api });
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Save Gemini & Vertex Settings
  // Save Gemini API key
  document.getElementById('save-gemini-key').addEventListener('click', async () => {
    const val = document.getElementById('gemini-api-key').value;
    if (!val) { showToast('API 키를 입력해주세요.', 'warning'); return; }
    try {
      await api.updateApiKey('gemini_api_key', val);
      showToast('저장되었습니다.', 'success');
      if (val.startsWith('AQ')) {
        document.getElementById('vertex-fields').style.display = 'block';
        showToast('Vertex AI 토큰이 감지되었습니다. 아래 하단 설정을 완료해주세요.', 'info');
      }
      renderSettings(container, { api });
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Save Vertex Config
  document.getElementById('save-vertex-config').addEventListener('click', async () => {
    const projectId = document.getElementById('google-project-id').value;
    const location = document.getElementById('google-location').value;
    try {
      await api.updateSettings({
        google_project_id: projectId,
        google_location: location
      });
      showToast('클라우드 구성이 저장되었습니다.', 'success');
      renderSettings(container, { api });
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Transcript toggle
  document.getElementById('transcript-toggle').addEventListener('change', async (e) => {
    await api.updateSettings({ transcript_enabled: String(e.target.checked) });
    showToast(`자막 수집: ${e.target.checked ? 'ON' : 'OFF'}`, 'info');
  });

  // Theme toggle
  document.getElementById('theme-select').addEventListener('change', async (e) => {
    document.body.dataset.theme = e.target.value;
    await api.updateSettings({ theme: e.target.value });
  });

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const result = await api.loadPreset(btn.dataset.preset);
        showToast(result.message || '프리셋 적용 완료!', 'success');
        loadCategories(api);
      } catch (e) { showToast(e.message, 'error'); }
    });
  });

  // Add category
  document.getElementById('add-cat-btn').addEventListener('click', async () => {
    const group = document.getElementById('new-cat-group').value;
    const name = document.getElementById('new-cat-name').value;
    if (!group || !name) { showToast('그룹명과 카테고리명을 입력해주세요.', 'warning'); return; }
    try {
      await api.addCategory({ group_name: group, name });
      showToast('카테고리가 추가되었습니다.', 'success');
      document.getElementById('new-cat-group').value = '';
      document.getElementById('new-cat-name').value = '';
      loadCategories(api);
    } catch (e) { showToast(e.message, 'error'); }
  });

  loadCategories(api);
}

async function loadCategories(api) {
  const listEl = document.getElementById('categories-list');
  try {
    const groups = await api.getSettingsCategories();
    if (Object.keys(groups).length === 0) {
      listEl.innerHTML = '<div style="font-size:1.1rem;color:var(--text-muted);text-align:center;padding:40px;font-weight:600;">카테고리가 없습니다. 프리셋을 적용해보세요.</div>';
      return;
    }
    listEl.innerHTML = Object.entries(groups).map(([groupName, cats]) => `
      <div style="margin-bottom:20px; padding:16px; border:2px solid var(--border); border-radius:12px; background:rgba(255,255,255,0.02);">
        <div style="font-weight:900; font-size:1.2rem; margin-bottom:12px; color:var(--accent-light); border-bottom:1px dashed var(--border); padding-bottom:8px;">${groupName}</div>
        <div class="tag-list" style="gap:10px;">
          ${cats.map(c => `
            <span class="tag" style="cursor:pointer; padding:8px 16px; font-size:1rem; font-weight:800; border:2px solid var(--accent-light);" title="클릭하여 삭제" data-id="${c.id}">
              ${c.name} ×
            </span>
          `).join('')}
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.tag[data-id]').forEach(tag => {
      tag.addEventListener('click', async () => {
        try {
          await api.deleteCategory(tag.dataset.id);
          showToast('삭제됨', 'info');
          loadCategories(api);
        } catch (e) { showToast(e.message, 'error'); }
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div style="color:var(--danger);">로드 실패: ${err.message}</div>`;
  }
}
