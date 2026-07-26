# 新增章節引擎

以新增電化學引擎為例：

1. 複製 `engines/_template/`，命名為 `engines/electrochemistry/`。
2. 在該資料夾完成 `index.ts`、`router.ts`、`types.ts` 與 `solvers/`。
3. 在 `core/engine-registry.ts` 匯入並登記：

```ts
import { solveElectrochemistry } from "../engines/electrochemistry/index.js";

export const engineRegistry = {
  acid_base: solveAcidBase,
  electrochemistry: solveElectrochemistry,
};
```

4. 新增測試。
5. 執行 `npm test`。

主網站及 `core/engine-router.ts` 不需要修改。
