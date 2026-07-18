const fs = require('fs');
const vm = require('vm');
const Core = require('../js/solution-core.js');

const doc = {
  blocks: [
    { type: 'paragraph', text: '先配平 MnO4^-；係數比為 1:5.' },
    { type: 'paragraph', text: String.raw`代入 $[\ce{Fe2+}]=\dfrac{5\times0.016\,\mathrm{M}\times10.5\,\mathrm{mL}}{10.0\,\mathrm{mL}}=0.084\,\mathrm{M}$。` },
    { type: 'chemical_equation', expression: 'MnO4^- + 5Fe2+ + 8H+ -> Mn2+ + 5Fe3+ + 4H2O' },
    { type: 'calculation', text: '高錳酸根莫耳數:', expression: String.raw`n_{MnO4^-}=0.016M\times0.0105L=1.68\times10^{-4}mol,n_{Fe2+}=5\times n_{MnO4^-}=8.4\times10^{-4}mol,[Fe2+]=\frac{8.4\times10^{-4}mol}{0.0100L}=0.084M=` },
    { type: 'choice', label: 'F', text: '可延伸至第五個以後的選項', verdict: '敘述正確' }
  ],
  answer: 'A,B,C,F'
};

const result = Core.prepare(JSON.stringify(doc));
if (!result.ok) throw new Error('結構化詳解解析失敗');
if (!Core.SYSTEM.includes('不預設選項數量、標籤或順序')) throw new Error('選項規格未整合至唯一提示詞');
if (!result.text.includes('\\ce{MnO4^- + 5Fe^2+ + 8H+ -> Mn^2+ + 5Fe^3+ + 4H2O}')) throw new Error('反應式未由本機編譯');
if (result.text.includes('(F)')) throw new Error('本機不應自行補寫選項標籤');
if (!/\\htmlData\{note=[^}]*濃度[^}]*\}\{0\.016\}/.test(result.text)) throw new Error('本機 NOTE 未包含物種濃度語意');
if (!result.text.includes('\\htmlData{note=Fe²⁺（亞鐵離子）濃度（M）}{0.084}')) throw new Error('跨行濃度 NOTE 對應錯誤');
if (!result.text.includes('\\htmlData{note=濃度公式中的溶液體積（L）}{0.0100}')) throw new Error('跨行體積 NOTE 對應錯誤');
if (Core.formatText('針對第 22 題選項分析如下').includes('htmlData')) throw new Error('題號不應套用 NOTE');

const structureText = Core.prepare(JSON.stringify({ blocks: [{
  type: 'paragraph',
  text: String.raw`CO3^2-：平面三角形，C 為 sp2 混成，鍵角約 120°；$\ce{\ce{CO3^2-}$ 的 π 鍵數為 1。`
}], answer: 'B' })).text;
if (/\\ce\{\\ce/.test(structureText) || /\\htmlData/.test(structureText)) throw new Error('結構敘述不應產生巢狀化學式或 NOTE');
if (!structureText.includes('\\ce{CO3^2-}')) throw new Error('結構題化學式未統一為 mhchem');
if (/note=[^}]*(?:（[A-E]）|\([A-E]\))/.test(result.text)) throw new Error('NOTE 單位被誤判為選項標籤');
if (/0\.016M|0\.0105L|10\^\{-4\}mol|\\mathrm\{M\}/.test(result.text)) throw new Error('計算式仍直接顯示單位');
if (/\\mathrm\{(?:M|mL|L|mol)\}|\d(?:M|mL|L|mol)\b/.test(result.text)) throw new Error('文字欄位內的算式仍直接顯示單位');
if (!/係數比為 .*：.*。/.test(result.text) || result.text.includes('係數比為 1:5.')) throw new Error('文字標點未統一全形');
if (/=\$/.test(result.text)) throw new Error('未移除無右值的尾端等號');
if (!result.text.endsWith('@@ANSWER@@A、B、C、F')) throw new Error('答案標點未統一');

