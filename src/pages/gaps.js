// Gap analysis page — cross-category heatmap + AI deep recommendations
import { showToast } from '../components/toast.js';

// --- [Persistence Logic] ---
const STORAGE_KEY = 'gaps_v2_persistence';
const getStoredState = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (e) {
    return {};
  }
};
const updateStoredState = (patch) => {
  const next = { ...getStoredState(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};

export async function renderGaps(container, { api }) {
  container.innerHTML = `
    <div class="page-header">
      <h2>🎯 AI 갭 분석 & 트렌드 인사이트</h2>
      <p>데이터 속에 숨겨진 틈새를 발견하고 차별화된 영상 기획안을 도출하세요</p>
    </div>

    <!-- 탭 시스템 추가 -->
    <div class="flex gap-12 mb-24" id="gap-tabs" style="background:rgba(255,255,255,0.03); padding:6px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
      <button class="btn btn-secondary active-tab" data-mode="yadam" style="flex:1.2; font-weight:800; font-size:1rem; padding:12px;">🏮 야담 전용 분석</button>
      <button class="btn btn-secondary" data-mode="economy" style="flex:1; font-weight:700;">📈 경제 트렌드</button>
      <button class="btn btn-secondary" data-mode="custom" style="flex:1; font-weight:700;">📊 맞춤형 갭 분석</button>
    </div>

    <div class="card mb-24 hidden" id="custom-selector-card">
      <div class="flex gap-16" style="align-items:flex-end;">
        <div class="input-group" style="flex:1;margin-bottom:0;">
          <label>X축 (가로)</label>
          <select id="gap-x"><option value="">카테고리 그룹 선택...</option></select>
        </div>
        <div class="input-group" style="flex:1;margin-bottom:0;">
          <label>Y축 (세로)</label>
          <select id="gap-y"><option value="">카테고리 그룹 선택...</option></select>
        </div>
        <button class="btn btn-primary" id="gap-analyze-btn">📊 분석 시작</button>
      </div>
      <div style="margin-top:12px; font-size:0.78rem; color:var(--text-muted); padding-left:4px;">
        💡 조선시대 고정 기반의 종합 분석을 원하시면 상단의 <b>'🏮 야담 전용 분석'</b> 탭을 클릭해 보세요. (자동 분석)
      </div>
    </div>

    <div class="card mb-24 hidden" id="yadam-info-card" style="background:var(--accent-glow); border:2px solid var(--accent); position:relative;">
      <div class="flex-between" style="align-items:center;">
        <div>
          <h4 style="margin:0 0 6px 0; color:var(--accent); font-weight:800; font-size:1.1rem;">🏮 야담 전용 분석 : [조선시대] × [모든 카테고리] 중복 분석</h4>
          <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.5;">
            사용자님의 요청대로 <span style="color:var(--accent); font-weight:800;">한 축(시대)과 다른 한 축(모든 소재)</span>의 중복 데이터를 즉시 분석합니다.<br>
            유튜브 내에서 어떤 세분화 된 주제들이 비어있는지(완전 미개척) 한눈에 확인하세요.
          </p>
        </div>
        <button class="btn btn-primary" id="yadam-analyze-btn" style="min-width:140px; font-weight:800;">야담 분석 실행</button>
      </div>
    </div>

    <!-- 세부 카테고리 AI 분류 카드 -->
    <div class="card mb-24" id="sub-classify-card" style="border:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:4px;">🏷️ 세부 카테고리 AI 자동 분류</div>
          <div style="font-size:0.8rem; color:var(--text-muted);" id="sub-classify-progress-text">진행률 조회 중...</div>
        </div>
        <button class="btn btn-secondary" id="sub-classify-btn" style="white-space:nowrap; font-size:0.85rem;">▶ 분류 실행</button>
      </div>
      <div id="sub-classify-status" style="margin-top:10px; font-size:0.8rem; color:var(--accent); display:none;"></div>
    </div>

    <!-- 경제 분석 중간 단계 카드 제거됨 (자동 활성화) -->

    <div id="gap-results">
      <div id="yadam-results-container" class="mode-container hidden"></div>
      <div id="economy-results-container" class="mode-container hidden"></div>
      <div id="custom-results-container" class="mode-container hidden"></div>
    </div>
  `;


  const saved = getStoredState();
  window.__appState = window.__appState || {};
  // 야담 분석을 최우선 기본값으로 강제 설정 (사용자 요청 반영)
  let currentMode = window.__appState.gapsMode || saved.mode || 'yadam';
  if (currentMode === 'custom' && !saved.customData) currentMode = 'yadam';

  const selectorCard = document.getElementById('custom-selector-card');
  const yadamCard = document.getElementById('yadam-info-card');
  const resultsEl = document.getElementById('gap-results');
  const tabs = document.querySelectorAll('#gap-tabs button');

  const yadamCont = document.getElementById('yadam-results-container');
  const economyCont = document.getElementById('economy-results-container');
  const customCont = document.getElementById('custom-results-container');

  const updateModeUI = (mode) => {
    currentMode = mode;
    window.__appState.gapsMode = mode;
    updateStoredState({ mode });

    tabs.forEach(t => {
      t.classList.remove('active-tab', 'btn-primary');
      t.classList.add('btn-secondary');
      if (t.dataset.mode === mode) {
        t.classList.remove('btn-secondary');
        t.classList.add('active-tab', 'btn-primary');
      }
    });

    [selectorCard, yadamCard, yadamCont, economyCont, customCont].forEach(c => c && c.classList.add('hidden'));

    if (mode === 'yadam') {
      yadamCard.classList.remove('hidden');
      yadamCont.classList.remove('hidden');
      // 결과가 없는 경우에만 자동 실행 (무한 루프 방지 및 사용자 UX)
      const s = getStoredState();
      if (!s.yadamData && s.yadamStatus !== 'LOADING') {
        runYadamAnalysis();
      }
    } else if (mode === 'economy') {
      economyCont.classList.remove('hidden');
      runEconomyAnalysis(); // 탭 전환 시 즉시 엔진 기동
    } else if (mode === 'custom') {
      selectorCard.classList.remove('hidden');
      customCont.classList.remove('hidden');
    }
  };

  // --- [Restoration Engine] ---
  const restoreOrResume = async () => {
    const s = getStoredState();

    // 1. Yadam Mode
    if (s.yadamStatus === 'LOADING') {
      runYadamAnalysis();
    } else if (s.yadamData) {
      renderGapResults(s.yadamData, '사건유형', '선택 카테고리', api, yadamCont, true);
    }

    // 2. Economy Mode
    if (s.economyStatus === 'LOADING') {
      runEconomyAnalysis();
    } else if (s.economyData) {
      renderEconomyTrends(s.economyData, api, economyCont);
    }

    // 3. Custom Mode
    if (s.customStatus === 'LOADING' && s.customParams) {
      runCustomAnalysis(s.customParams.gx, s.customParams.gy);
    } else if (s.customData) {
      renderGapResults(s.customData.data, s.customData.gx, s.customData.gy, api, customCont, true);
    }

    // 4. Deep Analysis (Yadam/Custom)
    if (s.deepStatus === 'LOADING' && s.deepParams) {
      performDeepAnalysis(s.deepParams.catX, s.deepParams.catY, s.deepParams.groupX, s.deepParams.groupY, s.deepParams.existingCount, api, s.deepParams.isYadam, s.deepParams.meta);
    } else if (s.deepHtml) {
      setTimeout(() => {
        const area = document.getElementById('deep-analysis-area');
        if (area) {
          area.innerHTML = s.deepHtml;
          attachSuggestionEvents(area, api);
          if (s.deepParams) window.__lastDeepGapParams = { ...s.deepParams, api };
        }
      }, 300);
    }
  };

  // --- [Analysis Execution Functions] ---
  const runYadamAnalysis = async () => {
    updateStoredState({
      yadamStatus: 'LOADING',
      yadamData: null,
      deepStatus: 'IDLE',
      deepHtml: null,
      deepParams: null
    });
    // Clear deep analysis area DOM if exists
    const deepArea = document.getElementById('deep-analysis-area');
    if (deepArea) deepArea.innerHTML = '';

    yadamCont.innerHTML = '<div class="flex-center" style="padding:60px; flex-direction:column; gap:16px;"><div class="spinner"></div><span style="font-weight:700; color:var(--accent);">조선 야담 기회 영역 종합 분석 중...</span></div>';
    try {
      const data = await api.getYadamGaps();

      // Handle Missing Keys or other drop reasons
      if (data.debugCounts && data.debugCounts.dropReason === 'MISSING_KEYS') {
        alert('🏮 야담 정식 분석을 위해 설정에서 YouTube 및 Gemini API 키를 입력해주세요.\n(키가 없으면 외부 수집 및 AI 추천이 작동하지 않습니다)');
        updateStoredState({ yadamStatus: 'IDLE' });
        renderGapResults(data, '사건유형', '선택 카테고리', api, yadamCont);
        return;
      }

      updateStoredState({ yadamStatus: 'SUCCESS', yadamData: data });
      renderGapResults(data, '사건유형', '선택 카테고리', api, yadamCont);
    } catch (err) {
      updateStoredState({ yadamStatus: 'IDLE' });
      yadamCont.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${err.message}</p></div>`;
    }
  };

  const runEconomyAnalysis = async () => {
    // 이미 결과가 있거나 로딩 중이면 중복 실행 방지 (필요 시)
    if (economyCont.querySelector('.v3-keyword-item')) return;

    await renderEconomyV3(api, economyCont);
  };

  const runCustomAnalysis = async (gx, gy) => {
    updateStoredState({ customStatus: 'LOADING', customData: null, customParams: { gx, gy } });
    customCont.innerHTML = '<div class="flex-center" style="padding:40px;"><div class="spinner"></div></div>';
    try {
      const data = await api.getGaps({ groupX: gx, groupY: gy });
      updateStoredState({ customStatus: 'SUCCESS', customData: { data, gx, gy } });
      renderGapResults(data, gx, gy, api, customCont);
    } catch (err) {
      updateStoredState({ customStatus: 'IDLE' });
      customCont.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${err.message}</p></div>`;
    }
  };

  // --- [Event Listeners] ---
  tabs.forEach(tab => tab.addEventListener('click', () => updateModeUI(tab.dataset.mode)));
  document.getElementById('yadam-analyze-btn').addEventListener('click', runYadamAnalysis);
  // economy-analyze-btn 제거됨 (탭 클릭으로 통합)
  document.getElementById('gap-analyze-btn').addEventListener('click', () => {
    const gx = document.getElementById('gap-x').value;
    const gy = document.getElementById('gap-y').value;
    if (!gx || !gy || gx === gy) {
      showToast('카테고리를 선택하시거나, 상단의 [🏮 야담 전용 분석]을 이용해주세요.', 'warning');
      return;
    }
    runCustomAnalysis(gx, gy);
  });

  // 세부 카테고리 분류 버튼
  const subClassifyBtn = document.getElementById('sub-classify-btn');
  const subClassifyStatus = document.getElementById('sub-classify-status');
  const subClassifyProgressText = document.getElementById('sub-classify-progress-text');

  const refreshSubCategoryProgress = async () => {
    try {
      const prog = await api.getSubCategoryProgress();
      const pct = prog.total > 0 ? Math.round(prog.classified / prog.total * 100) : 0;
      subClassifyProgressText.textContent = `전체 ${prog.total}개 영상 중 ${prog.classified}개 분류 완료 (${pct}%) · 미분류 ${prog.unclassified}개`;
    } catch (e) {
      subClassifyProgressText.textContent = '진행률 조회 실패';
    }
  };

  refreshSubCategoryProgress();

  subClassifyBtn?.addEventListener('click', async () => {
    subClassifyBtn.disabled = true;
    subClassifyBtn.textContent = '⏳ 분류 중...';
    subClassifyStatus.style.display = 'block';
    subClassifyStatus.textContent = 'AI가 세부 카테고리를 분류하고 있습니다... (배치당 약 10~30초 소요)';

    let totalProcessed = 0;
    try {
      while (true) {
        const result = await api.classifySubCategories({ limit: 100 });
        totalProcessed += result.processed || 0;
        subClassifyStatus.textContent = `누적 ${totalProcessed}개 분류 완료 중...`;
        await refreshSubCategoryProgress();
        if (!result.processed || result.processed === 0) break;
      }
      subClassifyStatus.textContent = `✅ 분류 완료! 총 ${totalProcessed}개 처리`;
      showToast(`세부 카테고리 분류 완료 (${totalProcessed}개)`, 'success');
    } catch (err) {
      subClassifyStatus.textContent = `❌ 오류: ${err.message}`;
      showToast('분류 실패: ' + err.message, 'error');
    } finally {
      subClassifyBtn.disabled = false;
      subClassifyBtn.textContent = '▶ 분류 실행';
    }
  });

  // Final restoration and boot
  updateModeUI(currentMode);
  restoreOrResume();
}

function renderGapResults(data, groupX, groupY, api, targetEl, isRestore = false) {
  const el = targetEl || document.getElementById('gap-results');
  let filterMode = 'all'; // Local state for filtering

  // Inject detail-dashboard styles once
  if (!document.getElementById('detail-dashboard-style')) {
    const ds = document.createElement('style');
    ds.id = 'detail-dashboard-style';
    ds.textContent = `
      .detail-dashboard { padding:4px 0; }
      .detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
      .detail-filter-btns { display:flex; gap:6px; flex-wrap:wrap; }
      .detail-filter { padding:4px 12px; border-radius:20px; border:1px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.06); color:#ccc; font-size:0.75rem; cursor:pointer; transition:all 0.2s; }
      .detail-filter.active { background:var(--accent,#ff6b6b); border-color:var(--accent,#ff6b6b); color:#fff; font-weight:700; }
      .detail-ai-btn { padding:6px 14px; border-radius:20px; background:linear-gradient(90deg,#7b2ff7,#4f8ef7); border:none; color:#fff; font-size:0.75rem; font-weight:700; cursor:pointer; transition:transform 0.2s; }
      .detail-ai-btn:hover { transform:translateY(-1px); }
      .detail-group { background:rgba(255,255,255,0.02); border-radius:12px; padding:14px; margin-bottom:12px; }
      .detail-group-title { font-size:0.85rem; font-weight:800; color:var(--accent,#ff6b6b); border-left:4px solid var(--accent,#ff6b6b); padding-left:10px; margin-bottom:10px; }
      .detail-bar-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; transition:opacity 0.2s; }
      .detail-bar-row.hidden { display:none; }
      .detail-bar-label { width:80px; font-size:0.75rem; color:#ccc; text-align:right; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .detail-bar-wrap { flex:1; background:rgba(255,255,255,0.08); border-radius:6px; height:24px; position:relative; overflow:hidden; }
      .detail-bar { height:100%; border-radius:6px; transition:width 0.5s ease; }
      .detail-bar.sat-high { background:linear-gradient(90deg,#e74c3c,#c0392b); }
      .detail-bar.sat-mid { background:linear-gradient(90deg,#f39c12,#e67e22); }
      .detail-bar.sat-low { background:linear-gradient(90deg,#27ae60,#2ecc71); }
      .detail-bar-info { font-size:0.72rem; color:#aaa; flex-shrink:0; width:150px; text-align:left; white-space:nowrap; }
    `;
    document.head.appendChild(ds);
  }

  // Inject niche-card styles once
  if (!document.getElementById('niche-card-style')) {
    const s = document.createElement('style');
    s.id = 'niche-card-style';
    s.textContent = `
      .niche-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; margin-top:16px; }
      .niche-card { background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); border:1px solid #2a2a4a; border-radius:12px; padding:16px; cursor:pointer; transition:transform 0.2s,border-color 0.2s; }
      .niche-card:hover { transform:translateY(-2px); border-color:#ff6b6b; }
      .niche-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
      .niche-rank { font-size:18px; font-weight:700; color:#aaa; }
      .niche-rank.rank-1 { color:#ffd700; font-size:24px; }
      .niche-rank.rank-2 { color:#c0c0c0; font-size:22px; }
      .niche-rank.rank-3 { color:#cd7f32; font-size:22px; }
      .niche-count { font-size:18px; color:#ff6b6b; font-weight:600; }
      .niche-card-label { font-size:18px; font-weight:600; color:#e0e0e0; margin-bottom:12px; line-height:1.4; }
      .niche-bar-wrap { position:relative; background:#2a2a4a; border-radius:8px; height:22px; margin-bottom:10px; overflow:hidden; }
      .niche-bar { height:100%; border-radius:8px; background:linear-gradient(90deg,#ff6b6b,#ee5a24); transition:width 0.5s ease; }
      .niche-bar-text { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:13px; font-weight:600; color:#fff; }
    `;
    document.head.appendChild(s);
  }

  const getLevel = (count) => {
    if (count === 0) return 0;
    const ratio = data.maxCount > 0 ? count / data.maxCount : 0;
    if (ratio < 0.1) return 1;
    if (ratio < 0.25) return 2;
    if (ratio < 0.5) return 3;
    if (ratio < 0.75) return 4;
    return 5;
  };

  const renderContent = () => {
    const filteredGaps = data.gaps || [];

    // Process data into rows (using new allRowCells structure)
    const rows = data.yLabels.map((y, yi) => {
      const rowData = data.allRowCells ? data.allRowCells[yi] : [];

      const cells = rowData.map(c => {
        const level = getLevel(c.count);
        const demandBadge = level >= 4 ? '🔥' : level >= 2 ? '✅' : '';

        // Visibility check for the BOX itself
        let isBoxVisible = level >= 1; // 1개라도 있으면 표시
        if (filterMode === 'yellow' && (level < 2 || level >= 4)) isBoxVisible = false;
        if (filterMode === 'red' && level < 4) isBoxVisible = false;

        return {
          ...c,
          level,
          demandBadge,
          isBoxVisible
        };
      });

      const totalVisibleCells = cells.filter(c => c.isBoxVisible).length;

      return { label: y, cells, totalVisibleCells };
    }).filter(r => r.totalVisibleCells > 0);

    // Sidebar list data (using new allRowCells structure)
    const localFilteredGaps = []; // 중복 누적 방지를 위해 로컬 변수 사용
    data.yLabels.forEach((y, yi) => {
      const rowCells = data.allRowCells ? data.allRowCells[yi] : [];
      rowCells.forEach(c => {
        const level = getLevel(c.count);
        // 포화된 영역(level >= 2)만 리스트에 수집
        if (level >= 2) {
          localFilteredGaps.push({
            x: c.label,
            y: y,
            count: c.count,
            level: level,
            fullLabel: c.fullLabel,
            meta: c.meta
          });
        }
      });
    });
    localFilteredGaps.sort((a, b) => b.level - a.level || b.count - a.count);
    const suggestions = localFilteredGaps;

    // UI 배지 제거 (사용자 요청: 실시간 하이브리드 분석 박스 숨김)
    const statsHtml = data.stats ? `
      <div class="stats-bar mb-24" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
        <div class="flex gap-20">
          <span>📊 전체 수집 영상: <b style="color:var(--text);">${data.stats.total.toLocaleString()}개</b></span>
          <span>✅ AI 분석 완료: <b style="color:var(--accent);">${data.stats.analyzed.toLocaleString()}개</b></span>
          <span>🔍 분석 적용률: <b style="color:var(--accent);">${data.stats.percent}%</b></span>
        </div>
        <div style="color:var(--text-muted); font-size:0.75rem;">
          💡 AI 태깅이 완료된 영상들만 분석 차트에 집계됩니다.
        </div>
      </div>
    ` : '';

    const maxCount = (data.topCombined && data.topCombined.length > 0) ? data.topCombined[0].count : 1;
    const topCombinedHtml = (data.topCombined && data.topCombined.length > 0) ? `
      <div class="card mb-24" style="border:1px solid rgba(var(--accent-rgb), 0.2); background:rgba(var(--accent-rgb), 0.02);">
        <h4 class="mb-8" style="display:flex; align-items:center; gap:8px;">
          🚀 <span style="color:var(--accent);">수퍼 니치(Super Niche)</span> : 가장 인기 있는 3중 복합 주제 TOP 10
        </h4>
        <p class="mb-8" style="font-size:0.85rem; color:var(--text-secondary);">
          시대, 사건, 소재 카테고리가 한꺼번에 겹치는 <b>가장 포화된(인기 있는)</b> 조합입니다.
          이 안에서 틈새를 찾는 것이 가장 효과적입니다.
        </p>
        <div class="niche-grid">
          ${data.topCombined.slice(0, 10).map((item, idx) => `
            <div class="niche-card"
                 data-full-label="${item.label}" data-y="[${item.era}] ${item.event}"
                 data-era-id="${item.eraId}" data-event-id="${item.eventId}"
                 data-source-id="${item.sourceId}" data-person-id="${item.personId || 0}"
                 data-region-id="${item.regionId || 0}" data-count="${item.count}">
              <div class="niche-card-header">
                <span class="niche-rank rank-${idx + 1}">${idx < 3 ? `${['🥇','🥈','🥉'][idx]} TOP ${idx + 1}` : `TOP ${idx + 1}`}</span>
                <span class="niche-count">🔥 ${item.count}개</span>
              </div>
              <div class="niche-card-label">${item.label}</div>
              <div class="niche-bar-wrap">
                <div class="niche-bar" style="width:${Math.round(item.count / maxCount * 100)}%"></div>
                <span class="niche-bar-text">포화도 ${Math.round(item.count / maxCount * 100)}%</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    el.innerHTML = `
      ${statsHtml}
      ${topCombinedHtml}
      <div class="two-col">
        <div class="chart-container" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:24px; box-sizing:border-box; ${rows.length === 0 || isRestore ? 'height:244px; overflow:hidden;' : 'overflow-y:auto;'}">
          ${rows.length === 0 || isRestore ? `
            <h4 style="color:#e2e8f0; font-size:16px; margin-bottom:0;">📊 요약 분석</h4>
            <p style="color:#94a3b8; text-align:center; margin-top:70px;">분석을 실행하면 카테고리별 분포가<br>여기에 표시됩니다.</p>
          ` : `
          <div class="flex-between mb-16">
            <h4>📊 요약 분석</h4>
          </div>
          <div class="compact-view" style="display:flex; flex-direction:column; gap:30px;">
            ${rows.map(r => `
              <div class="compact-row" style="background:rgba(255,255,255,0.02); padding:15px; border-radius:16px;">
                <div class="row-label mb-16" style="font-weight:800; color:var(--accent); border-left:4px solid var(--accent); padding-left:12px;">${r.label}</div>
                <div class="cells-wrapper" style="display:flex; flex-wrap:wrap; gap:12px;">
                  ${r.cells.filter(c => c.isBoxVisible).map(c => `
                    <div class="heatmap-cell level-${c.level} clickable-cell"
                         data-full-label="${c.fullLabel}" data-y="${r.label}"
                         data-era-id="${c.meta.eraId}" data-event-id="${c.meta.eventId}"
                         data-source-id="${c.meta.sourceId}" data-person-id="${c.meta.personId}"
                         data-region-id="${c.meta.regionId}"
                         data-count="${c.count}"
                         style="min-width:110px; padding:12px 18px; border-radius:14px; display:flex; flex-direction:column; align-items:center; border:1px solid rgba(255,255,255,0.08); cursor:pointer; transition:all 0.2s; overflow:hidden;">
                      <span style="font-size:0.75rem; font-weight:700; text-align:center; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; line-height:1.2;">${c.label}</span>
                      <span style="font-size:1.2rem; font-weight:900; line-height:1; color:var(--text-primary); margin-top:4px;">${c.count.toLocaleString()}${c.demandBadge}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          `}
        </div>
        <div>
          <!-- ID 충돌 방지를 위해 클래스 기반으로 접근하거나 고유 ID 부여 -->
          <div class="deep-analysis-area-scoped"></div>
          
          <div class="ai-suggestions-area-scoped">
            <div class="chart-container">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:10px;">
                <div style="font-size:0.9rem; font-weight:700; color:var(--text-secondary);">
                  💡 AI 추천 주제 (클릭하여 대본 뼈대 생성)
                </div>
                <button class="card-magnify-btn" style="position:static;" onclick="toggleListMagnify(this)">
                  🔍 글씨 전체 크게
                </button>
              </div>
              <div class="ai-suggestions-list-scoped" style="display:flex;flex-direction:column;gap:12px;">
                ${(() => {
        // Filtering Deep Suggestions based on filterMode (전체/중간/포화)
        let displaySuggestions = data.suggestions || suggestions || [];
        if (filterMode === 'yellow') { // Corresponds to '중간 영역'
          displaySuggestions = displaySuggestions.filter(s => {
            const rate = parseInt(s.gap_rate || s.level * 20) || 0; // gap_rate 없으면 level 기반 추정
            return rate >= 40 && rate <= 70;
          });
        } else if (filterMode === 'red') { // Corresponds to '포화 영역'
          displaySuggestions = displaySuggestions.filter(s => {
            const rate = parseInt(s.gap_rate || s.level * 20) || 0;
            return rate < 40;
          });
        }

        return displaySuggestions.length > 0
          ? displaySuggestions.map((s, idx) => `
                      <div class="suggestion-item card clickable-suggestion" 
                        data-title="${s.title}" data-keywords="${(s.keywords || []).join(',')}"
                        data-catx="${groupX}" data-caty="${groupY}" data-groupx="${groupX}" data-groupy="${groupY}"
                        style="padding:16px; background:var(--bg-secondary); border-left: 4px solid ${s.gap_rate > 80 ? 'var(--success)' : 'var(--accent)'}; transition: all 0.2s; cursor:pointer;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                          <div style="flex:1; padding-right:15px;">
                            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">TOP ${idx + 1}</div>
                            <div class="suggestion-title" style="font-size:1.1rem; font-weight:800; color:var(--text-primary); line-height:1.4;">
                              ${s.title || '제목 없음'}
                            </div>
                          </div>
                          <div style="text-align:right; min-width:80px;">
                            <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">빈틈률</div>
                            <div style="font-size:1.2rem; font-weight:900; color:${s.gap_rate > 80 ? 'var(--success)' : 'var(--accent)'};">
                              ${s.gap_rate || 0}%
                            </div>
                          </div>
                        </div>
                        <div style="height:6px; background:rgba(255,255,255,0.05); border-radius:3px; margin-bottom:12px; overflow:hidden;">
                          <div style="height:100%; width:${s.gap_rate || 0}%; background: ${s.gap_rate > 80 ? 'var(--success)' : 'var(--accent)'}; transition: width 1s ease-out;"></div>
                        </div>
                        <div style="font-size:0.83rem; line-height:1.5; color:var(--text-secondary); border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
                          <span style="color:var(--accent); font-weight:700; margin-right:4px;">Why?</span> ${s.description || s.reason || '-'}
                        </div>
                        <div class="script-plan-loading mt-16" style="display:none; text-align:center;">
                          <div class="spinner-sm mb-8" style="margin:0 auto;"></div>
                          <div style="font-size:0.75rem; color:var(--accent);">후킹 제목 및 상세 대본 뼈대 생성 중...</div>
                        </div>
                        <div class="script-plan-result mt-16" style="display:none; border-top:1px dashed var(--accent); padding-top:16px;"></div>
                      </div>
                    `).join('') : `
                      <div class="empty-state" style="padding:40px 0;">
                        <p style="font-size:0.85rem; color:var(--text-muted);">
                          분석을 실행하면 해당 카테고리 조합에 대한<br>AI 추천 주제가 여기에 표시됩니다.
                        </p>
                      </div>
                    `;
      })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // [드릴 다운 연동] 수퍼 니치 카드 클릭 시 하단 그리드 업데이트 함수
    const drillDownToDetail = async (eraId, eventId, sourceId, label) => {
      const compactView = el.querySelector('.compact-view');
      const headerTitle = el.querySelector('.chart-container h4');

      if (!compactView || !headerTitle) return;

      compactView.innerHTML = `
        <div style="text-align:center; padding:40px;">
          <div class="spinner-sm mb-12" style="margin:0 auto;"></div>
          <div style="font-size:0.85rem; color:var(--accent);">'${label}' 테마 세부 분석 중...</div>
        </div>
      `;

      try {
        const detail = await api.getYadamDetailGrid({ eraId, eventId, sourceId });

        const hasGroups = detail.groups && detail.groups.length > 0;
        headerTitle.innerHTML = `📊 [${label}] 세부 카테고리 분포 (${detail.totalVideos || 0}개 영상 기준)`;

        if (!hasGroups) {
          compactView.innerHTML = `
            <div class="empty-state" style="padding:40px 0;">
              <p style="font-size:0.85rem; color:var(--text-muted);">해당 테마 내에 포화된 세부 조합이 없습니다.</p>
              <button class="btn btn-secondary btn-xs mt-12" id="reset-grid-btn">🔄 전체 요약으로 돌아가기</button>
            </div>
          `;
        } else {
          // Find max count across all groups for bar width scaling
          const allCounts = detail.groups.flatMap(g => g.cells.map(c => c.count));
          const maxDetailCount = Math.max(...allCounts, 1);

          compactView.innerHTML = `
            <div class="detail-dashboard">
              <div class="detail-header">
                <div class="detail-filter-btns">
                  <button class="detail-filter active" data-detail-filter="all">전체</button>
                  <button class="detail-filter" data-detail-filter="high">🔴 포화</button>
                  <button class="detail-filter" data-detail-filter="mid">🟡 중간</button>
                  <button class="detail-filter" data-detail-filter="low">🟢 여유</button>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                  <button class="detail-ai-btn" id="detail-ai-recommend-btn">🤖 AI 차별화 주제 추천받기</button>
                </div>
              </div>
              ${detail.groups.map(group => `
                <div class="detail-group">
                  <div class="detail-group-title">${group.groupName}</div>
                  ${group.cells.map(c => {
                    const satClass = c.level >= 4 ? 'sat-high' : c.level >= 3 ? 'sat-mid' : 'sat-low';
                    const satFilter = c.level >= 4 ? 'high' : c.level >= 3 ? 'mid' : 'low';
                    const satEmoji = c.level >= 4 ? '🔴' : c.level >= 3 ? '🟡' : '🟢';
                    const barWidth = Math.round((c.count / maxDetailCount) * 100);
                    return `
                      <div class="detail-bar-row" data-sat="${satFilter}"
                        data-cat-id="${c.id}" data-count="${c.count}" data-label="${c.label}"
                        data-theme-label="${label}"
                        data-era-id="${eraId}" data-event-id="${eventId}" data-source-id="${sourceId}"
                        style="cursor:pointer;" title="${c.label}: 중복 영상 ${c.count}개">
                        <div class="detail-bar-label" title="${c.label}">${c.label}</div>
                        <div class="detail-bar-wrap">
                          <div class="detail-bar ${satClass}" style="width:${barWidth}%;"></div>
                        </div>
                        <div class="detail-bar-info">${c.count.toLocaleString()}개 ${satEmoji} ${c.level >= 4 ? '포화' : c.level >= 3 ? '중간' : '여유'}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `).join('')}
            </div>
          `;
        }

        // 필터 버튼
        compactView.querySelectorAll('.detail-filter').forEach(btn => {
          btn.addEventListener('click', () => {
            compactView.querySelectorAll('.detail-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const f = btn.dataset.detailFilter;
            compactView.querySelectorAll('.detail-bar-row').forEach(row => {
              if (f === 'all' || row.dataset.sat === f) {
                row.classList.remove('hidden');
              } else {
                row.classList.add('hidden');
              }
            });
          });
        });

        // AI 추천 버튼
        el.querySelector('#detail-ai-recommend-btn')?.addEventListener('click', async () => {
          const deepArea = el.querySelector('.deep-analysis-area-scoped');
          if (!deepArea) { showToast('분석 영역을 찾을 수 없습니다.', 'error'); return; }
          const meta = { eraId, eventId, sourceId, personId: '0', regionId: '0' };
          if (detail.groups && detail.groups.length > 0) {
            meta.saturationData = detail.groups.map(g => ({
              groupName: g.groupName,
              cells: g.cells.map(c => ({
                label: c.label,
                count: c.count,
                level: c.level
              }))
            }));
          }
          showToast(`'${label}' 테마 AI 차별화 주제 추천을 시작합니다...`, 'info');
          await performDeepAnalysis(label, label, '세부 카테고리', '시대/사건/소재', detail.totalVideos || 0, api, true, meta, deepArea);
        });

        // 세부 행 클릭 → 2단계 드릴다운 (세부 카테고리 선택 UI)
        compactView.querySelectorAll('.detail-bar-row').forEach(row => {
          row.addEventListener('click', async () => {
            const catX = row.dataset.label;
            const catY = row.dataset.themeLabel;
            const count = parseInt(row.dataset.count || '0', 10);
            const rowEraId = row.dataset.eraId;
            const rowEventId = row.dataset.eventId;
            const rowSourceId = row.dataset.sourceId;
            const meta = { eraId: rowEraId, eventId: rowEventId, sourceId: rowSourceId, personId: '0', regionId: '0' };
            const deepArea = el.querySelector('.deep-analysis-area-scoped');
            if (!deepArea) { showToast('분석 영역을 찾을 수 없습니다.', 'error'); return; }
            showToast(`'${catX}' 세부 카테고리 조회 중...`, 'info');
            try {
              const subDetail = await api.getYadamDetailGrid({ eraId: rowEraId, eventId: rowEventId, sourceId: rowSourceId });
              renderSubCategoryCards(deepArea, subDetail, catX, catY, count, meta, api);
            } catch (err) {
              showToast('세부 카테고리 조회 실패: ' + err.message, 'error');
            }
          });
        });

      } catch (err) {
        showToast('세부 분석 실패: ' + err.message, 'error');
        renderContent();
      }
    };

    // [수퍼 니치 카드 전용] .niche-card 클릭 → 드릴 다운
    el.querySelectorAll('.niche-card').forEach(card => {
      card.addEventListener('click', async () => {
        const eraId = card.dataset.eraId;
        const eventId = card.dataset.eventId;
        const sourceId = card.dataset.sourceId;
        const label = card.dataset.fullLabel;
        await drillDownToDetail(eraId, eventId, sourceId, label);
      });
    });

    // [히트맵 셀 전용] .heatmap-cell 클릭 → AI 심층 분석
    el.querySelectorAll('.heatmap-cell.clickable-cell').forEach(cell => {
      cell.addEventListener('click', async () => {
        const catX = cell.dataset.fullLabel || cell.dataset.x;
        const catY = cell.dataset.y;
        const count = parseInt(cell.dataset.count || '0', 10);
        const isYadam = currentMode === 'yadam';
        const meta = {
          eraId: cell.dataset.eraId,
          eventId: cell.dataset.eventId,
          sourceId: cell.dataset.sourceId,
          personId: cell.dataset.personId,
          regionId: cell.dataset.regionId
        };
        const deepArea = el.querySelector('.deep-analysis-area-scoped');
        console.log('[DEBUG] Summary Cell Clicked:', { catX, catY, count, deepArea });
        if (!deepArea) {
          showToast('분석 영역을 찾을 수 없습니다.', 'error');
          console.error('[ERROR] .deep-analysis-area-scoped not found in summary!');
          return;
        }
        showToast(`'${catX}' 기획 분석을 시작합니다...`, 'info');
        await performDeepAnalysis(catX, catY, '통합 소재', '시대/사건', count, api, isYadam, meta, deepArea);
      });
    });

    // Attach click events for Stage 1 suggestions
    attachSuggestionEvents(el, api);
  };

  renderContent();
}


function renderSubCategoryCards(deepArea, detail, catX, catY, count, meta, api) {
  const levelLabel = { 1: '매우 여유', 2: '여유', 3: '중간', 4: '포화', 5: '매우 포화' };
  const levelColor = { 1: '#22c55e', 2: '#4ade80', 3: '#eab308', 4: '#f97316', 5: '#ef4444' };

  let html = `
    <div class="chart-container mb-24 animation-fade-in" style="border:2px solid var(--accent); background:var(--card-bg); border-radius:16px; padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h4 style="margin:0; color:var(--accent); font-size:0.95rem;">
          📂 ${catX} (${count}개) — 세부 카테고리 선택
        </h4>
        <button class="btn btn-secondary btn-sm" onclick="this.closest('.chart-container').remove()">✕ 닫기</button>
      </div>
      <p style="color:var(--text-muted); font-size:0.8rem; margin-bottom:8px;">
        아래 세부 카테고리를 클릭하면 해당 조합으로 AI 주제 추천이 시작됩니다.
      </p>
      <div class="sub-category-filter" style="display:flex; gap:8px; padding:12px 0; margin-bottom:4px; border-bottom:1px solid #333; flex-wrap:wrap;">
        <button class="filter-btn active" data-filter="all" style="padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-size:13px; font-weight:bold; background:#3b82f6; color:#fff; opacity:1;">전체</button>
        <button class="filter-btn" data-filter="매우 포화" style="padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-size:13px; font-weight:bold; background:#dc2626; color:#fff; opacity:0.5;">🔴 매우 포화</button>
        <button class="filter-btn" data-filter="포화" style="padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-size:13px; font-weight:bold; background:#f97316; color:#fff; opacity:0.5;">🟠 포화</button>
        <button class="filter-btn" data-filter="중간" style="padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-size:13px; font-weight:bold; background:#eab308; color:#000; opacity:0.5;">🟡 중간</button>
        <button class="filter-btn" data-filter="여유" style="padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-size:13px; font-weight:bold; background:#22c55e; color:#fff; opacity:0.5;">🟢 여유</button>
      </div>
  `;

  for (const group of (detail.groups || [])) {
    html += `<div class="sub-cat-group" style="margin-bottom:16px;">
      <div style="font-weight:700; color:var(--text-secondary); font-size:0.85rem; margin-bottom:8px; border-left:3px solid var(--accent); padding-left:8px;">
        ${group.groupName}
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">`;

    for (const cell of group.cells) {
      const color = levelColor[cell.level] || '#eab308';
      const lbl = levelLabel[cell.level] || '중간';
      html += `
        <div class="sub-category-card"
             data-label="${cell.label}"
             data-group="${group.groupName}"
             data-count="${cell.count}"
             data-level="${cell.level}"
             style="background:rgba(255,255,255,0.06); border:1px solid ${color}40; border-radius:12px; padding:10px 16px; cursor:pointer; transition:all 0.2s; min-width:120px;"
             onmouseover="this.style.background='rgba(255,255,255,0.12)'; this.style.borderColor='${color}';"
             onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.borderColor='${color}40';">
          <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary); margin-bottom:4px;">${cell.label}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">${cell.count}개</span>
            <span style="font-size:0.7rem; color:${color}; font-weight:600;">● ${lbl}</span>
          </div>
        </div>`;
    }
    html += `</div></div>`;
  }

  if (!detail.groups || detail.groups.length === 0) {
    html += `<p style="color:var(--text-muted); font-size:0.85rem;">세부 카테고리 데이터가 없습니다.</p>`;
  }

  html += `</div>`;
  deepArea.innerHTML = html;

  // 필터 버튼 이벤트
  deepArea.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deepArea.querySelectorAll('.filter-btn').forEach(b => b.style.opacity = '0.5');
      btn.style.opacity = '1';
      const f = btn.dataset.filter;
      deepArea.querySelectorAll('.sub-cat-group').forEach(group => {
        let visibleCount = 0;
        group.querySelectorAll('.sub-category-card').forEach(card => {
          const level = parseInt(card.dataset.level || '0', 10);
          let show = false;
          if (f === 'all') show = true;
          else if (f === '매우 포화') show = level === 5;
          else if (f === '포화') show = level === 4;
          else if (f === '중간') show = level === 3;
          else if (f === '여유') show = level <= 2;
          card.style.display = show ? '' : 'none';
          if (show) visibleCount++;
        });
        group.style.display = visibleCount === 0 ? 'none' : '';
      });
    });
  });

  deepArea.querySelectorAll('.sub-category-card').forEach(card => {
    card.addEventListener('click', async () => {
      const subLabel = card.dataset.label;
      const subCount = parseInt(card.dataset.count || '0', 10);
      const enrichedMeta = {
        ...meta,
        saturationData: (detail.groups || []).map(g => ({
          groupName: g.groupName,
          cells: g.cells.map(c => ({ label: c.label, count: c.count, level: c.level }))
        }))
      };
      await performDeepAnalysis(
        subLabel, catY + ' × ' + subLabel,
        '세부 카테고리', '시대/사건/소재',
        subCount, api, true, enrichedMeta, deepArea
      );
    });
  });
}

