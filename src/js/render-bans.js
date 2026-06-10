// ════ BANS — MODE SELECTOR ════

let banMode = 'competitive'; // 'competitive' | 'tournament'

// ── Competitive state ──
let compBanVotes = {}; // { heroName: { p1: [choice1,choice2,choice3], ... } }
let compBanMap = '';

// ── Tournament state ──
let tournMapPool = [];       // выбранный пул карт [{name,type}]
let tournCurrentMap = null;  // карта текущего матча
let tournHeroBans = { A: [], B: [] }; // забаненные герои по командам
let tournSide = 'A';         // чья очередь банить
let banDraftMap = '';
let banDraftHeroes = [];

const _confirmPickerPreBans = window.confirmPicker || (()=>{});
window.confirmPicker = function(){
  if(pickerMode === 'banHeroes'){
    banDraftHeroes = [...(pickerSelected.banHeroes || [])];
    closePicker();
    _refreshBanAssist();
  } else if(pickerMode === 'tournMapPool'){
    tournMapPool = (pickerSelected.tournMapPool || []).map(n => {
      const m = maps.find(x=>x.name===n); return m ? {name:m.name,type:m.type} : {name:n,type:''};
    });
    closePicker();
    renderBans();
  } else {
    _confirmPickerPreBans();
  }
};

function renderBans(){
  const bg = document.getElementById('bansGrid');
  if(!bg) return;

  // ── Активные баны сверху ──
  const currentBanned = heroes.filter(h => h.banned);
  const activeBansHtml = currentBanned.length ? `
    <div style="margin-bottom:1.75rem">
      <div class="section-lbl" style="margin-bottom:.75rem">Активные баны</div>
      ${_buildCurrentBanGroups(currentBanned)}
    </div>` : '';

  // ── Переключатель режима ──
  const modeSwitcher = `
    <div class="ban-mode-switcher">
      <button class="ban-mode-btn${banMode==='competitive'?' active':''}" onclick="setBanMode('competitive')">
        Соревновательный
      </button>
      <button class="ban-mode-btn${banMode==='tournament'?' active':''}" onclick="setBanMode('tournament')">
        Турнирный драфт
      </button>
    </div>`;

  const modeContent = banMode === 'competitive'
    ? _renderCompetitiveMode()
    : _renderTournamentMode();

  bg.innerHTML = activeBansHtml + modeSwitcher + modeContent;
}

function setBanMode(mode){
  banMode = mode;
  renderBans();
}

// ══════════════════════════════════════════════
// СОРЕВНОВАТЕЛЬНЫЙ РЕЖИМ
// ══════════════════════════════════════════════
// Правила: 4 бана итого (2 от каждой команды)
// Каждый игрок выбирает до 3 героев (7/5/3 очков)
// Макс 2 бана на роль

