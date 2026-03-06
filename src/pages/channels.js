// Channels management page
import { showToast, showModal } from '../components/toast.js';

let currentFolder = 'all';
const FIXED_CATEGORIES = ['야담', '경제', '심리학'];
const activePolls = new Map(); // Track intervals globally in this module

export async function renderChannels(container, { api, navigate }) {
  container.innerHTML = `
    <div class="page-header flex-between" style="margin-bottom:10px;">
      <div><h2>📺 채널 관리</h2><p>분석할 YouTube 채널을 장르별로 분류하고 관리하세요</p></div>
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <select id="channel-sort" class="input" style="width: auto; padding: 5px 10px; height: 44px; align-self:center;">
          <option value="desc">구독자 많은 순</option>
          <option value="asc">구독자 적은 순</option>
        </select>

        <div style="display:flex; flex-direction:column; gap:6px; align-items:stretch;">
          <button class="btn btn-secondary" id="fetch-all-btn" style="height:44px; padding:0 20px; font-size:0.95rem;">🔄 모든 채널 수집</button>
          <button class="btn btn-danger" id="stop-all-fetch-btn" style="height:34px; padding:0 12px; font-size:0.82rem; opacity:0.5; cursor:not-allowed; display:none;" disabled>
            ⏹ 수집 중지
          </button>
        </div>

        <button class="btn btn-accent" id="auto-categorize-btn" style="height:44px; padding:0 20px; font-size:0.95rem; background:linear-gradient(135deg, #6e8efb, #a777e3); border:none; align-self:flex-start;">🪄 AI 자동 분류</button>
        <button class="btn btn-primary" id="add-channel-btn" style="height:44px; padding:0 20px; font-size:0.95rem; align-self:flex-start;">+ 채널 추가</button>
      </div>
    </div>

    <!-- Folder Tabs -->
    <div id="folder-filters" class="flex gap-12 mb-24 overflow-x-auto" style="padding-bottom:10px; border-bottom:1px solid var(--border);">
      <div class="spinner"></div>
    </div>

    <div id="channel-list"><div class="skeleton" style="height:200px"></div></div>
  `;

  document.getElementById('add-channel-btn').addEventListener('click', () => showAddChannelModal(api));

  document.getElementById('stop-all-fetch-btn').addEventListener('click', async () => {
    const btn = document.getElementById('stop-all-fetch-btn');
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.innerHTML = '<span class="loading-spinner-sm"></span> 중단 중...';

    const channels = await api.getChannels();

    // Hard stop for all active loops in this window
    for (const [chId, interval] of activePolls.entries()) {
      clearInterval(interval);
      activePolls.delete(chId);

      const progressArea = document.getElementById(`progress-${chId}`);
      const fetchBtn = document.querySelector(`.fetch-btn[data-id="${chId}"]`);
      if (progressArea) {
        progressArea.querySelector('.progress-text').textContent = '⏹ 중단됨';
        progressArea.querySelector('.fill').style.background = '#888';
      }
      if (fetchBtn) {
        fetchBtn.disabled = false;
        fetchBtn.textContent = '🔄 영상 수집';
      }
    }

    // Call server to cancel long-running fetch processes
    for (const ch of channels) {
      try { await api.cancelFetch(ch.id); } catch (e) { }
    }

    showToast('모든 수집이 즉시 중단되었습니다.', 'info');

    const fetchAllBtn = document.getElementById('fetch-all-btn');
    if (fetchAllBtn) {
      fetchAllBtn.disabled = false;
      fetchAllBtn.textContent = '🔄 모든 채널 수집';
    }

    btn.textContent = '⏹ 수집 중지';
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.style.display = 'none';
  });

  document.getElementById('fetch-all-btn').addEventListener('click', async () => {
    const channels = await api.getChannels();
    if (channels.length === 0) {
      showToast('수집할 채널이 없습니다.', 'warning');
      return;
    }

    const fetchAllBtn = document.getElementById('fetch-all-btn');
    const stopBtn = document.getElementById('stop-all-fetch-btn');

    fetchAllBtn.disabled = true;
    fetchAllBtn.textContent = '⏳ 일괄 수집 중...';

    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.style.opacity = '1';
      stopBtn.style.cursor = 'pointer';
      stopBtn.style.display = 'flex';
    }

    // Trigger fetch for all channels
    for (const ch of channels) {
      if (ch.is_active === 0) {
        console.log(`[수집 건너뛰기] ${ch.name} (수집 중지 상태)`);
        continue;
      }
      startFetch(api, ch.id, activePolls);
    }

    showToast(`${channels.length}개 채널의 수집을 시작했습니다.`, 'info');
  });
  document.getElementById('auto-categorize-btn').addEventListener('click', async () => {
    const btn = document.getElementById('auto-categorize-btn');
    btn.disabled = true;
    btn.textContent = '⏳ AI 분석 중...';
    showToast('모든 채널의 콘텐츠를 AI가 분석하여 분류 중입니다. 잠시만 기다려주세요...', 'info');

    try {
      const res = await api.autoCategorizeAllChannels();
      showToast(`분류 완료! ${res.count}개의 채널이 자동으로 배치되었습니다.`, 'success');
      loadChannels(api, navigate);
    } catch (err) {
      showToast('AI 분류 중 오류 발생: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🪄 AI 자동 분류';
    }
  });

  const sortEl = document.getElementById('channel-sort');
  sortEl.addEventListener('change', () => loadChannels(api, navigate));

  await loadChannels(api, navigate);
}