async function performDeepAnalysis(catX, catY, groupX, groupY, existingCount, api, isYadam = false, meta = null, targetArea = null) {
  const area = targetArea || document.getElementById('deep-analysis-area');
  if (!area) {
    console.error('[performDeepAnalysis] target area fail - targetArea:', targetArea, 'GlobalID:', !!document.getElementById('deep-analysis-area'));
    return;
  }

  const analysisKey = `${catX}-${catY}-${isYadam}`;
  const now = Date.now();
  const stored = getStoredState();

  // 1. Check for ongoing global promise OR stuck state (5min+)
  if (stored.deepStatus === 'LOADING' && stored.deepLastUpdate && (now - stored.deepLastUpdate > 300000)) {
    console.warn('[performDeepAnalysis] Stuck detected (5min+). Forcing reset.');
    window.__activeDeepAnalysis = null;
    updateStoredState({ deepStatus: 'IDLE', deepLastUpdate: now });
  }

  // 2. Check for ongoing global promise
  if (window.__activeDeepAnalysis === analysisKey) {
    console.log('[performDeepAnalysis] Analysis already in progress:', analysisKey);
    showToast('현재 해당 주제를 분석 중입니다.', 'warning');
    // Force show loading UI if stuck
    area.innerHTML = `
       <div class="chart-container mb-24 flex-center" style="padding:40px; border:2px solid var(--accent); flex-direction:column; gap:16px;">
         <div class="spinner"></div>
         <div style="color:var(--accent); font-weight:700;">분석이 진행 중입니다... (잠시만 기다려주세요)</div>
         <button class="btn btn-secondary btn-xs" onclick="if(window.__forceResetAnalysis) window.__forceResetAnalysis()">⚠️ 분석 강제 초기화</button>
       </div>`;
    return;
  }

  window.__activeDeepAnalysis = analysisKey;

  // Store for redo and persistence
  const STORAGE_KEY = 'gaps_v2_persistence';
  const currentState = updateStoredState({
    deepStatus: 'LOADING',
    deepParams: { catX, catY, groupX, groupY, existingCount, isYadam, meta },
    deepLastUpdate: now
  });
  delete currentState.deepHtml;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));

  window.__lastDeepGapParams = { catX, catY, groupX, groupY, existingCount, api, meta, isYadam, targetArea: area };
  window.__gapApi = api;

  if (!window.redoDeepAnalysis) {
    window.redoDeepAnalysis = function () {
      const p = window.__lastDeepGapParams;
      if (p) performDeepAnalysis(p.catX, p.catY, p.groupX, p.groupY, p.existingCount, p.api, p.isYadam, p.meta, p.targetArea);
    };
  }

  area.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const opportunityLabel = existingCount === 0
    ? '<span class="tag safe">🟢 완전 미개척</span>'
    : existingCount <= 3
      ? '<span class="tag" style="background:rgba(59,130,246,0.2);color:#60a5fa;">🔵 저경쟁</span>'
      : '<span class="tag caution">🟡 틈새</span>';

  area.innerHTML = `
    <div class="chart-container mb-24 animation-fade-in" style="border:2px solid var(--accent); background:var(--accent-glow);">
      <div class="flex-between mb-16">
        <div>
          <h4 style="margin:0 0 6px 0; color:var(--accent);">🔎 [${catY} × ${catX}] 심층 기획 분석</h4>
          <div class="flex gap-8" style="align-items:center;">
            ${opportunityLabel}
            <span style="font-size:0.78rem;color:var(--text-muted);">기존 영상 ${existingCount}개 · AI 분석 중...</span>
          </div>
        </div>
        <div class="spinner-sm"></div>
      </div>
      <div style="background:rgba(var(--accent-rgb),0.05);border-radius:8px;padding:14px;">
        <div class="skeleton" style="height:16px;width:80%;margin-bottom:8px;border-radius:4px;"></div>
        <div class="skeleton" style="height:16px;width:60%;margin-bottom:8px;border-radius:4px;"></div>
        <div class="skeleton" style="height:16px;width:70%;border-radius:4px;"></div>
      </div>
      <div style="text-align:center; margin-top:12px;">
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">
          ✨ Gemini AI가 해당 틈새 시장을 분석하고 있습니다... (약 30~60초 소요)
        </p>
        <button class="btn btn-secondary btn-xs" style="opacity:0.6;" onclick="window.__forceResetAnalysis && window.__forceResetAnalysis()">⚠️ 너무 오래 걸리면 클릭 (초기화)</button>
      </div>
    </div>
  `;

  // State: START LOADING
  // const STORAGE_KEY = 'gaps_v2_persistence'; // Already defined above
  // const currentState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); // Handled by updateStoredState
  // delete currentState.deepHtml; // Handled by updateStoredState
  // currentState.deepStatus = 'LOADING'; // Handled by updateStoredState
  // currentState.deepParams = { catX, catY, groupX, groupY, existingCount, isYadam, meta }; // Handled by updateStoredState
  // localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState)); // Handled by updateStoredState

  try {
    // Timeout integration
    const timeoutFunc = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI 분석 시간 초과 (95초).')), 95000)
    );

    const result = await Promise.race([
      api.deepGapAnalysis({ catX, catY, groupX, groupY, isYadam, meta }),
      timeoutFunc
    ]);
    const suggestions = result.suggestions || [];
    const returnedCount = result.existingCount ?? existingCount;

    if (suggestions.length === 0) {
      updateStoredState({ deepStatus: 'IDLE', deepLastUpdate: Date.now() });
      const curArea = area;
      if (curArea) {
        curArea.innerHTML = `
          <div class="chart-container mb-24 animation-fade-in" style="border:2px solid var(--warning);">
            <h4 style="color:var(--warning);">⚠️ AI 분석 결과 없음</h4>
            <p style="font-size:0.85rem;color:var(--text-secondary);">
              AI가 주제를 생성하지 못했습니다. (데이터 부족 또는 일시적 서비스 지연)<br>
              너무 자주 요청했거나 Gemini API 설정에 문제가 있을 수 있습니다.
            </p>
            <button class="btn btn-secondary btn-sm mt-16" onclick="this.closest('.chart-container').remove()">닫기</button>
          </div>
        `;
      }
      return;
    }

    const html = `
      <div class="chart-container mb-24 animation-fade-in" style="border: 2px solid var(--accent); background: var(--card-bg);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px;">
          <div style="flex:1;">
            <h4 style="margin:0 0 6px 0; color:var(--accent); font-size:0.9rem; line-height:1.4;">
              🚀 [${catY} × ${catX}] 시장 분석 & 떡상 전략 리포트
            </h4>
            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:8px;">
              ${opportunityLabel}
              <span class="tag safe">시장 데이터 분석 완료</span>
              <span style="font-size:0.85rem;color:var(--text-muted);">기존 영상 ${returnedCount}개 분석 · 전략 기획안 실시간 생성</span>
            </div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-secondary" style="padding:5px 10px; font-size:0.75rem; white-space:nowrap; border-radius:8px;" onclick="window.redoDeepAnalysis()">🔄 다시 추천</button>
            <button class="btn btn-secondary" style="padding:5px 10px; font-size:0.75rem; white-space:nowrap; border-radius:8px;" onclick="this.closest('.chart-container').remove()">✕ 닫기</button>
          </div>
        </div>
        
        <div style="margin-bottom:12px;">
          <div style="font-size:1rem; font-weight:700; color:var(--text-secondary); white-space:nowrap; margin-bottom:6px;">
            💡 [Step 1] 틈새 시장 테마 추천 (TOP 10)
          </div>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px; line-height:1.4;">
            * 이 카테고리 조합에서 아직 다뤄지지 않은 **새로운 주제(Theme) 방향**을 추천합니다.
          </p>
        </div>

        
        <div id="deep-suggestion-list" style="display:flex; flex-direction:column; gap:12px;">
          ${suggestions.map((s, idx) => `
            <div class="suggestion-item card clickable-suggestion" 
              data-title="${s.title}" data-keywords="${(s.keywords || []).join(',')}"
              data-catx="${catX}" data-caty="${catY}" data-groupx="${groupX}" data-groupy="${groupY}"
              style="padding:24px; background:var(--bg-secondary); border-left: 5px solid ${(parseInt(s.gap_rate) || 0) > 80 ? 'var(--success)' : 'var(--accent)'}; transition: all 0.2s; cursor:pointer;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div style="flex:1; padding-right:20px;">
                  <div style="font-size:1rem; color:var(--text-muted); font-weight:700; margin-bottom:6px;">TOP ${idx + 1}</div>
                  <div class="suggestion-title" style="font-size:1.5rem; font-weight:900; color:var(--text-primary); line-height:1.4;">
                    ${s.title || '제목 없음'}
                  </div>
                </div>
                <div style="text-align:right; min-width:100px;">
                  <div style="font-size:1rem; color:var(--text-muted); font-weight:700; margin-bottom:6px;">빈틈률</div>
                  <div style="font-size:1.6rem; font-weight:900; color:${s.gap_rate > 80 ? 'var(--success)' : 'var(--accent)'};">
                    ${s.gap_rate || 0}%
                  </div>
                </div>
              </div>

              <div style="height:10px; background:rgba(255,255,255,0.05); border-radius:5px; margin-bottom:16px; overflow:hidden;">
                <div style="height:100%; width:${parseInt(s.gap_rate) || 0}%; background: ${(parseInt(s.gap_rate) || 0) > 80 ? 'var(--success)' : 'var(--accent)'}; transition: width 1s ease-out;"></div>
              </div>

              ${s.keywords ? `
              <div class="flex-between mb-16">
                <div class="tag-list" style="gap:8px; flex:1;">
                  ${s.keywords.map(kw => `<span class="tag" style="background:rgba(var(--accent-rgb), 0.1); border:1px solid var(--accent-light); color:var(--accent); font-weight:700; font-size:1rem; padding:6px 14px;">#${kw}</span>`).join('')}
                </div>
              </div>
              ` : ''}
              
              <div style="font-size:1.15rem; line-height:1.6; color:var(--text-secondary); border-top:1px solid rgba(255,255,255,0.05); padding-top:16px;">
                <span style="color:var(--accent); font-weight:800; margin-right:6px;">Why?</span> ${s.reason || '-'}
              </div>

              <div class="script-plan-loading mt-20" style="display:none; text-align:center;">
                <div class="spinner mb-12" style="margin:0 auto;"></div>
                <div style="font-size:1.1rem; color:var(--accent); font-weight:700;">후킹 제목 및 상세 대본 뼈대 생성 중...</div>
              </div>

              <div class="script-plan-result mt-20" style="display:none; border-top:2px dashed var(--accent); padding-top:20px;"></div>
            </div>
          `).join('')}
        </div>
      </div >
    `;

    const curArea = area;
    if (curArea) {
      curArea.innerHTML = html;
      attachSuggestionEvents(curArea, api);
    }

    // State: SUCCESS
    const finalState = updateStoredState({
      deepStatus: 'SUCCESS',
      deepHtml: html,
      deepParams: { catX, catY, groupX, groupY, existingCount, isYadam, meta }
    });

  } catch (err) {
    console.error('[performDeepAnalysis] Error:', err);
    updateStoredState({ deepStatus: 'IDLE' });
    const curArea = area;
    if (curArea) {
      if (err.message.includes('AUTH_ERROR') || err.message.includes('인증')) {
        curArea.innerHTML = `
          <div class="chart-container mb-24 animation-fade-in" style="border:1px dashed #f59e0b; background:rgba(245, 158, 11, 0.05); text-align:center; padding:30px;">
            <div style="font-size:2.5rem; margin-bottom:12px;">🔑</div>
            <h4 style="color:#f59e0b; margin-bottom:8px;">AI 인증 오류 (AUTH_ERROR)</h4>
            <p style="font-size:0.9rem; line-height:1.5; color:var(--text-secondary);">
              API 키 인증에 실패했습니다.<br>
              <strong>해결 방법:</strong> 설정 페이지에서 API 키와 Project ID를 확인하고,<br>
              Google Cloud 콘솔에서 <strong>'Generative Language API'</strong> 사용 설정 여부를 확인하세요.
            </p>
            <div class="flex-center gap-12 mt-16">
              <a href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com" target="_blank" class="btn btn-warning btn-sm">API 설정하러 가기</a>
              <button class="btn btn-secondary btn-sm" onclick="this.closest('.chart-container').remove()">닫기</button>
            </div>
          </div>
        `;
      } else if (err.message.includes('QUOTA') || err.message.includes('429')) {
        curArea.innerHTML = `
          <div class="chart-container mb-24 animation-fade-in" style="border:1px dashed #f59e0b; background:rgba(245, 158, 11, 0.05); text-align:center; padding:30px;">
            <div style="font-size:2.5rem; margin-bottom:12px;">⏱️</div>
            <h4 style="color:#f59e0b; margin-bottom:8px;">AI API 쿼터 초과</h4>
            <p style="font-size:0.9rem; line-height:1.5; color:var(--text-secondary);">
              Gemini API 무료 할당량이 일시적으로 소진되었습니다.<br>
              <strong>해결 방법:</strong> 약 1분 후 다시 시도하시거나, 유료 플랜을 검토해 보세요.
            </p>
            <div class="flex-center gap-12 mt-16">
              <button class="btn btn-primary btn-sm" onclick="window.redoDeepAnalysis && window.redoDeepAnalysis()">🔄 다시 시도</button>
              <button class="btn btn-secondary btn-sm" onclick="this.closest('.chart-container').remove()">닫기</button>
            </div>
          </div>
        `;
      } else if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        curArea.innerHTML = `
          <div class="chart-container mb-24 animation-fade-in" style="border:1px dashed #ef4444; background:rgba(239, 68, 68, 0.05); text-align:center; padding:30px;">
            <div style="font-size:2.5rem; margin-bottom:12px;">🔌</div>
            <h4 style="color:#ef4444; margin-bottom:8px;">서버에 연결할 수 없음</h4>
            <p style="font-size:0.9rem; line-height:1.5; color:var(--text-secondary);">
              백엔드 서버가 응답하지 않습니다.<br>
              터미널에서 <code>npm run dev</code>가 실행 중인지 확인해 주세요.
            </p>
            <div class="flex-center gap-12 mt-16">
              <button class="btn btn-primary btn-sm" onclick="window.redoDeepAnalysis && window.redoDeepAnalysis()">🔄 재시도</button>
              <button class="btn btn-secondary btn-sm" onclick="this.closest('.chart-container').remove()">닫기</button>
            </div>
          </div>
        `;
      } else if (err.message.includes('PARSE_ERROR')) {
        curArea.innerHTML = `
          <div class="chart-container mb-24 animation-fade-in" style="border:1px dashed var(--warning); background:rgba(var(--warning-rgb), 0.05); text-align:center; padding:30px;">
            <div style="font-size:2.5rem; margin-bottom:12px;">🧩</div>
            <h4 style="color:var(--warning); margin-bottom:8px;">응답 파싱 실패</h4>
            <p style="font-size:0.9rem; line-height:1.5; color:var(--text-secondary);">
              AI가 유효하지 않은 형식으로 응답했습니다.<br>
              일시적인 현상일 수 있으니 '다시 시도'를 눌러보세요.
            </p>
            <div class="flex-center gap-12 mt-16">
              <button class="btn btn-primary btn-sm" onclick="window.redoDeepAnalysis && window.redoDeepAnalysis()">🔄 다시 기획 요청</button>
              <button class="btn btn-secondary btn-sm" onclick="this.closest('.chart-container').remove()">닫기</button>
            </div>
          </div>
        `;
      } else {
        showToast('심층 분석 실패: ' + err.message, 'error');
        curArea.innerHTML = `
          <div class="chart-container mb-24 animation-fade-in" style="border:2px solid var(--danger); text-align:center; padding:30px;">
            <h4 style="color:var(--danger); margin-bottom:12px;">❌ 분석 중 오류 발생</h4>
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:20px;">${err.message}</p>
            <div class="flex-center gap-12">
               <button class="btn btn-secondary btn-sm" onclick="window.redoDeepAnalysis && window.redoDeepAnalysis()">🔄 다시 시도</button>
               <button class="btn btn-secondary btn-sm" onclick="this.closest('.chart-container').remove()">닫기</button>
            </div>
          </div>
        `;
      }
    }
  } finally {
    window.__activeDeepAnalysis = null;
    // Ensure loading state in localStorage is also cleared if not success
    const s = getStoredState();
    if (s.deepStatus === 'LOADING') {
      updateStoredState({ deepStatus: 'IDLE' });
    }
  }
}

// Global helpers and event attachments
function attachSuggestionEvents(container, api) {
  container.querySelectorAll('.clickable-suggestion').forEach(item => {
    // Direct assignment to the DOM element property to ensure accessibility in global handlers
    item._api = api;

    item.addEventListener('click', async (e) => {
      if (e.target.closest('.script-plan-result') || e.target.closest('.redo-titles-btn') || e.target.closest('.redo-skeleton-btn')) return;

      const loading = item.querySelector('.script-plan-loading');
      const resultArea = item.querySelector('.script-plan-result');

      if (loading.style.display === 'block') return;
      if (resultArea.style.display === 'block') {
        resultArea.style.display = 'none';
        return;
      }
      if (resultArea.children.length > 0) {
        resultArea.style.display = 'block';
        return;
      }

      const title = item.dataset.title;
      const category = (item.dataset.yadam === 'true') ? '야담' : '일반';

      loading.style.display = 'block';
      item.style.cursor = 'wait';

      try {
        // 1. Analyze Theme DNA (Search + Extraction)
        const dnaRes = await api.analyzeThemeDna(title, category);
        const dna = dnaRes.dna;

        loading.style.display = 'none';
        item.style.cursor = 'pointer';
        resultArea.style.display = 'block';

        // 2. Render action UI (DNA 데이터는 내부 변수로 유지, UI는 표시 안 함)
        resultArea.innerHTML = `
          <div style="background:var(--bg-card); padding:20px; border-radius:12px; border:1px solid var(--accent-glow); margin-bottom:16px;">
            <div style="text-align:center;">
              <button class="btn btn-primary btn-sm theme-recommend-titles-btn" style="width:100%; font-weight:800;">
                🎯 이 DNA로 후킹 제목 10종 생성하기
              </button>
            </div>
            <div class="theme-titles-result hidden mt-16"></div>
          </div>
        `;

        // genThemeSkeleton: dna/category/api를 클로저로 캡처, 선택 제목 바로 아래 inline 삽입
        window.genThemeSkeleton = async (el, selectedTitle, originalTopic) => {
          console.log('[뼈대] 함수 호출됨:', selectedTitle, '| el:', el);
          if (!el) return;

          // 기존 선택 해제 + 기존 inline 뼈대 모두 제거
          const list = el.closest('[data-title-list]');
          if (list) {
            list.querySelectorAll('.theme-title-item').forEach(item => {
              item.style.background = 'rgba(255,255,255,0.03)';
              item.style.borderColor = 'rgba(255,255,255,0.08)';
              const cb = item.querySelector('input');
              if (cb) cb.checked = false;
            });
            list.querySelectorAll('.theme-skeleton-inline').forEach(s => s.remove());
          }

          // 선택 표시
          el.style.background = 'rgba(255,255,255,0.08)';
          el.style.borderColor = 'var(--accent)';
          const cb = el.querySelector('input');
          if (cb) cb.checked = true;

          // 선택한 제목 바로 아래에 뼈대 영역 삽입
          el.insertAdjacentHTML('afterend', '<div class="theme-skeleton-inline" style="margin-top:8px;"></div>');
          const area = el.nextElementSibling;

          // 접혀있으면 펼치기
          const titlesCol = el.closest('.titles-collapsible-content');
          if (titlesCol && titlesCol.style.maxHeight === '0px') {
            titlesCol.style.maxHeight = titlesCol.scrollHeight + 'px';
            const tBtn = el.closest('.theme-titles-result')?.querySelector('.titles-section-toggle');
            if (tBtn) tBtn.textContent = '▼ 접기';
          }

          area.innerHTML = '<div class="flex-center" style="padding:20px; flex-direction:column; gap:10px;"><div class="spinner-sm"></div><div style="font-size:0.75rem;">대본 설계 중...</div></div>';

          try {
            console.log('[뼈대] API 호출:', { dna, selectedTitle, category });
            const skelRes = await api.generateDnaSkeleton(dna, selectedTitle, category);
            console.log('[뼈대] API 응답:', skelRes);
            const skel = skelRes.skeleton;
            area.innerHTML = `
              <div class="card theme-skeleton-card" style="border:1px solid var(--success); background:rgba(46,204,64,0.03); padding:16px; border-radius:12px;">
                <div class="flex-between mb-16" style="align-items:center;">
                  <div style="font-weight:900; color:var(--success); font-size:1.1rem;">📜 최종 대본 설계</div>
                  <div class="flex gap-8">
                    <button class="redo-skel-btn btn btn-secondary btn-xs">🔄 다시 만들기</button>
                    <button class="dl-skel-btn btn btn-success btn-xs">📥 TXT 다운로드</button>
                  </div>
                </div>
                <div style="font-size:0.85rem; line-height:1.6; display:flex; flex-direction:column; gap:10px;" class="skeleton-content">
                  ${skel.sections.map(s => `<div class="skeleton-section"><strong style="color:var(--accent);">[${s.name}]</strong> ${s.hook_sentence} <br><span style="opacity:0.8; font-size:0.75rem;">${s.goal}</span></div>`).join('')}
                  <div style="border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; color:var(--warning);" class="climax-note">✨ 차별화: ${skel.climax_note}</div>
                </div>
              </div>
            `;
            // 다시 만들기
            area.querySelector('.redo-skel-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              window.genThemeSkeleton(el, selectedTitle, originalTopic);
            });
            // TXT 다운로드
            area.querySelector('.dl-skel-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              const card = area.querySelector('.card');
              const sections = card.querySelectorAll('.skeleton-section');
              const climax = card.querySelector('.climax-note');
              let text = `[최종 대본 설계]\n제목: ${selectedTitle}\n\n`;
              sections.forEach(s => { text += s.innerText.replace(/\n\s+/g, '\n').trim() + '\n\n'; });
              if (climax) text += `\n${climax.innerText}\n`;
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `대본뼈대_${selectedTitle.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            });
            // 뼈대 추가 후 collapsible 높이 재계산
            if (titlesCol) titlesCol.style.maxHeight = titlesCol.scrollHeight + 'px';
            area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } catch (err) {
            area.innerHTML = `<div style="color:var(--danger);">❌ 실패: ${err.message}</div>`;
          }
        };

        // Event: Recommend Titles for this DNA
        const titleBtn = resultArea.querySelector('.theme-recommend-titles-btn');
        const titlesResult = resultArea.querySelector('.theme-titles-result');

        const doFetchTitles = async () => {
          const kwRes = await api.extractGoldenKeywords(dna);
          const tRes = await api.recommendDnaTitles(dna, kwRes, category, title);
          const titles = tRes.titles || [];
          titles.unshift({ title, ctr_score: 100, reason: '⭐ 선택하신 원본 주제' });

          titlesResult.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:6px;">
              <div style="font-weight:800; color:var(--danger); font-size:0.85rem;">🔥 떡상 공식 추천 제목 (클릭 시 뼈대 생성)</div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="redo-titles-inner-btn" style="background:none; border:1px solid rgba(255,255,255,0.15); color:var(--text-muted); cursor:pointer; font-size:0.72rem; font-weight:700; padding:2px 10px; border-radius:4px;">🔄 다시 추천</button>
                <button class="titles-section-toggle" style="background:none; border:1px solid rgba(255,255,255,0.15); color:var(--text-muted); cursor:pointer; font-size:0.72rem; font-weight:700; padding:2px 10px; border-radius:4px;">▼ 접기</button>
              </div>
            </div>
            <div class="titles-collapsible-content" style="overflow:hidden; transition:max-height 0.3s ease;">
              <div data-title-list style="display:flex; flex-direction:column; gap:8px;">
                ${titles.map(t => `
                  <div class="theme-title-item"
                    data-title-val="${t.title.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"
                    style="display:flex; align-items:flex-start; gap:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:10px 14px; border-radius:8px; cursor:pointer; font-size:0.95rem; font-weight:800; transition:all 0.2s;"
                    onmouseover="this.style.borderColor='var(--accent)';"
                    onmouseout="if(!this.querySelector('input').checked) this.style.borderColor='rgba(255,255,255,0.08)';">
                    <input type="checkbox" style="width:18px; height:18px; accent-color:var(--accent); flex-shrink:0; pointer-events:none; margin-top:2px;">
                    <div style="flex:1;">
                      <span class="title-text">${t.title}</span>
                      <span style="font-size:0.65rem; color:var(--accent); font-weight:400; display:block; margin-top:4px;">${t.reason}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div><!-- /titles-collapsible-content -->
          `;

          // Toggle
          const titlesToggleBtn = titlesResult.querySelector('.titles-section-toggle');
          const titlesCollapsible = titlesResult.querySelector('.titles-collapsible-content');
          if (titlesToggleBtn && titlesCollapsible) {
            titlesCollapsible.style.maxHeight = titlesCollapsible.scrollHeight + 'px';
            titlesToggleBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const isOpen = titlesCollapsible.style.maxHeight !== '0px';
              titlesCollapsible.style.maxHeight = isOpen ? '0px' : titlesCollapsible.scrollHeight + 'px';
              titlesToggleBtn.textContent = isOpen ? '▲ 펼치기' : '▼ 접기';
            });
          }

          // 제목 아이템 클릭 → 뼈대 생성 (onclick 속성 대신 이벤트 리스너)
          titlesResult.querySelectorAll('.theme-title-item').forEach(itemEl => {
            itemEl.addEventListener('click', (e) => {
              e.stopPropagation();
              window.genThemeSkeleton(itemEl, itemEl.dataset.titleVal, title);
            });
          });

          // 다시 추천 버튼
          const redoInnerBtn = titlesResult.querySelector('.redo-titles-inner-btn');
          if (redoInnerBtn) {
            redoInnerBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              redoInnerBtn.disabled = true;
              redoInnerBtn.textContent = '추천 중...';
              titlesResult.innerHTML = '<div class="flex-center" style="padding:20px; flex-direction:column; gap:10px;"><div class="spinner-sm"></div><div style="font-size:0.75rem; color:var(--text-muted);">분석된 주제 최적화 DNA 기반으로 분석중...</div></div>';
              try { await doFetchTitles(); } catch (err) {
                titlesResult.innerHTML = `<div style="color:var(--danger); font-size:0.8rem;">❌ 실패: ${err.message}</div>`;
              }
            });
          }
        };

        titleBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          titleBtn.disabled = true;
          titleBtn.innerHTML = '<span class="spinner-sm"></span> 분석 중...';
          titlesResult.classList.remove('hidden');
          titlesResult.innerHTML = '<div class="flex-center" style="padding:20px; flex-direction:column; gap:10px;"><div class="spinner-sm"></div><div style="font-size:0.75rem; color:var(--text-muted);">분석된 주제 최적화 DNA 기반으로 분석중...</div></div>';
          try {
            await doFetchTitles();
            titleBtn.innerHTML = '✅ 제목 추천 완료';
          } catch (err) {
            titlesResult.innerHTML = `<div style="color:var(--danger); font-size:0.8rem;">❌ 실패: ${err.message}</div>`;
            titleBtn.disabled = false;
            titleBtn.innerHTML = '🔄 다시 시도';
          }
        });

      } catch (err) {
        loading.style.display = 'none';
        item.style.cursor = 'pointer';
        showToast('분석 실패: ' + err.message, 'error');
      }
    });
  });
}

