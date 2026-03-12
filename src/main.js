// SPA Router + App Initialization
import { api } from './api.js';
import { renderNav } from './components/nav.js';
import { showToast } from './components/toast.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderSearch } from './pages/search.js';
import { renderChannels } from './pages/channels.js';
import { renderVideos } from './pages/videos.js';

import { renderGaps } from './pages/gaps.js';
import { renderIdeas } from './pages/ideas.js';
import { renderSkeleton } from './pages/skeleton.js';
import { renderEditor } from './pages/editor.js';
import { renderSettings } from './pages/settings.js';

const routes = {
    '/': renderDashboard,
    '/search': renderSearch,
    '/channels': renderChannels,
    '/videos': renderVideos,

    '/gaps': renderGaps,
    '/ideas': renderIdeas,
    '/skeleton': renderSkeleton,
    '/editor': renderEditor,
    '/settings': renderSettings
};

const pageCache = {};
let currentPath = '/';

function navigate(path) {
    currentPath = path;
    window.history.pushState({}, '', `#${path}`);
    renderPage();
}

function renderPage() {
    const container = document.getElementById('page-container');

    // Hide all existing cached pages
    Object.values(pageCache).forEach(el => {
        el.style.display = 'none';
    });

    // Resolve rendering function
    const renderFn = routes[currentPath] || routes['/'];
    const pathKey = routes[currentPath] ? currentPath : '/';

    // Create or retrieve cached container for the current path
    if (!pageCache[pathKey]) {
        const pageEl = document.createElement('div');
        pageEl.className = 'page-content-wrapper';
        pageEl.id = `page-${pathKey.replace(/\//g, '') || 'dashboard'}`;
        container.appendChild(pageEl);
        pageCache[pathKey] = pageEl;

        // Render for the first time
        renderFn(pageEl, { navigate, showToast, api });
    }

    // Show the current page
    pageCache[pathKey].style.display = 'block';

    // Update navigation sidebar
    renderNav(document.getElementById('sidebar'), currentPath, navigate);
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    currentPath = window.location.hash.slice(1) || '/';
    renderPage();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+K — search palette
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        toggleSearchPalette();
    }
    // Ctrl+N — new idea
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        navigate('/ideas');
    }
    // Esc — close modal/search
    if (e.key === 'Escape') {
        document.getElementById('modal-overlay')?.classList.add('hidden');
        document.getElementById('search-palette')?.classList.add('hidden');
    }
});

// Search palette
function toggleSearchPalette() {
    const palette = document.getElementById('search-palette');
    const isHidden = palette.classList.contains('hidden');
    palette.classList.toggle('hidden');
    if (isHidden) {
        palette.innerHTML = `
      <input type="text" placeholder="영상, 채널, 아이디어 통합 검색... (Esc로 닫기)" id="search-input" autocomplete="off">
      <div class="search-results" id="search-results"></div>
    `;
        const input = document.getElementById('search-input');
        input.focus();
        let debounce = null;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(async () => {
                const q = input.value.trim();
                if (q.length < 2) { document.getElementById('search-results').innerHTML = ''; return; }
                try {
                    const data = await api.search(q);
                    const results = document.getElementById('search-results');
                    results.innerHTML = '';
                    [...data.channels.map(c => ({ ...c, type: '채널' })),
                    ...data.videos.map(v => ({ ...v, type: '영상' })),
                    ...data.ideas.map(i => ({ ...i, type: '아이디어' }))
                    ].forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'search-result-item';
                        div.innerHTML = `<span class="type-badge">${item.type}</span><span>${item.title || item.name}</span>`;
                        div.addEventListener('click', () => {
                            palette.classList.add('hidden');
                            if (item.type === '채널') navigate('/channels');
                            else if (item.type === '영상') navigate('/videos');
                            else navigate('/ideas');
                        });
                        results.appendChild(div);
                    });
                } catch (e) { }
            }, 300);
        });
    }
}

// Check if first run (onboarding)
async function checkOnboarding() {
    try {
        const settings = await api.getSettings();
        if (!settings.youtube_api_key_set && !settings.gemini_api_key_set) {
            showOnboarding();
        }
    } catch (e) {
        // Server not running
        showToast('서버 연결 실패. node server/index.js를 먼저 실행해주세요.', 'error');
    }
}

function showOnboarding() {
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
    <div class="onboarding-card">
      <h2>🎬 YouTube 주제 분석기</h2>
      <p>유튜브 채널의 주제를 분석하고<br>차별화된 새로운 주제를 추천받으세요!</p>
      <div class="onboarding-steps">
        <div class="onboarding-step active"></div>
        <div class="onboarding-step"></div>
        <div class="onboarding-step"></div>
      </div>
      <p style="font-size:0.82rem; color:var(--text-muted)">
        시작하려면 ⚙️ 설정에서 API 키를 입력하세요.<br>
        또는 수동 입력으로 바로 시작할 수 있습니다.
      </p>
      <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
        <button class="btn btn-primary" onclick="this.closest('.onboarding-overlay').remove()">
          시작하기 →
        </button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);
}

// Init
currentPath = window.location.hash.slice(1) || '/';
renderPage();
checkOnboarding();
