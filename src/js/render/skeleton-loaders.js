// @hash 0839ac50 2026-07-15T00:21
// ════════════════════════════════════════════════════════════
// skeleton-loaders.js — skeleton-плейсхолдеры на время загрузки данных
// Выделено из render-utils.js (watch-list, AGENT_TASKS.md).
//
// • showLoading()         — skeleton-loader для загрузки данных
// ════════════════════════════════════════════════════════════

function showLoading(containerId, type = 'card', count = 6) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({ length: count }, () => _skeletonItem(type)).join('');
}

function _skeletonItem(type) {
  switch (type) {
    case 'player':
      return `<div class="skeleton-player">
        <div class="skeleton-line sk-avatar"></div>
        <div class="skeleton-body">
          <div class="skeleton-line sk-title"></div>
          <div class="skeleton-line sk-sub"></div>
          <div class="sk-heroes">
            ${Array.from({ length: 4 }, () => '<div class="skeleton-line sk-hero-icon"></div>').join('')}
          </div>
        </div>
      </div>`;

    case 'hero':
      return `<div class="skeleton-hero-card">
        <div class="skeleton-line sk-hero-portrait"></div>
        <div class="skeleton-line sk-title" style="margin-top:8px"></div>
        <div class="skeleton-line sk-sub" style="margin-top:4px"></div>
      </div>`;

    case 'row':
      return `<div class="skeleton-row">
        <div class="skeleton-line sk-avatar-sm"></div>
        <div class="skeleton-line sk-title flex-1"></div>
        <div class="skeleton-line sk-badge"></div>
      </div>`;

    case 'card':
    default:
      return `<div class="skeleton-card">
        <div class="skeleton-line sk-banner"></div>
        <div class="skeleton-line sk-title" style="margin-top:10px"></div>
        <div class="skeleton-line sk-sub" style="margin-top:6px"></div>
      </div>`;
  }
}
