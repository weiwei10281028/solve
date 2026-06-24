/* 題庫 meta：本地抽取、配對、分級（不額外 call API） */

const METHOD_RULES = [
  {
    id: 'electrolysis-parallel',
    label: '電解並聯',
    patterns: [/電解/, /並聯/, /匯流/, /電極/, /電量/, /Q\s*=/, /96500/, /法拉第/],
    topicHints: [/電解/, /並聯/, /氧化還原/]
  },
  {
    id: 'weak-acid-multi',
    label: '弱酸多步解離',
    patterns: [/弱酸/, /解離度/, /pK/, /pH/, /H_2A/, /H2A/, /HA\^\-/, /兩步/, /二質子/],
    topicHints: [/弱酸/, /解離/, /酸鹼/]
  },
  {
    id: 'equilibrium-table',
    label: '化學平衡表',
    patterns: [/平衡/, /K_p/, /K_c/, /Ksp/, /勒沙特列/, /\\alpha/, /解離度/, /\\rightleftharpoons/],
    topicHints: [/平衡/, /分壓/, /平均分子量/]
  },
  {
    id: 'reaction-stoichiometry',
    label: '反應計量',
    patterns: [/限量/, /莫耳/, /產率/, /反應計量/, /\\rightarrow/],
    topicHints: [/計量/, /限量/, /產率/]
  },
  {
    id: 'general-exam',
    label: '段考混合題',
    patterns: [/段考/, /第一次/, /定期考/],
    topicHints: [/段考/]
  },
  {
    id: 'general-chem',
    label: '一般化學',
    patterns: [],
    topicHints: []
  }
];

const CONCEPT_TAG_RULES = [
  { tag: '弱酸', patterns: [/弱酸/, /weak acid/i] },
  { tag: '二質子', patterns: [/二質子/, /H_2A/, /H2A/, /H_\{2\}A/] },
  { tag: 'H2A', patterns: [/H_2A/, /H2A/, /H_\{2\}A/] },
  { tag: '酸鹼中和背景', patterns: [/酸鹼中和/, /中和背景/, /並非酸自身解離/] },
  { tag: '電解', patterns: [/電解/, /電極/, /電解槽/] },
  { tag: '並聯', patterns: [/並聯/, /匯流/] },
  { tag: '氧化還原', patterns: [/氧化還原/, /e\^\-/, /電子/] },
  { tag: '平衡', patterns: [/平衡/, /\\rightleftharpoons/, /K_p/, /K_c/] },
  { tag: '解離度', patterns: [/解離度/, /\\alpha/] },
  { tag: '氣體體積比', patterns: [/同溫同壓/, /mL/, /體積比/, /亞佛加厥/, /氣體化合/] },
  { tag: '同溫同壓', patterns: [/同溫同壓/] }
];

const TIER1_SCORE = 55;
const TIER2_SCORE = 18;

