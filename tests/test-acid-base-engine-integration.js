/**
 * 固定酸鹼題整合測試：模擬第一次 AI JSON → Adapter → solveChemistry。
 * 執行：node tests/test-acid-base-engine-integration.js
 */
import { solveChemistry } from '../chemistry-solving-engine/dist/index.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const adapterSource = require('fs').readFileSync(
  new URL('../js/acid-base-engine-adapter.js', import.meta.url),
  'utf8'
);

globalThis.ChemistryEngine = { solveChemistry };
eval(adapterSource);

const FIXED_QUESTION = '0.10 M 醋酸（CH3COOH）水溶液的 pH 為何？已知 Ka = 1.8×10^-5。';

/** 模擬第一次 AI 對固定題輸出的結構化 JSON */
const FIRST_AI_PARSE = {
  applicable: true,
  engine: 'acid_base',
  operation: 'weak_acid',
  classification: '單一弱酸溶液 pH',
  input: {
    species: 'CH3COOH',
    concentration: 0.1,
    Ka: 1.8e-5,
    volumeL: 1
  },
  options: {
    temperatureC: 25,
    approximationThreshold: 0.05,
    returnAllIntermediates: true
  },
  missingFields: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance = 0.02) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} 與 ${expected} 差距過大`);
}

console.log('=== 酸鹼引擎整合測試 ===');
console.log('固定題目：', FIXED_QUESTION);
console.log('');

const mapped = globalThis.AcidBaseEngineAdapter.toEngineRequest(FIRST_AI_PARSE);
assert(mapped.ok, `Adapter 轉換失敗：${mapped.error?.message}`);
console.log('【傳入引擎的完整 JSON】');
console.log(JSON.stringify(mapped.request, null, 2));
console.log('');

const result = globalThis.AcidBaseEngineAdapter.run(FIRST_AI_PARSE);
assert(result.ok, `引擎執行失敗：${result.error?.message}`);
console.log('【引擎回傳的完整 JSON】');
console.log(JSON.stringify(result.engineResponse, null, 2));
console.log('');

const r = result.engineResponse;
assert(r.success === true, 'success 應為 true');
close(r.result.pH, 2.88);
assert(r.checks.massBalancePassed === true, '質量守恆檢查應通過');
assert(typeof r.intermediates.exactX === 'number', '應含 exactX 中間值');
assert(Array.isArray(r.trace) && r.trace.length > 0, '應含 trace');

console.log('【摘要】');
console.log(`pH = ${r.result.pH}`);
console.log(`[H+] = ${r.result.H}`);
console.log(`exactX = ${r.intermediates.exactX}`);
console.log(`approximationValid = ${r.intermediates.approximationValid}`);
console.log(`method = ${r.method}`);
console.log('');
console.log('固定測試題：成功');

// 錯誤處理：不支援 operation
const badOp = globalThis.AcidBaseEngineAdapter.run({
  applicable: true,
  engine: 'acid_base',
  operation: 'buffer_only_fake',
  input: {}
});
assert(!badOp.ok && badOp.error.code === 'UNSUPPORTED_OPERATION', '應攔截不支援 operation');

// 錯誤處理：引擎輸入不足
const badInput = globalThis.AcidBaseEngineAdapter.run({
  applicable: true,
  engine: 'acid_base',
  operation: 'weak_acid',
  input: { species: 'CH3COOH', concentration: -0.1, Ka: 1.8e-5 }
});
assert(!badInput.ok, '應攔截非法濃度');

console.log('錯誤處理：通過');

// 容錯：第一次 AI 把參數放在頂層
const flatTopLevel = globalThis.AcidBaseEngineAdapter.toEngineRequest({
  applicable: true,
  engine: 'acid_base',
  operation: 'reconstruct_diprotic_equilibrium',
  formalConcentration: 0.24,
  pH: 4.0,
  degreeOfDissociation: 11 / 12,
  ratioHAtoA2: 10
});
assert(flatTopLevel.ok, `頂層參數容錯失敗：${flatTopLevel.error?.message}`);
close(flatTopLevel.request.input.formalConcentration, 0.24);
const flatRun = globalThis.AcidBaseEngineAdapter.run({
  applicable: true,
  engine: 'acid_base',
  operation: 'reconstruct_diprotic_equilibrium',
  formalConcentration: 0.24,
  pH: 4.0,
  degreeOfDissociation: 11 / 12,
  ratioHAtoA2: 10
});
assert(flatRun.ok, `頂層參數引擎執行失敗：${flatRun.error?.message}`);
close(flatRun.engineResponse.result.constants.pKa1, 3.0, 0.05);
console.log('頂層參數容錯：通過');

const repairSource = require('fs').readFileSync(
  new URL('../js/engine-parse-repair.js', import.meta.url),
  'utf8'
);
eval(repairSource);

const H2A_QUESTION = '某二元酸 H2A 水溶液濃度 0.24 M，測得 pH = 4.0，解離度 α = 11/12，且 [HA-]/[A2-] = 10。';
const emptyInputParse = {
  applicable: true,
  engine: 'acid_base',
  operation: 'reconstruct_diprotic_equilibrium',
  input: {}
};
const repaired = globalThis.EngineParseRepair.repairParseResult(emptyInputParse, H2A_QUESTION);
assert(globalThis.EngineParseRepair.isInputSufficient('reconstruct_diprotic_equilibrium', repaired.input), '題幹抽取後 input 應足夠');
const emptyRun = globalThis.AcidBaseEngineAdapter.run(emptyInputParse, { questionText: H2A_QUESTION });
assert(emptyRun.ok, `空 input + 題幹修復失敗：${emptyRun.error?.message}`);
close(emptyRun.engineResponse.result.constants.pKa1, 3.0, 0.05);
console.log('空 input 題幹修復：通過');

const stringInputParse = {
  applicable: true,
  engine: 'acid_base',
  operation: 'reconstruct_diprotic_equilibrium',
  input: {
    formalConcentration: '0.24',
    pH: '4.0',
    degreeOfDissociation: '0.9166667',
    ratioHAtoA2: '10'
  }
};
const stringRun = globalThis.AcidBaseEngineAdapter.run(stringInputParse, { questionText: H2A_QUESTION });
assert(stringRun.ok, `字串 input 轉型失敗：${stringRun.error?.message}`);
close(stringRun.engineResponse.result.constants.pKa1, 3.0, 0.05);
console.log('字串 input 數值化：通過');
