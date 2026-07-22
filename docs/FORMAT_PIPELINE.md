# 排版與 NOTE 流程

更新日期：2026-07-20

```text
題目／圖片
  -> 瀏覽器以設定中的 Gemini API Key 呼叫 generateContent
  -> 解題 AI 在算式 text 中同步寫入 \htmlData NOTE（規格見 SolutionCore.SYSTEM）
  -> js/solution-core.js：驗證結構化區塊，統一文字標點、化學式與算式；保留 AI NOTE，本機不去另補標
  -> js/app.js（renderAiInto）：分離 @@ANSWER@@ 後，對主文呼叫 js/render.js 的 normalizeScientificTokens 做顯示前唯一的科學 token 正規化
  -> js/render.js：編譯 Markdown 與選項版面
  -> js/latex-sanitize.js：修復或降級無法顯示的 LaTeX
  -> KaTeX：公式渲染
  -> js/math-note/math-note.js：NOTE 與 popover
```

API 只接收扁平的 `type + text` 區塊；選項文字以原題標籤開頭，再由本機編譯器拆成固定對齊的標籤欄與文字欄。數量、標籤形式與順序完全依原題。一般文字自然換行；只有純長算式或反應表可橫向滑動。

本機使用時，雙擊 `啟動網頁.bat`，開啟 `http://localhost:18080/index.html`，在「設定」貼上 Gemini API Key 即可。此模式不需要 Node server、`/api/solve` 或 GitHub 部署。

修改流程後，至少執行：

```text
python tests/check-js-syntax.py
python tests/run-self-test.py
```
