// Script Editor Page — senior-friendly large text editor
import { showToast, showModal } from '../components/toast.js';

export async function renderEditor(container, { api, navigate }) {
    container.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>✍️ 대본 편집</h2>
        <p>나만의 멋진 대본을 작성하고 AI의 도움을 받아보세요</p>
      </div>
      <div class="flex gap-12">
        <button class="btn btn-secondary" id="script-list-btn">📂 내 대본 목록</button>
        <button class="btn btn-primary" id="new-script-btn">+ 새 대본 만들기</button>
      </div>
    </div>

    <div id="editor-container" class="animation-fade-in">
       <div class="card" style="padding:0; overflow:hidden; display:flex; min-height:700px; border:2px solid var(--border);">
          <!-- Left: Instruction Box -->
          <div id="left-panel" style="width:22%; min-width:150px; max-width:55%; background: var(--bg-card); border-right: 2px solid var(--border); padding:32px; display:flex; flex-direction:column; flex-shrink:0;">
            <label style="font-size:1.3rem; font-weight:900; color:var(--accent); margin-bottom:16px;">💬 지시문 박스</label>
            <textarea id="script-instructions" placeholder="대본 작성 시 주의할 점이나 메모를 적어주세요..." style="flex:1; font-size:1.1rem; line-height:1.6; padding:20px; font-weight:600; background:rgba(255,255,255,0.02); resize:none;"></textarea>
            <div style="margin-top:20px; display:flex; gap:8px;">
              <button id="start-edit-btn" class="btn btn-accent" style="flex:1; padding:14px; font-size:1.1rem; font-weight:800;">🚀 수정 시작</button>
              <button id="stop-edit-btn" class="btn btn-secondary hidden" style="flex:1; padding:14px; font-size:1.1rem; font-weight:800; border:2px solid var(--danger); color:var(--danger); background:transparent;">⏹ 중지</button>
            </div>
            <p style="font-size:0.95rem; color:var(--text-muted); margin-top:16px; font-weight:600; line-height:1.5;">
              💡 팁: 지시문을 적고 '수정 시작'을 누르면 AI가 대본을 편집합니다.
            </p>
          </div>

          <!-- Resizer Handle -->
          <div id="panel-resizer" style="width:7px; background:var(--border); cursor:col-resize; flex-shrink:0; position:relative; transition:background 0.15s; display:flex; align-items:center; justify-content:center;" title="드래그하여 크기 조절">
            <div style="width:2px; height:40px; background:var(--accent); border-radius:2px; opacity:0.5;"></div>
          </div>

            <!-- Right: Content Editor -->
          <div id="right-panel" style="flex:1; min-width:0; padding:40px; display:flex; flex-direction:column; background: var(--bg-app); position: relative; height: 700px;">
            <div class="flex-between" style="align-items:center; margin-bottom:20px;">
              <label style="font-size:1.35rem; font-weight:900; color:var(--accent); margin-bottom:0;">📄 대본 본문 내용</label>
              
                <div class="flex gap-12" style="align-items: center;">
                  <!-- File Upload Button -->
                  <button id="file-upload-btn" class="btn btn-sm btn-outline" style="padding: 6px 16px; font-size: 1rem; font-weight: 800; border-radius: 20px; color: var(--accent); border-color: var(--accent);">
                    📂 파일 불러오기
                  </button>
                  <input type="file" id="file-input-hidden" class="hidden" accept=".txt">

                  <!-- Search Bar (Magnifying Glass) -->
                  <div class="flex gap-8" style="background: var(--bg-card); border: 1px solid var(--border); padding: 4px 12px; border-radius: 20px; align-items: centre;">
                    <span id="search-icon" style="cursor: pointer; font-size: 1.2rem;">🔍</span>
                    <input id="script-search-input" type="text" placeholder="단어 검색..." style="background: transparent; border: none; font-size: 1rem; color: var(--text-primary); width: 140px; font-weight: 600;">
                    <button id="search-next-btn" class="btn btn-sm btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;">검색</button>
                  </div>
                </div>
            </div>
            
            <div id="drop-zone" style="flex:1; position:relative; display:flex; flex-direction:column; overflow: hidden; border-radius: 12px; border: 2px solid var(--border);">
              <div id="drop-overlay" class="hidden" style="position:absolute; inset:0; background:rgba(var(--accent-rgb), 0.1); border:4px dashed var(--accent); border-radius:12px; z-index:10; display:flex; align-items:center; justify-content:center; pointer-events:none;">
                <div style="font-size:1.5rem; font-weight:900; color:var(--accent);">📂 파일을 여기에 놓으세요</div>
              </div>
              <textarea id="script-content" placeholder="이곳에 대본 내용을 자유롭게 작성하거나, 텍스트 파일을 이곳에 끌어다 놓으세요..." style="flex:1; font-size:1.35rem; line-height:1.8; padding:32px; font-weight:600; background:var(--bg-card); border: none; resize:none; overflow-y: auto;"></textarea>
              <div id="diff-viewer" class="hidden" style="flex:1; font-size:1.35rem; line-height:1.8; padding:32px; font-weight:600; background:var(--bg-card); border: none; overflow-y:auto; white-space:pre-wrap;"></div>
            </div>

            <div class="flex-between" style="margin-top:24px; align-items:center;">
               <div id="save-status" style="font-size:1.1rem; color:var(--text-muted); font-weight:600;"></div>
               <div class="flex gap-12" style="align-items: center;">
                 <button id="view-before-btn" class="btn btn-danger hidden" style="padding:10px 20px; font-size:1rem; font-weight:800;">🔴 수정 전</button>
                 <button id="view-after-btn" class="btn btn-success hidden" style="padding:10px 20px; font-size:1rem; font-weight:800;">🟢 수정 후</button>
                 <div style="width: 2px; height: 24px; background: var(--border); margin: 0 8px; display: none;" id="btn-divider"></div>
                 <button class="btn btn-danger btn-sm" id="delete-script-btn" style="display:none; padding:10px 20px; font-size:1rem; font-weight:800;">삭제하기</button>
                 <button class="btn btn-secondary btn-sm" id="new-script-btn" style="padding:10px 20px; font-size:1rem; font-weight:800;">새 대본</button>
                 <button class="btn btn-secondary btn-sm" id="view-all-btn" style="padding:10px 20px; font-size:1rem; font-weight:800;">👁️ 전체보기</button>
                 
                 <!-- TTS Controls -->
                 <div class="flex gap-8" style="background: var(--bg-card); border: 1px solid var(--border); padding: 4px 12px; border-radius: 20px; align-items: center; margin: 0 8px;">
                   <button id="tts-play-btn" class="btn btn-sm btn-outline" style="padding: 4px 10px; font-size: 0.9rem; border-radius: 15px;">🔊 듣기</button>
                   <button id="tts-stop-btn" class="btn btn-sm btn-outline hidden" style="padding: 4px 10px; font-size: 0.9rem; border-radius: 15px; border-color: var(--danger); color: var(--danger);">⏹ 중지</button>
                   <div style="display: flex; align-items: center; gap: 4px;">
                     <span style="font-size: 0.8rem; color: var(--text-muted);">🔈</span>
                     <input id="tts-volume" type="range" min="0" max="1" step="0.1" value="1" style="width: 60px; height: 4px; cursor: pointer;">
                     <span style="font-size: 0.8rem; color: var(--text-muted);">🔊</span>
                   </div>
                 </div>

                 <button class="btn btn-primary" id="export-script-btn" style="padding:12px 28px; font-size:1.1rem; font-weight:800;">📥 다운로드</button>
               </div>
            </div>
          </div>
       </div>
    </div>

    <!-- View All Overlay (Reading Mode) -->
    <div id="view-all-overlay" class="hidden" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:9000; display:flex; flex-direction:column; padding:60px; animation:animation-fade-in 0.3s;">
       <div class="flex-between" style="margin-bottom:30px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
         <h2 style="color:var(--accent); margin:0;">👁️ 대본 전체보기 (읽기 모드)</h2>
         <div class="flex gap-16" style="align-items: center;">
            <!-- TTS Controls in Overlay -->
            <div class="flex gap-12" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 8px 20px; border-radius: 40px; align-items: center;">
              <button id="view-all-tts-play" class="btn btn-sm btn-accent" style="padding: 6px 14px; font-size: 1rem; border-radius: 20px;">🔊 음성 듣기</button>
              <button id="view-all-tts-stop" class="btn btn-sm btn-danger hidden" style="padding: 6px 14px; font-size: 1rem; border-radius: 20px;">⏹ 중지</button>
              
              <!-- Speed Selector -->
              <div class="flex gap-4" style="background: rgba(0,0,0,0.3); padding: 2px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                <button class="speed-btn btn btn-sm" data-speed="1.0" style="padding: 4px 10px; font-size: 0.85rem; border-radius: 15px; background: var(--accent); color: white;">1.0x</button>
                <button class="speed-btn btn btn-sm" data-speed="1.5" style="padding: 4px 10px; font-size: 0.85rem; border-radius: 15px; color: var(--text-muted); background: transparent;">1.5x</button>
                <button class="speed-btn btn btn-sm" data-speed="2.0" style="padding: 4px 10px; font-size: 0.85rem; border-radius: 15px; color: var(--text-muted); background: transparent;">2.0x</button>
              </div>

              <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                <button id="view-all-tts-mute" style="background:none; border:none; cursor:pointer; font-size:1.2rem; padding:0;">🔈</button>
                <input id="view-all-tts-volume" type="range" min="0" max="1" step="0.1" value="1" style="width: 80px; height: 6px; cursor: pointer;">
              </div>
            </div>
            <button id="close-view-all" class="btn btn-secondary" style="font-size:1.2rem; font-weight:800; padding:10px 24px; border-radius:30px;">❌ 창 닫기 (ESC)</button>
          </div>
       </div>
       <div id="view-all-text-container" style="flex:1; overflow-y:auto; font-size:1.6rem; line-height:2.2; color:var(--text-primary); white-space:pre-wrap; padding:0 40px; font-weight:500; text-align:left; max-width:1200px; margin:0 auto; width:100%;">
       </div>
    </div>
  `;

    // ─── Panel Resizer Logic ─────────────────────────
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const resizer = document.getElementById('panel-resizer');

    // Restore saved width
    const savedWidth = localStorage.getItem('editor_left_panel_width');
    if (savedWidth && leftPanel) leftPanel.style.width = savedWidth;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.getBoundingClientRect().width;
        resizer.style.background = 'var(--accent)';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const container = leftPanel.parentElement;
        const containerWidth = container.getBoundingClientRect().width;
        const delta = e.clientX - startX;
        let newWidth = startWidth + delta;
        // Clamp between 150px and 55% of container
        newWidth = Math.max(150, Math.min(newWidth, containerWidth * 0.55));
        leftPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        resizer.style.background = 'var(--border)';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Persist width
        localStorage.setItem('editor_left_panel_width', leftPanel.style.width);
    });

    // Hover effect
    resizer.addEventListener('mouseenter', () => {
        if (!isResizing) resizer.style.background = 'rgba(var(--accent-rgb), 0.5)';
    });
    resizer.addEventListener('mouseleave', () => {
        if (!isResizing) resizer.style.background = 'var(--border)';
    });
    // ────────────────────────────────────────────────

    const instructionsInput = document.getElementById('script-instructions');
    const contentInput = document.getElementById('script-content');
    const diffViewer = document.getElementById('diff-viewer');
    const dropZone = document.getElementById('drop-zone');
    const dropOverlay = document.getElementById('drop-overlay');
    const exportBtn = document.getElementById('export-script-btn');
    const listBtn = document.getElementById('script-list-btn');
    const newBtn = document.getElementById('new-script-btn');
    const deleteBtn = document.getElementById('delete-script-btn');
    const startEditBtn = document.getElementById('start-edit-btn');
    const stopEditBtn = document.getElementById('stop-edit-btn');
    const viewBeforeBtn = document.getElementById('view-before-btn');
    const viewAfterBtn = document.getElementById('view-after-btn');
    const divider = document.getElementById('btn-divider');
    const saveStatus = document.getElementById('save-status');
    const searchInput = document.getElementById('script-search-input');
    const searchBtn = document.getElementById('search-next-btn');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const fileInput = document.getElementById('file-input-hidden');
    const viewAllBtn = document.getElementById('view-all-btn');
    const viewAllOverlay = document.getElementById('view-all-overlay');
    const viewAllText = document.getElementById('view-all-text-container');
    const closeViewAll = document.getElementById('close-view-all');
    const ttsPlayBtn = document.getElementById('tts-play-btn');
    const ttsStopBtn = document.getElementById('tts-stop-btn');
    const ttsVolume = document.getElementById('tts-volume');
    const vaTtsPlay = document.getElementById('view-all-tts-play');
    const vaTtsStop = document.getElementById('view-all-tts-stop');
    const vaTtsVolume = document.getElementById('view-all-tts-volume');
    const vaTtsMute = document.getElementById('view-all-tts-mute');
    const vaSpeedBtns = document.querySelectorAll('.speed-btn');

    let currentScriptId = null;
    let autoSaveTimeout = null;
    let originalTextForDiff = '';
    let editedTextForDiff = '';
    let currentChangeIndex = -1; // To track sequential navigation
    let changeMarkers = []; // To store elements to scroll to
    let searchMatches = [];
    let currentSearchMatchIndex = -1;
    let isInitializationInProgress = false; // To prevent auto-save during initial load
    let editAbortController = null;

    // TTS Stable State
    let currentSentenceIdx = 0;
    let sentencesGlobal = [];
    let ttsRate = 1.0;
    let isMuted = false;
    let lastVolume = 1.0;
    let isTtsSpeaking = false;
    let isChangingSpeed = false;

    // Reset editor state to "New Script"
    function resetEditor(silent = false) {
        currentScriptId = null;
        contentInput.value = '';
        instructionsInput.value = '';
        originalTextForDiff = '';
        editedTextForDiff = '';

        diffViewer.classList.add('hidden');
        contentInput.classList.remove('hidden');
        viewBeforeBtn.classList.add('hidden');
        viewAfterBtn.classList.add('hidden');
        if (divider) divider.style.display = 'none';

        deleteBtn.style.display = 'none';
        if (!silent) {
            saveStatus.textContent = '새 대본 작성을 시작합니다.';
            showToast('편집기가 초기화되었습니다 (새 대본 상태)', 'info');
        }
        contentInput.focus();
    }

    // Atomic Character Diff
    function renderDiff(mode) {
        const oldStr = originalTextForDiff || "";
        const newStr = editedTextForDiff || "";

        const atomicDiff = [];
        let i = 0, j = 0;
        const MAX_ITER = (oldStr.length + newStr.length) * 2;
        let iterCount = 0;

        while ((i < oldStr.length || j < newStr.length) && iterCount < MAX_ITER) {
            iterCount++;
            if (i < oldStr.length && j < newStr.length && oldStr[i] === newStr[j]) {
                atomicDiff.push({ type: 'equal', value: oldStr[i] });
                i++; j++;
            } else {
                let foundMatch = false;
                const lookAhead = 20;
                for (let k = 1; k <= lookAhead; k++) {
                    if (i + k < oldStr.length && j < newStr.length && oldStr[i + k] === newStr[j]) {
                        atomicDiff.push({ type: 'removed', value: oldStr[i] });
                        i++; foundMatch = true; break;
                    }
                    if (j + k < newStr.length && i < oldStr.length && oldStr[i] === newStr[j + k]) {
                        atomicDiff.push({ type: 'added', value: newStr[j] });
                        j++; foundMatch = true; break;
                    }
                }
                if (!foundMatch) {
                    if (i < oldStr.length) { atomicDiff.push({ type: 'removed', value: oldStr[i] }); i++; }
                    if (j < newStr.length) { atomicDiff.push({ type: 'added', value: newStr[j] }); j++; }
                }
            }
        }

        const activeType = mode === 'before' ? 'removed' : 'added';
        let filteredGroups = [];
        atomicDiff.forEach(a => {
            if (a.type === 'equal' || a.type === activeType) {
                if (filteredGroups.length > 0 && filteredGroups[filteredGroups.length - 1].type === a.type) {
                    filteredGroups[filteredGroups.length - 1].value += a.value;
                } else {
                    filteredGroups.push({ type: a.type, value: a.value });
                }
            }
        });

        let finalGroups = [];
        for (let k = 0; k < filteredGroups.length; k++) {
            let current = filteredGroups[k];
            if (current.type === activeType) {
                while (k + 1 < filteredGroups.length) {
                    let gap = filteredGroups[k + 1];
                    let next = (k + 2 < filteredGroups.length) ? filteredGroups[k + 2] : null;
                    const hasParagraphBreak = /\n\s*\n/.test(gap.value);
                    const isSmallGap = gap.type === 'equal' && (gap.value.length < 12);
                    const isOnlySymbols = gap.type === 'equal' && /^[ \t\n\r.,!?;:()]+$/.test(gap.value);

                    if (!hasParagraphBreak && (isSmallGap || isOnlySymbols) && next && next.type === activeType) {
                        current.value += gap.value + next.value;
                        k += 2;
                        continue;
                    }
                    break;
                }
            }
            finalGroups.push(current);
        }

        let html = '';
        let changeCount = 0;
        finalGroups.forEach(segment => {
            if (segment.type === 'equal') {
                html += segment.value;
            } else {
                changeCount++;
                const bg = mode === 'before' ? '#fff0f0' : '#f0fff4';
                const color = mode === 'before' ? '#af0828' : '#1a7f37';
                const deco = mode === 'before' ? 'text-decoration: line-through;' : 'border-bottom: 2px solid #1a7f37;';
                html += `<span id="change-${changeCount}" class="diff-change" style="background-color: ${bg}; color: ${color}; font-weight: 800; ${deco} padding: 2px 0; margin: 0; scroll-margin-top: 100px;">${segment.value}</span>`;
            }
        });

        diffViewer.innerHTML = html || (mode === 'before' ? oldStr : newStr);
        diffViewer.classList.remove('hidden');
        contentInput.classList.add('hidden');
        currentChangeIndex = -1;
        changeMarkers = Array.from(diffViewer.querySelectorAll('.diff-change'));
        if (changeMarkers.length === 0) showToast('변경된 내용이 없습니다.', 'info');
    }

    function scrollToNextChange() {
        if (changeMarkers.length === 0) return;
        currentChangeIndex = (currentChangeIndex + 1) % changeMarkers.length;
        const target = changeMarkers[currentChangeIndex];
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const originalBg = target.style.backgroundColor;
            target.style.backgroundColor = target.style.color.includes('af0828') ? '#ffccd2' : '#c3f2cd';
            setTimeout(() => { target.style.backgroundColor = originalBg; }, 1000);
            showToast(`${currentChangeIndex + 1}번째 수정 위치로 이동`, 'info');
        }
    }

    startEditBtn.addEventListener('click', async () => {
        const content = contentInput.value.trim();
        const instructions = instructionsInput.value.trim();
        if (!content) return showToast('대본 내용을 먼저 입력해주세요.', 'warning');

        editAbortController = new AbortController();
        startEditBtn.disabled = true;
        const originalBtnText = startEditBtn.textContent;
        startEditBtn.textContent = '⏳ 수정 중...';
        viewBeforeBtn.classList.add('hidden');
        viewAfterBtn.classList.add('hidden');
        if (divider) divider.style.display = 'none';
        stopEditBtn.classList.remove('hidden');

        try {
            originalTextForDiff = contentInput.value;
            const data = await api.editScript(content, instructions, editAbortController.signal);
            editedTextForDiff = data.content;
            contentInput.value = editedTextForDiff;
            showToast('대본 수정이 완료되었습니다!', 'success');
            triggerAutoSave();
        } catch (err) {
            if (err.name === 'AbortError') showToast('대본 수정을 중단하였습니다.', 'warning');
            else showToast('수정 실패: ' + err.message, 'error');
        } finally {
            startEditBtn.disabled = false;
            startEditBtn.textContent = originalBtnText;
            stopEditBtn.classList.add('hidden');
            if (originalTextForDiff && editedTextForDiff) {
                viewBeforeBtn.classList.remove('hidden');
                viewAfterBtn.classList.remove('hidden');
                if (divider) divider.style.display = 'block';
            }
            editAbortController = null;
        }
    });

    stopEditBtn.addEventListener('click', () => {
        if (editAbortController) editAbortController.abort();
    });

    viewBeforeBtn.addEventListener('click', () => {
        const isViewingDiff = !diffViewer.classList.contains('hidden');
        const isActive = viewBeforeBtn.classList.contains('active-btn');
        if (isViewingDiff && isActive) {
            diffViewer.classList.add('hidden');
            contentInput.classList.remove('hidden');
            viewBeforeBtn.classList.remove('active-btn');
            viewBeforeBtn.style.border = 'none';
        } else {
            renderDiff('before');
            viewBeforeBtn.classList.add('active-btn');
            viewAfterBtn.classList.remove('active-btn');
            viewBeforeBtn.style.border = '3px solid white';
            viewAfterBtn.style.border = 'none';
        }
    });

    viewAfterBtn.addEventListener('click', () => {
        const isViewingDiff = !diffViewer.classList.contains('hidden');
        const isActive = viewAfterBtn.classList.contains('active-btn');
        if (isViewingDiff && isActive) scrollToNextChange();
        else {
            renderDiff('after');
            viewAfterBtn.classList.add('active-btn');
            viewBeforeBtn.classList.remove('active-btn');
            viewAfterBtn.style.border = '3px solid white';
            viewBeforeBtn.style.border = 'none';
        }
    });

    diffViewer.addEventListener('click', () => {
        if (!diffViewer.classList.contains('hidden')) {
            diffViewer.classList.add('hidden');
            contentInput.classList.remove('hidden');
            viewBeforeBtn.classList.remove('active-btn');
            viewAfterBtn.classList.remove('active-btn');
            viewBeforeBtn.style.border = 'none';
            viewAfterBtn.style.border = 'none';
        }
    });

    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) return;
        if (diffViewer.classList.contains('hidden')) {
            const text = contentInput.value;
            const index = text.indexOf(query, contentInput.selectionEnd);
            const finalIndex = index !== -1 ? index : text.indexOf(query);
            if (finalIndex !== -1) {
                contentInput.focus();
                contentInput.setSelectionRange(finalIndex, finalIndex + query.length);
                contentInput.scrollTop = (text.substring(0, finalIndex).split('\n').length - 5) * 28;
            } else showToast('찾는 내용이 없습니다.', 'warning');
        } else if (window.find && !window.find(query)) showToast('찾는 내용이 없습니다.', 'warning');
    });

    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchBtn.click(); });

    fileUploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.txt')) return showToast('.txt 파일만 가능합니다.', 'warning');
        const reader = new FileReader();
        reader.onload = (event) => {
            resetEditor();
            contentInput.value = event.target.result;
            showToast('파일을 불러왔습니다.', 'success');
            triggerAutoSave();
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    async function loadScript(id) {
        try {
            const script = await api.getScript(id);
            currentScriptId = script.id;
            contentInput.value = script.content || '';
            deleteBtn.style.display = 'inline-flex';
            saveStatus.textContent = '대본을 불러왔습니다.';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) { showToast('로드 실패: ' + err.message, 'error'); }
    }

    async function saveScript() {
        const content = contentInput.value.trim();
        if (!content) return;
        const title = content.split('\n')[0].substring(0, 30).trim() || `무제 (${new Date().toLocaleTimeString()})`;
        try {
            if (currentScriptId) await api.updateScript(currentScriptId, { title, content });
            else {
                const newScript = await api.addScript({ title, content });
                currentScriptId = newScript.id;
                deleteBtn.style.display = 'inline-flex';
            }
            saveStatus.textContent = `저장됨: ${new Date().toLocaleTimeString()}`;
        } catch (err) { saveStatus.textContent = '❌ 저장 실패'; }
    }

    function triggerAutoSave() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(saveScript, 3000);
    }
    contentInput.addEventListener('input', triggerAutoSave);

    exportBtn.addEventListener('click', () => {
        const content = contentInput.value.trim();
        if (!content) return;
        const fileName = `${content.split('\n')[0].substring(0, 20) || '제목없음'} 편집완료.txt`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        saveScript();
    });

    newBtn.addEventListener('click', () => resetEditor());
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('삭제하시겠습니까?')) return;
        try {
            await api.deleteScript(currentScriptId);
            newBtn.click();
        } catch (err) { showToast('삭제 실패', 'error'); }
    });

    // --- [View All Logic] ---
    function openViewAll() {
        const content = contentInput.value.trim();
        if (!content) return showToast('내용이 없습니다.', 'warning');
        sentencesGlobal = content.split(/([.?!]\s+)/).reduce((acc, part, i) => {
            if (i % 2 === 0) acc.push(part);
            else acc[acc.length - 1] += part;
            return acc;
        }, []);
        viewAllText.innerHTML = sentencesGlobal.map((s, idx) => `<span class="tts-sentence" data-idx="${idx}" style="cursor: pointer; transition: background 0.3s; border-radius: 4px;">${s}</span>`).join('');
        viewAllText.querySelectorAll('.tts-sentence').forEach(span => {
            span.addEventListener('click', () => {
                currentSentenceIdx = parseInt(span.dataset.idx);
                if (isTtsSpeaking) speakCurrentSentence();
                else startTTS();
            });
        });
        viewAllOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeViewAllFunc() {
        stopTTS();
        viewAllOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
    viewAllBtn.addEventListener('click', openViewAll);
    closeViewAll.addEventListener('click', closeViewAllFunc);

    const handleGlobalKeyDown = (e) => {
        if (e.key === 'Escape' && !viewAllOverlay.classList.contains('hidden')) closeViewAllFunc();
        if (e.key === ' ' && !viewAllOverlay.classList.contains('hidden')) {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            e.preventDefault();
            if (isTtsSpeaking) {
                if (window.speechSynthesis.paused) window.speechSynthesis.resume();
                else window.speechSynthesis.pause();
            } else startTTS();
        }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);

    // --- [TTS Logic] ---
    function getKoreanFemaleVoice() {
        const voices = window.speechSynthesis.getVoices();
        return voices.find(v => v.lang.startsWith('ko') && (v.name.includes('Female') || v.name.includes('Heami') || v.name.includes('다혜') || v.name.includes('유미')))
            || voices.find(v => v.lang.startsWith('ko')) || null;
    }

    function updateTTSButtons(speaking) {
        ttsPlayBtn.classList.toggle('hidden', speaking);
        ttsStopBtn.classList.toggle('hidden', !speaking);
        if (vaTtsPlay) vaTtsPlay.classList.toggle('hidden', speaking);
        if (vaTtsStop) vaTtsStop.classList.toggle('hidden', !speaking);
    }

    function startTTS() {
        if (sentencesGlobal.length === 0) openViewAll(); // Pre-process if needed
        isTtsSpeaking = true;
        updateTTSButtons(true);
        speakCurrentSentence();
    }

    function speakCurrentSentence() {
        if (!isTtsSpeaking || currentSentenceIdx >= sentencesGlobal.length) {
            isTtsSpeaking = false;
            updateTTSButtons(false);
            if (currentSentenceIdx >= sentencesGlobal.length) {
                currentSentenceIdx = 0;
                viewAllText.querySelectorAll('.tts-sentence').forEach(s => s.style.background = 'transparent');
            }
            return;
        }
        const text = sentencesGlobal[currentSentenceIdx];
        if (!text || !text.trim()) {
            currentSentenceIdx++;
            return speakCurrentSentence();
        }

        // Cancel pending but don't call speakCurrentSentence recursively from here to avoid loops
        // Only the actual speed button listener should trigger the restart via cancel + onend
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const voice = getKoreanFemaleVoice();
        if (voice) utterance.voice = voice;
        utterance.rate = ttsRate;
        utterance.pitch = 1.1;
        utterance.volume = isMuted ? 0 : parseFloat(vaTtsVolume.value || ttsVolume.value);

        utterance.onstart = () => {
            const targetSpan = viewAllText.querySelector(`.tts-sentence[data-idx="${currentSentenceIdx}"]`);
            if (targetSpan) {
                viewAllText.querySelectorAll('.tts-sentence').forEach(s => s.style.background = 'transparent');
                targetSpan.style.background = 'rgba(var(--accent-rgb), 0.25)';
                targetSpan.scrollIntoView({ behavior: ttsRate > 1.2 ? 'auto' : 'smooth', block: 'center' });
            }
        };

        utterance.onend = () => {
            if (!isTtsSpeaking) return;
            if (isChangingSpeed) {
                isChangingSpeed = false;
                speakCurrentSentence(); // Re-read current sentence with new rate
            } else {
                currentSentenceIdx++;
                speakCurrentSentence();
            }
        };

        utterance.onerror = (e) => {
            if (e.error === 'interrupted' || e.error === 'canceled') {
                if (isTtsSpeaking && isChangingSpeed) {
                    isChangingSpeed = false;
                    speakCurrentSentence();
                }
            } else {
                isTtsSpeaking = false;
                updateTTSButtons(false);
            }
        };

        window.speechSynthesis.speak(utterance);
    }

    function stopTTS() { isTtsSpeaking = false; window.speechSynthesis.cancel(); updateTTSButtons(false); }

    ttsPlayBtn.addEventListener('click', startTTS);
    ttsStopBtn.addEventListener('click', stopTTS);
    if (vaTtsPlay) vaTtsPlay.addEventListener('click', startTTS);
    if (vaTtsStop) vaTtsStop.addEventListener('click', stopTTS);

    const syncVolume = (e) => {
        const val = e.target.value;
        if (ttsVolume) ttsVolume.value = val;
        if (vaTtsVolume) vaTtsVolume.value = val;
        if (val > 0) isMuted = false;
        updateMuteUI();
        if (isTtsSpeaking) {
            isChangingSpeed = true;
            window.speechSynthesis.cancel();
        }
    };
    ttsVolume.addEventListener('input', syncVolume);
    if (vaTtsVolume) vaTtsVolume.addEventListener('input', syncVolume);

    function updateMuteUI() {
        if (!vaTtsMute) return;
        vaTtsMute.textContent = (isMuted || (vaTtsVolume && parseFloat(vaTtsVolume.value) === 0)) ? '🔇' : '🔈';
    }

    if (vaTtsMute) {
        vaTtsMute.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) { lastVolume = parseFloat(vaTtsVolume.value) || 1.0; vaTtsVolume.value = 0; if (ttsVolume) ttsVolume.value = 0; }
            else { vaTtsVolume.value = lastVolume; if (ttsVolume) ttsVolume.value = lastVolume; }
            updateMuteUI();
            if (isTtsSpeaking) {
                isChangingSpeed = true;
                window.speechSynthesis.cancel();
            }
        });
    }

    vaSpeedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ttsRate = parseFloat(btn.dataset.speed);
            vaSpeedBtns.forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; });
            btn.style.background = 'var(--accent)'; btn.style.color = 'white';
            if (isTtsSpeaking) {
                isChangingSpeed = true;
                window.speechSynthesis.cancel();
            }
        });
    });

    listBtn.addEventListener('click', async () => {
        try {
            const scripts = await api.getScripts();
            if (scripts.length === 0) return showToast('저장된 대본이 없습니다.', 'info');
            showModal('내 대본 목록', `<div style="max-height:400px; overflow-y:auto; padding:10px;">${scripts.map(s => `<div class="list-item script-item" data-id="${s.id}" style="padding:16px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:800; font-size:1.15rem; color:var(--text-primary);">${s.title}</div><div style="font-size:0.95rem; color:var(--text-muted); margin-top:4px;">최종 수정: ${new Date(s.updated_at).toLocaleString()}</div></div><span class="icon">➡️</span></div>`).join('')}</div>`, []);
            document.querySelectorAll('.script-item').forEach(el => { el.addEventListener('click', () => { loadScript(el.dataset.id); document.getElementById('modal-overlay').classList.add('hidden'); }); });
        } catch (err) { showToast('목록 로드 실패', 'error'); }
    });

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    if (urlParams.get('ideaId')) {
        try {
            const ideas = await api.getIdeas();
            const idea = ideas.find(i => String(i.id) === String(urlParams.get('ideaId')));
            if (idea) { resetEditor(true); contentInput.value = (idea.notes || idea.description || ''); saveStatus.textContent = '아이디어에서 불러옴'; }
        } catch (e) { }
    } else if (urlParams.get('source') === 'video') {
        const pc = localStorage.getItem('pending_script_content');
        if (pc) { resetEditor(true); contentInput.value = pc; saveStatus.textContent = '영상 대본에서 불러옴'; localStorage.removeItem('pending_script_content'); }
    }
}
