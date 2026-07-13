# 排版與 NOTE 流程

更新日期：2026-07-13（Phase 7）

## 單一顯示流程

```text
AI 純文字
  -> js/render.js：段落、裸露 LaTeX、公式邊界與計算式前處理
  -> js/latex-sanitize.js：修復可判斷的 LaTeX；無法修復時改為可讀文字
  -> KaTeX：公式渲染
  -> js/math-note/math-note.js：htmlData NOTE 正規化、分式定位與 popover
  -> css/math-note/math-note.css：NOTE 與分式的視覺樣式
```

`js/math-note/note-check.js` 只負責檢查 NOTE 的密度與語意，`note-ensure.js` 只負責產生 NOTE 補正要求；兩者不得處理一般 LaTeX 或頁面排版。

## 不可跨越的責任

- `render.js` 可修復公式邊界與裸露 LaTeX，但不可猜測化學或計算意義。
- `latex-sanitize.js` 不可留下原始、無法顯示的 LaTeX 指令；失敗時必須降級成可讀文字。
- NOTE 只能包數字、運算因子或具語意的完整式子；不可只包單位。
- 中文說明與公式分開：中文在 `$...$` 外，公式完整包在 `$...$` 或 `$$...$$` 內。
- 非 KaTeX 數字使用 tabular numerals，避免同一段文字內數字寬度不一致。

## 固定檢查案例

1. 裸露 `\dfrac{n}{V}`：須被包為可渲染公式或降級成可讀文字。
2. 不完整 `\dfrac`：不可直接顯示原始反斜線命令。
3. `$CO_2$`：化學式與中文說明不得黏連為裸下標。
4. `\htmlData{note=體積（mL）}{30}`：NOTE 保留數字與含單位的語意標籤。
5. 巢狀分式 NOTE：分數線須在 NOTE 背景之上，且分子分母不互相推擠。

修改此流程後，至少執行 `python tests/check-js-syntax.py`、`python tests/run-self-test.py`，以及以固定案例檢查 `LatexSanitize.sanitizeText()` 的降級結果。
