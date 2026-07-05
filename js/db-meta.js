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
  { tag: '氧化還原', patterns: [/氧化還原/, /e\^\-/, /電子/, /氧化劑/, /還原劑/, /歧化/] },
  { tag: 'HOCl', patterns: [/HOCl/i, /次氯酸/, /OCl[\^⁻\-]?/, /漂白水/, /NaOCl/] },
  { tag: '物種分布', patterns: [/物種分布/, /物種含量/, /含量.*pH/, /pH.*含量/] },
  { tag: '平衡', patterns: [/平衡/, /\\rightleftharpoons/, /K_p/, /K_c/] },
  { tag: '解離度', patterns: [/解離度/, /\\alpha/] },
  { tag: '氣體體積比', patterns: [/同溫同壓/, /mL/, /體積比/, /亞佛加厥/, /氣體化合/] },
  { tag: '同溫同壓', patterns: [/同溫同壓/] },
  { tag: '滴定', patterns: [/滴定/, /當量點/, /指示劑/, /酚酞/, /甲基橙/] },
  { tag: '當量點', patterns: [/當量點/, /等當點/, /中和點/] },
  { tag: '酸鹼滴定', patterns: [/酸鹼滴定/, /酸鹼中和/, /滴定/] },
  { tag: '實驗式', patterns: [/實驗式/, /分子式/, /示性式/] },
  { tag: '化學式', patterns: [/化學式/, /分子式/, /結構式/, /示性式/] },
  { tag: '倍比定律', patterns: [/倍比定律/, /倍比/, /化合量/] },
  { tag: '分離方法', patterns: [/分離/, /萃取/, /傾析/, /色層/, /過濾/, /蒸餾/, /層析/] },
  { tag: '反應計量', patterns: [/限量/, /反應計量/, /完全反應/, /莫耳數/] },
  { tag: '平衡反應式', patterns: [/平衡反應式/, /係數和/, /平衡係數/] },
  { tag: '燃燒', patterns: [/燃燒/, /完全燃燒/, /CO_2/, /O_2/] },
  { tag: '依數性', patterns: [/依數性/, /凝固點下降/, /沸點上升/, /蒸氣壓下降/, /拉午耳/, /K_f/, /K_b/, /Kf/, /Kb/] },
  { tag: '凝固點下降', patterns: [/凝固點/, /ΔT_f/, /ΔTf/, /K_f/, /Kf/, /凝固點下降/] },
  { tag: '締合', patterns: [/締合/, /偶合/, /聚合/, /i\s*[<＜]\s*1/, /粒子數減少/] },
  { tag: '凡特荷夫因子', patterns: [/凡特荷夫/, /van't?\s*hoff/i, /van\s*hoff/i] },
  { tag: '滲透壓', patterns: [/滲透壓/, /半透膜/, /\\pi\s*=/] },
  { tag: '沸點上升', patterns: [/沸點上升/, /ΔT_b/, /ΔTb/, /正常沸點/] },
  { tag: '蒸氣壓下降', patterns: [/蒸氣壓下降/, /蒸氣壓/, /飽和蒸氣壓/, /ΔP/] },
  { tag: '反應速率', patterns: [/反應速率/, /速率定律/, /速率常數/, /半衰期/, /碰撞學說/, /活化能/] },
  { tag: '板書詳解', patterns: [/板書/, /htmlData/, /NOTE/] },
  { tag: 'NOTE標註', patterns: [/htmlData/, /NOTE/, /note=/] },
  { tag: '平均分子量', patterns: [/平均分子量/, /M_\{?avg\}?/, /M\/i/] }
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
    '道耳頓', '實驗式', '分子式', '示性式', '熱重分析', '草酸鈣', '過錳酸',
    '甲醛', '葡萄糖', '分離方法', '萃取', '傾析', '色層分析', '甲烷', '氫氣',
    '限量試劑', '化學式', '結構式', '平衡反應式', '係數和',
    '次氯酸', '漂白水', '物種分布', '物種含量', '歧化', '自身氧化還原', '消毒劑'
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
      if (s) {
        kw.add(s);
        for (const sub of s.split(/\s+/)) {
          const t = sub.trim();
          if (t.length >= 2) kw.add(t);
        }
      }
    }
  }
  const stem = extractQuestionStem(questionMd);
  for (const w of ['二質子弱酸', '二質子', '弱酸', '解離度', '酸鹼中和', '電解', '並聯', '平衡', '氧化還原', '同溫同壓', '亞佛加厥', '氣體化合體積', '甲乙丙', '限量試劑', '平面分子', '混成', '游離能', '八隅體', '共振', '鍵角', '鍵長', '晶格能', '三氯化磷', '三氟化硼', '三氧化硫', '乙醇', '乙烯']) {
    if (stem.includes(w)) kw.add(w);
  }
  if (/H_2A|H2A/.test(stem)) kw.add('H2A');
  return Array.from(kw).slice(0, 48);
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
  for (const tag of ['弱酸', '電解', '並聯', '平衡', '二質子', '二質子弱酸', 'H2A', '酸鹼中和', '同溫同壓', '氣體', '亞佛加厥', '化合體積', '甲乙丙', '莫耳', '限量', '倍比', '重量百分', 'MA3', 'MA', '酯類', '甲醛', '葡萄糖', '實驗式', '滴定', '當量點', '分離', '萃取', '化學式', '限量試劑', '燃燒', '甲烷', '氫氣', '凝固點', '依數性', '締合', '偶合', '凡特荷夫', '滲透壓', '沸點', '蒸氣壓', '反應速率', '碰撞', '半生期', '速率定律', '拉午耳', '酸鹼', '分子量', '平均分子量', '解離度', '平面分子', '混成', '游離能', '八隅體', '共振', '鍵角', '鍵長', '晶格能', '三氯化磷', '三氟化硼', '三氧化硫', '乙醇', '乙烯', '路易斯', '分子形狀', '化學鍵', 'HOCl', '次氯酸', '漂白水', '歧化', '物種分布', '氯氣', '氯', '消毒劑', '自身氧化還原']) {
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
  const clean = String(questionMd).replace(/<!--(?!\s*MATCH:)[\s\S]*?-->/gi, '\n');
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
    if (raw.includes(k) || raw.toLowerCase().includes(k)) {
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

  const strong = fpHits >= 2 || (fpHits >= 1 && kwHits >= 2) || (fpHits >= 1 && tagHits >= 1 && kwHits >= 1) || kwHits >= 3;
  if (strong) {
    score = Math.max(score, TIER1_SCORE);
    reasons.push('關鍵字吻合');
  }
  return { score, fpHits, kwHits, tagHits, reasons };
}

const SOLUTION_SECTION_HEAD_RE =
  '(?:#{1,4}\\s*)?(?:SO-?\\d{3}(?:\\s*[｜|]\\s*[^\\n]+)?|第\\s*\\d+\\s*題|題\\s*\\d+|類題\\s*[\\d.\\-]+)';

function extractChapterMainDetailPool(solutionMd = '') {
  const text = String(solutionMd || '');
  const withHeader = text.match(
    /##\s*詳解\s*\n([\s\S]*?)(?=\n##\s*SOLUTION\s+ONLY\s*(?:\n|$))/i
  );
  if (withHeader) return withHeader[1].trim();
  // entry.solutionText 通常已是「詳解」內文（無 ## 詳解 標題）
  const bodyOnly = text.match(/^([\s\S]*?)(?=\n##\s*SOLUTION\s+ONLY\s*(?:\n|$))/i);
  if (bodyOnly) return bodyOnly[1].trim();
  return /##\s*SOLUTION\s+ONLY/i.test(text) ? '' : text.trim();
}

function extractSolutionOnlyPool(solutionMd = '') {
  const text = String(solutionMd || '');
  const m = text.match(/##\s*SOLUTION\s+ONLY\s*\n([\s\S]*)$/i);
  return m ? m[1].trim() : '';
}

function isChapterSolutionPoolEntry(entry) {
  const meta = entry?.meta || {};
  if (meta.type === 'chapter_catalog') return true;
  return String(entry?.file || '').replace(/\\/g, '/').startsWith('chapters/');
}

function solutionTextForSectionMatch(entry) {
  const raw = entry?.solutionText || '';
  if (!raw) return '';
  if (entry?.meta?.solution_only) return raw;
  if (isChapterSolutionPoolEntry(entry)) {
    const main = extractChapterMainDetailPool(raw);
    const hasSo = /##\s*SOLUTION\s+ONLY/i.test(raw);
    const so = hasSo ? extractSolutionOnlyPool(raw) : '';
    if (main && so) return `${main}\n\n---\n\n${so}`;
    return main || so || raw;
  }
  return raw;
}

function splitSolutionIntoSections(solutionMd = '') {
  const raw = String(solutionMd || '');
  const re = new RegExp(`(?:^|\\n)(${SOLUTION_SECTION_HEAD_RE}[^\\n]*)`, 'g');
  const heads = [...raw.matchAll(re)];
  if (!heads.length) {
    const text = raw.replace(/<!--[\s\S]*?-->/g, '\n').trim();
    return text ? [{ title: '詳解', text: raw.trim() }] : [];
  }
  const items = [];
  for (let i = 0; i < heads.length; i++) {
    const m = heads[i];
    const start = m.index + (m[0].startsWith('\n') ? 1 : 0);
    const next = heads[i + 1];
    const end = next ? next.index + (next[0].startsWith('\n') ? 1 : 0) : raw.length;
    const block = raw.slice(start, end).trim();
    const title = (m[1] || m[0]).replace(/^#{1,4}\s*/, '').trim();
    const soNum = sectionSoNumber(title);
    if (block) {
      items.push({
        title,
        text: block,
        soNumber: Number.isNaN(soNum) ? null : soNum
      });
    }
  }
  return items;
}

function extractRequestedQuestionNums(userInput = '') {
  const nums = new Set();
  const raw = String(userInput || '');
  for (const m of raw.matchAll(/第\s*(\d{1,2})\s*題/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 99) nums.add(n);
  }
  for (const m of raw.matchAll(/(?:^|[\s,，、])(\d{1,2})\s*題(?=[\s,，、]|$)/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 99) nums.add(n);
  }
  return Array.from(nums);
}

function sectionQuestionNumber(title = '') {
  const raw = String(title || '');
  const m1 = raw.match(/第\s*(\d{1,2})\s*題/);
  if (m1) return Number(m1[1]);
  const m2 = raw.match(/題\s*(\d{1,2})/);
  return m2 ? Number(m2[1]) : NaN;
}

function sectionSoNumber(title = '') {
  const m = String(title || '').match(/SO-?(\d{3})/i);
  return m ? Number(m[1]) : NaN;
}

function extractRequestedSoNums(userInput = '') {
  const nums = new Set();
  const raw = String(userInput || '');
  for (const m of raw.matchAll(/SO-?(\d{3})/gi)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 999) nums.add(n);
  }
  return Array.from(nums);
}

function findBestSolutionSectionMatch(entry, solutionText, userInput) {
  if (!userInput?.trim() || !solutionText) return null;
  if (!entry._solutionSectionCache || entry._solutionSectionCacheSrc !== solutionText) {
    entry._solutionSectionCache = splitSolutionIntoSections(solutionText);
    entry._solutionSectionCacheSrc = solutionText;
  }
  const sections = entry._solutionSectionCache;
  if (!sections.length) return null;

  const reqNums = extractRequestedQuestionNums(userInput);
  const reqSoNums = extractRequestedSoNums(userInput);
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
    const secNum = sectionQuestionNumber(sec.title);
    if (reqNums.length && !Number.isNaN(secNum) && reqNums.includes(secNum)) {
      result.score += 120;
      result.reasons.push(`題號:${secNum}`);
      result.score = Math.max(result.score, TIER1_SCORE);
    }
    const secSo = sectionSoNumber(sec.title);
    if (reqSoNums.length && !Number.isNaN(secSo) && reqSoNums.includes(secSo)) {
      result.score += 120;
      result.reasons.push(`SO:${String(secSo).padStart(3, '0')}`);
      result.score = Math.max(result.score, TIER1_SCORE);
    }
    if (!best || result.score > best.score) {
      best = { ...result, sectionTitle: sec.title, solutionText: sec.text, meta };
    }
  }
  if (!best) return null;
  const ok = best.score >= TIER2_SCORE && (best.fpHits >= 1 || best.kwHits >= 2 || best.score >= TIER1_SCORE);
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
  if (entry?.id === 'style-teacher-batch') {
    return {
      score: 0,
      reasons: ['style-teacher-batch:fallback-only'],
      fpHits: 0,
      kwHits: 0,
      tagHits: 0
    };
  }
  const sectionPool = solutionTextForSectionMatch(entry);
  const useSectionMatch = !!sectionPool
    && userInput?.trim()
    && (meta.solution_only || isChapterSolutionPoolEntry(entry));

  if (useSectionMatch) {
    const hit = findBestSolutionSectionMatch(entry, sectionPool, userInput);
    if (hit) {
      let score = hit.score;
      const reasons = [...hit.reasons, meta.solution_only ? '純詳解段落配對' : '章節SO段落配對'];
      if (!meta.solution_only && isChapterSolutionPoolEntry(entry)) {
        score += 12;
        reasons.push('章節SO優先');
        if (hit.fpHits >= 2 || hit.kwHits >= 3 || hit.score >= TIER2_SCORE) {
          score = Math.max(score, TIER1_SCORE);
        }
      }
      return {
        score,
        reasons,
        fpHits: hit.fpHits,
        kwHits: hit.kwHits,
        tagHits: hit.tagHits,
        solutionOnlyHit: hit
      };
    }
    if (meta.solution_only) {
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
    '讀圖後若某筆「核心指紋」全部出現在圖中，可參考該筆詳解之題型與板書節奏；數字與步驟須依本題重算，不符則忽略。',
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
      ? '以上為純詳解範例命中；【參考詳解】僅供同型題型與板書節奏參考；數字、反應式與選項結論須依本題重算，參考與本題不符則整段忽略。'
      : '【參考詳解】僅供題型與板書節奏參考；須依本題自行判斷並列式，勿套用參考數值或段落；內部標記勿寫入正文。';
    return `\n\n【資料庫已命中：${matchInfo.entryId}】${hint}`;
  }
  if (matchInfo.tier === 2) {
    return `\n\n【資料庫同型命中：${matchInfo.entryId}】可參考推理鏈與板書節奏；數字與結論須依本題重算，不符則忽略參考；內部提示勿寫入詳解正文。`;
  }
  return `\n\n【讀圖對照資料庫】若與某筆詳解條件吻合，可採該筆方法；判斷依題目與參考詳解，勿預設題型。`;
}

function formatMethodBlock(methodId, excerpt = '', entryMeta = {}) {
  const card = getMethodDef(methodId);
  if (!card) return '';
  const steps = (card.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
  const internal = [];
  if (entryMeta.critical_judgment) {
    internal.push(`關鍵判斷：${entryMeta.critical_judgment}`);
  }
  const pitfalls = (card.pitfalls || []);
  if (pitfalls.length) internal.push(`常見誤判：${pitfalls.join('；')}`);
  if (Array.isArray(entryMeta.forbidden_steps) && entryMeta.forbidden_steps.length) {
    internal.push(`避免：${entryMeta.forbidden_steps.join('；')}`);
  }
  let block = `【同型題方法｜${card.label || methodId}】`;
  if (internal.length) {
    block += `\n\n【內部提示｜勿寫入詳解正文】\n${internal.join('\n')}`;
  }
  block += `\n\n固定步驟：\n${steps}`;
  if (excerpt) {
    block += `\n\n【同型短範例｜排版與推理順序參考，數字依新題】\n${excerpt}`;
  }
  return block;
}

/** 從參考詳解摘「符號／版式指紋」，供 Tier 1 強制克隆 */
function extractNotationFingerprint(solutionMd = '') {
  const text = String(solutionMd || '');
  const noteMatches = text.match(/\\htmlData\{note=[^}]+\}\{[^}]*\}/g) || [];
  const parts = [];

  if (noteMatches.length) {
    parts.push(`NOTE(htmlData)×${noteMatches.length}（關鍵數須 $\\htmlData{note=白話短註}{數值}$）`);
  }
  if (/^\|[^\n]+\|/m.test(text) && /\|[\s:]*-+[\s:]*\|/.test(text)) {
    parts.push('markdown 摘要表（須保留；表後可補 1～4 行 $…$ 橋接）');
  }
  if (/\\begin\{cases\}/.test(text)) {
    parts.push('cases 併列條件（須保留；可接橋接等號式）');
  }
  if (/\\begin\{array\}/.test(text)) {
    parts.push('array 變化表（須保留；可接橋接等號式）');
  }
  if (/\[[A-Za-z][A-Za-z0-9+\-_]*\]/.test(text)) {
    parts.push('方括號記號（如 $[A]$；參考怎麼寫就怎麼寫）');
  }
  if (/\\dfrac/.test(text)) {
    parts.push('分式用 $\\dfrac{}{}$');
  }
  if (/；.*\$/.test(text)) {
    parts.push('可用「；」或少量 $\\implies$ 串接推導');
  }
  parts.push('篇幅不可比參考更省略（DATABASE 為下限，可略詳）');

  const layout = extractLayoutFingerprint(text);
  if (layout.hasOptionAnalysisHeader) {
    parts.push('須保留「各選項分析如下」標題與 * (A)～(E) bullet 評析');
  }
  if (layout.structureCount) {
    parts.push(`@@MOL 行×${layout.structureCount}（須克隆行數與順序）`);
  }
  if (layout.has3PlusNNotation) {
    parts.push('混成／形狀用「3+1 型」「3+0 型」等用語（與參考一致）');
  }

  return {
    summary: parts.length ? parts.join('；') : '等號式為主；關鍵結論宜標 htmlData；不可過度省略',
    noteCount: noteMatches.length,
    hasMdTable: /^\|[^\n]+\|/m.test(text) && /\|[\s:]*-+[\s:]*\|/.test(text),
    hasCases: /\\begin\{cases\}/.test(text),
    hasArray: /\\begin\{array\}/.test(text),
    hasHtmlData: noteMatches.length > 0,
    refEqLines: countEqLines(text),
    layout
  };
}

/** 正規化化學式／速率定律字串以便比對 */
function normalizeChemExpr(s) {
  return String(s || '')
    .replace(/\\text\{[^}]*\}/g, '')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/_\{([^}]+)\}/g, '_$1')
    .replace(/\^\{([^}]+)\}/g, '^$1')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 從詳解摘速率定律式（$…$ 內或行內） */
