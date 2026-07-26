# Stoichiometry Engine Plan

## Summary

第一批計算引擎先做 `stoichiometry`，不要做大型 `stoichiometry_concentration`。AI 仍負責讀題、選 task、組織詳解；引擎只負責穩定的化學計量數值與規則判定。

後續複合題可由路由 AI 一次輸出多個 ordered tasks，本地依序執行多個小引擎。第一版先支援線性 tasks，不做任意 DAG。

## Engine Boundary

`stoichiometry` 包含：

- `mole_conversion`：質量、莫耳數、粒子數互換。
- `stoichiometric_ratio`：反應係數莫耳比換算。
- `limiting_reagent`：限量試劑與目標產物理論產量。
- `theoretical_yield`：由限量試劑計算理論產量。
- `percent_yield`：實際產量與理論產量求百分產率。

不放入第一批：

- 濃度、稀釋、ppm、g/L：後續 `concentration` engine。
- 式量、百分組成、經驗式、分子式：後續 `formula_composition` engine。
- 氣體、熱化學、電化學、Ksp：後續獨立 engine。

## GPT Chat Handoff

另一個 GPT Chat 只負責寫 `stoichiometry` 的 `solvers/` 與測試草稿。Codex 負責整合：

- `engines/stoichiometry/index.ts`
- `engines/stoichiometry/router.ts`
- `core/engine-interface.ts`
- `core/engine-registry.ts`
- `tests/stoichiometry.test.js`
- 前端 adapter/catalog

上傳給 GPT Chat 的檔案與提示詞由本機 skill `design-chemistry-engine` 產生；預設 reference 為：

`C:\Users\User\.codex\skills\design-chemistry-engine\references\stoichiometry-handoff.md`

## Multi-Engine Direction

複合題未來應拆成 ordered tasks，例如：

1. `formula_composition.molar_mass`
2. `concentration.mass_per_volume_to_amount`
3. `stoichiometry.stoichiometric_ratio`

第一版約束：

- 單題最多 3 到 5 個 tasks。
- task 依序執行。
- 後續 task 才可引用前面 task 的 `result`。
- 本地必須驗證 engine、operation、input 欄位、引用路徑。
- 驗證失敗時退回一般 AI 詳解，不硬跑引擎。

## Acceptance Tests

- `12 g C` 與 `12 g/mol` 得 `1 mol`。
- `2 mol H2` 在 `2H2 + O2 -> 2H2O` 中換算為 `2 mol H2O`。
- `2 mol H2` 與 `0.5 mol O2` 判斷 `O2` 為限量試劑，理論產量為 `1 mol H2O`。
- `actualYield_g = 8`、`theoreticalYield_g = 10` 得 `80 percent`。
- 負數、缺欄位、未知 species id 會走標準 failure shape。
