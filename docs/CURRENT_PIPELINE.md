# 目前唯一詳解管線

```text
題目／圖片
  → 主 Flash 獨立解題（看不到參考答案；計算式同步寫入 \htmlData NOTE）
  → 另一個 Flash 獨立驗證參考答案（有填時）
  → Gemini 依 SolutionCore JSON Schema 回傳內容區塊
  → SolutionCore 驗證並編譯文字、化學式、算式與選項標記
  → 本機檢查：等號計算（硬擋）、NOTE 完整／詞彙、擠行 calculation、參考答案對齊（軟警告）
    → 算式不一致：最多用 Gemini 3.5 Flash 重新計算一次；仍不一致就拒絕顯示
    → 參考答案不符：另開對齊輪；驗證解析失敗或無法對齊時仍顯示詳解並標警告
    → NOTE 不足或擠行：單獨一輪只補 htmlData／拆 calculation；仍不足則本機補標兜底
    → 僅本機算式硬錯誤才拒絕顯示
  → 顯示前正規化：`normalizeScientificTokens`（分離 @@ANSWER@@ 後只處理主文，防裸化學式／單位／數字破裂）
  → Markdown Renderer 建立段落與固定選項 grid
  → KaTeX／mhchem 渲染公式與化學式
  → NOTE 後處理與必要的純公式橫向滑動（本機依寬度判定，AI 不標記）
```

## 選擇題骨架

- 固定閱讀順序：題意 → 依據與推導 → 結果 → 選項分析。
- 題意、依據與推導、結果是每題固定區塊；選擇題另逐項分析選項。
- 結果區關鍵量必須在選項前出現；選項只引用、不重算。

## 選項規則

- 所有選擇題最後都逐項分析，不需要進階開關。
- API schema 維持扁平的 `type + text`；`choice.text` 以原題標籤開頭，本機編譯器再拆成對齊的標籤欄與文字欄。
- 標籤、數量與順序完全依題目，不假設英文字母或固定數量。
- 含一般說明的選項自然換行；只有以公式為主且確實超寬的內容橫向滑動。

## 參考答案規則

- 參考答案是強烈偏好，不是硬鎖。
- 獨立驗證回覆無法解析、驗證未通過、或詳解答案與參考答案不同時：**仍顯示詳解**，並在設定驗證列標警告。
- 答案不符時會嘗試一輪「在守恆前提下對齊參考答案」；對不齊則保留獨立詳解。
- 只有本機算式等號不一致（且修正失敗）才拒絕顯示。

## NOTE 規則

- 解題 AI 在 `calculation` 純算式寫入 `\htmlData`；note 須為「物種＋物理量」，禁止空泛標籤與無物種「物質的量」。
- 主解題盡量一次寫完整；本機 `auditNotes` 判定不足或詞彙空泛時另開補寫輪（與計算修正輪分離）。
- 補寫後仍不足，本機對帶單位數值補標（`annotateQuantities`）；完整 `\htmlData` 會先保護，避免出現 `htmlDatanot` 殘字。
- 不以 NOTE 個數作為通過條件；通過條件是關鍵量可點且詞彙清楚。

## 維護原則

- 解題 system prompt 只由 `js/solution-core.js` 提供（`buildSystem()` = `SYSTEM_CORE` + `SYSTEM_CALC`）。通則卡只在 user 訊息提供短判定條件。
- 顯示前的科學 token 正規化只在 `app.js` 的 `renderAiInto` 呼叫一次 `normalizeScientificTokens`（`js/render.js`），避免多處各自寫化學式／單位正則。
- 參考答案不是既定真相，不放入主解題提示詞，也不寫入 JSON schema 的 `enum`。
- 主解題與參考答案驗證使用不同的免費 Flash；驗證結果只有明確 `consistent: true` 才放行。
- 顯示前檢查：`auditCalculationDocument`、`auditNotes`、`auditCrowdedCalculations`。
- 不為了排版增加多層 API schema；排版結構留在本機編譯器處理。
- 橫滑由本機依實際寬度判定，不讓 AI 指定。
- 不再使用題庫注入、格式範本、BoardDoc 或 SolutionDocument 備援管線。
- 不新增從一般文字猜選項數量或固定標籤範圍的規則。
- 修改後執行 `python tests/check-js-syntax.py` 與完整自動測試。
