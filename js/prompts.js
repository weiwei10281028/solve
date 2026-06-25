/**
 * js/prompts.js - 2024 教學引導強化版
 */

// 1. AI 系統提示詞
const SYSTEM_CHEM = `你是台灣高中化學教師，撰寫專業、精準的詳解。

【寫作風格：冷酷教學】
1. 嚴禁社交辭令：禁止說「你好」、「我是老師」、「很高興為你解答」等廢話。
2. 允許核心分析：第一行請直接寫出「題目核心觀念」或「解題關鍵分析」。
3. 嚴禁結語：答案給完就結束，不用說「希望有幫助」。

【排版對接規範】
1. 選項結構：每個選項 (A)、(B)... 必須位在「行首」，後方緊接解析文字。
2. 算式保護：反應式或長算式請一律使用 $$ ... $$ 獨立成行。
3. 註解格式：所有的 \\htmlData{note=...}{數字} 必須寫在 $ 內部。

【模仿參考資料】
請嚴格模仿 [參考資料] 的 Note 標註邏輯與排版節奏，讓風格與資料庫一致。`;

// 2. 題號解析邏輯
function parseZhNumber(token) {
    var t = String(token || '').trim();
    if (/^\d+$/.test(t)) return Number(t);
    var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    return map[t] || NaN;
}

function parseRequestedSolveScope(inputText) {
    var raw = String(inputText || '').trim();
    if (!raw || /^(全部|所有|整題|全題|整卷|全部小題)$/.test(raw)) return { mode: 'all', numbers: [] };
    var picked = new Set();
    var numRegex = /([一二三四五六七八九十\d]+)/g;
    var m;
    while ((m = numRegex.exec(raw)) !== null) {
        var val = parseZhNumber(m[1]);
        if (!isNaN(val) && val > 0) picked.add(val);
    }
    var numbers = Array.from(picked).sort(function(a, b) { return a - b; });
    return numbers.length ? { mode: 'partial', numbers: numbers } : { mode: 'all', numbers: [] };
}

// 3. 訊息組裝 (掛載到 window)
window.buildSolveUserText = function(q, refAnswer) {
    var scope = parseRequestedSolveScope(q);
    var ref = String(refAnswer || '').trim();
    var text = "";
    if (scope.mode === 'partial') {
        var list = scope.numbers.join('、');
        text = "【最高指令】僅解答圖片中標註為「第 " + list + " 題」的內容。嚴禁解答或提及其他題號。請直接開始核心分析與解題。";
    } else {
        text = "請解答圖片中所有題目，由核心觀念分析開始。";
    }
    if (ref) text += "\n\n【參考答案】" + ref + " (請對照檢核確保邏輯正確)";
    return text;
};

window.buildScopeSystemAddon = function(q) {
    var scope = parseRequestedSolveScope(q);
    if (scope.mode === 'all') return '\n\n【範圍】解答圖中所有內容。';
    return "\n\n【範圍】嚴格限縮在解答第 " + scope.numbers.join('、') + " 題。";
};

window.getSystemPromptForSolve = async function(questionInput) {
    var addon = "";
    if (typeof buildDatabaseSystemAddon === 'function') {
        try { addon = await buildDatabaseSystemAddon(questionInput); } catch(e) { console.log("DB Skip"); }
    }
    var scopeAddon = window.buildScopeSystemAddon(questionInput);
    return SYSTEM_CHEM + addon + scopeAddon;
};

var buildSolveUserText = window.buildSolveUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;