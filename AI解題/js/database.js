/* 題庫載入：database/*.md（扁平資料夾） */

let databaseEntriesCache = null;
let databaseFileCache = {};
let databaseIndexCache = null;
let lastDatabaseMatch = null;
let lastDatabaseInject = '';

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
    const entry = entryFromDatabaseMd(raw, fn);
    if (entry.id) entries.push(entry);
  }
  databaseEntriesCache = entries;
  return entries;
}

function getEmbeddedMethods() {
  const emb = getEmbeddedDatabase();
  if (emb.methods && Object.keys(emb.methods).length) return emb.methods;
  return null;
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
  const scored = entries.map(ex => {
    const result = scoreEntry(ex, userInput);
    return { ex, ...result };
  }).sort((a, b) => b.score - a.score);
  return { entries, scored, best: scored[0] || null };
}

async function buildMatchCatalogLine() {
  const entries = await loadDatabaseEntries();
  return entries.map(ex => {
    const meta = ex.meta || {};
    let core = getCoreFingerprints(meta).join('/');
    if (!core && meta.catalog_only) {
      core = ex.match_alias || ex.topic || ex.id || '段考卷';
    }
    const alias = ex.match_alias ? `(${ex.match_alias})` : '';
    return `${ex.id}${alias}:${core || '—'}`;
  }).join('；');
}

let lastResolveInput = '';

async function resolveDatabaseMatch(userInput = '', { force = false } = {}) {
  const key = String(userInput || '').trim();
  if (!force && key === lastResolveInput && lastDatabaseMatch) {
    const entries = await loadDatabaseEntries();
    return {
      tier: lastDatabaseMatch.tier,
      entry: null,
      injectBlock: lastDatabaseInject,
      matchInfo: lastDatabaseMatch,
      entries
    };
  }
  lastResolveInput = key;

  const { entries, scored, best } = await rankDatabaseEntries(userInput);

  if (best?.examHit) {
    const ex = best.ex;
    const hit = best.examHit;
    const injectBlock = buildTier1Block(
      { ...ex, qLabel: `卷內比對`, meta: { ...ex.meta, ...hit.meta } },
      hit.questionText.slice(0, 2000),
      hit.solutionText.slice(0, 6500)
    );
    lastDatabaseMatch = getMatchSummary(ex, 1, hit.score, [...hit.reasons, '關鍵字配對']);
    lastDatabaseInject = injectBlock;
    return { tier: 1, entry: ex, injectBlock, matchInfo: lastDatabaseMatch, entries };
  }

  if (best?.solutionOnlyHit) {
    const ex = best.ex;
    const hit = best.solutionOnlyHit;
    const injectBlock = buildTier1Block(
      { ...ex, qLabel: hit.sectionTitle || '純詳解命中', meta: { ...ex.meta, ...hit.meta } },
      '（純詳解範例命中；請依學生題目圖之條件代入，數字依新題驗算，步驟與排版須與參考詳解一致）',
      hit.solutionText.slice(0, 6500)
    );
    lastDatabaseMatch = getMatchSummary(ex, 1, hit.score, [...hit.reasons, '純詳解配對'], { solutionOnly: true });
    lastDatabaseInject = injectBlock;
    return { tier: 1, entry: ex, injectBlock, matchInfo: lastDatabaseMatch, entries };
  }

  if (!best || best.score <= 0) {
    lastDatabaseMatch = getMatchSummary(null, 3, 0, []);
    return { tier: 3, entry: null, injectBlock: '', matchInfo: lastDatabaseMatch, entries };
  }

  let tier = resolveTier(best.score);
  const entry = best.ex;
  const texts = await loadExampleTexts(entry);
  if (!texts) {
    lastDatabaseMatch = getMatchSummary(entry, 3, best.score, best.reasons);
    return { tier: 3, entry, injectBlock: '', matchInfo: lastDatabaseMatch, entries };
  }

  let injectBlock = '';
  if (tier === 1) {
    const maxChars = entry.chars > 8000 ? 6500 : 4500;
    const qText = entry.meta?.solution_only
      ? '（純詳解同型命中；數字依新題，步驟與排版參考詳解）'
      : texts.questionText.slice(0, 2000);
    injectBlock = buildTier1Block(
      entry,
      qText,
      texts.solutionText.slice(0, maxChars)
    );
  } else if (tier === 2) {
    const methodId = entry.meta?.method_id || 'general-chem';
    injectBlock = formatMethodBlock(methodId, texts.solutionText.slice(0, 1800), entry.meta || {});
    const pitfalls = entry.meta?.pitfalls || [];
    if (pitfalls.length) {
      injectBlock += `\n\n【本題特別注意】\n${pitfalls.map(p => `- ${p}`).join('\n')}`;
    }
  }

  lastDatabaseMatch = getMatchSummary(entry, tier, best.score, best.reasons, {
    solutionOnly: !!entry.meta?.solution_only
  });
  lastDatabaseInject = injectBlock;
  return { tier, entry, injectBlock, matchInfo: lastDatabaseMatch, entries };
}