function stripMdComments(text = '') {
  return String(text).replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripLatex(text = '') {
  return String(text).replace(/\$[^$]+\$/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 只取題幹（排除 (A)～(E) 選項列，避免選項數字污染指紋） */
function extractQuestionStem(questionMd = '') {
  const raw = String(questionMd).replace(/<!--[\s\S]*?-->/g, '');
  const lines = raw.split('\n');
  const stem = [];
  for (const line of lines) {
    if (/^\s*\([A-E]\)/.test(line.trim())) break;
    stem.push(line);
  }
  return stem.join('\n').trim() || raw;
}

function extractQuestionNumbers(questionMd = '') {
  const text = stripMdComments(questionMd);
  const nums = new Set();
  for (const m of text.matchAll(/(?:^|\n)\s*(\d{1,2})\.\s/mg)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 99) nums.add(n);
  }
  for (const m of text.matchAll(/第\s*(\d{1,2})\s*題/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 99) nums.add(n);
  }
  for (const m of text.matchAll(/^\s*\((\d{1,2})\)/mg)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 99) nums.add(n);
  }
  return Array.from(nums).sort((a, b) => a - b);
}

function extractFingerprint(questionMd = '') {
  const text = extractQuestionStem(questionMd);
  const fp = [];
  const add = v => {
    const s = String(v || '').trim();
    if (s && !fp.includes(s)) fp.push(s);
  };

  for (const m of text.matchAll(/pH[^0-9]{0,16}([\d.]+)/gi)) add(`pH${m[1]}`);
  for (const m of text.matchAll(/([\d.]+)\s*M\b/g)) add(`${m[1]}M`);
  for (const m of text.matchAll(/([\d.]+)\\text\{\s*M\s*\}/g)) add(`${m[1]}M`);
  for (const m of text.matchAll(/([\d.]+)\s*atm\b/gi)) add(`${m[1]}atm`);
  for (const m of text.matchAll(/(\d+)\s*\\text\{\s*mL\s*\}/gi)) add(`${m[1]}mL`);
  for (const m of text.matchAll(/(\d+)\s*mL\b/gi)) add(`${m[1]}mL`);
  for (const m of text.matchAll(/(\d+)\s*\\text\{\s*g\s*\}/g)) add(`${m[1]}g`);
  if (/同溫同壓/.test(text)) add('同溫同壓');
  if (/[甲乙丙].*[甲乙丙]|[甲乙丙]三種/.test(text)) add('甲乙丙');
  if (/A_2|A2|A_\{2\}/.test(text)) add('A2');
  if (/亞佛加厥|氣體化合體積/.test(text)) add('氣體體積比');
  for (const m of text.matchAll(/解離度[\s\S]{0,60}?\\dfrac\{(\d+)\}\{(\d+)\}/g)) add(`α${m[1]}/${m[2]}`);
  for (const m of text.matchAll(/解離度[\s\S]{0,30}?(\d+)\s*\/\s*(\d+)/g)) add(`α${m[1]}/${m[2]}`);
  for (const m of text.matchAll(/\]\s*\/\s*\[[^\]]+\]\s*=\s*(\d+(?:\.\d+)?)/g)) add(`比${m[1]}`);
  if (/二質子/.test(text)) add('二質子');
  if (/弱酸/.test(text)) add('弱酸');
  if (/H_2A|H2A|H_\{2\}A/.test(text)) add('H2A');
  if (/HA\^\-|HA\-/.test(text) && /A\^\{2\-\}|A2\-/.test(text)) add('HA-/A2-');

  return fp.filter(f => !/^Q\d+$/.test(f)).slice(0, 16);
}

