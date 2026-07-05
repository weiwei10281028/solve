/**
 * js/database.js - 題庫配對、Tier 1-3 分級、概念參考注入
 */

let databaseEntriesCache = null;
let databaseFileCache = {};
let databaseIndexCache = null;
let lastDatabaseMatch = null;
let lastDatabaseInject = '';
let lastDatabaseRefSolution = '';
let lastResolveInput = '';
const DISABLED_DATABASE_FILES = new Set(['style-teacher-batch.md']);

/** 設 true：解題完全不配對、不注入 DATABASE（僅 SYSTEM_CHEM + NOTE） */
const DATABASE_SOLVE_DISABLED = true;

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
  if (DATABASE_SOLVE_DISABLED) return false;
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
    fn.endsWith('.md')
    && !fn.startsWith('_')
    && fn.toLowerCase() !== 'readme.md'
    && !DISABLED_DATABASE_FILES.has(fn)
  );
  return databaseIndexCache;
}

async function loadDatabaseFileContent(filename) {
  if (!filename) return '';
  if (DISABLED_DATABASE_FILES.has(filename)) return '';
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
  return entries.find(e => e.meta?.solution_only)
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
    } else if (typeof isChapterSolutionPoolEntry === 'function' && isChapterSolutionPoolEntry(ex)) {
      const kws = (ex.meta.match_keywords || []).slice(0, 8).join(',');
      const topic = ex.topic || '';
      parts.push(`${ex.id}[${topic}${kws ? ';' + kws : ''}]`);
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
    const soHit = best.solutionOnlyHit || null;
    const isChapterRoutine = !!soHit
      && typeof isChapterSolutionPoolEntry === 'function'
      && isChapterSolutionPoolEntry(entry);

    if (best.examHit) {
      questionText = best.examHit.questionText
        || (typeof extractQuestionForQuestions === 'function'
          ? extractQuestionForQuestions(entry.questionText, [best.examHit.number])
          : questionText);
      solutionText = best.examHit.solutionText || solutionText;
    }
    if (soHit) {
      solutionText = soHit.solutionText || solutionText;
    }
    if (typeof extractAnswerKey === 'function' && solutionText) {
      answerKey = extractAnswerKey(solutionText) || answerKey;
    }

    const routineBody = typeof stripDbRoutineComments === 'function'
      ? stripDbRoutineComments(solutionText)
      : stripMatchCommentsForDb(solutionText);

    let injectBlock = '';
    if (isChapterRoutine && soHit && typeof buildChapterSoRoutineBlock === 'function') {
      injectBlock = buildChapterSoRoutineBlock(entry, soHit, routineBody, tier);
    } else if (tier === 1 && typeof buildTier1Block === 'function') {
      injectBlock = buildTier1Block(entry, questionText, routineBody);
    } else if (typeof formatMethodBlock === 'function') {
      const excerpt = typeof extractStyleExcerpt === 'function'
        ? extractStyleExcerpt(routineBody || solutionText, userInput, { maxLen: 2000 })
        : (routineBody || solutionText).slice(0, 1500);
      injectBlock = formatMethodBlock(entry.meta?.method_id || '', excerpt, entry.meta || {});
      if (!injectBlock || injectBlock.length < 80) {
        injectBlock = `【相似題目參考：${entry.id}】\n解題邏輯範例：\n${excerpt}`;
      }
    } else {
      injectBlock = `【相似題目參考：${entry.id}】\n解題邏輯範例：\n${routineBody || solutionText}`;
    }
    injectBlock = stripMatchCommentsForDb(injectBlock);

    const sectionTitle = soHit?.sectionTitle || '';
    const soNumber = typeof sectionSoNumber === 'function' ? sectionSoNumber(sectionTitle) : NaN;

    lastDatabaseMatch = typeof getMatchSummary === 'function'
      ? getMatchSummary(entry, tier, best.score, best.reasons, {
        solutionOnly: !!entry.meta?.solution_only || isChapterRoutine,
        answerKey,
        isChapterSo: isChapterRoutine,
        isChapterRoutine,
        chapterFile: entry.file || '',
        sectionTitle,
        soNumber
      })
      : { tier, entryId: entry.id, tierLabel: tier === 1 ? '精確命中' : '同型方法', answerKey };
    lastDatabaseInject = injectBlock;
    lastDatabaseRefSolution = routineBody || '';
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
  lastDatabaseRefSolution = '';
  return { tier: 3, entry: null, injectBlock: '' };
}

function getLastDatabaseInject() { return lastDatabaseInject || ''; }
function getLastDatabaseRefSolution() { return lastDatabaseRefSolution || ''; }
function getLastDatabaseMatch() { return lastDatabaseMatch; }
function getLastMatchInput() { return lastResolveInput || ''; }
window.getLastMatchInput = getLastMatchInput;

