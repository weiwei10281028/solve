const fs = require('fs');
const vm = require('vm');

const context = { window: { KnowledgeStore: { asArray: value => Array.isArray(value) ? value : [] } } };
context.window.window = context.window;
vm.runInNewContext(fs.readFileSync('js/knowledge-tools.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('js/reaction-workbench.js', 'utf8'), context);

const tools = context.window.KnowledgeTools;
function expect(condition, label) {
  if (!condition) throw new Error(label);
  console.log(`OK ${label}`);
}

const complete = tools.checkReaction('MnO4^- + 5Fe2+ + 8H+ -> Mn2+ + 5Fe3+ + 4H2O');
expect(complete.ok && complete.left.H === 8 && complete.right.H === 8 && complete.leftCharge === 17, 'validates atoms and charge');

const damaged = tools.checkReaction('MnO4^- + 5Fe2+ + 8^+ -> Mn2+ + 5Fe3+ + 4_2O');
expect(!damaged.ok && /遺失 H/.test(damaged.error || ''), 'rejects a missing element token');

const combustion = tools.balanceReaction('C2H6 + O2 -> CO2 + H2O');
expect(combustion.ok && combustion.reaction === '2C2H6 + 7O2 → 4CO2 + 6H2O', 'balances a molecular equation');

const acidic = tools.balanceRedoxHalfReaction('MnO4^- -> Mn2+', 'acidic');
expect(acidic.ok && acidic.reaction === 'MnO4^- + 8H^+ + 5e^- → Mn^2+ + 4H2O', 'balances an acidic half reaction');

const basic = tools.balanceRedoxHalfReaction('MnO4^- -> Mn2+', 'basic');
expect(basic.ok && basic.reaction === 'MnO4^- + 5e^- + 4H2O → Mn^2+ + 8OH^-', 'balances a basic half reaction');