function extractRateLawExprs(text) {
  const results = [];
  const src = String(text || '');
  for (const m of src.matchAll(/\$([^$]+)\$/g)) {
    const inner = m[1];
    const hit = inner.match(/(?:r|R)\s*=\s*k[\s\S]{0,100}/i);
    if (hit) results.push(normalizeChemExpr(hit[0]));
  }
  for (const line of src.split('\n')) {
    const t = line.replace(/<!--[\s\S]*?-->/g, '').trim();
    const hit = t.match(/(?:r|R)\s*=\s*k[^\n]{0,120}/i);
    if (hit) results.push(normalizeChemExpr(hit[0]));
  }
  return [...new Set(results.filter(Boolean))];
}

/** 解析速率定律中各物種次方（無 ^ 視為 1） */
function extractSpeciesExponents(rateLawNorm) {
  const exponents = new Map();
  const s = String(rateLawNorm || '');
  for (const m of s.matchAll(/\[([^\]]+)\](?:\^(\d+))?/g)) {
    const species = m[1].replace(/_/g, '').toLowerCase();
    exponents.set(species, m[2] ? Number(m[2]) : 1);
  }
  for (const m of s.matchAll(/p_?([a-z0-9]+)(?:\^(\d+))?/gi)) {
    const species = `p_${m[1].toLowerCase()}`;
    exponents.set(species, m[2] ? Number(m[2]) : 1);
  }
  return exponents;
}

