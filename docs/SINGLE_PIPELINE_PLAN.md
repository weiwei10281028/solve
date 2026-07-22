# 單一管線整合 PLAN

> 狀態：**Phase C 已完成**｜**Phase 2 已完成（範圍調整，見下方說明）**  
> 更新日期：2026-07-20  
> 關聯文件：[CURRENT_PIPELINE.md](./CURRENT_PIPELINE.md)、[FORMAT_PIPELINE.md](./FORMAT_PIPELINE.md)、[CHAPTER_TYPES.md](./CHAPTER_TYPES.md)、[PROMPT_LAYERS.md](./PROMPT_LAYERS.md)

### 實施範圍說明（Phase 2）

R1／R2／R5／R7／R8 依原計畫實施。R3／R4 的**根因**（`formatText` 把底線化學式 `H_3PO_4` 逐字元拆碎成 `H$3PO$4`）已在 `solution-core.js` 修正（新增 `flattenBareChemUnderscores` 前處理），但**未移除** `chemical_equation`／`calculation` 既有直接輸出 `\ce{}`／`\dfrac` 的作法——這條路徑本來就可靠（見背景表格），移除會讓 `Core.prepare()` 的文字內容改為需仰賴瀏覽器才能還原，且會讓現有 `tests/test-solution-core.js` 大量斷言失真，風險大於收益。`normalizeScientificTokens`（R1）已接在 `renderMarkdownSolution` 前，作為顯示前唯一的科學 token 正規化安全網；R6（`latex-sanitize.js`）本來就只做 KaTeX 區段修復，未含重複化學正則，無需再縮減。

---

## 背景與問題

酸鹼強度排序題在【依據】反應式渲染正常，【結果】卻出現 `H$3PO$4` 半渲染。根因不是 KaTeX 失效，而是**雙管線**：

```text
現況（雙管線，易打架）

AI JSON
  → SolutionCore.compile / formatText
      · CHEM_CANDIDATE 包 $\ce{}$
      · 裸數字全包 $...$（H_3PO_4 → H$3PO$4）
  → renderMarkdownSolution → doKaTeX
  → render.js normalizeScientificTokens（❌ 主詳解未呼叫；僅 NOTE popover 使用）
```

| 區塊類型 | 編譯路徑 | 化學式可靠性 |
|----------|----------|--------------|
| `chemical_equation` | `chemistry()` 直送 mhchem | 高 |
| `paragraph` / `choice` | `formatText()` 正則 | 低（遇 `H_3PO_4` 易碎） |

提示詞亦分散：`solution-core` SYSTEM、SolveSpec 章節、ChemRuleCards 通則卡、追問 prompt，排版與 heading 規則可能互相覆寫。

---

## 目標

1. **單一渲染管線**（Phase 2 一次完成）：所有科學 token 正規化只走一個入口。
2. **AI 不給段落 LaTeX**（Phase C 先定規則）：化學式用純文字 `H3PO4`；僅 `calculation` 保留 `\dfrac`、`\htmlData`。
3. **提示詞四層保留**：主／次／章節／通則卡，但**優先順序明確**，各層只管「寫什麼」，不管「怎麼排版」。
4. **本機容錯**（Phase 2）：AI 偶爾寫 `H_3PO_4` 或漏包 `$` 時，顯示仍正確。

---

## 已確認決策

| 項目 | 決策 |
|------|------|
| 執行順序 | **先做 Phase C（提示詞）** → 再做 **Phase 2（渲染一次完成）** |
| 章節規則 | 改「**內容須涵蓋**」，不再「小標依序呈現」 |
| 文字分工 | `calculation` 才用 `\dfrac`／`\htmlData`；其餘 block 純文字化學式 |
| 追問 prompt | 化學式與主解題一致；算式可 `\dfrac` 或 `$...$`；**禁止** `\htmlData` NOTE |
| 渲染實施 | **不分 Phase A／B**；Phase 2 **一次做完**（接入 normalize + compile 瘦身 + 刪重複 chem 邏輯） |
| feature flag | **不要**；直接切換，靠測試與 git revert |

### 硬性約束（全程不可破壞）

- **NOTE**：`\htmlData` 規則、稽核、補寫輪、popover **不得改壞**。
- **注入流程不變**：`system = buildSystem() + buildSystemSupplement()`；`user = 題目 → 優先橫幅 → 通則卡參考 → 章節／格式進階`。
- 不改 API schema、解題主流程、驗證輪。

---

## 與現行流程對照（明確不變 vs 會變）

