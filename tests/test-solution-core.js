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
const strayHeading = Core.prepare(JSON.stringify({ blocks: [
  { type: 'heading', text: '19. 葉妍探究秒錶反應' },
  { type: 'heading', text: '題意' },
  { type: 'paragraph', text: '判斷反應級數。' }
] }));
if (strayHeading.text.includes('葉妍探究秒錶反應') || !strayHeading.text.includes('【題意】')) {
  throw new Error('題意前不應輸出題名或類別標題');
}
if (!Core.SYSTEM.includes('逐項依據前述結果判定') || !Core.SYSTEM.includes('不得漏掉或增加選項')) throw new Error('選項規格未整合至唯一提示詞');
if (!Core.SYSTEM.includes('calculation 才使用 \\dfrac') || Core.SYSTEM.includes('\\htmlData{note=')) throw new Error('提示詞應要求 dfrac 且不得要求 NOTE');
if (!Core.SYSTEM.includes('【詳解架構｜必須遵守】') || !Core.SYSTEM.includes('題意：') || !Core.SYSTEM.includes('依據與推導：') || !Core.SYSTEM.includes('結果：') || !Core.SYSTEM.includes('選項分析：')) throw new Error('提示詞缺少選擇題骨架');
if (!Core.SYSTEM.includes('依據與推導：只寫導出本題結果所必需') || !Core.SYSTEM.includes('優先 2～3 個圓點') || !Core.SYSTEM.includes('paragraph 必須以「• 」起首') || !Core.SYSTEM.includes('算式一式一行')) {
  throw new Error('提示詞缺少精簡的圓點推導分工');
}
if (!Core.SYSTEM.includes('一步一式') || !Core.SYSTEM.includes('禁止任何逗號')) throw new Error('提示詞缺少分段／逗號規則');
if (!Core.SYSTEM.includes('化學量與濃度符號｜唯一規範') || !Core.SYSTEM.includes('質量寫 W(物質)') || !Core.SYSTEM.includes('體積寫 V(對象)')) {
  throw new Error('唯一化學計算符號規範未進入主提示');
}
if (!Core.SYSTEM.includes('溶液濃度一律寫 [物種]') || !Core.SYSTEM.includes('n(X)＝[X] × V') || !Core.SYSTEM.includes('比例關係可寫 A：B')) {
  throw new Error('濃度、乘號或比例例外規範未進入主提示');
}
const quantityNotation = Core.calculation('n(CO2)=n(O)=0.0800 mol；m(O)=W(樣品)；V(甲溶液)=20.0 mL');
for (const expected of ['n_{\\ce{CO2}}', 'n_{\\ce{O}}', 'W_{\\ce{O}}', 'W_{\\text{樣品}}', 'V_{\\text{甲溶液}}']) {
  if (!quantityNotation.includes(expected)) throw new Error(`化學計算符號未統一：${quantityNotation}`);
}
const proseQuantityNotation = Core.formatText('已知樣品總質量 W（樣品）＝5.20 g，並量得 n(CO2)。');
if (!proseQuantityNotation.includes('$W_{\\text{樣品}}$') || !proseQuantityNotation.includes('$n_{\\ce{CO2}}$')) {
  throw new Error(`一般敘述的化學計算符號未轉為下標：${proseQuantityNotation}`);
}
const concentrationNotation = Core.calculation('C(IO3-)=n(IO3-)/V(甲溶液)；c_{HSO3-}=0.0040 M');
if (!concentrationNotation.includes('[\\ce{IO3-}]') || !concentrationNotation.includes('[\\ce{HSO3-}]') || !concentrationNotation.includes('\\dfrac{n_{\\ce{IO3-}}}{V_{\\text{甲溶液}}}')) {
  throw new Error(`濃度未由本機統一為中括弧與直式分式：${concentrationNotation}`);
}
if (!result.text.includes('\\ce{MnO4^- + 5Fe^2+ + 8H+ -> Mn^2+ + 5Fe^3+ + 4H2O}')) throw new Error('反應式未由本機編譯');
if (result.text.includes('(F)')) throw new Error('本機不應自行補寫選項標籤');
if (/\\htmlData|htmlDatanot/i.test(result.text)) throw new Error('詳解不應殘留 htmlData／NOTE');
if (Core.formatText('針對第 22 題選項分析如下').includes('htmlData')) throw new Error('題號不應套用 NOTE');

const strippedLegacy = Core.prepare(JSON.stringify({
  blocks: [{
    type: 'calculation',
    text: String.raw`[\ce{IO3^-}]=\dfrac{\htmlData{note=碘酸鉀質量（g）}{0.428}}{\htmlData{note=碘酸鉀式量}{214}}\times\dfrac{1}{100\times\htmlData{note=mL 轉 L}{10^{-3}}}=0.02M`
  }],
  answer: '0.02 M'
}));
if (!strippedLegacy.ok) throw new Error('舊版 htmlData 詳解解析失敗');
if (/\\htmlData|htmlDatanot/i.test(strippedLegacy.text)) throw new Error('舊版 htmlData 未被剝除');
if (!strippedLegacy.text.includes('0.428') || !strippedLegacy.text.includes('214') || !strippedLegacy.text.includes('10^{-3}')) throw new Error('剝除 htmlData 後數值遺失');
if (!/\\dfrac/.test(strippedLegacy.text)) throw new Error('剝除後應保留分式');

