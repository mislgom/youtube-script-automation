// Skeleton recommendation page — keyword -> trope analysis -> unique skeleton
import { showToast } from '../components/toast.js';

export async function renderSkeleton(container, { api, navigate }) {
  container.innerHTML = `
    <div class="page-header">
      <h2>✨ 유니크 대본 뼈대 추천</h2>
      <p>키워드를 입력하면 기존 영상 소재를 분석하여 중복 없는 새로운 시나리오 구성을 제안합니다.</p>
    </div>

    <div class="card mb-24">
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div class="input-group" style="margin-bottom:0;">
          <label>주제 키워드 (필수)</label>
          <input type="text" id="skeleton-keyword" placeholder="예: 며느리, 보복, 우정 등" style="width:100%;">
        </div>
        
        <div class="prompt-tabs-container">
          <label style="display:block; margin-bottom:12px; font-size:1.15rem; font-weight:800; color:var(--text-secondary);">
            📋 추가 요청 사항 카테고리 (자동 저장 지원)
          </label>
          <div class="flex gap-8 mb-12" id="prompt-tabs">
            <button class="btn btn-secondary btn-sm active" data-cat="조선야담">조선야담</button>
            <button class="btn btn-secondary btn-sm" data-cat="경제">경제</button>
            <button class="btn btn-secondary btn-sm" data-cat="심리학">심리학</button>
            <button class="btn btn-secondary btn-sm" data-cat="현대사">현대사</button>
          </div>
          <textarea id="skeleton-requirements" placeholder="해당 카테고리의 요청 사항을 입력하세요..." style="width:100%; min-height:120px; padding:12px; font-family:inherit; line-height:1.5;"></textarea>
        </div>

        <button class="btn btn-primary" id="skeleton-gen-btn" style="width:100%; height:42px; font-weight:700;">🪄 유니크 뼈대 만들기</button>
      </div>
    </div>

    <div id="skeleton-loading" class="hidden">
      <div class="flex-center" style="padding:60px; flex-direction:column; gap:20px;">
        <div class="spinner"></div>
        <div style="color:var(--text-secondary); text-align:center;">
            <p>데이터베이스와 비교하며 독창적인 이야기를 구성 중입니다...</p>
            <p style="font-size:1.1rem; margin-top:12px; font-weight:600;">기존 영상의 뻔한 전개(Trope)를 피하고 신선한 관점을 찾는 중...</p>
        </div>
      </div>
    </div>

    <div id="skeleton-results"></div>
  `;

  const keywordInput = document.getElementById('skeleton-keyword');
  const genBtn = document.getElementById('skeleton-gen-btn');
  const resultsEl = document.getElementById('skeleton-results');
  const loadingEl = document.getElementById('skeleton-loading');
  const reqTextarea = document.getElementById('skeleton-requirements');
  const tabContainer = document.getElementById('prompt-tabs');
  const tabs = tabContainer.querySelectorAll('button');

  const defaultPrompts = {
    '조선야담': '위 뼈대를 확인하고 아주 재미있는 야담 대본을 만들어주세요.\n***도입부 후킹***은 아주 어마무시하게 강력한 후킹으로 시청자들이 이탈을 방지하고, "이게 무슨일인가?"라고 생각이 들어 끝까지 내용을 보시게 만드세요.',
    '경제': '위 뼈대를 바탕으로 일반인도 이해하기 쉬운 경제 시나리오를 작성해주세요. 복잡한 용어는 비유를 들어 설명하고, 현재 시장 트렌드와의 연결고리를 만들어 시청자에게 실질적인 유익을 주도록 하세요.',
    '심리학': "인간의 내면 심리와 욕망을 심도 있게 다루는 심리학 대본을 기획해주세요. 등장인물의 행동 기저에 깔린 심리 법칙을 언급하고, 시청자가 자신의 삶에 대입해볼 수 있는 '공감 포인트'를 강조하세요.",
    '현대사': '현대사의 특정 사건이나 인물을 재조명하는 다큐멘터리 스타일의 대본을 만들어주세요. 객관적인 사실 기반 위에 극적인 연출을 더해 역사의 긴장감을 살리고, 과거가 현재에 주는 교훈을 결말에 포함하세요.'
  };

  // Load prompts from local storage or use defaults
  let savedPrompts = JSON.parse(localStorage.getItem('skeleton_prompts') || '{}');
  let currentCat = '조선야담';

  function initPrompts() {
    Object.keys(defaultPrompts).forEach(cat => {
      if (!savedPrompts[cat]) savedPrompts[cat] = defaultPrompts[cat];
    });
    localStorage.setItem('skeleton_prompts', JSON.stringify(savedPrompts));
  }

  function updateActiveTab(cat) {
    currentCat = cat;
    tabs.forEach(t => {
      if (t.dataset.cat === cat) {
        t.style.background = 'var(--accent)';
        t.style.color = 'white';
        t.style.borderColor = 'var(--accent)';
      } else {
        t.style.background = 'transparent';
        t.style.color = 'var(--text-secondary)';
        t.style.borderColor = 'rgba(255,255,255,0.1)';
      }
    });
    reqTextarea.value = savedPrompts[cat] || '';
  }

  initPrompts();
  updateActiveTab(currentCat);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      updateActiveTab(tab.dataset.cat);
    });
  });

  reqTextarea.addEventListener('input', () => {
    savedPrompts[currentCat] = reqTextarea.value;
    localStorage.setItem('skeleton_prompts', JSON.stringify(savedPrompts));
  });

  // Enter key submit
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') genBtn.click();
  });

  genBtn.addEventListener('click', async () => {
    const keyword = keywordInput.value.trim();
    const requirements = document.getElementById('skeleton-requirements')?.value.trim() || '';
    if (!keyword) { showToast('키워드를 입력해주세요.', 'warning'); return; }

    resultsEl.innerHTML = '';
    loadingEl.classList.remove('hidden');
    genBtn.disabled = true;

    try {
      const data = await api.generateUniqueSkeleton(keyword, requirements);
      renderResults(data, keyword);
    } catch (err) {
      resultsEl.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${err.message}</p></div>`;
    } finally {
      loadingEl.classList.add('hidden');
      genBtn.disabled = false;
    }
  });

  function renderResults(data, keyword) {
    resultsEl.innerHTML = `
      <div class="two-col animation-fade-in">
        <div class="chart-container" style="background:var(--card-bg-subtle);">
          <h4 style="color:var(--danger); display:flex; align-items:center; gap:8px;">
            ⚠️ 배제된 중복 소재 (Trope)
          </h4>
          <p style="font-size:1rem; color:var(--text-muted); margin-bottom:20px; font-weight:600;">
            이미 흔하게 사용되어 이번 기획에서는 철저히 제외한 요소들입니다.
          </p>
          <div class="tag-list" style="flex-wrap:wrap; gap:10px;">
            ${data.analyzed_tropes.map(t => `<span class="tag" style="background:rgba(255, 68, 68, 0.1); color:#ff4444; border:1px solid rgba(255, 68, 68, 0.2); text-decoration:line-through;">${t}</span>`).join('')}
          </div>
          
          <div style="margin-top:32px; padding:24px; border-radius:16px; background:var(--accent-glow); border:2px solid var(--accent-light);">
            <h4 style="margin-top:0; color:var(--accent); font-size:1.5rem; font-weight:900;">💡 유니크 핵심 컨셉</h4>
            <div style="line-height:1.7; font-weight:600; font-size:1.25rem;">${data.unique_concept}</div>
          </div>
        </div>

        <div class="chart-container">
          <div class="flex-between mb-16" style="align-items:center;">
             <h4 style="margin:0;">📝 제안된 대본 뼈대 (Skeleton)</h4>
             <div class="flex gap-8">
               <button class="btn btn-sm btn-secondary" id="download-txt-btn">💾 TXT 다운로드</button>
               <button class="btn btn-sm btn-primary" id="save-idea-btn">📁 아이디어함 저장</button>
             </div>
          </div>
          
          <div class="skeleton-timeline">
            <div class="timeline-item">
              <div class="timeline-badge">기</div>
              <div class="timeline-content">
                <strong>도입 (Intro)</strong>
                <p>${data.skeleton.intro}</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-badge">승</div>
              <div class="timeline-content">
                <strong>전개 (Development)</strong>
                <p>${data.skeleton.development}</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-badge">전</div>
              <div class="timeline-content">
                <strong>절정 (Climax)</strong>
                <p>${data.skeleton.climax}</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-badge">결</div>
              <div class="timeline-content">
                <strong>결말 (Conclusion)</strong>
                <p>${data.skeleton.conclusion}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Download as TXT functionality
    document.getElementById('download-txt-btn').addEventListener('click', () => {
      const text = `
[대본 뼈대 리포트]
키워드: ${keyword}
날짜: ${new Date().toLocaleString()}

=========================================
1. 배제된 중복 소재 (Trope)
=========================================
${data.analyzed_tropes.join(', ')}

=========================================
2. 유니크 핵심 컨셉
=========================================
${data.unique_concept}

=========================================
3. 제안된 뼈대 구성 (기-승-전-결)
=========================================
[기 - 도입]
${data.skeleton.intro}

[승 - 전개]
${data.skeleton.development}

[전 - 절정]
${data.skeleton.climax}

[결 - 결말]
${data.skeleton.conclusion}

=========================================
이 대본은 AI에 의해 생성된 독창적인 뼈대입니다.
      `.trim();

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `대본뼈대_${keyword}_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('TXT 파일 다운로드가 시작되었습니다.', 'success');
    });

    // Save to ideas functionality
    document.getElementById('save-idea-btn').addEventListener('click', async () => {
      try {
        const btn = document.getElementById('save-idea-btn');
        btn.disabled = true;
        btn.textContent = '저장 중...';

        await api.addIdea({
          title: `[뼈대] ${keyword} - ${data.unique_concept.substring(0, 15)}...`,
          description: data.unique_concept,
          notes: `[배제된 소재]\n${data.analyzed_tropes.join(', ')}\n\n[뼈대 구성]\n기: ${data.skeleton.intro}\n승: ${data.skeleton.development}\n전: ${data.skeleton.climax}\n결: ${data.skeleton.conclusion}`
        });

        showToast('아이디어함에 저장되었습니다.', 'success');
        btn.textContent = '✅ 저장 완료';
      } catch (err) {
        showToast('저장 실패: ' + err.message, 'error');
        document.getElementById('save-idea-btn').disabled = false;
        document.getElementById('save-idea-btn').textContent = '📁 아이디어함 저장';
      }
    });
  }
}