function rateLawsCompatible(refLaw, outLaw) {
  const refExp = extractSpeciesExponents(refLaw);
  const outExp = extractSpeciesExponents(outLaw);
  if (!refExp.size) return refLaw === outLaw;
  for (const [sp, pow] of refExp) {
    if (outExp.get(sp) !== pow) return false;
  }
  return true;
}

function formatRateLawHuman(norm) {
  return String(norm || '')
    .replace(/\*/g, '·')
    .replace(/\[([^\]]+)\](?:\^(\d+))?/g, (_, sp, pow) => (pow && pow !== '1' ? `[${sp}]^${pow}` : `[${sp}]`));
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findWrongExponentsInText(body, refExp) {
  const wrong = [];
  const norm = normalizeChemExpr(body);
  for (const [species, refPow] of refExp) {
    const bare = escapeRegExp(species.replace(/^p_/, ''));
    if (!bare) continue;
    let re;
    try {
      re = new RegExp(`\\[?_?${bare}\\]?(?:\\^(\\d+))?`, 'gi');
    } catch {
      continue;
    }
    let m;
    while ((m = re.exec(norm))) {
      const pow = m[1] ? Number(m[1]) : 1;
      if (pow !== refPow) wrong.push(`[${species}]^${pow}`);
    }
  }
  return [...new Set(wrong)];
}

