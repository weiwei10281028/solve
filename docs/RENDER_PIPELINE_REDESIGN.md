# 詳解輸出管線重整提案

## 目標

- 以 Markdown 作為詳解的唯一來源格式。
- 讓 AI 依題目實際選項數逐項分析，不預設 A～E。
- 以語意 NOTE 校稿取代數字 regex 自動補標。
- 由單一 Renderer 負責編譯 Markdown、公式、化學式、NOTE 與選項版面。

## 建議流程

```text
題目／圖片
  → AI 產生 canonical Markdown 詳解（不含 NOTE）
  → AI NOTE／結構校稿（只補 NOTE、修正 Markdown 結構）
  → 本機 Validator
  → 單一 Renderer
  → KaTeX、mhchem、CSS 顯示
```

AI 不應在渲染後修正視覺排版；真正的行高、螢幕寬度、公式溢位與選項縮排必須由 Renderer 與 CSS 決定。

## Canonical Markdown

一般文字使用 Markdown；公式使用 `$...$` 或 `$$...$$`；選項使用固定 list item：

```md
## 選項分析

- [A] 理由。**正確**
- [B] 理由。**錯誤**
```

選項標籤由題目擷取器提供，可能是 A～D、A～E、A～J 或其他實際標籤；不得預設固定數量。Renderer 只辨識行首 `- [標籤]`，不從理由文字內的 `(A)`、`(B)` 猜測或拆分選項。

## NOTE 格式

NOTE 校稿使用固定標記：

```md
{{note:滴定液濃度（M）|0.016}}
{{note:mL 轉成 L|10^{-3}}}
```

Renderer 將其轉成 KaTeX `\htmlData`。NOTE 校稿僅可在現成的 Markdown／公式上增加或修正此標記，不得變更正文、數值、答案、化學式或選項。

## 驗證規則

- 選項集合必須與題目中擷取的集合完全相同；不可少、重複或額外新增。
- 化學式、離子電荷、下標、上標、反應係數與變數下標不可成為 NOTE target。
- NOTE 必須具體且有角色；禁止「此步計算結果」「代入值」「數值」「因子」等泛稱。
- `10^{-3}` 只在具單位換算脈絡時可標為換算因子；科學記號如 `2.5\times10^{-3}` 不可任意拆開。
- NOTE 移除後的 Markdown 正文必須與校稿前一致。
- Markdown、公式與 NOTE 標記須可完整解析。

## Renderer 責任

Renderer 是唯一可以：

1. 編譯 Markdown。
2. 將化學式交給 mhchem、數學式交給 KaTeX。
3. 將 NOTE 標記轉為互動 NOTE。
4. 依固定 DOM 渲染選項。
5. 處理手機版、長公式與視覺間距。

Renderer 不得從一般文字猜選項、補 NOTE 或改寫解題語意。

## 遷移順序

1. 建立 canonical Markdown parser 與任意選項集合的 validator。
2. 建立 NOTE 校稿 prompt、NOTE 標記與化學 token 保護。
3. 建立單一主 Renderer，讓新解題結果只走此路徑。
4. 建立五組以上固定驗收題，涵蓋不同選項數、化學式、單位換算、長公式與手機版。
5. 舊管線僅保留備援；新功能不再加入舊 regex／多重 parser。