async function loadChannels(api, navigate) {
  const listEl = document.getElementById('channel-list');
  const folderEl = document.getElementById('folder-filters');
  const sortOrder = document.getElementById('channel-sort')?.value || 'desc';

  try {
    let channels = await api.getChannels();
    if (channels.length === 0) {
      folderEl.innerHTML = '';
      listEl.innerHTML = `<div class="empty-state"><div class="icon">📺</div><h3>등록된 채널이 없습니다</h3><p>위의 "+ 채널 추가" 버튼으로 분석할 채널을 등록하세요.</p></div> `;
      return;
    }

    // Simplified Fixed Category Filters
    const countAll = channels.length;
    const countByTag = {};
    FIXED_CATEGORIES.forEach(cat => {
      countByTag[cat] = channels.filter(ch => ch.group_tag === cat).length;
    });
    const countUnclassified = channels.filter(ch => !ch.group_tag).length;

    folderEl.innerHTML = `
    <div class="tab ${currentFolder === 'all' ? 'active' : ''}" data-tag="all" style="cursor:pointer; padding:6px 18px; border-radius:20px; font-weight:800; font-size:1.1rem;" > 전체보기 (${countAll})</div>
      ${FIXED_CATEGORIES.map(t => `
        <div class="tab ${currentFolder === t ? 'active' : ''}" data-tag="${t}" style="cursor:pointer; padding:6px 18px; border-radius:20px; font-weight:800; font-size:1.1rem;">
          ${t} (${countByTag[t] || 0})
        </div>
      `).join('')
      }
  <div class="tab ${currentFolder === 'unclassified' ? 'active' : ''}" data-tag="unclassified" style="cursor:pointer; padding:6px 18px; border-radius:20px; font-weight:800; font-size:1.1rem; border:1px dashed var(--border);">미분류 (${countUnclassified}) 📁</div>
  `;

    // Category filter clicks
    folderEl.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentFolder = tab.dataset.tag;
        loadChannels(api, navigate);
      });
    });

    // Sort by subscriber count
    channels.sort((a, b) => {
      const subA = a.subscriber_count || 0;
      const subB = b.subscriber_count || 0;
      return sortOrder === 'desc' ? subB - subA : subA - subB;
    });

    // Filter by selected folder
    let filtered = channels;
    if (currentFolder === 'unclassified') {
      filtered = channels.filter(ch => !ch.group_tag);
    } else if (currentFolder !== 'all') {
      filtered = channels.filter(ch => ch.group_tag === currentFolder);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"> 해당 카테고리에 등록된 채널이 없습니다.</div> `;
    } else {
      listEl.innerHTML = `<div class="dashboard-grid"> ${filtered.map(ch => renderChannelCard(ch)).join('')}</div> `;
    }

    // Dashboard buttons
    listEl.querySelectorAll('.dashboard-btn').forEach(btn => {
      btn.addEventListener('click', () => showChannelDashboard(api, btn.dataset.id));
    });
    // Category change buttons
    listEl.querySelectorAll('.change-group-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showCategorySelectionModal(api, btn.dataset.id, btn.dataset.tag || '', (newTag) => {
          api.updateChannelGroup(btn.dataset.id, newTag)
            .then(() => {
              showToast('폴더 이동 완료!', 'success');
              loadChannels(api, navigate);
            })
            .catch(err => showToast(err.message, 'error'));
        });
      });
    });
    listEl.querySelectorAll('.fetch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('stop-all-fetch-btn').style.display = 'block';
        startFetch(api, btn.dataset.id, activePolls);
      });
    });

    // Cancel buttons
    listEl.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          await fetch('/api/youtube/cancel/' + id, { method: 'POST' });

          // UI 즉시 반영
          const progressArea = document.getElementById('progress-' + id);
          if (progressArea) {
            const text = progressArea.querySelector('.progress-text');
            const fill = progressArea.querySelector('.fill');
            if (text) text.textContent = '⏸️ 중단 요청됨... (현재 영상 처리 완료 후 중단)';
            if (fill) fill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
            progressArea.style.display = 'block';
          }
        } catch (e) {
          console.error('수집 취소 실패:', e);
        }
      });
    });

    // Delete buttons
    listEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showModal('채널 삭제', `<p> "${btn.dataset.name}" 채널과 수집된 모든 영상이 삭제됩니다.</p> `, [{
          label: '삭제', class: 'btn-danger',
          onClick: async () => {
            await api.deleteChannel(btn.dataset.id);
            showToast('채널이 삭제되었습니다.', 'success');
            loadChannels(api, navigate);
          }
        }]);
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>로드 실패</h3><p>${err.message}</p></div> `;
  }
}

function showAddChannelModal(api) {
  showModal('채널 추가', `
    <div class="input-group">
      <label>채널 URL, ID 또는 핸들(@채널명)</label>
      <div class="input-with-btn">
        <input type="text" id="channel-input" placeholder="https://youtube.com/@채널명 또는 UCxxxx">
        <button class="btn btn-secondary" id="preview-btn">확인</button>
      </div>
    </div>
    <div id="channel-preview" style="margin-top:12px;"></div>
    <div class="input-group" style="margin-top:16px;">
      <label>그룹 태그 (선택)</label>
      <input type="text" id="channel-group" placeholder="예: 경쟁채널, 참고채널">
    </div>
  `, [{
    label: '등록', onClick: async (overlay) => {
      const preview = document.getElementById('channel-preview');
      const data = preview?.dataset?.channelData;
      if (!data) { showToast('먼저 채널을 확인해주세요.', 'warning'); return; }
      const parsed = JSON.parse(data);
      parsed.group_tag = document.getElementById('channel-group')?.value || '';
      try {
        await api.addChannel(parsed);
        showToast(`${parsed.name} 채널이 등록되었습니다!`, 'success');
        loadChannels(api);
      } catch (e) { showToast(e.message, 'error'); }
    }
  }]);

  document.getElementById('preview-btn').addEventListener('click', async () => {
    const input = document.getElementById('channel-input').value;
    const preview = document.getElementById('channel-preview');
    if (!input) return;
    preview.innerHTML = '<div class="flex-center"><div class="spinner"></div></div>';
    try {
      const info = await api.previewChannel(input);
      preview.dataset.channelData = JSON.stringify(info);
      preview.innerHTML = `
    <div class="card" style="padding:14px;" >
      <div class="flex gap-12">
        ${info.thumbnail_url ? `<img src="${info.thumbnail_url}" style="width:40px;height:40px;border-radius:50%;">` : ''}
        <div>
          <div style="font-weight:700;">${info.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">구독 ${info.subscriber_count?.toLocaleString()} · 영상 ${info.video_count}</div>
        </div>
      </div>
        </div> `;
    } catch (e) {
      preview.innerHTML = `<div style="color:var(--danger);font-size:0.85rem;">❌ ${e.message}</div> `;
    }
  });
}

async function startFetch(api, channelId, activePolls) {
  const progressArea = document.getElementById(`progress-${channelId}`);
  const stopBtn = document.getElementById('stop-all-fetch-btn');
  if (stopBtn) {
    stopBtn.disabled = false;
    stopBtn.style.opacity = '1';
    stopBtn.style.cursor = 'pointer';
    stopBtn.style.display = 'flex';
  }
  const btn = document.querySelector(`.fetch-btn[data-id="${channelId}"]`);
  if (!progressArea || !btn) return;

  btn.disabled = true;
  btn.textContent = '수집 중...';
  progressArea.style.display = 'block';
  progressArea.querySelector('.fill').style.background = 'linear-gradient(90deg, #4f46e5, #a855f7)';

  try {
    await api.fetchChannelVideos(channelId);

    // Cleanup helper
    const finish = () => {
      if (activePolls.has(channelId)) {
        clearInterval(activePolls.get(channelId));
        activePolls.delete(channelId);
      }

      // If no more active polls, reset global button
      if (activePolls.size === 0) {
        const fetchAllBtn = document.getElementById('fetch-all-btn');
        const stopBtn = document.getElementById('stop-all-fetch-btn');
        if (fetchAllBtn) {
          fetchAllBtn.disabled = false;
          fetchAllBtn.textContent = '🔄 모든 채널 수집';
        }
        if (stopBtn) stopBtn.style.display = 'none';
      }
    };

    // Poll status
    const poll = setInterval(async () => {
      try {
        const status = await api.getFetchStatus(channelId);

        if (!status || !status.status) return;

        // progress-area 요소 매번 다시 찾기 (DOM 갱신 대비)
        const progressArea = document.getElementById('progress-' + channelId);
        if (!progressArea) return;

        const fill = progressArea.querySelector('.fill');
        const text = progressArea.querySelector('.progress-text');
        if (!fill || !text) return;

        progressArea.style.display = 'block';

        if (status.status === 'complete') {
          fill.style.width = '100%';
          text.textContent = '✅ 수집 완료 (' + (status.completedCount || status.total) + '개)';
          btn.disabled = false;
          btn.textContent = '🔄 영상 수집';
          showToast(`${status.completedCount || status.total}개 영상 수집 완료!`, 'success');
          finish();
          loadChannels(api, navigate);
          return;
        }

        if (status.status === 'error') {
          fill.style.width = '100%';
          fill.style.background = '#ef4444';
          text.textContent = '❌ 오류 발생';
          btn.disabled = false;
          btn.textContent = '🔄 영상 수집';
          showToast('수집 중 오류 발생', 'error');
          finish();
          return;
        }

        if (status.status === 'cancelled') {
          fill.style.width = '100%';
          fill.style.background = '#f59e0b';
          text.textContent = '⏹ 중단됨 (' + (status.completedCount || status.progress) + '개 수집 완료)';
          btn.disabled = false;
          btn.textContent = '🔄 영상 수집';
          finish();
          loadChannels(api, navigate);
          return;
        }

        if (status.status === 'idle') {
          fill.style.width = '100%';
          text.textContent = '✅ 수집 완료';
          btn.disabled = false;
          btn.textContent = '🔄 영상 수집';
          finish();
          loadChannels(api, navigate);
          return;
        }

        // 진행 중 (processing, fetching_list 등)
        if (status.total > 0) {
          const pct = Math.round((status.progress / status.total) * 100);
          fill.style.width = pct + '%';
          text.textContent = status.progress + '/' + status.total + '개 처리 중 (' + pct + '%)';

          // 수집된 영상 카운터 실시간 업데이트
          const cardEl = document.querySelector('.channel-card[data-id="' + channelId + '"]');
          if (cardEl) {
            const countEl = cardEl.querySelector('.collected-count');
            if (countEl) {
              fetch('/api/channels/' + channelId).then(r => r.json()).then(ch => {
                if (ch && ch.collected_count !== undefined) {
                  countEl.textContent = ch.collected_count + '개';
                }
              }).catch(() => {});
            }
          }
        } else {
          text.textContent = '영상 목록 가져오는 중...';
        }
      } catch (e) {
        console.error('폴링 오류:', e);
      }
    }, 2000);

    activePolls.set(channelId, poll);

  } catch (e) {
    showToast('수집 시작 실패: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '🔄 영상 수집';
  }
}

function renderChannelCard(ch, allTags = []) {
  const lastFetchedStr = ch.last_fetched ? new Date(ch.last_fetched).toLocaleDateString('ko', { year: 'numeric', month: 'long', day: 'numeric' }) : '아직 수집 안 됨';
  const subCountStr = (ch.subscriber_count || 0).toLocaleString();
  const handle = ch.handle ? ch.handle.replace('@', '') : '';
  const ytUrl = handle
    ? `https://www.youtube.com/@${handle}`
    : `https://www.youtube.com/channel/${ch.channel_id}`;

  return `
    <div class="channel-card" data-id="${ch.id}">
        <div class="profile-section">
            <a href="${ytUrl}" target="_blank" rel="noopener noreferrer" title="유튜브 채널로 이동" style="display:contents;">
            ${ch.thumbnail_url
      ? `<img src="${ch.thumbnail_url}" alt="${ch.name}" class="profile-img" style="cursor:pointer;">`
      : `<div class="profile-img" style="cursor:pointer;"></div>`
    }
            </a>
            <div class="profile-info">
                <a href="${ytUrl}" target="_blank" rel="noopener noreferrer" title="유튜브 채널로 이동" style="text-decoration:none; color:inherit;">
                  <h3 style="cursor:pointer;" title="${ch.name}">${ch.name} <span style="font-size:0.75rem; opacity:0.5;">↗</span></h3>
                </a>
                <p>구독 ${subCountStr}명</p>
            </div>
        </div>
        <div class="data-container">
            <div class="data-box category change-group-btn"
                 data-id="${ch.id}" data-tag="${ch.group_tag || ''}">
                <span class="label">현재 카테고리</span>
                <span class="value green">${ch.group_tag || '미분류 ⚠️'} 🖋️</span>
            </div>
            <div class="data-box videos">
                <span class="label">수집된 영상</span>
                <span class="value purple collected-count">${ch.collected_count || 0}개</span>
            </div>
        </div>
        <span class="last-sync">마지막 수집: ${lastFetchedStr}</span>
        <div class="button-group" style="display:flex; gap:6px; align-items:stretch; flex-wrap:nowrap; padding:8px 12px; justify-content:center;">
            <button class="btn btn-collect fetch-btn" data-id="${ch.id}" style="white-space:nowrap; padding:8px 10px; font-size:13px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">🔄 영상 수집</button>
            <button class="btn btn-warning cancel-btn" data-id="${ch.id}" style="background:#f59e0b; color:#000; white-space:nowrap; padding:8px 10px; font-size:13px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">⏸️ 중지</button>
            <button class="btn btn-stat dashboard-btn" data-id="${ch.id}" style="white-space:nowrap; padding:8px 10px; font-size:13px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">📊</button>
            <button class="btn btn-delete delete-btn" data-id="${ch.id}" data-name="${ch.name}" style="white-space:nowrap; padding:8px 10px; font-size:13px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;">삭제</button>
        </div>
        <div class="progress-area" id="progress-${ch.id}" style="margin-top:20px;display:none; padding-top:15px; border-top:1px solid #25262d;">
            <div class="progress-bar" style="height:6px; background:#1a1b23; border-radius:3px; overflow:hidden;">
                <div class="fill" style="width:0%; height:100%; background:linear-gradient(90deg, #4f46e5, #a855f7); transition:width 0.3s ease;"></div>
            </div>
            <div style="font-size:12px;color:#7a7b85;margin-top:8px;font-weight:600;" class="progress-text"></div>
        </div>
    </div>
  `;
}

