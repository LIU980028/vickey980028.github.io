# EchoRead V17 · AI Learning Studio

**版本：** V17（2026-10-12）  
**介面：** 繁體中文 · 美式學習工作台 · 手機自適應  
**部署：** 靜態前端可放 GitHub Pages；AI 伺服器為可選的獨立元件。

## 先開始使用

1. 直接打開 `index.html`，或使用部署好的 GitHub Pages 網頁。
2. 上傳 TXT、MD、DOCX、文字型 PDF，或直接貼上英文文章，再按「開始閱讀」。**首頁不預載文章。**
3. 點英文單字聽單字，點句子 ▶ 聽整句；可調節 0.40–1.20×、自動下一句、循環本句、跟讀。
4. 中文翻譯會出現在每一句英文的正下方，可隱藏、編輯或重新翻譯。
5. 右側的「AI 學習助理」可切換不同的開源模型及執行方式。

## AI 功能與運作方式

| 功能 | 選項 | 使用前需要 | 是否送出英文原文 | 手機建議 |
|---|---|---|---|---|
| 逐句翻譯 | 原有 MyMemory | 網路 | 會，僅按翻譯時 | 可用作備援；**不是本機開源模型** |
| 逐句翻譯 | 本機 OPUS-MT（Helsinki NLP，Transformers.js） | 第一次下載模型，CDN/Hugging Face 可連線 | 翻譯推論在本機；首次會下載模型檔 | 大篇幅文章不建議一次跑全篇 |
| 逐句翻譯 | Qwen 相容 API | 你自己的 API 或伺服器 | 會，僅按翻譯時 | **推薦** |
| 英文解析 | 本機 Qwen 2.5 0.5B（WebGPU） | WebGPU、足夠記憶體、首次下載 | 本機推論 | **不建議** iPhone，品質有限 |
| 英文解析 | Qwen 相容 API | 已設定模型 API 與模型名稱 | 會，僅按 AI 解析時 | **推薦** |
| 美式英文 | 系統朗讀 Web Speech API | 不需下載模型 | 通常交由系統／瀏覽器處理，依裝置而異 | **最穩定的備援** |
| 美式英文 | Kokoro 本機 AI | 第一次下載模型、較大記憶體 | 本機推論 | iPhone 可能失敗 |
| 美式英文 | Kokoro 語音 API | 你自己部署的 HTTPS TTS 服務 | 會，僅按朗讀時 | **推薦** |

> 模型權重並未直接包進 HTML。模型選項是實際的懶載入／HTTP 呼叫路徑，不是圖片演示。沒有網路或後端時，相關模式可能不能使用；原有閱讀、單字點讀與系統語音仍可用。

## 完全在本機的入門方式

1. 在「AI 學習助理」→「中文翻譯方式」選 **本機 AI · OPUS-MT**。
2. 按「翻譯這句」。第一次下載模型需要等候。載入成功後，模型在瀏覽器內執行；中文使用 OpenCC 轉成臺灣繁體字。
3. 想試 Kokoro，可把「英文朗讀引擎」切到 **Kokoro 本機 AI**，按「下載／啟用」。建議桌機使用 Wi-Fi。
4. 若無法下載或裝置沒有足夠記憶體，切回「系統英文語音」。

**提醒：** OPUS-MT 是英翻中機器翻譯，不等於能理解複雜語境的 Qwen 模型；本機 Qwen 0.5B 也可能出現錯誤文法分析，結果請自己確認。

## Qwen：使用 Ollama（自己電腦）

