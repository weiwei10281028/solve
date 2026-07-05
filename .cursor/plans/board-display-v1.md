# 板書顯示改造 PLAN v1（方案 A · 顯示層 only）

> **狀態**：Phase 4 已完成（board-first 渲染；legacy fallback；preprocess 分流）  
> **最後更新**：2026-07-05  
> **專案路徑**：`AI解題(7.1格式正常)`  
> **給 AI 用**：任何 agent 實作前必讀；每完成一階段在「工作日誌」打勾並寫一行摘要。

---

## 0. 使用者硬性要求（不可違反）

| 項目 | 要求 |
|------|------|
| 範圍 | **只改「AI 詳解如何顯示」**；API、資料庫比對、prompt 教學邏輯、追問流程等**能不改就不改** |
| 泛用性 | 規格須適用**所有題目**；禁止寫死單一題、禁止題型專用分支 |
| 版型 | **與現有完全相同**（`.plain-line`、選項 (A)～(E)、反應表網格、答案框藍底） |
| 字體 | 英文／數字／數學式 **維持現有 KaTeX  serif 概念**（`board-latin`、`\dfrac` 等現路徑） |
| NOTE | `\htmlData` 點擊 popover **必須保留**，行為不變 |
| 反應式 | 反應變化表（array → `reaction-table-stacked`）**必須保留** |
| 代碼量 | **優先改現有檔**；新檔僅在「parse / validate / compile」真的無法塞進現有模組時才加；禁止大重構、禁止堆 regex |

---

## 1. 問題定義（為何要改）

現況：`AI 自由寫 LaTeX 字串` → `preprocessPlainText（20+ 步 regex）` → `render` → `doKaTeX`

常見故障：
- AI 語法錯（`\dfrac` 括號未閉、`\backslash times`）
- 同一行 `中文$$…$$` 被 `repairUnclosedInlineMath` 拆壞
- 算式只包一部分 → 半渲染半裸字
- **答案框** `答：2.0 \times10^{-4} \, M` 未走 KaTeX（`buildAnswerHtml` 條件判斷漏接）

**根因**：資料格式不可驗證，事後 regex 補救不可靠。

---

## 2. 目標架構（方案 A · 精簡版）

```
AI 回覆
  → 抽出 BoardDoc（JSON，泛用 block 列表）
  → validate（結構 + 每段 latex KaTeX 試編譯）
  → compileBoard → 產出「與現在相同的 HTML 字串」
  → doKaTeX + MathNote.postProcessBoard（不變）
  → 結構圖 Mol/SMILES（不變）
```

**關鍵**：不是新 UI，是 **「可驗證的中間格式 → 現有 HTML 模板」**。

Legacy：過渡期可保留 `render(plainText)` fallback；**預設走 BoardDoc**。

---

## 3. 不動清單（touch = 需使用者明示）

- `css/app.css`、`css/board.css`（版型已鎖，見 `.cursor/rules/board-template-lock.mdc`）
- `js/math-note/*` 核心（popover、trust、postProcessBoard）
- `js/plain-reaction-table.js` 的 **HTML 輸出格式**（可抽函式給 compile 呼叫，不改 class）
- `js/database.js`、`js/prompt-compose.js` 比對邏輯
- `js/app.js` 的 API 呼叫鏈（僅改 `renderAiInto` 入口）

---

## 4. BoardDoc v1（泛用資料模型）

AI 用 `@@BOARD@@ … @@END@@` 包住 JSON（末尾 `answer` 可併入 JSON，@@ANSWER@@ 可保留相容檢查）。

```json
{
  "version": 1,
  "blocks": [ "…見下表…" ],
  "answer": { "parts": [ { "kind": "math", "latex": "2.0\\times10^{-4}" } ], "unit": "M" }
}
```

### 4.1 Block 型別（所有題目共用）

| type | 用途 | 編譯目標 |
|------|------|----------|
| `section` | `【詳解】` 等小節標 | `.solve-section` |
| `paragraph` | 中文 + 行內算式/化學式 | `.plain-line` + `escapePlainBody` |
| `math` | 獨立算式（`display: true/false`） | `.plain-line` 內 `$…$` 或 `$$…$$` |
| `rxn-table` | 反應變化表（結構化列，**非** AI 手寫 array） | 現有 `splitPlainReactionArray` 路徑 |
| `choice-group` | (A)～(E) 評析 | 現有 `buildChoiceGroupHtml` 邏輯 |
| `mol` | `@@MOL:…@@` | 編譯成現有 marker，後續 MolfileDraw 不變 |

### 4.2 paragraph.parts（行內混排）

```json
{ "kind": "text", "text": "故溶氧量為 " }
{ "kind": "math", "latex": "c" }
{ "kind": "chem", "latex": "O_2" }
```

- `chem` / `math` 皆編譯為 `$…$`，走同一 KaTeX 字體路徑。
- NOTE：在 `math.latex` 內寫 `\htmlData{note=…}{…}`，**不新增 NOTE UI**。

### 4.3 rxn-table（結構泛用；數值依各題填入）

```json
{
  "type": "rxn-table",
  "cols": 5,
  "header": ["", "aA", "\\rightleftharpoons", "bB", "+", "cC"],
  "rows": [
    { "label": "起始", "cells": ["…", "…", "…", "…", "…"] },
    { "label": "平衡", "cells": ["…", "…", "…", "…", "…"], "hlineBefore": true }
  ]
}
```

編譯器：**依欄位組 `\begin{array}` → 走現有 injectReactionTableHtml**；列標／物種／數字皆由 AI 依該題填入，schema 不綁特定反應。

---

## 5. 實作策略（少新增、多修改）

### 5.1 檔案策略

