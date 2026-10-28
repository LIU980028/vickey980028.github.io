# CK Canva 素材筆記｜Firebase 雲端同步設定（講師用）

**已完成的程式碼：** 保留免費素材、字體與 Canva 技巧三分類；Google 登入講師管理、Firestore 即時同步給學員、操作後即時反映、保留本機舊資料匯入、JSON 備份。網站原樣部署在 GitHub Pages。

**目前狀態：** 需要你建立或授權一個 Firebase 專案，填寫公開 Web SDK config 和管理員 UID，才會真的雲端同步。網站在未設定前顯示「本機示範模式」，不能宣稱已同步。

## 設定步驟

1. 前往 [Firebase 控制台](https://console.firebase.google.com/) → 建立專案，例如 `CK-Canva-Resources`，Google Analytics 可選擇不啟用。
2. 選擇 **Build → Firestore Database → 建立資料庫**，選擇合適的區域（區域建立後不易更改）。正式發布前採用限制存取的安全規則，**絕對不要**讓所有人可寫入。
3. 選擇 **Build → Authentication → 開始使用 → 登入方式（Sign-in method） → Google → 啟用**。在 Authentication → Settings → Authorized domains 加入 `liu980028.github.io`（實際授課網址的網域）。
4. 在 Firebase 專案設定的 **你的應用程式 → 網頁（`</>`）** 註冊網頁，複製 `firebaseConfig` 的 `apiKey`、`authDomain`、`projectId`、`appId` 等欄位至網站 `canva-fonts/firebase-config.js`。這是前端公開設定資料，不是私密的管理金鑰；**不要**放入 service account JSON 或任何私鑰。
5. 重新開啟課堂網站 → 左側 **講師 Google 登入** → 用你的 Google 帳號登入 → 點 **複製 UID**。把 UID 填入 `firebase-config.js` 裡的 `ADMIN_UID`。
6. 在 **Firestore → Rules** 貼上同資料夾 `firestore.rules` 的內容，將 `REPLACE_WITH_YOUR_FIREBASE_AUTH_UID` 替換為你剛複製的 UID，按 **Publish（發布）**。若未設定 UID，規則刻意拒絕所有新增或編輯請求。
7. 重新整理網站並用講師帳號登入。左上角狀態為「Firestore 雲端已同步」或「雲端已連線 · 等待講師發布教材」；講師會看到新增／管理按鈕，學生不登入即可閱讀。
8. 第一次發布：直接 **新增第一筆資源**，網站就會把內建完整清單及新增資源一起送至 Firestore；如果你曾在舊版網頁新增本機資源，可先在講師管理點 **上傳本機舊清單**（先備份，會覆蓋現有雲端清單）。
9. 用另一台裝置開無痕視窗進行測試：不登入可看到新增資料，但無新增、刪除權限。

## 資料結構

Firebase Firestore 文件：`ckCanvaPublic/catalog`

```json
{
  "schemaVersion": 1,
  "material": [{ "id": "a01", "name": "Loose Drawing", "type": "material" }],
  "font": [{ "id": "f01", "name": "Montserrat", "type": "font" }],
  "tip": [{ "id": "t01", "name": "Canva 排版", "type": "tip" }],
  "updatedAt": "Firestore serverTimestamp"
}
```

Firestore 單份文件上限約 1 MiB；這個方式適合數十至數百筆課堂資源，未來如資料量非常大，可以改成每個資源一份文件。

## 問題排除

- **本機示範模式**：`firebase-config.js` 未填入完整 Web config。
- **Google 登入無效**：檢查 Authentication 是否啟用 Google、Authorized domains 是否包含 GitHub Pages 網域。
- **讀取失敗 / permission-denied**：檢查 Firestore Database 是否已建立，規則是否已發布。
- **登入後沒有新增資源按鈕**：檢查 `ADMIN_UID` 是否與登入的 Firebase Authentication UID 完全一致。
- **看到新增但存入失敗**：檢查 Firestore rules 裡的 UID 是否相同且規則已發布。
- **舊資料不見了**：舊版資料仍可能保存在你原本使用的瀏覽器 localStorage；請用同一瀏覽器登入，按「上傳本機舊清單」，務必先備份雲端清單。
- **講師修改與學員端不同步**：確認左側狀態出現「Firestore 雲端已同步」，請勿在「本機示範模式」下測試跨裝置同步。

## 安全與成本

- **Google 登入不代表任何登入者可寫入**：只有規則中指定的 UID 可以變更資料。
- Firebase API Key 本身不是私密管理金鑰；真正限制權限的是 Auth + Firestore Rules。
- 教材資源設計為公開閱讀，請勿在這個清單上傳學員私人資料或授權不公開的素材。
- Firebase Cloud Firestore 提供免費額度，但仍有配額限制。官方最新資訊：[Firestore 費用](https://firebase.google.com/docs/firestore/pricing)。

網站公開連結（若現有 GitHub Pages 設定維持不變）：
https://liu980028.github.io/vickey980028.github.io/canva-fonts/