if (!window.redoPlanPart) {
  window.redoPlanPart = async function (btn, type) {
    const item = btn.closest('.suggestion-item');
    const title = item.dataset.title;
    const keywords = item.dataset.keywords.split(',');
    const catX = item.dataset.catx;
    const catY = item.dataset.caty;
    const groupX = item.dataset.groupx;
    const groupY = item.dataset.groupy;

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-xs" style="width:10px; height:10px;"></span>';
    btn.disabled = true;

    try {
      // Find the API instance
      const api = window.__lastDeepGapParams?.api;
      if (!api) throw new Error('API 인스턴스를 찾을 수 없습니다.');

      const plan = await api.generateScriptPlan({ title, keywords, catX, catY, groupX, groupY, type });
      if (type === 'titles' && plan.hooking_titles) {
        const list = item.querySelector('.hooking-titles-list');
        list.innerHTML = plan.hooking_titles.map(t => `
    < div class="hooking-title-item"
  style = "font-size:0.95rem; font-weight:800; padding:10px 12px; background:rgba(255,255,255,0.03); border-radius:6px; border-left:3px solid var(--danger); cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s;"
  onclick = "event.stopPropagation(); window.toggleTitleSelection(this)" >
              <span>${t}</span>
              <span class="check-mark" style="color:var(--success); font-weight:900; opacity:0; transition:opacity 0.2s;">✅</span>
            </div > `).join('');
      } else if (type === 'skeleton' && plan.script_skeleton) {
        const content = item.querySelector('.skeleton-content');
        content.innerHTML = `
          <div><strong style="color:var(--danger);">[1. 충격]</strong> ${plan.script_skeleton.step1_shock || plan.script_skeleton.intro}</div>
          <div><strong style="color:var(--warning);">[2. 의심]</strong> ${plan.script_skeleton.step2_doubt || plan.script_skeleton.development}</div>
          <div><strong style="color:var(--accent);">[3. 갈등]</strong> ${plan.script_skeleton.step3_conflict || ''}</div>
          <div><strong style="color:var(--accent-light);">[4. 단서]</strong> ${plan.script_skeleton.step4_clue || ''}</div>
          <div><strong style="color:var(--success);">[5. 조짐]</strong> ${plan.script_skeleton.step5_flash || plan.script_skeleton.climax}</div>
          <div><strong style="color:var(--danger);">[6. 반전]</strong> ${plan.script_skeleton.step6_truth || ''}</div>
          <div><strong style="color:var(--text-muted);">[7. 여운]</strong> ${plan.script_skeleton.step7_resonance || plan.script_skeleton.conclusion}</div>
  `;
        if (plan.differentiation) {
          const diffLabel = content.previousElementSibling;
          diffLabel.innerText = '* ' + plan.differentiation;
        }
      }
      showToast('성공적으로 다시 추천되었습니다.', 'success');
    } catch (err) {
      showToast('재생성 실패: ' + err.message, 'error');
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  };
}

if (!window.copyPlanText) {
  window.copyPlanText = function (btn) {
    const container = btn.closest('.script-plan-result');
    const sections = container.querySelectorAll('.skeleton-content > div');
    let text = "";
    sections.forEach(s => text += s.innerText + "\n");
    navigator.clipboard.writeText(text).then(() => {
      const original = btn.innerText;
      btn.innerText = "✅ 복사 완료!";
      setTimeout(() => btn.innerText = original, 2000);
    });
  };
}

if (!window.toggleTitleSelection) {
  window.toggleTitleSelection = async function (el) {
    const list = el.closest('.hooking-titles-list');
    if (!list) return;

    // UI Selection
    const items = list.querySelectorAll('.hooking-title-item');
    items.forEach(item => {
      item.style.background = 'rgba(255,255,255,0.03)';
      item.style.borderColor = 'var(--danger)';
      item.querySelector('.check-mark').style.opacity = '0';
      item.classList.remove('selected');
    });
    el.style.background = 'rgba(var(--success-rgb), 0.1)';
    el.style.borderColor = 'var(--success)';
    el.querySelector('.check-mark').style.opacity = '1';
    el.classList.add('selected');

    // Trigger Skeleton Generation
    const suggestionItem = el.closest('.suggestion-item');
    const resultArea = suggestionItem.querySelector('.script-plan-result');
    const placeholder = resultArea.querySelector('.skeleton-placeholder');
    const loading = resultArea.querySelector('.skeleton-loading');
    const result = resultArea.querySelector('.skeleton-result');
    const redoBtn = resultArea.querySelector('.redo-skeleton-btn');
    const actionButtons = resultArea.querySelector('.action-buttons');

    const selectedTitle = el.querySelector('span').innerText;
    const keywords = (suggestionItem.dataset.keywords || '').split(',').filter(k => k.trim());
    const catX = suggestionItem.dataset.catx;
    const catY = suggestionItem.dataset.caty;
    const groupX = suggestionItem.dataset.groupx;
    const groupY = suggestionItem.dataset.groupy;

    placeholder.style.display = 'none';
    result.style.display = 'none';
    loading.style.display = 'block';

    try {
      const api = suggestionItem._api || window.__gapApi || window.__lastDeepGapParams?.api;
      if (!api) {
        console.error('[toggleTitleSelection] API 인스턴스 누락. suggestionItem:', suggestionItem);
        throw new Error('API 인스턴스를 찾을 수 없습니다.');
      }

      const isEconomy = (groupX === '경제(메인)' || groupY === '경제(메인)');
      const plan = await api.generateScriptPlan({
        title: selectedTitle,
        keywords, catX, catY, groupX, groupY,
        type: isEconomy ? 'economy' : 'skeleton'
      });

      if (!plan || !plan.script_skeleton) throw new Error('뼈대 생성에 실패했습니다.');

      const content = result.querySelector('.skeleton-content');
      const diffArea = result.querySelector('.differentiation-text');

      diffArea.innerText = '* ' + plan.differentiation;

      // 경제 전용 5파트 구조 렌더링
      if (plan.isEconomyFormat && plan.script_skeleton.five_parts) {
        const sk = plan.script_skeleton;
        content.innerHTML = `
    < div style = "margin-bottom:16px; padding:12px; background:rgba(99,102,241,0.08); border-radius:10px; border-left:4px solid #6366f1;" >
            <div style="font-weight:800; color:#a5b4fc; font-size:0.85rem; margin-bottom:4px;">📌 핵심 메시지</div>
            <div style="font-size:0.95rem; color:var(--text-primary); line-height:1.6;">${sk.core_message || ''}</div>
          </div >

    <div style="font-weight:800; color:#60a5fa; font-size:0.85rem; margin-bottom:8px; margin-top:16px;">📊 5파트 구조 설계</div>
          ${(sk.five_parts || []).map((p, i) => {
          const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#6366f1'];
          return `<div style="margin-bottom:14px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border-left:4px solid ${colors[i]};">
              <div style="font-weight:800; color:${colors[i]}; font-size:0.82rem; margin-bottom:6px;">파트 ${p.part_number}: ${p.purpose}</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.6;">
                <div>🎭 <strong>감정:</strong> ${p.viewer_emotion}</div>
                <div>📈 <strong>공개 데이터:</strong> ${p.data_to_reveal}</div>
                <div>🔒 <strong>숨길 정보:</strong> ${p.hidden_info}</div>
                <div>⚡ <strong>긴장 장치:</strong> ${p.tension_device}</div>
                <div>🪝 <strong>엔딩 훅:</strong> <em>"${p.ending_hook}"</em></div>
              </div>
            </div>`;
        }).join('')
          }

          ${sk.data_slots ? `
          <div style="font-weight:800; color:#60a5fa; font-size:0.85rem; margin-bottom:8px; margin-top:16px;">📋 데이터 슬롯</div>
          <div style="padding:10px; background:rgba(59,130,246,0.06); border-radius:8px; font-size:0.78rem; color:var(--text-secondary); line-height:1.8;">
            ${Object.entries(sk.data_slots).map(([key, vals]) =>
            `<div><strong style="color:#60a5fa;">${key}:</strong> ${(Array.isArray(vals) ? vals : [vals]).join(' / ')}</div>`
          ).join('')}
          </div>` : ''
          }

          ${sk.emotion_curve ? `
          <div style="font-weight:800; color:#60a5fa; font-size:0.85rem; margin-bottom:8px; margin-top:16px;">🎭 감정 곡선</div>
          <div style="padding:10px; background:rgba(234,179,8,0.06); border-radius:8px; font-size:0.78rem; line-height:1.8;">
            <div>도입 긴장: <strong style="color:#ef4444;">${sk.emotion_curve.intro_tension}</strong></div>
            <div>중반 재점화: ${sk.emotion_curve.mid_refire_point}</div>
            <div>분석 안정도: <strong style="color:#22c55e;">${sk.emotion_curve.analysis_stability}</strong></div>
            <div>마지막 불확실성: <strong style="color:#f97316;">${sk.emotion_curve.final_uncertainty}</strong></div>
          </div>` : ''
          }

          ${sk.algorithm_design ? `
          <div style="font-weight:800; color:#60a5fa; font-size:0.85rem; margin-bottom:8px; margin-top:16px;">🎯 조회수 알고리즘</div>
          <div style="padding:10px; background:rgba(99,102,241,0.06); border-radius:8px; font-size:0.78rem; line-height:1.8;">
            <div>🔥 초반 30초: ${sk.algorithm_design.first_30sec_hook}</div>
            <div>⏳ 정보 지연: ${sk.algorithm_design.info_delay_method}</div>
            <div>♻️ 중반 재점화: ${sk.algorithm_design.mid_refire_method}</div>
            <div>🛡️ 시청 지속률: ${sk.algorithm_design.retention_defense}</div>
          </div>` : ''
          }

          ${sk.claude_guide ? `
          <div style="font-weight:800; color:#60a5fa; font-size:0.85rem; margin-bottom:8px; margin-top:16px;">🤖 클로드 각색 가이드</div>
          <div style="padding:10px; background:rgba(34,197,94,0.06); border-radius:8px; font-size:0.78rem; line-height:1.8;">
            <div>🎙️ 톤: ${sk.claude_guide.tone}</div>
            <div>❓ 질문 위치: ${(sk.claude_guide.question_points || []).join(' → ')}</div>
            <div>📊 데이터 타이밍: ${(sk.claude_guide.data_timing || []).join(' → ')}</div>
            <div>🚫 제한: ${(sk.claude_guide.restrictions || []).join(', ')}</div>
          </div>` : ''
          }
  `;
      } else {
        // 기존 야담 7단계 구조
        content.innerHTML = `
          <div><strong style="color:var(--danger);">[1. 충격]</strong> ${plan.script_skeleton.step1_shock || plan.script_skeleton.intro}</div>
          <div><strong style="color:var(--warning);">[2. 의심]</strong> ${plan.script_skeleton.step2_doubt || plan.script_skeleton.development}</div>
          <div><strong style="color:var(--accent);">[3. 갈등]</strong> ${plan.script_skeleton.step3_conflict || ''}</div>
          <div><strong style="color:var(--accent-light);">[4. 단서]</strong> ${plan.script_skeleton.step4_clue || ''}</div>
          <div><strong style="color:var(--success);">[5. 조짐]</strong> ${plan.script_skeleton.step5_flash || plan.script_skeleton.climax}</div>
          <div><strong style="color:var(--danger);">[6. 반전]</strong> ${plan.script_skeleton.step6_truth || ''}</div>
          <div><strong style="color:var(--text-muted);">[7. 여운]</strong> ${plan.script_skeleton.step7_resonance || plan.script_skeleton.conclusion}</div>
  `;
      }

      loading.style.display = 'none';
      result.style.display = 'block';
      redoBtn.style.display = 'block';
      actionButtons.style.display = 'flex';

      showToast(isEconomy ? '경제 전용 5파트 고밀도 대본 뼈대가 완성되었습니다!' : '주제에 맞춘 새로운 7단계 뼈대가 완성되었습니다!', 'success');
    } catch (err) {
      loading.style.display = 'none';
      placeholder.style.display = 'block';
      showToast('뼈대 생성 실패: ' + err.message, 'error');
    }
  };
}

if (!window.downloadScriptPlan) {
  window.downloadScriptPlan = function (btn) {
    const container = btn.closest('.script-plan-result');
    const suggestionItem = btn.closest('.suggestion-item');
    const originalTitle = suggestionItem.dataset.title;
    const selectedTitleEl = container.querySelector('.hooking-title-item.selected');
    const selectedTitle = selectedTitleEl ? selectedTitleEl.querySelector('span').innerText : '(미선택)';
    const keywords = Array.from(container.querySelectorAll('.tag.danger')).map(tag => tag.innerText).join(', ');
    const differentiation = container.querySelector('div[style*="font-size:0.78rem"]').innerText;
    const skeletonDivs = container.querySelectorAll('.skeleton-content > div');
    let skeletonText = "";
    skeletonDivs.forEach(div => skeletonText += div.innerText + "\n");

    const content = `[유튜브 기획안 리포트]\n\n` +
      `원본 주제: ${originalTitle} \n` +
      `선택한 썸네일 제목: ${selectedTitle} \n\n` +
      `🎯 SEO 키워드: ${keywords} \n\n` +
      `💡 차별화 포인트: \n${differentiation} \n\n` +
      `📜 대본 뼈대(기승전결): \n${skeletonText} \n` +
      `------------------------------\n` +
      `생성 일시: ${new Date().toLocaleString()} \n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileTitle = (selectedTitleEl ? selectedTitle : originalTitle).replace(/[\/\\:*?"<>|]/g, '_');
    link.download = `기획안_${fileTitle}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('기획안이 TXT 파일로 다운로드되었습니다.', 'success');
  };
}

if (!window.toggleListMagnify) {
  window.toggleListMagnify = function (btn) {
    const list = btn.closest('.chart-container').querySelector('[id$="-list"]');
    if (!list) return;
    const items = list.querySelectorAll('.suggestion-item');
    const isEnlarged = list.classList.toggle('font-large-list');

    items.forEach(item => {
      const title = item.querySelector('.suggestion-title');
      const reason = item.querySelector('div[style*="font-size:0.83rem"]');
      const tags = item.querySelectorAll('.tag');

      if (isEnlarged) {
        if (title) title.style.fontSize = '1.4rem';
        if (reason) reason.style.fontSize = '1.1rem';
        tags.forEach(t => t.style.fontSize = '0.95rem');
      } else {
        if (title) title.style.fontSize = '1.1rem';
        if (reason) reason.style.fontSize = '0.83rem';
        tags.forEach(t => t.style.fontSize = '0.75rem');
      }
    });
    btn.innerHTML = isEnlarged ? '🔍 축소하기' : '🔍 글씨 전체 크게';
  };
}

if (!window.copyAllKeywords) {
  window.copyAllKeywords = function (btn) {
    const list = btn.closest('.chart-container').querySelector('[id$="-list"]');
    if (!list) return;
    const items = list.querySelectorAll('.suggestion-item');
    const allKeywordsSet = new Set();
    items.forEach(item => {
      const tags = item.querySelectorAll('.tag');
      tags.forEach(tag => {
        const kw = tag.innerText.replace('#', '').trim();
        if (kw) allKeywordsSet.add(kw);
      });
    });
    const textToCopy = Array.from(allKeywordsSet).join(', ');
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ 전체 복사됨!';
      btn.style.color = 'var(--success)';
      setTimeout(() => { btn.innerHTML = originalText; btn.style.color = ''; }, 2000);
    });
  };
}