在電腦安裝 [Ollama](https://ollama.com/)，於終端機執行：

```bash
ollama pull qwen2.5:3b
ollama serve
```

EchoRead 網頁「連接開源模型伺服器」設定：

- **API 網址：** `http://localhost:11434/v1`（僅適用在**同一台電腦**的瀏覽器，且須允許 CORS）。
- **模型名稱：** `qwen2.5:3b`。
- **金鑰：** 本機 Ollama 通常不要求（留空即可）。
- 按「測試模型連線」，顯示 OK 才開始翻譯或解析。

**GitHub Pages 是 HTTPS。** 直接存取 `http://localhost:11434` 可能受 CORS、瀏覽器本機網路或安全政策限制。手機無法用 `localhost` 連到電腦：要使用**有 HTTPS、驗證及正確 CORS** 的服務。不要把未保護的 Ollama 連接埠直接對外開放。

## 手機推薦：自行部署 V17 AI 後端

此 ZIP 包含可選後端範例：`server/app.py`。後端透過 Ollama 轉送聊天請求，並透過 Kokoro 生成同一款美式英文聲線的 WAV 音訊。開發範例**未替你架設主機**。

### 安裝（在自己的 Linux/Mac/Windows Python 主機）

```bash
cd server
python -m venv .venv
# macOS/Linux: source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Linux 可能還需系統套件 espeak-ng
ollama pull qwen2.5:3b
```

設定環境變數（**請自行更換安全隨機金鑰**）：

```bash
export ECHOREAD_API_TOKEN='請更換成長且隨機的密碼'
export ECHOREAD_CORS_ORIGINS='https://你的GitHub-Pages網址'
export ECHOREAD_OLLAMA_URL='http://127.0.0.1:11434'
uvicorn app:app --host 127.0.0.1 --port 8000
```

請在正式環境加上 HTTPS 反向代理、速率限制與存取控制，並確保 Python 服務及 Ollama 本身不直接對公網暴露。CORS 僅控制瀏覽器存取來源，**不是**驗證機制。第一次 Kokoro 推論會下載模型檔且需要較多記憶體。伺服器上的程式套件、語音模型與 GPU/CPU 相容性仍需實際部署驗證。

### EchoRead 對應設定

- **API 網址：** `https://你的主機/v1`
- **模型名稱：** `qwen2.5:3b`
- **存取金鑰：** `ECHOREAD_API_TOKEN` 的值（僅輸入瀏覽器當次頁面，不寫入檔案）。
- **Kokoro 音訊 API 網址：** `https://你的主機/api/tts`
- **英文朗讀引擎：** 選「Kokoro 語音伺服器 · 手機推薦」。

以上 `https://你的主機` 都是**待你架設的占位網址**，不是已經提供的公共 API。

## 完整性與測試紀錄

- [x] 預設空白、匯入文章、分句、中英對照、編輯中文、朗讀速度、逐字點讀功能保留。
- [x] Qwen 兼容 API 翻譯、API 解析、連線測試：瀏覽器自動化以**模擬 API 回應**測試。
- [x] 本機 OPUS-MT、本機 Qwen、本機 Kokoro：以**模擬模型載入與輸出**測試程式流程。
- [x] 1440px 桌面與 390px 手機瀏覽器布局無橫向溢出、無 JavaScript pageerror。
- [ ] 本環境未完成真正模型下載、實際 ONNX 推論與 iPhone 實機音訊測試。
- [ ] 自架後端程式已通過 Python 語法檢查，仍需要在有模型及系統套件的主機驗證推論與部署。
- [ ] 雲端 HTTPS 主機、API token、Ollama 與 Kokoro 後端**不含在 GitHub Pages 部署**。

## 安全與隱私

- **不在 GitHub 公開檔案中預埋任何 API 金鑰。** 金鑰只保留在目前瀏覽器頁面的記憶體；重新整理後需重新輸入。
- MyMemory/模型 API/語音伺服器按鈕會傳送你選取的英文內容到對應服務；本機模型推論不傳送文字，但首次仍會對模型託管平台發出下載請求。
- 瀏覽器內建語音辨識可能使用瀏覽器廠商服務；上傳的 DOCX/PDF 仍由瀏覽器解析。
- **請勿輸入機密文件或正式研究個資到不信任的第三方服務。**
- 同網域其他腳本或有權限的瀏覽器擴充功能仍可能讀取頁面；若需強化安全，建議模型與函式庫由受信任來源自行託管。

## 主要開源專案與技術參考

- [Transformers.js](https://github.com/huggingface/transformers.js) — 瀏覽器模型推論。
- [Xenova/opus-mt-en-zh](https://huggingface.co/Xenova/opus-mt-en-zh) — 英翻中 ONNX 模型（底層 Helsinki-NLP）。
- [Qwen2.5-0.5B-Instruct ONNX](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct) — 本機英文解析實驗。
- [Kokoro JS](https://github.com/hexgrad/kokoro) 與 [kokoro-js](https://www.npmjs.com/package/kokoro-js) — 美式語音模型與 JS。
- [OpenCC JS](https://github.com/nk2028/opencc-js) — 簡體轉臺灣繁體。
- [Ollama API](https://docs.ollama.com/api/openai-compatibility) — `/v1/chat/completions` 接口。

第三方模型的授權、重量、效能、可用性與模型托管條件，請於正式產品部署前再次確認。