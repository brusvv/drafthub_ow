// @hash 81d85953 2026-07-19T10:03
// ════ RENDER — DRAFT COMP: ФАЗА 3 (РЕКОМЕНДАЦИИ) ════
// Вынесено из render-draft-comp.js (16.07, AUDIT-A3-попутный split — файл
// перевалил за 260 строк). Граница по фазам, не механически — см.
// render-draft-comp.js (state/оркестратор/фаза 1) и render-draft-comp-bans.js
// (фаза 2).

// ── Фаза 3: рекомендации пика ──
function _renderDraftResult(){
  const allBans=[...draftState.ourBans,...draftState.enemyBans];
  const mapObj=maps.find(m=>m.name===draftState.selectedMap);
  const rp=rosterPlayers||[];
  const getHeroes=p=>[...new Set([...p.mainHeroes,...p.poolHeroes])];

  // Рекомендации состава
  let compHtml='';
  if(rp.length>=2){
    const comps=recommendCompositions(rp,getHeroes,mapObj,draftState.side,allBans,[],3);
    compHtml=comps.length
      ?`<div class="ban-panel-head ban-panel-head-sub"><div class="ban-panel-title">Топ-3 состава</div></div>
         ${comps.map((c,i)=>_renderCompCard(c,i+1,mapObj,draftState.side)).join('')}`
      :`<div class="ban-panel-head ban-panel-head-sub"><div class="ban-draft-lbl">Недостаточно данных для полных составов</div></div>`;
  }

  // Рекомендации по ролям (всегда)
  const byRole=recommendPicksByRole(rp.length?rp:[{mainHeroes:draftState.ourHeroes,poolHeroes:[],mainRole:''}],
    p=>[...new Set([...p.mainHeroes,...(p.poolHeroes||[])])],
    mapObj,draftState.side,allBans,3);

  return`<div class="ban-panel">
    <div class="ban-panel-head">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="ban-panel-title">Рекомендации для пика</div>
        <button class="btn fs-10" onclick="draftState.phase='bans';renderDraftComp()">← Баны</button>
      </div>
      ${mapObj?`<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
        ${mapTypeIcon(mapObj.type,13)}<span style="font-size:13px;font-weight:600">${mapObj.name}</span>
        <span class="tier-badge tier-${mapObj.tier}">${mapObj.tier}</span>
        <span class="mono-hint">${draftState.side==='avg'?'обе стороны':draftState.side==='atk'?'атака':'защита'}</span>
      </div>`:''}
      ${allBans.length?`<div style="margin-top:6px;font-family:var(--mono);font-size:var(--fluid-fs-2xs);color:var(--damage)">
        🚫 Забанено: ${allBans.join(', ')}</div>`:''}
    </div>
    <div class="ban-recs-grid mb-12">
      ${['Tank','Damage','Support'].map(role=>
        byRole[role]&&byRole[role].length
          ?`<div>
              <div class="meta-label" style="letter-spacing:.08em;color:${rc[role]};margin-bottom:6px;display:flex;align-items:center;gap:3px">${roleIcon(role,12)} ${role}</div>
              ${byRole[role].map(x=>{const src=portrait(x.name);const h=heroMap[x.name]||{};
                return`<div class="ban-rec-card" style="margin-bottom:5px">
                  <div class="ban-rec-portrait">${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-rec-ph">${x.name[0]}</div>`}</div>
                  <div class="ban-rec-body">
                    <div class="ban-rec-name">${x.name}</div>
                    <div class="ban-rec-bar-wrap"><div class="ban-rec-bar" style="width:${Math.min(100,Math.round(x.score/1.5))}%;background:${rc[role]}"></div></div>
                  </div>
                  ${x.mapStr?`<span style="font-family:var(--mono);font-size:var(--fluid-fs-2xs);color:var(--accent)">${x.mapStr}/10</span>`:''}
                </div>`;
              }).join('')}
            </div>`
          :''
      ).join('')}
    </div>
    ${compHtml}
    <button class="btn mt-12" onclick="draftState={phase:'pick',ourHeroes:[],ourBans:[],enemyBans:[],selectedMap:null,side:'avg'};renderDraftComp()">
      Новый драфт
    </button>
  </div>`;
}

function _renderCompCard(c,rank,mapObj,side){
  const byRole={Tank:[],Damage:[],Support:[]};
  c.comp.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push(n);});
  // DESIGN-1: свой счётчик на карту (не сквозной по всем карточкам-рекомендациям) —
  // каждая .comp-rec-card уже отдельная визуальная единица (как .h-card/.map-card),
  // достаточно лёгкого рывка внутри своих ~5 героев, а не через весь список карточек.
  let _cardIdx=0;
  return`<div class="comp-rec-card">
    <div class="comp-rec-rank">#${rank}</div>
    <div class="comp-rec-heroes">
      ${['Tank','Damage','Support'].flatMap(role=>byRole[role].map(n=>{
        const src=portrait(n);const str=mapObj?heroStrengthOnMap(n,mapObj,side):0;
        return`<div class="comp-rec-hero" style="--card-i:${Math.min(_cardIdx++,12)}" title="${n}${str?` — ${str}/10`:''}">
          ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="comp-rec-ph">${n[0]}</div>`}
          <div class="comp-rec-role-line" style="background:${rc[role]}"></div>
          ${str>=7?`<div class="comp-rec-str">${str}</div>`:''}
        </div>`;
      })).join('')}
    </div>
    <div class="mono-hint">Синергия: ${Math.round(compSynergyTotal(c.comp))} · Скор: ${c.score}</div>
  </div>`;
}