async function buildDatabaseUserBlock(userInput = '') {
  if (!isDatabaseEnabled()) {
    lastDatabaseMatch = null;
    lastDatabaseInject = '';
    lastDatabaseRefSolution = '';
    return '';
  }

  if (!lastDatabaseMatch || lastResolveInput !== String(userInput || '').trim()) {
    await resolveDatabaseMatch(userInput);
  }

  const match = getLastDatabaseMatch();
  const entries = await loadDatabaseEntries();
  const blocks = [];

  // 教學規定改由 app.js 統一注入（與題庫開關無關），此處不再重複

  var tr = typeof getLastTeachingRuleMatch === 'function' ? getLastTeachingRuleMatch() : [];
  var kspRule = (tr || []).some(function (r) { return r.id === 'ksp-solubility-table'; });
  var kspChapter = match?.soLabel && /AgCl|混合稀釋|溶解平衡/.test(match.soLabel);
  var kspInject = typeof needsKspPrecipitationTable === 'function'
    && needsKspPrecipitationTable(userInput || lastResolveInput || '');
  if ((kspRule || kspChapter) && kspInject && window.KSP_REACTION_TABLE_FORMAT_BLOCK) {
    blocks.push('\n\n' + window.KSP_REACTION_TABLE_FORMAT_BLOCK);
  }

  const routineInject = getLastDatabaseInject();
  const hasRoutineInject = (match?.tier === 1 || match?.tier === 2) && routineInject;
  if (hasRoutineInject) {
    blocks.push(routineInject);
    if (lastDatabaseMatch) {
      lastDatabaseMatch.injectMode = match?.isChapterRoutine ? 'chapterRoutine' : (match?.isChapterSo ? 'chapterSo' : 'routine');
    }
  }

  const concept = typeof buildConceptReferenceBlock === 'function'
    ? buildConceptReferenceBlock(userInput, entries)
    : { text: '', labels: [] };
  if (concept.labels?.length && lastDatabaseMatch) {
    lastDatabaseMatch.conceptLabels = concept.labels;
  }

  if (!hasRoutineInject) {
    const fallbackEntries = typeof pickStyleFallbackEntries === 'function'
      ? pickStyleFallbackEntries(entries, userInput, 2)
      : [pickStyleFallbackEntry(entries, userInput)].filter(Boolean);
    const parts = [];

    for (const fallbackEntry of fallbackEntries) {
      const texts = await loadExampleTexts(fallbackEntry);
      if (!texts?.solutionText) continue;
      const excerpt = typeof extractStyleExcerpt === 'function'
        ? extractStyleExcerpt(texts.solutionText, userInput, { maxLen: 2400, styleOnly: true })
        : texts.solutionText.slice(0, 1200);
      const label = fallbackEntry.topic || fallbackEntry.id;
      parts.push(
        `[板書版型參考｜${label}｜僅限排版與 NOTE 密度]\n【版型來源：${fallbackEntry.id}】\n${stripMatchCommentsForDb(excerpt)}`
      );
    }

    if (fallbackEntries.length && lastDatabaseMatch) {
      lastDatabaseMatch.styleEntryIds = fallbackEntries.map(e => e.id);
    }

    if (parts.length) {
      const conceptHint = concept.labels?.length
        ? `本題概念線索（僅輔助選擇公式，**不得**當成已算好的答案）：${concept.labels.slice(0, 5).join('、')}。`
        : '';

      blocks.push(`\n\n${parts.join('\n\n')}\n\n【版型參考｜僅限排版與 NOTE】
1. **內容權威**：題目圖片與【使用者補充】為唯一依據；須自行判斷題型、列式、計算與選項對錯。
2. **參考範圍**：上方 [板書版型參考] **僅供**模仿開場節奏、$…$ 寫法、\\htmlData{note=…}{…} 密度、算式間標點與「各選項分析如下」版型；**禁止**套用參考中的數值、反應式、中間結果或選項結論。
3. **NOTE 密度**：含等號的推導行平均每行至少 **2 個** \\htmlData；乘積各因子、分式分子分母須分標；**表後 $K_c$ 代入行**分子分母各 1 個 NOTE（共 2 個）即足，勿嵌套多層 \\dfrac。
4. **選項評析**：計算求值選擇題推導完只寫「故答案為 (X)」與數值（含單位）；觀念判斷題再寫「各選項分析如下：」與 * (A)～(E)。**例外**：選項為不同分子式／反應式時，須逐選項列已配平反應式＋\\text{起始}／\\text{變化}／\\text{結果} 三行表。
5. 圖中條件缺漏且無法由補充補齊時，@@ANSWER@@ 寫「題目資訊不足」。
${conceptHint ? `6. ${conceptHint}\n` : ''}嚴禁開場白與結語，禁止 <!-- MATCH: ... --> 註解，直接進入解題。`);
    }
  } else if (concept.labels?.length) {
    blocks.push(`\n\n【概念線索】${concept.labels.slice(0, 5).join('、')}（僅輔助選公式，不得當成已算好的答案）。`);
  }

  if (!blocks.length) return '';
  return blocks.join('');
}

async function buildDatabaseSystemAddon(userInput = '') {
  return '';
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

/** 頁面載入時預熱題庫，避免首次解題配對較慢或不完整 */
async function warmDatabaseCache() {
  if (!isDatabaseEnabled()) return;
  try {
    await loadDatabaseEntries();
    await fetchDatabaseIndex();
  } catch (err) {
    console.warn('題庫預熱失敗', err);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    warmDatabaseCache().catch(() => {});
  });
}
