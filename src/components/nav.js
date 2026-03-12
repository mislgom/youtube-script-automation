// Top navigation bar component
export function renderNav(container, currentPath, navigate) {
  const menuItems = [
    { path: '/', icon: '📊', label: '대시보드' },
    { path: '/search', icon: '🔥', label: '떡상 검색' },
    { path: '/channels', icon: '📺', label: '채널 관리' },
    { path: '/videos', icon: '🎬', label: '영상 관리' },

    { path: '/gaps', icon: '⭕', label: '갭 분석' },
    { path: '/skeleton', icon: '✨', label: '대본 뼈대' },
    { path: '/editor', icon: '📝', label: '대본 편집' },
    { path: '/ideas', icon: '💡', label: '아이디어' },
    { path: '/settings', icon: '⚙️', label: '설정' }
  ];

  container.innerHTML = `
    <div class="topnav-inner">
      <div class="topnav-logo" style="cursor:pointer;" data-path="/">📋 주제 분석기</div>
      <div class="topnav-menu">
        ${menuItems.map(item => `
          <button class="topnav-item ${currentPath === item.path ? 'active' : ''}" data-path="${item.path}">
            <span class="topnav-icon">${item.icon}</span>
            <span class="topnav-label">${item.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="topnav-actions">
        <button class="topnav-action-btn" id="topnav-search-btn" title="통합 검색 (Ctrl+K)">🔎</button>
        <button class="topnav-action-btn" id="topnav-idea-btn" title="새 아이디어 (Ctrl+N)">➕</button>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-path]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.path));
  });

  document.getElementById('topnav-search-btn')?.addEventListener('click', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  });

  document.getElementById('topnav-idea-btn')?.addEventListener('click', () => {
    navigate('/ideas');
  });
}
