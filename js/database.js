/**
 * js/database.js - 題庫配對、Tier 1-3 分級、概念參考注入
 */

let databaseEntriesCache = null;
let databaseFileCache = {};
let databaseIndexCache = null;
let lastDatabaseMatch = null;
let lastDatabaseInject = '';
let lastResolveInput = '';

function isFileProtocol() { return location.protocol === 'file:'; }

function getEmbeddedDatabase() {
  return typeof EMBEDDED_DATABASE !== 'undefined' ? EMBEDDED_DATABASE : { files: {}, methods: {} };
}

function getUserDatabaseBundle() {
  try {
    const raw = localStorage.getItem('databaseUserBundle');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function isDatabaseEnabled() {
  const v = localStorage.getItem('useDatabase');
  if (v === '0') return false;
  if (v === '1') return true;
  const legacy = localStorage.getItem('useStyleLib');
  return legacy === null || legacy === '1';
}

function stripMatchCommentsForDb(text) {
  if (typeof stripMatchComments === 'function') return stripMatchComments(text);
  return String(text || '').replace(/<!--\s*MATCH:[\s\S]*?-->\s*/gi, '');
}

async function fetchDatabaseIndex() {
  if (databaseIndexCache) return databaseIndexCache;
  const user = getUserDatabaseBundle();
  const embedded = getEmbeddedDatabase();
  const names = new Set();
  for (const fn of Object.keys(embedded.files || {})) names.add(fn);
  for (const fn of Object.keys(user?.files || {})) names.add(fn);
  if (!isFileProtocol()) {
    try {
      const res = await fetch('database/index.json');
      if (res.ok) {
        const idx = await res.json();
        for (const fn of idx.files || []) names.add(fn);
      }
    } catch { /* fallback to bundle */ }
  }
  databaseIndexCache = Array.from(names).filter(fn =>
    fn.endsWith('.md') && !fn.startsWith('_') && fn.toLowerCase() !== 'readme.md'
  );
  return databaseIndexCache;
}

async function loadDatabaseFileContent(filename) {
  if (!filename) return '';
  if (databaseFileCache[filename]) return databaseFileCache[filename];
  const user = getUserDatabaseBundle();
  if (user?.files?.[filename]) {
    databaseFileCache[filename] = user.files[filename];
    return databaseFileCache[filename];
  }
  const embedded = getEmbeddedDatabase();
  if (embedded.files?.[filename]) {
    databaseFileCache[filename] = embedded.files[filename];
    return databaseFileCache[filename];
  }
  if (!isFileProtocol()) {
    try {
      const res = await fetch(`database/${encodeURIComponent(filename)}`);
      if (res.ok) {
        const text = await res.text();
        databaseFileCache[filename] = text;
        return text;
      }
    } catch { /* ignore */ }
  }
  return '';
}

async function loadDatabaseEntries() {
  if (databaseEntriesCache) return databaseEntriesCache;
  const files = await fetchDatabaseIndex();
  const entries = [];
  for (const fn of files) {
    const raw = await loadDatabaseFileContent(fn);
    if (!raw) continue;
    if (typeof entryFromDatabaseMd !== 'function') {
      console.error('找不到 entryFromDatabaseMd 函數，請確保 db-parse.js 已載入');
      continue;
    }
    const entry = entryFromDatabaseMd(raw, fn);
    if (entry.id) entries.push(entry);
  }
  databaseEntriesCache = entries;
  return entries;
}

async function loadExampleTexts(ex) {
  if (!ex) return null;
  if (ex.questionText !== undefined || ex.solutionText !== undefined) {
    return { questionText: ex.questionText || '', solutionText: ex.solutionText || '' };
  }
  if (ex.file) {
    const raw = await loadDatabaseFileContent(ex.file);
    if (!raw) return null;
    const parsed = entryFromDatabaseMd(raw, ex.file);
    return { questionText: parsed.questionText, solutionText: parsed.solutionText };
  }
  return null;
}

async function rankDatabaseEntries(userInput = '') {
  const entries = await loadDatabaseEntries();
  if (typeof scoreEntry !== 'function') return { entries, scored: [], best: null };
  const scored = entries.map(ex => {
    const result = scoreEntry(ex, userInput);
    return { ex, ...result };
  }).sort((a, b) => b.score - a.score);
  return { entries, scored, best: scored[0] || null };
}

function pickStyleFallbackEntry(entries = [], userInput = '') {
  if (typeof pickStyleFallbackEntries === 'function') {
    const list = pickStyleFallbackEntries(entries, userInput, 1);
    return list[0] || null;
  }
  return entries.find(e => e.id === 'style-teacher-batch')
    || entries.find(e => e.meta?.solution_only)
    || entries[0]
    || null;
}

async function buildMatchCatalogLine() {
  const entries = await loadDatabaseEntries();
  const parts = [];
  for (const ex of entries) {
    if (ex.meta?.catalog_only && ex.questionText && typeof sampleExamFingerprints === 'function') {
      const sample = sampleExamFingerprints(ex.questionText, 8);
      const kws = (ex.meta.match_keywords || []).slice(0, 4).join(',');
      parts.push(`${ex.id}[${sample}${kws ? ';' + kws : ''}]`);
    } else if (ex.meta?.solution_only) {
      const kws = (ex.meta.match_keywords || []).slice(0, 8).join(',');
      if (kws) parts.push(`${ex.id}[${kws}]`);
    } else if (ex.topic) {
      parts.push(`${ex.id}[${ex.topic}]`);
    }
  }
  return parts.join(' | ');
}

async function resolveDatabaseMatch(userInput = '', { force = false } = {}) {
  const key = String(userInput || '').trim();
  if (!force && key === lastResolveInput && lastDatabaseMatch) {
    return { tier: lastDatabaseMatch.tier, entry: null, injectBlock: lastDatabaseInject };
  }
  lastResolveInput = key;

  const { entries, best } = await rankDatabaseEntries(userInput);
  const tier2Min = typeof TIER2_SCORE !== 'undefined' ? TIER2_SCORE : 18;

  if (best && best.score >= tier2Min) {
    const entry = best.ex;
    const tier = typeof resolveTier === 'function' ? resolveTier(best.score) : (best.score >= 55 ? 1 : 2);
    const texts = await loadExampleTexts(entry);
    let questionText = texts?.questionText || '';
    let solutionText = texts?.solutionText || '';
    let answerKey = entry.meta?.answer_key || '';

    if (best.examHit) {
      questionText = best.examHit.questionText
        || (typeof extractQuestionForQuestions === 'function'
          ? extractQuestionForQuestions(entry.questionText, [best.examHit.number])
          : questionText);
      solutionText = best.examHit.solutionText || solutionText;
    }
    if (best.solutionOnlyHit) {
      solutionText = best.solutionOnlyHit.solutionText || solutionText;
    }
    if (typeof extractAnswerKey === 'function' && solutionText) {
      answerKey = extractAnswerKey(solutionText) || answerKey;
    }

    let injectBlock = '';
    if (tier === 1 && typeof buildTier1Block === 'function') {
      injectBlock = buildTier1Block(entry, questionText, solutionText);
    } else if (typeof formatMethodBlock === 'function') {
      const excerpt = typeof extractStyleExcerpt === 'function'
        ? extractStyleExcerpt(solutionText, userInput, { maxLen: 2000 })
        : solutionText.slice(0, 1500);
      injectBlock = formatMethodBlock(entry.meta?.method_id || '', excerpt, entry.meta || {});
      if (!injectBlock || injectBlock.length < 80) {
        injectBlock = `【相似題目參考：${entry.id}】\n解題邏輯範例：\n${excerpt}`;
      }
    } else {
      injectBlock = `【相似題目參考：${entry.id}】\n解題邏輯範例：\n${solutionText}`;
    }
    injectBlock = stripMatchCommentsForDb(injectBlock);

    lastDatabaseMatch = typeof getMatchSummary === 'function'
      ? getMatchSummary(entry, tier, best.score, best.reasons, {
        solutionOnly: !!entry.meta?.solution_only,
        answerKey
      })
      : { tier, entryId: entry.id, tierLabel: tier === 1 ? '精確命中' : '同型方法', answerKey };
    lastDatabaseInject = injectBlock;
    return { tier, entry, injectBlock };
  }

  const concept = typeof buildConceptReferenceBlock === 'function'
    ? buildConceptReferenceBlock(userInput, entries)
    : { text: '', labels: [] };

  lastDatabaseMatch = {
    tier: 3,
    entryId: null,
    tierLabel: '一般解題',
    conceptLabels: concept.labels || [],
    styleEntryIds: []
  };
  lastDatabaseInject = '';
  return { tier: 3, entry: null, injectBlock: '' };
}

function getLastDatabaseInject() { return lastDatabaseInject || ''; }
function getLastDatabaseMatch() { return lastDatabaseMatch; }

async function buildDatabaseUserBlock(userInput = '') {
  if (!isDatabaseEnabled()) return '';

  if (!lastDatabaseMatch || lastResolveInput !== String(userInput || '').trim()) {
    await resolveDatabaseMatch(userInput);
  }

  const match = getLastDatabaseMatch();
  const entries = await loadDatabaseEntries();

  let rulesBlock = '';
  if (typeof buildTeachingRulesUserBlock === 'function') {
    try {
      rulesBlock = await buildTeachingRulesUserBlock(userInput);
      if (rulesBlock && lastDatabaseMatch) {
        const tr = typeof getLastTeachingRuleMatch === 'function' ? getLastTeachingRuleMatch() : [];
        lastDatabaseMatch.teachingRuleIds = (tr || []).map(r => r.id);
      }
    } catch (err) {
      console.warn('教學規定載入失敗', err);
    }
  }

  if (match?.tier === 1 || match?.tier === 2) {
    const block = stripMatchCommentsForDb(getLastDatabaseInject());
    if (block) {
      const base = `\n\n[參考資料庫內容]\n${block}\n\n【硬性要求】以上為內部參考：模仿排版、換行與 Note 節奏；數字與選項依題目重算。禁止把「關鍵判斷」「違反即錯」「禁止」等內部標記寫入詳解正文；禁止輸出 <!-- MATCH: ... --> 註解。`;
      return `${rulesBlock}${base}`;
    }
    if (rulesBlock) return rulesBlock;
  }

  const concept = typeof buildConceptReferenceBlock === 'function'
    ? buildConceptReferenceBlock(userInput, entries)
    : { text: '', labels: [] };
  if (concept.labels?.length && lastDatabaseMatch) {
    lastDatabaseMatch.conceptLabels = concept.labels;
  }

  const fallbackEntries = typeof pickStyleFallbackEntries === 'function'
    ? pickStyleFallbackEntries(entries, userInput, 2)
    : [pickStyleFallbackEntry(entries, userInput)].filter(Boolean);
  const parts = [];

  if (concept.text) {
    parts.push(`[概念參考段落｜題目不完全吻合，僅供解題思路與排版參考]\n${stripMatchCommentsForDb(concept.text)}`);
  }

  for (const fallbackEntry of fallbackEntries) {
    const texts = await loadExampleTexts(fallbackEntry);
    if (!texts?.solutionText) continue;
    const excerpt = typeof extractStyleExcerpt === 'function'
      ? extractStyleExcerpt(texts.solutionText, userInput)
      : texts.solutionText.slice(0, 2500);
    const label = fallbackEntry.topic || fallbackEntry.id;
    parts.push(
      `[參考資料庫範本｜${label}（不論題目是否相符，請模仿板書風格與 NOTE 密度）]\n【板書風格：${fallbackEntry.id}】\n${stripMatchCommentsForDb(excerpt)}`
    );
  }

  if (fallbackEntries.length && lastDatabaseMatch) {
    lastDatabaseMatch.styleEntryIds = fallbackEntries.map(e => e.id);
  }

  if (!parts.length && !rulesBlock) return '';

  const styleBlock = parts.length
    ? `\n\n${parts.join('\n\n')}\n\n【最高指令】目前的題目在資料庫中無精準匹配，請模仿上述範例的排版與 Note 標註節奏：每個關鍵數字第一次出現須在 $…$ 等號式內並以 $\\htmlData{note=…}{…}$ 標註；禁止開場裸寫數字。數字與選項依題目重算，參考與題目不符時以題目為準。嚴禁開場白與結語，禁止輸出 <!-- MATCH: ... --> 註解，直接進入解題。`
    : '';

  return `${rulesBlock}${styleBlock}`;
}

async function buildDatabaseSystemAddon(userInput = '') {
  if (!isDatabaseEnabled()) return '';
  return '\n\n【指令】請讀取 User 訊息中的 [參考資料] 作為內部依據，以該板書風格撰寫詳解；勿把參考資料內的內部標記或條列複製到正文。';
}

const getLastStyleMatch = getLastDatabaseMatch;
const buildStyleUserDbBlock = buildDatabaseUserBlock;
const buildStyleSystemAddon = buildDatabaseSystemAddon;
const isStyleLibraryEnabled = isDatabaseEnabled;
const resolveStyleMatch = resolveDatabaseMatch;

async function getDatabaseStatus() {
  const entries = await loadDatabaseEntries();
  const formatIssues = [];
  let withMeta = 0;
  let styleRefs = 0;

  for (const ex of entries) {
    if (ex.meta && (ex.meta.match_keywords?.length || ex.meta.topic)) withMeta++;
    if (ex.meta?.style_reference) styleRefs++;
    const raw = await loadDatabaseFileContent(ex.file);
    if (!raw || typeof validateDatabaseMd !== 'function') continue;
    const v = validateDatabaseMd(raw, ex.file);
    if (v.errors?.length) {
      formatIssues.push({ id: ex.id, file: ex.file, issues: v.errors, level: 'error' });
    } else if (v.warnings?.length) {
      formatIssues.push({ id: ex.id, file: ex.file, issues: v.warnings, level: 'warn' });
    }
  }

  let teachingRules = { loaded: 0, ids: [] };
  if (typeof getTeachingRulesStatus === 'function') {
    try {
      teachingRules = await getTeachingRulesStatus();
    } catch { /* ignore */ }
  }

  return {
    ok: entries.length > 0,
    loaded: entries.length,
    total: entries.length,
    withMeta,
    styleRefs,
    teachingRules: teachingRules.loaded,
    teachingRuleIds: teachingRules.ids || [],
    ids: entries.map(e => e.id),
    formatIssues,
    reason: entries.length > 0 ? 'ok' : 'empty'
  };
}

function invalidateDatabaseCache() {
  databaseEntriesCache = null;
  databaseFileCache = {};
  databaseIndexCache = null;
  lastDatabaseMatch = null;
  lastDatabaseInject = '';
  lastResolveInput = '';
  if (typeof clearTeachingRulesCache === 'function') clearTeachingRulesCache();
}

function clearDatabaseCache() {
  invalidateDatabaseCache();
}