/**
 * v4: Show categorized dashboard for a specific channel
 */
async function showChannelDashboard(api, id) {
  showModal('채널 분석 대시보드', `
    <div id="dashboard-content" class="flex-center" style="min-height:300px; display:flex; flex-direction:column; gap:16px;">
      <div class="spinner"></div>
      <p style="color:var(--text-secondary);">채널 포트폴리오를 분석 중입니다...</p>
    </div>
  `, [], 'large');

  try {
    const data = await api.getChannelCategorizedVideos(id);
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    container.classList.remove('flex-center');
    container.style.display = 'block';

    if (data.total_videos === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🎬</div><p>수집된 영상이 없습니다. 먼저 상단의 "🔄 영상 수집" 버튼을 눌러주세요.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom:24px; padding:24px; background:var(--bg-card); border-radius:16px; border:2px solid var(--border); display:flex; align-items:center; gap:20px;">
        <div style="font-size:2.5rem;">📊</div>
        <div>
          <div style="font-weight:900; font-size:1.5rem;">채널 콘텐츠 포트폴리오</div>
          <div style="font-size:1.1rem; color:var(--text-secondary); font-weight:600;">총 ${data.total_videos}개의 영상이 테마별로 분류되었습니다.</div>
        </div>
      </div>
      
      <div class="dashboard-groups" style="display:grid; grid-template-columns:1fr; gap:20px;">
        ${data.structure.map(group => `
          <div class="group-section" style="border:2px solid var(--border); border-radius:20px; padding:24px; background:rgba(255,255,255,0.02);">
            <h4 style="margin-top:0; margin-bottom:20px; color:var(--accent-light); display:flex; align-items:center; gap:10px; font-size:1.4rem; font-weight:900;">
              📂 ${group.group} 
              <span style="font-size:1rem; font-weight:600; color:var(--text-muted);">(미분류 ${group.uncategorized}개)</span>
            </h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
              ${group.categories.map(cat => `
                <div class="category-folder-item" 
                     style="background:var(--bg-secondary); border:2px solid var(--border); border-radius:12px; padding:16px; cursor:pointer; transition:all 0.2s;"
                     onmouseover="this.style.borderColor='var(--accent)';" 
                     onmouseout="this.style.borderColor='var(--border)';"
                     onclick="const list = this.querySelector('.folder-video-list'); list.classList.toggle('hidden');">
                  <div class="flex-between" style="align-items:center;">
                    <span style="font-weight:800; font-size:1.15rem; display:flex; align-items:center; gap:8px;">
                      🏷️ ${cat.name}
                    </span>
                    <span class="tag" style="padding:4px 10px; font-size:0.9rem;">${cat.count}</span>
                  </div>
                  <div class="folder-video-list hidden" style="margin-top:16px; border-top:1px dashed var(--border); padding-top:12px; max-height:250px; overflow-y:auto;">
                    ${cat.videos.length > 0 ? cat.videos.map(v => `
                      <div class="flex gap-10" style="font-size:1rem; margin-bottom:10px; color:var(--text-primary); align-items:center; font-weight:600;">
                        <img src="${v.thumbnail_url}" style="width:48px; height:27px; border-radius:4px; object-fit:cover;">
                        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${v.title}">${v.title}</div>
                      </div>
                    `).join('') : '<div style="font-size:0.9rem; color:var(--text-muted); text-align:center;">수집된 영상이 없습니다</div>'}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    const container = document.getElementById('dashboard-content');
    if (container) container.innerHTML = `<div class="empty-state" style="color:var(--danger);">❌ 로드 실패: ${err.message}</div>`;
  }
}

/**
 * v4: Category selection modal for quick sorting
 */
function showCategorySelectionModal(api, id, currentTag, onSelect) {
  const presets = FIXED_CATEGORIES;

  showModal('이동할 카테고리(장르) 선택', `
    <div style="margin-bottom:20px; font-size:1.1rem; color:var(--text-secondary); font-weight:700;">해당 채널을 분류할 카테고리를 선택해 주세요.</div>
    <div class="flex gap-12 mb-20" style="flex-wrap:wrap;">
      ${presets.map(p => `
        <button class="btn ${currentTag === p ? 'btn-primary' : 'btn-outline'} preset-tag-btn" data-val="${p}" style="padding:12px 24px; font-size:1.1rem; font-weight:800; border-radius:12px;">${p}</button>
      `).join('')}
      <button class="btn btn-danger btn-outline preset-tag-btn" data-val="" style="padding:12px 24px; font-size:1.1rem; font-weight:800; border-radius:12px;">선택 해제 (미분류)</button>
    </div>
    <div class="input-group">
      <label style="font-weight:800;">기타 직접 입력</label>
      <div class="input-with-btn">
        <input type="text" id="custom-tag-input" value="${currentTag}" placeholder="새 카테고리 이름..." style="font-weight:700;">
        <button class="btn btn-primary" id="custom-tag-save-btn">이동</button>
      </div>
    </div>
  `, []);

  // Preset button clicks
  document.querySelectorAll('.preset-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.val);
      const overlay = document.querySelector('.modal-overlay');
      if (overlay) overlay.remove();
    });
  });

  // Custom input save
  document.getElementById('custom-tag-save-btn').addEventListener('click', () => {
    const val = document.getElementById('custom-tag-input').value.trim();
    onSelect(val);
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
  });
}
