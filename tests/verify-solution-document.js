'use strict';
const fs = require('fs');
const SolutionDocument = require('../js/solution-format.js');
const fixtures = JSON.parse(fs.readFileSync(__dirname + '/fixtures/solution-document.json', 'utf8'));
let ok = true;
for (const name of ['concept_choice', 'dilution', 'three_step_table', 'four_step_table']) {
  const report = SolutionDocument.validate(fixtures[name]);
  const compiled = SolutionDocument.compile(fixtures[name]);
  const pass = report.ok && compiled.ok && compiled.text.includes('@@ANSWER@@');
  console.log(`${pass ? 'PASS' : 'FAIL'}\t${name}\t${report.errors.join('；')}`);
  ok = ok && pass;
}
for (const name of ['invalid_unknown_block', 'invalid_note_coverage', 'invalid_calculation']) {
  const report = SolutionDocument.validate(fixtures[name]);
  const pass = !report.ok;
  console.log(`${pass ? 'PASS' : 'FAIL'}\t${name}\t${report.errors.join('；')}`);
  ok = ok && pass;
}
const table = SolutionDocument.compile(fixtures.three_step_table).text;
const notes = (table.match(/\\htmlData\{/g) || []).length;
const tablePass = notes >= 3 && /\\begin\{array\}/.test(table);
console.log(`${tablePass ? 'PASS' : 'FAIL'}\tcompiler_table_notes\t${notes}`);
process.exit(ok && tablePass ? 0 : 1);
