"use strict";
// Agnes AI proxy. Never embed AGNES_API_KEY in browser JS or committed files.
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
initializeApp();
const db=getFirestore();
const AGNES_API_KEY=defineSecret("AGNES_API_KEY");
const BASE="https://apihub.agnes-ai.com";
const REGION="asia-east1";
const OPTIONS={region:REGION,secrets:[AGNES_API_KEY],timeoutSeconds:75,memory:"256MiB",maxInstances:3};
const MODELS=new Set(["agnes-video-2.5-flash","agnes-video-2.5"]);
const RATIOS=new Set(["16:9","9:16","1:1","4:3","3:4","3:2","2:3","21:9"]);
function teacher(req){
 const uid=String(process.env.AI_ADMIN_UID||"").trim();
 if(!uid)throw new HttpsError("failed-precondition","後端尚未設定 AI_ADMIN_UID。");
 if(!req.auth||req.auth.uid!==uid)throw new HttpsError("permission-denied","只有授權講師可以使用付費 AI API。");
}
function str(v,max=1500){return typeof v==="string"?v.trim().slice(0,max):""}
function needPrompt(value){
 const p=str(value,2400);
 if(p.length<3)throw new HttpsError("invalid-argument","請輸入至少三個字的提示詞。");
 return p;
}
function imageInput(value){
 if(!value)return null;
 if(typeof value!=="string"||value.length>2_800_000||!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))
  throw new HttpsError("invalid-argument","圖片必須是 PNG/JPEG/WebP，且壓縮後小於約 2MB。");
 return value;
}
async function dailyLimit(uid,kind,max){
 const now=new Date().toISOString().slice(0,10);
 const ref=db.collection("agnesDailyUsage").doc(uid);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  const old=snap.exists?snap.data():{};
  const previous=old.day===now?Number(old[kind]||0):0;
  if(previous>=max)throw new HttpsError("resource-exhausted","今天已達本網站的 "+kind+" 次數上限。");
  const state={day:now,video:old.day===now?Number(old.video||0):0,image:old.day===now?Number(old.image||0):0,updatedAt:FieldValue.serverTimestamp()};
  state[kind]=previous+1;
  tx.set(ref,state);
 });
}
async function agnes(path,body,method="POST"){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),55000);
 try{
  const response=await fetch(BASE+path,{
   method,headers:{"Authorization":"Bearer "+AGNES_API_KEY.value(),"Content-Type":"application/json"},
   ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal
  });
  const contentType=response.headers.get("content-type")||"";
  const result=contentType.includes("json")?await response.json().catch(()=>({})): {};
  if(!response.ok){
   console.warn("Agnes upstream status:",response.status);
   const code=response.status===429?"resource-exhausted":response.status===401?"failed-precondition":"unavailable";
   throw new HttpsError(code,"Agnes 服務回覆 "+response.status+"；請確認金鑰額度、模型權限或稍後重試。");
  }
  return result;
 }catch(error){
  if(error instanceof HttpsError)throw error;
  console.error("Agnes request failed:",error?.name||"unknown");
  throw new HttpsError("unavailable","目前無法連接 Agnes，請稍後再試。");
 }finally{clearTimeout(timeout)}
}
exports.agnesCreateVideo=onCall(OPTIONS,async req=>{
 teacher(req);
 const x=req.data||{};
 const prompt=needPrompt(x.prompt);
 const model=MODELS.has(x.model)?x.model:"agnes-video-2.5-flash";
 const seconds=Number(x.seconds||5),ratio=str(x.ratio,8);
 if(!Number.isInteger(seconds)||seconds<4||seconds>12)throw new HttpsError("invalid-argument","影片秒數必須介於 4 至 12。");
 if(!RATIOS.has(ratio))throw new HttpsError("invalid-argument","請選擇有效的影片比例。");
 const first=imageInput(x.firstFrame);
 await dailyLimit(req.auth.uid,"video",10);
 const payload={model,prompt,mode:first?"keyframe":"text",seconds:String(seconds),size:model==="agnes-video-2.5-flash"?"720P":(x.resolution==="1080P"?"1080P":"720P"),aspect_ratio:ratio,n:1};
 if(first)payload.first_frame=first;
 const out=await agnes("/v1/videos",payload);
 const videoId=str(out.video_id,220);
 if(!videoId)throw new HttpsError("unavailable","Agnes 已回應，但沒有提供 video_id，請檢查服務狀態。");
 return {videoId,model,status:str(out.status,40)||"queued"};
});
exports.agnesVideoStatus=onCall(OPTIONS,async req=>{
 teacher(req);
 const x=req.data||{},videoId=str(x.videoId,220),model=str(x.model,60);
 if(!/^[a-zA-Z0-9_-]{6,220}$/.test(videoId)||!MODELS.has(model))throw new HttpsError("invalid-argument","影片任務識別碼或模型無效。");
 const query="?video_id="+encodeURIComponent(videoId)+"&model_name="+encodeURIComponent(model);
 const out=await agnes("/agnesapi"+query,null,"GET");
 const status=str(out.status,32)||"pending";
 const candidate=out.url||out.video_url||out.result?.url||"";
 const url=typeof candidate==="string"&&/^https:\/\//i.test(candidate)?candidate:"";
 return {videoId,status,progress:Math.max(0,Math.min(100,Number(out.progress)||0)),url,error:status==="failed"?str(out.error?.message||out.error||"影片生成失敗",240):""};
});
exports.agnesCreateImage=onCall(OPTIONS,async req=>{
 teacher(req);
 const x=req.data||{},prompt=needPrompt(x.prompt),ratio=str(x.ratio,8);
 if(!RATIOS.has(ratio))throw new HttpsError("invalid-argument","圖片比例不支援。");
 const reference=imageInput(x.reference);
 await dailyLimit(req.auth.uid,"image",30);
 const extra_body={ratio,response_format:"url"};
 if(reference)extra_body.image=[reference];
 const out=await agnes("/v1/images/generations",{
  model:"agnes-image-2.5-flash",prompt,size:x.size==="2K"?"2K":"1K",n:1,extra_body
 });
 const first=Array.isArray(out.data)?out.data[0]:null;
 const url=first&&typeof first.url==="string"&&/^https:\/\//i.test(first.url)?first.url:"";
 const b64=first&&typeof first.b64_json==="string"?first.b64_json:"";
 if(!url&&!b64)throw new HttpsError("unavailable","生成完成，但 Agnes 未回傳可顯示的圖片。");
 return {url,b64:b64.length<3_000_000?b64:""};
});
