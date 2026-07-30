/* 單一 AsciiMath renderer 的靜態介面回歸。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require(path.join(__dirname, '..', 'js', 'solution-core.js'));
const root = path.join(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'js', 'ascii-solution-render.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const prompts = fs.readFileSync(path.join(root, 'js', 'prompts.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'js', 'api.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
const board = fs.readFileSync(path.join(root, 'css', 'board.css'), 'utf8');
const studioCss = fs.readFileSync(path.join(root, 'css', 'studio-theme.css'), 'utf8');

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
assert(result.document.blocks[0].type === 'heading' && result.document.blocks[0].text === '題意', '詳解未強制以題意開頭');
assert(result.document.blocks.some((block) => block.type === 'heading' && block.text === '依據與推導'), '詳解未補回依據與推導橫幅');
assert(result.document.blocks.some((block) => block.type === 'heading' && block.text === '選項分析'), '選擇題未自動補回選項分析橫幅');
assert(result.document.blocks.filter((block) => block.type === 'heading').map((block) => block.text).join('、') === '題意、依據與推導、選項分析', '選擇題三個章節未固定為正確順序');
const nonChoiceResult = Core.prepare(JSON.stringify({
  blocks: [
    { type: 'heading', text: '題意' },
    { type: 'heading', text: '依據與推導' },
    { type: 'calculation', expression: 'A = 54.88' },
    { type: 'heading', text: '選項分析' },
    { type: 'choice', label: 'A', text: '不應出現。' }
  ],
  answer: '54.88'
}), { allowChoices: false });
assert(nonChoiceResult.ok && nonChoiceResult.document.answer === '54.88', '非選題未保留直接答案');
assert(!nonChoiceResult.document.blocks.some((block) => block.type === 'choice' || (block.type === 'heading' && block.text === '選項分析')), '非選題未移除腦補的選項分析');
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
const followupStart = app.indexOf('async function sendFollowUp()');
const followupFlow = app.slice(followupStart, app.indexOf('onProviderChange();', followupStart));
assert(/getSystemPromptForFollowUp/.test(prompts) && /SolutionCore\?\.buildSystem\?\.\(\)/.test(prompts), '追問未沿用首次作答的格式規則');
assert(/responseFormat/.test(followupFlow) && /APPLICATION_JSON/.test(followupFlow) && /buildSolveResponseSchema\(\)/.test(followupFlow), '追問未要求與首次作答相同的結構化回覆');
assert(/SolutionCore\.prepare\(rawReply\)/.test(followupFlow) && /fillFollowupReply\(block, prepared\.document\)/.test(followupFlow), '追問未經既有正規化與渲染管線');
assert(/hasImage \|\| hasExplicitChoiceOptions/.test(app) && !/\[A-E\]/.test(app.slice(app.indexOf('function hasExplicitChoiceOptions'), app.indexOf('function normalizeNumericExpression'))), '主解題仍以 A–E 限制選項分析或會刪除圖片題的 choice');
assert(/若原題文字或圖片中有選項，必須以原標籤逐項輸出 choice 並分析/.test(prompts), '解題提示未要求有選項時逐項分析且保留原標籤');
assert(!/js\/render\.js/.test(index) && !/katex\.min\.js/.test(index) && !/formula-tools\.js/.test(index), '舊詳解依賴仍被載入');
assert(/background-image: none/.test(board) && /am-display-scroll mjx-frac mjx-frac/.test(board), '深色網格或分式樣式缺失');
assert(/family=Iansui/.test(index) && /--font:\s*'IansuiScaled',\s*'Iansui'/.test(appCss) && /--font-ui:\s*"IansuiScaled",\s*"Iansui"/.test(studioCss), '首頁與建立題目分析未恢復芫荽字型');
assert(/size-adjust:\s*105%/.test(appCss) && /latin-400-normal\.woff2/.test(appCss) && /font-family:\s*"ComputerModernText",\s*"Iansui"/.test(board) && !/Cambria,\s*"Times New Roman"/.test(board), '詳解框未維持 Computer Modern 與芫荽混排');
assert(/\.am-solution mjx-container \{[^}]*font-size:\s*112%/.test(board) && /\.am-unit \{[^}]*font-size:\s*1\.05em/.test(board), '單位或公式未維持新版顯示比例');
assert(/font-size:\s*19\.2px/.test(board) && !/line-height:\s*2\.35/.test(board), '板書字級未放大 1.2 倍，或混排行仍保留過寬行距');
assert(/\.am-solution \.am-section-title \{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*font-size:\s*1\.18em;[^}]*line-height:\s*1;/s.test(board) && /am-section-title span \{[^}]*translateY\(0\.1em\)/.test(board), '橫幅標題未垂直置中或未放大');
assert(/openai:\s*\{/.test(app) && /gpt-5-nano/.test(app) && /gpt-5-mini/.test(app), 'OpenAI GPT provider 或推薦模型未加入');
assert(/reasoning_effort:\s*openAIReasoningEffort/.test(fs.readFileSync(path.join(root, 'js', 'api.js'), 'utf8')), 'OpenAI 未設定低推理量，容易出現 length 無輸出');
assert(/cfg\?\.provider === 'openai' \? callOpenAI : callGemini/.test(fs.readFileSync(path.join(root, 'js', 'api.js'), 'utf8')), 'callAPI 未依 provider 分流 OpenAI/Gemini');
assert(/responseMimeType/.test(api) && /responseJsonSchema/.test(api), 'Gemini 結構化輸出未使用正式 JSON schema 欄位');
assert(/<option value="openai">OpenAI GPT<\/option>/.test(index), '連線設定缺少 OpenAI GPT 選項');

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
const equilibriumHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [{ type: 'chemical_equation', text: 'CH_3COOH + H_2O <-> H_3O^+ + CH_3COO^-' }],
  answer: ''
});
assert(/class="am-equilibrium-arrow"[^>]*>⇌<\//.test(equilibriumHtml) && !/rightleftharpoons/.test(equilibriumHtml), '可逆反應箭頭必須在 MathJax 外獨立顯示，不能被拆成文字');
assert(/class="am-unit">ppm<\/span>/.test(unitHtml), 'ppm 未從 AsciiMath 運算式中拆為一般文字單位');
assert(!/\\mathrm|text\(&quot;/.test(unitHtml), '單位不應輸出 LaTeX 指令或帶引號的 text()');
assert(!/`500p(?:m|\\pm)`/.test(unitHtml), 'ppm 仍可能被 AsciiMath 拆成 p 與 pm');
assert(/`W_\(C\)\s*=/.test(unitHtml), 'W(C) 未統一為下標量符號');
const slashDivisionHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [{ type: 'calculation', expression: 'n_CaCO3 = 8.00/100 = 0.08 g/mol' }],
  answer: ''
});
assert(/frac\(8\.00\)\(100\)/.test(slashDivisionHtml) && !/8\.00\/100/.test(slashDivisionHtml), '數值除法未轉為直式分數');
assert(/class="am-unit">g\/mol<\/span>/.test(slashDivisionHtml), '單位 g/mol 不應轉為直式分數');
const vaporPressureHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [{ type: 'calculation', text: 'P_H_2O + P_N_2 = 600mmHg' }],
  answer: ''
});
assert(/`P_\(H_2O\)\s*\+\s*P_\(N_2\)\s*=/.test(vaporPressureHtml), '化學式作變數下標時未自動分組');
assert(/class="am-unit">mmHg<\/span>/.test(vaporPressureHtml), 'mmHg 未從 AsciiMath 運算式中拆為一般單位文字');
assert(/P_\{H_2O\}/.test(Core.calculation('P_H_2O = 30mmHg')), '核心算式未修正化學式下標');
const quantityChemistryHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [{ type: 'paragraph', text: '將0.10MNaCl30mL與0.20MAgNO3 10mL混合。' }],
  answer: ''
});
assert((quantityChemistryHtml.match(/class="am-unit">M<\/span>/g) || []).length === 2, '莫耳濃度單位未拆成可見文字節點');
assert((quantityChemistryHtml.match(/class="am-unit">mL<\/span>/g) || []).length === 2, '體積單位未拆成可見文字節點');
assert((quantityChemistryHtml.match(/class="am-token-gap"/g) || []).length >= 1, '黏連化學式與後接量值未補上可見間距');
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
const energyUnitHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [{ type: 'calculation', expression: 'DeltaH = 2.51 kJ/(mol)' }],
  answer: ''
});
assert(/class="am-unit">kJ\/\(mol\)<\/span>/.test(energyUnitHtml), 'kJ/(mol) 未保護為完整能量莫耳單位');
const wrappedFormulaHtml = renderContext.window.AsciiSolutionRender.renderDocument({
  blocks: [{ type: 'calculation', expression: 'a = b + c + d + e + f + g + h + i + j + k + l + m + n = p + q + r + s + t + u + v + w + x + y + z = final_value' }],
  answer: ''
});
assert(/am-display-content--wrapped/.test(wrappedFormulaHtml) && (wrappedFormulaHtml.match(/am-display-line/g) || []).length === 4, '過長連等式未依等號安全分行');
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
assert(/class="am-equilibrium-arrow"[^>]*>⇌<\//.test(tolerantResultHtml), 'Unicode 可逆箭頭應獨立顯示為 ⇌');
assert(/所有公式使用 AsciiMath/.test(Core.buildSystem()), '主提示詞未保留 AsciiMath 輸出規則');
assert(/有選項時依序輸出「題意」「依據與推導」「選項分析/.test(Core.buildSystem()), '主提示詞未固定選擇題三步驟');
assert(/題意只用一兩句簡述核心考點、主要定義或定律與所求/.test(Core.buildSystem()), '題意未限制為一兩句核心摘要');
assert(/不可列已知量、設未知數、代入數字、寫方程式或推導/.test(Core.buildSystem()), '題意未禁止承載推導內容');
assert(/原題條件與必要判斷須放在「依據與推導」中使用/.test(Core.buildSystem()), '題意省略的條件未要求移到依據與推導');
assert(/中文說明寫 paragraph；calculation 只放一條完整 AsciiMath 算式/.test(Core.buildSystem()), '推導未分開中文說明與完整算式');
assert(/公式量名只用拉丁字母與下標，如 n_A、W_A；化學式作下標須分組，如 P_\(H_2O\)，不可寫 P_H_2O；數字與單位留空格/.test(Core.buildSystem()), '公式未限制化學式下標與單位間距');
assert(/不可把同一等式拆成零碎區塊或讓等號單獨成行/.test(Core.buildSystem()), '推導未限制零碎等式');
assert(/已有直接比例或守恆式時，不再引入額外未知量或重算同一量/.test(Core.buildSystem()), '推導未要求使用最短等價關係');
assert(/先依 TARGET\/CHECKS 找出會影響子問或選項的共用關係與量，只計算必要者；在判斷前完成相關 CHECKS/.test(Core.buildSystem()), '第二段未把審題完成清單用於推導');
assert(/共用結果若用於多個結論，先以適用的守恆、定義、單位或題圖條件核對一次/.test(Core.buildSystem()), '第二段未要求核對共用結果');
assert(!/最多保留兩個等號|短等式鏈/.test(Core.buildSystem()), '主提示詞仍保留過度壓縮的計算格式限制');
assert(/比較、排序、比例、百分率或速率題，須列出足以判定正誤的量或關係/.test(Core.buildSystem()), '主提示詞未要求比較題的判定依據');
assert(/依據與推導保留必要的原理、計算與結果/.test(Core.buildSystem()) && /選項分析逐項判正誤並以已完成的關係、數值或條件說明依據/.test(Core.buildSystem()), '主提示詞未保留推導與逐項選項分析');

const promptContext = { window: { SolutionCore: Core } };
vm.runInNewContext(prompts, promptContext);
assert(/單題證據擷取器/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題未改為證據擷取');
assert(/最多 5 行、360 字/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題未限制 memo 長度');
assert(/CARD=<下列標題/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題未改為卡片標題選擇');
assert(/液柱壓差與定溫封閉氣體/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM) && /密閉容器液氣共存與 P-T 圖/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題缺少氣體卡片標題');
assert(/非揮發性溶液蒸氣壓平衡/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題缺少溶液蒸氣壓平衡卡片標題');
assert(/FACTS:/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM) && /TARGET:/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM) && /CHECKS:/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題缺少事實、目標或完成清單欄位');
assert(/CHECKS 不重抄選項、不寫公式或答案/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題未限制完成清單的內容');
assert(/不重抄題目、不解題、不列答案/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題仍會重抄題目或提前解題');
assert(!/ROUTE=primary:/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM) && !/GATE:先判條件/.test(promptContext.window.QuestionAnalysisPrompt.SYSTEM), '第一段審題仍混入路由代號或卡片規則');
assert(
  Object.keys(promptContext.window.QuestionAnalysisPrompt.SCHEMA.properties).join(',') === 'memo',
  '第一段審題格式應只保留備忘錄'
);
const recoveredQuestionAnalysis = promptContext.window.parseQuestionAnalysis(
  '審題結果如下：\n```json\n{"memo":"CARD=化學計量與限量試劑\\nFACTS=反應物質量與係數已確認\\nTARGET=找出錯誤選項\\nCHECKS=限量試劑、理論產量與剩餘量"}\n```'
);
assert(/CARD=化學計量與限量試劑/.test(recoveredQuestionAnalysis?.memo), '審題 JSON 夾帶前後文字時未能安全解析');
const vaporCardMemo = 'CARD=非揮發性溶液蒸氣壓平衡\nFACTS=密閉容器內有多杯非揮發性溶液\nTARGET=比較平衡後溶劑量與初始蒸發趨勢\nCHECKS=液體是否耗盡、溶劑分配與初始蒸氣壓順序';
const vaporAuditBlock = promptContext.window.buildSelectedAuditCardBlock(vaporCardMemo);
assert(/CARD=非揮發性溶液蒸氣壓平衡/.test(vaporAuditBlock), '卡片標題未命中溶液蒸氣壓平衡短卡');
assert(/水莫耳分率相等/.test(vaporAuditBlock) && !/PV=nRT/.test(vaporAuditBlock), '溶液蒸氣壓卡誤注入氣體狀態方程');
assert(/CARD=通用單題核對/.test(promptContext.window.buildSelectedAuditCardBlock('CARD=不存在的卡\nFACTS=資料')), '未知卡片標題未降級為短通用卡');
const phaseCurveRouteMemo = 'ROUTE=primary:gas_liquid_phase_curve\nSTATE:密閉定容，液體存在時氣相莫耳數可變\nGATE:先判液體耗盡分界';
const phaseCurveAuditBlock = promptContext.window.buildLocalAuditCardBlock('密閉容器加熱液體，觀察 P-T 圖。', phaseCurveRouteMemo);
assert(/CARD=密閉容器液氣共存與 P-T 圖/.test(phaseCurveAuditBlock), '相圖路由未命中精簡核對包');
assert(/液體耗盡後才可用固定 n 的 P\/T/.test(phaseCurveAuditBlock), '相圖路由未保留固定莫耳數門檻');
assert(!/排水集氣為濕氣/.test(phaseCurveAuditBlock), '相圖路由不應注入完整水上集氣卡');
const mercuryRouteMemo = 'ROUTE=primary:gas_mercury_column; support:gas_state_law\nDIAGRAM:開口端液面較封閉端高\nSTATE:定溫、管徑固定';
const mercuryRouteAuditBlock = promptContext.window.buildLocalAuditCardBlock('J 型管以水銀封入空氣，問液面與氣柱變化。', mercuryRouteMemo);
assert(/CARD=液柱壓差與定溫封閉氣體/.test(mercuryRouteAuditBlock), '液柱路由未命中精簡核對包');
assert(/CARD=氣體狀態變化/.test(mercuryRouteAuditBlock), '輔助路由未注入第二張精簡核對包');
assert(!/排水集氣為濕氣/.test(mercuryRouteAuditBlock), '液柱路由不應注入完整水上集氣卡');
assert(/CARD=通用單題核對/.test(promptContext.window.buildLocalAuditCardBlock('', 'ROUTE=primary:unknown_route')), '無效路由未降級為短通用核對包');
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
assert(
  latexLeak.document.blocks[1].text === '本題要求由秒錶反應判斷哪些選項正確並計算是否會變藍',
  '題意 paragraph 不應被字數限制截斷'
);
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
const weakClockMemo = '(E) 主張：800 秒後變藍；必查：代入速率定律與時間反比關係。';
const clockStem = '碘鐘反應，甲液含 IO3-，乙液含 HSO3- 與澱粉。混合 1 mL 甲液、15 mL 乙液及 4 mL 水，依式 5、6、7 判斷變藍時間。';
const clockAuditBlock = promptContext.window.buildLocalAuditCardBlock(clockStem, weakClockMemo);
assert(/CARD=秒錶\/碘鐘/.test(clockAuditBlock), '秒錶題未命中專用通則卡');
assert(/ORDER:n=C_stock\*V_stock -> limiting\/color_gate -> rate\/time/.test(clockAuditBlock), '秒錶通則卡未強制先算混合後莫耳數');
assert(/frac\(n_\(IO_3\^-\)\)\(n_\(HSO_3\^-\)\) > frac\(1\)\(3\)/.test(clockAuditBlock), '秒錶通則卡缺少 n(IO3-)/n(HSO3-) > 1/3 的直式顯色門檻');
assert(/<= frac\(1\)\(3\).*no_blue\/time_NA/.test(clockAuditBlock), '秒錶通則卡缺少小於等於 1/3 時不顯色與時間不適用');
assert(/no_blue\/time_NA/.test(clockAuditBlock), '秒錶通則卡缺少不變藍與時間不適用判斷');
assert(/莫耳數比未達顯色條件/.test(clockAuditBlock), '秒錶通則卡未要求指出顯色時間選項的主要錯因');
assert(/I2消耗步驟快於I2供應步驟/.test(clockAuditBlock), '秒錶通則卡未明確處理 I2 消耗與供應快慢判斷');
assert(/pH may affect rate/.test(clockAuditBlock), '秒錶通則卡未保留 pH 速率判斷');
assert(/gate_fail => 不變藍\/time_NA/.test(clockAuditBlock), '秒錶通則卡未限制時間外推');
assert(!/(?:^|\n)[A-E]:/.test(clockAuditBlock), '秒錶通則卡不得針對特定選項字母');
assert(!/800/.test(clockAuditBlock), '秒錶通則卡不得含特定題目的秒數');
const clockEnrichedUserText = promptContext.window.assembleSolveUserContent(clockStem, weakClockMemo, '', '', {}).fullText;
assert(/CARD=秒錶\/碘鐘/.test(clockEnrichedUserText), '第二段組裝未自動附加秒錶通則卡');
assert(!/CARD=酸鹼計算/.test(clockAuditBlock), '秒錶題不得只因 pH 字樣誤掛酸鹼通則卡');
assert(promptContext.window.buildLocalAuditCardBlock('請比較酸鹼強弱。', '') === '', '非秒錶題不應附加秒錶通則卡');

const oxideAtomicMassStem = '某金屬氧化物含 22.6% 重量之氧，同一金屬的另一氧化物含 50.5% 重量之氧，求此金屬的原子量。';
const oxideAtomicMassCard = promptContext.window.buildLocalAuditCardBlock(oxideAtomicMassStem, 'TYPE=兩種金屬氧化物；MUST=由兩個氧質量百分比求金屬原子量。');
assert(/CARD=兩種金屬氧化物與原子量/.test(oxideAtomicMassCard), '兩種氧化物原子量題未命中專用卡');
assert(/A\/x/.test(oxideAtomicMassCard) && /M_2O_x/.test(oxideAtomicMassCard), '氧化物原子量卡未提供共用原子量的比例流程');
assert(/x\/y = \(A\/y\)\/\(A\/x\)/.test(oxideAtomicMassCard) && /x=2、y=7、A≈54.8/.test(oxideAtomicMassCard), '氧化物原子量卡未固定正確的整數比推導');
assert(/不可改用 MO_x、MO_y/.test(oxideAtomicMassCard), '氧化物原子量卡未禁止不必要的第二套假設');
assert(!/CARD=兩種金屬氧化物與原子量/.test(promptContext.window.buildLocalAuditCardBlock('某金屬氧化物中氧的質量百分比為 22.6%。', '求氧的質量。')), '單一氧化物題不應掛兩氧化物原子量卡');

const acidBaseStem = '弱酸以強鹼滴定，已知 Ka、濃度與體積，求不同加入體積下的 pH，並判斷緩衝區、當量點與過量區。';
const acidBaseAuditBlock = promptContext.window.buildLocalAuditCardBlock(acidBaseStem, 'TYPE=酸鹼計算；MUST=先判滴定區段再選公式');
assert(/兩溶液等體積混合且該物種未反應、未額外加入時，C_after=C_initial\/2/.test(acidBaseAuditBlock), '酸鹼計算卡未要求等體積混合後濃度減半');
assert(/CARD=酸鹼計算/.test(acidBaseAuditBlock), '酸鹼計算題未命中酸鹼通則卡');
assert(/ORDER:n=C\*V\*equiv -> neutralize\/region -> dominant_species -> equilibrium -> pH/.test(acidBaseAuditBlock), '酸鹼卡未要求先做莫耳與區段判斷');
assert(/禁止平均pH/.test(acidBaseAuditBlock), '酸鹼卡缺少禁止 pH 平均');
assert(/before_eq=>buffer；eq=>conjugate hydrolysis；after_eq=>excess strong controls/.test(acidBaseAuditBlock), '酸鹼卡缺少弱酸弱鹼中和分區');
assert(/H-H無雙組分/.test(acidBaseAuditBlock), '酸鹼卡缺少緩衝公式適用條件');
assert(/polyprotic逐當量點/.test(acidBaseAuditBlock), '酸鹼卡缺少多質子滴定分區');
assert(!/(?:^|\n)[A-E]:/.test(acidBaseAuditBlock), '酸鹼通則卡不得針對特定選項字母');
const equilibriumStem = 'N2(g) + 3H2(g) ⇌ 2NH3(g) 已達平衡。定溫壓縮容器後，請比較擾動瞬間 Q 與 K，判斷平衡移動與各物種的新平衡趨勢。';
const equilibriumAuditBlock = promptContext.window.buildLocalAuditCardBlock(equilibriumStem, 'TYPE=化學平衡；MUST=先寫擾動瞬間的 Q 再與 K 比較');
assert(/兩溶液等體積混合且該物種未反應、未額外加入時，C_after=C_initial\/2/.test(equilibriumAuditBlock), '平衡卡未要求等體積混合後濃度減半');
assert(/CARD=化學平衡/.test(equilibriumAuditBlock), '平衡移動題未命中化學平衡通則卡');
assert(/ORDER:write reaction -> valid Q\/K expression -> post-disturbance Q -> compare Q\/K -> shift -> final trend/.test(equilibriumAuditBlock), '平衡卡未強制先算擾動後 Q');
assert(/同一反應僅temperature改變K/.test(equilibriumAuditBlock), '平衡卡未限制 K 僅由溫度改變');
assert(/Q<K=>向生成物；Q=K=>無淨移動；Q>K=>向反應物/.test(equilibriumAuditBlock), '平衡卡缺少 Q/K 方向判定');
assert(/定V加入惰性氣體=>各反應氣體分壓\/Q不變/.test(equilibriumAuditBlock), '平衡卡缺少定體積惰性氣體判定');
assert(/K改變，必用new K/.test(equilibriumAuditBlock), '平衡卡未要求溫度變化使用新 K');
assert(/禁止未寫Q就套勒沙特列/.test(equilibriumAuditBlock), '平衡卡未禁止直接套勒沙特列');
assert(!/CARD=化學平衡/.test(promptContext.window.buildLocalAuditCardBlock('請定義平衡常數 Kc。', '')), '僅問平衡常數定義不應掛平衡卡');
assert(!/CARD=化學平衡/.test(promptContext.window.buildLocalAuditCardBlock('催化劑如何降低活化能並加快反應速率？', '')), '純速率催化劑題不應掛平衡卡');
assert(!/CARD=化學平衡/.test(promptContext.window.buildLocalAuditCardBlock('比較離子積與 Ksp，判斷是否生成沉澱。', '')), '沉澱門檻題不應掛平衡卡');
const precipitationStem = '混合 AgNO3 與 NaCl 溶液後，已知 Ksp，請以混合後總體積計算 Qsp，判斷是否產生 AgCl 沉澱。';
const precipitationAuditBlock = promptContext.window.buildLocalAuditCardBlock(precipitationStem, 'TYPE=溶度積與沉澱；MUST=先算混合後自由離子濃度再比較 Qsp/Ksp');
assert(/CARD=溶度積與沉澱/.test(precipitationAuditBlock), 'Ksp 沉澱題未命中專用通則卡');
assert(/post-mixing free ions -> compare Qsp\/Ksp/.test(precipitationAuditBlock), '沉澱卡未強制先算混合後自由離子');
assert(/禁止直接用原液或總濃度/.test(precipitationAuditBlock), '沉澱卡未禁止直接使用原液或總濃度');
assert(/Qsp<Ksp=>未飽和\/無沉澱；Qsp=Ksp=>飽和門檻/.test(precipitationAuditBlock), '沉澱卡缺少 Qsp/Ksp 三區段判定');
assert(/混合後各離子用V_total/.test(precipitationAuditBlock), '沉澱卡缺少總體積稀釋規則');
assert(/不能只比Ksp/.test(precipitationAuditBlock), '沉澱卡未限制只比較 Ksp 判斷選擇性沉澱');
assert(/中和\/錯合副反應/.test(precipitationAuditBlock), '沉澱卡未要求先處理中和或錯合副反應');
assert(!/CARD=化學平衡/.test(precipitationAuditBlock), 'Ksp 沉澱題不得誤掛一般平衡卡');
assert(!/CARD=溶度積與沉澱/.test(promptContext.window.buildLocalAuditCardBlock('已知沉澱完全，計算 AgCl 沉澱質量。', '')), '完全沉澱的一般化學計量題不應掛沉澱卡');
assert(!/CARD=溶度積與沉澱/.test(promptContext.window.buildLocalAuditCardBlock('攪拌如何影響食鹽的溶解速率？', '')), '溶解速率題不應掛沉澱卡');
assert(!/CARD=溶度積與沉澱/.test(promptContext.window.buildLocalAuditCardBlock('油與水為何不互溶？', '')), '一般溶解性題不應掛沉澱卡');
const electrochemStem = '以標準還原電位組成伏打電池，請寫半反應，判斷陽極、陰極、正負極、電子與鹽橋離子流向，並求 Ecell。';
const electrochemAuditBlock = promptContext.window.buildLocalAuditCardBlock(electrochemStem, 'TYPE=氧化還原/電化學；MUST=先寫半反應與電極角色');
assert(/CARD=氧化還原與電化學/.test(electrochemAuditBlock), '電化學題未命中氧化還原與電化學卡');
assert(/anode永遠oxidation；cathode永遠reduction/.test(electrochemAuditBlock), '電化學卡未固定陽極氧化、陰極還原');
assert(/自發原電池 anode=負極、cathode=正極/.test(electrochemAuditBlock), '電化學卡缺少原電池正負極規則');
assert(/電解池 anode=電源正極、cathode=電源負極/.test(electrochemAuditBlock), '電化學卡缺少電解池正負極規則');
assert(/e-不經鹽橋\/溶液/.test(electrochemAuditBlock), '電化學卡未禁止電子經鹽橋或溶液移動');
assert(/半反應倍乘不倍乘E/.test(electrochemAuditBlock), '電化學卡未限制半反應係數倍乘電位');
assert(/Ecell=0時Q=K/.test(electrochemAuditBlock), '電化學卡缺少 Ecell=0 與 Q=K 關係');
assert(/n_\(e-\)=Q\/F/.test(electrochemAuditBlock), '電化學卡缺少法拉第電子莫耳數換算');
assert(!/CARD=氧化還原與電化學/.test(promptContext.window.buildLocalAuditCardBlock('求 SO4^2- 中 S 的氧化數。', '')), '單一物質氧化數題不應掛電化學卡');
assert(!/CARD=氧化還原與電化學/.test(promptContext.window.buildLocalAuditCardBlock('HCl 與 NaOH 中和後溶液呈中性。', '')), '非氧化還原中和題不應掛電化學卡');
const electrochemEquilibriumBlock = promptContext.window.buildLocalAuditCardBlock('可逆電池已知 Q 與 K，請比較 Q/K 及 Ecell 判斷反應方向。', 'TYPE=電化學；MUST=比較 Q、K 與 Ecell');
assert(/CARD=氧化還原與電化學/.test(electrochemEquilibriumBlock) && /CARD=化學平衡/.test(electrochemEquilibriumBlock), '涉及 Q/K 的電化學題應可同時附加電化學與平衡卡');
const stoichStem = '2Al + 3Cl2 → 2AlCl3。給定兩反應物的質量，求限量試劑、AlCl3 的理論產量與過量試劑剩餘量。';
const stoichAuditBlock = promptContext.window.buildLocalAuditCardBlock(stoichStem, 'TYPE=化學計量；MUST=配平後將兩反應物轉莫耳並比較 n/係數');
assert(/CARD=化學計量與限量試劑/.test(stoichAuditBlock), '限量試劑題未命中化學計量卡');
assert(/convert to moles -> compare n\/coefficient -> limiting reagent/.test(stoichAuditBlock), '化學計量卡未強制比較 n/係數');
assert(/未配平禁止用係數比/.test(stoichAuditBlock), '化學計量卡未禁止未配平就用係數比');
assert(/最小值=反應程度與限量試劑/.test(stoichAuditBlock), '化學計量卡未以最小 n/係數判限量試劑');
assert(/理論產量由限量試劑決定/.test(stoichAuditBlock), '化學計量卡未限制理論產量來源');
assert(/質量比不可直接當係數比/.test(stoichAuditBlock), '化學計量卡未禁止將質量比當係數比');
assert(!/CARD=化學計量與限量試劑/.test(promptContext.window.buildLocalAuditCardBlock('兩杯 NaCl 溶液混合後，求混合濃度。', '')), '物理混合稀釋題不應掛化學計量卡');
assert(!/CARD=化學計量與限量試劑/.test(promptContext.window.buildLocalAuditCardBlock('已知 Kc，求可逆反應達平衡時各物種濃度。', '')), '平衡組成題不應掛化學計量卡');
assert(!/CARD=化學計量與限量試劑/.test(promptContext.window.buildLocalAuditCardBlock('判斷下列反應屬於化合反應或分解反應。', '')), '僅辨認反應類型不應掛化學計量卡');
const gasCollectionStem = '氧氣以排水集氣法收集，量氣管內外液面不等高。已知大氣壓與水蒸氣壓，求乾燥氧氣的壓力與莫耳數。';
const gasAuditBlock = promptContext.window.buildLocalAuditCardBlock(gasCollectionStem, 'TYPE=氣體與集氣；MUST=先修正液面壓差並扣水蒸氣壓');
assert(/CARD=氣體與水上集氣/.test(gasAuditBlock), '水上集氣題未命中氣體卡');
assert(/P_dry gas=P_total-P_H2O/.test(gasAuditBlock), '氣體卡未要求濕氣扣除水蒸氣壓');
assert(/內外液面等高才P_total=P_atm/.test(gasAuditBlock), '氣體卡未限制液面等高才可令總壓等於大氣壓');
assert(/管內液面高=>P_total<P_atm，低=>P_total>P_atm/.test(gasAuditBlock), '氣體卡未處理液面高低與壓力關係');
assert(/P1V1\/T1=P2V2\/T2只限同一固定n/.test(gasAuditBlock), '氣體卡未限制綜合氣體定律的固定莫耳數前提');
assert(/易溶於水或與水反應時/.test(gasAuditBlock), '氣體卡未提醒排水集氣適用性');
assert(!/攝氏|273/.test(gasAuditBlock), '氣體卡不應塞入基本溫度換算提醒');
assert(!/CARD=氣體與水上集氣/.test(promptContext.window.buildLocalAuditCardBlock('2H2 + O2 → 2H2O，求生成水的莫耳數。', '')), '非氣體狀態換算的單純計量題不應掛氣體卡');
assert(!/CARD=氣體與水上集氣/.test(promptContext.window.buildLocalAuditCardBlock('氣體分子擴散速率與莫耳質量有何關係？', '')), '擴散速率題不應掛氣體卡');
assert(!/CARD=氣體與水上集氣/.test(promptContext.window.buildLocalAuditCardBlock('氣相平衡中壓縮容器，判斷平衡移動方向。', '已知 Kp，比較 Q 與 K')), '氣相平衡壓力題不應掛氣體卡');
const thermoStem = '以 Hess 定律將數條熱化學反應式相加，求目標反應的 ΔH，並注意 H2O(l) 與 H2O(g) 的差異。';
const thermoAuditBlock = promptContext.window.buildLocalAuditCardBlock(thermoStem, 'TYPE=熱化學；MUST=先對齊目標反應方向、係數與物態再相加 ΔH');
assert(/CARD=熱化學/.test(thermoAuditBlock), '熱化學題未命中專用通則卡');
assert(/ΔH屬於特定方向、係數與物態的完整反應/.test(thermoAuditBlock), '熱化學卡未限制 ΔH 與反應式對應');
assert(/反轉反應=>ΔH變號；反應式乘\/除k=>ΔH同乘\/除k/.test(thermoAuditBlock), '熱化學卡缺少反轉與倍乘 ΔH 規則');
assert(/只有標準態元素ΔH°f=0/.test(thermoAuditBlock), '熱化學卡未限制生成焓為零的元素狀態');
assert(/斷鍵吸熱、成鍵放熱/.test(thermoAuditBlock), '熱化學卡缺少鍵能方向規則');
assert(/BORN_HABER:/.test(thermoAuditBlock) && /升華\/原子化、鍵解離、游離、電子親和與晶格形成/.test(thermoAuditBlock), '熱化學卡缺少波恩－哈伯循環');
assert(/q_reaction=-q_surroundings/.test(thermoAuditBlock), '熱化學卡未區分反應與周圍熱量符號');
assert(/同式不同物態不可消去/.test(thermoAuditBlock), '熱化學卡未限制不同物態消去');
assert(!/CARD=熱化學/.test(promptContext.window.buildLocalAuditCardBlock('催化劑如何降低活化能？', '')), '活化能題不應掛熱化學卡');
assert(!/CARD=熱化學/.test(promptContext.window.buildLocalAuditCardBlock('已知 ΔG 與 ΔS，判斷反應是否自發。', '')), '僅自由能熵題不應掛熱化學卡');
assert(!/CARD=熱化學/.test(promptContext.window.buildLocalAuditCardBlock('將 25°C 換成 K。', '')), '單純溫標換算不應掛熱化學卡');
const organicTestStem = '比較烯、苯與酚加入溴水後的反應與現象，能否只憑褪色鑑別？';
const organicTestAuditBlock = promptContext.window.buildLocalAuditCardBlock(organicTestStem, 'TYPE=有機反應；MUST=先辨認官能基與溴水條件，再判現象的證據強度');
assert(/CARD=有機反應與官能基檢驗/.test(organicTestAuditBlock), '有機鑑別題未命中官能基檢驗卡');
assert(/苯環不等同普通C=C/.test(organicTestAuditBlock), '有機卡未區分苯環與烯類雙鍵');
assert(/溴水褪色也可能來自酚/.test(organicTestAuditBlock), '有機卡未限制溴水褪色的證據強度');
assert(/單一陽性現象只支持一類結構或還原性/.test(organicTestAuditBlock), '有機卡未限制單一檢驗的結論');
assert(/carboxylic acid\+HCO3-=>CO2/.test(organicTestAuditBlock), '有機卡未區分羧酸與碳酸氫鹽反應');
const organicAcylStem = '酯與氨在加熱條件下反應，預測產物官能基；另比較油脂皂化後遇硬水的現象。';
const organicAcylAuditBlock = promptContext.window.buildLocalAuditCardBlock(organicAcylStem, 'TYPE=有機反應；MUST=判斷酰基取代條件與水解後產物形式');
assert(/CARD=有機酸衍生物、酸鹼與聚合/.test(organicAcylAuditBlock), '酯與油脂題未命中有機酸衍生物卡');
assert(/酯\+NH3\/amine時副產alcohol/.test(organicAcylAuditBlock), '有機酸衍生物卡未處理酯與氨/胺的酰基取代');
assert(/soap遇Ca2\+\/Mg2\+成難溶鹽/.test(organicAcylAuditBlock), '有機酸衍生物卡未處理肥皂硬水現象');
assert(!/CARD=有機反應與官能基檢驗/.test(promptContext.window.buildLocalAuditCardBlock('畫出 C4H10 的所有結構異構物。', '')), '單純異構物題不應掛有機反應卡');
assert(!/CARD=有機反應與官能基檢驗/.test(promptContext.window.buildLocalAuditCardBlock('由 NMR 與 IR 光譜判讀未知有機物。', '')), '光譜題不應掛高中有機反應卡');
assert(/id="solveValidation"/.test(index), '結果區缺少審題與解題 token 顯示區');
assert(/formatTokenAuditLine/.test(app) && /Token（輸入\/輸出\/合計）/.test(app), '頁面未顯示各階段 token 統計');
assert(/id="questionAnalysisDebug"/.test(index), '結果區缺少審題輸出顯示區');
assert(/renderQuestionAnalysisDebug/.test(app) && /__lastQuestionAnalysisRaw/.test(app), '頁面未顯示審題 memo/raw JSON');
assert(/localAuditCardBlock/.test(app) && /buildSelectedAuditCardBlock/.test(app), '主流程未建立並傳遞選定的短卡');

const solveFlow = app.slice(app.indexOf('async function startSolve()'), app.indexOf('async function sendFollowUp()'));
assert((solveFlow.match(/callAPI\(/g) || []).length === 2, '主解題流程必須固定只有審題與詳解兩次 AI 呼叫');
assert(!/QuestionIngest|ANSWER_VERIFICATION|alignPrompt|ChemistryEnginePipeline|ChemRuleCards/.test(solveFlow), '主解題仍受舊擷取、驗證、對齊、通則卡或解題引擎影響');
assert(!/questionAnalysis\.questionText/.test(solveFlow), '第二段不得以第一段重寫題目取代原題');
assert(/const questionSource = `\$\{textQuestion\}\$\{questionNumberScope\.directive\}`\.trim\(\) \|\| '請以附圖為原題作答。'/.test(solveFlow), '第二段未直接使用使用者文字或原圖作為原題');
assert((solveFlow.match(/temperature: 0\.25/g) || []).length >= 2, '兩階段溫度應一致，避免第一段固定為 0');
assert(/maxOutputTokens: 512/.test(solveFlow) && /timeoutMs: 45000/.test(solveFlow), '審題應限制為短回覆並快速逾時');
assert(/maxOutputTokens: 4096/.test(solveFlow) && /maxItems: 20/.test(fs.readFileSync(path.join(root, 'js', 'solution-core.js'), 'utf8')), '主解題輸出預算應適合單題詳解');
assert(/js\/prompts\.js\?v=20260729-target-checks/.test(index) && /js\/solution-core\.js\?v=20260730-clean-asciimath/.test(index), '審題流程更新後未更新瀏覽器快取版本');
assert(!/question-ingest|chemistry-engine|engine-adapter|engine-catalog|chem-rule-cards/.test(index), '主頁仍載入已略過的通則卡或解題引擎');
assert(/id="questionNumberInput"/.test(index) && /id="refAnswerCheckToggle"/.test(index), '題號與加強核對控制項必須位於主輸入區');
assert(/function getQuestionNumberScope/.test(app) && /【指定題號】只解第/.test(app), '指定題號必須明確傳入解題流程');
assert(!/加強核對參考答案/.test(index), '加強核對不應保留在進階設定');
console.log('ASCII_SOLUTION_RENDER_OK');