const structureText = Core.prepare(JSON.stringify({ blocks: [{
  type: 'paragraph',
  text: String.raw`CO3^2-：平面三角形，C 為 sp2 混成，鍵角約 120°；$\ce{\ce{CO3^2-}$ 的 π 鍵數為 1。`
}], answer: 'B' })).text;
if (/\\ce\{\\ce/.test(structureText) || /\\htmlData/.test(structureText)) throw new Error('結構敘述不應產生巢狀化學式或 NOTE');
if (!structureText.includes('\\ce{CO3^2-}')) throw new Error('結構題化學式未統一為 mhchem');
// 單位可保留在算式中（改由 render 顯示）；重點是橫式已轉直式
if (!/\\dfrac/.test(result.text)) throw new Error('計算式應含直式分式');
if (/=\$/.test(result.text)) throw new Error('未移除無右值的尾端等號');
if (!/係數比為 .*：.*\./.test(result.text) || result.text.includes('係數比為 1:5.')) throw new Error('文字標點未統一全形');

const derivationLayout = Core.prepare(JSON.stringify({ blocks: [
  { type: 'heading', text: '題意' },
  { type: 'paragraph', text: '求樣品的質量。' },
  { type: 'heading', text: '依據與推導' },
  { type: 'paragraph', text: '• 由樣品莫耳數與式量求質量。' },
  { type: 'calculation', text: 'W(樣品)=n(樣品)×80 g mol^-1=16 g' },
  { type: 'calculation', text: String.raw`Q(每分鐘)=16 g×0.4 cal g^-1 \textdegreeC^-1×\dfrac{10 \textdegreeC}{2 min}=32 cal min^-1` },
  { type: 'paragraph', text: '• 再以熔化過程的吸熱量求熔化熱。' },
  { type: 'calculation', text: String.raw`\Delta H(熔化)=\dfrac{Q(熔化)}{n(樣品)}` },
  { type: 'heading', text: '結果' },
  { type: 'paragraph', text: '已求得所需物理量。' }
], answer: '完成' }));
if (!derivationLayout.ok || (derivationLayout.text.match(/@@DERIVATION@@/g) || []).length !== 2) {
  throw new Error(`推導圓點段落未依 JSON 區塊建立：${derivationLayout.text}`);
}
if (!derivationLayout.text.includes('^{\\circ}\\mathrm{C}') || /\\textdegree/.test(derivationLayout.text)) {
  throw new Error(`常見公式指令未在編譯前清理：${derivationLayout.text}`);
}
if (!result.text.endsWith('@@ANSWER@@A、B、C、F')) throw new Error('答案標點未統一');

const bareCalculation = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', expression: String.raw`x=\dfrac{0.016\times10.5\times5}{10.0}=0.084` }],
  answer: '0.084 M'
}));
if (/\\htmlData\{/.test(bareCalculation.text)) throw new Error('裸數字算式不應自動補 NOTE');

// 中途 $ 與兩步黏行：應剝離 $ 並拆成多行
const sticky = Core.prepare(JSON.stringify({
  blocks: [{
    type: 'calculation',
    expression: String.raw`$K_{b}=\dfrac{K_{w}}{K_{a}}\approx 5.56 \times 10^{-10} $[\ce{OH-}]=\sqrt{5.56\times10^{-10}\times0.05}$`
  }],
  answer: 'x'
}));
if (!sticky.ok) throw new Error('黏行算式解析失敗');
const stickyMath = sticky.text.split('\n').filter((l) => l.startsWith('$'));
if (stickyMath.length < 2) throw new Error('兩步黏行應拆成多個數學行');
if (!sticky.text.includes('\\dfrac') || stickyMath.some((l) => l.includes('$', 1) && /\$[^$]+\$.+\$/.test(l))) {
  throw new Error('黏行分式或中途 $ 異常');
}
if (!/K_\{b\}/.test(sticky.text) || !/\\ce\{OH-\}/.test(sticky.text)) {
  throw new Error('黏行內容遺失');
}

// 橫式 A/B 強制直式
const slash = Core.calculation('3/4=0.75');
if (!slash.includes('\\dfrac{3}{4}') || /\b3\/4\b/.test(slash)) throw new Error('橫式除法未轉直式');
const chemistryCases = ['SO4 2-', 'SO4^2-', 'SO₄²⁻', 'CuSO4', 'NH4+', 'Fe3+', 'CO3 2-', 'Al2(SO4)3'];
for (const formula of chemistryCases) {
  const rendered = Core.prepare(JSON.stringify({
    blocks: [{ type: 'calculation', expression: formula }], answer: 'x'
  })).text;
  if (/\\htmlData\{/.test(rendered)) throw new Error(`化學式被誤加 NOTE：${formula}`);
}

const malformedJson = String.raw`{"blocks":[{"type":"calculation","expression":"x=\dfrac{0.016\times10.5}{10.0}=0.0168"}],"answer":"0.0168 M"}`;
if (!Core.prepare(malformedJson).ok) throw new Error('Gemini Lite 未跳脫 LaTeX 的 JSON 未被修復');
const validButWrongEscape = String.raw`{"blocks":[{"type":"calculation","expression":"x=\frac{5\times0.016}{10.0}=0.008"}],"answer":"0.008 M"}`;
const repairedEscape = Core.prepare(validButWrongEscape);
if (!repairedEscape.ok || !repairedEscape.text.includes('\\dfrac') || !repairedEscape.text.includes('\\times')) throw new Error('合法但錯誤的 JSON 跳脫未被修復');

const repeatedVerdict = Core.prepare(JSON.stringify({blocks:[{type:'choice',label:'A',text:'理由，敘述正確',verdict:'敘述正確'}],answer:'A'}));
if ((repeatedVerdict.text.match(/敘述正確/g) || []).length !== 1) throw new Error('選項結論重複');

const liteShape = Core.prepare(JSON.stringify({
  blocks: [
    { type: 'paragraph', text: '說明' },
    { type: 'choice', text: '（A）理由，敘述正確' }
  ],
  answer: 'A'
}));
if (!liteShape.ok || !liteShape.text.includes('理由，敘述正確') || liteShape.text.includes('(A)')) throw new Error('選項標籤仍由本機推測');

const denseLite = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'首先計算甲溶液中 IO3^- 的濃度。甲溶液：0.428 g / 214 g mol^-1 = 0.002 mol，溶於 100 mL，濃度為 0.02 M。實驗一：[IO3^-] = 0.02 M * (4/20) = 0.004 M，[HSO3^-] = 0.004 M * (10/20) = 0.002 M。符合 1.25^2 = 1.5625，故反應為二級。'},
  {type:'choice',label:'E',text:'混合後 [IO3^-] = 0.02 M * (1/20) = 0.001 M，[HSO3^-] = 0.004 M * (15/20) = 0.003 M。速率比為 (0.001/0.004)^2 = 1/16，時間為 50 s * 16 = 800 s',verdict:'敘述正確'}
],answer:'E'}));
if (!denseLite.ok || denseLite.text.split('\n').length < 7) throw new Error('密集段落未依語意拆行');
if ((denseLite.text.match(/\\dfrac/g) || []).length < 5) { console.log(denseLite.text); throw new Error('斜線比例未轉為完整分式'); }
if (/\s\/\s|\s\*\s|\^2\b/.test(denseLite.text)) throw new Error('仍有斜線、星號或裸次方');
if (/\\htmlData|htmlDatanot/i.test(denseLite.text)) throw new Error('密集段落不應殘留 htmlData');

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
if (/\\htmlData|htmlDatanot/i.test(fineTune.text)) throw new Error('微調段落不應殘留 htmlData');
if (!fineTune.text.includes('\\dfrac{v_{1}}{v_{2}}') || !fineTune.text.includes('\\dfrac{t_{2}}{t_{1}}') || /\^2\b/.test(fineTune.text)) throw new Error('速率比、時間比或次方未正規化');
if ((fineTune.text.match(/\n/g) || []).length < 7 || fineTune.text.includes('(E)')) throw new Error('選項標籤仍由本機補寫');
if (!Core.calculation('v_1/v_2=16；t_2/t_1=16').includes('\\dfrac{v_{1}}{v_{2}}')) throw new Error('模型輸出的底線變數比例未轉為分式');