const bareCalculation = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', expression: String.raw`x=\dfrac{0.016\times10.5\times5}{10.0}=0.084` }],
  answer: '0.084 M'
}));
if (/\\htmlData\{/.test(bareCalculation.text)) throw new Error('裸數字算式不應自動補 NOTE');

const chemistryNoteCases = ['SO4 2-', 'SO4^2-', 'SO₄²⁻', 'CuSO4', 'NH4+', 'Fe3+', 'CO3 2-', 'Al2(SO4)3'];
for (const formula of chemistryNoteCases) {
  const rendered = Core.prepare(JSON.stringify({
    blocks: [{ type: 'calculation', expression: formula }], answer: 'x'
  })).text;
  if (/\\htmlData\{/.test(rendered)) throw new Error(`化學式被誤加 NOTE：${formula}`);
}
for (const marker of ['[1]', '(1)', '註1', 'Note 1', '①']) {
  if (!Core.isExplicitNoteMarker(marker)) throw new Error(`未辨識明確 NOTE 標記：${marker}`);
}
for (const nonMarker of ['1', 'SO4', 'Fe3+', 'Al2(SO4)3']) {
  if (Core.isExplicitNoteMarker(nonMarker)) throw new Error(`誤把化學式或裸數字當 NOTE 標記：${nonMarker}`);
}

const malformedJson = String.raw`{"blocks":[{"type":"calculation","expression":"x=\dfrac{0.016\times10.5}{10.0}=0.0168"}],"answer":"0.0168 M"}`;
if (!Core.prepare(malformedJson).ok) throw new Error('Gemini Lite 未跳脫 LaTeX 的 JSON 未被修復');
const validButWrongEscape = String.raw`{"blocks":[{"type":"calculation","expression":"x=\frac{5\times0.016}{10.0}=0.008"}],"answer":"0.008 M"}`;
const repairedEscape = Core.prepare(validButWrongEscape);
if (!repairedEscape.ok || !repairedEscape.text.includes('\\dfrac') || !repairedEscape.text.includes('\\times')) throw new Error('合法但錯誤的 JSON 跳脫未被修復');

const repeatedVerdict = Core.prepare(JSON.stringify({blocks:[{type:'choice',label:'A',text:'理由，敘述正確',verdict:'敘述正確'}],answer:'A'}));
if ((repeatedVerdict.text.match(/敘述正確/g) || []).length !== 1) throw new Error('選項結論重複');

const liteShape = Core.prepare(JSON.stringify([{ paragraph: { text: '說明' }, choice: [{ label: 'A', text: '理由，敘述正確', verdict: '敘述正確' }], answer: 'A' }]));
if (!liteShape.ok || !liteShape.text.includes('理由，敘述正確') || liteShape.text.includes('(A)')) throw new Error('選項標籤仍由本機推測');

const denseLite = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'首先計算甲溶液中 IO3^- 的濃度。甲溶液：0.428 g / 214 g mol^-1 = 0.002 mol，溶於 100 mL，濃度為 0.02 M。實驗一：[IO3^-] = 0.02 M * (4/20) = 0.004 M，[HSO3^-] = 0.004 M * (10/20) = 0.002 M。符合 1.25^2 = 1.5625，故反應為二級。'},
  {type:'choice',label:'E',text:'混合後 [IO3^-] = 0.02 M * (1/20) = 0.001 M，[HSO3^-] = 0.004 M * (15/20) = 0.003 M。速率比為 (0.001/0.004)^2 = 1/16，時間為 50 s * 16 = 800 s',verdict:'敘述正確'}
],answer:'E'}));
if (!denseLite.ok || denseLite.text.split('\n').length < 7) throw new Error('密集段落未依語意拆行');
if ((denseLite.text.match(/\\dfrac/g) || []).length < 5) { console.log(denseLite.text); throw new Error('斜線比例未轉為完整分式'); }
if (/\s\/\s|\s\*\s|\^2\b/.test(denseLite.text)) throw new Error('仍有斜線、星號或裸次方');
if (/note=(?:此步計算結果|相乘的代入數值|化學平衡計算中的代入值|題目給定數值)/.test(denseLite.text)) throw new Error('NOTE 含空泛的自動標籤');

const schemaDrift = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'首先配平反應式：MnO4^- + 5Fe2+ + 8H+ -> Mn2+ + 5Fe3+ + 4H2O。'},
  {type:'choice',label:'D',text:'酸足量即可，敘述錯誤。 (E) 濃度過高會增加讀值誤差，敘述錯誤。',verdict:'敘述錯誤'}
],answer:'A,B,C'}));
if (!schemaDrift.text.includes('\\ce{MnO4^- + 5Fe^2+ + 8H+ -> Mn^2+ + 5Fe^3+ + 4H2O}')) throw new Error('文字欄中的反應式未提升為專業化學式');
if (!schemaDrift.text.includes('（E）')) throw new Error('AI 寫出的選項標籤被本機移除');

