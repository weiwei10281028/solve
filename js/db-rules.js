/**
 * js/db-rules.js - 教學規定（conditional teaching rules）
 * 獨立於題庫風格配對；僅在觸發條件成立時注入 prompt。
 */

let teachingRulesCache = null;
let teachingRulesFileCache = {};
let lastTeachingRuleMatch = null;

/** 內建教學規定（不另建 MD）；觸發條件成立才注入 */
const BUILTIN_TEACHING_RULES = [
  {
    id: 'gas-combustion-water-volume',
    file: 'builtin',
    meta: {
      type: 'teaching_rule',
      label: '氣體反應與水的狀態',
      inject_mode: 'conditional',
      priority: 75,
      trigger_groups: [
        {
          name: 'gas_rxn',
          min: 1,
          patterns: ['燃燒', '完全燃燒', /O[_₂2].{0,8}燃燒/, /燃燒.{0,8}O[_₂2]/]
        },
        {
          name: 'gas_vol',
          min: 1,
          patterns: [/mL|毫升|dm\^?3|升/, 'KOH', '冷卻', '混合氣體', /氣體.{0,16}體積/, /體積.{0,16}氣體/]
        }
      ],
      suppress_if_any: [],
      forbidden_steps: []
    },
    content: [
      '## 何時套用',
      '燃燒或氣體計量題，且題幹涉及反應後氣體體積、冷卻、KOH 吸收 CO₂ 等。',
      '',
      '## 規定',
      '1. **常溫常壓且已冷卻**至原狀況：H₂O 為**液態**，**不計入氣體體積**；選項寫「生成 xx mL H₂O」判**敘述錯誤**。',
      '2. **常溫已冷卻之燃燒氣體題（預設）**：評 (A)「生成 xx mL H₂O」**禁止** $2y$、莫耳換 mL、用 $y$ 驗證 16 mL；**直接**判「H₂O 液態，不能以 mL 計，敘述錯誤」。$x,y$ 只用於 $CO_2$、$O_2$ 等氣體，**勿把 $y$ 帶入 (A)**。',
      '3. **未冷卻、或題目明示高溫／水以蒸氣計**：才可依莫耳數討論水蒸氣體積。',
      '4. **飽和蒸氣壓**：僅題幹要求或明示高溫近沸時才討論；一般燃燒氣體題不必代入。',
      '',
      '## 禁止',
      '禁止已判定液態水可忽略，卻在 (A) 仍寫「$2y=…=8$ mL」再判錯；禁止判「生成 H₂O xx mL」為正確。'
    ].join('\n')
  }
];

function getEmbeddedRules() {
  const emb = typeof EMBEDDED_DATABASE !== 'undefined' ? EMBEDDED_DATABASE : {};
  return emb.rules || {};
}

function compileRulePattern(pat) {
  if (pat instanceof RegExp) return pat;
  const s = String(pat || '').trim();
  if (!s) return null;
  if (s.startsWith('/') && s.lastIndexOf('/') > 0) {
    const m = s.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) return new RegExp(m[1], m[2] || 'i');
  }
  return s;
}

function testRulePattern(pat, input) {
  const p = compileRulePattern(pat);
  if (!p) return false;
  if (p instanceof RegExp) return p.test(input);
  return String(input).includes(p);
}

