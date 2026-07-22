# AI 解題 v2 架構

## 設計原則

**AI 只負責語意，本機只負責顯示。** Gemini 只交付語意化 JSON（區塊 + 答案），所有數學式、化學式、反應式的排版語法一律由本機編譯，避免 AI 直接輸出 `$`、`\ce{}` 造成的破碎與不一致。

## 管線總覽

```
使用者輸入（圖片／文字）＋ 進階勾選（章節／格式）
   │
   ├─ 提示詞層（優先權由高到低）
   │    L0  使用者手動勾選章節／作答格式／進階功能（最高）
   │    L4  化學通則卡（自動命中，僅補充參考）
   │    L1  主 SYSTEM 骨架（JSON schema、heading、block 類型、算式紀律）
   │
   ▼
Gemini API ── 回傳語意 JSON
   │
   ▼
SolutionCore.parse ── 解析／修復 JSON（截斷、跳脫還原）
   │
   ▼
Compiler（雙通道）── js/solution-core.js（實作）＋ js/compiler.js（單一入口）
   │    mathPass  calculation：次方 ^{n}、\dfrac、\sqrt、科學記號、內嵌 \ce
   │    chemPass  paragraph／choice／chemical_equation：純文字化學式 → \ce{}
   │    兜底      paragraph 內偵測到 x^2 等次方式 → 導入數學通道
   │
   ▼
compile ── 組出詳解 Markdown（含 $...$ 數學島、@@CHOICE@@、@@ANSWER@@ 標記）
   │
   ▼
render.js（薄層）── marked 解析 Markdown → KaTeX 0.18.1 + mhchem 渲染
   │
   ▼
board（詳解區）── board.css：方格紙底、KaTeX_Main 統一字形、暖褐答案盒
```

## 檔案職責

| 檔案 | 職責 |
|------|------|
| `index.html` | 介面（同 7.18）；KaTeX 0.18.1 官方 CDN + 字型 preload |
| `js/solution-core.js` | SCHEMA、SYSTEM 提示詞、parse、雙通道編譯實作（`calculation` / `chemistry` / `compile`） |
| `js/compiler.js` | 雙通道單一外部入口 facade：`mathPass` / `chemPass` / `compileDocument` / `prepare` |
| `js/render.js` | 薄渲染層：Markdown → KaTeX；選項 grid、公式橫滑、答案盒 |
| `js/app.js` | 解題流程編排、API 呼叫、L0 優先權注入、預設 Gemini 3.5 Flash |
| `js/prompts.js` | 主解題／獨立驗證／追問提示詞組裝 |
| `js/solve-spec.js` | 章節類型與作答格式（使用者手動勾選 = L0 最高優先） |
| `js/chem-rule-cards.js` | 化學通則卡（自動命中 = L4 補充參考，不得覆寫使用者章節） |
| `css/board.css` | 詳解板書視覺（TUTOR FORMOSA 風格） |

## 字形

詳解區全面採用 KaTeX 內建 **Computer Modern**（`KaTeX_Main` 直立、`KaTeX_Math` 變數斜體），對齊參考圖的教科書感。中文以 `Noto Sans TC` fallback。載入 `katex.min.css` 與字型 preload 是避免「醜字／閃爍」的關鍵。

## 優先權（衝突規則）

- 使用者**已勾選章節** → 該章節檢查點必須完整涵蓋，通則卡不得覆寫使用者選定的解題方向。
- 通則卡僅在**未勾選章節**或**補充現象門檻／計量邊界**時加強，且不得與使用者章節衝突。
- 格式偏好（計算精簡、四步推導）不得改變化學判斷結論。
- 骨架與排版（JSON schema、heading、block 類型、算式規則）恆依主 SYSTEM。

## 不在 v1 範圍

- **NOTE**（`\htmlData`、math-note、補寫輪）：已於管線移除，Phase 4 再議。
- **結構式模組**（`structures/`、`structures-bundle.js`、`chem-structure.js`）：保留但由使用者自行維護／覆蓋。

## 測試

| 指令 | 說明 |
|------|------|
| `python tests/check-js-syntax.py` | Node 語法檢查 + 必要符號 |
| `node tests/test-compiler.js` | v2 雙通道排版回歸（x^2、巢狀分式、化學式、L0） |
| `python tests/run-self-test.py` | 靜態契約檢查 + 本機 HTTP 冒煙 |
