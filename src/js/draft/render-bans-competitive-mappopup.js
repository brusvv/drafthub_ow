// @hash aec0646e 2026-07-16T09:06
// ════════════════════════════════════════════════════════════
// render-bans-competitive-mappopup.js — попап выбора карты матча
// (соревновательный режим банов)
//
// Вынесено из render-bans-competitive.js (FILESPLIT, 15.07, было 318
// строк) — самодостаточный кусок: единственная точка входа снаружи —
// openCompMapPopup(), вызывается из _renderCompControls() того файла.
// Пишет в module-level compBanMap (store.js) и создаёт/удаляет overlay
// #compMapPopup напрямую через DOM, без вызовов остального
// render-bans-competitive.js, кроме renderBans() (глобальная, core).
//
// Зависимости: maps/mapImg/mapTypeIcon (core/config.js), esc (render-utils.js),
// renderBans() (render-bans-core.js), compBanMap (core/store.js).
// ════════════════════════════════════════════════════════════

function openCompMapPopup() {
  const types    = ['Control', 'Hybrid', 'Push', 'Escort', 'Flashpoint'];
  const groupHtml = types.map(t => {
    const ms = maps.filter(m => m.type === t);
    if (!ms.length) return '';

    const chips = ms.map(m => {
      const src = mapImg(m.name);
      const sel = compBanMap === m.name;
      return `<button type="button" class="btn-reset"
          onclick="compBanMap='${esc(m.name)}';closeCompMapPopup();renderBans();"
          style="cursor:pointer;border-radius:8px;overflow:hidden;
                 border:2px solid ${sel ? 'var(--support)' : 'var(--border)'};
                 background:${sel ? 'rgba(43,189,142,.08)' : 'var(--bg3)'};
                 transition:all .1s;width:124px">
        ${src
          ? `<img src="${src}" style="width:100%;height:70px;object-fit:cover;display:block"
                  onerror="this.style.display='none'">`
          : `<div style="width:100%;height:70px;background:var(--bg4);display:flex;
                         align-items:center;justify-content:center;
                         font-size:11px;font-weight:700;color:var(--text3)">
               ${m.name[0]}
             </div>`}
        <div style="padding:5px 6px;font-size:12px;font-weight:600;text-align:center;
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${m.name}
        </div>
      </button>`;
    }).join('');

    return `<div style="margin-bottom:14px">
      <div style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);text-transform:uppercase;
                  letter-spacing:.08em;color:var(--text3);margin-bottom:6px;
                  display:flex;align-items:center;gap:4px">
        ${mapTypeIcon(t, 12)} ${t}
      </div>
      <div class="chip-row-lg">${chips}</div>
    </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'compMapPopup';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.75);
    backdrop-filter:blur(4px);display:flex;align-items:center;
    justify-content:center;z-index:3000;padding:1rem`;
  overlay.onclick = e => { if (e.target === overlay) closeCompMapPopup(); };
  overlay.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:14px;
                width:100%;max-width:720px;max-height:84vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  padding:1rem 1.25rem;border-bottom:1px solid var(--border)">
        <span style="font-size:15px;font-weight:700">Выбрать карту матча</span>
        <button style="background:none;border:none;color:var(--text3);font-size:18px;
                       cursor:pointer;padding:2px 6px"
                onclick="closeCompMapPopup()">×</button>
      </div>
      <div style="overflow-y:auto;padding:1.25rem">${groupHtml}</div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeCompMapPopup() {
  const el = document.getElementById('compMapPopup');
  if (el) el.remove();
}
