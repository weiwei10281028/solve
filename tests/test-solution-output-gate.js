/* Run with the bundled Node runtime: verifies the output gate independently
 * of the browser UI. */
const fs = require('fs');
const vm = require('vm');

const context = {
  SolutionFormat: {
    format: (text) => ({ text: String(text), report: { ok: true, errors: [] } })
  },
  NoteCheck: {
    check: (text) => ({
      ok: /\\htmlData\{note=/.test(String(text)),
      skipped: false,
      issues: ['未發現 NOTE']
    })
  }
};
vm.runInNewContext(fs.readFileSync('js/solution-output-gate.js', 'utf8'), context);

const invalid = context.SolutionOutputGate.check(
  '反應式：$\\ce{FeO}$，產物 ceCO2。\n@@ANSWER@@A',
  { requireNotes: true }
);
if (invalid.ok || !invalid.issues.some((item) => item.includes('ce 化學式'))) {
  throw new Error('未阻擋 ce 降級文字：' + JSON.stringify(invalid));
}

const malformedCommand = context.SolutionOutputGate.check(
  '反應式：$\\ceFe_xO_y$。\n$\\htmlData{note=氧化物莫耳數（0.0800 mol）}{0.0800}$\n@@ANSWER@@A',
  { requireNotes: false }
);
if (malformedCommand.ok || !malformedCommand.issues.some((item) => item.includes('缺少大括號'))) {
  throw new Error('未阻擋缺少大括號的 mhchem：' + JSON.stringify(malformedCommand));
}

const valid = context.SolutionOutputGate.check(
  '反應式：$\\ce{FeO + CO -> Fe + CO2}$。\n$\\htmlData{note=氧化鐵的莫耳數（0.0800 mol）}{0.0800}$\n@@ANSWER@@A',
  { requireNotes: true }
);
if (!valid.ok) throw new Error('正確 mhchem／NOTE 被誤擋：' + JSON.stringify(valid));
console.log('OUTPUT_GATE_OK');