const fineTune = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'甲溶液：0.428 g / 214 g mol^-1 = 0.002 mol；在實驗一中，總體積為 20 mL，[IO3^-] = 0.02 M * (4/20) = 0.004 M，[HSO3^-] = 0.004 M * (10/20) = 0.002 M。'},
  {type:'choice',label:'E',text:'速率 v1=k(0.004)^2；新條件 v2=k(0.001)^2；速率比 v1/v2=16；時間比 t2/t1=16，故 t2=800 s',verdict:'敘述正確'}
],answer:'E'}));
if (/\}\s*mol\s*\^\{-1\}/.test(fineTune.text) || !fineTune.text.includes('note=式量／分子量，用來把質量換成莫耳數')) throw new Error('複合單位未完整收進 NOTE');
if (!fineTune.text.includes('\\dfrac{v_{1}}{v_{2}}') || !fineTune.text.includes('\\dfrac{t_{2}}{t_{1}}') || /\^2\b/.test(fineTune.text)) throw new Error('速率比、時間比或次方未正規化');
if ((fineTune.text.match(/\n/g) || []).length < 7 || fineTune.text.includes('(E)')) throw new Error('選項標籤仍由本機補寫');
if (!Core.calculation('v_1/v_2=16；t_2/t_1=16').includes('\\dfrac{v_{1}}{v_{2}}')) throw new Error('模型輸出的底線變數比例未轉為分式');

const advancedDoc = Core.prepare(JSON.stringify({blocks:[
  {type:'heading',text:'已知與目標'},
  {type:'chemical_equation',expression:'MnO4^- + 5Fe2+ + 8H+ -> Mn2+ + 5Fe3+ + 4H2O'},
  {type:'reaction_table',species:['MnO4^-','Fe2+','Mn2+','Fe3+'],rows:[
    {label:'起始',values:['a','b','0','0']},
    {label:'變化',values:['-x','-5x','+x','+5x']},
    {label:'結果',values:['a-x','b-5x','x','5x']}
  ]}
],answer:'完成'}));
if (!advancedDoc.text.includes('【已知與目標】') || !advancedDoc.text.includes('\\begin{array}') || !advancedDoc.text.includes('\\ce{MnO4^-}')) throw new Error('進階標題或反應變化表未由本機編譯');
if (Object.keys(Core.SCHEMA.properties.blocks.items.properties).join(',') !== 'type,text') throw new Error('Gemini schema 未精簡為穩定的兩欄結構');
if (Core.SCHEMA.type !== 'object' || Core.SCHEMA.properties.blocks.type !== 'array') throw new Error('Gemini JSON schema 型別必須使用標準小寫');
const compactTable = Core.prepare(JSON.stringify({blocks:[{type:'reaction_table',text:'物種：A｜B｜C；起始：2｜5｜0；變化：-x｜-2x｜+x；結果：0｜1｜2'}],answer:'C = 2'}));
if (!compactTable.text.includes('\\begin{array}') || !compactTable.text.includes('2')) throw new Error('精簡反應表未由本機編譯');
const completedTable = Core.prepare(JSON.stringify({blocks:[
  {type:'chemical_equation',text:'MnO4^- + 5Fe2+ + 8H+ -> Mn2+ + 5Fe3+ + 4H2O'},
  {type:'reaction_table',text:'物種：MnO4^-｜Fe2+；起始：0.000168｜0.00084；變化：-0.000168｜-0.00084；結果：0｜0'}
],answer:'A'}));
if (!completedTable.text.includes('\\ce{Mn^2+}') || !completedTable.text.includes('\\ce{Fe^3+}') || !completedTable.text.includes('0.00084') || !completedTable.text.includes('\\rightarrow') || !completedTable.text.includes('\\text{＋}')) throw new Error('反應表未依反應式固定排列');

const solveSpecContext = { window: {} };
vm.runInNewContext(fs.readFileSync('js/solve-spec.js', 'utf8'), solveSpecContext);
const Spec = solveSpecContext.window.SolveSpec;
const normalRoute = Spec.route(Spec.create({}), '計算反應物的莫耳數與剩餘量', {});
if (normalRoute.id !== 'plain' || normalRoute.forceStoichiometry || Spec.buildActiveBlock(normalRoute)) throw new Error('未勾選時仍影響一般解題');
const manualRoute = Spec.route(Spec.create({ formatIds: ['calculation'] }), '求濃度', { forceCalcCompact: true });
const activeBlock = Spec.buildActiveBlock(manualRoute);
if (manualRoute.origin !== 'manual' || !activeBlock.includes('計算精簡') || !activeBlock.includes('計算題四步推導')) throw new Error('已勾選的進階功能未進入執行規格');