function renderEconomyTrends(data, api, targetEl) {
  renderEconomyV3(api, targetEl, data);
}

// --- 구형 경제 분석 로직 소거 완료 (Economy v3로 일원화) ---

/**
 * [Economy v3] 3단계 고도화 분석 메인 렌더러
 */
async function renderEconomyV3(api, targetEl, initialData = null) {
  const el = targetEl || document.getElementById('gap-results');
  el.innerHTML = `
    <div class="animation-fade-in" style="display:flex; flex-direction:column; gap:24px;">
      
      <!--상단 컨트롤 바-->
      <div class="chart-container" style="border:1px solid rgba(59,130,246,0.3); background:rgba(13,17,23,0.6); padding:16px 24px; border-radius:16px; backdrop-filter:blur(8px);">
        <div class="flex-between" style="align-items:center; flex-wrap:wrap; gap:20px;">
          <div>
            <h4 style="margin:0; color:#60a5fa; font-size:1.25rem; font-weight:800; letter-spacing:-0.02em;">🔬 경제 고도화 심층 분석 엔진 <span style="font-size:0.7rem; vertical-align:middle; background:#3b82f6; color:white; padding:2px 6px; border-radius:4px; margin-left:6px; opacity:0.8;">V3</span></h4>
            <p style="margin:6px 0 0 0; font-size:0.85rem; color:var(--text-muted); opacity:0.8;">등록 채널 떡상 데이터 분석 · AI 차별화 주제 제안 · 고성능 대본 뼈대 구성</p>
          </div>
          <div class="flex gap-12" style="align-items:center;">
             <select id="v3-period-select" class="btn btn-secondary" style="background:#161b22; border:1px solid rgba(255,255,255,0.1); height:42px; padding:0 12px; font-weight:600; font-size:0.9rem; border-radius:10px;">
               <option value="3" selected>최근 3일 분석</option>
               <option value="7">최근 7일 분석</option>
             </select>
             <button id="v3-analyze-btn" class="btn btn-primary" style="background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border:none; height:42px; padding:0 20px; font-weight:700; font-size:0.95rem; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 12px rgba(37,99,235,0.3); white-space:nowrap; min-width:fit-content;">
               <span>🚀</span> 경제 분석 실행
             </button>
          </div>
        </div>
      </div>

      <!--2단 가로 레이아웃 (야담 스타일)-->
      <div style="display:grid; grid-template-columns: 350px 1fr; gap:24px; align-items: start; min-height:800px;">

        <!-- 좌측: 1단계 핫 이슈 키워드 랭킹 -->
        <div id="v3-ranking-column" class="chart-container" style="position:sticky; top:20px; padding:20px; background:rgba(13,17,23,0.4); border-radius:16px; border:1px solid rgba(255,255,255,0.05);">
          <h5 style="margin:0 0 14px 0; color:#818cf8; font-size:1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">🔥</span> 핫 이슈 키워드 랭킹
          </h5>
          <div id="v3-keyword-list" style="display:flex; flex-direction:column; gap:12px;">
            ${initialData ? '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.8rem;">데이터 복원 중...</div>' : `
            <div style="text-align:center; padding:30px 16px; color:var(--text-muted); font-size:0.85rem; border:1px dashed rgba(255,255,255,0.1); border-radius:12px;">
              분석 버튼을 누르면<br>키워드를 추출합니다.
            </div>
            `}
          </div>
        </div>

        <!-- 우측: 2단계 주제 추천 및 3단계 뼈대 (통합 구역) -->
        <div id="v3-topics-area" class="chart-container" style="padding:24px; background:rgba(13,17,23,0.4); border-radius:16px; border:1px solid rgba(129,140,248,0.1);">
          <h5 style="margin:0 0 16px 0; color:#a5b4fc; font-size:1.1rem; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.3rem;">🎯</span> AI 차별화 주제 추천 & 대본 설계
          </h5>
          <div id="v3-topic-list" style="display:flex; flex-direction:column; gap:20px;">
            <div style="text-align:center; padding:50px 16px; color:var(--text-muted); font-size:1rem; border:1px dashed rgba(255,255,255,0.1); border-radius:16px;">
              좌측 키워드 랭킹에서 관심 있는 주제의 <b>'AI 추천 받기'</b> 버튼을 클릭하세요.
            </div>
          </div>
        </div>

      </div>
    </div>
    </div>
    `;

  // 이벤트 바인딩
  const analyzeBtn = el.querySelector('#v3-analyze-btn');
  const periodSel = el.querySelector('#v3-period-select');

  analyzeBtn.addEventListener('click', () => runEconomyAnalysisV3(api, periodSel.value));

  // 초기 데이터가 있으면 바로 렌더링
  if (initialData) {
    displayEconomyResultsV3(initialData, api);
  }
}

