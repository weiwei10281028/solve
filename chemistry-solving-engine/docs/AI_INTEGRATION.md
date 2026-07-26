# AI 串接說明

## 固定流程

1. AI 從題目擷取題型與必要參數。
2. AI 產生符合 Engine Interface 的 JSON。
3. 主網站只呼叫 `solveChemistry(request)`。
4. 計算引擎回傳結果、中間值、檢查與流程紀錄。
5. AI 根據回傳 JSON 撰寫繁體中文高中詳解。

## 主網站唯一入口

```js
import { solveChemistry } from "./dist/index.js";
```

主網站不要直接匯入 `engines/acid-base` 內部檔案，以免日後重整章節時需要修改正式網站。