/** 從參考詳解摘「內容指紋」（速率定律、判斷錨點） */
function extractContentFingerprint(solutionMd = '') {
  const text = String(solutionMd || '');
  const rateLaws = extractRateLawExprs(text);
  const anchors = [];
  if (/定溫定容/.test(text)) anchors.push('定溫定容');
  if (/定溫定壓/.test(text)) anchors.push('定溫定壓');
  if (/\\Delta\s*n|Δn|delta\s*n/i.test(text)) anchors.push('Δn');
  if (/C_M\s*\\propto\s*n|以莫耳數代濃度/.test(text)) anchors.push('CM∝n');
  if (/V\s*\\propto\s*n|以總莫耳數代體積/.test(text)) anchors.push('V∝n');
  if (/零級/.test(text)) anchors.push('零級');
  if (/一級反應|濃度等比遞減/.test(text)) anchors.push('一級');
  if (/二級/.test(text)) anchors.push('二級');
  return { rateLaws, anchors };
}

/** 對照參考詳解檢查推導內容（僅參考模式：不強制對齊參考內容） */
function checkContentFidelity(outputText, refText) {
  return [];
}

function checkContentFidelityInner(outputText, refText) {
  const issues = [];
  const ref = String(refText || '');
  if (!ref.trim()) return issues;
  const fp = extractContentFingerprint(ref);
  const body = String(outputText || '').split('@@ANSWER@@')[0];
  const outLaws = extractRateLawExprs(body);

  for (const refLaw of fp.rateLaws) {
    const refExp = extractSpeciesExponents(refLaw);
    if (!refExp.size) continue;
    const compatible = outLaws.some(ol => rateLawsCompatible(refLaw, ol));
    if (compatible) continue;
    const wrong = [];
    for (const outLaw of outLaws) {
      const outExp = extractSpeciesExponents(outLaw);
      for (const [sp, refPow] of refExp) {
        const outPow = outExp.get(sp);
        if (outPow !== undefined && outPow !== refPow) wrong.push(`[${sp}]^${outPow}`);
      }
    }
    if (!wrong.length) wrong.push(...findWrongExponentsInText(body, refExp));
    const human = formatRateLawHuman(refLaw);
    if (wrong.length) {
      issues.push(`速率定律須與參考詳解一致：${human}；禁止改成 ${[...new Set(wrong)].join('、')}（勿把反應式係數當反應級數）。`);
    } else if (!outLaws.length) {
      issues.push(`須寫出與參考一致的速率定律（${human}），勿自行改寫指數或物種次方。`);
    } else {
      issues.push(`速率定律須與參考詳解一致（${human}），輸出與參考不符。`);
    }
  }

  if (fp.anchors.includes('CM∝n') && /定溫定容/.test(body) && !/莫耳|CM|C_M|\\propto|濃度/.test(body.slice(0, 800))) {
    issues.push('參考詳解以「定溫定容、莫耳數代濃度」推導，輸出須沿用此判斷起點，勿改寫成其他模型。');
  }
  if (fp.anchors.includes('V∝n') && /定溫定壓/.test(body) && !/莫耳|體積|V\s*\\propto|\\propto/.test(body.slice(0, 800))) {
    issues.push('參考詳解以「定溫定壓、總莫耳數代體積」推導，輸出須沿用此判斷起點。');
  }

  return issues;
}