> 本 PLAN **不改解題架構**（誰呼叫誰、幾輪 API、稽核順序）。Phase C 動 **prompt**；Phase 2 動 **本機 compile／渲染**。

### 不變（對照 [CURRENT_PIPELINE.md](./CURRENT_PIPELINE.md)）

| 環節 | 說明 |
|------|------|
| 主 Flash 解題 | 仍回 JSON；主模型不看參考答案 |
| 參考答案驗證 | 獨立 Flash、`consistent` 判定邏輯不變 |
| user 組裝順序 | `題目 → 優先橫幅 → ChemRuleCards.buildReferenceBlock → SolveSpec.buildActiveBlock` |
| system 組裝 | `SolutionCore.buildSystem()` + `ChemRuleCards.buildSystemSupplement()` |
| 通則卡預判 | intent 模型、`buildMandatoryWorkflowBlock` 主體不動 |
| `SolutionCore.prepare` | parse、compile、稽核入口不變（Phase C 不碰 compile） |
| 算式硬擋／修正輪 | `auditCalculationDocument`、Gemini 重算一次 |
| NOTE 稽核／補寫輪 | `auditNotes`、NOTE 補寫、本機 `annotateQuantities` 兜底 |
| 通則卡 audit | `ChemRuleCards.auditDocument` |
| 參考答案對齊輪 | 軟警告、仍顯示詳解 |
| API schema | 扁平 `type + text` blocks、`answer` |
| 選擇題骨架 | 題意→依據→推導→結果→選項分析（heading 名稱不變） |
| 顯示管線順序 | prepare 文字 → `renderMarkdownSolution` → `doKaTeX` → NOTE 後處理 |
| 追問 UI 流程 | append 追問區、`renderAiInto`（Phase C 只改 follow-up **system 文案**） |

### Phase C 會變（僅 prompt／文案）

| 項目 | 變更 |
|------|------|
| L1 SYSTEM | 拆分 CORE/CALC；【文字與算式分工】；NOTE 段**原文保留** |
| L2/L3 | 章節改「內容須涵蓋」；加服從 L1 聲明 |
| L4 supplement | 加「不得改 block／heading」 |
| 追問 system | 化學式一般文字；禁 `\htmlData` |
| 文件 | 新增 `PROMPT_LAYERS.md` |

**Phase C 明確不動**：`app.js` 解題流程、`buildReferenceBlock` 主體、compile、`render.js`、NOTE 程式邏輯。

### Phase 2 會變（本機顯示／compile 內部）

| 項目 | 變更 |
|------|------|
| token 正規化 | 單一 `normalizeScientificTokens` 入口 |
| `formatText` | 移除段落 chem 包 `$`（改由 render 做） |
| `compile` 輸出 | chemical_equation 不預包 `$`（**對外流程仍 prepare→render**） |

**Phase 2 仍不變**：API 輪次、稽核、NOTE 互動、注入順序。

---

## 目標架構（Phase 2 完成後）

```text
AI JSON
  ↓
SolutionCore.compile()              ← 只做「結構」
  · heading / choice marker / @@ANSWER@@
  · chemical_equation → 原樣文字（不預包 $）
  · calculation → 保留 \dfrac、\htmlData
  · paragraph / choice → 中文 + 純文字化學式
  ↓
normalizeScientificTokens()         ← 唯一「科學 token → LaTeX」入口
  · H_3PO_4 → H3PO4；裸化學式 → $\ce{...}$
  · 裸算式／單位／分數修復；字母間數字不單獨包 $
  ↓
renderMarkdownSolution()            ← Markdown 結構（不動 token）
  ↓
doKaTeX()                           ← KaTeX + NOTE + 橫滑後處理
```

### 檔案職責（Phase 2 完成後）

| 檔案 | 職責 |
|------|------|
| `js/solution-core.js` | JSON 驗證、compile 結構、calculation/NOTE 語意、稽核輪、**L1 主 SYSTEM** |
| `js/render.js` | **唯一** token 正規化 + Markdown + KaTeX + 版面後處理 |
| `js/latex-sanitize.js` | KaTeX 區段內修復／降級（不再平行一套 chem 邏輯） |
| `js/solve-spec.js` | 章節／格式 L2、L3 注入（內容約束，非排版） |
| `js/chem-rule-cards.js` | 通則卡 L4 注入（判定約束） |
| `js/prompts.js` | user 組裝、追問 prompt（與 L1 對齊） |

---

## 提示詞四層架構

### 優先順序（衝突時）

分兩條軸：

