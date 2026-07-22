/* 單一 AsciiMath renderer 的靜態介面回歸。 */
const fs = require('fs');
const path = require('path');
const Core = require(path.join(__dirname, '..', 'js', 'solution-core.js'));
const root = path.join(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'js', 'ascii-solution-render.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
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
assert(/function renderDocument/.test(renderer) && /function renderInto/.test(renderer), '新 renderer 入口缺失');
assert(/input\/asciimath/.test(renderer) && /mathjax@4\/startup\.js/.test(renderer), 'MathJax 4 AsciiMath 未設定');
assert(/DISPLAY_RE/.test(renderer) && /am-display-scroll/.test(renderer), '整行公式與橫滑規則缺失');
assert(/am-choice/.test(renderer) && /am-derivation/.test(renderer) && /am-reaction-table/.test(renderer), '既有詳解版面元件缺失');
assert(/AsciiSolutionRender\.renderInto/.test(app) && /setMainSolution\(prepared\.document\)/.test(app), '主詳解未改走新 renderer');
assert(!/js\/render\.js/.test(index) && !/katex\.min\.js/.test(index) && !/formula-tools\.js/.test(index), '舊詳解依賴仍被載入');
assert(/background-image: none/.test(board) && /am-display-scroll mjx-frac mjx-frac/.test(board), '深色網格或分式樣式缺失');
console.log('ASCII_SOLUTION_RENDER_OK');
