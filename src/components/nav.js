// Sidebar navigation component
export function renderNav(container, currentPath, navigate) {
  const items = [
    { path: '/', icon: '📊', label: '대시보드' },
    { path: '/search', icon: '🔥', label: '떡상 검색' },
    { path: '/channels', icon: '📺', label: '채널 관리' },
    { path: '/videos', icon: '🎬', label: '영상 관리' },
    { path: '/compare', icon: '🔍', label: '주제 비교' },
    { path: '/gaps', icon: '🕳️', label: '갭 분석' },
    { path: '/skeleton', icon: '✨', label: '대본 뼈대' },
    { path: '/editor', icon: '✍️', label: '대본 편집' },
    { path: '/ideas', icon: '💡', label: '아이디어' },
    { path: '/settings', icon: '⚙️', label: '설정' }
  ];

  container.innerHTML = `
    <div class="sidebar-logo">
      <h1>🎬 주제 분석기</h1>
      <p>YouTube Topic Analyzer</p>
    </div>
    <nav class="nav-section">
      <div class="nav-label">메뉴</div>
      ${items.map(item => `
        <div class="nav-item ${currentPath === item.path ? 'active' : ''}" data-path="${item.path}">
          <span class="icon">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="shortcut-hint">
        <kbd>Ctrl</kbd>+<kbd>K</kbd> 통합 검색<br>
        <kbd>Ctrl</kbd>+<kbd>N</kbd> 새 아이디어
      </div>
    </div>
  `;

  container.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.path));
  });
}