/** 從參考詳解摘「段落／選項評析」指紋 */
function extractLayoutFingerprint(solutionMd = '') {
  const text = String(solutionMd || '');
  const bulletMatches = text.match(/^\*\s+\([A-E]\)/gm) || [];
  const structureCount = (text.match(/@@(?:MOL|SMILES):/gi) || []).length;
  return {
    hasOptionAnalysisHeader: /各選項分析/.test(text),
    bulletOptionCount: bulletMatches.length,
    structureCount,
    smilesCount: structureCount,
    has3PlusNNotation: /\d+\s*\+\s*\d+\s*型/.test(text),
    opensWithStructure: /^\s*@@(?:MOL|SMILES):/m.test(text),
    opensWithSmiles: /^\s*@@(?:MOL|SMILES):/m.test(text)
  };
}

/** MATCH 註解中的結構圖政策：必須｜克隆｜選用 */
function parseStructurePolicy(solutionMd = '') {
  const text = String(solutionMd || '');
  const tags = [];
  const re = /<!--\s*MATCH:\s*([^-]+?)-->/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    for (const part of m[1].split(/[,，、]/)) {
      const s = part.trim();
      if (s) tags.push(s);
    }
  }
  const required = tags.some(t =>
    /^(?:MOL|SMILES)\s*[:：]\s*(必須|必须|required|must)$/i.test(t)
  );
  const refStruct = (text.match(/@@(?:MOL|SMILES):/gi) || []).length;
  if (required) return { mode: 'required', refStruct, tags };
  if (refStruct > 0) return { mode: 'clone', refStruct, tags };
  if (tags.some(t => /^(?:MOL|SMILES)$/i.test(t))) return { mode: 'optional', refStruct, tags };
  return { mode: 'optional', refStruct, tags };
}