const stickyEquations = Core.prepare(JSON.stringify({
  blocks: [{
    type: 'chemical_equation',
    text: 'Fe_xO_y + yCO -> xFe + yCO2 CO2 + Ca(OH)2 -> CaCO3 + H2O'
  }],
  answer: 'Fe7O8'
}));
const stickyLines = stickyEquations.text.split('\n').filter((line) => line.includes('\\ce{'));
if (stickyLines.length < 2) throw new Error('黏在一起的兩條反應式未拆成獨立行');
if (!stickyLines[0].includes('Fe_xO_y') || !stickyLines[1].includes('Ca(OH)2')) throw new Error('反應式拆行內容不正確');
if (/yCO2CO2|yCO2\s*CO2/.test(stickyEquations.text.replace(/\n/g, ''))) {
  /* 拆行後允許各自含 CO2，但不應再黏成同一 \\ce */
}
if (stickyEquations.text.split('\n').some((line) => /->.*->/.test(line))) throw new Error('同一行仍含兩條反應箭號');

const stickyCalcs = Core.prepare(JSON.stringify({
  blocks: [{
    type: 'calculation',
    text: 'm(O)=0.08*16=1.28 m(Fe)=5.20-1.28=3.92 n_{Fe}=3.92/56=0.07'
  }],
  answer: '7:8'
}));
const calcLines = stickyCalcs.text.split('\n').filter((line) => line.startsWith('$') && line.includes('='));
if (calcLines.length < 3) throw new Error('無標點的連續賦值算式未拆成獨立行');