function ruleFromTeachingMd(raw = '', filename = '') {
  const split = typeof splitFrontmatter === 'function'
    ? splitFrontmatter(raw)
    : { meta: {}, body: String(raw) };
  const meta = split.meta || {};
  const body = String(split.body || '').trim();
  const content = body.replace(/^##\s*教學規定\s*\n?/i, '').trim();
  const id = meta.id || String(filename).replace(/\.md$/i, '');

  const triggerGroups = [];
  if (Array.isArray(meta.trigger_groups) && meta.trigger_groups.length) {
    triggerGroups.push(...meta.trigger_groups);
  } else {
    if (meta.trigger_colligative?.length) {
      triggerGroups.push({ name: 'colligative', min: 1, patterns: meta.trigger_colligative });
    }
    if (meta.trigger_calc?.length) {
      triggerGroups.push({ name: 'calc', min: 1, patterns: meta.trigger_calc });
    }
    if (meta.trigger_dimer?.length) {
      triggerGroups.push({ name: 'dimer', min: 1, patterns: meta.trigger_dimer });
    }
  }

  return {
    id,
    file: filename,
    meta: {
      type: meta.type || 'teaching_rule',
      label: meta.label || id,
      inject_mode: meta.inject_mode || 'conditional',
      priority: Number(meta.priority) || 0,
      match_aliases: meta.match_aliases || [],
      trigger_groups: triggerGroups,
      trigger_any: meta.trigger_any || [],
      suppress_if_any: meta.suppress_if_any || meta.suppress_patterns || [],
      forbidden_steps: meta.forbidden_steps || []
    },
    content
  };
}

async function fetchTeachingRuleIndex() {
  const names = new Set();
  const embedded = getEmbeddedRules();
  for (const fn of Object.keys(embedded)) names.add(fn);

  if (typeof location !== 'undefined' && location.protocol !== 'file:') {
    try {
      const res = await fetch('database/rules/index.json');
      if (res.ok) {
        const idx = await res.json();
        for (const fn of idx.files || []) names.add(fn);
      }
    } catch { /* bundle fallback */ }
  }

  return Array.from(names).filter(fn =>
    fn.endsWith('.md') && !fn.startsWith('_')
  );
}

async function loadTeachingRuleFileContent(filename) {
  if (!filename) return '';
  if (teachingRulesFileCache[filename]) return teachingRulesFileCache[filename];

  const embedded = getEmbeddedRules();
  if (embedded[filename]) {
    teachingRulesFileCache[filename] = embedded[filename];
    return embedded[filename];
  }

  if (typeof location !== 'undefined' && location.protocol !== 'file:') {
    try {
      const res = await fetch(`database/rules/${encodeURIComponent(filename)}`);
      if (res.ok) {
        const text = await res.text();
        teachingRulesFileCache[filename] = text;
        return text;
      }
    } catch { /* ignore */ }
  }
  return '';
}

async function loadTeachingRules() {
  if (teachingRulesCache) return teachingRulesCache;
  const files = await fetchTeachingRuleIndex();
  const rules = BUILTIN_TEACHING_RULES.map(function (r) {
    return {
      id: r.id,
      file: r.file || 'builtin',
      meta: r.meta,
      content: r.content
    };
  });
  for (const fn of files) {
    const raw = await loadTeachingRuleFileContent(fn);
    if (!raw) continue;
    const rule = ruleFromTeachingMd(raw, fn);
    if (rule.meta.type === 'teaching_rule' && rule.content) rules.push(rule);
  }
  rules.sort((a, b) => (b.meta.priority || 0) - (a.meta.priority || 0));
  teachingRulesCache = rules;
  return rules;
}

function evaluateTeachingRule(rule, userInput = '') {
  const input = String(userInput || '').replace(/\s+/g, ' ').trim();
  if (!input || !rule) return { hit: false, reason: 'empty' };

  const aliases = rule.meta.match_aliases || [];
  for (const alias of aliases) {
    if (alias && input.includes(String(alias))) {
      return { hit: true, reason: 'alias', alias: String(alias) };
    }
  }

  const suppress = rule.meta.suppress_if_any || [];
  for (const pat of suppress) {
    if (testRulePattern(pat, input)) {
      return { hit: false, reason: 'suppressed', pattern: String(pat) };
    }
  }

  const groups = rule.meta.trigger_groups || [];
  if (groups.length) {
    for (const g of groups) {
      const patterns = g.patterns || [];
      const min = g.min != null ? Number(g.min) : 1;
      let count = 0;
      for (const pat of patterns) {
        if (testRulePattern(pat, input)) count++;
      }
      if (count < min) {
        return { hit: false, reason: 'group-miss', group: g.name || 'group' };
      }
    }
    return { hit: true, reason: 'groups' };
  }

  const anyList = rule.meta.trigger_any || [];
  for (const pat of anyList) {
    if (testRulePattern(pat, input)) {
      return { hit: true, reason: 'trigger_any', pattern: String(pat) };
    }
  }

  return { hit: false, reason: 'no-match' };
}

async function matchTeachingRules(userInput = '') {
  const rules = await loadTeachingRules();
  const matched = [];
  for (const rule of rules) {
    const ev = evaluateTeachingRule(rule, userInput);
    if (ev.hit) matched.push({ rule, ...ev });
  }
  return matched;
}

function formatTeachingRuleBlock(rule) {
  const label = rule.meta.label || rule.id;
  return `【教學規定｜${label}｜內部依據，勿寫入詳解標題】\n${rule.content.trim()}`;
}

function buildTeachingRulesApplyFooter(matched = []) {
  const ids = matched.map(m => m.rule?.id).filter(Boolean);
  const lines = ['【套用時機】依各段「何時套用」與「方法選擇」判定；未達條件不強套。禁止把本段標題、三法全文或禁止事項複製到詳解正文。'];
  if (ids.includes('colligative-dimer-half-alpha')) {
    lines.push('偶合：須用依數性公式求 $i$、$\\alpha$ 或 $M_{\\text{avg}}$，且為反應物係數 1 之偶合（$i<1$）時，計算須用規定中的反應式與 $i$ 式。');
  }
  if (ids.includes('hybridization-methods')) {
    lines.push('混成：須判斷中心原子混成種類時，詳解每題只呈現所選一法之推導（預設 (a) 法；有機用 (b)；單中心偶數價電子可 (c)）；勿貼三法講義。');
  }
  if (ids.includes('ksp-solubility-table')) {
    lines.push('難溶鹽／Ksp：**僅**題幹須以 $K_{sp}$ 求濃度／溶解度或混合沉澱再溶解時套用；觀念敘述題（何者正確、沸騰汽化等）**不套用**。須寫「反應式如下：」＋含 $\\rightleftharpoons$ 之 array；四列表之中間列寫變化量。');
  }
  if (ids.includes('gas-combustion-water-volume')) {
    lines.push('水的狀態：(A) H₂O mL **禁止計算**（勿寫 $2y$）；直接判錯；$y$ 不可用於驗證 (A)。');
  }
  return lines.join('\n');
}

async function buildTeachingRulesUserBlock(userInput = '', opts = {}) {
  const resolved = await resolveTeachingRulesForSolve(userInput, opts);
  return resolved.userBlock;
}

function buildTeachingRulesSystemAddon(matched = []) {
  if (!matched.length) return '';
  const ids = matched.map(function (m) { return m.rule?.id || m.id; }).filter(Boolean);
  const labels = matched.map(function (m) { return m.rule?.meta?.label || m.label || m.id; }).filter(Boolean);
  return '\n\n【教學規定｜必守】\n'
    + 'User 訊息含 [教學規定]；已觸發：' + labels.join('、') + '（' + ids.join('、') + '）。\n'
    + '詳解與追問須**嚴格遵守**觸發之教學規定；禁止違反、禁止以「計量需要」繞過規定。';
}

async function resolveTeachingRulesForSolve(userInput = '', opts = {}) {
  opts = opts || {};
  let input = String(userInput || '').replace(/\s+/g, ' ').trim();
  const main = String(opts.mainSolution || '').trim();
  if (main) input += '\n' + main.slice(0, 2400);
  if (opts.includeMainSolution && typeof getMainSolution === 'function') {
    const fromDom = String(getMainSolution() || '').trim();
    if (fromDom && !main) input += '\n' + fromDom.slice(0, 2400);
  }

  const matched = await matchTeachingRules(input);
  lastTeachingRuleMatch = matched.map(function (m) {
    return {
      id: m.rule.id,
      label: m.rule.meta.label,
      reason: m.reason,
      alias: m.alias || null
    };
  });

  if (!matched.length) {
    return { userBlock: '', systemAddon: '', matched: [], ids: [] };
  }

  const parts = matched.map(function (m) { return formatTeachingRuleBlock(m.rule); });
  const userBlock = `\n\n[教學規定｜內部依據]\n${parts.join('\n\n')}\n\n${buildTeachingRulesApplyFooter(matched)}`;
  const systemAddon = buildTeachingRulesSystemAddon(matched);
  const ids = matched.map(function (m) { return m.rule.id; });
  return { userBlock, systemAddon, matched, ids };
}

function getTeachingRuleIdsFromLastMatch() {
  return (lastTeachingRuleMatch || []).map(function (r) { return r.id; }).filter(Boolean);
}

window.buildTeachingRulesUserBlock = buildTeachingRulesUserBlock;
window.resolveTeachingRulesForSolve = resolveTeachingRulesForSolve;
window.buildTeachingRulesSystemAddon = buildTeachingRulesSystemAddon;
window.getTeachingRuleIdsFromLastMatch = getTeachingRuleIdsFromLastMatch;
window.matchTeachingRules = matchTeachingRules;

function getLastTeachingRuleMatch() {
  return lastTeachingRuleMatch;
}

function clearTeachingRulesCache() {
  teachingRulesCache = null;
  teachingRulesFileCache = {};
  lastTeachingRuleMatch = null;
}

async function getTeachingRulesStatus() {
  const rules = await loadTeachingRules();
  return {
    loaded: rules.length,
    ids: rules.map(r => r.id),
    labels: rules.map(r => r.meta.label || r.id)
  };
}