function parseSmilesPolicy(solutionMd = '') {
  const p = parseStructurePolicy(solutionMd);
  return { mode: p.mode, refSmiles: p.refStruct, tags: p.tags };
}

function countEqLines(text) {
  let n = 0;
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (/^\$\$[\s\S]+\$\$$/.test(t)) { n += 2; continue; }
    if (/\$[^$]+[=＝≈][^$]+\$/.test(t)) n++;
  }
  return n;
}

function buildTier1Block(entry, questionText, solutionText) {
  const meta = entry.meta || {};
  const label = [entry.qLabel, entry.topic, entry.id].filter(Boolean).join('｜');
  const lines = [`【參考詳解｜資料庫命中：${label}】`];
  const structPolicy = parseStructurePolicy(solutionText);

  const internal = [];
  if (meta.critical_judgment) internal.push(meta.critical_judgment);
  if (Array.isArray(meta.forbidden_steps) && meta.forbidden_steps.length) {
    internal.push(meta.forbidden_steps.join('；'));
  }
  if (internal.length) {
    lines.push(`\n【內部提示｜勿寫入詳解正文】\n${internal.join('\n')}`);
  }
  if (meta.answer_key) {
    lines.push(`\n【參考標準答案】${meta.answer_key}（本題結論須依題目重算後與 @@ANSWER@@ 一致）`);
  }

  let structRule = '6. **MOL**：僅在須比較鍵線／路易斯／共振或非選要求畫結構時輸出 @@MOL；判混成／平面時可用「3+N 型」文字評析。';
  if (structPolicy.mode === 'required') {
    structRule = '6. **MOL**：MATCH 標 MOL:必須，須輸出 @@MOL:物種id|標籤@@ 鍵線式。';
  }

  lines.push(`
要求：
0. **題目為準**：本題以題目圖、【使用者補充】與【題目】文字為唯一依據；下方【參考詳解】**僅供**同型題型、推導節奏與板書用語參考，**不得**套用參考中的數值、中間結果或選項結論。
1. **不符則忽略**：若參考之反應式、限定條件、判斷起點與本題不符，**整段參考視為不適用**，須依本題重判題型並自行列式；禁止硬套參考中的速率定律指數或選項評析結論。
2. **數字重算**：參考出現的濃度、分壓、莫耳數、體積比等一律依本題重算。
3. **版型**：依系統【第3～6層】板書規定撰寫；可參考下方 NOTE 密度與「各選項分析」節奏，**不必**複製段落順序、標題或 bullet 用語。
4. **反應變化表**：僅在本題題型確實需要時才列表（限量試劑、氣體體積比、平衡 α 等）；實驗式／莫耳比題寫配平方程式＋莫耳推導即可。**同型須列表時**，須沿用參考表之列標（\\text{起始} 等）與列數，**僅數值依題重算**；禁止省略列標。
5. 禁止 <!-- MATCH --> 與內部提示寫入正文；嚴禁開場白與結語。
${structRule}

【參考題目】
${questionText || '（無）'}

【參考詳解】
${solutionText || '（無）'}`);

  return lines.join('');
}

function formatSoSectionLabel(title = '') {
  const raw = String(title || '').trim();
  const soNum = sectionSoNumber(raw);
  const shortName = raw.replace(/^SO-?\d{3}\s*[｜|]\s*/i, '').replace(/^題\s*\d+\s*/i, '').trim();
  if (!Number.isNaN(soNum)) {
    const soLabel = `SO-${String(soNum).padStart(3, '0')}`;
    return shortName ? `${soLabel}｜${shortName}` : soLabel;
  }
  const qNum = sectionQuestionNumber(raw);
  if (!Number.isNaN(qNum)) {
    return shortName ? `題 ${qNum}｜${shortName}` : `題 ${qNum}`;
  }
  return raw || '章節題';
}

