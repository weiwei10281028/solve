# 專案地圖

更新日期：2026-07-13  
本文件描述目前的實際目錄結構；Phase 1 僅建立文件，不調整既有網站執行檔的位置。

## 啟動入口與主要流程

`index.html` 是學生解題頁的唯一主要入口。使用者輸入題目、圖片與 API 金鑰後，流程依序為：

```text
index.html
  -> js/app.js                 互動、狀態、送出請求與品質檢查
  -> js/api.js                 Gemini API 呼叫
  -> js/prompt-compose.js      讀取 prompts/ 片段並組合提示詞
  -> js/prompts.js             題目範圍與格式規則
  -> js/render.js              回應前處理、LaTex 修復、題解渲染
  -> js/math-note/*            NOTE 偵測、補足與呈現
  -> js/mol-resolver.js 等     結構式與反應式的輔助呈現
```

`index.html` 依序載入資料庫、提示詞、格式、數學 NOTE、結構式、渲染與應用程式腳本。這個順序有相依性，修改入口頁的 `<script>` 標籤時不得任意重排。

## 目錄與檔案職責

| 路徑 | 角色 | 說明 |
| --- | --- | --- |
| `index.html` | 正式使用中 | 學生解題主頁，也是所有核心腳本的載入點。 |
| `js/` | 正式使用中 | 前端應用、AI 提示詞、渲染、資料庫解析與化學結構顯示。 |
| `css/` | 正式使用中 | 主頁、解題板、表格、選項、結構式與 NOTE 的樣式。 |
| `prompts/` | 正式使用中 | 可由瀏覽器 `fetch` 的提示詞 Markdown 片段。 |
| `database/` | 正式使用中 | 舊題庫／方法／版型資料；由 `js/database.js` 與 `js/db-rules.js` 載入。 |
| `data/reference/` | 使用中（相容遷移） | 新的可追溯 reference 記錄；目前不注入主解題流程，舊 `database/` 仍保留。 |
| `structures/` | 正式使用中 | `index.json` 與 `.mol` 化學結構檔；也可重建為前端 bundle。 |
| `knowledge/` | 正式使用中 | 教師知識庫的 schema 與說明；資料主要由瀏覽器本機儲存管理。 |
| `teacher-tools.html` | 正式使用中 | 教師工具的入口頁。 |
| `knowledge-studio.html` | 正式使用中 | 教師知識庫編輯／匯出頁。 |
| `method-library.html` | 正式使用中 | 方法庫瀏覽與維護頁。 |
| `problem-analyzer.html` | 正式使用中 | 題目分析工具。 |
| `answer-audit.html` | 正式使用中 | 答案稽核工具。 |
| `evaluation-lab.html` | 正式使用中 | 評量實驗工具。 |
| `solution-format.html` | 正式使用中 | 解題輸出格式工具。 |
| `chemistry-workbench.html` | 正式使用中 | 化學工作台。 |
| `molfile-preview.html` | 維護工具 | `.mol` 結構檔預覽與檢查。 |
| `db-import.html` | 維護工具 | 題庫資料匯入與本機驗證。 |
| `scripts/`、`同步資料庫.bat` | 維護工具 | 資料同步、結構重建、提示詞 fallback 與特定資料修補；根目錄批次檔保留為捷徑。 |
| `scripts/import-legacy-database.py` | 維護工具 | 預覽或逐步匯入舊版型到 `data/reference/`，保留來源與確認狀態。 |
| `tests/run-self-test.py`、`tests/check-js-syntax.py` | 測試 | HTTP 冒煙測試與 JavaScript 語法檢查。 |
| `tests/test-*.html`、`tests/verify-build.html` | 測試 | 瀏覽器端管線與建置版本驗證頁。 |
| `發布到GitHub/` | 維護工具 | GitHub Pages 發布用的工作流程與操作說明。 |
| `IMPLEMENTATION_PLAN.md`、`NEXT_CHAT_HANDOFF_PLAN.md` | 維護文件 | 實作與交接計畫，不由網站載入。 |
| `legacy/` | 封存觀察區 | 目前僅含封存規則；尚無可安全移入的執行檔。 |
| `.git/`、`.agents/`、`.cursor/` | 不納入產品檔案分類 | 版本控制或本機代理／編輯器設定，避免由網站部署流程處理。 |

## 核心 JavaScript 模組

| 模組 | 責任 |
| --- | --- |
| `app.js`、`api.js`、`solve-spec.js` | UI 狀態、輸入處理、章節類型／作答格式規格、API 呼叫與品質回覆流程。 |
| `render.js`、`latex-sanitize.js` | AI 回應轉換、LaTeX 修復與安全呈現。 |
| `prompt-compose.js`、`prompts.js` | 組合基礎提示詞與題目／格式附加規則。 |
| `database.js`、`db-parse.js`、`db-meta.js`、`db-rules.js` | 題庫索引、內容解析、metadata 與規則讀取。 |
| `database-bundle.js` | 由資料庫同步流程產出的前端資料 bundle；請勿手動編輯。 |
| `knowledge-store.js`、`knowledge-tools.js` | 教師知識庫在瀏覽器本機的儲存、匯入匯出與檢查。 |
| `plain-reaction-table.js`、`plain-choice-options.js`、`board-formats.js`、`solution-format.js` | 解題輸出格式化與專用版型。 |
| `mol-resolver.js`、`molfile-draw.js`、`smiles-draw.js`、`structure-layout.js` | 化學結構的查找、繪製與版面。 |
| `structures-bundle.js` | 由結構資料重建的前端 bundle；請勿手動編輯。 |
| `math-note/` | NOTE 規則、預設值、檢查、補足與顯示元件。 |

## 重要資料依賴

```text
prompts/base + prompts/addons
  -> js/prompt-compose.js -> js/prompts.js -> js/app.js

database/index.json + database/{chapters,methods,formats,rules}
  -> js/database.js / js/db-rules.js
  -> js/database-bundle.js（同步後的部署用資料）

structures/index.json + structures/*.mol
  -> js/molfile-draw.js
  -> js/structures-bundle.js（重建後的部署用資料）
```

## 修改前先看的文件

1. 要改主頁請先看 `index.html` 的載入順序與 `js/app.js`。
2. 要改 AI 回覆格式請同時檢查 `js/prompt-compose.js`、`js/prompts.js`、`js/render.js` 與 `js/math-note/`。
3. 要改題庫或結構資料請依 `docs/MAINTENANCE_GUIDE.md` 的同步流程執行，勿只改 bundle。
4. 每次盤點或移轉前先更新 `docs/FILE_STATUS.md`。
5. 要新增或修改提示詞規則，先依 `docs/PROMPT_PRIORITY.md` 判定其模組與不可覆蓋關係。
6. 要新增章節類型或作答格式，先更新 `js/solve-spec.js` 的單一目錄；UI、提示文字與回覆檢查器會共用它。詳見 `docs/CHAPTER_TYPES.md`。
7. 要改公式或 NOTE 顯示，先依 `docs/FORMAT_PIPELINE.md` 的責任邊界與固定案例驗證。
