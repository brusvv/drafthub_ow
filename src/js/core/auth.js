// @hash 4e1e3219 2026-06-15T07:57
// ════ AUTH ════

function _makeTokenCallback(){
  return resp=>{
    if(resp.error){
      console.error('OAuth error:',resp);
      toast(resp.error,'err');
      return;
    }

    localStorage.setItem('draft_logged_in','true');

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
  if(getClientId())initGis();
}

function initGis(){
  if(!gisLibReady)return;

  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:getClientId(),
    scope:SCOPES,
    callback:_makeTokenCallback()
  });

  gisInited=true;
  maybeInit();
}

function maybeInit(){
  if(!gapiInited||!gisInited)return;

  if(localStorage.getItem('draft_logged_in')==='true'){
    tokenClient.requestAccessToken({prompt:''});
    return;
  }
}

  console.log('No saved login');
}

function signIn(){
  if(!getClientId()){
    document.getElementById('authConfigBanner').style.display='block';
    return;
  }

  if(!gisInited){
    if(gisLibReady)initGis();
    else{toast('Загрузка Google SDK...','err');return}
  }

  tokenClient.requestAccessToken({prompt:'consent'});
}

function signOut(){
  localStorage.removeItem('draft_logged_in');
  gapi.client.setToken(null);
  document.getElementById('mainApp').style.display='none';
  document.getElementById('authScreen').style.display='flex';
}

function showApp(){
  console.log('showApp');

  document.getElementById('authScreen').style.display='none';
  document.getElementById('mainApp').style.display='block';

  if(!getSheetId())
    document.getElementById('sheetConfigBanner').style.display='block';
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
