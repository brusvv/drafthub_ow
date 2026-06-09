// ════ AUTH ════
function gapiLoaded(){gapi.load('client',async()=>{await gapi.client.init({discoveryDocs:[DISCOVERY]});gapiInited=true;maybeInit()})}
function gisLoaded(){if(!getClientId())return;tokenClient=google.accounts.oauth2.initTokenClient({client_id:getClientId(),scope:SCOPES,callback:resp=>{if(resp.error){toast('Ошибка авторизации','err');return};gapi.client.setToken({access_token:resp.access_token});showApp();loadAllData()}});gisInited=true;maybeInit()}
function maybeInit(){if(!gapiInited||!gisInited)return}
function signIn(){if(!getClientId()){document.getElementById('authConfigBanner').style.display='block';return};if(!gisInited){toast('Загрузка...','err');return};tokenClient.requestAccessToken({prompt:'consent'})}
function signOut(){gapi.client.setToken(null);document.getElementById('mainApp').style.display='none';document.getElementById('authScreen').style.display='flex'}
function showApp(){document.getElementById('authScreen').style.display='none';document.getElementById('mainApp').style.display='block';if(!getSheetId())document.getElementById('sheetConfigBanner').style.display='block'}

// ════ CONFIG ════
function getClientId(){return localStorage.getItem('draft_client_id')||''}
function getSheetId(){return localStorage.getItem('draft_sheet_id')||''}
function saveClientId(){const v=document.getElementById('clientIdInput').value.trim();if(!v)return;localStorage.setItem('draft_client_id',v);document.getElementById('authConfigBanner').style.display='none';location.reload()}
function saveSheetId(){const v=document.getElementById('sheetIdInput').value.trim();if(!v)return;localStorage.setItem('draft_sheet_id',v);document.getElementById('sheetConfigBanner').style.display='none';loadAllData()}

// ════ SHEETS ════
const SID=()=>getSheetId();
async function sGet(r){const res=await gapi.client.sheets.spreadsheets.values.get({spreadsheetId:SID(),range:r});return res.result.values||[]}
async function sUp(r,v){await gapi.client.sheets.spreadsheets.values.update({spreadsheetId:SID(),range:r,valueInputOption:'USER_ENTERED',resource:{values:v}})}
async function sApp(s,v){await gapi.client.sheets.spreadsheets.values.append({spreadsheetId:SID(),range:s+'!A1',valueInputOption:'USER_ENTERED',insertDataOption:'INSERT_ROWS',resource:{values:v}})}
async function sClear(r){await gapi.client.sheets.spreadsheets.values.clear({spreadsheetId:SID(),range:r})}
async function sDelRow(gid,idx){await gapi.client.sheets.spreadsheets.batchUpdate({spreadsheetId:SID(),resource:{requests:[{deleteDimension:{range:{sheetId:gid,dimension:'ROWS',startIndex:idx,endIndex:idx+1}}}]}})}
async function sGid(name){const m=await gapi.client.sheets.spreadsheets.get({spreadsheetId:SID()});const s=(m.result.sheets||[]).find(s=>s.properties.title===name);return s?s.properties.sheetId:null}
