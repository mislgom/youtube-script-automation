// Videos management page — v4: card/list view, script viewer, comments, benchmark report
import { showToast, showModal } from '../components/toast.js';

export async function renderVideos(container, { api }) {
  let viewMode = 'list'; // 'list' or 'card'

  container.innerHTML = `
    <div class="page-header flex-between">
      <div><h2>🎬 영상 관리</h2><p>수집된 영상을 검색·필터링·관리하세요</p></div>
      <div class="flex gap-8">
        <a class="btn btn-secondary btn-sm" id="csv-dl-btn" href="/api/videos/export/csv" download>📥 CSV</a>
        <button class="btn btn-secondary" id="add-manual-btn">✏️ 수동 추가</button>
      </div>
    </div>
    <div class="flex gap-12 mb-24" style="align-items:center;">
      <input type="search" id="video-search" placeholder="영상 제목, 설명 검색..." style="flex:1;">
      <select id="video-type" style="width:120px;">
        <option value="all">모든 형식</option>
        <option value="longform">🎬 롱폼</option>
        <option value="shorts">🩳 쇼츠</option>
      </select>
      <select id="video-sort" style="width:140px;">
        <option value="fetched_at">수집일순</option>
        <option value="published_at">업로드일순</option>
        <option value="view_count">조회수순</option>
        <option value="title">제목순</option>
      </select>
      <div class="flex gap-4">
        <button class="btn btn-sm view-toggle" data-view="list" title="리스트뷰" style="font-size:1.1rem;">☰</button>
        <button class="btn btn-sm btn-secondary view-toggle" data-view="card" title="카드뷰" style="font-size:1.1rem;">▦</button>
      </div>
    </div>
    <div id="video-list"><div class="skeleton" style="height:400px"></div></div>
    <div id="pagination" class="flex-center gap-8 mt-24"></div>
  `;

  let currentPage = 1;
  let searchTimeout = null;
  let sortKey = 'fetched_at';
  let sortOrder = 'desc';

  const loadVideos = async () => {
    const listEl = document.getElementById('video-list');
    const search = document.getElementById('video-search')?.value || '';
    const videoType = document.getElementById('video-type')?.value || 'all';
    const sort = sortKey;
    const order = sortOrder;

    // Update dropdown if exists
    const sortSelect = document.getElementById('video-sort');
    if (sortSelect) sortSelect.value = sort;

    // Update CSV link with current filters
    const csvBtn = document.getElementById('csv-dl-btn');
    if (csvBtn) csvBtn.href = api.getCSVUrl({ search, channel_id: '', video_type: videoType });

    try {
      const data = await api.getVideos({ page: currentPage, limit: 20, search, video_type: videoType, sort, order });
      if (data.videos.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><div class="icon">🎬</div><h3>영상이 없습니다</h3><p>' + (search ? '검색 결과가 없습니다.' : '채널을 등록하고 영상을 수집해보세요.') + '</p></div>';
        document.getElementById('pagination').innerHTML = '';
        return;
      }

      if (viewMode === 'card') {
        renderCardView(listEl, data.videos);
      } else {
        renderListView(listEl, data.videos);
      }

      // Pagination
      const pagEl = document.getElementById('pagination');
      pagEl.innerHTML = '';
      if (data.totalPages > 1) {
        for (let i = 1; i <= data.totalPages; i++) {
          const btn = document.createElement('button');
          btn.className = 'btn btn-sm ' + (i === data.page ? 'btn-primary' : 'btn-secondary');
          btn.textContent = i;
          btn.addEventListener('click', () => { currentPage = i; loadVideos(); });
          pagEl.appendChild(btn);
        }
      }
    } catch (err) {
      listEl.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>' + err.message + '</p></div>';
    }
  };

  function renderListView(el, videos) {
    const getArrow = (key) => {
      if (sortKey !== key) return ' <span style="color:var(--text-muted);opacity:0.3;">↕</span>';
      return sortOrder === 'desc' ? ' <span style="color:var(--accent-light);">▼</span>' : ' <span style="color:var(--accent-light);">▲</span>';
    };

    let html = '<table class="data-table"><thead><tr>';
    html += '<th style="width:60px"></th>';
    html += `<th class="sortable" data-sort="title" style="cursor:pointer;">제목${getArrow('title')}</th>`;
    html += '<th>채널</th>';
    html += `<th class="sortable" data-sort="view_count" style="cursor:pointer;width:100px;">조회수${getArrow('view_count')}</th>`;
    html += `<th class="sortable" data-sort="published_at" style="cursor:pointer;width:120px;">업로드일${getArrow('published_at')}</th>`;
    html += '<th>분석</th>';
    html += '<th>형식</th>';
    html += '<th>액션</th>';
    html += '</tr></thead><tbody>';
    videos.forEach(v => {
      const viralScore = v.channel_subscribers > 0 ? Math.round((v.view_count / v.channel_subscribers) * 100) : 0;
      const videoUrl = v.video_id && !v.video_id.startsWith('manual_') ? `https://youtube.com/watch?v=${v.video_id}` : null;
      html += '<tr data-id="' + v.id + '">';
      html += '<td>' + (v.thumbnail_url ? (videoUrl ? '<a href="' + videoUrl + '" target="_blank" rel="noopener noreferrer"><img src="' + v.thumbnail_url + '" style="width:100px;height:56px;border-radius:6px;object-fit:cover;"></a>' : '<img src="' + v.thumbnail_url + '" style="width:100px;height:56px;border-radius:6px;object-fit:cover;">') : '') + '</td>';
      html += '<td>';
      const isShorts = (v.duration_seconds > 0 && v.duration_seconds <= 60) || v.title.toLowerCase().includes('#shorts') || v.title.includes('#쇼츠');
      const isLongform = v.duration_seconds > 60 && !v.title.toLowerCase().includes('#shorts') && !v.title.includes('#쇼츠');
      const typeBadge = isShorts ? '<span style="color:#ff4444;font-weight:bold;margin-right:8px;font-size:1rem;">[🩳 쇼츠]</span>' : (isLongform ? '<span style="color:var(--accent);font-weight:bold;margin-right:8px;font-size:1rem;">[🎬 롱폼]</span>' : '');

      if (videoUrl) {
        html += '<a href="' + videoUrl + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;"><div style="font-weight:800;font-size:1.15rem;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;">' + typeBadge + v.title + '</div></a>';
      } else {
        html += '<div style="font-weight:800;font-size:1.15rem;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + typeBadge + v.title + '</div>';
      }
      if (v.memo) html += '<div style="font-size:0.9rem;color:var(--accent-light);font-weight:600;">📝 ' + v.memo + '</div>';
      html += '</td>';
      html += '<td style="font-size:1.05rem;color:var(--text-secondary);font-weight:600;">' + (v.channel_name || '-') + '</td>';
      html += '<td style="font-size:1.1rem;font-weight:700;">' + (v.view_count || 0).toLocaleString();
      if (viralScore > 100) html += '<br><span style="font-size:0.9rem;color:#ff8800;font-weight:900;">떡상 ' + viralScore + '%</span>';
      html += '</td>';
      html += '<td style="font-size:1.05rem;color:var(--text-muted);font-weight:600;">' + (v.published_at ? new Date(v.published_at).toLocaleDateString('ko') : '-') + '</td>';
      html += '<td>' + (v.is_analyzed ? '<span class="tag safe" style="padding:6px 12px;font-size:0.95rem;">완료</span>' : '<span class="tag caution" style="padding:6px 12px;font-size:0.95rem;">미분석</span>') + '</td>';
      html += '<td style="font-size:1.05rem;font-weight:bold;">' + (isShorts ? '<span style="color:#ff4444;">🩳 쇼츠</span>' : (isLongform ? '<span style="color:var(--accent);">🎬 롱폼</span>' : '-')) + '</td>';
      html += '<td><div class="flex gap-4">';
      html += '<button class="btn btn-sm btn-secondary script-btn" data-id="' + v.id + '" data-vid="' + v.video_id + '" title="스크립트">📜</button>';
      html += '<button class="btn btn-sm btn-secondary comment-btn" data-id="' + v.id + '" data-vid="' + v.video_id + '" data-title="' + escAttr(v.title) + '" title="댓글 분석">💬</button>';
      html += '<button class="btn btn-sm btn-secondary report-btn" data-id="' + v.id + '" title="벤치마킹 리포트">📊</button>';
      if (v.video_id && !v.video_id.startsWith('manual_')) html += '<a href="https://youtube.com/watch?v=' + v.video_id + '" target="_blank" class="btn btn-sm btn-secondary" title="YouTube 열기">🔗</a>';
      html += '</div></td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    attachActions();
  }

  function renderCardView(el, videos) {
    let html = '<div class="card-grid">';
    videos.forEach(v => {
      const viralScore = v.channel_subscribers > 0 ? Math.round((v.view_count / v.channel_subscribers) * 100) : 0;
      const viralGrade = viralScore >= 2000 ? 'S' : viralScore >= 500 ? 'A' : viralScore >= 100 ? 'B' : viralScore >= 30 ? 'C' : 'D';
      const gradeColors = { S: '#ff4444', A: '#ff8800', B: '#ffcc00', C: '#44aa44', D: '#888' };
      const videoUrl = v.video_id && !v.video_id.startsWith('manual_') ? `https://youtube.com/watch?v=${v.video_id}` : null;
      html += '<div class="card" style="padding:0;overflow:hidden; border:2px solid var(--border);">';
      html += '<div style="position:relative;">';
      if (v.thumbnail_url) {
        if (videoUrl) html += '<a href="' + videoUrl + '" target="_blank" rel="noopener noreferrer"><img src="' + v.thumbnail_url + '" style="width:100%;height:220px;object-fit:cover;display:block;" onerror="this.style.display=\'none\'"></a>';
        else html += '<img src="' + v.thumbnail_url + '" style="width:100%;height:220px;object-fit:cover;display:block;" onerror="this.style.display=\'none\'">';
      }
      if (viralScore >= 30) html += '<div style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.7);color:' + gradeColors[viralGrade] + ';padding:6px 14px;border-radius:24px;font-size:1rem;font-weight:900;pointer-events:none;backdrop-filter:blur(8px);">' + viralGrade + '등급 ' + viralScore + '%</div>';
      html += '</div>';
      html += '<div style="padding:24px;">';
      const isShorts = (v.duration_seconds > 0 && v.duration_seconds <= 60) || v.title.toLowerCase().includes('#shorts') || v.title.includes('#쇼츠');
      const isLongform = v.duration_seconds > 60 && !v.title.toLowerCase().includes('#shorts') && !v.title.includes('#쇼츠');
      const typeBadge = isShorts ? '<span style="color:#ff4444;font-weight:900;margin-right:8px;font-size:1.1rem;">[🩳 쇼츠]</span>' : (isLongform ? '<span style="color:var(--accent);font-weight:900;margin-right:8px;font-size:1.1rem;">[🎬 롱폼]</span>' : '');

      if (videoUrl) {
        html += '<a href="' + videoUrl + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;"><div style="font-weight:900;font-size:1.25rem;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;cursor:pointer;color:var(--text-primary);">' + typeBadge + v.title + '</div></a>';
      } else {
        html += '<div style="font-weight:900;font-size:1.25rem;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;color:var(--text-primary);">' + typeBadge + v.title + '</div>';
      }
      html += '<div style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:12px;font-weight:600;">' + (v.channel_name || '') + '</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:1.05rem;color:var(--text-muted);margin-bottom:16px;font-weight:700;">';
      html += '<span>👀 ' + fmtNum(v.view_count) + '</span><span>👍 ' + fmtNum(v.like_count) + '</span></div>';
      html += '<div class="flex gap-6" style="flex-wrap:wrap;">';
      html += '<button class="btn btn-sm btn-secondary script-btn" data-id="' + v.id + '" data-vid="' + v.video_id + '" style="flex:1;font-size:0.95rem;padding:10px;">📜 스크립트</button>';
      html += '<button class="btn btn-sm btn-secondary comment-btn" data-id="' + v.id + '" data-vid="' + v.video_id + '" data-title="' + escAttr(v.title) + '" style="flex:1;font-size:0.95rem;padding:10px;">💬 댓글</button>';
      html += '<button class="btn btn-sm btn-primary report-btn" data-id="' + v.id + '" style="flex:1;font-size:0.95rem;padding:10px;">📊 리포트</button>';
      html += '</div></div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
    attachActions();
  }

  function attachActions() {
    // Script buttons
    document.querySelectorAll('.script-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dbId = btn.dataset.id;
        showModal('📜 스크립트 보기', '<div class="flex-center" style="padding:20px;"><div class="spinner"></div> 자막 로딩 중...</div>', []);
        try {
          const data = await api.getTranscript(dbId);
          if (data.text) {
            showModal('📜 스크립트', '<div style="max-height:500px;overflow-y:auto;white-space:pre-wrap;font-size:1.15rem;line-height:1.8;padding:24px;background:var(--bg-card);border:2px solid var(--border);border-radius:12px;font-weight:500;color:var(--text-primary);">' + data.text.replace(/</g, '&lt;') + '</div>', [
              { label: '📋 복사', onClick: async () => { await navigator.clipboard.writeText(data.text); showToast('클립보드에 복사되었습니다!', 'success'); } },
              {
                label: '✍️ 초안 작성하기', class: 'btn-warning', onClick: () => {
                  const videoTitle = btn.closest('tr')?.querySelector('div')?.textContent || btn.closest('.card')?.querySelector('div[style*="font-weight:900"]')?.textContent || '새 대본';
                  localStorage.setItem('pending_script_content', data.text);
                  localStorage.setItem('pending_script_title', videoTitle);
                  window.location.hash = '#/editor?source=video';
                }
              },
              {
                label: '📥 TXT 다운로드', onClick: () => {
                  const blob = new Blob([data.text], { type: 'text/plain;charset=utf-8' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'script_' + dbId + '.txt';
                  link.click();
                  showToast('다운로드 완료!', 'success');
                }
              }
            ]);
          } else {
            showModal('📜 스크립트', '<div style="text-align:center;padding:20px;color:var(--text-muted);">' + (data.message || '자막이 없습니다.') + '</div>', []);
          }
        } catch (e) { showModal('📜 스크립트', '<div style="color:var(--danger);">' + e.message + '</div>', []); }
      });
    });

    // Comment buttons
    document.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const videoId = btn.dataset.vid;
        const title = btn.dataset.title || '';
        if (!videoId || videoId.startsWith('manual_')) { showToast('수동 추가된 영상은 댓글을 가져올 수 없습니다.', 'warning'); return; }
        showModal('💬 댓글 분석', '<div class="flex-center" style="padding:20px;"><div class="spinner"></div> 댓글 수집 및 AI 분석 중...</div>', []);
        try {
          const data = await api.analyzeVideoComments(videoId, title);
          let html = '';
          // AI analysis section
          if (data.analysis) {
            const a = data.analysis;
            html += '<div class="card mb-20" style="border-left:6px solid var(--accent); padding:24px;">';
            html += '<h3 style="margin-bottom:16px; font-weight:900; font-size:1.5rem;">🤖 AI 감정 분석</h3>';
            if (a.sentiment) {
              html += '<div class="flex gap-16 mb-20" style="font-size:1.15rem; font-weight:700;">';
              html += '<span>😊 긍정 <strong style="color:var(--success);">' + a.sentiment.positive + '%</strong></span>';
              html += '<span>😐 중립 <strong>' + a.sentiment.neutral + '%</strong></span>';
              html += '<span>😞 부정 <strong style="color:var(--danger);">' + a.sentiment.negative + '%</strong></span>';
              html += '</div>';
            }
            if (a.top_reactions) {
              html += '<div style="margin-bottom:16px;"><strong style="font-size:1.2rem; font-weight:900; color:var(--text-primary); display:block; margin-bottom:8px;">🎯 시청자 공감 포인트</strong>';
              a.top_reactions.forEach(r => { html += '<div style="font-size:1.1rem;padding:6px 0;color:var(--text-secondary);font-weight:600;">• ' + r + '</div>'; });
              html += '</div>';
            }
            if (a.content_ideas) {
              html += '<div style="margin-bottom:16px;"><strong style="font-size:1.2rem; font-weight:900; color:var(--accent); display:block; margin-bottom:8px;">💡 새 주제 추천</strong>';
              a.content_ideas.forEach(r => { html += '<div style="font-size:1.1rem;padding:6px 0;color:var(--accent-light);font-weight:700;">→ ' + r + '</div>'; });
              html += '</div>';
            }
            if (a.summary) html += '<div style="font-size:1.05rem;color:var(--text-muted);margin-top:12px;font-style:italic;line-height:1.6;font-weight:600;background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;">📝 ' + a.summary + '</div>';
            html += '</div>';
          }
          // Comment list
          html += '<div style="max-height:300px;overflow-y:auto;">';
          if (data.comments && data.comments.length > 0) {
            data.comments.slice(0, 50).forEach(c => {
              html += '<div style="padding:16px 0;border-bottom:2px solid var(--border);font-size:1.05rem;font-weight:500;">';
              html += '<div class="flex-between" style="margin-bottom:6px;"><strong style="font-size:1.15rem;font-weight:800;">' + escH(c.author) + '</strong><span style="color:var(--accent);font-weight:900;">👍 ' + c.like_count + '</span></div>';
              html += '<div style="color:var(--text-secondary);line-height:1.6;font-weight:600;">' + escH(c.text).substring(0, 300) + '</div>';
              html += '</div>';
            });
          } else {
            html += '<div style="text-align:center;color:var(--text-muted);padding:20px;">댓글이 없습니다.</div>';
          }
          html += '</div>';
          showModal('💬 댓글 분석 (' + data.total + '개)', html, [
            {
              label: '📥 댓글 CSV', onClick: () => {
                const BOM = '\uFEFF';
                const rows = [['작성자', '댓글', '좋아요'].join(',')];
                (data.comments || []).forEach(c => {
                  rows.push('"' + escH(c.author) + '","' + escH(c.text).replace(/"/g, '""') + '",' + c.like_count);
                });
                const blob = new Blob([BOM + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'comments_' + videoId + '.csv';
                link.click();
                showToast('댓글 CSV 다운로드!', 'success');
              }
            }
          ]);
        } catch (e) { showModal('💬 댓글', '<div style="color:var(--danger);">' + e.message + '</div>', []); }
      });
    });

    // Benchmark report buttons
    document.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const dbId = btn.dataset.id;
        showModal('📊 벤치마킹 리포트', '<div class="flex-center" style="padding:30px;"><div class="spinner"></div> AI 벤치마킹 분석 중...<br><span style="font-size:0.75rem;color:var(--text-muted);">(댓글 수집 + AI 분석, 10~20초 소요)</span></div>', []);
        try {
          const { report } = await api.getBenchmarkReport(dbId);
          if (!report) { showModal('📊 리포트', '<div style="color:var(--danger);">리포트 생성 실패. Gemini API 키를 확인하세요.</div>', []); return; }
          let html = '';
          // Metrics
          if (report.metrics) {
            const m = report.metrics;
            const gc = { S: '#ff4444', A: '#ff8800', B: '#ffcc00', C: '#44aa44', D: '#888' };
            html += '<div class="flex gap-12 mb-16" style="flex-wrap:wrap;font-size:0.82rem;">';
            html += '<div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;"><div style="font-size:1.8rem;font-weight:800;color:' + (gc[m.viral_grade] || '') + ';">' + m.viral_grade + '</div><div style="font-size:0.7rem;color:var(--text-muted);">떡상 ' + m.viral_score + '%</div></div>';
            html += '<div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;"><div style="font-size:1.2rem;font-weight:700;">👀 ' + fmtNum(m.view_count) + '</div><div style="font-size:0.7rem;color:var(--text-muted);">조회수</div></div>';
            html += '<div class="card" style="flex:1;min-width:100px;text-align:center;padding:12px;"><div style="font-size:1.2rem;font-weight:700;">📊 ' + m.engagement_rate + '%</div><div style="font-size:0.7rem;color:var(--text-muted);">참여율</div></div>';
            html += '</div>';
          }
          if (report.performance_summary) html += '<div class="card mb-16" style="border-left:3px solid var(--accent);"><strong>📌 성과 요약</strong><div style="font-size:0.82rem;margin-top:6px;color:var(--text-secondary);white-space:pre-line;">' + report.performance_summary + '</div></div>';
          if (report.why_viral) {
            html += '<div class="card mb-16"><strong>🎯 왜 이 영상이 떴는가</strong><div style="margin-top:6px;">';
            report.why_viral.forEach(r => { html += '<div style="font-size:0.82rem;padding:4px 0;">✅ ' + r + '</div>'; });
            html += '</div></div>';
          }
          if (report.title_analysis) html += '<div class="card mb-16"><strong>📝 제목 분석</strong><div style="font-size:0.82rem;margin-top:4px;color:var(--text-secondary);">' + report.title_analysis + '</div></div>';
          if (report.script_structure) {
            html += '<div class="card mb-16"><strong>📜 스크립트 구조</strong><div style="margin-top:6px;">';
            report.script_structure.forEach(s => { html += '<div style="display:flex;gap:10px;font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border);"><span style="font-weight:700;min-width:50px;">' + s.section + '</span><span style="color:var(--accent-light);min-width:60px;">' + s.time + '</span><span style="color:var(--text-secondary);">' + s.description + '</span></div>'; });
            html += '</div></div>';
          }
          if (report.benchmark_tips) {
            html += '<div class="card mb-16"><strong>💡 벤치마킹 포인트</strong><div style="margin-top:6px;">';
            report.benchmark_tips.forEach(t => { html += '<div style="font-size:0.82rem;padding:3px 0;">🔸 ' + t + '</div>'; });
            html += '</div></div>';
          }
          if (report.new_topic_ideas) {
            html += '<div class="card mb-16" style="border-left:3px solid var(--success);"><strong>🚀 벤치마킹 새 주제 제안</strong><div style="margin-top:8px;">';
            report.new_topic_ideas.forEach(t => { html += '<div style="padding:6px 0;border-bottom:1px solid var(--border);"><div style="font-weight:700;font-size:0.85rem;">' + t.title + '</div><div style="font-size:0.78rem;color:var(--text-muted);">' + (t.description || '') + '</div></div>'; });
            html += '</div></div>';
          }
          // Comments analysis
          if (report.comments_analysis && report.comments_analysis.sentiment) {
            const ca = report.comments_analysis;
            html += '<div class="card mb-16"><strong>💬 댓글 감정 분석</strong><div class="flex gap-12 mt-8" style="font-size:0.82rem;">';
            html += '<span>😊 ' + ca.sentiment.positive + '%</span><span>😐 ' + ca.sentiment.neutral + '%</span><span>😞 ' + ca.sentiment.negative + '%</span></div>';
            if (ca.summary) html += '<div style="font-size:0.78rem;color:var(--text-muted);margin-top:6px;">' + ca.summary + '</div></div>';
            else html += '</div>';
          }
          if (report.risk_factors) {
            html += '<div class="card"><strong>⚠️ 주의사항</strong><div style="margin-top:6px;">';
            report.risk_factors.forEach(r => { html += '<div style="font-size:0.82rem;padding:3px 0;color:var(--warning);">⚠️ ' + r + '</div>'; });
            html += '</div></div>';
          }
          showModal('📊 AI 벤치마킹 리포트', '<div style="max-height:500px;overflow-y:auto;">' + html + '</div>', []);
        } catch (e) { showModal('📊 리포트', '<div style="color:var(--danger);">' + e.message + '</div>', []); }
      });
    });

    // Header sort events
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const newKey = th.dataset.sort;
        if (sortKey === newKey) {
          sortOrder = (sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
          sortKey = newKey;
          sortOrder = 'desc';
        }
        currentPage = 1;
        loadVideos();
      });
    });
  }

  // View toggle buttons
  document.querySelectorAll('.view-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      loadVideos();
    });
  });

  document.getElementById('video-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      loadVideos();
    }
  });
  document.getElementById('video-sort').addEventListener('change', (e) => {
    sortKey = e.target.value;
    sortOrder = 'desc';
    currentPage = 1;
    loadVideos();
  });
  document.getElementById('video-type').addEventListener('change', () => {
    currentPage = 1;
    window.scrollTo(0, 0);
    loadVideos();
  });

  document.getElementById('add-manual-btn').addEventListener('click', () => {
    showModal('✏️ 영상 수동 추가', '<div class="input-group"><label>제목 *</label><input type="text" id="m-title"></div><div class="input-group"><label>설명</label><textarea id="m-desc"></textarea></div><div class="input-group"><label>영상 URL (선택)</label><input type="text" id="m-url" placeholder="https://youtube.com/watch?v=..."></div>', [
      {
        label: '저장', onClick: async () => {
          const title = document.getElementById('m-title').value;
          if (!title) { showToast('제목을 입력해주세요.', 'warning'); return; }
          let videoId = '';
          const url = document.getElementById('m-url').value;
          if (url) { const match = url.match(/[?&]v=([^&]+)/); if (match) videoId = match[1]; }
          await api.addVideoManual({ title, description: document.getElementById('m-desc').value, video_id: videoId || undefined });
          showToast('영상이 추가되었습니다!', 'success');
          loadVideos();
        }
      }
    ]);
  });

  loadVideos();
}

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 10000) return (n / 10000).toFixed(1) + '만';
  if (n >= 1000) return (n / 1000).toFixed(1) + '천';
  return String(n);
}

function escAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function escH(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