function stripDbRoutineComments(md = '') {
  return String(md || '')
    .replace(/<!--\s*MATCH:[\s\S]*?-->\s*/gi, '')
    .replace(/<!--\s*solve_mode:[\s\S]*?-->\s*/gi, '')
    .replace(/<!--\s*chapter_hint:[\s\S]*?-->\s*/gi, '')
    .replace(/^#{1,4}\s*SO-?\d{3}[^\n]*\n?/im, '')
    .replace(/^#{1,4}\s*題\s*\d+[^\n]*\n?/im, '')
    .trim();
}

/** 章節 MD 命中 SO 段落時，注入套路詳解（數字須依當題重算） */
function buildChapterSoRoutineBlock(entry, hit, solutionText, tier = 2) {
  const soTitle = hit?.sectionTitle || '';
  const soLabel = formatSoSectionLabel(soTitle);
  const chapter = entry?.topic || entry?.file || entry?.id || '章節題庫';
  const body = stripDbRoutineComments(solutionText);
  const header = `【章節套路參考｜${chapter}｜${soLabel}】`;

  return `${header}
來源：${entry?.file || entry?.id || 'database/chapters'}

要求：
1. **題目為準**：本題條件以題目圖與【使用者補充】為唯一依據；下方【套路詳解】供同型推導順序與板書格式參考。
2. **禁止抄數值**：不得直接套用套路中的濃度、莫耳數或選項結論；須依本題重算。
3. **同型須沿用表格式**：與套路同型時，**必須**寫出套路中的反應變化表（含 \\text{起始}、\\text{完全向左}、\\text{再向右}、\\text{平衡} 等列標與欄位對齊）；**僅**表內數值依題重算。禁止改成反應式下兩行無列標的裸數字。
4. **不符則忽略**：若套路之試劑、反應類型與本題不符（如套路為氨錯合、本題為鹽酸混合），整段套路視為不適用，須依本題重判。
5. **版型**：依系統板書規定撰寫；可參考套路的 NOTE 密度，不必複製 bullet 用語。
6. 禁止 <!-- MATCH --> 註解出現在正文；嚴禁開場白與結語。

【套路詳解】
${body || '（無）'}`;
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
  const sectionTitle = extra.sectionTitle || '';
  const soNumber = extra.soNumber;
  const soLabel = !Number.isNaN(soNumber) && soNumber >= 1
    ? formatSoSectionLabel(`SO-${String(soNumber).padStart(3, '0')}${sectionTitle ? `｜${sectionTitle.replace(/^SO-?\d{3}\s*[｜|]\s*/i, '')}` : ''}`)
    : (sectionTitle ? formatSoSectionLabel(sectionTitle) : '');
  return {
    tier,
    score,
    tierLabel,
    entryId: name,
    methodId: meta.method_id || '',
    reasons: reasons || [],
    answerKey: extra.answerKey || meta.answer_key || '',
    solutionOnly: !!meta.solution_only || !!extra.solutionOnly,
    isChapterSo: !!extra.isChapterSo,
    isChapterRoutine: !!extra.isChapterRoutine,
    chapterFile: extra.chapterFile || entry?.file || '',
    sectionTitle,
    soNumber: Number.isNaN(soNumber) ? null : soNumber,
    soLabel,
    conceptLabels: extra.conceptLabels || []
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

function splitMatchSlices(md = '') {
  const text = String(md || '');
  const re = /<!--\s*MATCH:\s*([^-]+?)-->/gi;
  const matches = [...text.matchAll(re)];
  const out = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const keywords = m[1].split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const start = m.index + m[0].length;
    const end = matches[i + 1] ? matches[i + 1].index : text.length;
    let slice = text.slice(start, end).trim();
    const headerCut = slice.search(/\n#{1,3}\s/);
    if (headerCut > 0) slice = slice.slice(0, headerCut).trim();
    slice = slice.replace(/<!--(?!\s*MATCH:)[\s\S]*?-->/gi, '').trim();
    if (slice.length >= 60) out.push({ keywords, text: slice.slice(0, 1200) });
  }
  return out;
}

function collectMatchSlicesFromEntries(entries = []) {
  const slices = [];
  for (const ex of entries) {
    const raw = [ex.solutionText, ex.questionText].filter(Boolean).join('\n');
    for (const sl of splitMatchSlices(raw)) {
      slices.push({ ...sl, entryId: ex.id || ex.file || 'unknown' });
    }
  }
  return slices;
}

function scoreConceptSlice(slice, userInput = '') {
  const raw = String(userInput || '');
  const lower = raw.toLowerCase();
  const hints = parseUserDbHints(userInput);
  let score = 0;
  const matched = [];
  for (const kw of slice.keywords || []) {
    const k = String(kw).toLowerCase();
    if (k.length >= 2 && lower.includes(k)) {
      score += 14;
      matched.push(kw);
    }
  }
  for (const tag of hints.tags) {
    if ((slice.keywords || []).some(k => String(k).includes(tag) || tag.includes(String(k)))) {
      score += 12;
      if (!matched.includes(tag)) matched.push(tag);
    }
  }
  for (const tok of hints.tokens) {
    if ((slice.keywords || []).some(k => String(k).toLowerCase().includes(String(tok).toLowerCase()))) {
      score += 10;
      matched.push(tok);
    }
  }
  for (const rule of CONCEPT_TAG_RULES) {
    if (!rule.patterns.some(p => p.test(raw))) continue;
    if ((slice.keywords || []).some(k => String(k).includes(rule.tag) || rule.tag.includes(String(k)))) {
      score += 8;
      if (!matched.includes(rule.tag)) matched.push(rule.tag);
    }
  }
  return { score, matched: [...new Set(matched)] };
}

function rankConceptSlices(userInput = '', entries = [], maxItems = 3) {
  const slices = collectMatchSlicesFromEntries(entries);
  const ranked = [];
  for (const sl of slices) {
    const result = scoreConceptSlice(sl, userInput);
    if (result.score >= 12) ranked.push({ ...sl, ...result });
  }
  ranked.sort((a, b) => b.score - a.score);
  const picked = [];
  const seen = new Set();
  for (const r of ranked) {
    const key = `${r.entryId}:${r.keywords.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(r);
    if (picked.length >= maxItems) break;
  }
  return picked;
}

function buildConceptReferenceBlock(userInput = '', entries = [], maxItems = 3) {
  const picks = rankConceptSlices(userInput, entries, maxItems);
  if (!picks.length) return { text: '', labels: [] };
  const labels = [...new Set(picks.flatMap(p => p.matched))].slice(0, 5);
  const blocks = picks.map(p =>
    `【概念參考：${p.matched.join('、')}｜${p.entryId}】\n${p.text}`
  );
  return { text: blocks.join('\n\n'), labels };
}

function scoreEntryForStyleFallback(entry, userInput = '') {
  const meta = entry?.meta || {};
  const raw = String(userInput || '');
  let score = 0;
  const reasons = [];

  if (meta.style_scope === 'global' || entry.id === 'style-teacher-batch') {
    score += 12;
    reasons.push('global');
  } else if (meta.style_reference) {
    score += 20;
    reasons.push('style_reference');
  } else {
    score += 2;
  }

  const whole = scoreQuestionKeywords(meta, userInput);
  score += whole.score;
  reasons.push(...whole.reasons);

  if (entry.topic && raw) {
    for (const part of String(entry.topic).split(/[\s（）、·\-／/]+/)) {
      if (part.length >= 2 && raw.includes(part)) {
        score += 8;
        reasons.push(`topic:${part}`);
      }
    }
  }
  if (entry.match_alias && raw.includes(entry.match_alias)) {
    score += 25;
    reasons.push(`alias:${entry.match_alias}`);
  }
  for (const tag of (meta.concept_tags || [])) {
    if (tag.length >= 2 && raw.includes(tag)) {
      score += 10;
      reasons.push(`concept:${tag}`);
    }
  }
  for (const rule of CONCEPT_TAG_RULES) {
    if (!rule.patterns.some(p => p.test(raw))) continue;
    const inMeta = (meta.concept_tags || []).some(t => t.includes(rule.tag) || rule.tag.includes(t))
      || (meta.match_keywords || []).some(k => String(k).includes(rule.tag) || rule.tag.includes(String(k)));
    if (inMeta) {
      score += 12;
      reasons.push(`tagrule:${rule.tag}`);
    }
  }

  return { score, reasons };
}

function extractStyleBoardTemplate(solutionMd = '') {
  const m = String(solutionMd || '').match(
    /###\s*板書風格範本[\s\S]*?(?=\n---\n|\n###\s*類題|\n###\s*第|\n###\s*多選|$)/
  );
  return m ? m[0].trim() : '';
}

function extractTypeProblemSection(solutionMd = '') {
  const m = String(solutionMd || '').match(
    /###\s*類題[\s\S]*?(?=\n---\n\n|\n###\s*第|\n###\s*多選|<!-- solution|$)/
  );
  return m ? m[0].trim() : '';
}

function extractStyleExcerpt(solutionMd = '', userInput = '', { maxLen = 3600, styleOnly = false } = {}) {
  const text = String(solutionMd || '');
  if (!text) return '';
  const stripQuestionHeadingNoise = (src = '') => String(src || '')
    .replace(/^#{1,4}\s*第\s*[一二三四五六七八九十\d]+\s*題[^\n]*\n?/gim, '')
    .replace(/(?:^|\n)第\s*[一二三四五六七八九十\d]+\s*題[^\n]*(?=\n|$)/gim, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const parts = [];
  const seen = new Set();
  const add = block => {
    const b = stripQuestionHeadingNoise(block);
    if (!b || seen.has(b)) return;
    seen.add(b);
    parts.push(b);
  };

  add(extractStyleBoardTemplate(text));
  add(extractTypeProblemSection(text));

  if (styleOnly) {
    return stripQuestionHeadingNoise(parts.join('\n\n---\n\n')).slice(0, maxLen);
  }

  const slices = splitMatchSlices(text);
  const ranked = slices
    .map(sl => ({ ...sl, ...scoreConceptSlice(sl, userInput) }))
    .filter(s => s.score >= 10)
    .sort((a, b) => b.score - a.score);

  for (const sl of ranked) {
    if (/板書風格範本|類題｜/.test(sl.text)) continue;
    add(sl.text);
    if (parts.join('\n\n').length >= maxLen * 0.85) break;
  }

  if (parts.length <= 2) {
    for (const sl of slices) {
      if (sl.text.includes('htmlData') || /\*\*答/.test(sl.text)) {
        add(sl.text);
        break;
      }
    }
  }

  return stripQuestionHeadingNoise(parts.join('\n\n---\n\n')).slice(0, maxLen);
}

function pickStyleFallbackEntries(entries = [], userInput = '', maxItems = 2) {
  const pool = (entries || []).filter(e =>
    e?.id !== 'style-teacher-batch'
    && (e?.meta?.style_reference || e?.meta?.style_scope === 'global')
  );
  if (!pool.length) return [];

  const scored = pool
    .map(ex => ({ ex, ...scoreEntryForStyleFallback(ex, userInput) }))
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const hasId = id => picked.some(p => p.id === id);

  const chapter = scored.find(s =>
    s.ex.meta?.style_scope !== 'global'
    && s.score >= 14
  );
  if (chapter) picked.push(chapter.ex);

  const global = scored.find(s =>
    s.ex.meta?.style_scope === 'global'
  );
  if (global && !hasId(global.ex.id)) picked.push(global.ex);

  if (!picked.length && scored[0]) picked.push(scored[0].ex);
  if (picked.length === 1 && scored[1] && !hasId(scored[1].ex.id)) picked.push(scored[1].ex);

  return picked.slice(0, maxItems);
}