/**
 * 전용 유틸: 기존 데이터 UI 표시 전용
 */
function displayEconomyResultsV3(data, api) {
  const rankingList = document.getElementById('v3-keyword-list');
  if (!rankingList) return;

  let messageHtml = '';
  if (data.error) {
    messageHtml += `<div style="font-size:0.85rem; color:#ef4444; padding:12px 16px; background:rgba(239,68,68,0.1); border-radius:10px; border:1px solid rgba(239,68,68,0.2); margin-bottom:16px; line-height:1.5;">🛑 <b>분석 엔진 경고:</b><br>${data.error}</div>`;
  }
  if (data.message) {
    const msgColor = data.keywords?.length > 0 ? '#3b82f6' : '#f59e0b';
    messageHtml += `<div style="font-size:0.75rem; color:${msgColor}; padding:10px 14px; background:rgba(255,165,0,0.05); border-radius:8px; border:1px solid rgba(255,165,0,0.1); margin-bottom:12px; line-height:1.4;">💡 ${data.message}</div>`;
  }

  rankingList.innerHTML = messageHtml;

  // Persistence: Sub-step restoration (Nested UI 지원)
  if (data.subSteps) {
    if (data.subSteps.topics) {
      setTimeout(() => {
        const kw = data.keywords.find(k => k.keyword === data.subSteps.selectedKeyword) || data.keywords[0];
        renderEconomyTopicsV3(api, data.subSteps.topics, kw);

        if (data.subSteps.thumbnails) {
          // 저장된 인덱스 또는 제목으로 해당 토픽 아이템 찾기
          const topicItems = document.querySelectorAll('.v3-topic-item');
          let targetItem = null;
          topicItems.forEach(item => {
            if (item.innerText.includes(data.subSteps.thumbnails.topicTitle)) targetItem = item;
          });

          if (targetItem) {
            targetItem.querySelector('.v3-details-container').style.display = 'block';
            targetItem.style.background = 'rgba(99,102,241,0.05)';
            targetItem.style.borderColor = 'rgba(99,102,241,0.2)';
            renderEconomyThumbnailsV3(api, data.subSteps.thumbnails.titles, kw, data.subSteps.thumbnails.topicTitle, targetItem);

            if (data.subSteps.skeleton) {
              renderEconomyFinalSkeletonV3(api, data.subSteps.skeleton.res, data.subSteps.skeleton.selectedTitle, kw, targetItem);
            }
          }
        }
      }, 100);
    }
  }

  if (!data.keywords || data.keywords.length === 0) {
    rankingList.innerHTML += `<div class="empty-state">검사된 영상 중 분석 가능한 주제가 발견되지 않았습니다.</div>`;
    return;
  }

  const fmtNum = (n) => n >= 10000 ? (n / 10000).toFixed(1) + '만' : n.toLocaleString();
  const fmtDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 아코디언 스타일 주입
  if (!document.getElementById('v3-accordion-style')) {
    const style = document.createElement('style');
    style.id = 'v3-accordion-style';
    style.innerHTML = `
      .v3-keyword-item { margin-bottom: 12px; overflow: hidden; }
      .v3-keyword-header { padding: 16px; cursor: pointer; transition: background 0.2s; }
      .v3-keyword-header:hover { background: rgba(255,255,255,0.03); }
      .v3-keyword-details {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-out, padding 0.3s ease;
        background: rgba(0,0,0,0.2);
        padding: 0 16px;
      }
      .v3-keyword-item.open .v3-keyword-details {
        max-height: 1000px;
        padding: 16px;
        border-top: 1px solid rgba(255,255,255,0.05);
      }
      .v3-video-link {
        display: block;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        text-decoration: none;
        transition: opacity 0.2s;
      }
      .v3-video-link:hover { opacity: 0.8; }
      .v3-video-link:last-child { border-bottom: none; }
      
      .v3-suggest-btn {
        width: 100%;
        margin-top: 12px;
        padding: 10px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 800;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      .v3-suggest-btn:hover { background: #2563eb; }
    `;
    document.head.appendChild(style);
  }

  rankingList.innerHTML += data.keywords.map((kw, i) => `
    <div class="v3-keyword-item card" data-idx="${i}" style="background:rgba(22,27,34,0.6); border:1px solid rgba(255,255,255,0.05); border-radius:12px; transition:all 0.2s ease;">
          <div class="v3-keyword-header" style="padding:12px 14px;">
            <div class="flex-between" style="align-items:center; gap:8px; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:8px; flex: 1; min-width: 0;">
                <span style="font-size:1rem; font-weight:900; color:#3b82f6; opacity:0.9; flex-shrink:0;">${i + 1}</span>
                <span title="${kw.keyword.replace(/"/g, '&quot;')}" style="font-size:1.05rem; font-weight:800; color:#e2e8f0; letter-spacing:-0.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${kw.keyword}</span>
              </div>
              <div style="background:rgba(239,68,68,0.1); color:#ef4444; font-size:0.65rem; font-weight:800; padding:3px 8px; border-radius:100px; border:1px solid rgba(239,68,68,0.2); white-space:nowrap; flex-shrink:0;">떡상 ${kw.hit_count}</div>
            </div>
            <div class="flex gap-10" style="font-size:0.7rem; color:var(--text-muted); opacity:0.65; font-weight:600;">
              <span style="display:flex; align-items:center; gap:3px;">📊 평균 ${fmtNum(kw.avg_views)}</span>
              <span style="display:flex; align-items:center; gap:3px;">🔥 최대 ${fmtNum(kw.max_views)}</span>
            </div>
          </div>

          <div class="v3-keyword-details">
            <div style="font-size:0.7rem; color:#60a5fa; font-weight:800; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">📈 모든 떡상 영상 (${kw.videos.length})</div>
            <div style="max-height: 300px; overflow-y: auto; padding-right: 4px;">
              ${kw.videos.map(v => `
                <a href="https://www.youtube.com/watch?v=${v.video_id}" target="_blank" class="v3-video-link">
                  <div style="font-size:0.82rem; color:#fff; font-weight:700; margin-bottom:4px; line-height:1.4;">${v.title}</div>
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; opacity:0.6;">
                    <span style="color:#22c55e;">👁️ ${fmtNum(v.view_count)}</span>
                    <span>${v.channel_name} · ${fmtDate(v.published_at)}</span>
                  </div>
                </a>
              `).join('')}
            </div>
            <button class="v3-suggest-btn" data-idx="${i}">💡 AI 차별화 주제 추천 받기</button>
          </div>
        </div>
  `).join('');

  // 이벤트 리스너: 아코디언 토글
  rankingList.querySelectorAll('.v3-keyword-header').forEach((header, idx) => {
    header.addEventListener('click', () => {
      const item = header.closest('.v3-keyword-item');
      const isOpen = item.classList.contains('open');

      // 다른 항목 닫기
      rankingList.querySelectorAll('.v3-keyword-item').forEach(el => {
        el.classList.remove('open');
        el.style.borderColor = 'rgba(255,255,255,0.05)';
      });

      if (!isOpen) {
        item.classList.add('open');
        item.style.borderColor = '#3b82f6';
      }
    });
  });

  // 이벤트 리스너: 주제 추천 버튼
  rankingList.querySelectorAll('.v3-suggest-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // 아코디언 토글 방지
      const idx = btn.dataset.idx;
      handleKeywordClickV3(api, data.keywords[idx]);
    });
  });
}