const moleRow = Core.prepare(JSON.stringify({
  blocks: [{
    type: 'calculation',
    text: 'n_{CaCO3}=8.00/100=0.08 n_O=n_{CO2}=n_{CaCO3}=0.08 m(O)=0.08*16.00=1.28 m(Fe)=5.20-1.28=3.92 n_{Fe}=3.92/55.85≈0.07'
  }],
  answer: '7:8'
}));
const moleLines = moleRow.text.split('\n').filter((line) => line.startsWith('$') && /[=≈]/.test(line));
if (moleLines.length < 4) throw new Error(`莫耳數連續算式未拆行：${moleRow.text}`);
if (moleLines.some((line) => (line.match(/(?:m|n)_?\(/g) || []).length + (line.match(/n_[A-Za-z{]/g) || []).length > 2 && /m\(O\).*m\(Fe\)/.test(line))) {
  throw new Error('莫耳數算式同行仍擠在一起');
}
if (!Core.SYSTEM.includes('【排版與算式｜必須遵守】') || !Core.SYSTEM.includes('一步一式')) throw new Error('提示詞缺少強制算式分行規則');
if (!Core.SYSTEM.includes('直式分式') || !Core.SYSTEM.includes('\\dfrac')) throw new Error('提示詞缺少全除式直式化規則');
if (Core.SYSTEM.includes('\\htmlData{note=') || typeof Core.auditNotes === 'function') throw new Error('NOTE／auditNotes 應已移除');

for (const source of ['3/4=0.75', '3÷4=0.75', String.raw`3\div4=0.75`]) {
  const rendered = Core.prepare(JSON.stringify({
    blocks: [{ type: 'calculation', text: source }],
    answer: '0.75'
  })).text;
  if (!rendered.includes('\\dfrac{3}{4}')) throw new Error(`除式未轉為直式分式：${source} → ${rendered}`);
  const withoutFractions = rendered.replace(/\\dfrac\{[^{}]*\}\{[^{}]*\}/g, '');
  if (/\d\s*\/\s*\d|÷|\\div/.test(withoutFractions)) throw new Error(`詳解仍殘留橫式除法：${rendered}`);
}

const proseDivisions = Core.prepare(JSON.stringify({
  blocks: [{ type: 'paragraph', text: String.raw`比例為 3/4，也就是 3÷4，等同 3\div4。` }],
  answer: '3/4'
})).text;
if ((proseDivisions.match(/\\dfrac\{3\}\{4\}/g) || []).length !== 3) {
  throw new Error(`段落中的除式未全部直式化：${proseDivisions}`);
}

const abutCalcs = Core.prepare(JSON.stringify({
  blocks: [{ type: 'paragraph', text: '則鐵的質量為5.20-1.28=3.92g 3.92/56.0=0.07 mol，鐵與氧莫耳數比為0.07:0.08=7:8' }],
  answer: 'A'
}));
const abutLines = abutCalcs.text.split('\n').filter((line) => line.startsWith('$') && /[=≈]/.test(line));
if (abutLines.length < 2) throw new Error(`相鄰算式未拆行：${abutCalcs.text}`);
if (abutLines.some((line) => (line.match(/=/g) || []).length > 1 && /5\.20.*3\.92\/56/.test(line.replace(/\\dfrac\{3\.92\}\{56\.0\}/, '3.92/56')))) {
  throw new Error('相鄰算式仍黏在同一數學島');
}
if (/\$5\.2\$|\$0-1\.28|\\dfrac\{0\}\{100\}|\\dfrac\{2\}\{56/.test(abutCalcs.text)) {
  throw new Error('小數被誤拆');
}
const abutBare = abutCalcs.text
  .replace(/\\dfrac\{[^{}]*\}\{[^{}]*\}/g, '');
if (/\d\s*\/\s*\d/.test(abutBare)) throw new Error('詳解仍含斜線分式 A/B');
if (!abutCalcs.text.includes('\\dfrac{3.92}{56.0}') || !abutCalcs.text.includes('5.20-1.28')) {
  throw new Error('相鄰算式直式分式或減法鏈未正確編譯');
}

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
for (const field of ['type', 'text']) {
  if (!Object.hasOwn(Core.SCHEMA.properties.blocks.items.properties, field)) throw new Error(`Gemini schema 缺少 ${field} 結構欄位`);
}
if (Object.keys(Core.SCHEMA.properties.blocks.items.properties).length !== 2) throw new Error('Gemini schema 不應再帶入多層排版欄位');
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
const manualRoute = Spec.route(Spec.create({}), '求濃度', { forceCalcCompact: true });
const activeBlock = Spec.buildActiveBlock(manualRoute);
if (manualRoute.origin !== 'manual' || !activeBlock.includes('計算精簡') || Object.keys(Spec.FORMATS).length !== 0) throw new Error('計算精簡或取消作答格式失敗');
const acidRoute = Spec.route(Spec.create({ chapterIds: ['acidbase'] }), '', {});
const acidBlock = Spec.buildActiveBlock(acidRoute);
if (!acidBlock.includes('先判斷強弱酸鹼與主要物種') || !acidBlock.includes('本題章節提醒')) throw new Error('酸鹼章節未注入解題提醒');

const app = fs.readFileSync('js/app.js', 'utf8');
const prompts = fs.readFileSync('js/prompts.js', 'utf8');
const boardCss = fs.readFileSync('css/board.css', 'utf8');
const renderer = fs.readFileSync('js/render.js', 'utf8');
const startSolve = app.slice(app.indexOf('async function startSolve()'), app.indexOf('async function sendFollowUp'));
if ((startSolve.match(/callAPI\(/g) || []).length !== 4 || (app.match(/callAPI\(/g) || []).length < 6) throw new Error('主解題、驗證、修正與答案對齊的呼叫數不正確');
if (!/isStandaloneFormulaLine/.test(renderer)) throw new Error('Markdown 未避免合併獨立公式行');
const renderContext = { window: { SolutionCore: Core }, marked: { parse: (md) => md }, DOMPurify: { sanitize: (html) => html } };
vm.runInNewContext(`${renderer}\nthis.compiledSolutionToMarkdown = compiledSolutionToMarkdown;\nthis.buildAnswerHtml = buildAnswerHtml;\nthis.normalizeScientificTokens = normalizeScientificTokens;`, renderContext);
const renderedConcentration = renderContext.normalizeScientificTokens('甲液 C（IO3-）＝0.020 M；乙液 c(HSO3-)=0.0040 M。');
if (!renderedConcentration.includes('$[\\ce{IO_3-}]$') || !renderedConcentration.includes('$[\\ce{HSO_3-}]$')) {
  throw new Error(`顯示端未將 C(物種) 統一為中括弧：${renderedConcentration}`);
}
const renderedConcentrationMath = renderContext.normalizeScientificTokens('$c(HSO3-)=n(HSO3-)/V(乙溶液)$');
if (!renderedConcentrationMath.includes('$[\\ce{HSO3-}]=\\dfrac{n_{\\ce{HSO_3-}}}{V_{\\text{乙溶液}}}$')) {
  throw new Error(`追問數學式未統一濃度或化學量符號：${renderedConcentrationMath}`);
}
const renderedDerivation = renderContext.compiledSolutionToMarkdown(derivationLayout.text);
if ((renderedDerivation.markdown.match(/markdown-derivation-group/g) || []).length !== 2
  || (renderedDerivation.markdown.match(/markdown-derivation-bullet/g) || []).length !== 2
  || (renderedDerivation.markdown.match(/markdown-derivation-formula/g) || []).length < 3) {
  throw new Error(`推導圓點、段內算式或縮排群組未正確建立：${renderedDerivation.markdown}`);
}
if (renderedDerivation.markdown.includes('@@DERIVATION@@') || /markdown-derivation-group[\s\S]*【結果】/.test(renderedDerivation.markdown)) {
  throw new Error('推導群組標記外洩或影響結果區');
}
const mergedInput = [
  '更直接地，由碳原子守恆可知。',
  '$\\ce{Fe_xO_y + y CO -> x Fe + y CO2}$',
  '$\\ce{CO2 + Ca(OH)2 -> CaCO3 + H2O}$',
  '$n_{CaCO3}=8.00/100=0.08$',
  '由反應式可知氧原子莫耳數相等。',
  '@@ANSWER@@Fe7O8'
].join('\n');
const merged = renderContext.compiledSolutionToMarkdown(mergedInput);
const mergedBlocks = merged.markdown.split(/\n\n+/);
if (mergedBlocks.length < 4) throw new Error(`公式行未各自成為獨立段落：${merged.markdown}`);
if (!mergedBlocks.some((block) => block.includes('\\ce{Fe_xO_y')) || !mergedBlocks.some((block) => block.includes('\\ce{CO2'))) {
  throw new Error('Markdown 合併後反應式遺失');
}
if (mergedBlocks.some((block) => /\\ce\{Fe_xO_y[\s\S]*\\ce\{CO2/.test(block))) {
  throw new Error('獨立反應式行仍被 Markdown 併成同一段');
}
if (!merged.markdown.includes('$n_{CaCO3}=8.00/100=0.08$')) throw new Error('計算式行被誤併入答案區');
const answerHtml = renderContext.buildAnswerHtml('A、B、E', { singleQuestion: true });
if (!answerHtml.includes('answer-box-inline') || !answerHtml.includes('答：') || !answerHtml.includes('(A)、(B)、(E)')) {
  throw new Error('答案盒未改為橫排答：格式');
}
if (!/ANSWER_VERIFICATION_SYSTEM/.test(app) || !/buildAnswerVerificationUserText/.test(startSolve) || !/verificationModelFor\(cfg\.model\)/.test(startSolve)) throw new Error('參考答案未交給另一個 Flash 獨立驗證');
if (!/parsed\?\.consistent === true/.test(app)) throw new Error('獨立驗證缺少明確 true 時仍可能誤放行');
if (/enum:\s*\[answer\]/.test(app) || !/JSON\.parse\(JSON\.stringify\(window\.SolutionCore\.SCHEMA\)\)/.test(app)) throw new Error('參考答案仍被寫入輸出 schema 強制鎖定');
if (/ensureQualityReply|ensureVerifiedMainSolution|ensureChoiceCompletenessReply/.test(startSolve)) throw new Error('主解題仍連接舊的 AI 重寫流程');
if (/ensureDensityReply|addNumericNotes|NotePass|auditNotes|autoNote|補寫 NOTE/.test(startSolve) || /addNumericNotes|NotePass|auditNotes|autoNote/.test(app)) throw new Error('主解題不應再有 NOTE／補寫流程');
if (/NotePass/.test(prompts)) throw new Error('prompts 仍殘留第二階段 NotePass');
if (!/auditCrowdedCalculations\(prepared\.document\)/.test(startSolve)) throw new Error('擠行稽核未接入顯示前流程');
if (/requestAnimationFrame\(\(\) => requestAnimationFrame/.test(app.slice(app.indexOf('function renderAiInto'), app.indexOf('function setMainSolution')))) throw new Error('詳解顯示仍依賴背景可能停用的動畫幀');
if (!/renderMarkdownSolution\(body\)/.test(app) || !/function renderMarkdownSolution/.test(renderer)) throw new Error('詳解未統一使用 Markdown 渲染');
if (!/grid-template-columns:\s*max-content minmax\(0, 1fr\)/.test(boardCss)) throw new Error('選項未使用固定標籤欄與懸掛縮排');
if (/plain-line-inner--xscroll::after/.test(boardCss) || /content:\s*["']↔/.test(boardCss)) throw new Error('橫向滑動箭頭仍存在');
if (!/function isFormulaDominantLine/.test(renderer)) throw new Error('未區分自然換行文字與純長公式');
if (!/measureLineOverflow/.test(renderer) || !/\.markdown-choice-body/.test(renderer)) throw new Error('Markdown 長列未依實際寬度判定橫滑');
if (!/lineScrollResizeBound/.test(renderer)) throw new Error('視窗尺寸改變後不會更新公式橫滑');
if (!/schema:\s*responseSchema/.test(startSolve) || !/buildSolveResponseSchema/.test(app)) throw new Error('Gemini 呼叫未使用結構化輸出 schema');
if (!/buildSystem\(\)/.test(startSolve)) throw new Error('主解題未使用唯一 system prompt');
if (!/renderSolveValidation\(reply, solveOpts, solveOpts\.refAnswer\)/.test(startSolve)) throw new Error('完成後未執行本機驗證');
if (!/window\.answersMatch\(reply, solveOpts\.refAnswer\)/.test(startSolve) || !/對齊參考答案中/.test(startSolve)) throw new Error('參考答案不一致時未嘗試對齊');
if (/結果已拒絕顯示/.test(app)) throw new Error('參考答案不符仍顯示拒絕文案');
if (!/不阻擋顯示|已顯示詳解，請人工核對/.test(app)) throw new Error('驗證／答案軟警告文案未接入');
if (!/parseFailed/.test(app) || !/verificationResult\?\.parseFailed/.test(startSolve)) throw new Error('驗證解析失敗未改為警告顯示');
if (/本機算式一致性檢查/.test(startSolve) || /重新計算與核對中/.test(startSolve)) throw new Error('算式檢查仍硬擋或自動重算');
if (!/auditCalculationDocument\(prepared\.document\)/.test(startSolve) || !/不自動重打、不擋顯示/.test(startSolve)) throw new Error('本機算式驗算未改為軟提醒');
if (!/SolutionCore\.prepare\(reply\)/.test(startSolve)) throw new Error('主解題未直接 prepare');
if (!/setMainSolution\(reply\)/.test(startSolve) || /addNumericNotes/.test(startSolve)) throw new Error('詳解顯示前仍呼叫第二階段 NOTE');
if (!/本機算式提醒/.test(app) || !/可填指定答案再解一次/.test(app)) throw new Error('算式軟提醒文案未接入');
if (!/initSolveOptionToggles\(\);\s*updateSolveSpecStatus\(\);/.test(app)) throw new Error('重開頁面後進階狀態未同步');

const promptContext = { window: {} };
vm.runInNewContext(prompts, promptContext);
const mainPrompt = promptContext.window.buildSolveUserText('題目文字', 'A', { questionBody: '題目文字' });
if (mainPrompt.includes('A') || mainPrompt.includes('參考答案')) throw new Error('主解題提示詞仍收到參考答案');
const verificationPrompt = promptContext.window.buildAnswerVerificationUserText('題目文字', 'A');
if (!verificationPrompt.includes('待驗證參考答案') || !verificationPrompt.includes('不預設參考答案正確')) throw new Error('獨立驗證提示詞未把參考答案視為待驗證命題');
if (promptContext.window.NotePass) throw new Error('仍暴露第二階段 NotePass');

const auditContext = {
  window: {},
  math: { evaluate: expression => Function(`return (${expression.replace(/\^/g, '**')})`)() }
};
const auditSource = app.slice(app.indexOf('function normalizeNumericExpression'), app.indexOf('function getSolveSpec'));
vm.runInNewContext(auditSource, auditContext);
const goodAudit = auditContext.window.auditCalculationDocument({ blocks: [{ type: 'calculation', text: 'n=0.016*0.0105=0.000168' }] });
const badAudit = auditContext.window.auditCalculationDocument({ blocks: [{ type: 'calculation', text: 'x=2*3=7' }] });
const multiEqAudit = auditContext.window.auditCalculationDocument({
  blocks: [{
    type: 'choice',
    text: '[IO3]=0.02*(1/20)=0.001，[HSO3]=0.004*(15/20)=0.003。速率比=(0.001/0.004)^2=1/16，時間=50*16=800'
  }]
});
if (goodAudit.checked !== 1 || goodAudit.issues.length) throw new Error('正確算式未通過本機等號檢查');
if (badAudit.issues.length !== 1) throw new Error('錯誤算式未被本機等號檢查攔截');
if (multiEqAudit.issues.length) throw new Error('選擇題多條獨立算式被誤判為等號不一致');

const acidResult = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'設 H2A 初始濃度 C=0.24，解離後 [H2A]=0.02。'},
  {type:'calculation',expression:'Ka1=[H+][HA-]/[H2A]'},
  {type:'calculation',expression:'Ka2=[H+][A2-]/[HA-]=10^-4*(1/10)=10^-5'},
  {type:'calculation',expression:'pKa2=-log(10^-5)=5.0'}
],answer:'A,C,D'}));
if (!acidResult.text.includes('K_{a1}=\\dfrac{[\\ce{H+}][\\mathrm{HA}^{-}]}{[\\mathrm{H_{2}A}]}')) throw new Error('Ka1 未轉成正確直式分式');
if (!acidResult.text.includes('K_{a2}=\\dfrac{[\\ce{H+}][\\mathrm{A}^{2-}]}{[\\mathrm{HA}^{-}]}')) throw new Error('Ka2 未轉成正確直式分式');
if (!acidResult.text.includes('pK_{a2}=-\\log(')) throw new Error('pKa2 或 log 未正規化');
if (/\\htmlData/.test(acidResult.text)) throw new Error('酸鹼算式不應殘留 htmlData');
const acidNarrative = Core.prepare(JSON.stringify({blocks:[
  {type:'paragraph',text:'其餘物種濃度和為 [HA-]+[A2-]=0.22，且 [HA-]/[A2-]=10。'},
  {type:'choice',label:'A',text:'pK1=3.0',verdict:'敘述正確'},
  {type:'choice',label:'E',text:'稀釋後 pH 維持 4.0，[H+] 與物種比不變',verdict:'敘述錯誤'}
],answer:'A'})).text;
if (/\[\$|\]\s*\/\s*\$/.test(acidNarrative) || !acidNarrative.includes('\\dfrac{[\\mathrm{HA}^{-}]}{[\\mathrm{A}^{2-}]}')) throw new Error('段落中的抽象酸物種比未完整編譯');
if (!acidNarrative.includes('$pK_{a1}=')) throw new Error('pK1 未正規化為 pKa1 下標');
if (!acidNarrative.includes('$[\\ce{H+}]$')) throw new Error('敘述中的濃度物種括號被拆開');

const arbitraryLabels = Core.prepare(JSON.stringify({blocks:[
  {type:'heading',text:'選項分析'},
  {type:'choice',text:'（甲）此敘述符合守恆關係，正確。'},
  {type:'choice',text:'（J）此值少乘了稀釋倍數，錯誤。'},
  {type:'choice',text:'（⑥）計算結果與題目條件一致，正確。'}
],answer:'甲、⑥'}));
for (const label of ['甲', 'J', '⑥']) {
  if (!arbitraryLabels.text.includes(`@@CHOICE[${label}]@@`)) throw new Error(`任意選項標籤遺失：${label}`);
}
if (/\(甲\)|\(J\)|\(⑥\)/.test(arbitraryLabels.text)) throw new Error('編譯器仍把選項標籤混進選項文字');
if (/A\s*[～~\-–—]\s*E/.test(Core.SYSTEM)) throw new Error('唯一提示詞仍限制選項標籤範圍');

if (Object.keys(Spec.FORMATS).length !== 0) throw new Error('已取消的作答格式仍保留');

const crowdAudit = Core.auditCrowdedCalculations({
  blocks: [{ type: 'calculation', text: 'm(O)=0.08*16=1.28 m(Fe)=5.20-1.28=3.92' }]
});
if (!crowdAudit.issues.length) throw new Error('擠行 calculation 未被稽核');

const moleLabeled = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', text: 'n_{Fe}=0.07 mol' }],
  answer: '0.07'
}));
if (/\\htmlData|note=/.test(moleLabeled.text)) throw new Error('單位算式不應產出 NOTE');

const unitPacked = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', text: '1.6/32=0.05 mol0.05*2=0.1 mol' }],
  answer: '0.1'
}));
const packedLines = unitPacked.text.split('\n').filter((line) => line.startsWith('$') && /[=≈]/.test(line));
if (packedLines.length < 2) throw new Error(`單位後緊貼算式未拆行：${unitPacked.text}`);

