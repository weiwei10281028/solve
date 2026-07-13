# 維護指南

更新日期：2026-07-13

## 基本原則

- 目前是靜態網站；以專案根目錄啟動 HTTP 伺服器後再測試，避免直接以 `file://` 開啟造成 `fetch` 失敗。
- 不移動 `index.html`、`js/`、`css/`、`prompts/`、`database/` 或 `structures/` 中的執行期檔案，除非已進入後續重構階段並完成引用更新與回歸測試。
- `database-bundle.js` 與 `structures-bundle.js` 是產物。優先修改來源資料與同步腳本，不直接手改 bundle。
- 靜態資源以查詢字串版號控制快取；修改由 `index.html` 載入的 CSS／JS 後，應同步更新該引用的版本字串。

## 本機啟動與基本驗證

在專案根目錄執行：

```powershell
python -m http.server 18080
```

再以瀏覽器開啟 `http://localhost:18080/index.html`。可依序進行：

```powershell
python tests/check-js-syntax.py
python tests/run-self-test.py
```

`tests/run-self-test.py` 需要上述 HTTP 伺服器仍在執行，並會檢查目前 `render.js` 與 `app.js` 的建置版號是否有被 `index.html` 載入。

## 常見修改流程

### 主解題流程、提示詞或渲染

1. 找出變更所在：`js/app.js`、`js/api.js`、`js/prompt-compose.js`、`js/prompts.js`、`js/render.js` 或 `js/math-note/`。
2. 若提示詞來源是 Markdown，修改 `prompts/base/` 或 `prompts/addons/`，再執行 `scripts/rebuild-prompt-fallback.py`。
3. 檢查 `index.html` 中對應 JS 的載入順序與版號。
4. 執行語法檢查與自我測試，並用 `tests/test-pipeline.html`、`tests/test-katex-pipeline.html` 或 `tests/test-board-compile.html` 做目標功能的瀏覽器驗證。

### 題庫／方法／格式資料

1. 修改 `database/` 的來源資料與索引，不直接修改 `js/database-bundle.js`。
2. 使用 `scripts/sync-database.py` 或根目錄 `同步資料庫.bat` 同步 bundle。
3. 以 `db-import.html`、`method-library.html` 或主頁實際載入資料驗證。
4. 若資料格式或規則有變更，也檢查 `js/database.js`、`js/db-parse.js`、`js/db-meta.js`、`js/db-rules.js`。

### 化學結構資料

1. 維護 `structures/index.json` 與對應的 `.mol` 檔。
2. 需要補檔或轉檔時使用 `scripts/fetch-missing-structures.py`、`scripts/convert-smiles-to-mol.py` 或 `scripts/sync-structures.py`。
3. 執行 `scripts/rebuild-structures-bundle.py` 更新 `js/structures-bundle.js`。
4. 用 `molfile-preview.html` 與主頁結構繪製功能檢查結果。

### 樣式與版面

1. 主頁樣式在 `css/app.css`，解題板樣式在 `css/board.css`。
2. 專用元件分別位於 `plain-reaction-table.css`、`plain-choice-options.css`、`math-note/`、結構式相關 CSS。
3. 更新 CSS 後調整 `index.html` 的對應快取版號，並以至少一題包含公式、表格與結構式的題目做人工檢查。

## 變更完成前檢查表

- [ ] 只改了預定範圍；沒有移動運行中檔案。
- [ ] 若改動 JS，`python tests/check-js-syntax.py` 已通過。
- [ ] 若改動主頁載入資源、渲染或提示詞，HTTP 自我測試已通過。
- [ ] 若改動資料，已由來源重建 bundle 並以對應工具頁驗證。
- [ ] 若改動 CSS／JS，`index.html` 的資源版號已更新。
- [ ] 若改動設定驗證，確認參考答案不一致只會顯示複核提示，不會觸發全文重寫。
- [ ] `docs/FILE_STATUS.md` 的狀態與備註仍正確。

## 不應做的事

- 不要將執行中檔案直接搬往尚未建立引用的 `app/`、`pages/`、`data/`、`scripts/` 或 `tests/` 目錄。
- 不要直接將 `database/` 或 `structures/` 當作可隨意刪除的舊資料；它們仍由現有程式讀取或用於重建。
- 不要只改 bundle 而不改來源資料，否則下次同步會覆蓋變更。
- 不要在未驗證載入順序的情況下合併或延後載入核心腳本。