function extractStemPhraseKeywords(questionMd = '') {
  const stem = stripLatex(extractQuestionStem(questionMd));
  const raw = String(questionMd);
  const kw = new Set();
  const phrases = [
    '重量百分', '重量百分比', '等重', '倍比定律', '倍比', '莫耳分率', '分子量',
    '同溫同壓', '氣體化合', '亞佛加厥', '化合體積', '甲乙丙', '三相點',
    '酯類', '混合物', '弱酸', '解離度', '電解', '並聯', '平衡常數',
    '道耳頓', '實驗式', '分子式', '示性式', '熱重分析', '草酸鈣', '過錳酸'
  ];
  for (const p of phrases) {
    if (stem.includes(p)) kw.add(p);
  }
  if (/MA[_\\{]?3|MA₃/.test(raw)) kw.add('MA3');
  if (/MA\\?_3.*MA[^_0-9]|兩種化合物.*MA/.test(raw)) kw.add('MA');
  if (/150\s*[xX]|50\s*\+\s*[xXyY]/.test(raw)) kw.add('150x');
  if (/x\s*%.*y\s*%|x%.*y%/.test(stem + raw)) kw.add('x%y%');
  if (/53\.2/.test(raw)) kw.add('53.2%');
  if (/乙酸乙酯|甲酸戊酯/.test(stem)) kw.add('酯類混合物');
  return Array.from(kw);
}

function extractMatchKeywords(questionMd = '', fingerprint = [], conceptTags = []) {
  const raw = String(questionMd);
  const kw = new Set([...fingerprint, ...conceptTags, ...extractStemPhraseKeywords(questionMd)]);
  const matchComment = raw.match(/<!--\s*MATCH:\s*([\s\S]+?)-->/i);
  if (matchComment) {
    for (const part of matchComment[1].split(/[,，、]/)) {
      const s = part.trim();
      if (s) kw.add(s);
    }
  }
  const stem = extractQuestionStem(questionMd);
  for (const w of ['二質子弱酸', '二質子', '弱酸', '解離度', '酸鹼中和', '電解', '並聯', '平衡', '氧化還原', '同溫同壓', '亞佛加厥', '氣體化合體積', '甲乙丙', '限量試劑']) {
    if (stem.includes(w)) kw.add(w);
  }
  if (/H_2A|H2A/.test(stem)) kw.add('H2A');
  return Array.from(kw).slice(0, 20);
}

function getCoreFingerprints(meta = {}) {
  const fp = meta.fingerprint || [];
  return fp.filter(f => !/^Q\d+$/i.test(f));
}

function extractConceptTags(topic = '', questionMd = '', solutionMd = '') {
  const combined = `${topic}\n${extractQuestionStem(questionMd)}\n${stripMdComments(solutionMd)}`;
  const tags = new Set();
  for (const rule of CONCEPT_TAG_RULES) {
    if (rule.patterns.some(p => p.test(combined))) tags.add(rule.tag);
  }
  for (const part of String(topic).split(/\s+/)) {
    if (part.length >= 2) tags.add(part);
  }
  return Array.from(tags).slice(0, 8);
}

function extractCriticalJudgment(solutionMd = '') {
  const raw = String(solutionMd);
  const criticalComment = raw.match(/<!--\s*CRITICAL:\s*([\s\S]+?)-->/i);
  if (criticalComment) return criticalComment[1].trim();

  for (const line of raw.split('\n')) {
    const t = stripLatex(line).trim();
    if (!t || t.length > 150) continue;
    if (/並非酸自身解離|酸鹼中和|可知此時|禁止用.*0\.22|恆定.*10/.test(t)) {
      return t.slice(0, 140);
    }
  }
  return '';
}

function extractForbiddenSteps(solutionMd = '', methodId = '') {
  const forbidden = [];
  const raw = String(solutionMd);
  if (/並非酸自身解離|酸鹼中和/.test(raw)) {
    forbidden.push('禁止把解離產生的 0.22 當平衡 [H⁺]');
    forbidden.push('禁止僅做一步弱酸解離');
  }
  if (/10\^{-4}.*恆定|恆定.*10\^{-4}/.test(raw)) {
    forbidden.push('平衡列 [H⁺] 須為 10⁻⁴（恆定），變化列 H⁺ 欄寫 —');
  }
  const card = getMethodDef(methodId);
  if (methodId === 'electrolysis-parallel') {
    forbidden.push('並聯時禁止假設各槽 Q 相同');
  }
  return [...new Set(forbidden)].slice(0, 4);
}

function extractAnswerKey(solutionMd = '') {
  const parts = [];
  for (const m of String(solutionMd).matchAll(/\*\*答[：:]\s*([^*\n]+)\*\*/g)) {
    parts.push(m[1].trim());
  }
  return parts.join(' | ');
}

function extractPitfalls(solutionMd = '', methodId = '') {
  const pitfalls = [];
  for (const line of String(solutionMd).split('\n')) {
    const t = stripLatex(line).trim();
    if (!t || t.length > 120) continue;
    if (/可知|並非|不是|勿|不可|禁止|非.*解離|中和|恆定|錯誤/.test(t)) {
      pitfalls.push(t.slice(0, 100));
    }
  }
  const card = getMethodDef(methodId);
  for (const p of (card?.pitfalls || [])) {
    if (!pitfalls.includes(p)) pitfalls.push(p);
  }
  return pitfalls.slice(0, 5);
}

function guessMethodId({ topic = '', questionMd = '', solutionMd = '', manualId = '' } = {}) {
  if (manualId && manualId !== 'auto') return manualId;
  const combined = `${topic}\n${questionMd}\n${solutionMd}`;
  let best = { id: 'general-chem', score: 0 };
  for (const rule of METHOD_RULES) {
    if (rule.id === 'general-chem') continue;
    let score = 0;
    for (const p of rule.patterns) if (p.test(combined)) score += 2;
    for (const p of rule.topicHints) if (p.test(topic)) score += 4;
    if (score > best.score) best = { id: rule.id, score };
  }
  return best.id;
}

function buildEntryMeta({
  id = '',
  topic = '',
  qLabel = '',
  questionMd = '',
  solutionMd = '',
  methodIdOverride = '',
  solutionOnly = false
} = {}) {
  const method_id = guessMethodId({
    topic: `${topic} ${qLabel}`.trim(),
    questionMd,
    solutionMd,
    manualId: methodIdOverride
  });
  const critical_judgment = extractCriticalJudgment(solutionMd);
  const fpSource = solutionOnly || !String(questionMd || '').trim()
    ? solutionMd
    : `${questionMd}\n${solutionMd}`;
  const fingerprint = extractFingerprint(fpSource);
  const concept_tags = extractConceptTags(topic, questionMd, solutionMd);
  const match_keywords = extractMatchKeywords(
    solutionOnly ? solutionMd : `${questionMd}\n${solutionMd}`,
    fingerprint,
    concept_tags
  );
  return {
    method_id,
    fingerprint,
    core_fingerprints: fingerprint.filter(f => !/^Q\d+$/i.test(f)),
    concept_tags,
    match_keywords,
    q_numbers: solutionOnly ? [] : extractQuestionNumbers(questionMd),
    answer_key: extractAnswerKey(solutionMd),
    critical_judgment,
    forbidden_steps: extractForbiddenSteps(solutionMd, method_id),
    pitfalls: extractPitfalls(solutionMd, method_id),
    solution_only: !!solutionOnly
  };
}

function getMethodDef(methodId) {
  if (typeof EMBEDDED_DATABASE !== 'undefined' && EMBEDDED_DATABASE.methods?.[methodId]) {
    return EMBEDDED_DATABASE.methods[methodId];
  }
  return METHOD_RULES.find(r => r.id === methodId) || null;
}

function parseUserDbHints(userInput = '') {
  const raw = String(userInput || '').trim();
  const hints = { ids: [], tokens: [], tags: [] };
  for (const m of raw.matchAll(/(?:db|style)-[a-z0-9-]+/gi)) hints.ids.push(m[0].toLowerCase());
  for (const m of raw.matchAll(/KSHS-[a-z0-9()-]+/gi)) hints.ids.push(m[0]);
  for (const m of raw.matchAll(/([\d.]+)\s*M\b/gi)) hints.tokens.push(`${m[1]}M`);
  for (const m of raw.matchAll(/(\d+)\s*mL/gi)) hints.tokens.push(`${m[1]}mL`);
  for (const m of raw.matchAll(/pH\s*([\d.]+)/gi)) hints.tokens.push(`pH${m[1]}`);
  for (const m of raw.matchAll(/(?:α|alpha|解離度)?\s*(\d+)\s*\/\s*(\d+)/gi)) {
    hints.tokens.push(`α${m[1]}/${m[2]}`);
  }
  for (const m of raw.matchAll(/比\s*(\d+)/g)) hints.tokens.push(`比${m[1]}`);
  for (const tag of ['弱酸', '電解', '並聯', '平衡', '二質子', '二質子弱酸', 'H2A', '酸鹼中和', '同溫同壓', '氣體', '亞佛加厥', '化合體積', '甲乙丙', '莫耳', '限量', '倍比', '重量百分', 'MA3', 'MA', '酯類']) {
    if (raw.includes(tag)) hints.tags.push(tag);
  }
  if (/MA[_\\]?3|MA₃/i.test(raw)) hints.tokens.push('MA3');
  if (/\bMA\b|MA化合物/i.test(raw)) hints.tokens.push('MA');
  if (/重量百分|重量百分比/.test(raw)) hints.tokens.push('重量百分');
  if (/等重/.test(raw)) hints.tokens.push('等重');
  if (/倍比/.test(raw)) hints.tokens.push('倍比');
  for (const m of raw.matchAll(/([\d.]+)\s*\/\s*([\d.]+)/g)) {
    if (Number(m[2]) <= 20) hints.tokens.push(`α${m[1]}/${m[2]}`);
  }
  hints.ids = [...new Set(hints.ids)];
  hints.tokens = [...new Set(hints.tokens)];
  hints.tags = [...new Set(hints.tags)];
  return hints;
}

function fingerprintMatch(fp, tok) {
  if (!fp || !tok) return false;
  const a = String(fp).toLowerCase();
  const b = String(tok).toLowerCase();
  return a === b || a.includes(b) || b.includes(a.replace(/^q/, ''));
}

function countKeywordHits(meta, hints, userInput = '') {
  const core = getCoreFingerprints(meta);
  const keywords = meta.match_keywords || [...core, ...(meta.concept_tags || [])];
  let fpHits = 0;
  let kwHits = 0;
  let tagHits = 0;

  for (const tok of hints.tokens) {
    if (core.some(fp => fingerprintMatch(fp, tok))) fpHits++;
  }
  for (const tag of hints.tags) {
    if ((meta.concept_tags || []).some(t => t.includes(tag) || tag.includes(t))) tagHits++;
  }
  const raw = String(userInput).toLowerCase();
  for (const kw of keywords) {
    const k = String(kw).toLowerCase();
    if (k.length >= 2 && raw.includes(k)) kwHits++;
  }
  return { fpHits, kwHits, tagHits };
}

function splitExamIntoQuestions(questionMd = '') {
  const clean = String(questionMd).replace(/<!--[\s\S]*?-->/g, '\n');
  const matches = [...clean.matchAll(/(?:^|\n)(\d{1,2})\.\s/g)];
  const items = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const num = Number(m[1]);
    if (!Number.isFinite(num) || num < 1 || num > 99) continue;
    const start = m.index + (m[0].startsWith('\n') ? 1 : 0);
    const next = matches[i + 1];
    const end = next ? next.index + (next[0].startsWith('\n') ? 1 : 0) : clean.length;
    const text = clean.slice(start, end).trim();
    if (text.length > 24) items.push({ number: num, text });
  }
  return items;
}

