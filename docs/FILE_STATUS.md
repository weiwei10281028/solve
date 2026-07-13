# 檔案狀態表

盤點日期：2026-07-13  
分類定義：

| 狀態 | 定義 |
| --- | --- |
| 使用中 | 目前網站或正式工具直接使用，修改須回歸測試。 |
| 維護工具 | 用於同步、轉換、修補、發布或資料管理，不是主站執行期資產。 |
| 測試 | 驗證程式語法、版本、渲染或建置結果。 |
| 待封存 | 目前未列入此狀態；僅在完成替代方案與部署驗證後才能標記。 |

## 使用中

| 路徑／群組 | 備註 |
| --- | --- |
| `index.html` | 主頁入口與資源載入清單。 |
| `css/app.css`、`css/board.css` | 主頁與解題板核心樣式。 |
| `css/plain-*.css`、`css/math-note/`、`css/*draw*.css`、`css/structure-layout.css`、`css/tool.css` | 格式、NOTE、結構式與工具頁專用樣式。 |
| `js/app.js`、`js/api.js`、`js/solve-spec.js` | 主頁控制、章節類型／作答格式規格與 API 連線。 |
| `js/render.js`、`js/latex-sanitize.js` | AI 回覆處理與 LaTeX 安全修復。 |
| `js/prompt-compose.js`、`js/prompts.js`、`prompts/` | 提示詞組合與來源片段。 |
| `js/database.js`、`js/db-parse.js`、`js/db-meta.js`、`js/db-rules.js`、`js/board-formats.js` | 題庫載入、解析、規則與版型。 |
| `js/database-bundle.js`、`database/` | 部署 bundle 與其來源資料；兩者皆保留。 |
| `data/reference/`、`js/reference-store.js` | 新 reference 資料格式與最多三筆的本機檢索器；目前作為相容遷移層，不影響一般解題。 |
| `js/plain-reaction-table.js`、`js/plain-choice-options.js`、`js/solution-format.js` | 解題格式元件。 |
| `js/math-note/` | NOTE 規則、預設、檢查、補足與顯示。 |
| `js/mol-resolver.js`、`js/molfile-draw.js`、`js/smiles-draw.js`、`js/structure-layout.js` | 化學結構解析與顯示。 |
| `js/structures-bundle.js`、`structures/` | 部署 bundle 與 `.mol`／索引來源資料；兩者皆保留。 |
| `knowledge/`、`js/knowledge-store.js`、`js/knowledge-tools.js` | 教師知識庫 schema、儲存與工具。 |
| `teacher-tools.html`、`knowledge-studio.html`、`method-library.html`、`problem-analyzer.html`、`answer-audit.html`、`evaluation-lab.html`、`solution-format.html`、`chemistry-workbench.html` | 正式教師／輔助功能頁。 |

## 維護工具

| 路徑／群組 | 備註 |
| --- | --- |
| `db-import.html` | 題庫匯入與本機驗證。 |
| `molfile-preview.html` | `.mol` 檔預覽。 |
| `scripts/sync-database.py`、`同步資料庫.bat` | 題庫同步；批次檔保留為根目錄捷徑。 |
| `scripts/sync-structures.py`、`scripts/rebuild-structures-bundle.py` | 結構資料同步與 bundle 重建。 |
| `scripts/fetch-missing-structures.py`、`scripts/convert-smiles-to-mol.py` | 結構資料補齊與轉換。 |
| `scripts/rebuild-prompt-fallback.py` | 提示詞 fallback 重建。 |
| `scripts/patch-match-kghs113.py` | 特定資料修補。 |
| `scripts/import-legacy-database.py` | 舊版型資料預覽／匯入；預設唯讀，`--apply` 才寫入新資料層。 |
| `啟動網頁.bat` | 本機啟動捷徑。 |
| `清理舊題庫MD.bat` | 舊題庫 Markdown 清理工具；執行前須確認目標資料。 |
| `發布到GitHub/` | GitHub Pages 發布流程與說明。 |
| `IMPLEMENTATION_PLAN.md`、`NEXT_CHAT_HANDOFF_PLAN.md`、`docs/` | 規劃、交接與維護文件；提示詞規則見 `docs/PROMPT_PRIORITY.md`。 |

## 測試

| 路徑／群組 | 備註 |
| --- | --- |
| `tests/run-self-test.py` | 本機 HTTP、版本與核心功能冒煙測試。 |
| `tests/check-js-syntax.py` | JavaScript 語法檢查。 |
| `tests/test-board-compile.html` | Board 編譯流程測試。 |
| `tests/test-katex-pipeline.html` | KaTeX／數學渲染流程測試。 |
| `tests/test-pipeline.html` | 解題管線測試。 |
| `tests/verify-build.html` | 建置版號驗證頁。 |

## 待封存

目前無檔案標記為待封存。`legacy/README.md` 已記錄本次盤點與封存門檻；目前所有候選工具頁仍有有效入口或交叉連結，不代表現有檔案已可封存。

## 非產品管理資料

`.git/`、`.agents/`、`.cursor/` 屬於版本控制或本機工具設定，不列入上述產品生命週期狀態。修改或清理前應先確認其工具用途。
