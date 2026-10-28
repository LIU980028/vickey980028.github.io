# Canva 素材筆記 × Agnes AI：啟用指南

## 已完成的程式
- canva-fonts/ai-tools.html：AI 工具箱（影片／圖片／簡易去背）
- canva-fonts/ai-tools.js：前端 Firebase Authentication、影片輪詢、圖片工具、純色去背
- functions/index.js：Firebase Cloud Functions 第 2 代安全代理
- functions/package.json、firebase.json：部署設定

**重要：儲存庫沒有放 Agnes API Key。** GitHub Pages 是靜態網站，不能自己安全持有私密金鑰。後端尚未部署時，只有瀏覽器內的「免費去背」可使用。

## 1. 建立或選定 Firebase 專案
1. 進入 https://console.firebase.google.com/，建立或選定你的專案，新增網頁應用程式，取得 Firebase Web 設定。
2. Authentication：啟用 Google 登入提供者。
3. Authentication → Settings → Authorized domains：加入網站使用的網域 liu980028.github.io。
4. 建立 Firestore Database。Cloud Functions/Secret Manager 通常需要 Blaze 計費方案，請先設定費用預算警示（警示不等於硬性停用）。

## 2. 填寫公開 Firebase 設定
編輯 canva-fonts/firebase-config.js：
- firebaseConfig：Firebase Console 提供的 apiKey、authDomain、projectId、appId 等網頁設定。
- ADMIN_UID：Firebase Authentication 登入後你自己的使用者 UID（前端控制講師顯示）。

Firebase Web apiKey 不是 Agnes 私密金鑰。仍需 Firebase Security Rules 和後端授權。

## 3. 在本機安全設定 Agnes 金鑰
準備 Node.js 22 和 Firebase CLI。若未安裝 Firebase CLI：npm install -g firebase-tools

在儲存庫根目錄執行：

    firebase login
    firebase use --add
    cd functions
    npm install
    cd ..
    firebase functions:secrets:set AGNES_API_KEY

最後一步會請你輸入**真正的 Agnes API Key**。請在自己的電腦終端機輸入，不要貼到聊天、GitHub 或前端程式。

建立本機的 functions/.env（已被 .gitignore 排除）：

    AI_ADMIN_UID=你自己的FirebaseAuthenticationUID

必須與公開網頁 firebase-config.js 的 ADMIN_UID 相同。後端會獨立驗證 Firebase ID Token，前端的 UID 不構成真正授權。

## 4. 部署後端
在儲存庫根目錄執行：

    firebase deploy --only functions

本專案後端使用 asia-east1 區域，提供：
- agnesHealth：核對 Firebase 講師授權及 Agnes Secret 是否就緒，成功才開放生成按鈕。
- agnesCreateVideo：Video 2.5 Flash／Video 2.5
- agnesVideoStatus：影片狀態輪詢（video_id + model_name）
- agnesCreateImage：Image 2.5 Flash 圖片生成／參考圖片編輯

使用 Firebase Callable protocol 與 Firebase Web SDK 的 httpsCallable；不可把 callable URL 當一般匿名 REST 入口使用。

## 5. 功能測試
1. 開啟 https://liu980028.github.io/vickey980028.github.io/canva-fonts/ai-tools.html
2. 免費去背：上傳白底／純色背景圖、按一鍵去背、下載透明 PNG（不需要 Firebase）。
3. 正式部署 Firebase 設定及 Functions 後，於影片頁面按 Google 登入。
4. 以 Flash 模型及短秒數進行第一個影片測試。
5. 建立任務後查詢生成進度，完成後可預覽或開啟檔案。
6. 在 AI 圖片頁輸入提示詞測試圖片生成。

## 使用限制與安全
- **只有指定 ADMIN_UID 的登入講師**能呼叫付費 Agnes API，訪客無法建立生成任務。
- Firestore 每人每日限制：影片 10 次、圖片 30 次；不等於 Agnes 平台配額。
- 供應商失敗的任務可能仍計入本站的每日限制。
- Flash 模型可能排隊或額度不足；費用以 Agnes 當下的帳號權限與價格為準。
- 免費去背使用瀏覽器端純色邊緣連通區域移除，可輸出透明 PNG，但**不是 AI 語意去背**。
- AI 圖片編輯不保證輸出透明 Alpha 圖片。髮絲或複雜背景需要專業去背服務。
- 上傳的影片首幀／參考圖將送到 Agnes：不要上傳醫療資料、機密資訊或未取得同意的人像。
- 有 Agnes Key 不代表已完成部署；仍需填 Firebase 設定、講師 UID、Secret Manager 與 Functions 部署。

## 參考
- Agnes 官方模型參考：https://github.com/AgnesAI-Labs/skills/blob/main/agnes-ai-models/references/model_catalog.md
- Agnes 官方整合說明：https://github.com/AgnesAI-Labs/skills/blob/main/agnes-ai-models/SKILL.md
- Firebase Functions 金鑰管理：https://firebase.google.com/docs/functions/config-env#secret-manager
