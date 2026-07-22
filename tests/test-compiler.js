/* AsciiMath 輸出契約：JSON 骨架與提示詞仍由 SolutionCore 提供。 */
const path = require('path');
const Core = require(path.join(__dirname, '..', 'js', 'solution-core.js'));

function assert(condition, message) { if (!condition) throw new Error(message); }

const prepared = Core.prepare(JSON.stringify({
  blocks: [
    { type: 'heading', text: '題意' },
    { type: 'chemical_equation', expression: 'Fe_xO_y + y CO -> x Fe + y CO_2' },
    { type: 'calculation', expression: 'n(Fe) = frac(3.92)(56) = 0.07 mol' }
  ],
  answer: 'A'
}));
assert(prepared.ok && prepared.document.blocks.length === 3, 'JSON 文件未正確解析');
assert(Core.buildSystem().includes('直接 AsciiMath'), '提示詞未要求直接 AsciiMath');
assert(Core.buildSystem().includes('Fe_xO_y + y CO -> x Fe + y CO_2'), '提示詞未包含反應式範例');
assert(!Core.buildSystem().includes('不要用反引號包住公式') || Core.buildSystem().includes('frac(分子)(分母)'), 'AsciiMath 分式規則缺失');
console.log('ASCII_COMPILER_CONTRACT_OK');
