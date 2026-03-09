// Script Editor Page
import { showToast, showModal } from '../components/toast.js';

export async function renderEditor(container, { api, navigate }) {
    container.innerHTML = `
    <div style="max-width:1400px; margin:0 auto; padding:20px 24px; display:flex; flex-direction:column; gap:14px; min-height:calc(100vh - 60px);">

      <!-- 헤더 -->
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <span style="font-size:1.3rem; font-weight:900; color:#e0e0e0;">✏️ 대본 편집</span>
        <div style="display:flex; gap:8px;">
          <button id="script-list-btn" style="background:rgba(255,255,255,0.06); color:#9ca3af; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:7px 14px; font-size:0.82rem; font-weight:600; cursor:pointer;">📁 내 대본 목록</button>
          <button id="new-header-btn" style="background:rgba(99,102,241,0.15); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:7px 14px; font-size:0.82rem; font-weight:600; cursor:pointer;">+ 새 대본</button>
        </div>
      </div>

      <!-- 1단: 지시문 박스 -->
      <div style="background:rgba(30,30,50,0.8); border:1px solid rgba(99,102,241,0.2); border-radius:12px; padding:14px 16px; display:flex; align-items:center; gap:12px;">
        <label style="font-weight:700; color:#a5b4fc; font-size:0.85rem; white-space:nowrap;">💬 지시문</label>
        <textarea id="script-instructions" placeholder="AI에게 지시할 내용을 입력하세요. (예: 더 자연스럽게 다듬어줘, 구어체로 바꿔줘, 도입부를 강조해줘)" style="flex:1; height:40px; background:rgba(15,15,30,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#e0e0e0; padding:8px 12px; font-size:0.85rem; resize:none; font-family:inherit; line-height:1.4;"></textarea>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
          <button id="start-edit-btn" style="background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; padding:7px 18px; border-radius:8px; border:none; font-size:0.82rem; font-weight:600; cursor:pointer; white-space:nowrap; transition:filter 0.15s;">🚀 수정 시작</button>
          <button id="fullview-instr-btn" style="background:rgba(99,102,241,0.15); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); padding:5px 18px; border-radius:8px; font-size:0.78rem; font-weight:600; cursor:pointer; white-space:nowrap;">🔍 전체 보기</button>
        </div>
      </div>

      <!-- 2단: 좌우 그리드 -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; flex:1; min-height:0;">

        <!-- 왼쪽: 대본 본문 -->
        <div style="background:rgba(30,30,50,0.8); border:1px solid rgba(99,102,241,0.2); border-radius:12px; display:flex; flex-direction:column; min-height:500px;">
          <!-- 헤더 -->
          <div style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:6px; flex-wrap:nowrap; flex-shrink:0;">
            <span style="font-weight:700; color:#e0e0e0; font-size:0.88rem; white-space:nowrap;">📄 대본 본문 (원본)</span>
            <span id="loaded-filename" style="color:#9ca3af; font-size:0.75rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; cursor:default;"></span>
            <div style="flex:1;"></div>
            <button id="file-upload-btn" style="background:rgba(255,255,255,0.06); color:#9ca3af; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:4px 10px; font-size:0.78rem; font-weight:600; cursor:pointer; white-space:nowrap;">📂 파일</button>
            <input type="file" id="file-input-hidden" style="display:none;" accept=".txt">
            <input id="script-search-input" type="text" placeholder="단어 검색..." style="background:rgba(15,15,30,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:4px 8px; font-size:0.78rem; color:#e0e0e0; width:80px;">
            <button id="search-next-btn" style="background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.2); border-radius:6px; padding:4px 8px; font-size:0.78rem; font-weight:600; cursor:pointer;">검색</button>
          </div>
          <!-- 본문 + 드롭존 -->
          <div id="drop-zone" style="flex:1; position:relative; display:flex; flex-direction:column; min-height:0;">
            <div id="drop-overlay" style="display:none; position:absolute; inset:0; background:rgba(99,102,241,0.1); border:3px dashed #a5b4fc; border-radius:12px; z-index:10; align-items:center; justify-content:center; pointer-events:none;">
              <span style="font-size:1.1rem; font-weight:700; color:#a5b4fc;">📂 파일을 여기에 놓으세요</span>
            </div>
            <textarea id="script-content" placeholder="이곳에 대본 내용을 자유롭게 작성하거나, 텍스트 파일을 끌어다 놓으세요..." style="flex:1; background:transparent; border:none; color:#e0e0e0; padding:16px; font-size:0.92rem; line-height:1.8; resize:none; font-family:inherit; outline:none;"></textarea>
          </div>
          <!-- 하단 바 -->
          <div style="padding:8px 14px; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px; align-items:center;">
              <span id="save-status" style="font-size:0.78rem; color:#6b7280; font-weight:500;"></span>
              <button id="new-script-btn" style="background:rgba(255,255,255,0.06); color:#9ca3af; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:5px 10px; font-size:0.78rem; font-weight:600; cursor:pointer;">📝 새 대본</button>
              <button id="spellcheck-btn" style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); border-radius:6px; padding:5px 12px; font-size:0.78rem; font-weight:600; cursor:pointer;">🔤 맞춤법 검사</button>
              <button id="delete-script-btn" style="display:none; background:rgba(239,68,68,0.1); color:#f87171; border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:5px 10px; font-size:0.78rem; font-weight:600; cursor:pointer;">🗑 삭제</button>
              <button id="view-all-btn" style="background:rgba(255,255,255,0.06); color:#9ca3af; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:5px 10px; font-size:0.78rem; font-weight:600; cursor:pointer;">👁 전체보기</button>
            </div>
            <button id="export-script-btn" style="background:linear-gradient(135deg,#ef4444,#f97316); color:#fff; border:none; border-radius:8px; padding:6px 14px; font-size:0.82rem; font-weight:700; cursor:pointer;">⬇ 다운로드</button>
          </div>
        </div>

        <!-- 오른쪽: AI 수정 결과 -->
        <div style="background:rgba(30,30,50,0.8); border:1px solid rgba(46,204,64,0.2); border-radius:12px; display:flex; flex-direction:column; min-height:500px;">
          <!-- 헤더 -->
          <div style="padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; flex-shrink:0;">
            <span style="font-weight:700; color:#6ee7b7; font-size:0.88rem;">✨ AI 수정 결과</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <button id="fullview-right-btn" style="background:rgba(46,204,64,0.1); color:#6ee7b7; border:1px solid rgba(46,204,64,0.2); border-radius:6px; padding:4px 10px; font-size:0.78rem; font-weight:600; cursor:pointer;">🔍 전체 보기</button>
              <button id="insert-to-original-btn" style="display:none; background:rgba(99,102,241,0.15); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); border-radius:6px; padding:4px 10px; font-size:0.78rem; font-weight:600; cursor:pointer;">📥 원본에 삽입</button>
              <button id="apply-edit-btn" style="display:none; background:rgba(46,204,64,0.15); color:#6ee7b7; border:1px solid rgba(46,204,64,0.2); border-radius:6px; padding:4px 10px; font-size:0.78rem; font-weight:600; cursor:pointer;">✅ 수정 적용</button>
            </div>
          </div>
          <!-- 결과 영역 -->
          <div id="ai-result-placeholder" style="flex:1; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:0.95rem; padding:40px; text-align:center; line-height:1.8;">
            <div>
              <div style="font-size:2rem; margin-bottom:12px;">🤖</div>
              <div>지시문을 입력하고 <strong style="color:#a5b4fc;">🚀 수정 시작</strong>을 누르면<br>AI가 수정한 결과가 여기에 표시됩니다.</div>
              <div style="margin-top:8px; font-size:0.78rem; color:rgba(255,255,255,0.2);">초록 밑줄: 추가/변경된 내용</div>
            </div>
          </div>
          <div id="diff-viewer" style="display:none; flex:1; font-size:0.92rem; line-height:1.8; padding:16px; background:transparent; overflow-y:auto; white-space:pre-wrap; color:#e0e0e0; font-weight:500;"></div>
          <!-- 하단 바 -->
          <div style="padding:8px 14px; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; flex-shrink:0; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px; align-items:center;">
              <span id="diff-count-label" style="font-size:0.78rem; color:#6b7280;">수정된 구간: -</span>
            </div>
            <button id="export-ai-btn" disabled style="background:rgba(46,204,64,0.12); color:#6ee7b7; border:1px solid rgba(46,204,64,0.2); border-radius:8px; padding:6px 14px; font-size:0.82rem; font-weight:700; cursor:not-allowed; opacity:0.4;">⬇ 수정본 다운로드</button>
          </div>
        </div>

      </div>
    </div>

    <!-- Modal: 지시문 전체보기 -->
    <div id="fullview-instr-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999; background:rgba(0,0,0,0.92); padding:40px; box-sizing:border-box; flex-direction:column;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
        <h3 style="margin:0; color:#a5b4fc; font-size:1.1rem; font-weight:700;">💬 지시문 전체 보기</h3>
        <button id="fullview-instr-close" style="background:rgba(255,255,255,0.08); color:#e0e0e0; border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:7px 16px; font-size:0.88rem; font-weight:600; cursor:pointer;">✕ 닫기</button>
      </div>
      <textarea id="fullview-instr-textarea" style="width:100%; height:calc(100vh - 120px); background:rgba(15,15,30,0.85); color:#e0e0e0; font-size:1rem; line-height:1.9; padding:22px; border-radius:12px; border:1px solid rgba(99,102,241,0.3); resize:none; box-sizing:border-box; font-family:inherit;"></textarea>
    </div>

    <!-- Modal: 대본 본문 전체보기 (편집 가능) -->
    <div id="fullview-left-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999; background:rgba(0,0,0,0.92); padding:40px; box-sizing:border-box; flex-direction:column;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
        <h3 style="margin:0; color:#a5b4fc; font-size:1.1rem; font-weight:700;">📄 대본 본문 전체 보기 (편집 가능)</h3>
        <button id="fullview-left-close" style="background:rgba(255,255,255,0.08); color:#e0e0e0; border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:7px 16px; font-size:0.88rem; font-weight:600; cursor:pointer;">✕ 닫기</button>
      </div>
      <textarea id="fullview-left-textarea" style="width:100%; height:calc(100vh - 120px); background:rgba(15,15,30,0.85); color:#e0e0e0; font-size:1.05rem; line-height:1.9; padding:22px; border-radius:12px; border:1px solid rgba(99,102,241,0.3); resize:none; box-sizing:border-box; font-family:inherit;"></textarea>
    </div>

    <!-- Modal: AI 수정 결과 전체보기 (읽기 전용) -->
    <div id="fullview-right-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999; background:rgba(0,0,0,0.92); padding:40px; box-sizing:border-box; flex-direction:column;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
        <h3 style="margin:0; color:#6ee7b7; font-size:1.1rem; font-weight:700;">✨ AI 수정 결과 전체 보기 (읽기 전용)</h3>
        <button id="fullview-right-close" style="background:rgba(255,255,255,0.08); color:#e0e0e0; border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:7px 16px; font-size:0.88rem; font-weight:600; cursor:pointer;">✕ 닫기</button>
      </div>
      <div id="fullview-right-content" style="width:100%; height:calc(100vh - 120px); background:rgba(15,15,30,0.85); color:#e0e0e0; font-size:1.05rem; line-height:1.9; padding:22px; border-radius:12px; border:1px solid rgba(46,204,64,0.3); box-sizing:border-box; overflow-y:auto; white-space:pre-wrap;"></div>
    </div>

    <!-- View All Overlay (TTS 읽기 모드) -->
    <div id="view-all-overlay" class="hidden" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:9000; display:flex; flex-direction:column; padding:60px; animation:animation-fade-in 0.3s;">
      <div class="flex-between" style="margin-bottom:30px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:20px;">
        <h2 style="color:var(--accent); margin:0;">👁️ 대본 전체보기 (읽기 모드)</h2>
        <div class="flex gap-16" style="align-items:center;">
          <div class="flex gap-12" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:8px 20px; border-radius:40px; align-items:center;">
            <button id="view-all-tts-play" class="btn btn-sm btn-accent" style="padding:6px 14px; font-size:1rem; border-radius:20px;">🔊 음성 듣기</button>
            <button id="view-all-tts-stop" class="btn btn-sm btn-danger hidden" style="padding:6px 14px; font-size:1rem; border-radius:20px;">⏹ 중지</button>
            <div class="flex gap-4" style="background:rgba(0,0,0,0.3); padding:2px; border-radius:20px; border:1px solid rgba(255,255,255,0.1);">
              <button class="speed-btn btn btn-sm" data-speed="1.0" style="padding:4px 10px; font-size:0.85rem; border-radius:15px; background:var(--accent); color:white;">1.0x</button>
              <button class="speed-btn btn btn-sm" data-speed="1.5" style="padding:4px 10px; font-size:0.85rem; border-radius:15px; color:var(--text-muted); background:transparent;">1.5x</button>
              <button class="speed-btn btn btn-sm" data-speed="2.0" style="padding:4px 10px; font-size:0.85rem; border-radius:15px; color:var(--text-muted); background:transparent;">2.0x</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-left:8px;">
              <button id="view-all-tts-mute" style="background:none; border:none; cursor:pointer; font-size:1.2rem; padding:0;">🔈</button>
              <input id="view-all-tts-volume" type="range" min="0" max="1" step="0.1" value="1" style="width:80px; height:6px; cursor:pointer;">
            </div>
          </div>
          <button id="close-view-all" class="btn btn-secondary" style="font-size:1.2rem; font-weight:800; padding:10px 24px; border-radius:30px;">❌ 창 닫기 (ESC)</button>
        </div>
      </div>
      <div id="view-all-text-container" style="flex:1; overflow-y:auto; font-size:1.6rem; line-height:2.2; color:var(--text-primary); white-space:pre-wrap; padding:0 40px; font-weight:500; text-align:left; max-width:1200px; margin:0 auto; width:100%;"></div>
    </div>
  `;

    // ─── DOM refs ───────────────────────────────────────────────
    const instructionsInput  = document.getElementById('script-instructions');
    const contentInput       = document.getElementById('script-content');
    const diffViewer         = document.getElementById('diff-viewer');
    const aiPlaceholder      = document.getElementById('ai-result-placeholder');
    const diffCountLabel     = document.getElementById('diff-count-label');
    const dropZone           = document.getElementById('drop-zone');
    const dropOverlay        = document.getElementById('drop-overlay');
    const startEditBtn       = document.getElementById('start-edit-btn');
    const applyEditBtn       = document.getElementById('apply-edit-btn');
    const insertToOriginalBtn = document.getElementById('insert-to-original-btn');
    const saveStatus         = document.getElementById('save-status');
    const searchInput        = document.getElementById('script-search-input');
    const searchBtn          = document.getElementById('search-next-btn');
    const fileUploadBtn      = document.getElementById('file-upload-btn');
    const fileInput          = document.getElementById('file-input-hidden');
    const exportBtn          = document.getElementById('export-script-btn');
    const exportAiBtn        = document.getElementById('export-ai-btn');
    const spellcheckBtn      = document.getElementById('spellcheck-btn');
    const newScriptBtn       = document.getElementById('new-script-btn');
    const newHeaderBtn       = document.getElementById('new-header-btn');
    const deleteBtn          = document.getElementById('delete-script-btn');
    const listBtn            = document.getElementById('script-list-btn');
    const viewAllBtn         = document.getElementById('view-all-btn');
    const viewAllOverlay     = document.getElementById('view-all-overlay');
    const viewAllText        = document.getElementById('view-all-text-container');
    const closeViewAll       = document.getElementById('close-view-all');
    const vaTtsPlay          = document.getElementById('view-all-tts-play');
    const vaTtsStop          = document.getElementById('view-all-tts-stop');
    const vaTtsVolume        = document.getElementById('view-all-tts-volume');
    const vaTtsMute          = document.getElementById('view-all-tts-mute');
    const vaSpeedBtns        = document.querySelectorAll('.speed-btn');
    // Modals
    const fullviewInstrModal    = document.getElementById('fullview-instr-modal');
    const fullviewInstrTextarea = document.getElementById('fullview-instr-textarea');
    const fullviewInstrClose    = document.getElementById('fullview-instr-close');
    const fullviewInstrBtn      = document.getElementById('fullview-instr-btn');
    const fullviewLeftModal     = document.getElementById('fullview-left-modal');
    const fullviewLeftTextarea  = document.getElementById('fullview-left-textarea');
    const fullviewLeftClose     = document.getElementById('fullview-left-close');
    const fullviewRightModal    = document.getElementById('fullview-right-modal');
    const fullviewRightContent  = document.getElementById('fullview-right-content');
    const fullviewRightClose    = document.getElementById('fullview-right-close');
    const fullviewRightBtn      = document.getElementById('fullview-right-btn');

    // ─── State ──────────────────────────────────────────────────
    let currentScriptId     = null;
    let autoSaveTimeout     = null;
    let originalTextForDiff = '';
    let editedTextForDiff   = '';
    let editAbortController = null;
    let isEditing           = false;
    // TTS
    let currentSentenceIdx  = 0;
    let sentencesGlobal     = [];
    let ttsRate             = 1.0;
    let isMuted             = false;
    let lastVolume          = 1.0;
    let isTtsSpeaking       = false;
    let isChangingSpeed     = false;

    // ─── Helpers ────────────────────────────────────────────────
    function setModalDisplay(el, show) {
        el.style.display = show ? 'flex' : 'none';
        document.body.style.overflow = show ? 'hidden' : '';
    }

    function setExportAiEnabled(enabled) {
        exportAiBtn.disabled = !enabled;
        exportAiBtn.style.opacity = enabled ? '1' : '0.4';
        exportAiBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    function setApplyBtnEnabled(enabled) {
        applyEditBtn.disabled = !enabled;
        applyEditBtn.style.opacity = enabled ? '1' : '0.4';
        applyEditBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    function clearAIResult() {
        diffViewer.style.display = 'none';
        aiPlaceholder.style.display = 'flex';
        applyEditBtn.style.display = 'none';
        insertToOriginalBtn.style.display = 'none';
        diffCountLabel.textContent = '수정된 구간: -';
        originalTextForDiff = '';
        editedTextForDiff   = '';
        setExportAiEnabled(false);
        setApplyBtnEnabled(true);
    }

    function resetEditor(silent = false) {
        currentScriptId = null;
        contentInput.value = '';
        instructionsInput.value = '';
        clearAIResult();
        deleteBtn.style.display = 'none';
        setLoadedFileName('');
        if (!silent) {
            saveStatus.textContent = '새 대본';
            showToast('편집기가 초기화되었습니다.', 'info');
        }
        contentInput.focus();
    }

    function setEditBtnStart() {
        isEditing = false;
        startEditBtn.textContent = '🚀 수정 시작';
        startEditBtn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
    }
    function setEditBtnStop() {
        isEditing = true;
        startEditBtn.textContent = '⏹ 정지';
        startEditBtn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)';
    }

    // ─── Diff Render ────────────────────────────────────────────
    function renderDiff(oldStr, newStr) {
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
                let found = false;
                const look = 20;
                for (let k = 1; k <= look; k++) {
                    if (i + k < oldStr.length && j < newStr.length && oldStr[i + k] === newStr[j]) {
                        atomicDiff.push({ type: 'removed', value: oldStr[i] }); i++; found = true; break;
                    }
                    if (j + k < newStr.length && i < oldStr.length && oldStr[i] === newStr[j + k]) {
                        atomicDiff.push({ type: 'added', value: newStr[j] }); j++; found = true; break;
                    }
                }
                if (!found) {
                    if (i < oldStr.length) { atomicDiff.push({ type: 'removed', value: oldStr[i] }); i++; }
                    if (j < newStr.length) { atomicDiff.push({ type: 'added',   value: newStr[j] }); j++; }
                }
            }
        }

        // Keep equal + added only
        let filtered = [];
        atomicDiff.forEach(a => {
            if (a.type === 'equal' || a.type === 'added') {
                if (filtered.length > 0 && filtered[filtered.length - 1].type === a.type)
                    filtered[filtered.length - 1].value += a.value;
                else
                    filtered.push({ type: a.type, value: a.value });
            }
        });

        // Merge nearby added segments
        let final = [];
        for (let k = 0; k < filtered.length; k++) {
            let cur = filtered[k];
            if (cur.type === 'added') {
                while (k + 1 < filtered.length) {
                    const gap  = filtered[k + 1];
                    const next = (k + 2 < filtered.length) ? filtered[k + 2] : null;
                    const para = /\n\s*\n/.test(gap.value);
                    if (!para && gap.type === 'equal' && (gap.value.length < 12 || /^[ \t\n\r.,!?;:()]+$/.test(gap.value)) && next && next.type === 'added') {
                        cur.value += gap.value + next.value; k += 2; continue;
                    }
                    break;
                }
            }
            final.push(cur);
        }

        let html = '';
        let changeCount = 0;
        final.forEach(seg => {
            if (seg.type === 'equal') {
                html += seg.value;
            } else {
                changeCount++;
                html += `<span class="diff-change" style="background:rgba(46,204,64,0.1); border-bottom:2px solid #6ee7b7; color:#6ee7b7; font-weight:700; padding:1px 0;">${seg.value}</span>`;
            }
        });

        diffViewer.innerHTML = html || newStr;
        diffViewer.style.display = 'block';
        aiPlaceholder.style.display = 'none';
        applyEditBtn.style.display = 'block';
        insertToOriginalBtn.style.display = 'block';
        setApplyBtnEnabled(true);
        setExportAiEnabled(false);
        diffCountLabel.textContent = `수정된 구간: ${changeCount}개`;
    }

    // ─── Edit Button ────────────────────────────────────────────
    startEditBtn.addEventListener('click', async () => {
        if (isEditing) {
            if (editAbortController) editAbortController.abort();
            return;
        }
        const content = contentInput.value.trim();
        if (!content) return showToast('대본 내용을 먼저 입력해주세요.', 'warning');

        editAbortController = new AbortController();
        setEditBtnStop();
        clearAIResult();
        aiPlaceholder.style.display = 'flex';
        aiPlaceholder.innerHTML = `<div><div style="font-size:1.8rem; margin-bottom:10px;">⏳</div><div style="color:#a5b4fc; font-size:0.9rem; font-weight:600;">AI가 대본을 수정하고 있습니다...<br><span style="color:rgba(255,255,255,0.35); font-size:0.8rem;">잠시만 기다려주세요</span></div></div>`;

        try {
            originalTextForDiff = contentInput.value;
            const data = await api.editScript(content, instructionsInput.value.trim(), editAbortController.signal);
            editedTextForDiff = data.content;
            if (data.parts && data.parts.length > 0) {
                renderPartsResult(data);
            } else {
                renderDiff(originalTextForDiff, editedTextForDiff);
            }
            showToast('대본 수정이 완료되었습니다!', 'success');
        } catch (err) {
            if (err.name === 'AbortError') {
                aiPlaceholder.innerHTML = `<div><div style="font-size:1.8rem; margin-bottom:10px;">⏹</div><div style="color:#a5b4fc; font-size:0.9rem; font-weight:600;">수정이 중단되었습니다.</div></div>`;
                showToast('대본 수정을 중단하였습니다.', 'warning');
            } else {
                aiPlaceholder.innerHTML = `<div><div style="font-size:1.8rem; margin-bottom:10px;">❌</div><div style="color:#f87171; font-size:0.9rem; font-weight:600;">수정 실패: ${err.message}</div></div>`;
                showToast('수정 실패: ' + err.message, 'error');
            }
        } finally {
            setEditBtnStart();
            editAbortController = null;
        }
    });

    // ─── Parts Result Render ─────────────────────────────────────
    function renderPartsResult(data) {
        const { parts = [], total_parts = 1, modified_parts = 0 } = data;
        // Track per-part corrected texts for selective apply
        // Store on diffViewer dataset for access in apply handler
        diffViewer._partsData = parts;
        diffViewer._partsOriginal = originalTextForDiff;

        let html = '';

        // Summary bar
        html += `<div style="background:rgba(99,102,241,0.08); border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:0.85rem; color:#a5b4fc;">
            📋 총 ${total_parts}파트 중 ${modified_parts}파트 수정됨
        </div>`;

        for (const part of parts) {
            if (part.modified) {
                const changesCount = part.changes ? part.changes.length : 0;
                const cardId = `part-card-${part.part_number}`;
                const detailId = `part-detail-${part.part_number}`;
                const cbId = `part-cb-${part.part_number}`;

                html += `<div id="${cardId}" style="border:1px solid rgba(46,204,64,0.3); border-radius:8px; margin-bottom:10px;">`;
                // header
                html += `<div class="part-header" data-detail="${detailId}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(46,204,64,0.08); cursor:pointer; border-radius:8px 8px 0 0; user-select:none;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="${cbId}" class="part-checkbox" data-part="${part.part_number}" checked style="width:15px; height:15px; cursor:pointer; accent-color:#6ee7b7;">
                        <span style="font-weight:700; color:#e0e0e0; font-size:0.88rem;">${part.part_number}파트</span>
                        <span style="color:#6ee7b7; font-size:0.82rem;">✅ 수정됨 (${changesCount}건)</span>
                        ${part.summary ? `<span style="color:rgba(255,255,255,0.35); font-size:0.78rem;">${part.summary}</span>` : ''}
                    </div>
                    <span class="part-toggle-arrow" style="color:#6b7280; font-size:0.8rem; transition:transform 0.2s;">▼</span>
                </div>`;

                // detail (expanded by default)
                html += `<div id="${detailId}" style="padding:10px 14px; border-top:1px solid rgba(46,204,64,0.1);">`;
                if (part.changes && part.changes.length > 0) {
                    for (const change of part.changes) {
                        if (change.action === 'delete') {
                            html += `<div style="margin-bottom:8px; background:rgba(239,68,68,0.07); border-radius:6px; padding:6px 10px;">
                                <span style="color:#f87171; text-decoration:line-through; font-size:0.85rem;">${escHtml(change.original || '')}</span>
                                ${change.reason ? `<div style="color:rgba(255,255,255,0.3); font-size:0.78rem; margin-top:3px;">이유: ${escHtml(change.reason)}</div>` : ''}
                            </div>`;
                        } else {
                            html += `<div style="margin-bottom:8px; border-radius:6px; padding:6px 10px; background:rgba(255,255,255,0.02);">
                                <span style="color:#f87171; font-size:0.85rem;">${escHtml(change.original || '')}</span>
                                <span style="color:#6b7280; margin:0 6px;">→</span>
                                <span style="color:#6ee7b7; font-size:0.85rem; font-weight:600;">${escHtml(change.corrected || '')}</span>
                                ${change.reason ? `<div style="color:rgba(255,255,255,0.3); font-size:0.78rem; margin-top:3px;">이유: ${escHtml(change.reason)}</div>` : ''}
                            </div>`;
                        }
                    }
                } else {
                    html += `<div style="color:rgba(255,255,255,0.25); font-size:0.82rem; padding:4px 0;">변경 상세 정보 없음</div>`;
                }
                html += `</div>`; // detail
                html += `</div>`; // card
            } else {
                // unchanged part
                html += `<div style="border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:8px 12px; margin-bottom:10px; color:rgba(255,255,255,0.25); font-size:0.85rem;">
                    ${part.part_number}파트 ⬜ 변경 없음
                </div>`;
            }
        }

        // selective apply button
        html += `<div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button id="selective-apply-btn" style="background:rgba(46,204,64,0.15); color:#6ee7b7; border:1px solid rgba(46,204,64,0.3); padding:5px 12px; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer;">✅ 선택 파트만 적용</button>
        </div>`;

        diffViewer.innerHTML = html;
        diffViewer.style.display = 'block';
        aiPlaceholder.style.display = 'none';
        applyEditBtn.style.display = 'block';
        insertToOriginalBtn.style.display = 'block';
        setApplyBtnEnabled(true);
        setExportAiEnabled(false);
        diffCountLabel.textContent = `수정된 구간: ${modified_parts}파트`;

        // Toggle collapse on part headers
        diffViewer.querySelectorAll('.part-header').forEach(header => {
            header.addEventListener('click', e => {
                if (e.target.type === 'checkbox') return; // don't collapse on checkbox click
                const detailId = header.dataset.detail;
                const detail = document.getElementById(detailId);
                const arrow = header.querySelector('.part-toggle-arrow');
                if (!detail) return;
                const collapsed = detail.style.display === 'none';
                detail.style.display = collapsed ? 'block' : 'none';
                arrow.style.transform = collapsed ? '' : 'rotate(-90deg)';
            });
        });

        // Selective apply
        const selectiveApplyBtn = document.getElementById('selective-apply-btn');
        if (selectiveApplyBtn) {
            selectiveApplyBtn.addEventListener('click', () => {
                const partsData = diffViewer._partsData;
                if (!partsData) return;

                const checkedNums = new Set(
                    [...diffViewer.querySelectorAll('.part-checkbox:checked')].map(cb => parseInt(cb.dataset.part))
                );

                // Re-assemble: start from original, replace checked parts using server-provided corrected_text
                const origParts = splitPartsClient(originalTextForDiff);
                let result = originalTextForDiff;
                for (const p of origParts) {
                    if (checkedNums.has(p.num)) {
                        const partMeta = partsData.find(pd => pd.part_number === p.num);
                        if (partMeta && partMeta.corrected_text !== undefined) {
                            result = result.replace(p.text, partMeta.corrected_text);
                        }
                    }
                }

                contentInput.value = result;
                triggerAutoSave();
                showApplyBanner();
                setApplyBtnEnabled(false);
                setExportAiEnabled(true);
                showToast(`선택한 ${checkedNums.size}개 파트가 적용되었습니다.`, 'success');
            });
        }
    }

    function escHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function splitPartsClient(text) {
        const partPattern = /[\[【\-]*\s*(\d+)\s*파트[\]】\-]*/gim;
        const parts = [];
        let lastIndex = 0;
        let lastNum = null;
        let match;
        partPattern.lastIndex = 0;
        while ((match = partPattern.exec(text)) !== null) {
            if (lastNum !== null) parts.push({ num: lastNum, text: text.slice(lastIndex, match.index) });
            lastNum = parseInt(match[1], 10);
            lastIndex = match.index;
        }
        if (lastNum !== null) parts.push({ num: lastNum, text: text.slice(lastIndex) });
        if (parts.length === 0) parts.push({ num: 0, text });
        return parts;
    }

    function showApplyBanner() {
        // 기존 배너가 있으면 제거 후 재삽입
        const existing = diffViewer.querySelector('.apply-banner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.className = 'apply-banner';
        banner.style.cssText = 'background:rgba(46,204,64,0.1); border:1px solid rgba(46,204,64,0.3); border-radius:8px; padding:8px 12px; margin-bottom:12px; text-align:center; color:#6ee7b7; font-size:0.85rem; font-weight:600;';
        banner.textContent = '✅ 수정이 원본에 적용되었습니다';
        diffViewer.prepend(banner);
    }

    applyEditBtn.addEventListener('click', () => {
        if (!editedTextForDiff || applyEditBtn.disabled) return;
        contentInput.value = editedTextForDiff;   // 원본 textarea에 수정 텍스트 삽입
        triggerAutoSave();
        showApplyBanner();                         // diff 결과는 유지, 배너만 상단 추가
        setApplyBtnEnabled(false);                 // 이미 적용됨 → 비활성화
        setExportAiEnabled(true);                  // 수정본 다운로드 활성화
        showToast('AI 수정이 원본에 적용되었습니다.', 'success');
    });


    insertToOriginalBtn.addEventListener('click', () => {
        if (!editedTextForDiff) return;
        contentInput.value = editedTextForDiff;
        triggerAutoSave();
        showToast('AI 결과가 원본에 삽입되었습니다.', 'success');
    });

    // ─── Spellcheck helpers ──────────────────────────────────────
    function splitForSpellcheck(text, maxChunkSize = 3000) {
        const chunks = [];
        const lines = text.split('\n');
        let current = '';
        for (const line of lines) {
            if (current.length + line.length + 1 > maxChunkSize && current.length > 0) {
                chunks.push(current);
                current = '';
            }
            current += (current ? '\n' : '') + line;
        }
        if (current) chunks.push(current);
        return chunks;
    }

    function removeDuplicateCorrections(corrections) {
        const seen = new Set();
        return corrections.filter(c => {
            const key = `${c.original}→${c.corrected}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function applySpellCorrections(text, corrections) {
        let result = text;
        // 긴 것부터 교체해야 부분 교체 오류 방지
        const sorted = [...corrections].sort((a, b) => (b.original || '').length - (a.original || '').length);
        for (const c of sorted) {
            if (c.original && c.corrected && c.original !== c.corrected) {
                result = result.replace(c.original, c.corrected);
            }
        }
        return result;
    }

    function setSpellcheckProgress(current, total) {
        aiPlaceholder.innerHTML = `<div>
            <div style="font-size:1.8rem; margin-bottom:10px;">🔤</div>
            <div style="color:#fbbf24; font-size:0.9rem; font-weight:600;">맞춤법 검사 중... (${current}/${total})<br>
            <span style="color:rgba(255,255,255,0.35); font-size:0.8rem;">잠시만 기다려주세요</span></div>
            <div style="margin-top:12px; background:rgba(255,255,255,0.06); border-radius:6px; height:6px; width:200px;">
                <div style="background:#fbbf24; border-radius:6px; height:6px; width:${Math.round(current/total*100)}%; transition:width 0.3s;"></div>
            </div>
        </div>`;
    }

    // ─── Spellcheck ──────────────────────────────────────────────
    spellcheckBtn.addEventListener('click', async () => {
        if (isEditing) return showToast('AI 수정 중에는 사용할 수 없습니다.', 'warning');
        const text = contentInput.value.trim();
        if (!text) return showToast('검사할 텍스트가 없습니다.', 'warning');

        spellcheckBtn.disabled = true;
        spellcheckBtn.textContent = '🔄 검사 중...';

        clearAIResult();
        aiPlaceholder.style.display = 'flex';

        // 청크 분할 (3,000자, 줄 경계)
        const chunks = splitForSpellcheck(text, 3000);
        let allCorrections = [];

        for (let i = 0; i < chunks.length; i++) {
            spellcheckBtn.textContent = `🔄 검사 중... (${i + 1}/${chunks.length})`;
            setSpellcheckProgress(i + 1, chunks.length);

            try {
                const res = await fetch('/api/analysis/spellcheck', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: chunks[i] })
                });

                if (!res.ok) { console.warn(`청크 ${i + 1} HTTP ${res.status}, 건너뜀`); continue; }

                const raw = await res.text();
                let data;
                try {
                    data = JSON.parse(raw);
                } catch {
                    const match = raw.match(/\{[\s\S]*\}/);
                    if (match) { try { data = JSON.parse(match[0]); } catch { continue; } }
                    else { continue; }
                }

                if (Array.isArray(data.corrections)) {
                    allCorrections = allCorrections.concat(data.corrections);
                }
            } catch (e) {
                console.warn(`청크 ${i + 1} fetch 에러:`, e);
                continue;
            }
        }

        // 중복 제거
        const corrections = removeDuplicateCorrections(allCorrections);

        // corrections 적용한 텍스트 생성 (수정 적용 버튼용)
        const correctedText = applySpellCorrections(text, corrections);
        originalTextForDiff = text;
        editedTextForDiff = correctedText;

        spellcheckBtn.disabled = false;
        spellcheckBtn.textContent = '🔤 맞춤법 검사';

        if (corrections.length === 0) {
            aiPlaceholder.style.display = 'flex';
            aiPlaceholder.innerHTML = `<div><div style="font-size:1.8rem; margin-bottom:10px;">✅</div><div style="color:#6ee7b7; font-size:0.9rem; font-weight:600;">맞춤법 오류가 없습니다!<br><span style="color:rgba(255,255,255,0.35); font-size:0.8rem;">대본이 완벽합니다</span></div></div>`;
            showToast('맞춤법 오류가 없습니다.', 'success');
            return;
        }

        // ── 제외 목록 및 재계산 함수 ─────────────────────────────
        const excludedCorrections = new Set();

        function rebuildCorrectedText() {
            let result = text;
            const active = corrections
                .filter((_, i) => !excludedCorrections.has(i))
                .sort((a, b) => (b.original || '').length - (a.original || '').length);
            for (const c of active) {
                if (c.original && c.corrected && c.original !== c.corrected) {
                    result = result.split(c.original).join(c.corrected);
                }
            }
            return result;
        }

        function updateSummaryBar() {
            const excludedCount = excludedCorrections.size;
            const summaryEl = diffViewer.querySelector('.spell-summary');
            if (summaryEl) {
                summaryEl.textContent = excludedCount > 0
                    ? `📝 맞춤법 검사 완료 — 수정 ${corrections.length}건 (제외 ${excludedCount}건)`
                    : `📝 맞춤법 검사 완료 — 수정 ${corrections.length}건`;
            }
            editedTextForDiff = rebuildCorrectedText();
        }

        // ── 결과 카드 렌더링 ──────────────────────────────────────
        let html = `<div style="padding:4px 0;">
            <div class="spell-summary" style="background:rgba(46,204,64,0.1); border:1px solid rgba(46,204,64,0.3); border-radius:8px; padding:10px 14px; margin-bottom:12px; color:#6ee7b7; font-size:0.85rem; font-weight:600;">
                📝 맞춤법 검사 완료 — 수정 ${corrections.length}건
            </div>`;

        corrections.forEach((c, idx) => {
            const typeColor = c.type === '오타' ? '#f87171' : c.type === '띄어쓰기' ? '#fbbf24' : '#a78bfa';
            const typeLabel = escHtml(c.type || '맞춤법');
            html += `<div class="spell-card" data-index="${idx}" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px 12px; margin-bottom:8px; transition:opacity 0.2s;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="background:${typeColor}22; color:${typeColor}; padding:2px 8px; border-radius:4px; font-size:0.72rem; font-weight:600;">${typeLabel}</span>
                    <span style="color:#f87171; text-decoration:line-through; font-size:0.85rem;">${escHtml(c.original || '')}</span>
                    <span style="color:#9ca3af;">→</span>
                    <span style="color:#6ee7b7; font-size:0.85rem; font-weight:600;">${escHtml(c.corrected || '')}</span>
                    <button class="spell-exclude-btn" data-index="${idx}" style="margin-left:auto; background:rgba(239,68,68,0.1); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:3px 10px; border-radius:5px; font-size:0.72rem; cursor:pointer; white-space:nowrap;">✕ 수정 안하기</button>
                </div>
                ${c.reason ? `<div style="color:#9ca3af; font-size:0.75rem; margin-top:4px;">${escHtml(c.reason)}</div>` : ''}
            </div>`;
        });

        html += '</div>';

        diffViewer.innerHTML = html;
        diffViewer.style.display = 'block';
        aiPlaceholder.style.display = 'none';
        applyEditBtn.style.display = 'block';
        insertToOriginalBtn.style.display = 'block';
        setApplyBtnEnabled(true);
        setExportAiEnabled(false);
        diffCountLabel.textContent = `수정된 구간: ${corrections.length}개`;
        showToast(`맞춤법 검사 완료: ${corrections.length}건 수정`, 'success');

        // ── 제외 버튼 이벤트 ─────────────────────────────────────
        diffViewer.querySelectorAll('.spell-exclude-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                const card = diffViewer.querySelector(`.spell-card[data-index="${idx}"]`);
                const excluded = excludedCorrections.has(idx);

                if (excluded) {
                    // 복원
                    excludedCorrections.delete(idx);
                    card.style.opacity = '1';
                    btn.textContent = '✕ 수정 안하기';
                    btn.style.background = 'rgba(239,68,68,0.1)';
                    btn.style.color = '#f87171';
                    btn.style.borderColor = 'rgba(239,68,68,0.3)';
                } else {
                    // 제외
                    excludedCorrections.add(idx);
                    card.style.opacity = '0.3';
                    btn.textContent = '↩ 복원';
                    btn.style.background = 'rgba(46,204,64,0.1)';
                    btn.style.color = '#6ee7b7';
                    btn.style.borderColor = 'rgba(46,204,64,0.3)';
                }

                updateSummaryBar();
            });
        });
    });

    // ─── Search ─────────────────────────────────────────────────
    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) return;
        const text = contentInput.value;
        const from = contentInput.selectionEnd || 0;
        const index = text.indexOf(query, from);
        const finalIndex = index !== -1 ? index : text.indexOf(query);
        if (finalIndex !== -1) {
            contentInput.focus();
            contentInput.setSelectionRange(finalIndex, finalIndex + query.length);
            contentInput.scrollTop = (text.substring(0, finalIndex).split('\n').length - 5) * 28;
        } else showToast('찾는 내용이 없습니다.', 'warning');
    });
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchBtn.click(); });

    // ─── File Upload / Drag & Drop ───────────────────────────────
    const loadedFilenameEl = document.getElementById('loaded-filename');

    function setLoadedFileName(name) {
        window._loadedFileName = name || '';
        if (loadedFilenameEl) {
            loadedFilenameEl.textContent = name ? `— ${name}` : '';
            loadedFilenameEl.title = name || '';
        }
    }

    fileUploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file || !file.name.endsWith('.txt')) return showToast('.txt 파일만 가능합니다.', 'warning');
        const reader = new FileReader();
        reader.onload = ev => {
            resetEditor(true);
            contentInput.value = ev.target.result;
            setLoadedFileName(file.name);
            showToast('파일을 불러왔습니다.', 'success');
            triggerAutoSave();
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropOverlay.style.display = 'flex'; });
    dropZone.addEventListener('dragleave', () => { dropOverlay.style.display = 'none'; });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropOverlay.style.display = 'none';
        const file = e.dataTransfer.files[0];
        if (!file || !file.name.endsWith('.txt')) return showToast('.txt 파일만 가능합니다.', 'warning');
        const reader = new FileReader();
        reader.onload = ev => {
            resetEditor(true);
            contentInput.value = ev.target.result;
            setLoadedFileName(file.name);
            showToast('파일을 불러왔습니다.', 'success');
            triggerAutoSave();
        };
        reader.readAsText(file);
    });

    // ─── Save / Load ─────────────────────────────────────────────
    async function loadScript(id) {
        try {
            const script = await api.getScript(id);
            currentScriptId = script.id;
            contentInput.value = script.content || '';
            clearAIResult();
            deleteBtn.style.display = 'block';
            saveStatus.textContent = '불러옴';
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
                const s = await api.addScript({ title, content });
                currentScriptId = s.id;
                deleteBtn.style.display = 'block';
            }
            saveStatus.textContent = `저장됨 ${new Date().toLocaleTimeString()}`;
        } catch { saveStatus.textContent = '❌ 저장 실패'; }
    }

    function triggerAutoSave() {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(saveScript, 3000);
    }
    contentInput.addEventListener('input', triggerAutoSave);

    // ─── Export ──────────────────────────────────────────────────
    exportBtn.addEventListener('click', () => {
        const content = contentInput.value.trim();
        if (!content) return;
        const loaded = window._loadedFileName || '';
        const name = loaded || '대본_무제.txt';
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: name });
        a.click(); URL.revokeObjectURL(a.href);
        saveScript();
    });

    exportAiBtn.addEventListener('click', () => {
        if (exportAiBtn.disabled) return;
        const content = editedTextForDiff;
        if (!content) return showToast('AI 수정 결과가 없습니다.', 'info');
        const loaded = window._loadedFileName || '';
        const name = loaded
            ? `수정본_${loaded.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_')}.txt`
            : '수정본_무제.txt';
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: name });
        a.click(); URL.revokeObjectURL(a.href);
    });

    // ─── New / Delete ────────────────────────────────────────────
    newScriptBtn.addEventListener('click', () => resetEditor());
    newHeaderBtn.addEventListener('click', () => resetEditor());
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('삭제하시겠습니까?')) return;
        try { await api.deleteScript(currentScriptId); resetEditor(); }
        catch { showToast('삭제 실패', 'error'); }
    });

    // ─── Script List ─────────────────────────────────────────────
    listBtn.addEventListener('click', async () => {
        try {
            const scripts = await api.getScripts();
            if (!scripts.length) return showToast('저장된 대본이 없습니다.', 'info');
            showModal('내 대본 목록', `<div style="max-height:400px; overflow-y:auto; padding:10px;">${scripts.map(s => `<div class="list-item script-item" data-id="${s.id}" style="padding:14px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:700; font-size:1rem; color:var(--text-primary);">${s.title}</div><div style="font-size:0.85rem; color:var(--text-muted); margin-top:3px;">최종 수정: ${new Date(s.updated_at).toLocaleString()}</div></div><span>➡️</span></div>`).join('')}</div>`, []);
            document.querySelectorAll('.script-item').forEach(el => {
                el.addEventListener('click', () => { loadScript(el.dataset.id); document.getElementById('modal-overlay').classList.add('hidden'); });
            });
        } catch { showToast('목록 로드 실패', 'error'); }
    });

    // ─── Fullview Modals ─────────────────────────────────────────
    fullviewInstrBtn.addEventListener('click', () => {
        fullviewInstrTextarea.value = instructionsInput.value;
        setModalDisplay(fullviewInstrModal, true);
        fullviewInstrTextarea.focus();
    });
    fullviewInstrClose.addEventListener('click', () => {
        instructionsInput.value = fullviewInstrTextarea.value;
        setModalDisplay(fullviewInstrModal, false);
    });
    fullviewInstrTextarea.addEventListener('input', () => { instructionsInput.value = fullviewInstrTextarea.value; });

    fullviewLeftClose.addEventListener('click', () => {
        contentInput.value = fullviewLeftTextarea.value;
        triggerAutoSave();
        setModalDisplay(fullviewLeftModal, false);
    });
    fullviewLeftTextarea.addEventListener('input', () => { contentInput.value = fullviewLeftTextarea.value; triggerAutoSave(); });

    fullviewRightBtn.addEventListener('click', () => {
        if (diffViewer.style.display === 'none') return showToast('AI 수정 결과가 없습니다.', 'info');
        fullviewRightContent.innerHTML = diffViewer.innerHTML;
        setModalDisplay(fullviewRightModal, true);
    });
    fullviewRightClose.addEventListener('click', () => setModalDisplay(fullviewRightModal, false));

    // ─── View All (TTS mode) ─────────────────────────────────────
    function openViewAll() {
        const content = contentInput.value.trim();
        if (!content) return showToast('내용이 없습니다.', 'warning');
        sentencesGlobal = content.split(/([.?!]\s+)/).reduce((acc, part, i) => {
            if (i % 2 === 0) acc.push(part); else acc[acc.length - 1] += part; return acc;
        }, []);
        viewAllText.innerHTML = sentencesGlobal.map((s, idx) => `<span class="tts-sentence" data-idx="${idx}" style="cursor:pointer; transition:background 0.3s; border-radius:4px;">${s}</span>`).join('');
        viewAllText.querySelectorAll('.tts-sentence').forEach(span => {
            span.addEventListener('click', () => { currentSentenceIdx = parseInt(span.dataset.idx); if (isTtsSpeaking) speakCurrentSentence(); else startTTS(); });
        });
        viewAllOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    function closeViewAllFunc() { stopTTS(); viewAllOverlay.classList.add('hidden'); document.body.style.overflow = ''; }
    viewAllBtn.addEventListener('click', openViewAll);
    closeViewAll.addEventListener('click', closeViewAllFunc);

    // ─── TTS ─────────────────────────────────────────────────────
    function getKoreanVoice() {
        const voices = window.speechSynthesis.getVoices();
        return voices.find(v => v.lang.startsWith('ko') && (v.name.includes('Female') || v.name.includes('Heami') || v.name.includes('다혜') || v.name.includes('유미')))
            || voices.find(v => v.lang.startsWith('ko')) || null;
    }
    function updateTTSButtons(speaking) {
        if (vaTtsPlay) vaTtsPlay.classList.toggle('hidden', speaking);
        if (vaTtsStop) vaTtsStop.classList.toggle('hidden', !speaking);
    }
    function startTTS() { if (!sentencesGlobal.length) openViewAll(); isTtsSpeaking = true; updateTTSButtons(true); speakCurrentSentence(); }
    function speakCurrentSentence() {
        if (!isTtsSpeaking || currentSentenceIdx >= sentencesGlobal.length) {
            isTtsSpeaking = false; updateTTSButtons(false);
            if (currentSentenceIdx >= sentencesGlobal.length) { currentSentenceIdx = 0; viewAllText.querySelectorAll('.tts-sentence').forEach(s => s.style.background = 'transparent'); }
            return;
        }
        const text = sentencesGlobal[currentSentenceIdx];
        if (!text?.trim()) { currentSentenceIdx++; return speakCurrentSentence(); }
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        const voice = getKoreanVoice();
        if (voice) utt.voice = voice;
        utt.rate = ttsRate; utt.pitch = 1.1;
        utt.volume = isMuted ? 0 : parseFloat(vaTtsVolume?.value || 1);
        utt.onstart = () => {
            const span = viewAllText.querySelector(`.tts-sentence[data-idx="${currentSentenceIdx}"]`);
            if (span) { viewAllText.querySelectorAll('.tts-sentence').forEach(s => s.style.background = 'transparent'); span.style.background = 'rgba(var(--accent-rgb),0.25)'; span.scrollIntoView({ behavior: ttsRate > 1.2 ? 'auto' : 'smooth', block: 'center' }); }
        };
        utt.onend = () => { if (!isTtsSpeaking) return; if (isChangingSpeed) { isChangingSpeed = false; speakCurrentSentence(); } else { currentSentenceIdx++; speakCurrentSentence(); } };
        utt.onerror = e => { if ((e.error === 'interrupted' || e.error === 'canceled') && isTtsSpeaking && isChangingSpeed) { isChangingSpeed = false; speakCurrentSentence(); } else { isTtsSpeaking = false; updateTTSButtons(false); } };
        window.speechSynthesis.speak(utt);
    }
    function stopTTS() { isTtsSpeaking = false; window.speechSynthesis.cancel(); updateTTSButtons(false); }
    if (vaTtsPlay) vaTtsPlay.addEventListener('click', startTTS);
    if (vaTtsStop) vaTtsStop.addEventListener('click', stopTTS);

    if (vaTtsVolume) {
        vaTtsVolume.addEventListener('input', e => {
            if (parseFloat(e.target.value) > 0) isMuted = false;
            updateMuteUI();
            if (isTtsSpeaking) { isChangingSpeed = true; window.speechSynthesis.cancel(); }
        });
    }
    function updateMuteUI() { if (vaTtsMute) vaTtsMute.textContent = (isMuted || parseFloat(vaTtsVolume?.value || 1) === 0) ? '🔇' : '🔈'; }
    if (vaTtsMute) {
        vaTtsMute.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) { lastVolume = parseFloat(vaTtsVolume.value) || 1; vaTtsVolume.value = 0; }
            else { vaTtsVolume.value = lastVolume; }
            updateMuteUI();
            if (isTtsSpeaking) { isChangingSpeed = true; window.speechSynthesis.cancel(); }
        });
    }
    vaSpeedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ttsRate = parseFloat(btn.dataset.speed);
            vaSpeedBtns.forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--text-muted)'; });
            btn.style.background = 'var(--accent)'; btn.style.color = 'white';
            if (isTtsSpeaking) { isChangingSpeed = true; window.speechSynthesis.cancel(); }
        });
    });

    // ─── Global Keyboard ─────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (fullviewInstrModal.style.display === 'flex')  { instructionsInput.value = fullviewInstrTextarea.value; setModalDisplay(fullviewInstrModal, false); return; }
            if (fullviewLeftModal.style.display  === 'flex')  { contentInput.value = fullviewLeftTextarea.value; triggerAutoSave(); setModalDisplay(fullviewLeftModal, false); return; }
            if (fullviewRightModal.style.display === 'flex')  { setModalDisplay(fullviewRightModal, false); return; }
            if (!viewAllOverlay.classList.contains('hidden')) { closeViewAllFunc(); return; }
        }
        if (e.key === ' ' && !viewAllOverlay.classList.contains('hidden')) {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            e.preventDefault();
            if (isTtsSpeaking) { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); else window.speechSynthesis.pause(); }
            else startTTS();
        }
    });

    // ─── URL Params (load from idea / video) ─────────────────────
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    if (urlParams.get('ideaId')) {
        try {
            const ideas = await api.getIdeas();
            const idea = ideas.find(i => String(i.id) === String(urlParams.get('ideaId')));
            if (idea) { resetEditor(true); contentInput.value = idea.notes || idea.description || ''; saveStatus.textContent = '아이디어에서 불러옴'; }
        } catch {}
    } else if (urlParams.get('source') === 'video') {
        const pc = localStorage.getItem('pending_script_content');
        if (pc) { resetEditor(true); contentInput.value = pc; saveStatus.textContent = '영상 대본에서 불러옴'; localStorage.removeItem('pending_script_content'); }
    }
}