function sampleExamFingerprints(questionText = '', maxItems = 6) {
  return splitExamIntoQuestions(questionText)
    .slice(0, maxItems)
    .map(q => {
      const fp = extractFingerprint(q.text);
      return fp.slice(0, 4).join('/') || `Q${q.number}`;
    })
    .filter(Boolean)
    .join('|');
}

function scoreQuestionKeywords(meta, userInput = '') {
  const hints = parseUserDbHints(userInput);
  const core = getCoreFingerprints(meta);
  const keywords = meta.match_keywords || [...core, ...(meta.concept_tags || [])];
  let score = 0;
  let fpHits = 0;
  let kwHits = 0;
  let tagHits = 0;
  const reasons = [];
  const raw = String(userInput).toLowerCase();
  const hitKw = new Set();

  for (const fp of core) {
    const fpl = String(fp).toLowerCase();
    const tokenHit = hints.tokens.some(t => fingerprintMatch(fp, t));
    const textHit = fpl.length >= 2 && raw.includes(fpl);
    if (tokenHit || textHit) {
      fpHits++;
      score += 22;
      reasons.push(`指紋:${fp}`);
    }
  }
  for (const kw of keywords) {
    const k = String(kw).toLowerCase();
    if (k.length < 2 || hitKw.has(k)) continue;
    if (raw.includes(k)) {
      kwHits++;
      hitKw.add(k);
      score += 12;
      reasons.push(`關鍵:${kw}`);
    }
  }
  for (const tag of hints.tags) {
    const inConcept = (meta.concept_tags || []).some(t => t.includes(tag) || tag.includes(t));
    const inKw = keywords.some(k => String(k).includes(tag) || tag.includes(String(k)));
    if (inConcept || inKw) {
      tagHits++;
      score += 14;
      reasons.push(`概念:${tag}`);
    }
  }

  const strong = fpHits >= 2 || (fpHits >= 1 && kwHits >= 2) || (fpHits >= 1 && tagHits >= 1 && kwHits >= 1);
  if (strong) {
    score = Math.max(score, TIER1_SCORE);
    reasons.push('關鍵字吻合');
  }
  return { score, fpHits, kwHits, tagHits, reasons };
}

