const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite（推薦，一般解題）' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash（較強推理）' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro（進階推理）' }
    ]
  }
};

const DEPRECATED = {
  'gemini-1.5-flash': 'gemini-3.1-flash-lite',
  'gemini-1.5-flash-002': 'gemini-3.1-flash-lite',
  'gemini-2.0-flash': 'gemini-3.1-flash-lite',
  'gemini-2.0-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-2.5-flash': 'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite': 'gemini-3.1-flash-lite',
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite',
  'gemini-3-pro-preview': 'gemini-3.1-pro-preview',
  'gemini-3-flash-preview': 'gemini-3.5-flash'
};

function loadSetting(name, fallback = '') {
  return localStorage.getItem(name) || sessionStorage.getItem(name) || fallback;
}
function cleanKey(value) { return String(value || '').replace(/[\s\u200B-\u200D\uFEFF]/g, ''); }
function keySummary(key) {
  const k = cleanKey(key);
  if (!k) return '目前未儲存 API Key';
  return `已儲存 Key：${k.slice(0, 6)}...${k.slice(-4)}（長度 ${k.length}）`;
}


let imgDataURLs = [], apiMessages = [], busy = false, lastMatchInput = '', lightboxIndex = 0;
const detailMode = false;

function isForceStoichiometry() {
  return !!document.getElementById('stoichiometryToggle')?.checked;
}

function isCalcCompact() {
  return !!document.getElementById('calcCompactToggle')?.checked;
}

function getSolveSpec() {
  return typeof window.SolveSpec !== 'undefined' && window.SolveSpec.fromInputs
    ? window.SolveSpec.fromInputs(document)
    : { version: 1, enabled: false, typeIds: [], types: [] };
}

function renderChapterOptions() {
  const host = document.getElementById('chapterOptions');
  if (!host || typeof window.SolveSpec === 'undefined') return;
  host.innerHTML = Object.entries(window.SolveSpec.CHAPTERS).map(([id, chapter]) =>
    `<label class="option-toggle" for="chapter-${id}"><input type="checkbox" id="chapter-${id}" data-chapter-id="${id}"><span class="option-toggle-ui" aria-hidden="true"></span><span class="option-toggle-label">${chapter[0]}</span></label>`
  ).join('');
}

function updateSolveSpecStatus() {
  const status = document.getElementById('solveSpecStatus');
  if (!status) return;
  const baseSpec = getSolveSpec();
  const question = document.getElementById('textQuestionInput')?.value || '';
  const route = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.route
    ? window.SolveSpec.route(baseSpec, question, { forceStoichiometry: isForceStoichiometry(), forceCalcCompact: isCalcCompact() })
    : { id: 'plain', origin: 'auto', solveSpec: baseSpec };
  status.textContent = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.describeRoute
    ? window.SolveSpec.describeRoute(route)
    : '未啟用題型規格，將依題目自動判斷。';
  status.classList.toggle('is-active', route.id !== 'plain');
}

function resetSolveSpec() {
  document.querySelectorAll('input[data-solve-type], input[data-chapter-id]').forEach((input) => { input.checked = false; });
  updateSolveSpecStatus();
}

function resetStoichiometryToggle() {
  const el = document.getElementById('stoichiometryToggle');
  if (el) el.checked = false;
}

function resetCalcCompactToggle() {
  const el = document.getElementById('calcCompactToggle');
  if (el) el.checked = false;
}

function appendPromptTags(qctx) {
  let s = String(qctx || '').trim();
  const addTag = (name) => {
    const tag = (typeof PromptCompose !== 'undefined' && PromptCompose.getTag)
      ? PromptCompose.getTag(name)
      : '';
    if (!tag) return;
    s = s ? `${tag}\n${s}` : tag;
  };
  if (isForceStoichiometry()) addTag('stoichiometry');
  if (isCalcCompact()) addTag('calc-compact');
  return s;
}

function appendStoichiometryTag(qctx) {
  return appendPromptTags(qctx);
}

function initSolveOptionToggles() {
  resetStoichiometryToggle();
  resetCalcCompactToggle();
  resetSolveSpec();
}

function initStoichiometryToggle() {
  initSolveOptionToggles();
}
const MAX_IMAGES = 2;
const GEMINI_MODEL_IDS = new Set(PROVIDERS.gemini.models.map(m => m.id));
const savedModel = loadSetting('aim', 'gemini-3.1-flash-lite');
const cfg = {
  provider: 'gemini',
  key: cleanKey(loadSetting('aik', '')),
  model: DEPRECATED[savedModel] || savedModel || 'gemini-3.1-flash-lite'
};
if (!GEMINI_MODEL_IDS.has(cfg.model)) cfg.model = 'gemini-3.1-flash-lite';
localStorage.setItem('aip', 'gemini');
sessionStorage.setItem('aip', 'gemini');
if (cfg.model !== savedModel) localStorage.setItem('aim', cfg.model);

function onProviderChange() {
  const p = PROVIDERS[document.getElementById('providerSel').value];
  const sel = document.getElementById('modelSel');
  sel.innerHTML = p.models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  document.getElementById('keyInput').placeholder = p.keyPlaceholder;
  document.getElementById('keyHelp').href = p.keyUrl;
  document.getElementById('keyLink').href = p.keyUrl;
}

function openModal() {
  document.getElementById('providerSel').value = cfg.provider;
  onProviderChange();
  document.getElementById('modelSel').value = cfg.model;
  document.getElementById('keyInput').value = cfg.key;
  document.getElementById('keyStatus').textContent = keySummary(cfg.key);
  document.getElementById('overlay').classList.add('show');
}
function closeModal() { document.getElementById('overlay').classList.remove('show'); }
function overlayClick(e) { if (e.target.id === 'overlay') closeModal(); }
function saveSettings() {
  cfg.provider = document.getElementById('providerSel').value;
  cfg.key = cleanKey(document.getElementById('keyInput').value);
  cfg.model = document.getElementById('modelSel').value;
  localStorage.setItem('aip', cfg.provider);
  localStorage.setItem('aik', cfg.key);
  localStorage.setItem('aim', cfg.model);
  sessionStorage.setItem('aip', cfg.provider);
  sessionStorage.setItem('aik', cfg.key);
  sessionStorage.setItem('aim', cfg.model);
  document.getElementById('keyInput').value = cfg.key;
  document.getElementById('keyStatus').textContent = keySummary(cfg.key);
  closeModal();
  toast(`設定已儲存：${keySummary(cfg.key)}`);
}