function _renderCompetitiveMode(){
  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Соревновательные баны</div>
        <div class="ban-panel-hint">Система голосования: 2 бана на команду, макс 2 героя одной роли. Каждый игрок выбирает 3 приоритета (7/5/3 очка)</div>
      </div>
      <div class="ban-draft-controls" style="margin-bottom:12px">
        <div class="ban-draft-ctrl">
          <div class="ban-draft-lbl">Карта матча</div>
          <select class="form-select" id="compBanMapSel" onchange="compBanMap=this.value;renderBans()" style="font-size:13px">
            <option value="">— не выбрана —</option>
            ${maps.sort((a,b)=>a.name.localeCompare(b.name)).map(m=>
              `<option value="${esc(m.name)}"${compBanMap===m.name?' selected':''}>${m.name} (${m.type})</option>`
            ).join('')}
          </select>
        </div>
        <div class="ban-draft-ctrl">
          <div class="ban-draft-lbl">Наши герои</div>
          <div class="ban-hero-selector" onclick="openPicker('banHeroes',5)">
            ${_buildHeroChips()}
            <span class="ban-hero-edit">✎</span>
          </div>
        </div>
      </div>
      ${_renderCompBanGrid()}
      ${_renderCompBanResult()}
    </div>`;
}

function _renderCompBanGrid(){
  // Показываем всех небаненных героев по ролям — можно кликнуть для голосования
  const byRole = {Tank:[],Damage:[],Support:[]};
  heroes.filter(h=>!h.banned).forEach(h=>{if(byRole[h.role])byRole[h.role].push(h);});

  return `
    <div class="ban-draft-lbl" style="margin-bottom:8px">Наши приоритеты бана <span style="opacity:.5;font-size:9px">(выбери до 3 героев — 1-й приоритет самый важный)</span></div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
      ${['Tank','Damage','Support'].map(role=>{
        const hs = byRole[role]; if(!hs.length) return '';
        return `<div>
          <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:${rc[role]};margin-bottom:6px;display:flex;align-items:center;gap:4px">${roleIcon(role,11)} ${role}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${hs.map(h=>{
              const votes = compBanVotes[h.name] || 0;
              const priority = _getCompPriority(h.name);
              const src = portrait(h.name);
              const activeStyle = priority
                ? `border-color:${priority===1?'var(--damage)':priority===2?'var(--accent)':'var(--text2)'};background:var(--bg3)`
                : '';
              return `<div class="comp-ban-chip ${priority?'active':''}" style="${activeStyle}" onclick="toggleCompBan('${esc(h.name)}')" title="${h.name}">
                ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="comp-ban-chip-ph">${h.name[0]}</div>`}
                ${priority?`<div class="comp-ban-priority" style="background:${priority===1?'var(--damage)':priority===2?'var(--accent)':'var(--text3)'}">P${priority}</div>`:''}
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function _getCompPriority(name){
  const v = compBanVotes; const all = [];
  Object.entries(v).forEach(([n,p])=>{ all.push({name:n,p}); });
  const found = all.find(x=>x.name===name);
  return found ? found.p : 0;
}

function toggleCompBan(name){
  const vals = Object.values(compBanVotes);
  const existing = compBanVotes[name];
  if(existing){
    delete compBanVotes[name];
    // Сдвигаем приоритеты
    const reordered = Object.entries(compBanVotes).sort((a,b)=>a[1]-b[1]);
    compBanVotes = {};
    reordered.forEach(([n,p],i)=>{ compBanVotes[n]=i+1; });
  } else {
    const count = Object.keys(compBanVotes).length;
    if(count >= 3){ toast('Максимум 3 приоритета','err'); return; }
    compBanVotes[name] = count + 1;
  }
  renderBans();
}

function _renderCompBanResult(){
  if(!Object.keys(compBanVotes).length && !banDraftHeroes.length && !compBanMap) return '';

  // Считаем очки: P1=7, P2=5, P3=3
  const weights = {1:7,2:5,3:3};
  const scored = {};
  Object.entries(compBanVotes).forEach(([name,p])=>{
    scored[name] = (scored[name]||0) + (weights[p]||0);
  });

  // Добавляем скоринг из ассистента
  const selectedMap = maps.find(m=>m.name===compBanMap);
  const recs = _computeCompRecs(selectedMap);

  return `
    <div class="ban-recs-header" style="margin-top:4px">
      <span class="ban-recs-title">Рекомендации к бану</span>
      <span class="ban-recs-algo-hint">по контрпикам и силе на карте</span>
    </div>
    ${_renderBanRecs(recs)}`;
}

function _computeCompRecs(selectedMap){
  return heroes.filter(h=>!h.banned).map(h=>{
    let score = 0; const reasons = [];
    // Из нашего голосования
    const p = compBanVotes[h.name];
    if(p){ const w = {1:7,2:5,3:3}; score += (w[p]||0) * 1.5; reasons.push({type:'meta',text:`Приоритет P${p}`}); }
    // Контрпики наших героев
    let cw = 0; const paired = [];
    banDraftHeroes.forEach(hn=>{
      const our=heroMap[hn];if(!our)return;
      const c=(our.counters||[]).find(x=>x.name===h.name);
      if(c){cw+=c.score;paired.push({hero:hn,score:c.score});}
    });
    if(cw>0){
      score+=cw*2;
      const top=paired.sort((a,b)=>b.score-a.score).slice(0,2);
      reasons.push({type:'counter',text:'Контрит: '+top.map(p=>`${p.hero}`).join(', ')});
    }
    // Карта
    if(selectedMap){
      if((h.strongMaps||[]).includes(selectedMap.name)){score+=5;reasons.push({type:'mapStrong',text:`Силён: ${selectedMap.name}`});}
      if((selectedMap.counters||[]).includes(h.name)){score+=2;reasons.push({type:'mapBan',text:'Бан-лист карты'});}
    }
    score += h.priority * 0.4;
    return {hero:h,score:Math.round(score),reasons};
  }).filter(r=>r.score>2).sort((a,b)=>b.score-a.score).slice(0,8);
}

// ══════════════════════════════════════════════
// ТУРНИРНЫЙ ДРАФТ (OWCS/FACEIT)
// ══════════════════════════════════════════════
// FT3 схема по FACEIT:
// Control:    A-ban, B-ban, A-pick, B-side
// Hybrid:     B-ban, A-ban, B-pick, A-side
// Push:       B-ban, A-pick, B-side
// Flashpoint: B-pick, A-side
// Escort:     A-ban, B-ban, A-pick, B-side
// Hero bans:  каждая команда банит 1 героя на карту, нельзя повторять роль

// Схема шагов для каждого режима
const TOURN_MODE_STEPS = {
  Control:    [{t:'ban',team:'A'},{t:'ban',team:'B'},{t:'pick',team:'A'},{t:'side',team:'B'}],
  Hybrid:     [{t:'ban',team:'B'},{t:'ban',team:'A'},{t:'pick',team:'B'},{t:'side',team:'A'}],
  Push:       [{t:'ban',team:'B'},{t:'pick',team:'A'},{t:'side',team:'B'}],
  Flashpoint: [{t:'pick',team:'B'},{t:'side',team:'A'}],
  Escort:     [{t:'ban',team:'A'},{t:'ban',team:'B'},{t:'pick',team:'A'},{t:'side',team:'B'}],
  Clash:      [{t:'ban',team:'B'},{t:'pick',team:'A'},{t:'side',team:'B'}],
};

// Порядок режимов по форматам матча
const TOURN_FORMAT_MODES = {
  1: ['Control'],
  2: ['Control','Hybrid'],
  3: ['Control','Hybrid','Push'],
  5: ['Control','Hybrid','Push','Flashpoint','Escort'],
  7: ['Control','Hybrid','Push','Flashpoint','Escort','Control','Escort'],
};
const ATTACK_DEFENSE_MODES = ['Hybrid','Escort'];

// Состояние турнирного драфта
let tDraft = {
  phase: 'pool',   // 'pool' | 'mapDraft' | 'heroBans'
  mapPool: {},     // { Control: [...], Hybrid: [...], ... }
  mapDraftSteps: [], // [{type:'ban'|'pick'|'side', team:'A'|'B', mode, done:false, value:null}]
  stepIndex: 0,
  pickedMaps: [],  // [{mode, name, sideTeam}]
  currentMapIdx: 0,
  heroBans: [],    // [{mapName, banA:null, banB:null, step:0}]
  format: 5,       // формат серии: Bo1/Bo2/Bo3/Bo5/Bo7
};

function resetTournDraft(){
  tDraft = {
    phase:'pool', mapPool:{}, mapDraftSteps:[], stepIndex:0,
    pickedMaps:[], currentMapIdx:0, heroBans:[], format: 5
  };
  renderBans();
}

function _renderTournamentMode(){
  if(tDraft.phase === 'pool') return _renderTournPoolSetup();
  if(tDraft.phase === 'mapDraft') return _renderTournMapDraft();
  if(tDraft.phase === 'heroBans') return _renderTournHeroBans();
  return '';
}

// ── Шаг 1: настройка пула карт ──
function _renderTournPoolSetup(){
  const modes = ['Control','Hybrid','Push','Flashpoint','Escort'];

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Турнирный драфт — Пул карт</div>
        <div class="ban-panel-hint">Выбери формат встречи и доступные карты для каждого режима. Bo5 использует Control → Hybrid → Push → Flashpoint → Escort; Bo7 добавляет Control и Escort.</div>
      </div>
      <div class="tourn-format-block">
        <div class="ban-draft-lbl">Формат встречи</div>
        <div class="tourn-format-picker">
          ${[1,2,3,5,7].map(fmt=>`<button class="tourn-format-btn${tDraft.format===fmt?' active':''}" onclick="setTournFormat(${fmt})">Bo${fmt}</button>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px">
        ${modes.map(mode=>{
          const avail = maps.filter(m=>m.type===mode);
          if(!avail.length) return '';
          const selected = tDraft.mapPool[mode] || [];
          return `<div>
            <div style="font-family:var(--mono);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text2);margin-bottom:8px;display:flex;align-items:center;gap:5px">
              ${mapTypeIcon(mode,14)} ${mode}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${avail.map(m=>{
                const sel = selected.includes(m.name);
                const src = mapImg(m.name);
                return `<div class="tourn-map-chip${sel?' sel':''}" onclick="toggleTournPoolMap('${esc(mode)}','${esc(m.name)}')">
                  ${src?`<img src="${src}" onerror="this.style.display='none'">`:''}
                  <span>${m.name}</span>
                  ${sel?'<div class="tourn-map-check">✓</div>':''}
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn btn-primary" onclick="startTournMapDraft()" style="padding:8px 20px">
        Начать драфт карт →
      </button>
      <button class="btn" onclick="resetTournDraft()" style="margin-left:8px">Сбросить</button>
    </div>`;
}

function setTournFormat(format){
  tDraft.format = format;
  renderBans();
}

function toggleTournPoolMap(mode, name){
  if(!tDraft.mapPool[mode]) tDraft.mapPool[mode] = [];
  const arr = tDraft.mapPool[mode];
  const idx = arr.indexOf(name);
  if(idx>=0) arr.splice(idx,1); else arr.push(name);
  renderBans();
}

function startTournMapDraft(){
  const modeOrder = TOURN_FORMAT_MODES[tDraft.format] || TOURN_FORMAT_MODES[5];
  const requiredModes = [...new Set(modeOrder)];
  const missingModes = requiredModes.filter(mode=>!(tDraft.mapPool[mode] || []).length);
  if(missingModes.length){ toast(`Для Bo${tDraft.format} добавь карты: ${missingModes.join(', ')}`,'err'); return; }
  // Строим список шагов
  const steps = [];
  modeOrder.forEach((mode, idx)=>{
    const pool = tDraft.mapPool[mode] || [];
    if(!pool.length) return;
    const scheme = _getTournModeSteps(mode, idx + 1);
    scheme.forEach(s=>steps.push({...s, mode, mapNo: idx + 1, done:false, value:null, pool:[...pool]}));
  });
  tDraft.mapDraftSteps = steps;
  tDraft.stepIndex = 0;
  tDraft.pickedMaps = [];
  if(!steps.length){ toast('Для выбранного формата нет карт в пуле','err'); return; }
  tDraft.phase = 'mapDraft';
  renderBans();
}

// ── Шаг 2: драфт карт ──
function _renderTournMapDraft(){
  const steps = tDraft.mapDraftSteps;
  const si = tDraft.stepIndex;
  const done = steps.every(s=>s.done);

  if(done){
    return `
      <div class="ban-panel">
        <div class="ban-panel-head">
          <div class="ban-panel-title">Карты выбраны</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${tDraft.pickedMaps.map((pm,i)=>{
            const m=maps.find(x=>x.name===pm.name);
            const src=mapImg(pm.name);
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--bg2);border:1px solid var(--border)">
              <span style="font-family:var(--mono);font-size:11px;color:var(--text3);width:16px">${i+1}</span>
              ${src?`<img src="${src}" style="width:48px;height:30px;object-fit:cover;border-radius:5px" onerror="this.style.display='none'">`:'' }
              <span style="font-weight:700;flex:1">${pm.name}</span>
              ${mapTypeIcon(pm.mode||m?.type||'',13)}
              <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${pm.sideTeam?`Сторона: команда ${pm.sideTeam}`:''}</span>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-primary" onclick="startTournHeroBans()" style="padding:8px 20px">
          Перейти к банам героев →
        </button>
        <button class="btn" onclick="tDraft.phase='pool';renderBans()" style="margin-left:8px">← Пул карт</button>
        <button class="btn" onclick="resetTournDraft()" style="margin-left:6px">Сбросить</button>
      </div>`;
  }

  const step = steps[si];
  const teamColor = step.team==='A'?'var(--tank)':'var(--damage)';
  const remainingInPool = (step.pool||[]).filter(n=>!steps.slice(0,si).some(s=>s.done&&s.value===n&&s.t==='ban'));

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Драфт карт Bo${tDraft.format} — шаг ${si+1}/${steps.length}</div>
        <button class="btn" onclick="tDraft.phase='pool';renderBans()" style="font-size:10px">← Пул карт</button>
      </div>

      <!-- Прогресс -->
      <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
        ${steps.map((s,i)=>{
          const col = s.t==='ban'?'var(--damage)':s.t==='pick'?'var(--support)':'var(--text3)';
          const bg = s.done?col:'var(--bg3)';
          const border = i===si?col:'var(--border)';
          const label = s.t==='ban'?'БАН':s.t==='pick'?'ПИК':'СТОРОНА';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 8px;border-radius:6px;background:${s.done?col+'22':'var(--bg3)'};border:1px solid ${border};opacity:${i>si?0.45:1};min-width:52px;text-align:center;cursor:default">
            <span style="font-family:var(--mono);font-size:8px;font-weight:700;text-transform:uppercase;color:${col}">${label}</span>
            <span style="font-family:var(--mono);font-size:8px;color:${i===si?col:'var(--text3)'}">${s.team} · ${s.mode.slice(0,3).toUpperCase()}</span>
            ${s.done&&s.value?`<span style="font-size:9px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px;display:block;color:var(--text2)">${s.value.length>9?s.value.slice(0,9)+'…':s.value}</span>`:''}
          </div>`;
        }).join('')}
      </div>

      <!-- Текущий шаг -->
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">
          ${step.t==='ban'?`🚫 Команда <span style="color:${teamColor}">${step.team}</span> банит карту`
           :step.t==='pick'?`✅ Команда <span style="color:${teamColor}">${step.team}</span> выбирает карту`
           :`🔄 Команда <span style="color:${teamColor}">${step.team}</span> выбирает сторону`}
          <span style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-left:8px">${mapTypeIcon(step.mode,12)} ${step.mode}</span>
        </div>
        ${step.t==='side'
          ? `<div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn" onclick="tournDraftAction('Атака')">⚔ Атака</button>
              <button class="btn" onclick="tournDraftAction('Защита')">🛡 Защита</button>
            </div>`
          : `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
              ${remainingInPool.map(n=>{
                const src=mapImg(n);
                return `<div class="tourn-map-chip" onclick="tournDraftAction('${esc(n)}')">
                  ${src?`<img src="${src}" onerror="this.style.display='none'">`:''}
                  <span>${n}</span>
                </div>`;
              }).join('')}
            </div>`
        }
      </div>
    </div>`;
}

function _getTournModeSteps(mode, mapNo){
  // FT4/Bo7 официально добавляет упрощённые Map 6/7 шаги поверх Bo5.
  if(mapNo === 6 && mode === 'Control') return [{t:'ban',team:'A'},{t:'pick',team:'B'},{t:'side',team:'A'}];
  if(mapNo === 7 && mode === 'Escort') return [{t:'ban',team:'B'},{t:'pick',team:'A'},{t:'side',team:'B'}];
  return TOURN_MODE_STEPS[mode] || TOURN_MODE_STEPS.Control;
}

function _getTournSideOptions(mode){
  if(ATTACK_DEFENSE_MODES.includes(mode)){
    return [
      {value:'Атака', label:'⚔ Атака'},
      {value:'Защита', label:'🛡 Защита'},
    ];
  }
  return [
    {value:'Сторона 1 / левый спавн', label:'⬅ Сторона 1'},
    {value:'Сторона 2 / правый спавн', label:'➡ Сторона 2'},
  ];
}

function _renderTournSideOptions(step){
  const hint = ATTACK_DEFENSE_MODES.includes(step.mode)
    ? 'Для Escort/Hybrid выбирается атака или защита.'
    : 'Для Control/Push/Flashpoint нет атаки и защиты — выбирается стартовая сторона/спавн.';
  return `<div class="tourn-side-options">
    <div class="tourn-side-hint">${hint}</div>
    <div class="tourn-side-buttons">
      ${_getTournSideOptions(step.mode).map(opt=>`<button class="btn" onclick="tournDraftAction('${esc(opt.value)}')">${opt.label}</button>`).join('')}
    </div>
  </div>`;
}

function _getTournSeriesBannedHeroes(currentHb){
  return [...new Set(tDraft.heroBans
    .filter(hb=>hb!==currentHb)
    .flatMap(hb=>[hb.banA,hb.banB].filter(Boolean)) )];
}

function tournDraftAction(value){
  const steps = tDraft.mapDraftSteps;
  const si = tDraft.stepIndex;
  const step = steps[si];
  step.done = true;
  step.value = value;
  if(step.t === 'pick'){
    tDraft.pickedMaps.push({name:value, mode:step.mode, mapNo:step.mapNo, sideTeam:null});
  }
  if(step.t === 'side' && tDraft.pickedMaps.length){
    tDraft.pickedMaps[tDraft.pickedMaps.length-1].sideTeam = step.team + ' → ' + value;
  }
  // Обновляем pool следующих шагов того же режима (убираем выбранный/забаненный)
  if(step.t==='ban'||step.t==='pick'){
    steps.forEach((s,i)=>{ if(i>si&&s.mode===step.mode) s.pool=(s.pool||[]).filter(n=>n!==value); });
  }
  tDraft.stepIndex = si + 1;
  renderBans();
}

// ── Шаг 3: баны героев ──
function startTournHeroBans(){
  tDraft.heroBans = tDraft.pickedMaps.map(pm=>({
    mapName: pm.name, mode: pm.mode,
    banA: null, banB: null,
    step: 0, // 0=ждём бан A, 1=ждём бан B, 2=готово
    bannedRoles: {A:[], B:[]}
  }));
  tDraft.currentMapIdx = 0;
  tDraft.phase = 'heroBans';
  renderBans();
}

function _renderTournHeroBans(){
  const allDone = tDraft.heroBans.every(hb=>hb.step>=2);

  return `
    <div class="ban-panel">
      <div class="ban-panel-head">
        <div class="ban-panel-title">Баны героев по картам</div>
        <div class="ban-panel-hint">Каждая команда банит 1 героя на карту. На одной карте нельзя повторять роль бана соперника, а один и тот же герой не может быть забанен повторно в рамках всей встречи.</div>
        <button class="btn" onclick="tDraft.phase='mapDraft';renderBans()" style="font-size:10px;margin-top:6px">← Драфт карт</button>
      </div>

      <!-- Табы карт -->
      <div style="display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap">
        ${tDraft.heroBans.map((hb,i)=>{
          const active = i===tDraft.currentMapIdx;
          const done = hb.step>=2;
          return `<div style="cursor:pointer;padding:5px 10px;border-radius:7px;border:1px solid ${active?'var(--border3)':'var(--border)'};background:${active?'var(--bg3)':'transparent'};font-size:12px;font-weight:${active?700:500}" onclick="tDraft.currentMapIdx=${i};renderBans()">
            ${mapTypeIcon(hb.mode,11)} ${hb.mapName} ${done?'✓':''}
          </div>`;
        }).join('')}
      </div>

      ${_renderCurrentMapHeroBan()}

      <!-- Итоговые рекомендации по всем картам -->
      ${allDone ? _renderTournFinalRecs() : ''}

      <button class="btn" onclick="resetTournDraft()" style="margin-top:12px">Сбросить всё</button>
    </div>`;
}

function _renderCurrentMapHeroBan(){
  const hb = tDraft.heroBans[tDraft.currentMapIdx];
  if(!hb) return '';
  const m = maps.find(x=>x.name===hb.mapName);
  const src = mapImg(hb.mapName);

  const teamBanHtml = (team) => {
    const ban = team==='A'?hb.banA:hb.banB;
    const color = team==='A'?'var(--tank)':'var(--damage)';
    if(ban){
      const bsrc=portrait(ban);
      return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;background:var(--bg3);border:1px solid rgba(224,85,85,.3)">
        ${bsrc?`<img src="${bsrc}" style="width:24px;height:24px;border-radius:4px;object-fit:cover">`:''}
        <span style="font-size:12px;font-weight:700;color:var(--damage)">${ban}</span>
        <span style="font-family:var(--mono);font-size:9px;color:${color}">Команда ${team}</span>
      </div>`;
    }
    if(hb.step === (team==='A'?0:1)){
      return `<div style="font-family:var(--mono);font-size:10px;color:${color};padding:6px 0">Команда ${team} выбирает бан...</div>`;
    }
    return `<div style="font-family:var(--mono);font-size:10px;color:var(--text3);padding:6px 0">Ожидание...</div>`;
  };

  // Какие герои недоступны: роль уже использована на карте, герой уже банился в серии
  const currentTeam = hb.step===0?'A':'B';
  const bannedRoles = [...new Set([...(hb.bannedRoles.A||[]),...(hb.bannedRoles.B||[])])];
  const seriesBannedHeroes = _getTournSeriesBannedHeroes(hb);

  // Рекомендации для текущего бана
  const recs = hb.step<2 ? _computeTournBanRecs(m, bannedRoles, seriesBannedHeroes) : [];

  return `
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      ${src?`<img src="${src}" style="width:120px;height:70px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display='none'">`:'' }
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">${hb.mapName}</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${teamBanHtml('A')}
          ${teamBanHtml('B')}
        </div>
      </div>
    </div>

    ${hb.step<2 ? `
      <div class="ban-draft-lbl" style="margin-bottom:8px">
        Команда <span style="color:${currentTeam==='A'?'var(--tank)':'var(--damage)'}">${currentTeam}</span> банит героя
        ${bannedRoles.length?`<span style="opacity:.5">(роль ${bannedRoles.join(', ')} уже использована на этой карте)</span>`:''}
        ${seriesBannedHeroes.length?`<span style="opacity:.5"> · уже банили в серии: ${seriesBannedHeroes.join(', ')}</span>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        ${['Tank','Damage','Support'].map(role=>{
          const roleDisabled = bannedRoles.includes(role);
          const hs = heroes.filter(h=>!h.banned&&h.role===role&&!seriesBannedHeroes.includes(h.name));
          return `<div style="${roleDisabled?'opacity:.3;pointer-events:none':''}">
            <div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:${rc[role]};margin-bottom:5px;display:flex;align-items:center;gap:3px">
              ${roleIcon(role,11)} ${role}${roleDisabled?' (заблокирована)':''}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${hs.map(h=>{
                const isRec = recs.findIndex(r=>r.hero.name===h.name);
                const bsrc=portrait(h.name);
                return `<div class="comp-ban-chip${isRec>=0?' active':''}" style="${isRec===0?'border-color:var(--damage);background:var(--bg3)':isRec===1?'border-color:var(--accent)':''}" onclick="doTournHeroBan('${esc(hb.mapName)}','${esc(h.name)}')" title="${h.name}${isRec>=0?' — рекомендован':''}"  >
                  ${bsrc?`<img src="${bsrc}" onerror="this.style.display='none'">`:`<div class="comp-ban-chip-ph">${h.name[0]}</div>`}
                  ${isRec===0?`<div class="comp-ban-priority" style="background:var(--damage)">★</div>`:''}
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div style="font-family:var(--mono);font-size:11px;color:var(--support);margin-bottom:12px">✓ Баны завершены</div>`}

    ${recs.length&&hb.step<2?_renderBanRecs(recs.slice(0,5)):''}`;
}

function doTournHeroBan(mapName, heroName){
  const hb = tDraft.heroBans.find(x=>x.mapName===mapName);
  if(!hb||hb.step>=2)return;
  const h = heroMap[heroName]; if(!h)return;
  const team = hb.step===0?'A':'B';
  // Проверяем что роль ещё не забанена на этой карте, а герой — во всей встрече
  const allBannedRoles=[...(hb.bannedRoles.A||[]),...(hb.bannedRoles.B||[])];
  if(allBannedRoles.includes(h.role)){toast(`Роль ${h.role} уже забанена на этой карте`,'err');return;}
  if(_getTournSeriesBannedHeroes(hb).includes(heroName)){toast(`${heroName} уже банили в этой встрече`,'err');return;}
  if(team==='A') hb.banA=heroName; else hb.banB=heroName;
  hb.bannedRoles[team]=[...(hb.bannedRoles[team]||[]),h.role]; // записываем роль
  hb.step++;
  renderBans();
}

function _computeTournBanRecs(mapObj, excludeRoles, excludeHeroes=[]){
  return heroes.filter(h=>!h.banned&&!excludeRoles.includes(h.role)&&!excludeHeroes.includes(h.name))
    .map(h=>{ let score=0;const reasons=[];
      if(mapObj){
        if((h.strongMaps||[]).includes(mapObj.name)){score+=6;reasons.push({type:'mapStrong',text:`Силён: ${mapObj.name}`});}
        if((mapObj.bans||[]).includes(h.name)){score+=4;reasons.push({type:'mapBan',text:'В бан-листе карты'});}
        if((mapObj.counters||[]).includes(h.name)){score+=2;reasons.push({type:'mapBan',text:'Контр карты'});}
      }
      score+=h.priority*0.7;
      if(h.priority>=8)reasons.push({type:'meta',text:`Мета ${h.priority}/10`});
      return {hero:h,score:Math.round(score),reasons};
    }).filter(r=>r.score>3).sort((a,b)=>b.score-a.score).slice(0,6);
}

function _renderTournFinalRecs(){
  return `
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
      <div class="ban-recs-title" style="margin-bottom:10px">Итог: забаненные герои</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${tDraft.heroBans.map(hb=>{
          const srcA=hb.banA?portrait(hb.banA):null;
          const srcB=hb.banB?portrait(hb.banB):null;
          return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;background:var(--bg2);border:1px solid var(--border)">
            ${mapTypeIcon(hb.mode,12)}
            <span style="font-size:12px;font-weight:600;flex:1">${hb.mapName}</span>
            <span style="font-family:var(--mono);font-size:9px;color:var(--tank)">A:</span>
            ${srcA?`<img src="${srcA}" style="width:20px;height:20px;border-radius:3px;object-fit:cover">`:''}
            <span style="font-size:11px;color:var(--damage)">${hb.banA||'—'}</span>
            <span style="font-family:var(--mono);font-size:9px;color:var(--damage);margin-left:6px">B:</span>
            ${srcB?`<img src="${srcB}" style="width:20px;height:20px;border-radius:3px;object-fit:cover">`:''}
            <span style="font-size:11px;color:var(--damage)">${hb.banB||'—'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ══════════════════════════════════════════════
// ОБЩИЕ ХЕЛПЕРЫ
// ══════════════════════════════════════════════

function _buildCurrentBanGroups(banned){
  const byRole={Tank:[],Damage:[],Support:[]};
  banned.forEach(h=>{if(byRole[h.role])byRole[h.role].push(h);});
  return ['Tank','Damage','Support'].filter(r=>byRole[r].length).map(r=>`
    <div class="ban-role-group">
      <div class="ban-role-header">${roleIcon(r,14)}<span class="ban-role-title" style="color:${rc[r]}">${r}</span></div>
      <div class="ban-role-heroes">
        ${byRole[r].map(h=>{const src=portrait(h.name);return`<div class="ban-chip">
          ${src?`<img src="${src}" onerror="this.style.display='none'"">`:`<div class="ban-chip-ph">${h.name[0]}</div>`}
          <span class="ban-chip-name">${h.name}</span>
        </div>`;}).join('')}
      </div>
    </div>`).join('');
}

function _buildHeroChips(){
  if(!banDraftHeroes.length) return '<span class="ban-hero-placeholder">Нажми чтобы выбрать...</span>';
  return banDraftHeroes.map(n=>{
    const src=portrait(n);
    return`<div class="ban-draft-chip" title="${n}">
      ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-draft-chip-ph">${n[0]}</div>`}
      <span>${n}</span>
      <span class="ban-draft-chip-remove" onclick="event.stopPropagation();removeBanDraftHero('${esc(n)}')">×</span>
    </div>`;
  }).join('');
}

function removeBanDraftHero(name){
  banDraftHeroes=banDraftHeroes.filter(n=>n!==name);
  pickerSelected.banHeroes=[...banDraftHeroes];
  renderBans();
}

function _refreshBanAssist(){
  renderBans();
}

function _renderBanRecs(recs){
  if(!recs||!recs.length) return '<div class="ban-recs-empty">Нет кандидатов на бан</div>';
  const maxScore=recs[0].score;
  const tagStyle={
    counter:'background:rgba(224,85,85,.12);border-color:rgba(224,85,85,.35);color:var(--damage)',
    mapStrong:'background:rgba(74,158,224,.1);border-color:rgba(74,158,224,.3);color:var(--tank)',
    mapBan:'background:rgba(240,160,48,.1);border-color:rgba(240,160,48,.3);color:var(--accent)',
    meta:'background:rgba(43,189,142,.1);border-color:rgba(43,189,142,.25);color:var(--support)',
  };
  return `<div class="ban-recs-grid">
    ${recs.map((r,i)=>{
      const pct=Math.min(100,Math.round((r.score/maxScore)*100));
      const barColor=pct>70?'var(--damage)':pct>40?'var(--accent)':'var(--text3)';
      const urgTag=pct>70?['HIGH','var(--damage)']:pct>40?['MED','var(--accent)']:['LOW','var(--text3)'];
      const src=portrait(r.hero.name);
      const tags=r.reasons.map(rs=>`<span class="ban-rec-tag" style="${tagStyle[rs.type]||tagStyle.meta}">${rs.text}</span>`).join('');
      return`<div class="ban-rec-card${pct>70?' ban-rec-high':''}">
        <div class="ban-rec-rank">${i+1}</div>
        <div class="ban-rec-portrait">
          ${src?`<img src="${src}" onerror="this.style.display='none'">`:`<div class="ban-rec-ph">${r.hero.name[0]}</div>`}
        </div>
        <div class="ban-rec-body">
          <div class="ban-rec-name">${r.hero.name}</div>
          <div class="ban-rec-sub">${roleIcon(r.hero.role,11)}<span>${r.hero.subrole||r.hero.role}</span></div>
          <div class="ban-rec-bar-wrap"><div class="ban-rec-bar" style="width:${pct}%;background:${barColor}"></div></div>
          ${tags?`<div class="ban-rec-tags">${tags}</div>`:''}
        </div>
        <div class="ban-rec-urgency" style="color:${urgTag[1]}">${urgTag[0]}</div>
      </div>`;
    }).join('')}
  </div>`;
}
