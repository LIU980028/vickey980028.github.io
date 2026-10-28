// CK Canva - Firebase Authentication + Firestore 即時同步。
import { firebaseConfig, ADMIN_UID } from './firebase-config.js';

const $ = id => document.getElementById(id);
const ui = window.CKResources;
const status = $('cloudStatus'), loginBtn = $('teacherLogin');
const logoutBtn = $('teacherLogout'), copyUidBtn = $('copyUid');
const identity = $('teacherIdentity'), localBtn = $('publishLocal');
const configured = ['apiKey','authDomain','projectId','appId'].every(
  k => typeof firebaseConfig[k] === 'string' && firebaseConfig[k].trim().length > 2
);
function showStatus(message, state='') {
  status.textContent=message;
  status.className='cloudstate'+(state?' '+state:'');
}
if (!configured) {
  showStatus('本機示範模式 · 尚未連接 Firebase','warn');
} else {
  ui.enableCloud();
  showStatus('正在連接 Firebase 雲端…');
  loginBtn.style.display='';
  startFirebase().catch(err=>{
    showStatus('雲端連線失敗 · 請確認 Firebase 設定','warn');
    identity.hidden=false;
    identity.textContent=String(err?.message||err).slice(0,170);
    ui.toast('Firebase 初始化失敗，請檢查專案設定');
  });
}
async function startFirebase() {
  const [
    {initializeApp},
    {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged},
    {getFirestore,doc,onSnapshot,setDoc,serverTimestamp}
  ] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')
  ]);
  const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
  const catalog=doc(db,'ckCanvaPublic','catalog');
  let currentUser=null, initialRead=false, writeQueue=Promise.resolve();
  const adminUid=String(ADMIN_UID||'').trim();
  const authorized=()=>Boolean(currentUser && adminUid && currentUser.uid===adminUid);
  function updateAccess(){
    ui.setAdmin(authorized()&&initialRead);
    loginBtn.textContent=currentUser?'切換 Google 帳號':'講師 Google 登入';
    logoutBtn.style.display=currentUser?'':'none';
    copyUidBtn.style.display=currentUser?'':'none';
    identity.hidden=!currentUser;
    identity.textContent=currentUser
      ? (currentUser.email||'已登入')+' · '+(authorized()?'已授權講師':adminUid?'非授權講師':'尚未設定 ADMIN_UID')
      : '';
  }
  function validate(payload){
    if(!payload||!['material','font','tip'].every(k=>Array.isArray(payload[k])))
      throw Error('資源資料格式不正確');
    const result={};
    for(const k of ['material','font','tip']){
      if(payload[k].length>250)throw Error('單一分類上限 250 筆');
      result[k]=payload[k].map(item=>{
        if(!item||typeof item.name!=='string'||!item.name.trim())
          throw Error('資源名稱不可空白');
        const output={};
        for(const field of ['id','type','name','group','desc','note','format','url','graphic','status','category','lang','fontCss']){
          if(typeof item[field]==='string')output[field]=item[field].slice(0,800);
        }
        output.tags=Array.isArray(item.tags)
          ?item.tags.filter(t=>typeof t==='string').slice(0,8).map(t=>t.slice(0,80))
          :[];
        return output;
      });
    }
    return result;
  }
  function persist(payload){
    if(!authorized())return Promise.reject(Error('Google 帳號沒有管理權限'));
    if(!initialRead)return Promise.reject(Error('雲端清單尚未讀取完成'));
    let safe;
    try{safe=validate(payload)}catch(err){return Promise.reject(err)}
    writeQueue=writeQueue.catch(()=>{}).then(()=>setDoc(catalog,{
      ...safe,schemaVersion:1,updatedAt:serverTimestamp()
    }));
    return writeQueue;
  }
  ui.setPublisher(persist);
  onAuthStateChanged(auth,user=>{
    currentUser=user;
    updateAccess();
    if(user&&!adminUid)showStatus('雲端已連線 · 請複製 UID 完成講師授權','warn');
  });
  loginBtn.addEventListener('click',async()=>{
    try{
      const provider=new GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      await signInWithPopup(auth,provider);
    }catch(err){
      ui.toast('登入失敗：'+String(err?.code||err?.message||err).slice(0,70));
    }
  });
  logoutBtn.addEventListener('click',async()=>{
    try{await signOut(auth);ui.toast('已登出講師帳號')}
    catch(err){ui.toast('登出失敗：'+String(err.message||err).slice(0,70))}
  });
  copyUidBtn.addEventListener('click',async()=>{
    if(!currentUser)return;
    try{await navigator.clipboard.writeText(currentUser.uid);ui.toast('已複製 Firebase UID')}
    catch{window.prompt('請複製 Firebase UID',currentUser.uid)}
  });
  localBtn.addEventListener('click',async()=>{
    const old=ui.getLocalBackup();
    if(!old){ui.toast('目前瀏覽器沒有本機舊版資料');return}
    if(!confirm('本機舊清單將覆蓋全班雲端資料。請先備份雲端 JSON，確定繼續？'))return;
    try{await persist(old);ui.toast('舊清單已發布，學員會自動更新')}
    catch(err){ui.toast('上傳失敗：'+String(err.message||err).slice(0,65))}
  });
  onSnapshot(catalog,{includeMetadataChanges:true},snap=>{
    initialRead=true;
    if(snap.exists()){
      try{ui.acceptCloud(validate(snap.data()))}
      catch(err){showStatus('雲端資料格式異常 · 請通知管理員','warn');return}
    }else ui.acceptCloud(ui.defaults());
    updateAccess();
    if(snap.metadata.hasPendingWrites){showStatus('正在上傳雲端…');return}
    if(snap.metadata.fromCache){showStatus('顯示雲端快取 · 等待網路','warn');return}
    showStatus(!adminUid?'雲端已連線 · 尚未設定講師 UID':
      snap.exists()?'Firestore 雲端已同步 ✓':'雲端已連線 · 等待講師發布教材',
      adminUid?'online':'warn');
  },err=>{
    initialRead=false;ui.setAdmin(false);
    showStatus('Firestore 讀取失敗 · 檢查規則與網路','warn');
    ui.toast('資料讀取失敗：'+String(err?.code||err?.message||err).slice(0,65));
  });
}
