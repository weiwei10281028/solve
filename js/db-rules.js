/**
 * js/db-rules.js - 教學規定（conditional teaching rules）
 * 獨立於題庫風格配對；僅在觸發條件成立時注入 prompt。
 */

let teachingRulesCache = null;
let teachingRulesFileCache = {};
let lastTeachingRuleMatch = null;

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
  const rules = [];
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
  return lines.join('\n');
}

async function buildTeachingRulesUserBlock(userInput = '') {
  const matched = await matchTeachingRules(userInput);
  lastTeachingRuleMatch = matched.map(m => ({
    id: m.rule.id,
    label: m.rule.meta.label,
    reason: m.reason,
    alias: m.alias || null
  }));

  if (!matched.length) return '';

  const parts = matched.map(m => formatTeachingRuleBlock(m.rule));
  return `\n\n[教學規定｜內部依據]\n${parts.join('\n\n')}\n\n${buildTeachingRulesApplyFooter(matched)}`;
}

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
