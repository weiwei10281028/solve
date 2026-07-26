# Chemistry Solving Engine

可擴充的高中化學計算引擎。計算模組不產生自然語言，最終詳解交由 AI 撰寫。

## 你平常主要會看的資料夾

```text
core/       主網站入口、引擎登記、調度與共用介面
engines/    各化學章節的獨立引擎
docs/       串接規格及新增引擎說明
demo/       手動測試頁面
tests/      全系統整合測試
dist/       編譯產物，請勿手動修改
```

## 主網站唯一入口

```js
import { solveChemistry } from "./dist/index.js";
```

## 資料夾結構

```text
chemistry-solving-engine/
├── core/
│   ├── index.ts
│   ├── engine-router.ts
│   ├── engine-registry.ts
│   ├── engine-interface.ts
│   └── errors.ts
├── engines/
│   ├── acid-base/
│   │   ├── index.ts
│   │   ├── router.ts
│   │   ├── validation.ts
│   │   ├── math.ts
│   │   ├── solvers/
│   │   └── README.md
│   └── _template/
├── docs/
├── demo/
├── tests/
├── index.ts
├── package.json
└── tsconfig.json
```

## 建置與測試

```bash
npm install
npm test
```

新增章節時，只需要建立新的 `engines/<章節>/`，再於 `core/engine-registry.ts` 登記；正式網站不需要改動。