function getLastDatabaseInject() { return lastDatabaseInject || ''; }
function getLastDatabaseMatch() { return lastDatabaseMatch; }

function clearDatabaseCache() {
  databaseEntriesCache = null;
  databaseFileCache = {};
  databaseIndexCache = null;
  lastResolveInput = '';
  lastDatabaseMatch = null;
  lastDatabaseInject = '';
}

async function getDatabaseStatus() {
  const entries = await loadDatabaseEntries();
  const total = entries.length;
  if (!total) return { ok: false, loaded: 0, total: 0, reason: 'empty' };
  const withMeta = entries.filter(ex => ex.meta?.method_id).length;
  return { ok: true, loaded: total, total, withMeta, reason: 'ok' };
}

function buildTier3UserCheatsheet(entries = []) {
  if (!entries.length) return '';
  const lines = ['【資料庫速查｜與圖片同時閱讀；核心指紋全部吻合則必須採該法】'];
  for (const ex of entries) {
    const m = ex.meta || {};
    if (m.catalog_only) continue;
    if (m.solution_only) {
      const core = getCoreFingerprints(m).join(',') || '—';
      lines.push(`■ ${ex.id}｜純詳解｜核心:${core}｜答:${m.answer_key || '—'}`);
      continue;
    }
    const core = getCoreFingerprints(m).join(',') || '—';
    const crit = (m.critical_judgment || '').slice(0, 80);
    const ans = m.answer_key || '—';
    lines.push(`■ ${ex.id}｜核心:${core}｜⚠${crit || '—'}｜答:${ans}`);
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

async function buildDatabaseSystemAddon(userInput = '') {
  if (!isDatabaseEnabled()) return '';
  if (!lastDatabaseMatch || lastResolveInput !== String(userInput || '').trim()) {
    await resolveDatabaseMatch(userInput);
  }
  const entries = await loadDatabaseEntries();
  const tier = lastDatabaseMatch?.tier ?? 3;
  const parts = [];
  if (entries.length) parts.push(buildCatalogIndex(entries));
  if (tier === 3 && entries.length) {
    parts.push('【system 提示】完整權威詳解在 user 訊息（與圖片同則）；讀圖後對照核心指紋選法。');
  }
  return parts.length ? `\n\n${parts.join('\n\n')}` : '';
}

async function buildDatabaseUserBlock(userInput = '') {
  if (!isDatabaseEnabled()) return '';
  if (!lastDatabaseMatch || lastResolveInput !== String(userInput || '').trim()) {
    await resolveDatabaseMatch(userInput);
  }
  const match = getLastDatabaseMatch();
  const entries = await loadDatabaseEntries();

  if (match?.tier === 1 || match?.tier === 2) {
    const block = getLastDatabaseInject();
    if (block) {
      return `\n\n${block}\n\n【硬性規定】以上為資料庫權威詳解，與圖片同時閱讀；方法不可更改。`;
    }
  }
  const parts = [buildTier3UserCheatsheet(entries)];
  for (const ex of entries) {
    if (ex.meta?.catalog_only) continue;
    if (ex.meta?.solution_only) continue;
    const texts = await loadExampleTexts(ex);
    if (!texts?.solutionText) continue;
    const core = getCoreFingerprints(ex.meta || {}).join(',');
    parts.push(
      `【${ex.id}｜核心指紋:${core}｜若圖中條件吻合則必須用此法】\n${texts.solutionText.slice(0, 3500)}`
    );
  }
  parts.push(buildDbMatchUserAddon(match));
  return '\n\n' + parts.filter(Boolean).join('\n\n');
}

/* 相容舊名稱（app.js / prompts.js 過渡） */
const getLastStyleMatch = getLastDatabaseMatch;
const getStyleLibraryStatus = getDatabaseStatus;
const buildStyleUserDbBlock = buildDatabaseUserBlock;
const buildStyleSystemAddon = buildDatabaseSystemAddon;
const isStyleLibraryEnabled = isDatabaseEnabled;
const resolveStyleMatch = resolveDatabaseMatch;