/**
 * 1단계: 분석 실행 및 랭킹 렌더링
 */
async function runEconomyAnalysisV3(api, period) {
  const rankingList = document.getElementById('v3-keyword-list');
  const analyzeBtn = document.getElementById('v3-analyze-btn');

  rankingList.innerHTML = `
  <div style="text-align:center; padding:30px 16px;">
      <div class="spinner-sm mb-16" style="margin:0 auto; border-top-color:#3b82f6; width:28px; height:28px; border-width:3px;"></div>
      <div style="font-size:0.9rem; color:#60a5fa; font-weight:700;">등록 채널 & 유튜브 실시간 트렌드 통합 분석 중...</div>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">최신 떡상 데이터를 전수 조사하고 있습니다.</div>
    </div>
  `;
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<div class="spinner-sm" style="border-top-color:white;"></div> 분석 중...';

  try {
    const data = await api.getEconomyRealtimeV3({ period });
    displayEconomyResultsV3(data, api);
    updateStoredState({ economyStatus: 'SUCCESS', economyData: data });
  } catch (err) {
    updateStoredState({ economyStatus: 'IDLE' });
    rankingList.innerHTML = `<div class="empty-state">❌ 오류: ${err.message}</div> `;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '🚀 경제 분석 실행';
  }
}

