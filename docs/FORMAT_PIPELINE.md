# 排版與 NOTE 流程

更新日期：2026-07-14

```text
題目／圖片
  -> 瀏覽器以設定中的 Gemini API Key 呼叫 generateContent
  -> js/render.js：段落、公式與反應表前處理
  -> js/latex-sanitize.js：修復或降級無法顯示的 LaTeX
  -> KaTeX：公式渲染
  -> js/math-note/math-note.js：NOTE 與 popover
```

本機使用時，雙擊 `啟動網頁.bat`，開啟 `http://localhost:18080/index.html`，在「設定」貼上 Gemini API Key 即可。此模式不需要 Node server、`/api/solve` 或 GitHub 部署。

修改流程後，至少執行：

```text
python tests/check-js-syntax.py
python tests/run-self-test.py
```
