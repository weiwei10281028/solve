/* 單一提示詞入口：題目本身，加上使用者明確點選的進階規則。 */
function parseRequestedSolveScope(input) {
  const text = String(input || '');
  const numbers = [...text.matchAll(/第\s*(\d+)\s*題/g)].map(match => match[1]);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'default', numbers: [] };
}

window.buildSolveUserText = function (scopeInput, _refAnswer, opts = {}) {
  const scope = parseRequestedSolveScope(scopeInput || opts.questionBody);
  const question = String(opts.questionBody || scopeInput || '').trim();
  let text = `【題目】\n${question}`;
  if (scope.mode === 'partial') text += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  return text;
};

window.buildAnswerVerificationUserText = function (scopeInput, refAnswer, opts = {}, advancedBlock = '') {
  const question = String(opts.questionBody || scopeInput || '').trim();
  const parts = [
    `【題目】\n${question}`,
    `【待驗證參考答案】${String(refAnswer || '').trim()}`,
    '請完全重新計算，不預設參考答案正確。先由題目獨立得到關鍵數值、守恆關係、物種分配、單位與選項判斷，再比較參考答案；若資料不足、計算矛盾或選項不符，consistent 必須為 false。這是內部檢查，禁止撰寫給學生看的詳解。'
  ];
  if (advancedBlock) parts.push(`【使用者選取的章節思考規格】\n${advancedBlock}`);
  return parts.join('\n\n');
};

window.buildFollowUpUserText = function (followText) {
  return `【追問】\n${String(followText || '').trim()}`;
};

window.getSystemPromptForSolve = async function () {
  return window.SolutionCore?.buildSystem?.() || '';
};

window.getSystemPromptForFollowUp = async function () {
  return '你是台灣高中化學老師。使用繁體中文，直接回答追問；公式用 $...$，不要輸出 HTML 或 NOTE 語法。';
};

var buildSolveUserText = window.buildSolveUserText;
var buildAnswerVerificationUserText = window.buildAnswerVerificationUserText;
var buildFollowUpUserText = window.buildFollowUpUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;
