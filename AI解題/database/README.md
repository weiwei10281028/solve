# 題庫資料夾（database）

扁平結構：每題（或每份考卷）一個 `.md` 檔，不再分 question / solution / json。

## 檔案格式

```yaml
---
id: weak-acid-33
type: single          # single | exam | solution_only
topic: 弱酸 解離
match_alias: ""
q_numbers: [33]
fingerprint: [...]
match_keywords: [...]
answer_key: "(A)(C)(D)"
catalog_only: false
---

## 題幹

（題目 Markdown）

## 詳解

（詳解 Markdown）
```

- `type: exam` 或 `catalog_only: true`：段考整卷，解題時以題幹關鍵字比對卷內單題。
- `type: solution_only` 或 `solution_only: true`：**純詳解範例**（無真實題幹），供 AI 學習解題風格；配對標記加在詳解各小節（`<!-- MATCH: ... -->`）。範本見 `_template-solution-only.md`。
- 以 `_` 開頭的檔案（如 `_template.md`）不會被載入。

## YAML 檔頭（必須正確）

- 開頭結尾用 `---`（**不要** `\---`）
- 欄位名用 `catalog_only`、`method_id`（**不要** `catalog\_only`）
- 配對：題幹加 `<!-- MATCH: 關鍵詞1,關鍵詞2 -->`（**db-import 會自動產生**）

## 工作流程

1. 老師用 **db-import.html** 上傳題目＋詳解圖，或選「純詳解」只上傳詳解圖 → 下載標準 `{id}.md`
2. 將 `.md` 放入本資料夾
3. **執行「同步資料庫.bat」**（必做）→ 產生 `index.json` 與 `js/database-bundle.js`
4. 學生在 **index.html** 上傳圖片 → 自動配對題庫

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `methods.json` | 解題方法卡（步驟、陷阱） |
| `index.json` | 由同步腳本自動產生，列出所有 `.md` |
| `_template.md` | 手動建檔範本 |
