// @hash 3388ed73 2026-07-16T01:20
// ════ RENDER — DRAFT COMP: STATE + ОРКЕСТРАТОР + ФАЗА 1 (ПОДГОТОВКА) ════
// Соревновательный режим: выбор героев → баны → рекомендации пика.
// FILESPLIT (16.07, попутно с AUDIT-A3 — файл перевалил за 260 строк):
// фаза 2 → render-draft-comp-bans.js, фаза 3 → render-draft-comp-result.js.
// draftState/resetDraftState/renderDraftComp остаются здесь — общий вход,
// используется всеми тремя файлами через общий script-scope (bundle,
// не ES-модули, порядок в build.sh: comp → comp-bans → comp-result).

// Состояние
let draftState={
  phase:'pick',          // 'pick' | 'bans' | 'result'
  ourHeroes:[],          // наш выбранный пул (до 5)
  ourBans:[],            // наши 2 бана
  enemyBans:[],          // вражеские 2 бана (введённые вручную или 0–2)
  selectedMap:null,      // карта матча
  side:'avg',            // 'atk'|'def'|'avg'
};

// Сброс при switchTeam — полный дефолт всех 6 полей
function resetDraftState() {
  draftState = {
    phase:'pick', ourHeroes:[], ourBans:[], enemyBans:[],
    selectedMap:null, side:'avg',
  };
}

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
        <select class="form-select fs-13" id="draftMapSel" onchange="draftState.selectedMap=this.value;renderDraftComp()">
          <option value="">— не выбрана —</option>
          ${maps.sort((a,b)=>a.name.localeCompare(b.name)).map(m=>
            `<option value="${esc(m.name)}"${draftState.selectedMap===m.name?' selected':''}>${m.name} (${m.type})</option>`
          ).join('')}
        </select>
      </div>
      <div class="ban-draft-ctrl">
        <div class="ban-draft-lbl">Сторона</div>
        <select class="form-select fs-13" id="draftSideSel" onchange="draftState.side=this.value;renderDraftComp()">
          <option value="avg"${draftState.side==='avg'?' selected':''}>Не важно</option>
          <option value="atk"${draftState.side==='atk'?' selected':''}>Атака</option>
          <option value="def"${draftState.side==='def'?' selected':''}>Защита</option>
        </select>
      </div>
    </div>
    <div class="ban-draft-lbl" style="margin:12px 0 6px">Наши герои</div>
    <button type="button" class="ban-hero-selector btn-reset" onclick="openDraftHeroPicker()">
      ${_buildDraftChips(draftState.ourHeroes,'Нажми чтобы выбрать...')}
    </button>
    ${hasRoster?`<div style="margin-top:8px;font-family:var(--mono);font-size:var(--fluid-fs-2xs);color:var(--text3)">
      или <button type="button" class="link-btn btn-reset" onclick="loadFromRoster()">Загрузить из состава</button>
    </div>`:''}
    <button class="btn btn-primary" onclick="draftState.phase='bans';renderDraftComp()" style="margin-top:16px;padding:8px 20px">
      Перейти к банам →
    </button>
  </div>`;
}

// BUG-17: раньше вызывалась без определения — ReferenceError на первом же
// рендере фазы 'pick'. По образцу _buildHeroChips() (render-bans-core.js),
// но с двумя отличиями: (1) принимает массив+placeholder явно вместо
// чтения модульного banDraftHeroes напрямую — вызывающая сторона уже была
// написана под такую сигнатуру; (2) remove-крестик — <span>+stopPropagation,
// а не вложенный <button> — чтобы .ban-hero-selector ниже можно было
// сделать <button> без button-in-button (см. AUDIT-A3, AGENT_TASKS.md).
function _buildDraftChips(heroesArr, placeholder){
  if(!heroesArr.length){
    return `<span class="ban-hero-placeholder">${placeholder}</span>`;
  }
  return heroesArr.map(n=>{
    const src=portrait(n);
    return `<div class="ban-draft-chip" title="${n}">
      ${src
        ? `<img src="${src}" onerror="this.style.display='none'">`
        : `<div class="ban-draft-chip-ph">${n[0]}</div>`}
      <span>${n}</span>
      <span class="ban-draft-chip-remove"
            onclick="event.stopPropagation();removeDraftHero('${esc(n)}')">×</span>
    </div>`;
  }).join('');
}

function removeDraftHero(name){
  draftState.ourHeroes=draftState.ourHeroes.filter(n=>n!==name);
  if(pickerSelected['draftOur'])pickerSelected['draftOur']=[...draftState.ourHeroes];
  renderDraftComp();
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

// LEQ-2: registerPickerHandler вместо window.confirmPicker override

// Обработчик выбора наших героев для драфта
registerPickerHandler('draftOur', function(){
  draftState.ourHeroes=[...(pickerSelected['draftOur']||[])];
  closePicker();renderDraftComp();
});