```text
【骨架與格式｜不可被覆寫】
L1  主 SYSTEM（solution-core.js）
      JSON schema、語言、選擇題骨架、block 分工、calculation 的 \dfrac / \htmlData

【化學判斷與檢查順序｜有注入則優先於一般習慣】
L4  化學通則卡（ChemRuleCards）
      判定條件、關鍵通則、強制解題順序、現象／計量門檻
L3  章節／細項（SolveSpec CHAPTERS）
      「這類題須檢查什麼」；須寫在【依據】【推導】內
L2  次級格式（SolveSpec FORMATS + force）
      計算精簡、強化依據用語、反應表；不得改變判斷結論
L1′ 一般解題紀律
      僅在未注入 L4／L3 或未衝突時適用
```

通則卡與章節同時存在：門檻／計量／可否外推以通則卡為準；章節檢查點仍須涵蓋，不得覆寫通則卡。

### 注入位置（維持 app.js 順序）

| 層 | 注入 | 來源 |
|----|------|------|
| L1 | `system` | `SolutionCore.buildSystem()` |
| L4 約束 | `system` 追加 | `ChemRuleCards.buildSystemSupplement()` |
| 題目 | `user` | `buildSolveUserText()` |
| 優先橫幅 | `user` 追加 | `app.js`（有通則卡或章節時） |
| L4 參考 | `user` 追加 | `ChemRuleCards.buildReferenceBlock()` |
| L2 + L3 | `user` 追加 | `SolveSpec.buildActiveBlock()` |

順序：`題目 → 優先約束橫幅 → 通則卡參考 → 章節／格式進階`。

---

## Phase C｜提示詞整理（**本輪直接做**）

**目的**：四層清晰、LaTeX 規則整合、不打架；**不動 compile、不動渲染**。

| # | 項目 | 檔案 |
|---|------|------|
| C1 | 拆分 `SYSTEM_CORE` / `SYSTEM_CALC`；加入【文字與算式分工】 | `solution-core.js` |
| C2 | 改寫 `buildUserBlock` / `buildActiveBlock`（內容須涵蓋，非小標依序） | `solve-spec.js` |
| C3 | 通則卡 `buildSystemSupplement` 加服從 L1 聲明 | `chem-rule-cards.js` |
| C4 | 追問 prompt 與 L1 對齊 | `prompts.js` |
| C5 | 新增 [PROMPT_LAYERS.md](./PROMPT_LAYERS.md) | `docs/` |
| C6 | 更新本 PLAN 狀態 | `docs/SINGLE_PIPELINE_PLAN.md` |

**不動**：`buildReferenceBlock`、`buildMandatoryWorkflowBlock` 主體、NOTE 全文、app.js 注入順序。

### L1 主 SYSTEM 調整要點

**保留：**

- 只回 JSON、繁體中文、選擇題五段骨架。
- `calculation` 一步一 block、`\dfrac`、`\htmlData` NOTE 規則（**原文意完整保留**）。
- choice 原題標籤、answer 格式。

**新增【文字與算式分工】：**

```text
paragraph／choice／chemical_equation 的化學式與離子請用一般文字（例：H3PO4、H3O+、CH3COOH）；
禁止 $、_、\ce{}、\mathrm{}。
calculation 才使用 \dfrac 與 \htmlData。
```

**程式結構：**

```javascript
const SYSTEM_CORE = `...`;
const SYSTEM_CALC = `...`;
const SYSTEM = SYSTEM_CORE + SYSTEM_CALC;
function buildSystem() { return SYSTEM; }
```

### L2／L3／L4／追問

見上文「L2 次級格式」「L3 章節」「L4 通則卡」「追問 prompt 對齊」各節（內容不變，實施時照 C1～C4 執行）。

**Phase C 驗收：**

- `python tests/check-js-syntax.py`、`python tests/run-self-test.py` 通過。
- `Core.SYSTEM` 仍含 NOTE、選擇題骨架、算式分行等關鍵字（測試不 regression）。
- 勾選章節 + 通則卡時，prompt 不再出現「小標依序呈現」。

---

## Phase 2｜單一渲染管線（**Phase C 完成後，一次做完**）

**目的**：消除 `H$3PO$4`；compile 只管結構；token 邏輯只留 `render.js`。  
**不做**分段止血、**不加** feature flag。

