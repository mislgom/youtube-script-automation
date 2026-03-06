// 🔥 Trending Search page — find viral YouTube videos by keyword
import { showToast } from '../components/toast.js';

export async function renderSearch(container, { api }) {
  container.innerHTML = `
    <style>
      .trending-search-root {
          padding: 20px 0;
          max-width: 1100px;
          margin: 0 auto;
      }
      .search-panel {
          background: #0f1115;
          border: 1px solid #1f2229;
          border-radius: 20px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 20px 40px rgba(0, 0, 0, 0.4);
          margin-bottom: 30px;
      }
      .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 30px;
          flex-wrap: wrap;
      }
      .input-group-custom {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 300px;
      }
      .input-label-custom {
          font-size: 11px;
          color: #555;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
      }
      .main-search-box-custom {
          display: flex;
          background: #050505;
          border: 1px solid #2a2d35;
          border-radius: 12px;
          height: 52px;
          overflow: hidden;
          transition: border-color 0.3s;
      }
      .main-search-box-custom:focus-within {
          border-color: #444;
      }
      .main-search-box-custom input {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0 20px;
          color: #fff;
          font-size: 16px;
          outline: none;
      }
      .btn-search-custom {
          width: 110px;
          background: #1a1b23;
          color: #fff;
          border: none;
          border-left: 1px solid #2a2d35;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
      }
      .btn-search-custom:hover {
          background: #25262d;
      }
      .filter-group-custom {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
      }
      .filter-item-custom {
          display: flex;
          flex-direction: column;
          gap: 8px;
      }
      .filter-item-custom label {
          font-size: 11px;
          color: #555;
          font-weight: 700;
      }
      .select-custom-slate {
          height: 52px;
          min-width: 110px;
          background: #050505;
          border: 1px solid #2a2d35;
          border-radius: 12px;
          color: #fff;
          padding: 0 15px;
          font-size: 14px;
          outline: none;
          cursor: pointer;
      }
      .bottom-row-custom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
          flex-wrap: wrap;
          gap: 15px;
      }
      .options-left-custom {
          display: flex;
          align-items: center;
          gap: 25px;
          flex-wrap: wrap;
      }
      .check-container-custom {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #888;
          cursor: pointer;
      }
      .check-container-custom input {
          accent-color: #fff;
      }
      .mode-switch-custom {
          display: flex;
          background: #050505;
          padding: 4px;
          border-radius: 12px;
          border: 1px solid #1f2229;
      }
      .mode-btn-custom {
          height: 38px;
          padding: 0 20px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #555;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
      }
      .mode-btn-custom.active-tab {
          background: #fff;
          color: #000;
      }
      .stat-info-custom {
          font-size: 12px;
          color: #444;
          font-weight: 600;
          text-transform: uppercase;
      }
      #trend-toolbar {
          background: #0f1115;
          border: 1px solid #1f2229;
          border-radius: 12px;
          padding: 12px 20px;
          margin-bottom: 20px;
      }
      /* Channel Grid & Card Refinement */
      .channel-grid-slate {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
          gap: 20px;
          width: 100%;
      }
      .channel-card-slate {
          display: flex;
          flex-direction: column;
          padding: 24px;
          border-radius: 16px;
          background: #0f1115;
          border: 1px solid #1f2229;
          transition: border-color 0.2s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          overflow: visible;
      }
      .channel-card-slate:hover {
          border-color: #2a2d35;
      }
      .channel-header-slate {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          align-items: center;
      }
      .channel-thumb-slate {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid #2a2d35;
          object-fit: cover;
      }
      .channel-info-main {
          flex: 1;
      }
      .channel-name-slate {
          font-size: 1.25rem;
          font-weight: 800;
          color: #fff;
          margin-bottom: 4px;
      }
      .channel-meta-slate {
          font-size: 0.9rem;
          color: #666;
          font-weight: 600;
      }
      .channel-desc-slate {
          font-size: 0.88rem;
          color: #888;
          line-height: 1.6;
          margin-bottom: 20px;
          background: rgba(255,255,255,0.02);
          padding: 12px;
          border-radius: 10px;
          height: 80px;
          overflow-y: auto;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
      }
      .channel-actions-slate {
          display: flex;
          gap: 10px;
          align-items: center;
          padding-top: 16px;
          margin-top: 20px;
          border-top: 1px solid #1f2229;
          flex-shrink: 0;
      }
      .video-list-section-slate {
          margin-top: 16px;
          flex-shrink: 0;
      }
      .video-list-header-slate {
          font-size: 0.75rem;
          font-weight: 800;
          color: #444;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
      }
      .video-item-mini-slate {
          display: flex;
          gap: 12px;
          background: rgba(255,255,255,0.03);
          padding: 8px;
          border-radius: 8px;
          align-items: center;
          margin-bottom: 8px;
          transition: background 0.2s;
      }
      .video-item-mini-slate:hover {
          background: rgba(255,255,255,0.06);
      }
      .video-thumb-mini-slate {
          width: 80px;
          height: 45px;
          object-fit: cover;
          border-radius: 4px;
      }
      .video-info-mini-slate {
          flex: 1;
          overflow: hidden;
      }
      .video-title-mini-slate {
          font-size: 0.85rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #ccc;
          margin-bottom: 2px;
      }
      .video-stats-mini-slate {
          font-size: 0.75rem;
          color: #555;
          font-weight: 500;
      }
      .viral-badge-mini {
          color: #ff4444;
          font-weight: 800;
      }
      /* Category selection modal */
      .search-cat-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.75);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
      }
      .search-cat-modal {
          background: #0f1115;
          border: 1px solid #2a2d35;
          border-radius: 20px;
          padding: 32px;
          width: 460px;
          max-width: 90vw;
      }
      .search-cat-modal h3 {
          font-size: 1.2rem;
          font-weight: 800;
          margin: 0 0 8px;
          color: #fff;
      }
      .search-cat-modal p {
          font-size: 0.9rem;
          color: #666;
          margin: 0 0 24px;
      }
      .cat-btn-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
      }
      .cat-btn {
          background: #1a1b23;
          border: 1px solid #2a2d35;
          border-radius: 12px;
          color: #aaa;
          font-size: 1rem;
          font-weight: 700;
          padding: 16px 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
      }
      .cat-btn:hover, .cat-btn.selected {
          background: #fff;
          color: #000;
          border-color: #fff;
      }
      .cat-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
          border-top: 1px solid #1f2229;
          padding-top: 20px;
      }
      .btn-delete-channel-slate {
          background: transparent;
          border: 1px solid #3a2a2a;
          border-radius: 8px;
          color: #884444;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 6px 12px;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.5px;
      }
      .btn-delete-channel-slate:hover {
          background: rgba(200,50,50,0.2);
          border-color: #cc4444;
          color: #ff6666;
      }
      .del-search-vid-btn {
          width: 38px;
          height: 38px;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.2);
          border-radius: 8px;
          color: #ef4444;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
      }
      .del-search-vid-btn:hover {
          background: rgba(220, 38, 38, 0.2);
          border-color: #ef4444;
          transform: scale(1.05);
      }
    </style>

    <div class="trending-search-root">
      <div class="title-area" style="margin-bottom:25px;">
        <h2 style="font-size:24px; font-weight:800; display:flex; align-items:center; gap:10px; margin:0;">🔥 떡상 검색</h2>
      </div>

      <div class="search-panel">
          <div class="top-row">
              <div class="input-group-custom">
                  <span class="input-label-custom">Keyword Search</span>
                  <div class="main-search-box-custom">
                      <input type="text" id="trend-keyword" placeholder="검색어를 입력하세요">
                      <button class="btn-search-custom" id="trend-search-btn">SEARCH</button>
                  </div>
              </div>

              <div class="filter-group-custom">
                  <div class="filter-item-custom">
                      <label>PERIOD</label>
                      <select class="select-custom-slate" id="trend-period">
                          <option value="all">전체</option>
                          <option value="week">최근 1주일</option>
                          <option value="month" selected>최근 1개월</option>
                          <option value="3months">최근 3개월</option>
                      </select>
                  </div>
                  <div class="filter-item-custom">
                      <label>SUBS</label>
                      <select class="select-custom-slate" id="trend-min-subs">
                          <option value="0">전체</option>
                          <option value="1000" selected>1천 이상</option>
                          <option value="10000">1만 이상</option>
                          <option value="100000">10만 이상</option>
                      </select>
                  </div>
                  <div class="filter-item-custom">
                      <label>VIEWS</label>
                      <select class="select-custom-slate" id="trend-min-views">
                          <option value="0">전체</option>
                          <option value="5000" selected>5천 이상</option>
                          <option value="20000">2만 이상</option>
                          <option value="50000">5만 이상</option>
                      </select>
                  </div>
              </div>
          </div>

          <div class="bottom-row-custom">
              <div class="options-left-custom">
                  <label class="check-container-custom">
                      <input type="checkbox" id="trend-exclude-registered" checked>
                      이미 등록된 채널 제외
                  </label>
                  <div class="mode-switch-custom" id="trend-view-mode-tabs">
                      <button class="mode-btn-custom active-tab" data-mode="video">영상 기준</button>
                      <button class="mode-btn-custom" data-mode="channel">채널 중심 분석</button>
                  </div>
              </div>
              <div class="stat-info-custom" id="trend-count">
                  ANALYZED 0 RESULTS
              </div>
          </div>
      </div>

      <div class="flex-between mb-16" id="trend-toolbar" style="display:none;">
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" id="trend-all-channels-btn">📥 검색된 모든 채널 등록</button>
          <div style="width:1px; height:24px; background:var(--border-color); margin:0 4px;"></div>
          <select id="trend-sort" style="width:150px; background:var(--bg-input); color:var(--text-primary); border-radius:8px; border:1px solid var(--border-color); padding:0 8px;">
            <option value="viral">떡상 지표순</option>
            <option value="views">조회수순</option>
            <option value="engagement">참여율순</option>
            <option value="date">최신순</option>
          </select>
          <input type="text" id="trend-filter" placeholder="제목 필터..." style="width:180px; border-radius:8px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); padding:0 12px; height:32px;">
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" id="trend-csv-btn">📥 CSV</button>
        </div>
      </div>
      <div id="trend-results"></div>
    </div>
  `;

  let allResults = [];
  let registeredChannelIds = new Set();
  let viewMode = 'video'; // 'video' or 'channel'

  // Initial load of registered channels
  const refreshRegisteredChannels = async () => {
    try {
      const channels = await api.getChannels();
      registeredChannelIds = new Set(channels.map(c => c.channel_id));
    } catch (e) { console.error('Failed to load registered channels', e); }
  };
  refreshRegisteredChannels();

  document.getElementById('trend-search-btn').addEventListener('click', doSearch);
  document.getElementById('trend-keyword').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('trend-sort').addEventListener('change', renderResults);
  document.getElementById('trend-filter').addEventListener('input', renderResults);
  document.getElementById('trend-exclude-registered').addEventListener('change', renderResults);

  // View mode toggle
  document.getElementById('trend-view-mode-tabs').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('trend-view-mode-tabs').querySelectorAll('button').forEach(b => b.classList.remove('active-tab', 'btn-primary'));
      btn.classList.add('active-tab', 'btn-primary');
      viewMode = btn.dataset.mode;
      renderResults();
    });
  });

  document.getElementById('trend-csv-btn').addEventListener('click', () => {
    const BOM = '\uFEFF';
    const headers = ['제목', '채널', '구독자', '조회수', '좋아요', '댓글수', '떡상지표', '등급', '참여율', 'URL', '업로드일'];
    const rows = getFiltered().map(v => [
      '"' + (v.title || '').replace(/"/g, '""') + '"',
      '"' + (v.channel_name || '').replace(/"/g, '""') + '"',
      v.subscriber_count, v.view_count, v.like_count, v.comment_count,
      v.viral_score + '%', v.viral_grade, v.engagement_rate + '%',
      'https://youtube.com/watch?v=' + v.video_id, v.published_at || ''
    ]);
    const csv = BOM + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'trending_' + document.getElementById('trend-keyword').value + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    showToast('CSV 다운로드 완료!', 'success');
  });

  document.getElementById('trend-all-channels-btn').addEventListener('click', () => {
    const filtered = getFiltered();
    const channelsToRegister = filtered.filter(v => !registeredChannelIds.has(v.channel_id))
      .map(v => ({
        channel_id: v.channel_id,
        name: v.channel_name,
        description: v.channel_description,
        thumbnail_url: v.channel_thumbnail,
        subscriber_count: v.subscriber_count
      }))
      .filter((channel, index, self) =>
        index === self.findIndex(c => c.channel_id === channel.channel_id)
      );

    if (channelsToRegister.length === 0) {
      showToast('새로 등록할 채널이 없습니다.', 'info');
      return;
    }

    // Show category selection modal first
    showSearchCategoryModal(channelsToRegister.length, async (selectedCategory) => {
      const btn = document.getElementById('trend-all-channels-btn');
      btn.disabled = true;
      const keyword = document.getElementById('trend-keyword').value.trim();
      let registeredCount = 0;
      for (let i = 0; i < channelsToRegister.length; i++) {
        const channel = channelsToRegister[i];
        btn.textContent = `📥 등록 중... (${i + 1}/${channelsToRegister.length})`;
        try {
          await api.addChannel({
            ...channel,
            group_tag: selectedCategory,
            initial_video_data: allResults.filter(v => v.channel_id === channel.channel_id).map(v => ({ title: v.title, description: v.description })),
            search_context: keyword
          });
          registeredChannelIds.add(channel.channel_id);
          registeredCount++;
        } catch (e) {
          console.error(`Failed to register channel ${channel.name}:`, e);
        }
      }
      btn.textContent = '📥 검색된 모든 채널 등록';
      btn.disabled = false;
      showToast(`${registeredCount}개 채널이 [${selectedCategory || '미분류'}] 카테고리로 등록되었습니다!`, 'success');
      renderResults();
    });
  });

  async function doSearch() {
    const keyword = document.getElementById('trend-keyword').value.trim();
    if (!keyword) { showToast('검색 키워드를 입력해주세요.', 'warning'); return; }

    await refreshRegisteredChannels(); // Refresh state before search

    const btn = document.getElementById('trend-search-btn');
    btn.disabled = true; btn.textContent = '...';
    document.getElementById('trend-results').innerHTML = '<div class="flex-center" style="padding:60px; flex-direction:column; gap:16px;"><div class="spinner"></div><span style="font-weight:700; color:var(--accent);">YouTube 실시간 떡상 데이터 분석 중...</span></div>';

    try {
      const data = await api.searchTrending({
        keyword,
        period: document.getElementById('trend-period').value,
        videoType: 'any',
        minSubscribers: parseInt(document.getElementById('trend-min-subs').value) || 0,
        minViews: parseInt(document.getElementById('trend-min-views').value) || 0,
        maxResults: 60
      });
      allResults = data.results || [];
      document.getElementById('trend-toolbar').style.display = 'flex';
      renderResults();
    } catch (err) {
      document.getElementById('trend-results').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + err.message + '</p></div>';
    } finally {
      btn.disabled = false; btn.textContent = '검색';
    }
  }

  function getFiltered() {
    const filterText = (document.getElementById('trend-filter')?.value || '').toLowerCase();
    const excludeRegistered = document.getElementById('trend-exclude-registered')?.checked;

    let filtered = [...allResults];

    if (excludeRegistered) {
      filtered = filtered.filter(v => !registeredChannelIds.has(v.channel_id));
    }

    if (filterText) {
      filtered = filtered.filter(v => v.title.toLowerCase().includes(filterText) || v.channel_name.toLowerCase().includes(filterText));
    }

    const sort = document.getElementById('trend-sort')?.value || 'viral';
    if (sort === 'views') filtered.sort((a, b) => b.view_count - a.view_count);
    else if (sort === 'engagement') filtered.sort((a, b) => b.engagement_rate - a.engagement_rate);
    else if (sort === 'date') filtered.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    else filtered.sort((a, b) => b.viral_score - a.viral_score);

    return filtered;
  }

  function renderResults() {
    const filtered = getFiltered();

    if (viewMode === 'channel') {
      renderChannelResults(filtered);
      return;
    }

    document.getElementById('trend-count').textContent = filtered.length + '개 영상';
    if (filtered.length === 0) {
      document.getElementById('trend-results').innerHTML = '<div class="empty-state"><div class="icon">🔍</div><h3>결과 없음</h3><p>검색 조건을 변경하거나 등록된 채널 제외를 해제해보세요.</p></div>';
      return;
    }
    const gradeColors = { S: '#ff4444', A: '#ff8800', B: '#ffcc00', C: '#44aa44', D: '#888888' };
    const gradeBg = { S: 'rgba(255,68,68,0.15)', A: 'rgba(255,136,0,0.15)', B: 'rgba(255,204,0,0.15)', C: 'rgba(68,170,68,0.15)', D: 'rgba(136,136,136,0.1)' };

    let html = '<div class="card-grid">';
    filtered.forEach((v) => {
      const dur = Math.floor(v.duration_seconds / 60) + ':' + String(v.duration_seconds % 60).padStart(2, '0');
      const isRegistered = registeredChannelIds.has(v.channel_id);

      html += `<div class="card" style="padding:0; overflow:hidden; border:${isRegistered ? 'none' : '2px solid var(--accent-glow)'}; opacity:${isRegistered ? 0.7 : 1}; transition:all 0.3s ease;">`;
      html += '<div style="position:relative;">';
      html += '<img src="' + v.thumbnail_url + '" style="width:100%; height:200px; object-fit:cover; display:block;" onerror="this.style.display=\'none\'">';
      html += '<div style="position:absolute; top:10px; left:10px; background:' + (gradeBg[v.viral_grade] || '') + '; color:' + (gradeColors[v.viral_grade] || '') + '; padding:6px 14px; border-radius:24px; font-size:0.9rem; font-weight:900; backdrop-filter:blur(10px);">';
      html += v.viral_grade + '등급 · 떡상 ' + v.viral_score + '%</div>';
      html += '<div style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:700;">' + dur + '</div>';
      html += '</div>';
      html += '<div style="padding:16px;">';
      html += '<div style="font-weight:800; font-size:1.1rem; margin-bottom:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.4; color:var(--text-primary); cursor:pointer;" onclick="window.open(\'https://youtube.com/watch?v=' + v.video_id + '\', \'_blank\')">' + v.title + '</div>';
      html += '<div class="flex gap-10" style="margin-bottom:12px; align-items:center;">';
      if (v.channel_thumbnail) html += '<img src="' + v.channel_thumbnail + '" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border-color);">';
      html += '<div style="font-size:0.95rem; color:var(--text-secondary); font-weight:700; flex:1;">' + v.channel_name + '<div style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">구독 ' + formatNum(v.subscriber_count) + '</div></div>';
      html += '</div>';
      html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.9rem; color:var(--text-muted); margin-bottom:16px; font-weight:600;">';
      html += '<span>👀 ' + formatNum(v.view_count) + '</span><span>👍 ' + formatNum(v.like_count) + '</span>';
      html += '<span>💬 ' + formatNum(v.comment_count) + '</span><span style="color:var(--accent);">📊 참여 ' + v.engagement_rate + '%</span></div>';
      html += '<div class="flex gap-6">';

      html += `<button class="btn ${isRegistered ? 'btn-secondary' : 'btn-primary'} btn-sm reg-channel-btn" data-chid="${v.channel_id}" ${isRegistered ? 'disabled' : ''} style="flex:1; height:38px; font-weight:800;">${isRegistered ? '✅ 등록됨' : '📢 채널 등록'}</button>`;
      html += '<button class="btn btn-secondary btn-sm collect-btn" data-vid="' + v.video_id + '" style="width:38px; height:38px; padding:0; display:flex; align-items:center; justify-content:center; font-size:1.2rem;" title="이 영상만 수집">📥</button>';
      html += `<button class="del-search-vid-btn" data-vid="${v.video_id}" title="검색 결과에서 제거">🗑️</button>`;
      html += '</div></div></div>';
    });
    html += '</div>';
    document.getElementById('trend-results').innerHTML = html;
    attachResultEvents();
  }

  function renderChannelResults(filtered) {
    // Group by channel
    const channelsMap = new Map();
    filtered.forEach(v => {
      if (!channelsMap.has(v.channel_id)) {
        channelsMap.set(v.channel_id, {
          id: v.channel_id,
          name: v.channel_name,
          thumbnail: v.channel_thumbnail,
          subscribers: v.subscriber_count,
          videos: [],
          description: v.channel_description,
          maxViral: 0,
          totalViews: 0,
          viralCount: 0
        });
      }
      const ch = channelsMap.get(v.channel_id);
      ch.videos.push(v);
      ch.maxViral = Math.max(ch.maxViral, v.viral_score);
      ch.totalViews += v.view_count;
      if (['S', 'A', 'B'].includes(v.viral_grade)) ch.viralCount++;
    });

    const channels = Array.from(channelsMap.values()).sort((a, b) => b.maxViral - a.maxViral);
    document.getElementById('trend-count').textContent = channels.length + '개 유망 채널 발굴';

    if (channels.length === 0) {
      document.getElementById('trend-results').innerHTML = '<div class="empty-state"><div class="icon">🔍</div><h3>분석된 채널 없음</h3><p>검색 조건을 조정해보세요.</p></div>';
      return;
    }

    let html = '<div class="channel-grid-slate">';
    channels.forEach(ch => {
      const isRegistered = registeredChannelIds.has(ch.id);

      html += `
        <div class="channel-card-slate" style="${isRegistered ? 'opacity: 0.8;' : 'border-color: var(--accent-glow);'}">
          <div class="channel-header-slate">
            <img src="${ch.thumbnail}" class="channel-thumb-slate" onerror="this.src='https://via.placeholder.com/64'">
            <div class="channel-info-main">
              <div class="channel-name-slate">${ch.name}</div>
              <div class="channel-meta-slate">구독자 ${formatNum(ch.subscribers)} · 누적 ${formatNum(ch.totalViews)}조회</div>
            </div>
          </div>

          <div class="channel-desc-slate" title="${escAttr(ch.description || '')}">${ch.description || '채널 설명이 없습니다.'}</div>

          <div class="video-list-section-slate">
            <div class="video-list-header-slate">
              <span>최근 떡상 영상 (${ch.videos.length})</span>
              <span style="color:var(--accent);">MAX 떡상 ${ch.maxViral}%</span>
            </div>
            <div class="flex flex-column" style="max-height: 180px; overflow-y: auto; overflow-x: hidden;">
      `;

      ch.videos.forEach(v => {
        const gradeColor = (v.viral_grade === 'S' || v.viral_grade === 'A') ? '#ff4444' : '#888';
        html += `
          <div class="video-item-mini-slate" onclick="window.open('https://youtube.com/watch?v=${v.video_id}', '_blank')" style="cursor:pointer;">
            <img src="${v.thumbnail_url}" class="video-thumb-mini-slate">
            <div class="video-info-mini-slate">
              <div class="video-title-mini-slate">${v.title}</div>
              <div class="video-stats-mini-slate">
                <span class="viral-badge-mini" style="color:${gradeColor}">[${v.viral_grade}] ${v.viral_score}%</span> · 👀 ${formatNum(v.view_count)}
              </div>
            </div>
          </div>
        `;
      });

      html += `
            </div>
          </div>

          <div class="channel-actions-slate">
            <button class="btn ${isRegistered ? 'btn-secondary' : 'btn-primary'} reg-channel-btn" data-chid="${ch.id}" ${isRegistered ? 'disabled' : ''} style="flex: 1; height: 42px; font-weight: 800; min-width:0;">
              ${isRegistered ? '✅ 등록됨' : '📢 이 채널 등록하기'}
            </button>
            <a href="https://youtube.com/channel/${ch.id}" target="_blank" class="btn btn-secondary" style="height: 42px; padding: 0 14px; display: flex; align-items: center; justify-content: center; font-weight: 700; white-space:nowrap; text-decoration:none;">
              방문
            </a>
            <button class="del-search-ch-btn" data-chid="${ch.id}" data-chname="${escAttr(ch.name)}" title="검색 결과에서 제거"
              style="flex-shrink:0; width:42px; height:42px; background:rgba(180,40,40,0.2); border:1px solid #884444; border-radius:10px; color:#ff7777; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;"
              onmouseover="this.style.background='rgba(220,60,60,0.4)'"
              onmouseout="this.style.background='rgba(180,40,40,0.2)'">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    document.getElementById('trend-results').innerHTML = html;
    attachResultEvents();
  }

  function showSearchCategoryModal(count, onConfirm) {
    const CATEGORIES = ['야담', '경제', '심리학'];
    const overlay = document.createElement('div');
    overlay.className = 'search-cat-modal-overlay';
    overlay.innerHTML = `
      <div class="search-cat-modal">
        <h3>📂 카테고리 선택</h3>
        <p>${count}개 채널을 등록할 카테고리를 선택해 주세요.</p>
        <div class="cat-btn-grid">
          ${CATEGORIES.map(c => `
            <button class="cat-btn" data-cat="${c}">${c}</button>
          `).join('')}
          <button class="cat-btn" data-cat="">미분류</button>
        </div>
        <div class="input-group" style="margin-top:4px;">
          <label style="font-size:0.8rem; color:#555; font-weight:700;">직접 입력</label>
          <input type="text" id="search-cat-custom-input" placeholder="새 카테고리 이름..." style="background:#050505; border:1px solid #2a2d35; border-radius:8px; color:#fff; padding:10px 14px; width:100%; font-size:0.9rem;">
        </div>
        <div class="cat-modal-actions">
          <button class="btn btn-secondary" id="search-cat-cancel">취소</button>
          <button class="btn btn-primary" id="search-cat-confirm" disabled>이 카테고리로 등록</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let selected = null;

    const confirmBtn = overlay.querySelector('#search-cat-confirm');
    const customInput = overlay.querySelector('#search-cat-custom-input');

    overlay.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selected = btn.dataset.cat;
        customInput.value = '';
        confirmBtn.disabled = false;
      });
    });

    customInput.addEventListener('input', () => {
      if (customInput.value.trim()) {
        overlay.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
        selected = customInput.value.trim();
        confirmBtn.disabled = false;
      } else if (selected !== null && !overlay.querySelector('.cat-btn.selected')) {
        confirmBtn.disabled = true;
      }
    });

    overlay.querySelector('#search-cat-cancel').addEventListener('click', () => overlay.remove());
    confirmBtn.addEventListener('click', () => {
      const finalCat = customInput.value.trim() || selected || '';
      overlay.remove();
      onConfirm(finalCat);
    });
  }

  function attachResultEvents() {
    // Delete from search results
    // Delete from search results (Channel mode)
    document.querySelectorAll('.del-search-ch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const chid = btn.dataset.chid;
        const chname = btn.dataset.chname || '채널';
        allResults = allResults.filter(v => v.channel_id !== chid);
        renderResults();
        showToast(`"${chname}" 검색 결과에서 제거되었습니다.`, 'info');
      });
    });

    // Delete from search results (Video mode)
    document.querySelectorAll('.del-search-vid-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const vid = btn.dataset.vid;
        allResults = allResults.filter(v => v.video_id !== vid);
        renderResults();
        showToast('해당 영상이 검색 결과에서 제거되었습니다.', 'info');
      });
    });

    document.querySelectorAll('.collect-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const vid = btn.dataset.vid;
        const video = allResults.find(v => v.video_id === vid);
        if (!video) return;

        btn.disabled = true;
        btn.textContent = '⏳...';

        try {
          await api.addVideoManual({
            video_id: video.video_id,
            title: video.title,
            description: video.description,
            published_at: video.published_at,
            view_count: video.view_count,
            like_count: video.like_count,
            comment_count: video.comment_count,
            duration_seconds: video.duration_seconds,
            thumbnail_url: video.thumbnail_url,
            // Channel info to auto-register if missing
            channel_id: video.channel_id,
            channel_name: video.channel_name,
            channel_thumbnail: video.channel_thumbnail,
            subscriber_count: video.subscriber_count
          });
          btn.textContent = '✅ 수집됨';
          showToast('영상이 성공적으로 수집되었습니다!', 'success');
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '📥';
          showToast(e.message, 'error');
        }
      });
    });

    document.querySelectorAll('.reg-channel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const chid = btn.dataset.chid;
        const video = allResults.find(v => v.channel_id === chid);
        if (!video) return;

        btn.disabled = true;
        btn.textContent = '⏳..';

        try {
          await api.addChannel({
            name: video.channel_name,
            description: video.channel_description,
            thumbnail_url: video.channel_thumbnail,
            subscriber_count: video.subscriber_count,
            channel_id: video.channel_id,
            initial_video_data: [{ title: video.title, description: video.description }],
            search_context: document.getElementById('trend-keyword').value.trim()
          });
          registeredChannelIds.add(chid);
          btn.textContent = '✅ 등록됨';
          btn.classList.replace('btn-primary', 'btn-secondary');
          showToast(`${video.channel_name} 채널이 등록되었습니다!`, 'success');
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '📢 채널 등록';
          showToast(e.message, 'error');
        }
      });
    });
  }
}

function formatNum(n) {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '만';
  if (n >= 1000) return (n / 1000).toFixed(1) + '천';
  return String(n);
}

function escAttr(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
