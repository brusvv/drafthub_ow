// ════ AUTH ════

// Единый колбэк для токена — создаётся при initGis()
function _makeTokenCallback(){
  return resp=>{
    if(resp.error){toast('Ошибка авторизации','err');return}
    gapi.client.setToken({access_token:resp.access_token});
    showApp();
    loadAllData();
  };
}

function gapiLoaded(){
  gapi.load('client',async()=>{
    await gapi.client.init({discoveryDocs:[DISCOVERY]});
    gapiInited=true;
    maybeInit();
  });
}

// Вызывается браузером один раз при загрузке GIS SDK.
// Если Client ID уже есть — инициализируем tokenClient сразу.
// Если нет — просто фиксируем что SDK загружен; инициализация
// произойдёт позже через initGis() после сохранения Client ID.
function gisLoaded(){
  gisLibReady=true;          // SDK загружен — запомним это
  if(getClientId()) initGis(); // Client ID уже был → инициализируем
}

// Инициализирует tokenClient с текущим Client ID.
// Можно вызывать несколько раз (например после saveClientId).
function initGis(){
  if(!gisLibReady) return;
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:getClientId(),
    scope:SCOPES,
    callback:_makeTokenCallback()
  });
  gisInited=true;
  maybeInit();
}

function maybeInit(){if(!gapiInited||!gisInited)return}

function signIn(){
  if(!getClientId()){
    document.getElementById('authConfigBanner').style.display='block';
    return;
  }
  if(!gisInited){
    // GIS SDK мог успеть загрузиться, но tokenClient не создан —
    // попробуем инициализировать прямо сейчас
    if(gisLibReady){initGis();}
    else{toast('Загрузка Google SDK...','err');return}
  }
  tokenClient.requestAccessToken({prompt:'consent'});
}

function signOut(){
  gapi.client.setToken(null);
  document.getElementById('mainApp').style.display='none';
  document.getElementById('authScreen').style.display='flex';
}

function showApp(){
  document.getElementById('authScreen').style.display='none';
  document.getElementById('mainApp').style.display='block';
  if(!getSheetId()) document.getElementById('sheetConfigBanner').style.display='block';
}

// ════ LOCAL CONFIG ════
function getClientId(){return localStorage.getItem('draft_client_id')||''}
function getSheetId(){return localStorage.getItem('draft_sheet_id')||''}

function saveClientId(){
  const v=document.getElementById('clientIdInput').value.trim();
  if(!v)return;
  localStorage.setItem('draft_client_id',v);
  document.getElementById('authConfigBanner').style.display='none';
  // Инициализируем GIS с новым Client ID без перезагрузки страницы.
  // Если GIS SDK ещё не загрузился — gisLoaded() вызовет initGis() сам.
  initGis();
}

function saveSheetId(){
  const v=document.getElementById('sheetIdInput').value.trim();
  if(!v)return;
  localStorage.setItem('draft_sheet_id',v);
  document.getElementById('sheetConfigBanner').style.display='none';
  loadAllData();
}

// ════ SHEETS API ════
const SID=()=>getSheetId();
async function sGet(r){const res=await gapi.client.sheets.spreadsheets.values.get({spreadsheetId:SID(),range:r});return res.result.values||[]}
async function sUp(r,v){await gapi.client.sheets.spreadsheets.values.update({spreadsheetId:SID(),range:r,valueInputOption:'USER_ENTERED',resource:{values:v}})}
async function sApp(s,v){await gapi.client.sheets.spreadsheets.values.append({spreadsheetId:SID(),range:s+'!A1',valueInputOption:'USER_ENTERED',insertDataOption:'INSERT_ROWS',resource:{values:v}})}
async function sClear(r){await gapi.client.sheets.spreadsheets.values.clear({spreadsheetId:SID(),range:r})}
async function sDelRow(gid,idx){await gapi.client.sheets.spreadsheets.batchUpdate({spreadsheetId:SID(),resource:{requests:[{deleteDimension:{range:{sheetId:gid,dimension:'ROWS',startIndex:idx,endIndex:idx+1}}}]}})}
async function sGid(name){const m=await gapi.client.sheets.spreadsheets.get({spreadsheetId:SID()});const s=(m.result.sheets||[]).find(s=>s.properties.title===name);return s?s.properties.sheetId:null}
