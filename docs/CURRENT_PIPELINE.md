# 目前唯一詳解管線

```text
題目／圖片
  → 主 Flash 獨立解題（看不到參考答案）
  → 另一個 Flash 獨立驗證參考答案（有填時）
  → Gemini 依 SolutionCore JSON Schema 回傳內容區塊
  → SolutionCore 驗證並編譯文字、化學式、算式與選項標記
  → 本機檢查可判定的等號計算與最終答案
  → 不一致時最多用 Gemini 3.5 Flash 重新計算一次；仍不一致就拒絕顯示
  → Markdown Renderer 建立段落與固定選項 grid
  → KaTeX／mhchem 渲染公式與化學式
  → NOTE 後處理與必要的純公式橫向滑動
```

## 選項規則

- 所有選擇題最後都逐項分析，不需要進階開關。
- API schema 維持扁平的 `type + text`；`choice.text` 以原題標籤開頭，本機編譯器再拆成對齊的標籤欄與文字欄。
- 標籤、數量與順序完全依題目，不假設英文字母或固定數量。
- 含一般說明的選項自然換行；只有以公式為主且確實超寬的內容橫向滑動。

## 維護原則

- 解題 system prompt 只由 `js/solution-core.js` 提供。
- 參考答案不是既定真相，不放入主解題提示詞，也不寫入 JSON schema 的 `enum`。
- 主解題與參考答案驗證使用不同的免費 Flash；驗證結果只有明確 `consistent: true` 才放行。
- 算式一致性只保留 `auditCalculationDocument` 這一條顯示前檢查路徑。
- 不為了排版增加多層 API schema；排版結構留在本機編譯器處理。
- 不再使用題庫注入、格式範本、BoardDoc 或 SolutionDocument 備援管線。
- 不新增從一般文字猜選項數量或固定標籤範圍的規則。
- 修改後執行 `python tests/check-js-syntax.py` 與完整自動測試。
