/* 單一提示詞入口：題目本身，加上使用者明確點選的進階規則。 */
function parseRequestedSolveScope(input) {
  const text = String(input || '');
  const numbers = [...text.matchAll(/第\s*(\d+)\s*題/g)].map(match => match[1]);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'default', numbers: [] };
}

function parseSolveIntent(input) {
  const scope = parseRequestedSolveScope(input);
  return { questionMode: scope.mode, numbers: scope.numbers, optionMode: 'all', options: [] };
}

window.parseSolveIntent = parseSolveIntent;
window.buildSolveUserText = function (scopeInput, refAnswer, opts = {}) {
  const scope = parseRequestedSolveScope(scopeInput || opts.questionBody);
  const question = String(opts.questionBody || scopeInput || '').trim();
  let text = `【題目】\n${question}`;
  if (scope.mode === 'partial') text += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  if (refAnswer) text += `\n\n【已核對正確答案】${String(refAnswer).trim()}\n此答案是本題的最終判斷約束。先依題目計算關鍵量，再逐項驗證；若初步推導與此答案不符，必須回查公式、物種濃度、單位與選項判斷，修正後再輸出。逐項判斷的正確／錯誤集合與最終答案必須完全符合此答案。完成詳解後，逐一比對每個選項的判斷與最終答案集合；只有兩者完全一致時才可輸出，若不一致，停止輸出並重新檢查推導與選項判斷。不得提及答案來源，也不得為了湊答案省略推導。`;
  return text;
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

window.checkSolutionBoardStyle = function () { return []; };
window.checkChoiceAnalysisCompleteness = function () { return []; };

var buildSolveUserText = window.buildSolveUserText;
var buildFollowUpUserText = window.buildFollowUpUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;
