// ════ RENDER — DRAFT COMP RECOMMENDATIONS ════
// Соревновательный режим: выбор героев → баны → рекомендации пика

// Состояние
let draftState={
  phase:'pick',          // 'pick' | 'bans' | 'result'
  ourHeroes:[],          // наш выбранный пул (до 5)
  ourBans:[],            // наши 2 бана
  enemyBans:[],          // вражеские 2 бана (введённые вручную или 0–2)
  selectedMap:null,      // карта матча
  side:'avg',            // 'atk'|'def'|'avg'
};

function renderDraftComp(){
  const bg=document.getElementById('bansGrid');if(!bg)return;
  if(draftState.phase==='pick') bg.innerHTML=_renderDraftPick();
  else if(draftState.phase==='bans') bg.innerHTML=_renderDraftBans();
  else bg.innerHTML=_renderDraftResult();
}

// ── Фаза 1: выбираем наших героев и карту ──
function _renderDraftPick(){
  const rp=rosterPlayers||[];
  const hasRoster=rp.length>0;
  return`<div class="ban-panel">
    <div class="ban-panel-head">
      <div class="ban-panel-title">Соревновательный — Подготовка</div>
      <div class="ban-panel-hint">Выбери карту и героев которых планируете играть. Затем введи итоговые баны.</div>
    </div>
    <div class="ban-draft-controls">
      <div class="ban-draft-ctrl">
        <div class="ban-draft-lbl">Карта матча</div>
        <select class="form-select" id="draftMapSel" onchange="draftState.selectedMap=this.value;renderDraftComp()" style="font-size:13px">
          <option value="">— не выбрана —</option>
          ${maps.sort((a,b)=>a.name.localeCompare(b.name)).map(m=>
            `<option value="${esc(m.name)}"${draftState.selectedMap===m.name?' selected':''}>${m.name} (${m.type})</option>`
          ).join('')}
        </select>
      </div>
      <div class="ban-draft-ctrl">
        <div class="ban-draft-lbl">Сторона</div>
        <select class="form-select" id="draftSideSel" onchange="draftState.side=this.value;renderDraftComp()" style="font-size:13px">
          <option value="avg"${draftState.side==='avg'?' selected':''}>Не важно</option>
          <option value="atk"${draftState.side==='atk'?' selected':''}>Атака</option>
          <option value="def"${draftState.side==='def'?' selected':''}>Защита</option>
        </select>
      </div>
    </div>
    <div class="ban-draft-lbl" style="margin:12px 0 6px">Наши герои</div>
    <div class="ban-hero-selector" onclick="openDraftHeroPicker()">
      ${_buildDraftChips(draftState.ourHeroes,'Нажми чтобы выбрать...')}
    </div>
    ${hasRoster?`<div style="margin-top:8px;font-family:var(--mono);font-size:9px;color:var(--text3)">
      или <span class="link-btn" onclick="loadFromRoster()">Загрузить из состава</span>
    </div>`:''}
    <button class="btn btn-primary" onclick="draftState.phase='bans';renderDraftComp()" style="margin-top:16px;padding:8px 20px">
      Перейти к банам →
    </button>
  </div>`;
}

function openDraftHeroPicker(){
  pickerMode='draftOur';pickerMax=5;pickerRoleFilter='all';
  if(!pickerSelected['draftOur'])pickerSelected['draftOur']=[...draftState.ourHeroes];
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>{b.style.display='';b.classList.toggle('active',i===0);});
  document.getElementById('pickerTitle').textContent='Наши герои (до 5)';
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

function loadFromRoster(){
  if(!rosterPlayers||!rosterPlayers.length)return;
  const all=[...new Set(rosterPlayers.flatMap(p=>[...p.mainHeroes,...p.poolHeroes]))];
  draftState.ourHeroes=all.slice(0,5);
  pickerSelected['draftOur']=[...draftState.ourHeroes];
  renderDraftComp();
}

