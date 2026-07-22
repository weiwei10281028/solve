/*
 * v2 排版回歸測試：雙通道 compiler（solution-core + compiler.js facade）與 L0 優先權。
 * 執行：node tests/test-compiler.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const Core = require(path.join(ROOT, 'js/solution-core.js'));
const Compiler = require(path.join(ROOT, 'js/compiler.js'));

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* 1. 數學通道：段落內次方式（截圖 x^2）導入數學島並補上標 */
const paraPower = Core.prepare(JSON.stringify({
  blocks: [{ type: 'paragraph', text: '此拋物線可寫為 x^2 = 12y，故開口向上。' }],
  answer: 'A'
})).text;
assert(/\$[^$]*x\^\{2\}/.test(paraPower), `段落次方未進數學島並補上標：${paraPower}`);
assert(!/x\^2(?![{\d}])/.test(paraPower), `段落仍殘留裸次方 x^2：${paraPower}`);

/* 2. 科學記號上標 */
const sci = Core.prepare(JSON.stringify({
  blocks: [{ type: 'paragraph', text: '平衡常數 K_a = 1.8 × 10^-5，屬弱酸。' }],
  answer: 'A'
})).text;
assert(/10\^\{-5\}/.test(sci), `科學記號上標未正規化：${sci}`);

/* 3. 巢狀分式：保留與裸除式轉直式 */
assert(/\\dfrac\{\\dfrac\{a\}\{b\}\}\{c\}/.test(Core.calculation(String.raw`\dfrac{\dfrac{a}{b}}{c}`)), '巢狀分式未保留');
const nestedNum = Core.calculation('(0.5/0.1)/0.2=25');
assert(/\\dfrac\{\\dfrac\{0\.5\}\{0\.1\}\}\{0\.2\}/.test(nestedNum), `巢狀裸除式未轉直式：${nestedNum}`);
assert(!/\d\s*\/\s*\d/.test(nestedNum.replace(/\\dfrac\{[^{}]*\}\{[^{}]*\}/g, '')), `仍殘留橫式除法：${nestedNum}`);

/* 4. 化學通道：純文字化學式轉 mhchem */
const chem = Core.prepare(JSON.stringify({
  blocks: [{ type: 'chemical_equation', text: '2H2 + O2 -> 2H2O' }],
  answer: 'A'
})).text;
assert(/\\ce\{2H2 \+ O2 -> 2H2O\}/.test(chem), `反應式未編譯為 mhchem：${chem}`);

/* 5. compiler.js 雙通道外部入口 */
assert(Compiler.compileDocument({ blocks: [{ type: 'paragraph', text: '甲為 H2SO4。' }], answer: 'A' }).includes('\\ce{H2SO4}'), 'Compiler.chemPass 未轉 mhchem');
assert(/x\^\{2\}/.test(Compiler.mathPass('x^2=12y')), 'Compiler.mathPass 未正規化次方');
assert(Compiler.chemPass('H2SO4').includes('\\ce{H2SO4}'), 'Compiler.chemPass facade 失效');

/* 6. 約束優先：通則卡與章節並列第一順位，須同時滿足 */
const specCtx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/solve-spec.js'), 'utf8'), specCtx);
const Spec = specCtx.window.SolveSpec;
const manual = Spec.route(Spec.create({ chapterIds: ['acidbase'], formatIds: ['calculation'] }), '求濃度', {});
const activeBlock = Spec.buildActiveBlock(manual);
assert(manual.origin === 'manual', '手動勾選未標記 origin=manual');
assert(/解題前必讀/.test(activeBlock), `進階規格未聲明解題前必讀：${activeBlock}`);
assert(/第一順位/.test(activeBlock), `進階規格未聲明第一順位：${activeBlock}`);

const cardsCtx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/chem-rule-cards.js'), 'utf8'), cardsCtx);
const cardsSrc = fs.readFileSync(path.join(ROOT, 'js/chem-rule-cards.js'), 'utf8');
assert(/並存時須同時滿足/.test(cardsSrc), '通則卡未聲明與章節並存須同時滿足');
assert(!/僅作補充參考|不得覆寫章節/.test(cardsSrc), '通則卡仍殘留與章節對立的措辭');

const promptsCtx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/prompts.js'), 'utf8'), promptsCtx);
const assembled = promptsCtx.window.assembleSolveUserContent('題目文字', '【章節區塊】', '【通則卡區塊】');
const idxChem = assembled.fullText.indexOf('【通則卡區塊】');
const idxChapter = assembled.fullText.indexOf('【章節區塊】');
const idxQuestion = assembled.fullText.indexOf('【題目】');
assert(idxChem >= 0 && idxChapter > idxChem && idxQuestion > idxChapter, `user 訊息順序錯誤：${assembled.fullText}`);

/* 7. SYSTEM 層級優先聲明反映並列分工 */
assert(Core.SYSTEM.includes('同時滿足') && Core.SYSTEM.includes('通則卡'), 'SYSTEM 未反映通則卡／章節並列優先');

console.log('COMPILER_V2_OK');
