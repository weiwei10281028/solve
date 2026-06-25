/**
 * 終極修復版 Prompt 檔案
 */

// 1. 定義 AI 提示詞
const SYSTEM_CHEM = `你是台灣高中化學教師，撰寫專業詳解。
- 遇算式請用獨立區塊 $$...$$。
- 分數用 \\dfrac。
- 結尾用「答：」。`;

// 2. 定義解析邏輯 (確保 buildSolveUserText 一定存在)
window.buildSolveUserText = function(q, refAnswer = '') {
  console.log("正在呼叫 buildSolveUserText...");
  const raw = String(q || '').trim();
  const picked = new Set();
  const addNum = n => { if (Number.isFinite(n)) picked.add(n); };
  
  // 簡易解析題號
  const ms = raw.match(/\d+/g);
  if (ms) ms.forEach(m => addNum(parseInt(m)));
  
  const nums = Array.from(picked);
  let text = nums.length > 0 ? `請解第 ${nums.join('、')} 題。` : `請解圖中所有小題。`;
  
  if (refAnswer) text += `\n參考答案：${refAnswer}`;
  return text;
};

// 3. 定義解析範圍邏輯
window.buildScopeSystemAddon = function(q) {
  return "\n\n【範圍】依據使用者要求解答。";
};

// 4. 定義系統提示詞組裝
window.getSystemPromptForSolve = async function(questionInput = '') {
  let addon = "";
  // 檢查是否有資料庫函數，避免報錯
  if (typeof buildDatabaseSystemAddon === 'function') {
    try {
      addon = await buildDatabaseSystemAddon(questionInput);
    } catch(e) {
      console.log("資料庫插件載入跳過");
    }
  }
  
  const scopeAddon = window.buildScopeSystemAddon(questionInput);
  return SYSTEM_CHEM + addon + scopeAddon;
};

// 為了相容性，也定義沒有 window 的版本
var buildSolveUserText = window.buildSolveUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;

console.log("Prompt 腳本已成功載入，函數已就緒。");