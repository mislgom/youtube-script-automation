// 떡상 DNA 분석 페이지
// 플로우: 수집 → DNA 분석 → 황금 키워드 → 제목 10개 추천 → 선택 → 대본 뼈대
import { showToast } from '../components/toast.js';

export async function renderDna(container, { api }) {
    container.innerHTML = `
    <div class="page-header">
      <h2>🧬 떡상 DNA 분석</h2>
      <p>떡상 영상의 공통 DNA를 추출하고, 황금 키워드로 후킹 제목과 대본 뼈대를 자동 생성합니다</p>
    </div>

    <div class="card mb-24" id="dna-control-card">
      <div class="flex gap-16" style="align-items:flex-end; flex-wrap:wrap;">
        <div class="input-group" style="flex:1.5; min-width:180px; margin-bottom:0;">
          <label>채널 선택 (미선택 시 전체)</label>
          <select id="dna-channel-select"><option value="">전체 채널</option></select>
        </div>
        <div class="input-group" style="flex:0.6; margin-bottom:0;">
          <label>TOP N</label>
          <select id="dna-topn">
            <option value="10">Top 10</option>
            <option value="20" selected>Top 20</option>
            <option value="30">Top 30</option>
          </select>
        </div>
        <div class="input-group" style="flex:0.6; margin-bottom:0;">
          <label>수집 기간</label>
          <select id="dna-days">
            <option value="30">최근 30일</option>
            <option value="90" selected>최근 90일</option>
            <option value="365">최근 1년</option>
            <option value="0">전체</option>
          </select>
        </div>
        <div class="input-group" style="flex:0.8; margin-bottom:0;">
          <label>카테고리</label>
          <select id="dna-category">
            <option value="야담">야담/역사</option>
            <option value="경제">경제/재테크</option>
            <option value="심리">심리/자기계발</option>
            <option value="기타">기타</option>
          </select>
        </div>
        <button class="btn btn-secondary" id="dna-collect-btn">📥 떡상 영상 수집</button>
      </div>
    </div>

    <!-- Step 1: 수집된 영상 목록 -->
    <div id="dna-spike-list" class="hidden mb-24"></div>

    <!-- Step 2: DNA 분석 실행 버튼 -->
    <div id="dna-analyze-section" class="hidden mb-24">
      <button class="btn btn-primary" id="dna-analyze-btn" style="font-size:1rem; padding:14px 28px; font-weight:800;">
        🧬 DNA 분석 실행
      </button>
    </div>

    <!-- Step 3: DNA 결과 (4탭) -->
    <div id="dna-result-section" class="hidden mb-24"></div>

    <!-- Step 4: 황금 키워드 -->
    <div id="dna-keywords-section" class="hidden mb-24"></div>

    <!-- Step 5: 제목 10개 추천 -->
    <div id="dna-titles-section" class="hidden mb-24"></div>

    <!-- Step 6: 대본 뼈대 -->
    <div id="dna-skeleton-section" class="hidden mb-24"></div>
  `;

    // API 메서드 체크
    if (!api.getDnaSpikes) {
        container.querySelector('#dna-control-card').innerHTML += `
      <div style="margin-top:12px; padding:10px; background:rgba(255,80,80,0.1); border-radius:8px; color:var(--danger); font-size:0.82rem;">
        ⚠ DNA API가 아직 등록되지 않았습니다. 서버를 재시작해주세요.
      </div>
    `;
    }

    let collectedSpikes = [];
    let currentDna = null;
    let currentGoldenKw = null;

    // 채널 목록 로드
    try {
        if (api.getDnaChannels) {
            const { channels } = await api.getDnaChannels();
            const sel = container.querySelector('#dna-channel-select');
            channels.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
        }
    } catch (e) { /* 무시 */ }

    // ─── 헬퍼 ───────────────────────────────────
    const $ = (id) => container.querySelector(id);

    function showSpinner(el, msg = '분석 중...') {
        el.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <div class="spinner-sm mb-12" style="margin:0 auto;"></div>
        <div style="font-size:0.85rem; color:var(--accent);">${msg}</div>
      </div>`;
    }

    function levelBadge(score, max = 100) {
        const r = score / max;
        const color = r >= 0.8 ? '#ff4136' : r >= 0.6 ? '#ff851b' : r >= 0.4 ? '#ffdc00' : '#2ecc40';
        return `<span style="background:${color}22; color:${color}; border:1px solid ${color}44; border-radius:6px; padding:2px 8px; font-size:0.72rem; font-weight:700;">${score}</span>`;
    }

    // ─── Step 1: 떡상 영상 수집 ─────────────────
    $('#dna-collect-btn').addEventListener('click', async () => {
        const section = $('#dna-spike-list');
        section.classList.remove('hidden');
        showSpinner(section, '떡상 영상 수집 중...');

        try {
            const channelId = $('#dna-channel-select').value;
            const topN = $('#dna-topn').value;
            const days = $('#dna-days').value;

            const data = await api.getDnaSpikes({ channelId, topN, days });
            collectedSpikes = data.spikes || [];

            if (collectedSpikes.length === 0) {
                section.innerHTML = `<div class="card"><p style="color:var(--text-muted); font-size:0.85rem;">수집된 떡상 영상이 없습니다. 기간을 늘리거나 채널을 변경해보세요.</p></div>`;
                return;
            }

            section.innerHTML = `
        <div class="card">
          <div class="flex-between mb-16">
            <h4 style="margin:0;">📥 수집된 떡상 영상 <span style="color:var(--accent);">${collectedSpikes.length}개</span></h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">베이스라인 조회수: ${(data.baseline?.p70Views || 0).toLocaleString()}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto;">
            ${collectedSpikes.map((v, i) => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <span style="font-size:0.8rem; font-weight:600; flex:1; margin-right:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${i + 1}. ${v.title}</span>
                <span style="font-size:0.75rem; color:var(--danger); font-weight:700; min-width:70px; text-align:right;">🔥 ${(v.view_count || 0).toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

            $('#dna-analyze-section').classList.remove('hidden');
        } catch (err) {
            section.innerHTML = `<div class="card" style="border-color:var(--danger);">
        <p style="color:var(--danger);">❌ 수집 실패: ${err.message}</p>
        <button class="btn btn-secondary btn-xs mt-8" onclick="location.reload()">🔁 재시도</button>
      </div>`;
        }
    });

    // ─── Step 2: DNA 분석 실행 ───────────────────
    $('#dna-analyze-btn').addEventListener('click', async () => {
        if (collectedSpikes.length === 0) { showToast('먼저 영상을 수집해주세요.', 'warning'); return; }

        const resultSection = $('#dna-result-section');
        resultSection.classList.remove('hidden');
        showSpinner(resultSection, 'Gemini AI가 DNA를 추출하는 중...');

        const category = $('#dna-category').value;

        try {
            const videoIds = collectedSpikes.map(v => v.id);
            const { dna } = await api.analyzeDna({ videoIds, category });
            currentDna = dna;

            renderDnaResult(resultSection, dna);

            // 자동으로 황금 키워드 추출
            await extractKeywords(dna, category);
        } catch (err) {
            const cached = await tryCache('dna_' + category);
            resultSection.innerHTML = `<div class="card" style="border:1px solid var(--danger);">
        <p style="color:var(--danger); font-weight:700;">❌ DNA 분석 실패: ${err.message}</p>
        ${cached ? `<div style="margin-top:12px; font-size:0.78rem; color:var(--text-muted);">⚠ 마지막 성공 결과를 표시합니다.</div>` : ''}
        <button class="btn btn-secondary btn-xs mt-8" id="retry-analyze-btn">🔁 재시도</button>
      </div>`;
            if (cached) { currentDna = cached; renderDnaResult(resultSection, cached); }
            resultSection.querySelector('#retry-analyze-btn')?.addEventListener('click', () =>
                $('#dna-analyze-btn').click()
            );
        }
    });

    // ─── DNA 결과 렌더링 (4탭) ───────────────────
    function renderDnaResult(el, dna) {
        const hook = dna.hook_dna || {};
        const struct = dna.structure_dna || {};
        const emo = dna.emotion_dna || {};
        const pace = dna.pace_dna || {};
        const title = dna.title_dna || {};

        el.innerHTML = `
      <div class="card">
        <div class="flex gap-8 mb-20" id="dna-tabs" style="background:rgba(255,255,255,0.03); padding:6px; border-radius:12px;">
          <button class="btn btn-secondary active-tab dna-tab-btn" data-tab="hook" style="flex:1; font-weight:700;">🪝 Hook</button>
          <button class="btn btn-secondary dna-tab-btn" data-tab="struct" style="flex:1; font-weight:700;">🏗 Structure</button>
          <button class="btn btn-secondary dna-tab-btn" data-tab="emotion" style="flex:1; font-weight:700;">💓 Emotion</button>
          <button class="btn btn-secondary dna-tab-btn" data-tab="style" style="flex:1; font-weight:700;">🎯 Title/Style</button>
        </div>

        <!-- Hook 탭 -->
        <div id="tab-hook" class="dna-tab-content">
          <div class="flex gap-16 mb-16" style="flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
              <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:6px;">HOOK 유형</div>
              <span style="background:var(--accent-glow); color:var(--accent); border:1px solid var(--accent); border-radius:8px; padding:4px 14px; font-weight:800; font-size:0.95rem;">${hook.hook_type || '—'}</span>
            </div>
            <div style="flex:1; min-width:200px;">
              <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:6px;">HOOK 강도</div>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:4px; height:8px; overflow:hidden;">
                  <div style="width:${hook.hook_strength_score || 0}%; height:100%; background:var(--accent); border-radius:4px;"></div>
                </div>
                <span style="font-weight:800; color:var(--accent);">${hook.hook_strength_score || 0}</span>
              </div>
            </div>
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">TOP 후킹 문장</div>
            ${(hook.hook_sentences || []).map(s => `<div style="background:rgba(255,255,255,0.03); border-left:3px solid var(--accent); padding:8px 12px; margin-bottom:6px; border-radius:0 8px 8px 0; font-size:0.85rem;">"${s}"</div>`).join('')}
          </div>
          <div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">OPEN LOOP (미공개 요소)</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${(hook.open_loop || []).map(l => `<span style="background:rgba(255,200,0,0.15); color:#ffd700; border:1px solid #ffd70044; border-radius:20px; padding:4px 12px; font-size:0.78rem;">${l}</span>`).join('')}
            </div>
          </div>
        </div>

        <!-- Structure 탭 -->
        <div id="tab-struct" class="dna-tab-content hidden">
          <div class="flex gap-16 mb-16" style="flex-wrap:wrap;">
            <div><div style="font-size:0.72rem; color:var(--text-muted);">구조 유형</div>
              <span style="font-weight:800; color:var(--accent); font-size:1rem;">${struct.structure_type || '—'}</span></div>
            <div><div style="font-size:0.72rem; color:var(--text-muted);">클라이맥스 위치</div>
              <span style="font-weight:800; color:#ff851b;">${struct.climax_position || '—'}%</span></div>
            <div><div style="font-size:0.72rem; color:var(--text-muted);">페이오프</div>
              <span style="font-weight:800; color:#2ecc40;">${struct.payoff_type || '—'}</span></div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${(struct.sections || []).map((s, i) => `
              <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:rgba(255,255,255,0.02); border-radius:10px;">
                <div style="min-width:36px; height:36px; background:var(--accent-glow); color:var(--accent); border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem;">${s.duration_pct}%</div>
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:0.88rem;">${s.name}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${s.goal} · ${s.key_question}</div>
                </div>
                ${i === Math.round((struct.sections || []).length * 0.6) ? '<span style="color:#ff851b; font-size:0.72rem; font-weight:700;">★ 클라이맥스</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Emotion 탭 -->
        <div id="tab-emotion" class="dna-tab-content hidden">
          <div style="margin-bottom:14px;">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">절정 구간</div>
            ${(emo.peak_points || []).map(p => `<div style="background:rgba(255,65,54,0.1); border-left:3px solid #ff4136; padding:6px 12px; border-radius:0 8px 8px 0; font-size:0.82rem; margin-bottom:4px;">⬆ ${p}</div>`).join('')}
          </div>
          <div style="margin-bottom:14px;">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">이탈 위험 구간</div>
            ${(emo.drop_points || []).map(p => `<div style="background:rgba(255,220,0,0.1); border-left:3px solid #ffdc00; padding:6px 12px; border-radius:0 8px 8px 0; font-size:0.82rem; margin-bottom:4px;">⚠ ${p}</div>`).join('')}
          </div>
        </div>

        <!-- Style 탭 -->
        <div id="tab-style" class="dna-tab-content hidden">
          <div class="flex gap-16 mb-16" style="flex-wrap:wrap;">
            <div><div style="font-size:0.72rem; color:var(--text-muted);">제목 패턴</div>
              <span style="font-weight:800; color:var(--accent);">${title.title_pattern || '—'}</span></div>
            <div><div style="font-size:0.72rem; color:var(--text-muted);">평균 문장 길이</div>
              <span style="font-weight:800;">${pace.sentence_length_avg || '—'}자</span></div>
            <div><div style="font-size:0.72rem; color:var(--text-muted);">짧은 문장 비율</div>
              <span style="font-weight:800;">${Math.round((pace.short_sentence_ratio || 0) * 100)}%</span></div>
          </div>
          <div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">CTA 핵심 단어 TOP10</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${(title.cta_words || []).map(w => `<span style="background:rgba(120,80,255,0.15); color:var(--accent); border:1px solid rgba(120,80,255,0.3); border-radius:16px; padding:3px 10px; font-size:0.78rem;">${w}</span>`).join('')}
            </div>
          </div>
          ${(pace.taboo_flags || []).length > 0 ? `
          <div style="margin-top:12px; background:rgba(255,65,54,0.1); border-radius:8px; padding:8px 12px;">
            <span style="color:var(--danger); font-size:0.78rem; font-weight:700;">⚠ 위험 플래그: ${pace.taboo_flags.join(', ')}</span>
          </div>` : ''}
        </div>
      </div>
    `;

        // 탭 전환
        el.querySelectorAll('.dna-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                el.querySelectorAll('.dna-tab-btn').forEach(b => b.classList.remove('active-tab'));
                el.querySelectorAll('.dna-tab-content').forEach(c => c.classList.add('hidden'));
                btn.classList.add('active-tab');
                el.querySelector(`#tab-${btn.dataset.tab}`)?.classList.remove('hidden');
            });
        });
    }

    // ─── Step 3: 황금 키워드 추출 ───────────────
    async function extractKeywords(dna, category) {
        const kwSection = $('#dna-keywords-section');
        kwSection.classList.remove('hidden');
        showSpinner(kwSection, '황금 키워드 추출 중...');

        try {
            const result = await api.extractGoldenKeywords({ dna });
            currentGoldenKw = result;

            kwSection.innerHTML = `
        <div class="card">
          <h4 style="margin:0 0 16px 0;">⭐ 황금 키워드</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            ${(result.golden_keywords || []).map(k => `
              <span style="background:rgba(255,200,0,0.12); color:#ffd700; border:1px solid rgba(255,200,0,0.3); border-radius:20px; padding:5px 14px; font-size:0.85rem; font-weight:700;">${k}</span>
            `).join('')}
          </div>
          ${result.keyword_reason ? `<p style="font-size:0.78rem; color:var(--text-muted); margin:0;">💡 ${result.keyword_reason}</p>` : ''}
          <div style="text-align:center; margin-top:20px;">
            <button class="btn btn-primary" id="dna-titles-btn" style="font-size:0.95rem; padding:12px 24px; font-weight:800;">
              🎯 후킹 제목 10개 추천받기
            </button>
          </div>
        </div>
      `;

            kwSection.querySelector('#dna-titles-btn').addEventListener('click', () =>
                recommendTitlesStep(dna, result, category)
            );
        } catch (err) {
            kwSection.innerHTML = `<div class="card" style="border-color:var(--danger);">
        <p style="color:var(--danger);">황금 키워드 추출 실패: ${err.message}</p></div>`;
        }
    }

    // ─── Step 4: 제목 10개 추천 ─────────────────
    async function recommendTitlesStep(dna, goldenKw, category) {
        const titlesSection = $('#dna-titles-section');
        titlesSection.classList.remove('hidden');
        titlesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showSpinner(titlesSection, '후킹 제목 10개 생성 중...');

        try {
            const { titles } = await api.recommendDnaTitles({ dna, goldenKeywords: goldenKw, category });

            if (!titles || titles.length === 0) throw new Error('제목이 생성되지 않았습니다.');

            titlesSection.innerHTML = `
        <div class="card">
          <h4 style="margin:0 0 16px 0;">🎯 썸네일 후킹 제목 추천 <span style="color:var(--text-muted); font-size:0.78rem; font-weight:400;">(클릭하여 선택 → 대본 뼈대 생성)</span></h4>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${titles.map((t, i) => `
              <div class="dna-title-card" data-idx="${i}"
                style="padding:14px 18px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); cursor:pointer; transition:all 0.2s; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px;">${i + 1}. ${t.title}</div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">${t.reason}</div>
                </div>
                <div style="text-align:center; min-width:50px;">
                  <div style="font-size:0.65rem; color:var(--text-muted);">CTR</div>
                  ${levelBadge(t.ctr_score)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

            titlesSection.querySelectorAll('.dna-title-card').forEach(card => {
                card.addEventListener('mouseenter', () => { card.style.background = 'rgba(120,80,255,0.1)'; card.style.borderColor = 'var(--accent)'; });
                card.addEventListener('mouseleave', () => { card.style.background = 'rgba(255,255,255,0.03)'; card.style.borderColor = 'rgba(255,255,255,0.07)'; });
                card.addEventListener('click', () => {
                    const idx = parseInt(card.dataset.idx);
                    const selected = titles[idx];
                    generateSkeletonStep(dna, selected.title, category);
                });
            });
        } catch (err) {
            titlesSection.innerHTML = `<div class="card" style="border-color:var(--danger);">
        <p style="color:var(--danger);">제목 추천 실패: ${err.message}</p></div>`;
        }
    }

    // ─── Step 5: 대본 뼈대 생성 ─────────────────
    async function generateSkeletonStep(dna, selectedTitle, category) {
        const skelSection = $('#dna-skeleton-section');
        skelSection.classList.remove('hidden');
        skelSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showSpinner(skelSection, `"${selectedTitle}" 대본 뼈대 생성 중...`);

        try {
            const { skeleton } = await api.generateDnaSkeleton({ dna, selectedTitle, category });
            if (!skeleton) throw new Error('뼈대가 생성되지 않았습니다.');

            skelSection.innerHTML = `
        <div class="card">
          <div class="flex-between mb-20">
            <h4 style="margin:0;">📝 대본 뼈대</h4>
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="font-size:0.72rem; color:var(--text-muted);">예상 분량: ${skeleton.total_duration_estimate || '—'}</span>
              <button class="btn btn-secondary btn-xs" id="copy-skeleton-btn">📋 복사</button>
            </div>
          </div>
          <div style="background:rgba(120,80,255,0.08); border:1px solid var(--accent); border-radius:12px; padding:14px 18px; margin-bottom:20px;">
            <div style="font-size:0.72rem; color:var(--accent); margin-bottom:4px;">선택된 제목</div>
            <div style="font-weight:800; font-size:1rem;">${skeleton.title}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;" id="skeleton-sections">
            ${(skeleton.sections || []).map(s => `
              <div style="background:rgba(255,255,255,0.02); border-radius:12px; padding:14px 18px; border-left:4px solid ${s.special?.includes('★') ? '#ff851b' : s.special?.includes('🔔') ? '#ffdc00' : 'rgba(255,255,255,0.1)'};">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                  <span style="font-weight:800; font-size:0.88rem;">${s.name}</span>
                  <span style="font-size:0.65rem; color:var(--text-muted); background:rgba(255,255,255,0.05); border-radius:4px; padding:2px 6px;">${s.position}</span>
                  ${s.special && s.special !== 'null' ? `<span style="font-size:0.72rem; font-weight:700; color:${s.special.includes('★') ? '#ff851b' : '#ffdc00'}">${s.special}</span>` : ''}
                </div>
                <div style="font-size:0.8rem; margin-bottom:6px;"><span style="color:var(--text-muted);">목표:</span> ${s.goal}</div>
                <div style="font-size:0.8rem; margin-bottom:8px;"><span style="color:var(--text-muted);">핵심 질문:</span> ${s.key_question}</div>
                <div style="background:rgba(120,80,255,0.08); border-radius:8px; padding:8px 12px; margin-bottom:6px; font-size:0.82rem; font-style:italic;">"${s.hook_sentence}"</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">→ 전환: ${s.transition}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:16px; background:rgba(46,204,64,0.1); border:1px solid #2ecc40; border-radius:10px; padding:12px 16px;">
            <div style="font-size:0.72rem; color:#2ecc40; margin-bottom:4px;">마무리 (${skeleton.ending_type})</div>
            <div style="font-size:0.88rem; font-weight:600;">"${skeleton.ending_sentence}"</div>
          </div>
        </div>
      `;

            // 복사 기능
            skelSection.querySelector('#copy-skeleton-btn').addEventListener('click', () => {
                const text = (skeleton.sections || []).map(s =>
                    `[${s.name}] (${s.position})\n목표: ${s.goal}\n핵심질문: ${s.key_question}\n후킹: "${s.hook_sentence}"\n전환: ${s.transition}\n`
                ).join('\n') + `\n[마무리] "${skeleton.ending_sentence}"`;
                navigator.clipboard.writeText(text).then(() => showToast('대본 뼈대가 복사되었습니다!', 'success'));
            });

        } catch (err) {
            skelSection.innerHTML = `<div class="card" style="border-color:var(--danger);">
        <p style="color:var(--danger);">대본 뼈대 생성 실패: ${err.message}</p>
        <button class="btn btn-secondary btn-xs mt-8" onclick="this.closest('.card').previousSibling?.querySelector('.dna-title-card')?.click()">🔁 재시도</button>
      </div>`;
        }
    }

    // ─── 캐시 시도 헬퍼 ─────────────────────────
    async function tryCache(key) {
        try {
            const { cached } = await api.getDnaCache(key);
            return cached;
        } catch { return null; }
    }
}