const incompleteNote = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', text: String.raw`\dfrac{\htmlData{note=碘酸鉀質量(g)}}{214}=0.002` }],
  answer: '0.002'
}));
if (/\\htmlData/.test(incompleteNote.text)) {
  throw new Error(`缺數值群的 htmlData 仍殘留：${incompleteNote.text}`);
}
// 缺 body 的舊 NOTE 剝除後可能留下空分子；至少分母與等號結果要在
if (!incompleteNote.text.includes('214') || !incompleteNote.text.includes('0.002')) {
  throw new Error(`剝除後關鍵數值遺失：${incompleteNote.text}`);
}
const repairedAttach = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', text: String.raw`\htmlData{note=碘酸鉀質量(g)}{0.428}/214=0.002` }],
  answer: '0.002'
}));
if (/\\htmlData/.test(repairedAttach.text)) {
  throw new Error(`htmlData 未剝除：${repairedAttach.text}`);
}
if (!repairedAttach.text.includes('0.428') || (repairedAttach.text.match(/\\dfrac/g) || []).length !== 1) {
  throw new Error(`剝除後分式異常：${repairedAttach.text}`);
}
const dupNumNote = Core.prepare(JSON.stringify({
  blocks: [{ type: 'calculation', text: String.raw`\dfrac{0.428 \htmlData{note=碘酸鉀質量(g)}{0.428}}{\htmlData{note=碘酸鉀式量}{214}}=0.002` }],
  answer: '0.002'
}));
if (/\\htmlData/.test(dupNumNote.text)) {
  throw new Error(`重複數字＋舊 NOTE 未剝除：${dupNumNote.text}`);
}
if (!dupNumNote.text.includes('0.428') || !dupNumNote.text.includes('214')) {
  throw new Error(`剝除後遺失數值：${dupNumNote.text}`);
}

