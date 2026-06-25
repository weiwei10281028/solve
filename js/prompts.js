/**
 * 修改 prompts.js：封印廢話 + 強化模仿指令
 */

const SYSTEM_CHEM = `你是台灣高中化學教師，專門撰寫「精簡冷酷、無廢話」的板書詳解。

【絕對禁令】
1. 嚴禁問候語、開場白（例：你好、針對詢問、以下解析...）。第一行直接解題。
2. 嚴禁結語。
3. 所有的 \\htmlData 標註必須寫在數學符號 $...$ 內部。

【模仿指令】
1. 必須 100% 模仿 [參考資料] 區塊中的「換行節奏」與「Note 標記風格」。
2. 資料庫範本中的 Note 怎麼標，你就怎麼標。`;

// 題號解析：確保「一」能變回「1」
function parseZhNumber(token = '') {
  const t = String(token || '').trim();
  const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  if (/^\d+$/.test(t)) return Number(t);
  return map[t] || NaN;
}

function parseRequestedSolveScope(inputText = '') {
  const raw = String(inputText || '').trim();
  const picked = new Set();
  const addNum = n => { if (Number.isFinite(n) && n > 0) picked.add(n); };
  
  // 支援「解第一題」、「一到三」等國字解析
  for (const m of [...raw.matchAll(/第\s*([一二三四五六七八九十\d]+)\s*題/g)]) { addNum(parseZhNumber(m[1])); }
  for (const m of [...raw.matchAll(/([一二三四五六七八九十\d]+)/g)]) { addNum(parseZhNumber(m[1])); }

  const numbers = Array.from(picked).sort((a, b) => a - b);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'all', numbers: [] };
}

window.buildSolveUserText = function(q, refAnswer = '') {
  const scope = parseRequestedSolveScope(q);
  const ref = String(refAnswer || '').trim();
  let text = '';

  if (scope.mode === 'partial') {
    text = `【最高指令】僅解答第 ${scope.numbers.join('、')} 題。嚴禁提及其他題目，請從第 ${scope.numbers[0]} 題直接開始解題。`;
  } else {
    text = `請解答圖中所有小題。`;
  }
  
  if (ref) text += `\n參考答案：${ref}`;
  return text;
};

window.getSystemPromptForSolve = async function(questionInput = '') {
  let addon = (typeof buildDatabaseSystemAddon === 'function') ? await buildDatabaseSystemAddon(questionInput) : '';
  return SYSTEM_CHEM + addon;
};