// ── Фаза 2: вводим баны обеих команд ──
function _renderDraftBans(){
  const allBanned=[...draftState.ourBans,...draftState.enemyBans];
  return`<div class="ban-panel">
    <div class="ban-panel-head">
      <div class="ban-panel-title">Введи итоговые баны</div>
      <div class="ban-panel-hint">0–2 бана с каждой стороны. Максимум 2 героя одной роли суммарно на всю игру.</div>
      <button class="btn" onclick="draftState.phase='pick';renderDraftComp()" style="margin-top:6px;font-size:10px">← Назад</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${_renderBanSlots('ourBans','Наши баны','var(--tank)')}
      ${_renderBanSlots('enemyBans','Баны врагов','var(--damage)')}
    </div>
    ${allBanned.length?`<div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:12px">
      Забанено: ${allBanned.map(n=>`<span style="color:var(--damage)">${n}</span>`).join(', ')}
    </div>`:''}
    <button class="btn btn-primary" onclick="draftState.phase='result';renderDraftComp()" style="padding:8px 20px">
      Показать рекомендации →
    </button>
  </div>`;
}

function _renderBanSlots(key,label,color){
  const bans=draftState[key];
  return`<div>
    <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:6px">${label}</div>
    ${[0,1].map(i=>{
      const name=bans[i];
      const src=name?portrait(name):null;
      return`<div class="draft-ban-slot${name?' filled':''}"
        onclick="openDraftBanPicker('${key}',${i})" style="margin-bottom:5px">
        ${name
          ?`${src?`<img src="${src}" style="width:24px;height:24px;border-radius:4px;object-fit:cover">`:''}
             <span style="font-size:12px;font-weight:600">${name}</span>
             <span onclick="event.stopPropagation();removeDraftBan('${key}',${i})"
               style="margin-left:auto;cursor:pointer;color:var(--text3)">×</span>`
          :`<span style="font-family:var(--mono);font-size:10px;color:var(--text3)">+ Бан ${i+1}</span>`
        }
      </div>`;
    }).join('')}
  </div>`;
}

function openDraftBanPicker(key,idx){
  pickerMode=`draft_${key}_${idx}`;pickerMax=1;pickerRoleFilter='all';
  pickerSelected[pickerMode]=[draftState[key][idx]].filter(Boolean);
  document.querySelectorAll('#pickerOverlay .f-btn').forEach((b,i)=>{b.style.display='';b.classList.toggle('active',i===0);});
  document.getElementById('pickerTitle').textContent='Выбери забаненного героя';
  renderPickerGrid();
  document.getElementById('pickerOverlay').classList.remove('hidden');
}

