
const fs = require('fs');
const Core = require('./js/solution-core.js');
const acid = JSON.parse(fs.readFileSync('tests/fixtures/acid-strength-raw.json','utf8'));
const tit = JSON.parse(fs.readFileSync('tests/fixtures/titration-raw.json','utf8'));
for (const [name, doc] of [['acid', acid], ['titration', tit]]) {
  const prep = Core.prepare(JSON.stringify(doc), { autoNote: false });
  const notes = Core.auditNotes(prep.document);
  const crowd = Core.auditCrowdedCalculations(prep.document);
  console.log(name, 'note issues:', notes.issues.length, notes.issues.slice(0,3));
  console.log(name, 'crowd issues:', crowd.issues.length, crowd.issues.slice(0,3));
  const prep2 = Core.prepare(JSON.stringify(doc), { autoNote: true });
  const hasBroken = /H\\$\d|htmlDatanot|htmlDatanote/i.test(prep2.text);
  const hasFrag = /H\\$\d/.test(prep2.text);
  console.log(name, 'compiled lines with comparison:', prep.text.split('\n').filter(l => '>' in l or '>' in l));
}