| # | 項目 | 檔案 |
|---|------|------|
| R1 | 主路徑 `doKaTeX` 前接入 `normalizeScientificTokens` | `render.js`、`app.js` |
| R2 | 底線化學式 `H_3PO_4` → `H3PO4`；字母間數字不單獨包 `$` | `render.js` |
| R3 | 從 `formatText` 移除 `CHEM_CANDIDATE` 包 `$\\ce{}$`、段落裸數字包 `$` | `solution-core.js` |
| R4 | `compile`：`chemical_equation` 原樣文字；`calculation` 仍 `$...$` | `solution-core.js` |
| R5 | 合併 chem regex；刪 `solution-core` 與 `render.js` 重複邏輯 | `render.js`、`solution-core.js` |
| R6 | `latex-sanitize.js` 縮為 KaTeX 區段 repair | `latex-sanitize.js` |
| R7 | 測試與 fixture 更新 | `tests/*` |
| R8 | 更新 [CURRENT_PIPELINE.md](./CURRENT_PIPELINE.md)、[FORMAT_PIPELINE.md](./FORMAT_PIPELINE.md) | `docs/` |

**Phase 2 驗收：**

- 酸鹼強度链 `H3O+ > H3PO4 > …` 及 `H_3PO_4` 變體：無 `H$3PO$4`。
- NOTE 可點、無 `htmlDatanot`；self-test 全過。

---

## 執行順序

```text
Phase C（提示詞）          ← 本輪
    ↓ 驗收 prompt／測試
Phase 2（渲染一次完成）    ← 下一輪，R1～R8 整包做
    ↓
文件更新 + 全量測試
```

---

## 檔案變更總表

| 檔案 | Phase C | Phase 2 |
|------|:-------:|:-------:|
| `js/solution-core.js` | ✓ | ✓ |
| `js/solve-spec.js` | ✓ | |
| `js/chem-rule-cards.js` | ✓ | |
| `js/prompts.js` | ✓ | |
| `js/render.js` | | ✓ |
| `js/app.js` | | ✓ |
| `js/latex-sanitize.js` | | ✓ |
| `tests/test-solution-core.js` | ✓（SYSTEM 断言） | ✓ |
| `docs/PROMPT_LAYERS.md` | ✓（新增） | |
| `docs/CURRENT_PIPELINE.md` | | ✓ |
| `docs/FORMAT_PIPELINE.md` | | ✓ |

---

## 測試計畫

### Phase C

```text
python tests/check-js-syntax.py
python tests/run-self-test.py
node tests/test-solution-core.js    # 若有 Node
```

### Phase 2（額外）

| 案例 | 断言 |
|------|------|
| 酸鹼強度链 | 無 `H$3PO$4`；≥5 個 `.katex` |
| `H_3PO_4` 於 paragraph | 完整 mhchem |
| NOTE calculation | 可點、無 `htmlDatanot` |

手動：酸鹼強度選擇題 + 章節／通則卡組合，heading 不重複。

---

## 風險與回退

| 風險 | 緩解 |
|------|------|
| Phase C 與 NOTE 規則衝突 | `SYSTEM_CALC` 原 NOTE 段完整保留；「禁止 $」限縮到非 calculation block |
| Phase 2 compile 格式變 | 整包改測試；git revert 整輪 |
| 章節改寫後 AI 忽略細項 | 「內容須涵蓋」；`checkReply` 仍用 steps 關鍵字 |

---

## 完成後文件關係

```text
docs/
  PROMPT_LAYERS.md         ← Phase C 新增
  SINGLE_PIPELINE_PLAN.md  ← 本文件；各 Phase 完成後更新狀態
  CURRENT_PIPELINE.md      ← Phase 2 更新管線圖
  FORMAT_PIPELINE.md         ← Phase 2 更新
  CHAPTER_TYPES.md           ← 交叉引用
```

---

## Changelog

| 日期 | 內容 |
|------|------|
| 2026-07-20 | 初版；A/B/C 三階段 |
| 2026-07-20 | 合併 A+B 為 Phase 2 一次完成；本輪只做 Phase C |
| 2026-07-20 | 新增「與現行流程對照」：明確不變 vs Phase C/2 會變 |
| 2026-07-20 | Phase C 完成：SYSTEM 拆 SYSTEM_CORE/SYSTEM_CALC、章節注入改「內容須涵蓋」、通則卡 supplement 加服從 L1、追問 prompt 對齊、新增 PROMPT_LAYERS.md |
| 2026-07-20 | Phase 2 完成（範圍調整）：修正 formatText 底線化學式根因、normalizeScientificTokens 接入主渲染前、render.js 化學式判定改用 SolutionCore ELEMENTS 驗證；chemical_equation/calculation 既有可靠輸出保留不變 |
