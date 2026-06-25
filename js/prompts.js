/**
 * js/prompts.js - 強力約束版
 * 解決：國字解析、廢話過多、題目範圍失控
 */

// ==========================================
// 1. AI 系統提示詞 (System Prompt)
// ==========================================
const SYSTEM_CHEM = `你是台灣高中化學教師，撰寫專業板書詳解。

【絕對禁令：嚴禁廢話】
1. 嚴禁任何開場白、自我介紹或問候語（例：你好、我是化學老師、很高興為你解答、針對你詢問的第X題...）。
2. 輸出第一行必須直接進入解題。
3. 嚴禁結語（例：希望有幫助、如有問題請再問...）。

【解題格式與資料庫模仿】
1. 必須「死忠模仿」[參考資料] 區塊中的板書格式、換行節奏與 \\htmlData{note=...} 的標記邏輯。
2. 即使 [參考資料] 的題目與目前題目不符，你也要將其視為「唯一合法的排版標準」，嚴禁自行發揮。
3. 算式中若有分數、長推導，必須使用獨立區塊 $$...$$。
4. 單位（g, mol, M）必須寫在算式的 $$ 內部結尾。

【通用板書版型】
由反應式係數可知，莫耳數比為 $1:2$。
消耗的氧氣莫耳數為：
$$ 0.015 \\times 0.52 = 7.8 \\times 10^{-3} \\text{ mmol} $$
故產生的 $S_2O_3^{2-}$ 為：
$$ 7.8 \\times 10^{-3} \\times 4 = 3.12 \\times 10^{-2} \\text{ mmol} $$

答：(C)`;

// ==========================================
// 2. 題號解析邏輯 (支援國字一二三轉換)
// ==========================================

function parseZhNumber(token = '') {
  const t = String(token || '').trim();
  if (!t) return NaN;
  if (/^\d+$/.test(t)) return Number(t);
  
  const map = { 
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, 
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 
  };
  
  if (t === '十') return 10;
  if (t.startsWith('十') && map[t[1]] != null) return 10 + map[t[1]];
  if (t.endsWith('十') && map[t[0]] != null) return map[t[0]] * 10;
  const m = t.match(/^([一二三四五六七八九])十([一二三四五六七八九])$/);
  if (m) return map[m[1]] * 10 + map[m[2]];
  
  return map[t] != null ? map[t] : NaN;
}

function parseRequestedSolveScope(inputText = '') {
  const raw = String(inputText || '').trim();
  if (!raw || /^(全部|所有|整題|全題|整卷|全部小題)$/.test(raw)) {
    return { mode: 'all', numbers: [] };
  }
  const picked = new Set();
  const addNum = n => { if (Number.isFinite(n) && n > 0 && n <= 99) picked.add(n); };
  
  // 匹配多種題號格式
  for (const m of [...raw.matchAll(/第\s*([一二三四五六七八九十\d]{1,3})\s*(?:小題|題|問)/g)]) { addNum(parseZhNumber(m[1])); }
  for (const m of [...raw.matchAll(/[（(]\s*(\d{1,2})\s*[)）]/g)]) { addNum(Number(m[1])); }
  for (const m of [...raw.matchAll(/(?:^|[,，、\s])(\d{1,2})\s*(?:小題|題)/g)]) { addNum(Number(m[1])); }
  for (const m of [...raw.matchAll(/([一二三四五六七八九十\d]+)/g)]) { 
    const val = parseZhNumber(m[1]);
    if (!isNaN(val)) addNum(val); 
  }

  const numbers = Array.from(picked).sort((a, b) => a - b);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'all', numbers: [] };
}

// ==========================================
// 3. 訊息組裝
// ==========================================

window.buildSolveUserText = function(q, refAnswer = '') {
  const scope = parseRequestedSolveScope(q);
  const ref = String(refAnswer || '').trim();
  let text = '';

  if (scope.mode === 'partial') {
    const list = scope.numbers.join('、');
    text = `【最高指令】僅解答第 ${list} 題。請直接進入解題，禁止解答或提及圖中其他題號。若圖中有多題，請無視其他無關題目。`;
  } else {
    text = `請針對圖中所有小題撰寫詳解。`;
  }
  
  if (ref) text += `\n\n參考答案：${ref}`;
  return text;
};

window.buildScopeSystemAddon = function(q) {
  const scope = parseRequestedSolveScope(q);
  if (scope.mode === 'all') return '\n\n【範圍】請解答所有小題。';
  return `\n\n【範圍】僅限解答第 ${scope.numbers.join('、')} 題，禁止發散。`;
};

window.getSystemPromptForSolve = async function(questionInput = '') {
  let addon = "";
  if (typeof buildDatabaseSystemAddon === 'function') {
    try {
      addon = await buildDatabaseSystemAddon(questionInput);
    } catch(e) { console.warn("未啟用資料庫插件"); }
  }
  const scopeAddon = window.buildScopeSystemAddon(questionInput);
  return SYSTEM_CHEM + addon + scopeAddon;
};

var buildSolveUserText = window.buildSolveUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;