/**
 * 2단계: 키워드 클릭 시 주제 추천
 */
async function handleKeywordClickV3(api, kwData) {
  const topicList = document.getElementById('v3-topic-list');
  const skeletonArea = document.getElementById('v3-skeleton-content');

  topicList.innerHTML = `
    <div style="text-align:center; padding:60px 16px;">
      <div class="spinner-sm mb-16" style="margin:0 auto; border-top-color:#818cf8; width:40px; height:40px; border-width:4px;"></div>
      <div style="font-size:1.1rem; color:#a5b4fc; font-weight:800;">데이터 사각지대 및 새로운 관점 분석 중...</div>
    </div>
  `;

  try {
    const res = await api.suggestEconomyTopicsV3({
      keyword: kwData.keyword,
      existingVideos: kwData.videos.map(v => ({ title: v.title, view_count: v.view_count }))
    });

    if (!res || !res.suggestions || res.suggestions.length === 0) {
      topicList.innerHTML = `<div style="grid-column:1/-1;" class="empty-state">추천 결과가 없습니다.</div>`;
      return;
    }

    // Persistence: Save topic results
    const s = getStoredState();
    if (s.economyData) {
      s.economyData.subSteps = s.economyData.subSteps || {};
      s.economyData.subSteps.topics = res;
      s.economyData.subSteps.selectedKeyword = kwData.keyword;
      updateStoredState({ economyData: s.economyData });
    }

    renderEconomyTopicsV3(api, res, kwData);
  } catch (err) {
    topicList.innerHTML = `<div style="grid-column:1/-1;" class="empty-state">❌ 오류: ${err.message}</div>`;
  }
}

function renderEconomyTopicsV3(api, res, kwData) {
  const topicList = document.getElementById('v3-topic-list');
  if (!topicList) return;

  topicList.innerHTML = `
    <div style="font-size:0.9rem; color:#818cf8; background:rgba(129,140,248,0.1); padding:12px 16px; border-radius:12px; margin-bottom:16px; border:1px solid rgba(129,140,248,0.25); display:flex; align-items:center; justify-content:space-between; gap:10px; line-height:1.5;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:1.3rem;">📢</span> <span><b>시장 인사이트:</b> ${res.angle_analysis}</span>
      </div>
      <button id="v3-topics-refresh-btn" class="btn" style="padding:6px 12px; font-size:0.8rem; background:rgba(129,140,248,0.15); border:1px solid rgba(129,140,248,0.3); color:#a5b4fc; border-radius:8px; display:flex; align-items:center; gap:6px; font-weight:700; transition:all 0.2s;">
        🔄 주제 다시 추천받기
      </button>
    </div>
    ${res.suggestions.map((s, idx) => `
      <div class="v3-topic-item card clickable-v3-topic" 
           style="padding:20px; background:rgba(22,27,34,0.7); border-left:6px solid #6366f1; cursor:pointer; border-radius:16px; transition:all 0.25s ease; border:1px solid rgba(255,255,255,0.03); margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div style="flex:1;">
            <div style="font-size:0.8rem; color:#818cf8; margin-bottom:6px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em;">추천 주제 ${idx + 1} · ${s.target_audience}</div>
            <div title="${s.title.replace(/"/g, '&quot;')}" style="font-size:1.2rem; font-weight:900; color:#e2e8f0; line-height:1.4; letter-spacing:-0.02em;">${s.title}</div>
          </div>
          <div class="v3-click-arrow" style="font-size:0.9rem; color:#6366f1; font-weight:800; opacity:0.8; transition:all 0.2s;">CLICK ⌵</div>
        </div>
        <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.6; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:10px; margin-bottom:0;">
          <span style="color:#a5b4fc; font-weight:800;">💡 차별화 전략:</span> ${s.differentiation_reason}
        </div>
        
        <!-- 하위 결과 출력용 컨테이너 (야담 스타일) -->
        <div class="v3-details-container" style="display:none; margin-top:20px; border-top:1px dashed rgba(99,102,241,0.3); padding-top:20px;">
          <div class="v3-internal-loader" style="text-align:center; padding:20px; display:none;">
            <div class="spinner-sm mb-8" style="margin:0 auto; border-top-color:#3b82f6;"></div>
            <div style="font-size:0.8rem; color:#60a5fa;">분석 중...</div>
          </div>
          <div class="v3-internal-content"></div>
        </div>
      </div>
    `).join('')}
  `;

  // [고도화] 주제 다시 추천받기 버튼 이벤트
  const topicRefreshBtn = topicList.querySelector('#v3-topics-refresh-btn');
  if (topicRefreshBtn) {
    topicRefreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleKeywordClickV3(api, kwData);
    });
  }

  // [고도화] 내부 클릭 시 아코디언이 접히지 않도록 방지 (Event Bubbling 차단)
  topicList.querySelectorAll('.v3-details-container').forEach(details => {
    details.addEventListener('click', (e) => e.stopPropagation());
  });

  topicList.querySelectorAll('.clickable-v3-topic').forEach((item, idx) => {
    item.addEventListener('click', (e) => {
      const details = item.querySelector('.v3-details-container');
      const arrow = item.querySelector('.v3-click-arrow');
      const isVisible = details.style.display === 'block';

      if (isVisible) {
        // 접기 (Collapse) - 상태는 유지됨 (HTML이 DOM에 존재)
        details.style.display = 'none';
        item.style.background = 'rgba(22,27,34,0.7)';
        item.style.borderColor = 'rgba(255,255,255,0.03)';
        if (arrow) arrow.innerText = 'CLICK ⌵';
      } else {
        // 펼치기 (Expand)
        // 강조 효과
        topicList.querySelectorAll('.v3-topic-item').forEach(el => {
          el.style.background = 'rgba(22,27,34,0.7)';
          el.style.borderColor = 'rgba(255,255,255,0.03)';
        });
        item.style.background = 'rgba(99,102,241,0.05)';
        item.style.borderColor = 'rgba(99,102,241,0.2)';
        details.style.display = 'block';
        if (arrow) arrow.innerText = 'CLOSE ▴';

        // 내용이 비어있고 + 로딩 중도 아닐 때만(진짜 최초 클릭 시) 분석 시작
        const content = item.querySelector('.v3-internal-content');
        const loader = item.querySelector('.v3-internal-loader');
        if (!content.innerHTML.trim() && loader.style.display !== 'block') {
          handleThumbnailClickV3(api, res.suggestions[idx], kwData, item);
        }
      }
    });
  });

  topicList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * 2.5단계: 썸네일 제목 후보 추천 및 선택
 */
