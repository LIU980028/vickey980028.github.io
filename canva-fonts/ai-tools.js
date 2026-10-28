import {firebaseConfig,ADMIN_UID} from "./firebase-config.js";
const $=id=>document.getElementById(id);
let functionsApi=null,auth=null,currentJob=null,busy=false,removalReady=false;
const clean=t=>String(t??"").trim();
function state(id,message){$(id).textContent=message}
function setBusy(working){busy=working;const enabled=Boolean(functionsApi && auth?.currentUser && ADMIN_UID && auth.currentUser.uid===ADMIN_UID);$("startVideo").disabled=working||!enabled;$("startImage").disabled=working||!enabled;}
function activate(tab){
 document.querySelectorAll("[data-tab]").forEach(b=>{const on=b.dataset.tab===tab;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
 for(const id of ["video","image","remove"])$(id).hidden=id!==tab;
}
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>activate(b.dataset.tab)));
async function imageData(file){
 if(!file)return null;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>14*1024*1024)throw Error("請選擇 14MB 以下的 PNG、JPG 或 WebP。");
 const bitmap=await createImageBitmap(file),max=1200,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 const data=canvas.toDataURL("image/jpeg",.80);
 if(data.length>2_800_000)throw Error("圖片壓縮後仍太大，請改用較小的圖片。");
 return data;
}
function link(url,label,download=false){
 const a=document.createElement("a");a.textContent=label;a.href=url;a.target="_blank";a.rel="noopener noreferrer";if(download)a.download="agnes-result";return a;
}
function mediaOutput(id,url,video=false){
 const el=$(id);el.textContent="";
 if(video){const v=document.createElement("video");v.controls=true;v.preload="metadata";v.src=url;el.append(v)}
 else{const img=document.createElement("img");img.alt="Agnes 生成的圖片";img.src=url;el.append(img)}
 el.append(link(url,video?"開啟或下載影片":"開啟生成圖片"));
}
async function startVideo(){
 if(busy||!functionsApi)return;
 const prompt=clean($("videoPrompt").value);if(prompt.length<3){state("videoState","請先填寫影片描述。");return}
 const model=$("videoModel").value;const button=$("startVideo");
 try{
  setBusy(true);state("videoState","正在向 Agnes 建立影片任務…");button.textContent="提交中…";
  const frame=await imageData($("videoImage").files[0]);
  const call=functionsApi.httpsCallable("agnesCreateVideo",{timeout:75000});
  const response=await call({prompt,model,ratio:$("videoRatio").value,seconds:Number($("videoSecs").value),resolution:$("videoResolution").value,firstFrame:frame});
  currentJob={videoId:response.data.videoId,model:response.data.model,done:false};
  $("checkVideo").hidden=false;$("videoOutput").textContent="已送出影片任務："+currentJob.videoId;
  state("videoState","已提交 Agnes，正在排隊／生成。可按「查詢生成進度」。");
 }catch(err){state("videoState","提交失敗："+(err.message||"請確認後端設定及額度"));$("videoOutput").textContent="沒有建立影片任務。";}
 finally{button.textContent="生成影片";setBusy(false)}
}
async function checkVideo(){
 if(!functionsApi||!currentJob||currentJob.done)return;
 const b=$("checkVideo");b.disabled=true;
 try{
  state("videoState","正在查詢影片進度…");
  const call=functionsApi.httpsCallable("agnesVideoStatus",{timeout:75000});
  const response=await call({videoId:currentJob.videoId,model:currentJob.model});
  const d=response.data||{},status=clean(d.status);
  if(status==="completed" && d.url){
   currentJob.done=true;mediaOutput("videoOutput",d.url,true);state("videoState","影片完成！可在上方預覽或開啟檔案。");
  }else if(status==="failed"){
   currentJob.done=true;state("videoState","影片失敗："+(d.error||"請稍後重試"));$("videoOutput").textContent="本次任務未成功。";
  }else state("videoState","狀態："+(status||"排隊中")+"；進度："+(Number(d.progress)||0)+"%");
 }catch(err){state("videoState","查詢失敗："+(err.message||"網路錯誤"))}
 finally{b.disabled=false;if(currentJob?.done)b.hidden=true}
}
async function startImage(){
 if(busy||!functionsApi)return;
 const prompt=clean($("imagePrompt").value);if(prompt.length<3){state("imageState","請先填寫圖片描述。");return}
 const b=$("startImage");
 try{
  setBusy(true);b.textContent="生成中…";state("imageState","正在呼叫 Agnes Image 2.5 Flash…");
  const reference=await imageData($("imageReference").files[0]);
  const call=functionsApi.httpsCallable("agnesCreateImage",{timeout:75000});
  const response=await call({prompt,reference,ratio:$("imageRatio").value,size:$("imageSize").value});
  const d=response.data||{};
  const imgUrl=d.url||(d.b64?"data:image/png;base64,"+d.b64:"");
  if(!imgUrl)throw Error("Agnes 沒有回傳圖片");
  mediaOutput("imageOutput",imgUrl);
  state("imageState","圖片完成，已顯示預覽。");
 }catch(err){state("imageState","生成失敗："+(err.message||"服務不可用"))}
 finally{b.textContent="生成圖片";setBusy(false)}
}
$("startVideo").addEventListener("click",startVideo);
$("checkVideo").addEventListener("click",checkVideo);
$("startImage").addEventListener("click",startImage);
$("videoModel").addEventListener("change",()=>{$("videoResolution").value="720P";$("videoResolution").disabled=$("videoModel").value==="agnes-video-2.5-flash"});
$("videoResolution").disabled=true;
setInterval(()=>{if(currentJob&&!currentJob.done&&document.visibilityState==="visible")checkVideo()},30000);
async function startFirebase(){
 const required=["apiKey","authDomain","projectId","appId"];
 const configured=required.every(k=>typeof firebaseConfig[k]==="string"&&firebaseConfig[k].trim().length>4);
 if(!configured){state("loginState","Firebase 尚未設定：免費去背可直接使用；影片與 AI 圖片須部署後端。");return}
 try{
  const [{initializeApp},{getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged},{getFunctions,httpsCallable}]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"),
   import("https://www.gstatic.com/firebasejs/13.1.0/firebase-functions.js")
  ]);
  const app=initializeApp(firebaseConfig,"canvaAgnesTools");auth=getAuth(app);
  const fns=getFunctions(app,"asia-east1");functionsApi={httpsCallable:(name,options)=>httpsCallable(fns,name,options)};
  $("login").hidden=false;
  $("login").addEventListener("click",async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(err){state("loginState","登入失敗："+(err.message||"請檢查 Firebase 設定"))}});
  $("logout").addEventListener("click",()=>signOut(auth));
  onAuthStateChanged(auth,user=>{
   const allowed=Boolean(user&&ADMIN_UID&&user.uid===ADMIN_UID);
   $("login").hidden=!!user;$("logout").hidden=!user;
   state("loginState",allowed?"講師已登入，可開始呼叫 Agnes。":user?"此 Google 帳號尚未獲得講師授權。":"尚未登入講師帳號。");
   setBusy(false);
  });
 }catch(err){functionsApi=null;state("loginState","Firebase 初始化失敗："+(err.message||"請檢查 Firebase 設定"))}
}
startFirebase();
let sourceBitmap=null,originalURL=null;
$("tolerance").addEventListener("input",()=>{$("tolValue").value=$("tolerance").value});
$("removeFile").addEventListener("change",async e=>{
 const file=e.target.files?.[0];$("removeButton").disabled=true;$("savePng").disabled=true;removalReady=false;
 if(sourceBitmap){sourceBitmap.close?.();sourceBitmap=null}
 if(originalURL){URL.revokeObjectURL(originalURL);originalURL=null}
 if(!file)return;
 try{
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>14*1024*1024)throw Error("請使用 14MB 以下 PNG、JPG 或 WebP 圖片。");
  sourceBitmap=await createImageBitmap(file);originalURL=URL.createObjectURL(file);
  $("beforeImage").src=originalURL;$("beforeImage").hidden=false;
  const canvas=$("resultCanvas");canvas.width=0;canvas.height=0;
  $("removeButton").disabled=false;state("removeState","已上傳圖片。點選去背後可調整範圍重新處理。");
 }catch(err){state("removeState",err.message)}
});
function removeSolidBg(){
 if(!sourceBitmap)return;
 const scale=Math.min(1,1400/Math.max(sourceBitmap.width,sourceBitmap.height)),w=Math.max(1,Math.round(sourceBitmap.width*scale)),h=Math.max(1,Math.round(sourceBitmap.height*scale));
 const canvas=$("resultCanvas");canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(sourceBitmap,0,0,w,h);
 const pic=ctx.getImageData(0,0,w,h),p=pic.data,N=w*h;
 const locations=[0,w-1,(h-1)*w,N-1],colors=locations.map(n=>[p[n*4],p[n*4+1],p[n*4+2]]);
 const tol=Number($("tolerance").value),bound=tol*tol*3;
 const isBg=n=>{
  const i=n*4;if(p[i+3]<15)return true;
  return colors.some(c=>{const r=p[i]-c[0],g=p[i+1]-c[1],b=p[i+2]-c[2];return r*r+g*g+b*b<=bound});
 };
 const seen=new Uint8Array(N),queue=new Uint32Array(N);let head=0,tail=0;
 const add=n=>{if(!seen[n]){seen[n]=1;if(isBg(n))queue[tail++]=n}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}
 for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 while(head<tail){
  const n=queue[head++],idx=n*4;p[idx+3]=0;
  const x=n%w;
  if(x>0)add(n-1);if(x<w-1)add(n+1);if(n>=w)add(n-w);if(n<N-w)add(n+w);
 }
 ctx.putImageData(pic,0,0);removalReady=true;$("savePng").disabled=false;
 state("removeState","已移除與邊緣連通的相近背景色（"+Math.round(tail/N*100)+"%）。可調整滑桿再試。");
}
$("removeButton").addEventListener("click",()=>{try{removeSolidBg()}catch(e){state("removeState","處理失敗："+e.message)}});
$("savePng").addEventListener("click",()=>{
 if(!removalReady)return;
 $("resultCanvas").toBlob(blob=>{
  if(!blob){state("removeState","無法匯出 PNG");return}
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="transparent-background.png";a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
 },"image/png");
});