if (!/solve-section-title/.test(renderer) || !/\.solve-section-title/.test(boardCss)) {
  throw new Error('區塊橫幅樣式或渲染未接入');
}

// --- Phase C：提示詞四層（SYSTEM_CORE/SYSTEM_CALC 拆分、章節措辭、通則卡優先權） ---
if (!Core.SYSTEM_CORE || !Core.SYSTEM_CALC || Core.SYSTEM_CORE + Core.SYSTEM_CALC !== Core.SYSTEM) {
  throw new Error('SYSTEM_CORE/SYSTEM_CALC 未拆分或串接後與 SYSTEM 不一致');
}
if (!Core.SYSTEM.includes('【文字與算式分工｜必須遵守】') || !Core.SYSTEM.includes('calculation 才使用 \\dfrac')) {
  throw new Error('SYSTEM 缺少文字與算式分工聲明');
}
if (/層級優先|第一順位|不得覆寫/.test(Core.SYSTEM)) throw new Error('SYSTEM 仍保留優先權宣告');
const specSource = fs.readFileSync('js/solve-spec.js', 'utf8');
if (/小標依序呈現/.test(specSource)) throw new Error('章節注入仍殘留「小標依序呈現」措辭');
if (!/本題章節提醒/.test(specSource) || /第一順位|解題前必讀/.test(specSource)) throw new Error('章節提醒未簡化');
const chemCardsSource = fs.readFileSync('js/chem-rule-cards.js', 'utf8');
if (!/buildDecisionRuleBlock\(card\)/.test(chemCardsSource) || !/碘鐘判定條件/.test(chemCardsSource)) throw new Error('通則卡未改為短判定條件');
if (/buildSystemSupplement|第一順位/.test(chemCardsSource)) throw new Error('通則卡仍保留優先權注入');
if (/applyLocalGateFix/.test(chemCardsSource) || /applyLocalGateFix/.test(app)) {
  throw new Error('不應再保留本機強制改錯');
}
if (/依通則卡修正詳解/.test(app)) throw new Error('不應再保留通則卡修正 API 輪');
if (!/getSystemPromptForFollowUp/.test(prompts) || !/\\\\htmlData/.test(prompts) || !/純數學算式可使用/.test(prompts)) {
  throw new Error('追問 system prompt 未禁止 htmlData NOTE');
}
if (/優先約束|buildSystemSupplement/.test(app)) throw new Error('主解題仍保留優先權橫幅或系統補充');

// --- Phase 2：compile 保留純文字；token 正規化交 render.js ---
const underscoreChain = Core.prepare(JSON.stringify({
  blocks: [{ type: 'paragraph', text: '酸性強弱為 H_3O^+ 大於 H_3PO_4。' }],
  answer: 'A'
})).text;
if (!/H/.test(underscoreChain) || !/PO/.test(underscoreChain)) {
  throw new Error(`底線化學式 compile 遺失：${underscoreChain}`);
}
if (/normalizeScientificTokens\(body/.test(app)) throw new Error('主渲染流程仍重複改寫已編譯公式');
if (!/guardStructuralMarkers/.test(renderer)) throw new Error('render.js 缺少結構標記保護，normalizeScientificTokens 可能誤傷 @@CHOICE@@');

console.log('SOLUTION_CORE_STAGE4_OK');