async function handleThumbnailClickV3(api, suggestion, kwData, parentItem) {
  const topicTitle = suggestion.title;
  const loader = parentItem.querySelector('.v3-internal-loader');
  const content = parentItem.querySelector('.v3-internal-content');

  loader.style.display = 'block';
  content.innerHTML = '';
  content.style.display = 'none';

  try {
    const res = await api.getThumbnailTitlesV3({
      topicTitle,
      keyword: kwData.keyword,
      existingTitles: kwData.videos.map(v => v.title)
    });

    const titles = [topicTitle, ...(res.candidates || []).filter(t => t !== topicTitle)].slice(0, 10);

    // Persistence: Save state
    const s = getStoredState();
    if (s.economyData) {
      s.economyData.subSteps = s.economyData.subSteps || {};
      s.economyData.subSteps.thumbnails = { titles, topicTitle };
      updateStoredState({ economyData: s.economyData });
    }

    renderEconomyThumbnailsV3(api, titles, kwData, suggestion, parentItem);
  } catch (err) {
    loader.style.display = 'none';
    content.style.display = 'block';
    content.innerHTML = `<div class="empty-state" style="padding:10px; font-size:0.8rem;">❌ 오류: ${err.message}</div>`;
  }
}

function renderEconomyThumbnailsV3(api, titles, kwData, suggestion, parentItem) {
  const topicTitle = suggestion.title;
  const loader = parentItem.querySelector('.v3-internal-loader');
  const content = parentItem.querySelector('.v3-internal-content');
  if (!content || !loader) return;

  // 로딩 숨기고 콘텐츠 표시
  loader.style.display = 'none';
  content.style.display = 'block';

  // 현재 선택된 제목 확인 (이미 체크된 게 있다면 유지)
  const currentChecked = content.querySelector('input[name="v3-selected-title"]:checked')?.value;

  content.innerHTML = `
    <div class="animation-fade-in" style="padding:10px 0;">
      <div style="margin-bottom:20px;">
        <h6 style="color:#60a5fa; font-weight:800; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span style="display:flex; align-items:center; gap:8px;">🎬 확정할 제목을 체크하세요 (체크 시 대본 생성)</span>
          <button id="v3-titles-refresh-btn" class="btn" style="padding:4px 10px; font-size:0.75rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#94a3b8; display:flex; align-items:center; gap:4px; transition:all 0.2s;">
            🔄 다시 추천받기
          </button>
        </h6>
        
        <div class="v3-thumbnail-selector" style="display:flex; flex-direction:column; gap:10px;">
          ${titles.map((t, i) => {
    const isChecked = currentChecked === t;
    const bg = isChecked ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)';
    const border = isChecked ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)';
    return `
              <label class="thumbnail-candidate-item" style="display:flex; align-items:center; gap:12px; padding:16px; background:${bg}; border:1px solid ${border}; border-radius:12px; cursor:pointer; transition:all 0.2s;">
                <input type="checkbox" name="v3-selected-title" value="${t.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''} style="width:20px; height:20px; accent-color:#3b82f6;">
                <span title="${t.replace(/"/g, '&quot;')}" style="font-size:1.05rem; font-weight:800; color:#e2e8f0; line-height:1.4;">${t}</span>
              </label>
            `;
  }).join('')}
        </div>
      </div>
      <div class="v3-final-skeleton-inner">
        <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.9rem; border:1px dashed rgba(255,255,255,0.05); border-radius:12px;">
          위 제목 중 하나를 체크하시면 대본이 완성됩니다.
        </div>
      </div>
    </div>
  `;

  // 다시 추천받기 이벤트
  const refreshBtn = content.querySelector('#v3-titles-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleThumbnailClickV3(api, suggestion, kwData, parentItem);
    });
  }

  content.querySelectorAll('input[name="v3-selected-title"]').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      content.querySelectorAll('input[name="v3-selected-title"]').forEach(cb => { if (cb !== input) cb.checked = false; });

      content.querySelectorAll('.thumbnail-candidate-item').forEach(el => {
        el.style.background = 'rgba(255,255,255,0.03)';
        el.style.borderColor = 'rgba(255,255,255,0.05)';
      });
      const label = input.closest('.thumbnail-candidate-item');
      label.style.background = 'rgba(59,130,246,0.1)';
      label.style.borderColor = 'rgba(59,130,246,0.3)';

      generateFinalSkeletonV3(api, input.value, kwData, parentItem, suggestion);
    });
  });
}

/**
 * 3단계: 선택한 제목 기반 최종 뼈대 생성
 */
async function generateFinalSkeletonV3(api, selectedTitle, kwData, parentItem, suggestion) {
  const diffReason = suggestion.differentiation_reason || '';
  const targetAudience = suggestion.target_audience || '';
  const conclusionType = suggestion.conclusion_type || '';
  const primaryAsset = suggestion.primary_asset || '';
  const forbiddenKeywords = suggestion.forbidden_keywords || [];
  const narrativeBlueprint = suggestion.narrative_blueprint || '';
  const innerArea = parentItem.querySelector('.v3-final-skeleton-inner');
  if (!innerArea) return;

  innerArea.innerHTML = `
    <div style="padding:40px; text-align:center;">
      <div class="spinner-sm mb-16" style="margin:0 auto; border-top-color:#3b82f6;"></div>
      <div style="font-size:0.85rem; color:#60a5fa;">'${selectedTitle.substring(0, 15)}...' 에 최적화된 대본 설계 중...</div>
    </div>
  `;

  try {
    const res = await api.generateScriptPlan({
      title: selectedTitle,
      keywords: [kwData.keyword],
      type: 'economy-v3',
      existingTitles: kwData.videos.map(v => v.title),
      top3Titles: kwData.videos.slice(0, 3).map(v => v.title),
      differentiation_reason: diffReason,
      target_audience: targetAudience,
      conclusion_type: conclusionType,
      primary_asset: primaryAsset,
      forbidden_keywords: forbiddenKeywords,
      narrative_blueprint: narrativeBlueprint
    });

    // Persistence: Save state
    const s = getStoredState();
    if (s.economyData) {
      s.economyData.subSteps = s.economyData.subSteps || {};
      s.economyData.subSteps.skeleton = { res, selectedTitle };
      updateStoredState({ economyData: s.economyData });
    }

    renderEconomyFinalSkeletonV3(api, res, selectedTitle, kwData, parentItem);
  } catch (err) {
    innerArea.innerHTML = `<div class="empty-state">❌ 오류: ${err.message}</div>`;
  }
}

function renderEconomyFinalSkeletonV3(api, res, selectedTitle, kwData, parentItem) {
  const innerArea = parentItem.querySelector('.v3-final-skeleton-inner');
  if (!innerArea) return;
  const sk = res.script_skeleton;

  innerArea.innerHTML = `
    <div class="animation-fade-in" style="padding:20px; background:rgba(37,99,235,0.02); border-radius:12px; border:1px solid rgba(59,130,246,0.1); margin-top:20px;">
        
        <div style="margin-bottom:24px; text-align:center; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:0.75rem; font-weight:700; color:#3b82f6; margin-bottom:6px;">📄 확정된 영상 제목</div>
          <div style="font-size:1.2rem; font-weight:900; color:#fff; line-height:1.4; margin-bottom:16px;">${selectedTitle}</div>
          
          <div style="text-align:left; background:rgba(255,255,255,0.02); padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:0.7rem; font-weight:800; color:#818cf8; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.05em;">💡 추가 추천 제목 (10선)</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              ${(sk.titles || []).map((t, idx) => `
                <div style="font-size:0.8rem; color:#cbd5e1; display:flex; gap:6px; line-height:1.4;">
                  <span style="color:#6366f1; font-weight:900;">${idx + 1}.</span>
                  <span>${t}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 오프닝 -->
        <div style="margin-bottom:24px; padding:16px; background:rgba(59,130,246,0.05); border-radius:12px; border-left:4px solid #3b82f6;">
          <div style="font-size:0.75rem; font-weight:700; color:#60a5fa; margin-bottom:8px;">🔥 15초 마법의 오프닝 (Hook)</div>
          <div style="font-size:1.0rem; line-height:1.6; color:#e2e8f0; font-weight:600;">"${sk.opening}"</div>
        </div>

        <!-- 본론 구성 -->
        <div style="margin-bottom:24px;">
           <div style="font-size:0.75rem; font-weight:700; color:#3b82f6; margin-bottom:12px;">📊 본론 전개 시나리오</div>
           <div style="display:flex; flex-direction:column; gap:12px;">
             ${sk.body_steps.map(step => `
               <div style="display:flex; gap:12px; padding:10px; background:rgba(255,255,255,0.02); border-radius:8px;">
                 <div style="width:24px; height:24px; border-radius:12px; background:#3b82f6; color:white; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:900; flex-shrink:0;">${step.step}</div>
                 <div style="flex:1;">
                   <div style="font-size:0.95rem; font-weight:700; color:#e2e8f0; margin-bottom:4px;">${step.message}</div>
                   <div style="font-size:0.8rem; color:#22c55e; font-weight:600;">💎 시청자 이득: ${step.benefit}</div>
                 </div>
               </div>
             `).join('')}
           </div>
        </div>

        <!-- 반전 및 데이터 -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
          <div style="background:rgba(239,68,68,0.05); padding:16px; border-radius:12px; border:1px solid rgba(239,68,68,0.15);">
            <div style="font-size:0.7rem; font-weight:700; color:#ef4444; margin-bottom:6px;">⚠️ 이탈 방지 Retention Point</div>
            <div style="font-size:0.88rem; color:#e2e8f0; line-height:1.5;">${sk.retention_insight}</div>
          </div>
          <div style="background:rgba(249,115,22,0.05); padding:16px; border-radius:12px; border:1px solid rgba(249,115,22,0.15);">
            <div style="font-size:0.7rem; font-weight:700; color:#f97316; margin-bottom:6px;">🔍 필수 체크 데이터</div>
            <ul style="margin:0; padding-left:16px; font-size:0.82rem; color:#e2e8f0; line-height:1.6;">
              ${sk.key_data_to_check.map(d => `<li>${d}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- 마침표 -->
        <div style="margin-bottom:30px; border-top:1px solid rgba(255,255,255,0.05); padding-top:20px;">
          <div style="font-size:0.75rem; font-weight:700; color:#3b82f6; margin-bottom:10px;">💡 클로징 및 행동 유도</div>
          <div style="font-size:0.95rem; color:#cbd5e1; font-style:italic; line-height:1.6;">
            "${sk.closing}"
          </div>
          <div style="margin-top:12px; font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
            <span>⏱️ 예상 영상 길이: <b>${sk.estimated_duration}</b></span>
          </div>
        </div>

        <!-- 최종 버튼 바 -->
        <div class="flex gap-12">
          <button id="v3-redo-btn" class="btn btn-secondary" style="flex:1; height:48px; border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700;">
            🔄 다시 만들기
          </button>
          <button id="v3-copy-btn" class="btn btn-primary" style="flex:1; height:48px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
            📄 전체 복사
          </button>
          <button id="v3-download-btn" class="btn btn-success" style="flex:1; height:48px; background:#059669; border:none; display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700;">
            📥 TXT 다운로드
          </button>
        </div>
    </div>
  `;

  // 복사 기능
  innerArea.querySelector('#v3-copy-btn').addEventListener('click', () => {
    const text = `
    [최종 선정 제목]: ${selectedTitle}

  [오프닝]
${sk.opening}

  [본론 전개]
${sk.body_steps.map(s => `${s.step}. ${s.message} (이득: ${s.benefit})`).join('\n')}

  [반전 / 인사이트]
${sk.retention_insight}

  [데이터 체크리스트]
    - ${sk.key_data_to_check.join('\n- ')}

  [클로징]
${sk.closing}

  [참고 정보]
영상 길이: ${sk.estimated_duration}
  `.trim();
    navigator.clipboard.writeText(text).then(() => {
      const btn = innerArea.querySelector('#v3-copy-btn');
      const old = btn.innerHTML;
      btn.innerHTML = '✅ 복사 완료!';
      setTimeout(() => btn.innerHTML = old, 2000);
    });
  });

  // 다운로드 기능
  innerArea.querySelector('#v3-download-btn').addEventListener('click', () => {
    const text = `
========================================
유튜브 경제 대본 기획안 (V3)
========================================

▶ 최종 선정 제목: ${selectedTitle}

----------------------------------------
1. 오프닝 (Hook)
----------------------------------------
${sk.opening}

----------------------------------------
2. 본론 전개 시나리오
----------------------------------------
${sk.body_steps.map(s => `STEP ${s.step}: ${s.message}\n(시청자 이득: ${s.benefit})`).join('\n\n')}

----------------------------------------
3. 반전 및 인사이트 (Retention)
----------------------------------------
${sk.retention_insight}

----------------------------------------
4. 필수 체크 데이터
----------------------------------------
${sk.key_data_to_check.map(d => `- ${d}`).join('\n')}

----------------------------------------
5. 클로징 및 CTA
----------------------------------------
${sk.closing}

----------------------------------------
[참고 데이터] 예상 영상 길이: ${sk.estimated_duration}
========================================
      `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `뼈대_${selectedTitle.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // 다시 만들기 기능
  innerArea.querySelector('#v3-redo-btn').addEventListener('click', () => {
    generateFinalSkeletonV3(api, selectedTitle, kwData, parentItem);
  });
}

// 글로벌 초기화 도우미
window.__forceResetAnalysis = function () {
  if (confirm('현재 진행 중인 분석 상태를 강제로 초기화할까요?\n(분석이 멈췄을 때만 사용하세요)')) {
    window.__activeDeepAnalysis = null;
    updateStoredState({ deepStatus: 'IDLE', deepParams: null, deepHtml: null });
    const area = document.getElementById('deep-analysis-area');
    if (area) area.innerHTML = '';
    showToast('분석 상태가 초기화되었습니다. 다시 시도해 주세요.', 'info');
  }
};

window.redoThemeSkeleton = (btn, selectedTitle, originalTopic) => {
  const resultArea = btn.closest('.theme-titles-result');
  const selectedEl = Array.from(resultArea.querySelectorAll('.theme-title-item')).find(el => el.querySelector('input').checked);
  if (typeof window.genThemeSkeleton === 'function') {
    window.genThemeSkeleton(selectedEl, selectedTitle, originalTopic);
  }
};

window.downloadThemeSkeleton = (btn, title) => {
  const card = btn.closest('.card');
  const sections = card.querySelectorAll('.skeleton-section');
  const climax = card.querySelector('.climax-note');

  let text = `[최종 대본 설계]\n제목: ${title}\n\n`;
  sections.forEach(s => {
    const cleanText = s.innerText.replace(/\n\s+/g, '\n').trim();
    text += `${cleanText}\n\n`;
  });
  if (climax) text += `\n${climax.innerText}\n`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
  a.download = `대본뼈대_${safeTitle}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('기획안이 TXT 파일로 다운로드되었습니다.', 'success');
};
