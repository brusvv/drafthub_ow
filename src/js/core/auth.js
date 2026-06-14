// @hash 60bfc561 2026-06-14T08:30
// ════ AUTH ════

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

function gisLoaded(){
  gisLibReady=true;
  if(getClientId()) initGis();
}

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
  initGis();
}

function saveSheetId(){
  const v=document.getElementById('sheetIdInput').value.trim();
  if(!v)return;
  localStorage.setItem('draft_sheet_id',v);
  document.getElementById('sheetConfigBanner').style.display='none';
  loadAllData();
}