function openLightbox(index = 0) {
  const img = imgDataURLs[index];
  if (!img) return;
  lightboxIndex = index;
  const lb = document.getElementById('imgLightbox');
  document.getElementById('lightboxImg').src = img.dataUrl;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
}

function downloadImage(index = 0) {
  const item = imgDataURLs[index];
  if (!item?.dataUrl) return;
  const a = document.createElement('a');
  a.href = item.dataUrl;
  a.download = item.name || `題目圖片-${index + 1}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadLightboxImage(e) {
  e?.stopPropagation();
  downloadImage(lightboxIndex);
}
function closeLightbox(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-img')) return;
  document.getElementById('imgLightbox').hidden = true;
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

const zone = document.getElementById('zone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('over'));
zone.addEventListener('drop', e => {
  e.preventDefault(); zone.classList.remove('over');
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
  if (files.length) onFilesSelected(files);
});
document.addEventListener('paste', e => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) onFilesSelected([item.getAsFile()]);
});

function getSolveModeTag() {
  const modelMeta = PROVIDERS.gemini.models.find(m => m.id === cfg.model);
  const modelLabel = modelMeta?.name?.split('（')[0]?.trim() || cfg.model;
  return modelLabel;
}

function appendSolveModeTag(text) {
  const base = String(text || '').trim();
  const tag = getSolveModeTag();
  if (!base) return tag;
  if (base.includes(tag)) return base;
  return `${base}｜${tag}`;
}

function hasSolveInput() {
  const textQ = document.getElementById('textQuestionInput')?.value.trim() || '';
  return !!(imgDataURLs.length || textQ);
}

function updateSolveButtonState() {
  const btn = document.getElementById('solveBtn');
  if (btn) btn.disabled = busy || !hasSolveInput();
}

function refreshPreviewUI() {
  const slots = [
    { wrap: 'prevWrap', img: 'prevImg', name: 'prevName', remove: 'previewRemove0', download: 'previewDownload0' },
    { wrap: 'prevWrap2', img: 'prevImg2', name: 'prevName2', remove: 'previewRemove1', download: 'previewDownload1' }
  ];
  slots.forEach((slot, i) => {
    const item = imgDataURLs[i];
    const wrap = document.getElementById(slot.wrap);
    if (!wrap) return;
    const removeBtn = document.getElementById(slot.remove);
    const downloadBtn = document.getElementById(slot.download);
    if (item) {
      document.getElementById(slot.img).src = item.dataUrl;
      document.getElementById(slot.name).textContent = item.name || `圖片 ${i + 1}`;
      wrap.classList.add('show');
      if (removeBtn) {
        removeBtn.hidden = false;
        removeBtn.disabled = busy;
      }
      if (downloadBtn) {
        downloadBtn.hidden = false;
        downloadBtn.disabled = busy || !item.dataUrl;
      }
    } else {
      document.getElementById(slot.img).src = '';
      document.getElementById(slot.name).textContent = '';
      wrap.classList.remove('show');
      if (removeBtn) removeBtn.hidden = true;
      if (downloadBtn) downloadBtn.hidden = true;
    }
  });
}

function removeImage(index) {
  if (busy) return;
  const i = Number(index);
  if (i < 0 || i >= imgDataURLs.length) return;
  imgDataURLs.splice(i, 1);
  apiMessages = [];
  lastMatchInput = '';
  refreshPreviewUI();
  clearThreads();
  document.getElementById('chatInputWrap')?.classList.remove('show');
  document.getElementById('resultCard')?.classList.remove('show');
  setBadge('就緒');
  updateSolveButtonState();
}

function onFilesSelected(fileList) {
  const files = [...(fileList || [])].filter(f => f?.type?.startsWith('image/'));
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    if (imgDataURLs.length >= MAX_IMAGES) {
      if (!added) toast(`最多上傳 ${MAX_IMAGES} 張圖片`);
      break;
    }
    addImage(file);
    added++;
  }
  document.getElementById('fileInput').value = '';
}

function addImage(file) {
  if (!file || imgDataURLs.length >= MAX_IMAGES) {
    if (imgDataURLs.length >= MAX_IMAGES) toast(`最多上傳 ${MAX_IMAGES} 張圖片`);
    return;
  }
  const index = imgDataURLs.length;
  const defaultName = file.name || (index ? '貼上的圖片（2）' : '貼上的圖片');
  imgDataURLs.push({ dataUrl: '', name: defaultName });
  const reader = new FileReader();
  reader.onload = e => {
    imgDataURLs[index] = { dataUrl: e.target.result, name: defaultName };
    refreshPreviewUI();
    apiMessages = [];
    clearThreads();
    document.getElementById('chatInputWrap').classList.remove('show');
    updateSolveButtonState();
  };
  reader.readAsDataURL(file);
}

function clearAll() {
  imgDataURLs = []; apiMessages = []; lastMatchInput = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('textQuestionInput').value = '';
  document.getElementById('answerInput').value = '';
  document.getElementById('answerGuidedToggle').checked = false;
  document.getElementById('chatInput').value = '';
  resetStoichiometryToggle();
  resetCalcCompactToggle();
  resetSolveSpec();
  refreshPreviewUI();
  document.getElementById('resultCard').classList.remove('show');
  clearSolveValidation();
  clearThreads();
  document.getElementById('chatInputWrap').classList.remove('show');
  setBadge('就緒');
  updateSolveButtonState();
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}
function setBadge(txt, bg, color) {
  const b = document.getElementById('badge');
  b.textContent = txt;
  if (bg && color) {
    b.style.background = bg;
    b.style.color = color;
  } else {
    b.style.background = '';
    b.style.color = '';
  }
}
function setBusy(on) {
  busy = on;
  document.getElementById('loading').classList.toggle('show', on);
  document.getElementById('sendBtn').disabled = on;
  updateSolveButtonState();
  refreshPreviewUI();
}

function clearThreads() {
  document.getElementById('mainSolution').innerHTML = '';
  document.getElementById('followupThread').innerHTML = '';
  document.getElementById('followupArea').hidden = true;
}

function scrollBoard(el) {
  if (!el) return;
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

/**
 * 將所有需 AI 判斷的品質問題合併成一次修正，避免 NOTE、板書、答案彼此
 * 接力重寫而增加 token、延遲與內容漂移。本地可安全修正的 LaTeX 不會進來。
 */
function getQualityCheckText(reply) {
  const raw = String(reply || '');
  if (/@@BOARD@@/.test(raw) && typeof boardDocToCheckText === 'function') {
    return boardDocToCheckText(raw) || raw;
  }
  return raw;
}

function clearSolveValidation() {
  const el = document.getElementById('solveValidation');
  if (!el) return;
  el.hidden = true;
  el.textContent = '';
  el.classList.remove('is-warning');
}

function getCalcCompactValidation(reply) {
  if (!isCalcCompact()) return null;
  const mathLines = String(reply || '').split(/\n+/).filter((line) => /(?:=|＝)/.test(line) && /(?:\$|\d)/.test(line));
  if (mathLines.length < 2) return { ok: null, note: '未偵測到可比對的多步計算' };
  let longestRun = 0;
  let run = 0;
  mathLines.forEach((line) => {
    if (/^[\s$\\\dA-Za-z_{}().+\-*/=＝^,，]+$/.test(line.trim())) run += 1;
    else run = 0;
    longestRun = Math.max(longestRun, run);
  });
  return longestRun > 3
    ? { ok: false, note: '偵測到連續過多拆分算式，請複核是否符合精簡設定' }
    : { ok: true, note: '本機檢查未發現過度拆分算式' };
}

function renderSolveValidation(reply, solveOpts, refAnswer) {
  const el = document.getElementById('solveValidation');
  if (!el) return;
  const lines = [];
  let warning = false;
  const questionCtx = String(solveOpts?.scopeInput || solveOpts?.questionBody || '');
  const autoFallback = solveOpts?.formatRoute?.origin === 'auto'
    && /題目資訊不足|資料不足|圖片.*(?:不清|模糊)|無法辨識/.test(String(reply || ''));
  if (solveOpts?.formatRoute && typeof window.SolveSpec?.describeRoute === 'function') {
    lines.push('格式：' + window.SolveSpec.describeRoute(solveOpts.formatRoute));
  }
  if (solveOpts?.forceStoichiometry && !autoFallback && typeof window.checkStoichiometryTableRequired === 'function') {
    const issues = window.checkStoichiometryTableRequired(reply, '', questionCtx);
    const ok = !issues.length;
    lines.push(ok ? '反應方程式：符合本機檢查' : '反應方程式：待補 ' + issues.slice(0, 2).join('；'));
    warning = warning || !ok;
  }
  const calc = getCalcCompactValidation(reply);
  if (calc) {
    lines.push('計算精簡：' + calc.note);
    warning = warning || calc.ok === false;
  }
  if (!autoFallback && typeof window.NoteCheck?.check === 'function') {
    const noteReport = window.NoteCheck.check(getQualityCheckText(reply));
    lines.push(noteReport.ok
      ? `NOTE：${noteReport.htmlDataCount} 處` 
      : `NOTE：待補 ${noteReport.issues.slice(0, 2).join('；')}`);
    warning = warning || !noteReport.ok;
  }
  if (solveOpts?.solveSpec?.enabled && typeof window.SolveSpec !== 'undefined' && window.SolveSpec.checkReply) {
    const issues = window.SolveSpec.checkReply(solveOpts.solveSpec, reply);
    const ok = !issues.length;
    lines.push(ok ? '題型規格：符合本機檢查' : '題型規格：待補 ' + issues.slice(0, 2).join('；'));
    warning = warning || !ok;
  }
  if (refAnswer && !solveOpts?.refAnswerSkipped && typeof window.answersMatch === 'function') {
    const ok = window.answersMatch(reply, refAnswer);
    lines.push(ok ? '參考答案：一致' : '參考答案：不一致，請複核（未自動改寫）');
    warning = warning || !ok;
  }
  if (typeof window.FormulaTools?.auditReply === 'function') {
    const audit = window.FormulaTools.auditReply(reply);
    if (audit.checked) {
      lines.push(audit.failed
        ? `本機算式驗算：${audit.failed} 式不一致，請複核`
        : `本機算式驗算：${audit.checked} 式一致`);
      warning = warning || audit.failed > 0;
    }
  }
  if (!lines.length) return clearSolveValidation();
  el.hidden = false;
  el.textContent = '設定驗證｜' + lines.join('｜');
  el.classList.toggle('is-warning', warning);
}

function collectQualityReport(reply, refAnswer, genOpts = {}) {
  const questionCtx = String(genOpts.questionCtx || '');
  const raw = String(reply || '');
  const autoFallback = genOpts.formatRoute?.origin === 'auto'
    && /題目資訊不足|資料不足|圖片.*(?:不清|模糊)|無法辨識/.test(raw);
  const check = window.checkSolutionBoardStyle;
  let styleIssues = typeof check === 'function'
    ? check(raw, typeof getLastDatabaseRefSolution === 'function' ? getLastDatabaseRefSolution() : '', questionCtx)
    : [];
  const forceStoich = (isForceStoichiometry() || !!genOpts.forceStoichiometry)
    || (typeof window.isForceStoichiometryContext === 'function' && window.isForceStoichiometryContext(questionCtx));
  if (forceStoich && !autoFallback && typeof window.checkStoichiometryTableRequired === 'function') {
    styleIssues = styleIssues.concat(window.checkStoichiometryTableRequired(raw, '', questionCtx));
  }
  styleIssues = [...new Set(styleIssues)].slice(0, 6);
  const noteReport = !autoFallback && typeof NoteCheck !== 'undefined' && NoteCheck.check
    ? NoteCheck.check(getQualityCheckText(raw))
    : null;
  const referenceMismatch = !!(refAnswer && !genOpts.refAnswerSkipped
    && typeof window.answersMatch === 'function' && !window.answersMatch(raw, refAnswer));
  const solveSpecIssues = !autoFallback && typeof window.SolveSpec !== 'undefined' && window.SolveSpec.checkReply
    ? window.SolveSpec.checkReply(genOpts.solveSpec, raw).slice(0, 6)
    : [];
  return { styleIssues, noteReport, referenceMismatch, solveSpecIssues };
}

function buildQualityFixUserText(report, refAnswer) {
  const lines = [
    '【單次局部修正】只補列出的明確缺漏；不可重新推導、改答案、變更題目範圍或改寫其他段落。輸出可直接替換的完整版本，但未點名段落須保持原文。',
    '一律輸出傳統 LaTeX 詳解；禁止 @@BOARD@@、@@END@@、JSON 與 BoardDoc 欄位。所有 `$` 必須成對，公式內容須為完整 LaTeX。',
  ];
  if (report.styleIssues.length) lines.push('【板書／LaTeX】' + report.styleIssues.join('；'));
  if (report.noteReport && !report.noteReport.ok && !report.noteReport.skipped) {
    lines.push('【NOTE】' + report.noteReport.issues.join('；')
      + '。只補題目給定量、第一次中間量、換算因子與分式／乘積的不同語意因子；note 必須具體，勿改答案。');
  }
  if (report.solveSpecIssues?.length) {
    lines.push('【已啟用題型規格】' + report.solveSpecIssues.join('；') + ' 請補齊指定步驟，其餘正確內容保持不變。');
  }
  return lines.join('\n');
}

async function ensureQualityReply(cfg, apiMessages, systemText, reply, refAnswer, genOpts = {}) {
  const report = collectQualityReport(reply, refAnswer, genOpts);
  const needsNote = report.noteReport && !report.noteReport.ok && !report.noteReport.skipped;
  const hasTargetedOmission = needsNote || report.solveSpecIssues?.length
    || report.styleIssues.some((issue) => /缺少|缺漏|未寫|未顯示|未使用|須補/.test(String(issue)));
  if (!hasTargetedOmission) return reply;
  console.warn('[品質檢查] 單次修正：', report);
  try {
    const { text: fixed } = await callAPI(cfg, [
      ...apiMessages,
      { role: 'assistant', content: reply },
      { role: 'user', content: buildQualityFixUserText(report, refAnswer) }
    ], systemText, {
      ...genOpts,
      maxOutputTokens: Math.min(Number(genOpts.maxOutputTokens) || 4096, 4096),
      maxContinue: 0,
      temperature: 0.2,
      _qualityFixed: 1
    });
    if (fixed) return fixed;
  } catch (err) {
    console.warn('[品質檢查] 單次修正失敗', err);
  }
  return reply;
}

/** 化學計量表強制：參考答案／H₂O 修正後再檢，缺表則 API 重寫 */
async function ensureStoichiometryTableReply(cfg, apiMessages, systemText, reply, genOpts = {}) {
  const questionCtx = String(genOpts.questionCtx || '');
  const forceStoich = isForceStoichiometry()
    || (typeof window.isForceStoichiometryContext === 'function' && window.isForceStoichiometryContext(questionCtx));
  if (!forceStoich) return reply;

  const check = typeof window.checkStoichiometryTableRequired === 'function'
    ? window.checkStoichiometryTableRequired
    : null;
  const buildFix = typeof window.buildStoichiometryTableFixUserText === 'function'
    ? window.buildStoichiometryTableFixUserText
    : typeof window.buildBoardStyleFixUserText === 'function'
      ? window.buildBoardStyleFixUserText
      : null;
  if (!check || !buildFix) return reply;

  const refText = typeof getLastDatabaseRefSolution === 'function'
    ? getLastDatabaseRefSolution()
    : '';
  let issues = check(reply, refText, questionCtx);
  if (!issues.length) return reply;

  if (genOpts._stoichTableFixed) {
    toast('化學計量表可能未完全符合');
    return reply;
  }

  console.warn('[化學計量表] 缺變化表：', issues);
  const fixMessages = [
    ...apiMessages,
    { role: 'assistant', content: reply },
    { role: 'user', content: buildFix(issues, questionCtx) }
  ];
  try {
    const { text: fixed } = await callAPI(cfg, fixMessages, systemText, {
      ...genOpts,
      maxContinue: 0,
      temperature: 0.3,
      _stoichTableFixed: 1
    });
    if (fixed && !check(fixed, refText, questionCtx).length) return fixed;
    if (fixed) {
      if (check(fixed, refText, questionCtx).length) toast('化學計量表可能未完全符合');
      return fixed;
    }
  } catch (err) {
    console.warn('[化學計量表] 修正失敗', err);
  }
  toast('化學計量表可能未完全符合');
  return reply;
}

/** 參考答案／NOTE 修正後，再檢 (A) H₂O mL；必要時 API 重寫或本地 patch */
async function ensureLiquidWaterOptionReply(cfg, apiMessages, systemText, reply, genOpts = {}) {
  const check = typeof window.checkLiquidWaterOptionConsistency === 'function'
    ? window.checkLiquidWaterOptionConsistency
    : null;
  const buildFix = typeof window.buildBoardStyleFixUserText === 'function'
    ? window.buildBoardStyleFixUserText
    : null;
  const patch = typeof window.patchLiquidWaterOptionA === 'function'
    ? window.patchLiquidWaterOptionA
    : null;
  if (!check) return reply;

  const questionCtx = String(genOpts.questionCtx || '');
  let issues = check(reply, questionCtx);
  if (!issues.length) return reply;

  if (!genOpts._liquidWaterFixed && buildFix) {
    const fixMessages = [
      ...apiMessages,
      { role: 'assistant', content: reply },
      { role: 'user', content: buildFix(issues) }
    ];
    try {
      const { text: fixed } = await callAPI(cfg, fixMessages, systemText, {
        ...genOpts,
        maxContinue: 0,
        temperature: 0.3,
        _liquidWaterFixed: 1
      });
      if (fixed && !check(fixed, questionCtx).length) return fixed;
      if (fixed) reply = fixed;
    } catch (err) {
      console.warn('[H₂O選項] API 修正失敗', err);
    }
  }

  if (patch && check(reply, questionCtx).length) {
    console.warn('[H₂O選項] 本地 patch (A)');
    reply = patch(reply, questionCtx);
  }
  return reply;
}

/** 參考答案僅作本機複核，不可用它自動重寫完整詳解。 */
async function ensureReferenceAnswerReply(cfg, apiMessages, systemText, reply, refAnswer, genOpts = {}) {
  if (refAnswer && !genOpts.refAnswerSkipped && typeof window.answersMatch === 'function'
    && !window.answersMatch(reply, refAnswer)) {
    console.warn('[參考答案] 與 AI 答案不一致，保留原詳解供人工複核');
  }
  return reply;
}

async function ensureFollowUpBoardStyleReply(cfg, apiMessages, systemText, reply, genOpts = {}) {
  const check = typeof window.checkFollowUpBoardStyle === 'function'
    ? window.checkFollowUpBoardStyle
    : null;
  const buildFix = typeof window.buildFollowUpStyleFixUserText === 'function'
    ? window.buildFollowUpStyleFixUserText
    : null;
  if (!check || !buildFix || genOpts._followUpStyleFixed) return reply;

  const questionCtx = String(genOpts.questionCtx || genOpts.followText || '');
  const issues = check(reply, questionCtx);
  if (!issues.length) return reply;

  const fixMessages = [
    ...apiMessages,
    { role: 'assistant', content: reply },
    { role: 'user', content: buildFix(issues) }
  ];
  try {
    const { text: fixed } = await callAPI(cfg, fixMessages, systemText, {
      ...genOpts,
      maxContinue: 0,
      _followUpStyleFixed: true
    });
    if (fixed && !check(fixed, questionCtx).length) return fixed;
    if (fixed) return fixed;
  } catch (err) {
    console.warn('追問板書修正重試失敗', err);
  }
  toast('追問可能未符合板書或混成規定');
  return reply;
}

function updateDatabaseStatusLine() {
  /* 頂部狀態列已移除 */
}

function renderAiInto(container, text) {
  try {
    if (typeof render !== 'function' || typeof doKaTeX !== 'function') {
      throw new Error('render.js 未載入，請強制重新整理頁面');
    }
    if (typeof window.__RENDER_BUILD === 'undefined') {
      console.warn('[render] 快取可能過舊，請 Ctrl+F5');
    }
    const isDocument = typeof SolutionDocument !== 'undefined' && SolutionDocument.isDocument?.(text);
    let compiledNotes = [];
    let body = text || '';
    if (isDocument) {
      const compiled = SolutionDocument.compile(text);
      if (!compiled.ok) throw new Error(`SolutionDocument 驗證失敗：${compiled.validation.errors.slice(0, 3).join('；')}`);
      body = compiled.text;
      compiledNotes = compiled.notes;
    } else if (typeof SolutionFormat !== 'undefined' && SolutionFormat.format) {
      const formatted = SolutionFormat.format(body);
      body = formatted.text;
      if (!formatted.report.ok) console.warn('[詳解排版] 尚有待修項目', formatted.report.errors);
    }
    if (typeof MolResolver !== 'undefined' && MolResolver.preprocessSmilesToMol) {
      body = MolResolver.preprocessSmilesToMol(body);
    }
    if (typeof SmilesDraw !== 'undefined' && SmilesDraw.preprocess) {
      body = SmilesDraw.preprocess(body);
    }
    const board = typeof tryRenderBoardDoc === 'function' ? tryRenderBoardDoc(body) : null;
    if (board?.html) {
      window.__LAST_RENDER_PIPELINE = 'board';
      if (!board.validation.ok) {
        console.warn('[BoardDoc] 部分驗證警告，仍編譯顯示', board.validation.errors);
      }
      container.innerHTML = board.html;
    } else {
      window.__LAST_RENDER_PIPELINE = 'legacy';
      container.innerHTML = render(body);
    }
    doKaTeX(container);
    if (compiledNotes.length && typeof SolutionDocument !== 'undefined') {
      const applied = SolutionDocument.applyInlineNotes(container, compiledNotes);
      if (applied !== compiledNotes.length) console.warn('[SolutionDocument] 部分文字 NOTE 未套用', { applied, expected: compiledNotes.length });
    }
    const drawTasks = [];
    if (typeof MolfileDraw !== 'undefined' && MolfileDraw.scan) {
      drawTasks.push(MolfileDraw.scan(container));
    }
    if (typeof SmilesDraw !== 'undefined' && SmilesDraw.scan) {
      drawTasks.push(SmilesDraw.scan(container));
    }
    const afterDraw = () => {
      if (typeof StructureLayout !== 'undefined' && StructureLayout.apply) {
        StructureLayout.apply(container);
      }
    };
    if (drawTasks.length) {
      Promise.all(drawTasks).then(afterDraw).catch((err) => {
        console.warn('結構圖繪製', err);
        afterDraw();
      });
    } else {
      afterDraw();
    }
  } catch (err) {
    console.error('詳解渲染失敗', err);
    container.innerHTML = `<div class="ai-plain"><div class="plain-line"><div class="plain-line-inner" style="color:#a33">詳解渲染失敗：${esc(String(err.message || err))}。請 Ctrl+F5 重新整理後再試。</div></div></div>`;
  }
}

function setMainSolution(text) {
  const el = document.getElementById('mainSolution');
  renderAiInto(el, text);
  scrollBoard(el);
}

function appendFollowupUser(text) {
  document.getElementById('followupArea').hidden = false;
  const block = document.createElement('div');
  block.className = 'followup-block';
  block.innerHTML = `<div class="followup-user"><span class="followup-tag">追問</span>${esc(text)}</div><div class="followup-reply board-reply followup-pending">撰寫中…</div>`;
  document.getElementById('followupThread').appendChild(block);
  block.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return block;
}

function fillFollowupReply(block, text) {
  const reply = block.querySelector('.followup-reply');
  reply.classList.remove('followup-pending');
  renderAiInto(reply, text);
  block.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function submitFollowUp(e) {
  if (e) e.preventDefault();
  sendFollowUp();
  return false;
}

function chatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFollowUp(); }
}

async function startSolve() {
  if (busy || !hasSolveInput()) return;

  const textQuestion = document.getElementById('textQuestionInput').value.trim();
  const refAnswer = document.getElementById('answerInput').value.trim();
  const refAnswerGuided = document.getElementById('answerGuidedToggle').checked && !!refAnswer;
  const hasImage = imgDataURLs.length > 0;
  const molPreview = typeof MolfileDraw !== 'undefined' && MolfileDraw.parseRequest
    ? MolfileDraw.parseRequest(textQuestion)
    : null;

  if (molPreview && !hasImage) {
    document.getElementById('resultCard').classList.add('show');
    document.getElementById('chatInputWrap').classList.remove('show');
    clearThreads();
    setBusy(true);
    setBadge('預存結構…', '#F9F3E6', '#8A6D3B');
    try {
      const el = document.getElementById('mainSolution');
      el.innerHTML = '';
      const result = await MolfileDraw.drawById(molPreview.id, molPreview.label);
      if (result.node) el.appendChild(result.node);
      if (result.ok) {
        setBadge('預存結構', '#EAF2ED', '#3D6B52');
      } else {
        setBadge('錯誤', '#F9EDED', '#9B4444');
        toast('結構繪製失敗，請確認 id 是否在 structures/index.json');
      }
    } catch (err) {
      setMainSolution(`❌ ${formatError(err.message)}`);
      setBadge('錯誤', '#F9EDED', '#9B4444');
    } finally {
      setBusy(false);
    }
    return;
  }

  if (!cfg.key) { openModal(); toast('請先設定 Gemini API Key'); return; }
  const textOnly = !hasImage && !!textQuestion;

  if (!hasImage && !textQuestion) {
    toast('請上傳題目圖片，或在「補充說明或者問題輸入」填寫題目內容');
    return;
  }

  document.getElementById('resultCard').classList.add('show');
  document.getElementById('chatInputWrap').classList.add('show');
  clearThreads();
  clearSolveValidation();
  setBusy(true);

  let autoHints = '';
  let matchInput = '';

  try {
    if (textOnly) {
      matchInput = textQuestion;
      lastMatchInput = matchInput;
      if (isDatabaseEnabled()) {
        setBadge('配對資料庫中…', '#F9F3E6', '#8A6D3B');
        await resolveDatabaseMatch(matchInput, { force: true });
      }
    } else {
      setBadge('辨識題目中…', '#F9F3E6', '#8A6D3B');

      if (isDatabaseEnabled()) {
        try {
          const catalogLine = await buildMatchCatalogLine();
          const urls = imgDataURLs.map(item => item.dataUrl);
          autoHints = await extractImageMatchHints(cfg, urls, catalogLine);
        } catch (err) {
          console.warn('自動配對辨識失敗', err);
        }
      } else if (typeof extractImageMatchHints === 'function' && isDatabaseEnabled()) {
        try {
          const urls = imgDataURLs.map(item => item.dataUrl);
          autoHints = await extractImageMatchHints(cfg, urls, '');
        } catch (err) {
          console.warn('題眼關鍵字辨識失敗', err);
        }
      }
      matchInput = [textQuestion, autoHints].filter(Boolean).join(' ').trim();
      lastMatchInput = matchInput;

      if (isDatabaseEnabled()) {
        setBadge('配對資料庫中…', '#F9F3E6', '#8A6D3B');
        await resolveDatabaseMatch(matchInput, { force: true });
      }
    }

    setBadge('撰寫詳解中…', '#F9F3E6', '#8A6D3B');
    const scopeInput = typeof extractExplicitScopePhrase === 'function'
      ? extractExplicitScopePhrase(textQuestion)
      : '';
    const formatRoute = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.route
      ? window.SolveSpec.route(getSolveSpec(), matchInput || textQuestion, {
        forceStoichiometry: isForceStoichiometry(),
        forceCalcCompact: isCalcCompact()
      })
      : { id: 'plain', origin: 'auto', solveSpec: getSolveSpec(), forceStoichiometry: isForceStoichiometry(), forceCalcCompact: isCalcCompact() };
    const solveSpec = formatRoute.solveSpec;
    const refConflict = (refAnswer && typeof window.checkObviousRefAnswerConflict === 'function')
      ? window.checkObviousRefAnswerConflict(matchInput || textQuestion, refAnswer)
      : { conflict: false };
    if (refConflict.conflict) {
      console.warn('[參考答案]', refConflict.reason || '與題意明顯不符');
      toast(refConflict.reason || '參考答案與題意可能不符，已改依題目推導');
    }
    const solveOpts = {
      textOnly,
      questionBody: textQuestion,
      supplement: textQuestion,
      hasImage,
      imageCount: imgDataURLs.length,
      detailed: detailMode,
      scopeInput,
      refAnswer: refConflict.conflict ? '' : refAnswer,
      refAnswerGuided: refAnswerGuided && !refConflict.conflict,
      refAnswerSkipped: !!refConflict.conflict,
      forceStoichiometry: formatRoute.forceStoichiometry,
      forceCalcCompact: formatRoute.forceCalcCompact,
      solveSpec,
      formatRoute
    };
    // 只由使用者明確輸入的範圍控制分題標題；題庫／OCR 的題號不是多題指令。
    updateSolveHeadingMode(scopeInput);
    if (typeof window.buildSolveUserText !== 'function') {
      throw new Error('prompts.js 未載入（buildSolveUserText 不存在）。請按 Ctrl+Shift+R 強制重新整理；若仍失敗，請用「啟動網頁.bat」開啟並確認主控台是否有 js 語法錯誤。');
    }
    const userText = window.buildSolveUserText(
      scopeInput,
      solveOpts.refAnswerGuided ? solveOpts.refAnswer : '',
      solveOpts
    );
    const qctxRules = [matchInput, textQuestion, autoHints].filter(Boolean).join(' ');
    let teachingRules = { userBlock: '', systemAddon: '', ids: [] };
    if (typeof resolveTeachingRulesForSolve === 'function') {
      try {
        teachingRules = await resolveTeachingRulesForSolve(qctxRules);
      } catch (err) {
        console.warn('教學規定載入失敗', err);
      }
    }
    const dbUserBlock = await buildDatabaseUserBlock(matchInput);
    const dbMatch = typeof getLastDatabaseMatch === 'function' ? getLastDatabaseMatch() : null;
    if (dbMatch && teachingRules.ids?.length) {
      dbMatch.teachingRuleIds = teachingRules.ids;
    }
    const noteUserBlock = typeof NoteBlock !== 'undefined' && NoteBlock.buildUserBlock
      ? NoteBlock.buildUserBlock({ matchInput, detailed: detailMode, conceptLabels: dbMatch?.conceptLabels || [], match: dbMatch }) : '';
    const formatRouteBlock = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.buildRouteUserBlock
      ? window.SolveSpec.buildRouteUserBlock(formatRoute) : '';
    const boardFormatBlock = typeof window.BoardFormats !== 'undefined' && window.BoardFormats.buildBoardFormatUserBlock
      ? window.BoardFormats.buildBoardFormatUserBlock() : '';
    const fullUserText = [userText, teachingRules.userBlock, dbUserBlock, boardFormatBlock, noteUserBlock, formatRouteBlock]
      .filter(Boolean).join('\n\n');
    const systemText = await getSystemPromptForSolve(matchInput, {
      ...solveOpts,
      teachingRulesAddon: teachingRules.systemAddon
    });

    if (textOnly) {
      apiMessages = [{
        role: 'user',
        content: fullUserText
      }];
    } else {
      const imageParts = imgDataURLs.map(item => ({
        type: 'image_url',
        image_url: { url: item.dataUrl, detail: 'high' }
      }));
      apiMessages = [{
        role: 'user',
        content: [
          ...imageParts,
          { type: 'text', text: fullUserText }
        ]
      }];
    }

    let { text: reply, truncated } = await callAPI(cfg, apiMessages, systemText, {
      temperature: 0.25,
      maxOutputTokens: 6144,
      timeoutMs: 120000,
      maxContinue: 0
    });
    const qctxSolve = appendStoichiometryTag(scopeInput || matchInput || textQuestion || autoHints);
    const postProcessOpts = { questionCtx: qctxSolve, solveSpec: solveOpts.solveSpec, formatRoute, forceStoichiometry: solveOpts.forceStoichiometry, temperature: 0.25, maxOutputTokens: 4096, timeoutMs: 90000 };
    if (typeof repairKspAgClReactionTables === 'function') reply = repairKspAgClReactionTables(reply, typeof getLastMatchInput === 'function' ? getLastMatchInput() : '');
    reply = await ensureQualityReply(cfg, apiMessages, systemText, reply, solveOpts.refAnswer, { refAnswerSkipped: solveOpts.refAnswerSkipped, ...postProcessOpts });
    const noteFallback = formatRoute.origin === 'auto'
      && /題目資訊不足|資料不足|圖片.*(?:不清|模糊)|無法辨識/.test(String(reply || ''));
    if (!noteFallback && typeof NoteEnsure !== 'undefined' && typeof NoteEnsure.ensureDensityReply === 'function') {
      reply = await NoteEnsure.ensureDensityReply(callAPI, cfg, apiMessages, systemText, reply, {
        ...postProcessOpts,
        maxNoteFix: 1,
        noteFixTemperature: 0.15
      });
    }
    apiMessages.push({ role: 'assistant', content: reply });
    setMainSolution(reply);
    const noteReport = typeof NoteCheck !== 'undefined' && NoteCheck.check ? NoteCheck.check(getQualityCheckText(reply)) : null;
    if (!isDatabaseEnabled()) {
      const ruleNote = teachingRules.ids?.length
        ? teachingRules.ids.join('、')
        : (typeof getTeachingRuleIdsFromLastMatch === 'function' ? getTeachingRuleIdsFromLastMatch().join('、') : '');
      setBadge(ruleNote ? `詳解完成（規定：${ruleNote}）` : '詳解完成（純提示詞）', '#EAF2ED', '#3D6B52');
    } else {
      const noteBadgeSuffix = noteReport && !noteReport.skipped && !noteReport.ok
        ? `｜${noteReport.summary}`
        : '';
      const match = getLastDatabaseMatch();
      if (match?.tier && match.tier < 3) {
        const verify = verifyAnswerLocally(reply, match.answerKey);
        let badgeNote = (match.isChapterRoutine || match.isChapterSo) && match.soLabel
          ? `章節套路：${match.soLabel}`
          : (match.solutionOnly
            ? `純詳解命中：${match.entryId}`
            : `${match.tierLabel}：${match.entryId}`);
        if (verify.note) badgeNote += verify.ok === false ? `（${verify.note}）` : '';
        if (match?.teachingRuleIds?.length) {
          badgeNote += `（規定：${match.teachingRuleIds.join('、')}）`;
        }
        setBadge(appendSolveModeTag(badgeNote + noteBadgeSuffix), match.tier === 1 ? '#E8F0FA' : '#F9F3E6', match.tier === 1 ? '#2E5C8A' : '#8A6D3B');
        if (verify.ok === false) toast(verify.note);
        else if (match.tier === 1) {
          toast(match.isChapterRoutine && match.soLabel
            ? `已命中章節套路：${match.soLabel}`
            : (match.solutionOnly
              ? `已命中純詳解範例：${match.entryId}`
              : `已命中資料庫：${match.entryId}`));
        }
      }
      if (!match?.tier || match.tier >= 3) {
        const conceptNote = match?.conceptLabels?.length
          ? `（概念參考：${match.conceptLabels.slice(0, 3).join('、')}）`
          : '';
        const styleNote = match?.styleEntryIds?.length
          ? `（風格參考：${match.styleEntryIds.join('、')}）`
          : '';
        const ruleNote = match?.teachingRuleIds?.length
          ? `（規定：${match.teachingRuleIds.join('、')}）`
          : '';
        setBadge(appendSolveModeTag(`未命中資料庫${styleNote}${conceptNote}${ruleNote}${noteBadgeSuffix}`), '#F9EDED', '#9B4444');
        toast(autoHints
          ? `未命中精準配對（已辨識：${autoHints.slice(0, 40)}…）${conceptNote}`
          : (conceptNote || '未命中資料庫：請確認題目已登記並執行同步資料庫'));
      } else if (autoHints && !textQuestion) {
        toast(`已自動配對：${autoHints.slice(0, 50)}${autoHints.length > 50 ? '…' : ''}`);
      }
    }
    if (truncated) toast('詳解可能未寫完，可往下捲動或追問補完');
  } catch (err) {
    console.error('解題失敗', err);
    setMainSolution(`❌ ${formatError(err.message)}`);
    setBadge('錯誤', '#F9EDED', '#9B4444');
  } finally {
    setBusy(false);
  }
}

async function sendFollowUp() {
  if (!cfg.key || busy) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !apiMessages.length) return;
  input.value = '';
  const block = appendFollowupUser(text);
  setBusy(true);
  setBadge('回覆中…', '#F9F3E6', '#8A6D3B');
  try {
    const supplementHint = document.getElementById('textQuestionInput')?.value.trim() || '';
    const explicitScope = typeof extractExplicitScopePhrase === 'function'
      ? extractExplicitScopePhrase(text)
      : '';
    const scopeInput = explicitScope
      ? [supplementHint, text].filter(Boolean).join(' ')
      : supplementHint;
    const combinedInput = [lastMatchInput, supplementHint, text].filter(Boolean).join(' ');
    updateSolveHeadingMode(scopeInput);
    const followOpts = {
      scopeInput,
      textOnly: !imgDataURLs.length,
      hasImage: !!imgDataURLs.length,
      detailed: detailMode,
      followUp: true,
      forceStoichiometry: isForceStoichiometry(),
      forceCalcCompact: isCalcCompact()
    };

    let rulesBlock = '';
    let teachingRulesSystemAddon = '';
    const needsChemRules = /混成|VSEPR|sp[\^²³]?|共振|價電子|路易斯|八隅體|結構式|畫.*結構/.test(text);
    if (needsChemRules && typeof resolveTeachingRulesForSolve === 'function') {
      try {
        const mainSolution = typeof getMainSolution === 'function' ? getMainSolution() : '';
        const resolved = await resolveTeachingRulesForSolve(combinedInput, {
          mainSolution,
          includeMainSolution: true
        });
        rulesBlock = resolved.userBlock;
        teachingRulesSystemAddon = resolved.systemAddon;
      } catch (err) {
        console.warn('追問教學規定載入失敗', err);
      }
    } else if (needsChemRules && typeof buildTeachingRulesUserBlock === 'function') {
      try {
        rulesBlock = await buildTeachingRulesUserBlock(combinedInput, { includeMainSolution: true });
      } catch (err) {
        console.warn('追問教學規定載入失敗', err);
      }
    }
    const followUserText = typeof window.buildFollowUpUserText === 'function'
      ? window.buildFollowUpUserText(text, {
        rulesBlock,
        detailed: detailMode
      })
      : text;

    apiMessages.push({ role: 'user', content: followUserText });
    const systemText = typeof window.getSystemPromptForFollowUp === 'function'
      ? await window.getSystemPromptForFollowUp(text, { teachingRulesAddon: teachingRulesSystemAddon })
      : await getSystemPromptForSolve(combinedInput, {
        ...followOpts,
        teachingRulesAddon: teachingRulesSystemAddon
      });
    const genOpts = {
      temperature: 0.25,
      maxOutputTokens: 4096,
      timeoutMs: 90000,
      maxContinue: 1
    };
    let { text: reply } = await callAPI(cfg, apiMessages, systemText, genOpts);
    reply = await ensureFollowUpBoardStyleReply(cfg, apiMessages, systemText, reply, { ...genOpts, questionCtx: text, followText: text });
    apiMessages.push({ role: 'assistant', content: reply });
    fillFollowupReply(block, reply);
    const ruleNote = typeof getLastTeachingRuleMatch === 'function'
      ? (getLastTeachingRuleMatch() || []).map(r => r.id).join('、')
      : '';
    setBadge(appendSolveModeTag(ruleNote ? `追問完成（規定：${ruleNote}）` : '追問完成'), '#EAF2ED', '#3D6B52');
  } catch (err) {
    apiMessages.pop();
    fillFollowupReply(block, `❌ ${formatError(err.message)}`);
    setBadge('錯誤', '#F9EDED', '#9B4444');
  } finally { setBusy(false); }
}

onProviderChange();
document.getElementById('chatInput').addEventListener('keydown', chatKeydown);
document.getElementById('textQuestionInput').addEventListener('input', () => {
  updateSolveButtonState();
  updateSolveSpecStatus();
});
document.getElementById('textQuestionInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); startSolve(); }
});
document.getElementById('answerInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); startSolve(); }
});
renderChapterOptions();
document.querySelectorAll('input[data-solve-type], input[data-chapter-id]').forEach((input) => {
  input.addEventListener('change', (event) => {
    if (event.target.dataset.chapterId && event.target.checked) {
      const selected = document.querySelectorAll('input[data-chapter-id]:checked');
      if (selected.length > 3) {
        event.target.checked = false;
        toast('章節類型最多可選 3 項。');
      }
    }
    updateSolveSpecStatus();
  });
});
updateSolveButtonState();
initSolveOptionToggles();
if (!cfg.key) setTimeout(openModal, 400);
if (typeof PromptCompose !== 'undefined' && PromptCompose.preload) {
  PromptCompose.preload().catch((err) => console.warn('[PromptCompose] preload', err));
}

(async () => {
  const st = await getDatabaseStatus();
  updateDatabaseStatusLine(st);
  if (st.ok) {
    console.log(`題庫：${st.loaded}/${st.total} 則，風格參考 ${st.styleRefs || 0} 則，含 meta ${st.withMeta || 0} 則`);
    const errs = (st.formatIssues || []).filter(f => f.level === 'error');
    if (errs.length) {
      console.warn('題庫格式錯誤：', errs);
      toast(`題庫有 ${errs.length} 檔格式錯誤，請修正 YAML 後重新同步`);
    }
  } else if (st.reason === 'fetch_failed') {
    toast('題庫讀取失敗，已用內建備援');
  }
  if (typeof PLAIN_LAYOUT_BUILD !== 'undefined') {
    console.info('[化學解題] 版面版本', PLAIN_LAYOUT_BUILD);
  }
})();