| 優先 | 檔案 | 動作 |
|------|------|------|
| 1 | `js/render.js` | 加 `parseBoard` / `compileBoard` / `renderBoard`；**精簡** `preprocessPlainText`（BoardDoc 路徑跳過） |
| 2 | `js/app.js` | 只改 `renderAiInto`：detect BoardDoc → validate → compile → 現有 doKaTeX |
| 3 | `js/prompts.js` | 加 `checkBoardDoc`（取代部分文字 regex）；保留教學內容檢查 |
| 4 | `prompts/base/system-chem.md` | 改「輸出 @@BOARD@@ JSON」規格（泛用） |
| 5 | **僅必要時** `js/board-validate.js` | KaTeX 試編譯；若 <80 行可併入 render.js |

**禁止**：平行再造一套 CSS、禁止 duplicate layout 函式。

### 5.2 答案框（圖片 bug 必修）

現況：`buildAnswerHtml` 僅在含 `$` 或 `\dfrac` 等時才 `escapePlainBody`，裸 `\times` 會原樣顯示。

**compile `answer` 時一律走 `$…$` + `escapePlainBody`**，與正文同一 KaTeX 路徑。

---

## 6. 驗證流程（取代 regex 地獄）

1. JSON parse 成功  
2. Schema：block type、必填欄位  
3. 每個 `latex` 欄：`katex.render`（同 `getKatexOpts`）  
4. 失敗 → 定點修正 prompt（指出 `blocks[i].latex`），**不重寫全文**  
5. 通過 → compile → display  

語意檢查（反應表列標、選項 verdict）可**沿用** `prompts.js` 函式，改吃 compile 後字串或 doc 欄位。

---

## 7. 分階段交付（工作日誌用）

### Phase 0 — 規格鎖定 ✅
- [x] 本 PLAN 建立
- [x] 使用者確認 PLAN
- [x] 新增 `test-board-compile.html`（泛用占位範例 doc）

### Phase 1 — 顯示管道（最小可用）✅
- [x] `parseBoard` + `compileBoardBody` + `renderBoard` + `validateBoardDoc`
- [x] `renderAiInto` 接入；legacy 文字 fallback
- [x] 修 `answer` 必走 KaTeX（`wrapAnswerLineForKaTeX`）
- [ ] 使用者實機驗收多道題目

### Phase 2 — 反應表 + NOTE ✅
- [x] `rxn-table` block → 現有 reaction-table HTML 路徑
- [x] legacy：`isolateDisplayMathOnOwnLine` + `stripOrphanDoubleDollars`（修 `文字$$…$$`）
- [x] legacy：擴 `\dfrac{…}{(2x)^2 = …}` 修復
- [x] `__RENDER_BUILD` 供確認快取版本
- [ ] NoteCheck 改數 doc 內 `\htmlData`
- [ ] 使用者實機驗收

### Phase 3 — 選項題 + Prompt ✅
- [x] `choice-group` block
- [x] system prompt 輸出 @@BOARD@@
- [x] `checkBoardDoc` 接入 `ensureBoardStyleReply`

### Phase 4 — 收尾 ✅
- [x] BoardDoc 預設渲染路徑（`tryRenderBoardDoc` → legacy fallback）
- [x] `preprocessBoardCompiledText` / `preprocessLegacyPlainText` 分流
- [x] `format-board-doc` 改 inject:false（不強推 AI JSON）
- [ ] legacy preprocess 進一步精簡（後續可分批）

---

## 8. 工作日誌（agent 每 session 更新）

| 日期 | Phase | 負責 | 摘要 | 檔案 |
|------|-------|------|------|------|
| 2026-07-05 | 0 | — | 建立 PLAN v1 | `.cursor/plans/board-display-v1.md` |
| 2026-07-05 | 1 | Agent | parseBoard/renderBoard、renderAiInto 分流、答案 KaTeX | `js/render.js`, `js/app.js`, `test-board-compile.html` |
| 2026-07-05 | 2b | Agent | NOTE/K_c 規則對齊、note-check 排除、salvageBrokenKc | note-*, prompts, render n |
| 2026-07-05 | 3 | Agent | choice-group、checkBoardDoc、system BoardDoc、BUILD p3 | render, prompts, app, system-chem, format-board-doc |
| 2026-07-05 | 3c | Agent | 反應表 inline→display、BoardDoc 非強制、preprocess 修復 | render p3c |
| 2026-07-05 | 4 | Agent | board/legacy preprocess 分流、board-first 渲染、BUILD p4 | render, app, format-board-doc |

---

## 9. 驗收標準（泛用）

任取**多道不同題目**驗收，須全部滿足：

- [ ] 無裸 `\dfrac`、`\times`、`$$` 文字
- [ ] 答案框數學式與正文同字體
- [ ] NOTE 可點、popover 正常
- [ ] 反應表 grid 與現版一致
- [ ] 選項 (A) 懸掛縮排不跑版
- [ ] 長算式仍可橫向捲動

---

## 10. AI 協作規則

1. 實作前讀本檔 + `board-template-lock.mdc`  
2. 一次只做一個 Phase；完成後更新 §8 日誌  
3. 不順手重構、不新增與 display 無關功能  
4. 若需偏離 PLAN，先在日誌寫「偏差原因」再改  
5. 優先修 `render.js` / `app.js` 現有函式，新檔需註明理由  

---

## 11. 已知現有 bug（Phase 1 必含）

- 答案欄未 KaTeX 渲染（`\times`、指數裸顯示）
- `repairUnclosedInlineMath` 破壞 `文字$$…$$`（BoardDoc 可規定 math 獨 block 迴避；legacy fallback 需單行修復）

---

*本 PLAN 為唯一實作依據；與口頭討論衝突時以本檔為準。*