const app = fs.readFileSync('js/app.js', 'utf8');
const boardCss = fs.readFileSync('css/board.css', 'utf8');
const renderer = fs.readFileSync('js/render.js', 'utf8');
const startSolve = app.slice(app.indexOf('async function startSolve()'), app.indexOf('async function sendFollowUp'));
if ((startSolve.match(/callAPI\(/g) || []).length !== 1) throw new Error('主解題不是單次 Gemini 呼叫');
if (/ensureQualityReply|ensureVerifiedMainSolution|ensureChoiceCompletenessReply/.test(startSolve)) throw new Error('主解題仍連接舊的 AI 重寫流程');
if (/ensureDensityReply/.test(startSolve)) throw new Error('主解題不應再讓第二次 AI 重寫完整詳解');
if (/requestAnimationFrame\(\(\) => requestAnimationFrame/.test(app.slice(app.indexOf('function renderAiInto'), app.indexOf('function setMainSolution')))) throw new Error('詳解顯示仍依賴背景可能停用的動畫幀');
if (!/renderMarkdownSolution\(body\)/.test(app) || !/function renderMarkdownSolution/.test(renderer)) throw new Error('詳解未統一使用 Markdown 渲染');
if (!/grid-template-columns:\s*2rem minmax\(0, 1fr\)/.test(boardCss)) throw new Error('選項未使用固定標籤欄與懸掛縮排');
if (!/plain-line-inner--xscroll::after/.test(boardCss) || !/可左右滑動查看完整公式/.test(renderer)) throw new Error('長公式缺少橫向滑動提示');
if (!/measureLineOverflow/.test(renderer) || !/\.markdown-choice-body/.test(renderer)) throw new Error('Markdown 長列未依實際寬度判定橫滑');
if (!/lineScrollResizeBound/.test(renderer)) throw new Error('視窗尺寸改變後不會更新公式橫滑');
if (!/responseFormat:\s*\{\s*text:\s*\{\s*mimeType:\s*'APPLICATION_JSON',\s*schema:\s*window\.SolutionCore\.SCHEMA/.test(startSolve)) throw new Error('Gemini 呼叫未使用官方結構化輸出格式');
if (!/buildSystem\(\)/.test(startSolve)) throw new Error('主解題未使用唯一 system prompt');
if (!/if \(advancedBlock\) renderSolveValidation/.test(startSolve)) throw new Error('進階設定完成後未執行本機驗證');
if (!/initSolveOptionToggles\(\);\s*updateSolveSpecStatus\(\);/.test(app)) throw new Error('重開頁面後進階狀態未同步');

const acidResult = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'設 H2A 初始濃度 C=0.24，解離後 [H2A]=0.02。'},
  {type:'calculation',expression:'Ka1=[H+][HA-]/[H2A]'},
  {type:'calculation',expression:'Ka2=[H+][A2-]/[HA-]=10^-4*(1/10)=10^-5'},
  {type:'calculation',expression:'pKa2=-log(10^-5)=5.0'}
],answer:'A,C,D'}));
if (!acidResult.text.includes('K_{a1}=\\dfrac{[\\ce{H+}][\\mathrm{HA}^{-}]}{[\\mathrm{H_{2}A}]}')) throw new Error('Ka1 未轉成正確直式分式');
if (!acidResult.text.includes('K_{a2}=\\dfrac{[\\ce{H+}][\\mathrm{A}^{2-}]}{[\\mathrm{HA}^{-}]}')) throw new Error('Ka2 未轉成正確直式分式');
if (!acidResult.text.includes('pK_{a2}=-\\log(')) throw new Error('pKa2 或 log 未正規化');
if (/K_\{a\\htmlData|\\mathrm\{(?:H_\{\\htmlData|A)\}\^\{\\htmlData/.test(acidResult.text)) throw new Error('平衡常數或抽象酸物種下標被 NOTE 標記');
const acidNarrative = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'其餘物種濃度和為 [HA-]+[A2-]=0.22，且 [HA-]/[A2-]=10。'},
  {type:'choice',label:'A',text:'pK1=3.0',verdict:'敘述正確'},
  {type:'choice',label:'E',text:'稀釋後 pH 維持 4.0，[H+] 與物種比不變',verdict:'敘述錯誤'}
],answer:'A'})).text;
if (/\[\$|\]\s*\/\s*\$/.test(acidNarrative) || !acidNarrative.includes('\\dfrac{[\\mathrm{HA}^{-}]}{[\\mathrm{A}^{2-}]}')) throw new Error('段落中的抽象酸物種比未完整編譯');
if (!acidNarrative.includes('$pK_{a1}=')) throw new Error('pK1 未正規化為 pKa1 下標');
if (!acidNarrative.includes('$[\\ce{H+}]$')) throw new Error('敘述中的濃度物種括號被拆開');

console.log('SOLUTION_CORE_STAGE4_OK');
