/* ── 解析題號範圍與組裝訊息的必要函數 (請務必保留) ── */

function parseZhNumber(token = '') {
  const t = String(token || '').trim();
  if (!t) return NaN;
  if (/^\d+$/.test(t)) return Number(t);
  const map = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (t === '十') return 10;
  if (t.startsWith('十') && map[t[1]] != null) return 10 + map[t[1]];
  if (t.endsWith('十') && map[t[0]] != null) return map[t[0]] * 10;
  const m = t.match(/^([一二三四五六七八九])十([一二三四五六七八九])$/);
  if (m) return map[m[1]] * 10 + map[m[2]];
  if (map[t] != null) return map[t];
  return NaN;
}

function parseRequestedSolveScope(inputText = '') {
  const raw = String(inputText || '').trim();
  if (!raw || /^(全部|所有|整題|全題|整卷|全部小題)$/.test(raw)) {
    return { mode: 'all', numbers: [] };
  }
  const picked = new Set();
  const addNum = n => { if (Number.isFinite(n) && n >= 1 && n <= 99) picked.add(n); };
  for (const m of [...raw.matchAll(/題號\s*[:：]\s*([^\n；;]+)/gi)]) {
    for (const part of m[1].split(/[,，、\s]+/)) {
      const n = parseZhNumber(part) || Number(part);
      addNum(n);
    }
  }
  for (const m of [...raw.matchAll(/([一二三四五六七八九十\d]+)\s*[~\-～到至]\s*([一二三四五六七八九十\d]+)/g)]) {
    const a = parseZhNumber(m[1]); const b = parseZhNumber(m[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) addNum(n);
    }
  }
  for (const m of [...raw.matchAll(/第\s*([一二三四五六七八九十\d]{1,3})\s*(?:小題|題|問)/g)]) {
    addNum(parseZhNumber(m[1]));
  }
  for (const m of [...raw.matchAll(/[（(]\s*(\d{1,2})\s*[)）]/g)]) { addNum(Number(m[1])); }
  for (const m of [...raw.matchAll(/(?:^|[,，、\s])(\d{1,2})\s*(?:小題|題)/g)]) { addNum(Number(m[1])); }
  const numbers = Array.from(picked).sort((a, b) => a - b);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'all', numbers: [] };
}

function buildScopeSystemAddon(q) {
  const scope = parseRequestedSolveScope(q);
  if (scope.mode === 'all') return '\n\n【範圍】可解答圖中所有小題。';
  const list = scope.numbers.map(n => `(${n})`).join('、');
  return `\n\n【範圍】只解 ${list}。`;
}

// 這是你缺少的關鍵函數
function buildSolveUserText(q, refAnswer = '') {
  const scope = parseRequestedSolveScope(q);
  const ref = String(refAnswer || '').trim();
  let text = scope.mode === 'partial' 
    ? `請解第 ${scope.numbers.join('、')} 題。` 
    : `請解圖中所有小題。`;
  if (ref) text += `\n參考答案：${ref}`;
  return text;
}

async function getSystemPrompt(userInput = '') {
  // 假設你有這個函數，如果沒有請確保主程式邏輯正確
  const addon = (typeof buildDatabaseSystemAddon === 'function') ? await buildDatabaseSystemAddon(userInput) : '';
  return `${SYSTEM_CHEM}${addon}`;
}

async function getSystemPromptForSolve(questionInput = '') {
  return (await getSystemPrompt(questionInput)) + buildScopeSystemAddon(questionInput);
}