function removeDraftBan(key,idx){
  draftState[key].splice(idx,1);
  renderDraftComp();
}

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
      ?`<div class="ban-panel-head" style="margin:16px 0 8px"><div class="ban-panel-title" style="font-size:14px">Топ-3 состава</div></div>
         ${comps.map((c,i)=>_renderCompCard(c,i+1,mapObj,draftState.side)).join('')}`
      :`<div class="ban-panel-head" style="margin:16px 0 8px"><div class="ban-draft-lbl">Недостаточно данных для полных составов</div></div>`;
  }

  // Рекомендации по ролям (всегда)
  const byRole=recommendPicksByRole(rp.length?rp:[{mainHeroes:draftState.ourHeroes,poolHeroes:[],mainRole:''}],
    p=>[...new Set([...p.mainHeroes,...(p.poolHeroes||[])])],
    mapObj,draftState.side,allBans,3);

  return`<div class="ban-panel">
    <div class="ban-panel-head">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="ban-panel-title">Рекомендации для пика</div>
        <button class="btn" onclick="draftState.phase='bans';renderDraftComp()" style="font-size:10px">← Баны</button>
      </div>
      ${mapObj?`<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
        ${mapTypeIcon(mapObj.type,13)}<span style="font-size:13px;font-weight:600">${mapObj.name}</span>
        <span class="tier-badge tier-${mapObj.tier}">${mapObj.tier}</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${draftState.side==='avg'?'обе стороны':draftState.side==='atk'?'атака':'защита'}</span>
      </div>`:''}
      ${allBans.length?`<div style="margin-top:6px;font-family:var(--mono);font-size:9px;color:var(--damage)">
        🚫 Забанено: ${allBans.join(', ')}</div>`:''}
    </div>
    <div class="ban-recs-grid" style="margin-bottom:12px">
      ${['Tank','Damage','Support'].map(role=>
        byRole[role]&&byRole[role].length
          ?`<div>
              <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:${rc[role]};margin-bottom:6px;display:flex;align-items:center;gap:3px">${roleIcon(role,12)} ${role}</div>
              ${byRole[role].map(x=>{const src=portrait(x.name);const h=heroMap[x.name]||{};
                return`<div class="ban-rec-card" style="margin-bottom:5px">
                  <div class="ban-rec-portrait">${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-rec-ph">${x.name[0]}</div>`}</div>
                  <div class="ban-rec-body">
                    <div class="ban-rec-name">${x.name}</div>
                    <div class="ban-rec-bar-wrap"><div class="ban-rec-bar" style="width:${Math.min(100,Math.round(x.score/1.5))}%;background:${rc[role]}"></div></div>
                  </div>
                  ${x.mapStr?`<span style="font-family:var(--mono);font-size:9px;color:var(--accent)">${x.mapStr}/10</span>`:''}
                </div>`;
              }).join('')}
            </div>`
          :''
      ).join('')}
    </div>
    ${compHtml}
    <button class="btn" onclick="draftState={phase:'pick',ourHeroes:[],ourBans:[],enemyBans:[],selectedMap:null,side:'avg'};renderDraftComp()" style="margin-top:12px">
      Новый драфт
    </button>
  </div>`;
}

function _renderCompCard(c,rank,mapObj,side){
  const byRole={Tank:[],Damage:[],Support:[]};
  c.comp.forEach(n=>{const h=heroMap[n];if(h&&byRole[h.role])byRole[h.role].push(n);});
  return`<div class="comp-rec-card">
    <div class="comp-rec-rank">#${rank}</div>
    <div class="comp-rec-heroes">
      ${['Tank','Damage','Support'].flatMap(role=>byRole[role].map(n=>{
        const src=portrait(n);const str=mapObj?heroStrengthOnMap(n,mapObj,side):0;
        return`<div class="comp-rec-hero" title="${n}${str?` — ${str}/10`:''}">
          ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="comp-rec-ph">${n[0]}</div>`}
          <div class="comp-rec-role-line" style="background:${rc[role]}"></div>
          ${str>=7?`<div class="comp-rec-str">${str}</div>`:''}
        </div>`;
      })).join('')}
    </div>
    <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">Синергия: ${Math.round(compSynergyTotal(c.comp))} · Скор: ${c.score}</div>
  </div>`;
}

// Override confirmPicker для драфта
const _draftBaseConfirm=window.confirmPicker||(()=>{});
window.confirmPicker=function(){
  const m=pickerMode;
  if(m==='draftOur'){
    draftState.ourHeroes=[...(pickerSelected['draftOur']||[])];
    closePicker();renderDraftComp();return;
  }
  if(m&&m.startsWith('draft_')){
    const parts=m.split('_'); // draft_{key}_{idx}
    const key=parts[1]+'_'+parts[2]; // ourBans или enemyBans
    const idx=parseInt(parts[3]);
    const sel=pickerSelected[m]||[];
    // Проверка лимита ролей
    const all=[...draftState.ourBans,...draftState.enemyBans].filter((_,i)=>{
      if(key==='ourBans')return i!==draftState.ourBans.indexOf(draftState[key][idx]);
      return true;
    });
    if(sel[0]){
      const h=heroMap[sel[0]];
      if(h){const roleCount=all.filter(n=>(heroMap[n]||{}).role===h.role).length;
        if(roleCount>=2){toast(`Максимум 2 бана роли ${h.role}`,'err');return;}
      }
      if(!draftState[key])draftState[key]=[];
      draftState[key][idx]=sel[0];
    }
    closePicker();renderDraftComp();return;
  }
  _draftBaseConfirm();
};
