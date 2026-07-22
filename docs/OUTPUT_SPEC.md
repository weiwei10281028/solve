# 輸出規格（給 AI 與維護者）

AI 只回傳指定 JSON；**不得**輸出 Markdown、HTML、`$`、`$$`、`\ce{}`、`\mathrm{}` 等排版或跳脫符號。所有顯示語法由本機雙通道 compiler 編譯。

## JSON 結構

```json
{
  "blocks": [
    { "type": "heading|paragraph|chemical_equation|calculation|reaction_table|choice", "text": "..." }
  ],
  "answer": "最終答案"
}
```

每個 block 只有 `type` 與 `text` 兩個欄位，依閱讀順序排列。

## 四條排版契約

1. **數學通道**：所有代數／對數／分數／根號／科學記號只能寫在 `calculation`，遵守數學 LaTeX 紀律（次方 `x^{2}`、分數 `\dfrac`、一步一式）。
2. **化學通道**：物種／離子／反應式寫在 `paragraph`／`choice`／`chemical_equation`，用一般純文字（例：`H3PO4`、`H3O+`、`2H2 + O2 -> 2H2O`），由本機轉 mhchem。
3. **所有文字與算式中的化學量與濃度**：莫耳數固定寫 `n(物質)`、質量固定寫 `W(物質)`、體積固定寫 `V(對象)`；溶液濃度固定寫 `[物種]`，不用 `C(物種)` 或 `C1V1`。本機會直接把明確的 `C(物種)`／`c(物種)` 改顯示為 `[物種]`，不要求 AI 重寫。關係式寫 `n(X)＝[X] × V` 與 `[X]＝\dfrac{n(X)}{V}`；比例 `A：B` 可保留比例寫法。
4. **禁止** AI 原文出現 `$`、`$$`、`\ce{}`、`\mathrm{}`（由 compiler 編譯，避免破碎）。

## Block 分工

| Block | AI 寫法 | Compiler 輸出 |
|-------|---------|---------------|
| `heading` | 固定短標題（題意／依據與推導／結果／選項分析） | Markdown 區塊標題 |
| `paragraph` | 中文說明 + 純文字化學式 | 化學 token → `$\ce{...}$`；偵測到裸次方等數學則導入數學通道 |
| `calculation` | 一條等號鏈；次方、`\dfrac`、Unicode `×` | 正規化後包 `$$...$$`（display） |
| `chemical_equation` | `2H2 + O2 -> 2H2O`；可逆用 `<=>` | `$\ce{...}$`（顯示 ⇌） |
| `reaction_table` | 物種｜起始｜變化｜結果 | KaTeX `array` 表格 |
| `choice` | 以題目原標籤開頭（如「（甲）…」），寫理由與正確／錯誤結論 | `@@CHOICE[label]@@` + 逐行 |

## 硬規則（寫入 SYSTEM 並由測試把關）

- 凡含 `^`、`\dfrac`、`\sqrt`、分數者**只能**出現在 `calculation`；若 `paragraph` 內出現裸次方（如 `x^2`），compiler 自動導入數學通道補成 `x^{2}`。
- 一步一式：一個 `calculation` 只放一條等號鏈；多步用多個 block。
- 分數一律 `\dfrac`（含巢狀）；禁止 `A/B`、`÷` 裸寫。
- 乘號用 Unicode `×`；數字與單位間禁止逗號。

## 化學計算符號來源

`js/solution-core.js` 是 `n`、`W`、`V` 的唯一規範來源。章節提醒、通則卡與追問提示不得另行定義這些符號；追問會直接讀取同一份規範。
