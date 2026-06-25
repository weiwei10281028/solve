/**
 * js/database.js - 2024 高效保底版
 * 整合：檔案讀取、相似度評分、Tier 1-3 分級機制、未命中強制給予範本
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

async function resolveDatabaseMatch(userInput = '', { force = false } = {}) {
  const key = String(userInput || '').trim();
  if (!force && key === lastResolveInput && lastDatabaseMatch) {
    return { tier: lastDatabaseMatch.tier, entry: null, injectBlock: lastDatabaseInject };
  }
  lastResolveInput = key;

  const { entries, best } = await rankDatabaseEntries(userInput);

  // 處理命中邏輯 (Tier 1 & 2)
  if (best && best.score >= 50) { 
    const tier = best.score >= 85 ? 1 : 2;
    const entry = best.ex;
    const texts = await loadExampleTexts(entry);
    let injectBlock = '';
    
    if (tier === 1) {
        injectBlock = `【命中資料庫：${entry.id}】\n參考詳解：\n${texts.solutionText}`;
    } else {
        injectBlock = `【相似題目參考：${entry.id}】\n解題邏輯範例：\n${texts.solutionText}`;
    }
    
    lastDatabaseMatch = { tier, entryId: entry.id };
    lastDatabaseInject = injectBlock;
    return { tier, entry, injectBlock };
  }

  // 未命中 (Tier 3)
  lastDatabaseMatch = { tier: 3, entryId: null };
  lastDatabaseInject = '';
  return { tier: 3, entry: null, injectBlock: '' };
}

// 取得最後一次注入內容的接口
function getLastDatabaseInject() { return lastDatabaseInject || ''; }
function getLastDatabaseMatch() { return lastDatabaseMatch; }

// ==========================================
// 核心加強：buildDatabaseUserBlock
// 確保 AI 即使沒命中也要參考「範本」
// ==========================================
async function buildDatabaseUserBlock(userInput = '') {
  if (!isDatabaseEnabled()) return '';
  
  // 觸發比對
  if (!lastDatabaseMatch || lastResolveInput !== String(userInput || '').trim()) {
    await resolveDatabaseMatch(userInput);
  }
  
  const match = getLastDatabaseMatch();
  const entries = await loadDatabaseEntries();

  // 情況 A：正常命中 (Tier 1 或 2)
  if (match?.tier === 1 || match?.tier === 2) {
    const block = getLastDatabaseInject();
    if (block) {
      return `\n\n[參考資料庫內容]\n${block}\n\n【硬性要求】以上為資料庫內容，你必須「死忠模仿」其排版、換行與 Note 標註邏輯，數字依新題計算。`;
    }
  }

  // 情況 B：未命中 (Tier 3) -> 啟動保底機制
  if (entries.length > 0) {
    // 從資料庫中挑選第一個 entry 作為「風格範本」
    const fallbackEntry = entries[0];
    const texts = await loadExampleTexts(fallbackEntry);
    
    if (texts?.solutionText) {
      return `\n\n[參考資料庫範本 (不論題目是否相符，請以此風格為準)]\n【標準板書範例：${fallbackEntry.id}】\n${texts.solutionText.slice(0, 3500)}\n\n【最高指令】目前的題目在資料庫中無精準匹配，但你必須「完全模仿」上述範例的：\n1. 每行字數與自然換行節奏。\n2. \\htmlData{note=...}{數字} 的標註邏輯與語氣。\n3. 嚴禁開場白與結語，直接進入解題。`;
    }
  }

  return '';
}

// System Addon 保持精簡
async function buildDatabaseSystemAddon(userInput = '') {
  if (!isDatabaseEnabled()) return '';
  return '\n\n【指令】請讀取 User 訊息中的 [參考資料]，並以該風格進行板書撰寫。';
}

// 相容性別名
const getLastStyleMatch = getLastDatabaseMatch;
const buildStyleUserDbBlock = buildDatabaseUserBlock;
const buildStyleSystemAddon = buildDatabaseSystemAddon;
const isStyleLibraryEnabled = isDatabaseEnabled;
const resolveStyleMatch = resolveDatabaseMatch;

async function getDatabaseStatus() {
  const entries = await loadDatabaseEntries();
  return { ok: entries.length > 0, loaded: entries.length, total: entries.length, reason: entries.length > 0 ? 'ok' : 'empty' };
}