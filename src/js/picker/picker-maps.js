// ════ PICKER — MAP STRENGTH (выбор карт + оценка силы для героя) ════

let mapStrengthPickerHero=null;  // имя героя для которого открыт picker
let mapStrengthPending=null;     // {map, type} — карта ожидающая оценки

function openMapStrengthPicker(heroName){
  mapStrengthPickerHero=heroName;
  mapStrengthPickerTypeFilter='all';
  document.getElementById('mapStrPickerTitle').textContent='Карты героя: оцени силу';
  document.querySelectorAll('#mapStrPickerOverlay .f-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  renderMapStrPickerGrid();
  document.getElementById('mapStrPickerOverlay').classList.remove('hidden');
}
function closeMapStrPicker(){
  document.getElementById('mapStrPickerOverlay').classList.add('hidden');
  document.getElementById('mapStrScorePopup').classList.add('hidden');
  mapStrengthPending=null;
}

let mapStrengthPickerTypeFilter='all';
function mapStrPickerFilter(type,btn){
  mapStrengthPickerTypeFilter=type;
  document.querySelectorAll('#mapStrPickerOverlay .f-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderMapStrPickerGrid();
}

function renderMapStrPickerGrid(){
  const filtered=maps.filter(m=>mapStrengthPickerTypeFilter==='all'||m.type===mapStrengthPickerTypeFilter);
  const grid=document.getElementById('mapStrPickerGrid');if(!grid)return;
  grid.innerHTML=filtered.map(m=>{
    const entry=(heroStrengthEdits||[]).find(e=>e.map===m.name)||{atk:0,def:0};
    const hasData=entry.atk>0||entry.def>0;
    const noAD=NO_ATKDEF.includes(m.type);
    const src=mapImg(m.name);
    const label=noAD?`${entry.atk||0}`:`${entry.atk||0}/${entry.def||0}`;
    return`<div class="map-str-chip${hasData?' has-data':''}" onclick="openMapStrScore('${esc(m.name)}','${m.type}')">
      ${src?`<img src="${src}" onerror="this.style.display='none'">`:''}
      <span class="map-str-chip-name">${m.name}</span>
      ${mapTypeIcon(m.type,10)}
      ${hasData?`<span class="map-str-chip-score">${label}</span>`:''}
    </div>`;
  }).join('');
}

function openMapStrScore(mapName,mapType){
  mapStrengthPending={map:mapName,type:mapType};
  const entry=(heroStrengthEdits||[]).find(e=>e.map===mapName)||{atk:0,def:0};
  const noAD=NO_ATKDEF.includes(mapType);
  const popup=document.getElementById('mapStrScorePopup');if(!popup)return;
  popup.innerHTML=`
    <div class="map-str-popup-title">${mapName}</div>
    ${noAD
      ?`<div class="map-str-score-row">
          <span class="map-str-score-label">Сила</span>
          ${_mapStrDots('atk',entry.atk||0)}
        </div>`
      :`<div class="map-str-score-row">
          <span class="map-str-score-label" style="color:var(--damage)">ATK</span>
          ${_mapStrDots('atk',entry.atk||0)}
        </div>
        <div class="map-str-score-row">
          <span class="map-str-score-label" style="color:var(--tank)">DEF</span>
          ${_mapStrDots('def',entry.def||0)}
        </div>`
    }
    <div style="display:flex;gap:6px;margin-top:10px">
      <button class="btn btn-primary" onclick="confirmMapStrScore()" style="flex:1;font-size:10px">OK</button>
      <button class="btn" onclick="clearMapStrScore('${esc(mapName)}')" style="font-size:10px">Сброс</button>
    </div>`;
  popup.classList.remove('hidden');
}

function _mapStrDots(field,val){
  return`<div class="map-str-dots" id="msd_${field}">
    ${Array.from({length:10},(_,k)=>{
      const v=k+1;const filled=v<=val;
      const color=v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
      return`<span onclick="setMapStrDot('${field}',${v})"
        style="cursor:pointer;font-size:16px;color:${filled?color:'var(--border2)'}">◆</span>`;
    }).join('')}
  </div>`;
}

// Временное хранилище для оценки текущего попапа
let _mapStrTmpAtk=0,_mapStrTmpDef=0;

function setMapStrDot(field,val){
  if(field==='atk')_mapStrTmpAtk=val; else _mapStrTmpDef=val;
  const dots=document.querySelectorAll(`#msd_${field} span`);
  dots.forEach((d,k)=>{
    const v=k+1;const filled=v<=val;
    const color=v>=8?'var(--damage)':v>=5?'var(--accent)':'var(--text3)';
    d.style.color=filled?color:'var(--border2)';
  });
}

function confirmMapStrScore(){
  if(!mapStrengthPending)return;
  const mapName=mapStrengthPending.map;
  let entry=(heroStrengthEdits||[]).find(e=>e.map===mapName);
  if(!entry){
    entry={map:mapName,type:mapStrengthPending.type,atk:0,def:0};
    (heroStrengthEdits=heroStrengthEdits||[]).push(entry);
  }
  if(_mapStrTmpAtk)entry.atk=_mapStrTmpAtk;
  if(_mapStrTmpDef)entry.def=_mapStrTmpDef;
  _mapStrTmpAtk=0;_mapStrTmpDef=0;
  document.getElementById('mapStrScorePopup').classList.add('hidden');
  mapStrengthPending=null;
  renderMapStrPickerGrid();
}

function clearMapStrScore(mapName){
  if(heroStrengthEdits){
    const idx=heroStrengthEdits.findIndex(e=>e.map===mapName);
    if(idx>=0){heroStrengthEdits[idx].atk=0;heroStrengthEdits[idx].def=0;}
  }
  _mapStrTmpAtk=0;_mapStrTmpDef=0;
  document.getElementById('mapStrScorePopup').classList.add('hidden');
  mapStrengthPending=null;
  renderMapStrPickerGrid();
}
