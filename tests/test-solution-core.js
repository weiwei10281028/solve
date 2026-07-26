/* 單一 AsciiMath renderer 的靜態介面回歸。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require(path.join(__dirname, '..', 'js', 'solution-core.js'));
const root = path.join(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'js', 'ascii-solution-render.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const prompts = fs.readFileSync(path.join(root, 'js', 'prompts.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const board = fs.readFileSync(path.join(root, 'css', 'board.css'), 'utf8');

function assert(condition, message) { if (!condition) throw new Error(message); }

const result = Core.prepare(JSON.stringify({
  blocks: [
    { type: 'heading', text: '依據與推導' },
    { type: 'paragraph', text: '由 Fe_xO_y 可知氧與鐵的莫耳比。' },
    { type: 'calculation', expression: 'n(Fe) = frac(3.92)(56) = 0.07 mol' },
    { type: 'choice', label: 'A', text: '符合計算結果。' }
  ],
  answer: 'A'
}));
assert(result.ok && result.document.answer === 'A', '結構化回覆失敗');
assert(result.document.blocks.some((block) => block.type === 'heading' && block.text === '選項分析'), '選擇題未自動補回選項分析橫幅');
const ppmCompile = Core.compile({
  blocks: [
    { type: 'heading', text: '依據與推導' },
    { type: 'calculation', text: '0.05% = 500ppm' }
  ],
  answer: 'D'
});
assert(/\\mathrm\{ppm\}/.test(ppmCompile), 'ppm 未在 calculation 中保護為文字單位');
assert(/function renderDocument/.test(renderer) && /function renderInto/.test(renderer), '新 renderer 入口缺失');
assert(/input\/asciimath/.test(renderer) && /mathjax@4\/startup\.js/.test(renderer), 'MathJax 4 AsciiMath 未設定');
assert(/DISPLAY_RE/.test(renderer) && /am-display-scroll/.test(renderer), '整行公式與橫滑規則缺失');
assert(/am-choice/.test(renderer) && /am-derivation/.test(renderer) && /am-reaction-table/.test(renderer), '既有詳解版面元件缺失');
assert(/AsciiSolutionRender\.renderInto/.test(app) && /setMainSolution\(prepared\.document\)/.test(app), '主詳解未改走新 renderer');
assert(!/js\/render\.js/.test(index) && !/katex\.min\.js/.test(index) && !/formula-tools\.js/.test(index), '舊詳解依賴仍被載入');
assert(/background-image: none/.test(board) && /am-display-scroll mjx-frac mjx-frac/.test(board), '深色網格或分式樣式缺失');

const renderContext = { window: {} };
vm.runInNewContext(renderer, renderContext);
const mixedHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [
    { type: 'heading', text: '結果' },
    { type: 'paragraph', text: '選項 A、B 與 12 正確。' },
    { type: 'paragraph', text: '2. MgCl2 的式量為 95。' }
  ],
  answer: 'A'
});
assert((mixedHtml.match(/class="am-result-item"/g) || []).length === 2, '結果未固定為縱向編號清單');
assert(/class="am-math am-math--display">`A`/.test(mixedHtml) && /class="am-math am-math--display">`12`/.test(mixedHtml), '一般英文字或數字未使用展示公式樣式');
assert((mixedHtml.match(/class="am-math am-math--display">`12`/g) || []).length === 1, '行內 ASCII 片段不應重複輸出');
const unitHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [
    { type: 'heading', text: '依據與推導' },
    { type: 'paragraph', text: '安全濃度為 500ppm，反應時間為 10 min。' },
    { type: 'calculation', expression: '0.05% = 500 ppm = 0.5 g L^-1' },
    { type: 'calculation', expression: 'W(C) = 12 g' }
  ], answer: 'D'
});
assert(/class="am-unit">ppm<\/span>/.test(unitHtml), 'ppm 未從 AsciiMath 運算式中拆為一般文字單位');
assert(!/\\mathrm|text\(&quot;/.test(unitHtml), '單位不應輸出 LaTeX 指令或帶引號的 text()');
assert(!/`500p(?:m|\\pm)`/.test(unitHtml), 'ppm 仍可能被 AsciiMath 拆成 p 與 pm');
assert(/`W_\(C\)\s*=/.test(unitHtml), 'W(C) 未統一為下標量符號');
const molecularMassHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [
    { type: 'paragraph', text: '溶解度為280 g/L。分子量約為7*12+15*1+3*14 = 84+15+42 = 141 g/mol，但若依原題化學式(C7H14N3)n計算。' },
    { type: 'calculation', expression: 'M = 141 g/(mol)' }
  ],
  answer: '141'
});
assert(/`7 xx 12 \+ 15 xx 1 \+ 3 xx 14\s*=/.test(molecularMassHtml), '分子量乘法算式未正規化為 MathJax 乘號');
assert((molecularMassHtml.match(/class="am-unit">g\/mol<\/span>/g) || []).length === 2, 'g/mol 或 g/(mol) 未保護為一般單位文字');
assert(/class="am-unit">g\/L<\/span>/.test(molecularMassHtml), 'g/L 未保護為一般單位文字');
const molecularMassMathBodies = [...molecularMassHtml.matchAll(/`([^`]*)`/g)].map((match) => match[1]).join('\n');
assert(!/g\s*\/\s*(?:m|L)|(?:^|[^A-Za-z])ol(?:$|[^A-Za-z])/.test(molecularMassMathBodies), 'g/mol 或 g/L 仍可能留在 AsciiMath 公式內');
assert(/`C_7H_\(14\)N_3`/.test(renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [
    { type: 'heading', text: '題意' },
    { type: 'calculation', text: 'C_7H_14N_3' }
  ],
  answer: 'C'
})), '多位數元素下標未自動加括號');
const tolerantResultHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [
    { type: 'heading', text: '結果' },
    { type: 'paragraph', text: '第一項未編號；2. 第二項有編號' },
    { type: 'chemical_equation', text: 'H_2 ⇌ 2H' }
  ],
  answer: 'H2'
});
assert((tolerantResultHtml.match(/class="am-result-item"/g) || []).length === 2 && /第一項未編號/.test(tolerantResultHtml), '結果漏號容錯會遺失前段文字');
assert(/`H_2 &lt;-&gt; 2H`/.test(tolerantResultHtml), 'Unicode 可逆箭頭未正規化為 AsciiMath');
assert(/單向反應（→）只寫 ->；可逆或平衡反應（⇌）只寫 <->/.test(Core.buildSystem()), '主提示詞缺少箭頭對照');
assert(/務必實際完成必要計算與驗算/.test(Core.buildSystem()), '第二段提示詞未強制實際計算與驗算');
assert(/題意須 30 字以內/.test(Core.buildSystem()), '第二段提示詞未限制題意長度');
assert(/現象成立條件/.test(Core.buildSystem()), '第二段提示詞未要求先判定現象成立條件');
assert(/answer 與「選項分析」必須對齊/.test(Core.buildSystem()), '第二段提示詞未保留參考答案對齊');

const promptContext = { window: { SolutionCore: Core } };
vm.runInNewContext(prompts, promptContext);
assert(/選項前提不成立/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題未要求標出選項前提不成立');
assert(
  Object.keys(promptContext.window.QuestionAnalysisPrompt.SCHEMA.properties).join(',') === 'questionText,memo',
  '第一段審題格式應只保留完整題目與自由備忘錄'
);
const latexLeak = Core.prepare(JSON.stringify({
  blocks: [
    { type: 'heading', text: '題意' },
    { type: 'paragraph', text: '本題要求由秒錶反應判斷哪些選項正確並計算是否會變藍' },
    { type: 'heading', text: '依據與推導' },
    { type: 'paragraph', text: '濃度為 $0.004\\,\\mathrm{M}$。' },
    { type: 'calculation', text: '$r_1=\\frac{1}{50}=0.02\\,\\mathrm{s}^{-1}$' }
  ],
  answer: 'A'
}));
assert(latexLeak.ok, '含 LaTeX 包裝的 JSON 應可正規化');
assert(!/\$|\\frac|\\mathrm/.test(JSON.stringify(latexLeak.document)), '正規化後 document 不應殘留 $ 或 LaTeX 指令');
assert(Array.from(latexLeak.document.blocks[1].text).length <= 30, '題意 paragraph 未壓到 30 字內');
const twoStageUserText = promptContext.window.assembleSolveUserContent(
  '題目文字與選項',
  '先核對守恆並完成必要計算。',
  '計算精簡，但不得省略關鍵中間量。',
  'B',
  { verifyReference: true }
).fullText;
assert(/【本題解題備忘錄｜僅供內部參考】/.test(twoStageUserText), '第二段未接收第一段備忘錄');
assert(/【使用者啟用的進階設定】/.test(twoStageUserText), '第二段未納入進階設定');
assert(/【待對齊參考答案】B/.test(twoStageUserText), '第二段未納入參考答案對齊');

const solveFlow = app.slice(app.indexOf('async function startSolve()'), app.indexOf('async function sendFollowUp()'));
assert((solveFlow.match(/callAPI\(/g) || []).length === 2, '主解題流程必須固定只有審題與詳解兩次 AI 呼叫');
assert(!/QuestionIngest|ANSWER_VERIFICATION|alignPrompt|ChemistryEnginePipeline|ChemRuleCards/.test(solveFlow), '主解題仍受舊擷取、驗證、對齊、通則卡或解題引擎影響');
assert(!/question-ingest|chemistry-engine|engine-adapter|engine-catalog|chem-rule-cards/.test(index), '主頁仍載入已略過的通則卡或解題引擎');
console.log('ASCII_SOLUTION_RENDER_OK');
