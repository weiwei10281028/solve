l/**
 * js/prompts.js - 專業排版對接版 (懸掛縮進 + 公式保護)
 * 配合 Render.js 與 Board.css 達成最佳視覺效果
 */

// ==========================================
// 1. AI 系統提示詞 (System Prompt)
// ==========================================
const SYSTEM_CHEM = `你是台灣高中化學教師，撰寫符合專業教科書美學的板書詳解。

【最高排版準則：懸掛縮進佈局】
1. 選項解析：每個選項標籤（如 (A)、(B)、(C)...）必須位在「行首」，且後方緊接解析文字。
   - 範例：(A) 此反應為氧化還原...
2. 嚴禁在選項標籤前添加空格或多餘文字。

【公式書寫與橫滑保護】
1. 長反應式與複雜計算：必須使用雙錢號 $$ ... $$ 獨立成行。這會觸發系統的「單行橫滑」保護機制，防止公式被截斷。
2. 短式與變數：使用行內錢號 $ ... $（例如：$W$、$0.15M$）。
3. 分式規範：一律使用 \\dfrac{分子}{分母}。

【絕對禁令】
1. 嚴禁任何問候、自我介紹（如：你好、我是化學老師...）。第一行直接進入解題。
2. 所有的 \\htmlData 標註必須嚴格包裹在 $ ... $ 內部。

【模仿參考資料】
1. 請死忠模仿 [參考資料] 中的 Note 標記風格與換行節奏。
2. 若資料庫範本使用了 \\htmlData{note=...}，請在你的解答中也針對關鍵數字進行同樣的標註。`;

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
  const addNum = n => { if (Number.isFinite(n) && n > 0) picked.add(n); };
  
  // 匹配：第一、1、(1)、第 3 題等多種格式
  for (const m of [...raw.matchAll(/第\s*([一二三四五六七八九十\d]{1,3})\s*題/g)]) { addNum(parseZhNumber(m[1])); }
  for (const m of [...raw.matchAll(/[（(]\s*(\d{1,2})\s*[)）]/g)]) { addNum(Number(m[1])); }
  for (const m of [...raw.matchAll(/(\d+)/g)]) { addNum(Number(m[1])); }
  for (const m of [...raw.matchAll(/([一二三四五六七八九十]+)/g)]) { 
    const val = parseZhNumber(m[1]);
    if (!isNaN(val)) addNum(val); 
  }

  const numbers = Array.from(picked).sort((a, b) => a - b);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'all', numbers: [] };
}

// ==========================================
// 3. 訊息組裝與鎖定邏輯
// ==========================================

window.buildSolveUserText = function(q, refAnswer = '') {
  const scope = parseRequestedSolveScope(q);
  const ref = String(refAnswer || '').trim();
  let text = '';

  if (scope.mode === 'partial') {
    const list = scope.numbers.join('、');
    text = `【最高鎖定指令】僅解答圖片中標註為「第 ${list} 題」的內容。
嚴禁提及、解答或總結圖片中其他的題號。若圖中有多個選項或題目，請無視無關部分。
請直接依據 [參考資料] 的風格輸出詳解。`;
  } else {
    text = `請針對圖片中所有題目撰寫專業板書詳解。`;
  }
  
  if (ref) text += `\n\n【參考答案】此為正確結果：${ref}。請在計算中予以對照確保邏輯正確。`;
  return text;
};

window.buildScopeSystemAddon = function(q) {
  const scope = parseRequestedSolveScope(q);
  if (scope.mode === 'all') return '\n\n【範圍】解出圖中所有題目。';
  return `\n\n【範圍】絕對限縮在解答第 ${scope.numbers.join('、')} 題，禁止擴散。`;
};

window.getSystemPromptForSolve = async function(questionInput = '') {
  let addon = "";
  if (typeof buildDatabaseSystemAddon === 'function') {
    try {
      addon = await buildDatabaseSystemAddon(questionInput);
    } catch(e) { console.warn("Database Addon Skip"); }
  }
  const scopeAddon = window.buildScopeSystemAddon(questionInput);
  return SYSTEM_CHEM + addon + scopeAddon;
};

// 全域導出
var buildSolveUserText = window.buildSolveUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;