function splitSolutionIntoSections(solutionMd = '') {
  const clean = String(solutionMd || '').replace(/<!--[\s\S]*?-->/g, '\n');
  const re = /(?:^|\n)((?:#{1,3}\s*)?(?:第\s*\d+\s*題|類題\s*[\d.\-]+)[^\n]*)/g;
  const heads = [...clean.matchAll(re)];
  if (!heads.length) {
    const text = clean.trim();
    return text ? [{ title: '詳解', text }] : [];
  }
  const items = [];
  for (let i = 0; i < heads.length; i++) {
    const m = heads[i];
    const start = m.index + (m[0].startsWith('\n') ? 1 : 0);
    const next = heads[i + 1];
    const end = next ? next.index + (next[0].startsWith('\n') ? 1 : 0) : clean.length;
    const block = clean.slice(start, end).trim();
    const title = (m[1] || m[0]).replace(/^#{1,3}\s*/, '').trim();
    if (block) items.push({ title, text: block });
  }
  return items;
}

function findBestSolutionSectionMatch(entry, solutionText, userInput) {
  if (!userInput?.trim() || !solutionText) return null;
  if (!entry._solutionSectionCache || entry._solutionSectionCacheSrc !== solutionText) {
    entry._solutionSectionCache = splitSolutionIntoSections(solutionText);
    entry._solutionSectionCacheSrc = solutionText;
  }
  const sections = entry._solutionSectionCache;
  if (!sections.length) return null;

  let best = null;
  for (const sec of sections) {
    const fp = extractFingerprint(sec.text);
    const tags = extractConceptTags(entry?.topic || '', '', sec.text);
    const meta = {
      fingerprint: fp,
      core_fingerprints: fp,
      match_keywords: extractMatchKeywords(sec.text, fp, tags),
      concept_tags: tags
    };
    const result = scoreQuestionKeywords(meta, userInput);
    if (!best || result.score > best.score) {
      best = { ...result, sectionTitle: sec.title, solutionText: sec.text, meta };
    }
  }
  if (!best) return null;
  const ok = best.score >= TIER2_SCORE && (best.fpHits >= 1 || best.kwHits >= 2);
  if (!ok) return null;
  return best;
}

function findBestExamQuestionMatch(entry, questionText, solutionText, userInput) {
  if (!userInput?.trim() || !questionText) return null;
  if (!entry._examQuestionCache || entry._examQuestionCacheSrc !== questionText) {
    entry._examQuestionCache = splitExamIntoQuestions(questionText);
    entry._examQuestionCacheSrc = questionText;
  }
  const questions = entry._examQuestionCache;
  if (!questions.length) return null;

  let best = null;
  for (const q of questions) {
    const fp = extractFingerprint(q.text);
    const tags = extractConceptTags(entry?.topic || '', q.text, '');
    const meta = {
      fingerprint: fp,
      core_fingerprints: fp,
      match_keywords: extractMatchKeywords(q.text, fp, tags),
      concept_tags: tags
    };
    const result = scoreQuestionKeywords(meta, userInput);
    if (!best || result.score > best.score) {
      best = { ...result, number: q.number, questionText: q.text, meta };
    }
  }
  if (!best) return null;
  const ok = best.score >= TIER2_SCORE && (best.fpHits >= 1 || best.kwHits >= 2);
  if (!ok) return null;

  const solSlice = extractSolutionForQuestions(solutionText, [best.number]);
  if (!solSlice) return null;
  return { ...best, solutionText: solSlice };
}

function scoreEntry(entry, userInput = '') {
  const meta = entry.meta || {};

  if (meta.solution_only && entry.solutionText && userInput?.trim()) {
    const hit = findBestSolutionSectionMatch(entry, entry.solutionText, userInput);
    if (hit) {
      return {
        score: hit.score,
        reasons: [...hit.reasons, '純詳解段落配對'],
        fpHits: hit.fpHits,
        kwHits: hit.kwHits,
        tagHits: hit.tagHits,
        solutionOnlyHit: hit
      };
    }
    const hints = parseUserDbHints(userInput);
    const whole = scoreQuestionKeywords(meta, userInput);
    let score = whole.score;
    const reasons = [...whole.reasons, '純詳解整筆'];
    if (entry.topic && userInput) {
      for (const part of entry.topic.split(/\s+/)) {
        if (part.length >= 2 && userInput.includes(part)) {
          score += 6;
          reasons.push(`topic:${part}`);
        }
      }
    }
    if (entry.match_alias && userInput.includes(entry.match_alias)) {
      score += 50;
      reasons.push(`alias:${entry.match_alias}`);
    }
    return {
      score,
      reasons,
      fpHits: whole.fpHits,
      kwHits: whole.kwHits,
      tagHits: whole.tagHits
    };
  }

  if (meta.catalog_only && entry.questionText && userInput?.trim()) {
    const hit = findBestExamQuestionMatch(
      entry,
      entry.questionText,
      entry.solutionText || '',
      userInput
    );
    if (hit) {
      return {
        score: hit.score,
        reasons: [...hit.reasons, '卷內關鍵字比對'],
        fpHits: hit.fpHits,
        kwHits: hit.kwHits,
        tagHits: hit.tagHits,
        examHit: hit
      };
    }
    return { score: 0, reasons: ['段考卷：關鍵字未吻合'], fpHits: 0, kwHits: 0, tagHits: 0 };
  }

  const hints = parseUserDbHints(userInput);
  let score = 0;
  const reasons = [];

  const entryId = (entry.id || entry.file || '').toLowerCase();
  for (const id of hints.ids) {
    if (entryId.includes(id.toLowerCase()) || id.toLowerCase() === entryId) {
      score += 100;
      reasons.push(`id:${entry.id || entry.file}`);
    }
  }
  if (userInput && entry.id && userInput.includes(entry.id)) {
    score += 80;
    reasons.push('id文字');
  }

  if (entry.match_alias && userInput && userInput.includes(entry.match_alias)) {
    score += 70;
    reasons.push(`alias:${entry.match_alias}`);
  }
  if (entry.match_alias === '雄中113' && /高雄|雄中|KSHS/i.test(userInput) && /113/.test(userInput)) {
    score += 70;
    reasons.push('alias:雄中113');
  }
  if (meta.catalog_only && /高雄|雄中|KSHS/i.test(userInput) && /113/.test(userInput)) {
    if (/khsh|113/i.test(entryId)) {
      score += 40;
      reasons.push('段考:雄中113');
    }
  }

  const { fpHits, kwHits, tagHits } = countKeywordHits(meta, hints, userInput);
  score += fpHits * 22;
  score += kwHits * 12;
  score += tagHits * 14;
  if (fpHits) reasons.push(`指紋×${fpHits}`);
  if (kwHits) reasons.push(`關鍵字×${kwHits}`);
  if (tagHits) reasons.push(`概念×${tagHits}`);

  if (entry.topic && userInput) {
    for (const part of entry.topic.split(/\s+/)) {
      if (part.length >= 2 && userInput.includes(part)) {
        score += 6;
        reasons.push(`topic:${part}`);
      }
    }
  }

  const coreCount = getCoreFingerprints(meta).length;
  const strongMatch = fpHits >= 3 || (fpHits >= 2 && tagHits >= 1) || (fpHits >= 2 && kwHits >= 2);
  if (strongMatch && coreCount >= 2) {
    score = Math.max(score, TIER1_SCORE);
    reasons.push('核心指紋吻合');
  }

  return { score, reasons, fpHits, kwHits, tagHits };
}

function extractSolutionForQuestions(solutionMd = '', numbers = []) {
  if (!numbers.length || !solutionMd) return '';
  const parts = [];
  for (const n of numbers) {
    let block = '';
    const h3 = new RegExp(`###\\s*${n}\\.[^#]*`, 'g');
    const m1 = solutionMd.match(h3);
    if (m1?.[0]) block = m1[0].trim();
    if (!block) {
      const plain = new RegExp(`(?:^|\\n)${n}\\.[^\\n]*(?:\\n(?!\\d+\\.|#{1,3}\\s|<!--)[^\\n]*)*`, 'g');
      const m2 = solutionMd.match(plain);
      if (m2?.[0]) block = m2[0].trim();
    }
    if (block) parts.push(block);
  }
  return parts.join('\n\n');
}

function extractQuestionForQuestions(questionMd = '', numbers = []) {
  if (!numbers.length || !questionMd) return '';
  const parts = [];
  for (const n of numbers) {
    const re = new RegExp(`(?:^|\\n)${n}\\.[^\\n]*(?:\\n(?!\\d+\\.|#{1,3}\\s|<!--)[^\\n]*)*`, 'g');
    const m = questionMd.match(re);
    if (m?.[0]) parts.push(m[0].trim());
  }
  return parts.join('\n\n');
}

function buildCatalogIndex(examples = [], maxItems = 40) {
  const lines = [
    '【資料庫索引｜以題幹條件比對，不用題號】',
    '讀圖後若某筆「核心指紋」全部出現在圖中，必須採該筆權威詳解，禁止自行改路徑。',
    '標有「純詳解」者無題幹，依詳解內條件與 MATCH 關鍵字配對。'
  ];
  for (const ex of examples.slice(0, maxItems)) {
    const meta = ex.meta || {};
    const core = getCoreFingerprints(meta).join(',') || '—';
    const kw = (meta.match_keywords || []).slice(0, 8).join(',') || '—';
    const crit = (meta.critical_judgment || '').slice(0, 50);
    const label = ex.topic || ex.subject || '化學';
    const kind = meta.solution_only ? '純詳解' : (meta.catalog_only ? '段考' : '題庫');
    lines.push(`- ${ex.id || ex.file}｜${kind}｜${label}｜核心:${core}｜關鍵:${kw}${crit ? `｜⚠${crit}` : ''}`);
  }
  return lines.join('\n');
}

function buildDbMatchUserAddon(matchInfo = {}) {
  if (!matchInfo || !matchInfo.tier) return '';
  if (matchInfo.tier === 1) {
    const hint = matchInfo.solutionOnly
      ? '以上為純詳解範例命中；數字依學生題目圖驗算，步驟與排版須一致。'
      : '必須完全依 system 內「權威參考詳解」的方法與步驟，禁止改用純弱酸解離或其他路徑。第一行先寫關鍵判斷。';
    return `\n\n【資料庫已命中：${matchInfo.entryId}】${hint}`;
  }
  if (matchInfo.tier === 2) {
    return `\n\n【資料庫同型命中：${matchInfo.entryId}】須依 system 內同型方法卡與關鍵判斷解題。`;
  }
  return `\n\n【讀圖對照資料庫】比對索引中的「核心指紋」（濃度、pH、解離度、比例、物種）。若與某筆全部吻合，必須採該筆詳解方法，不可忽略。`;
}

function formatMethodBlock(methodId, excerpt = '', entryMeta = {}) {
  const card = getMethodDef(methodId);
  if (!card) return '';
  const steps = (card.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
  const pitfalls = (card.pitfalls || []).map(p => `- ${p}`).join('\n');
  let block = `【同型題方法｜${card.label || methodId}】`;
  if (entryMeta.critical_judgment) {
    block += `\n\n【關鍵判斷】\n${entryMeta.critical_judgment}`;
  }
  block += `\n\n固定步驟：\n${steps}`;
  if (pitfalls) block += `\n\n常見誤判（禁止）：\n${pitfalls}`;
  if (Array.isArray(entryMeta.forbidden_steps) && entryMeta.forbidden_steps.length) {
    block += `\n\n【禁止步驟】\n${entryMeta.forbidden_steps.map(s => `- ${s}`).join('\n')}`;
  }
  if (excerpt) {
    block += `\n\n【同型短範例｜排版與推理順序參考，數字依新題】\n${excerpt}`;
  }
  return block;
}

function buildTier1Block(entry, questionText, solutionText) {
  const meta = entry.meta || {};
  const label = [entry.qLabel, entry.topic, entry.id].filter(Boolean).join('｜');
  const lines = [`【權威參考詳解｜資料庫命中：${label}】`];

  if (meta.critical_judgment) {
    lines.push(`\n【本題關鍵判斷｜違反即錯】\n${meta.critical_judgment}`);
  }
  if (Array.isArray(meta.forbidden_steps) && meta.forbidden_steps.length) {
    lines.push(`\n【禁止】\n${meta.forbidden_steps.map(s => `- ${s}`).join('\n')}`);
  }
  if (meta.answer_key) {
    lines.push(`\n【標準答案】${meta.answer_key}（結論須一致）`);
  }

  lines.push(`
硬性規定：
1. 輸出第一行須先寫關鍵判斷一句（與上方相同意涵），再寫反應表。
2. 解題方法、步驟順序必須與參考詳解一致，禁止改用純弱酸解離或其他路徑。
3. 數字依圖片驗算；選項判定須與標準答案一致。
4. 可調整排版與 $\\htmlData{note=…}{…}$ 註解，不可省略兩步解離表。

【參考題目】
${questionText || '（無）'}

【參考詳解｜方法不可更改】
${solutionText || '（無）'}`);

  return lines.join('');
}

function resolveTier(score) {
  if (score >= TIER1_SCORE) return 1;
  if (score >= TIER2_SCORE) return 2;
  return 3;
}

function getMatchSummary(entry, tier, score, reasons, extra = {}) {
  const meta = entry?.meta || {};
  const name = entry?.id || entry?.file || '未知';
  const tierLabel = tier === 1 ? '精確命中' : tier === 2 ? '同型方法' : '一般解題';
  return {
    tier,
    score,
    tierLabel,
    entryId: name,
    methodId: meta.method_id || '',
    reasons: reasons || [],
    answerKey: meta.answer_key || '',
    solutionOnly: !!meta.solution_only || !!extra.solutionOnly
  };
}

function verifyAnswerLocally(replyText, answerKey) {
  if (!answerKey || !replyText) return { ok: null, note: '' };
  const ansMatch = replyText.match(/\*\*答[：:]([^*]+)\*\*/);
  if (!ansMatch) return { ok: null, note: '缺少 **答：**' };
  const ans = ansMatch[1].replace(/\s+/g, '').toUpperCase();
  const keyOpts = (answerKey.match(/\([A-E]\)/gi) || []).map(o => o.toUpperCase()).sort();
  const ansOpts = (ans.match(/\([A-E]\)/g) || []).map(o => o.toUpperCase()).sort();
  if (keyOpts.length && keyOpts.length === ansOpts.length && keyOpts.every((o, i) => o === ansOpts[i])) {
    return { ok: true, note: '選項與資料庫一致' };
  }
  if (keyOpts.length && keyOpts.every(o => ans.includes(o))) {
    return { ok: true, note: '答案包含資料庫選項' };
  }
  const keyCompact = answerKey.replace(/\s+/g, '');
  if (ans.includes(keyCompact.slice(0, Math.min(16, keyCompact.length)))) {
    return { ok: true, note: '答案與資料庫一致' };
  }
  return { ok: false, note: '答案與資料庫可能不一致，請人工核對' };
}
