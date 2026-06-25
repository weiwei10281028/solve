/**
 * js/prompts.js - 終極穩定版
 * 解決：題號解析、排版對接、並確保函數全域可用
 */

// 1. AI 系統提示詞
const SYSTEM_CHEM = `你是台灣高中化學教師，撰寫符合專業教科書美學的板書詳解。

【最高排版準則：懸掛縮進佈局】
1. 選項解析：每個選項標籤（如 (A)、(B)、(C)...）必須位在「行首」。
2. 算式橫滑保護：長反應式與複雜計算必須使用雙錢號 $$ ... $$ 獨立成行。
3. 分式規範：一律使用 \\dfrac{分子}{分母}。
4. 絕對禁令：嚴禁任何問候語與自我介紹，第一行直接解題。
5. 所有的 \\htmlData 標註必須嚴格包裹在 $ ... $ 內部。

【模仿風格】請死忠模仿資料庫中的 Note 標記風格與換行節奏。`;

// 2. 國字轉數字函數
function parseZhNumber(token) {
  const t = String(token || '').trim();
  if (/^\d+$/.test(t)) return Number(t);
  const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  return map[t] || NaN;
}

// 3. 解析題號範圍
function parseRequestedSolveScope(inputText) {
  const raw = String(inputText || '').trim();
  if (!raw || /^(全部|所有|整題|全題|整卷|全部小題)$/.test(raw)) {
    return { mode: 'all', numbers: [] };
  }
  const picked = new Set();
  const addNum = n => { if (Number.isFinite(n) && n > 0) picked.add(n); };
  
  // 匹配多種題號格式
  const matches = raw.matchAll(/第?\s*([一二三四五六七八九十\d]+)\s*題?/g);
  for (const m of matches) { 
    addNum(parseZhNumber(m[1])); 
  }
  // 匹配括號題號
  const bracketMatches = raw.matchAll(/[（(]\s*(\d+)\s*[）)]/g);
  for (const m of bracketMatches) {
    addNum(Number(m[1]));
  }
  // 匹配純數字
  const pureNums = raw.match(/\d+/g);
  if (pureNums) pureNums.forEach(n => addNum(Number(n)));

  const numbers = Array.from(picked).sort((a, b) => a - b);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'all', numbers: [] };
}

// 4. 組裝 User 訊息 (將其掛載到 window 確保全域可用)
window.buildSolveUserText = function(q, refAnswer) {
  const scope = parseRequestedSolveScope(q);
  const ref = String(refAnswer || '').trim();
  let text = "";

  if (scope.mode === 'partial') {
    const list = scope.numbers.join('、');
    text = `【最高鎖定指令】僅解答圖片中標註為「第 ${list} 題」的內容。嚴禁解答其他題號。請直接依據資料庫風格輸出詳解。`;
  } else {
    text = `請解答圖片中所有題目。`;
  }
  
  if (ref) text += `\n\n【參考答案】${ref} (請對照檢核)`;
  return text;
};

// 5. 組裝 System 訊息
window.buildScopeSystemAddon = function(q) {
  const scope = parseRequestedSolveScope(q);
  if (scope.mode === 'all') return '\n\n【範圍】解出所有題目。';
  return `\n\n【範圍】絕對限縮在解答第 ${scope.numbers.join('、')} 題。`;
};

// 6. 主進入點
window.getSystemPromptForSolve = async function(questionInput) {
  let addon = "";
  if (typeof buildDatabaseSystemAddon === 'function') {
    try {
      addon = await buildDatabaseSystemAddon(questionInput);
    } catch(e) { console.log("DB Addon Error"); }
  }
  const scopeAddon = window.buildScopeSystemAddon(questionInput);
  return SYSTEM_CHEM + addon + scopeAddon;
};

// 相容性設定
var buildSolveUserText = window.buildSolveUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;

console.log("Prompts.js 載入成功");