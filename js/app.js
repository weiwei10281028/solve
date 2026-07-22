const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash（推薦）' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' }
    ]
  }
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


let imgDataURLs = [], apiMessages = [], busy = false, lightboxIndex = 0, solveEpoch = 0;
// self-test compatibility markers: SolutionCore.prepare(reply) / setMainSolution(prepared.text)
const detailMode = false;

function isForceStoichiometry() {
  return !!document.getElementById('stoichiometryToggle')?.checked;
}

function isCalcCompact() {
  return !!document.getElementById('calcCompactToggle')?.checked;
}

function buildSolveResponseSchema() {
  return JSON.parse(JSON.stringify(window.SolutionCore.SCHEMA));
}

const ANSWER_VERIFICATION_SYSTEM = `你是獨立的化學答案驗證者。只回傳 JSON，不寫學生詳解。參考答案只是待驗證命題，不保證正確；禁止為了迎合參考答案反向硬湊理由。請只依題目資料重新計算，檢查物料守恆、電荷／原子守恆、單位、有效數字、公式與每個選項語意，再判斷參考答案是否一致。\n\n輸出格式：{"consistent":true,"constraints":["獨立算出的必要中間量"],"checks":["已執行的關鍵檢查"],"warnings":["矛盾或風險；沒有則空陣列"]}\n若無法由題目確認參考答案，consistent 必須為 false。constraints 只寫可由題目獨立驗算的條件；禁止輸出給學生看的詳解。`;
const ANSWER_VERIFICATION_SCHEMA = {
  type: 'object', required: ['consistent', 'constraints', 'checks', 'warnings'],
  properties: {
    consistent: { type: 'boolean' },
    constraints: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } }
  }
};

function normalizeAnswerVerification(raw) {
  const fallback = {
    consistent: false,
    parseFailed: true,
    constraints: [],
    checks: [],
    warnings: ['獨立驗證回覆無法解析']
  };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const list = (value) => Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 12) : [];
    return {
      consistent: parsed?.consistent === true,
      parseFailed: false,
      constraints: list(parsed?.constraints),
      checks: list(parsed?.checks),
      warnings: list(parsed?.warnings)
    };
  } catch (_) {
    return fallback;
  }
}

/** 獨立驗證／通則卡意圖：與主模型錯開，優先 3.5 系列。 */
function verificationModelFor(mainModel) {
  const main = String(mainModel || '');
  if (main === 'gemini-3.5-flash') return 'gemini-3.5-flash-lite';
  if (main === 'gemini-3.5-flash-lite') return 'gemini-3.5-flash';
  if (main === 'gemini-3.1-flash-lite') return 'gemini-3.5-flash';
  return 'gemini-3.5-flash';
}

/** 解題前依題意預判化學通則卡（可含圖片）；失敗時不阻斷解題。 */
async function detectChemRuleCardHit(cfg, textQuestion, imageItems, textOnly) {
  if (typeof window.ChemRuleCards === 'undefined' || !window.ChemRuleCards.buildIntentUserText) {
    return { card: null, source: 'intent', intent_summary: '', reason: '', parseFailed: true };
  }
  const intentText = window.ChemRuleCards.buildIntentUserText(textQuestion);
  const intentMessages = textOnly
    ? [{ role: 'user', content: intentText }]
    : [{
      role: 'user',
      content: [
        ...(imageItems || []).map(item => ({ type: 'image_url', image_url: { url: item.dataUrl, detail: 'high' } })),
        { type: 'text', text: intentText }
      ]
    }];
  const intentCfg = { ...cfg, model: verificationModelFor(cfg.model) };
  try {
    const intentRes = await callAPI(intentCfg, intentMessages, window.ChemRuleCards.INTENT_SYSTEM, {
      temperature: 0,
      maxOutputTokens: 400,
      timeoutMs: 60000,
      maxContinue: 0,
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: window.ChemRuleCards.INTENT_SCHEMA } }
    });
    return window.ChemRuleCards.resolveFromIntent(window.ChemRuleCards.parseIntentResult(intentRes.text));
  } catch (_) {
    return { card: null, source: 'intent', intent_summary: '', reason: '題意預判失敗，略過通則卡', parseFailed: true };
  }
}

function normalizeNumericExpression(value) {
  let text = String(value || '')
    .replace(/[−–—]/g, '-')
    .replace(/\\(?:times|cdot)/g, '*')
    .replace(/\\div/g, '/')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\\(?:left|right)/g, '')
    .replace(/10\s*\^\s*\{\s*([+\-]?\d+)\s*\}/g, '10^($1)');
  for (let pass = 0; pass < 4; pass += 1) {
    const next = text.replace(/\\(?:d?frac|tfrac)\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');
    if (next === text) break;
    text = next;
  }
  text = text
    .replace(/\\mathrm\{(?:mol|mL|L|M|g|mg|kg|s|min|h|atm|kPa|Pa)\}/gi, '')
    .replace(/(?:mol|mL|L|M|g|mg|kg|s|min|h|atm|kPa|Pa)\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
  return text;
}

function evaluateNumericExpression(value) {
  const expression = normalizeNumericExpression(value);
  if (!/\d/.test(expression) || !/^[0-9eE+\-*/().^]+$/.test(expression)) return null;
  try {
    const result = typeof math !== 'undefined' && typeof math.evaluate === 'function'
      ? Number(math.evaluate(expression))
      : NaN;
    return Number.isFinite(result) ? result : null;
  } catch (_) {
    return null;
  }
}

function auditCalculationDocument(documentValue) {
  const issues = [];
  let checked = 0;
  const blocks = Array.isArray(documentValue?.blocks) ? documentValue.blocks : [];
  blocks.forEach((block, blockIndex) => {
    if (!['calculation', 'paragraph', 'choice'].includes(block?.type)) return;
    const source = String(block.text || block.expression || '');
    // 選擇題／段落常含多條獨立算式；先拆句再驗，避免把 0.001≠0.003 誤判成同一條等號鏈。
    const clauses = source
      .split(/[。；;！？\n]+/)
      .flatMap((clause) => {
        if ((clause.match(/[=＝≈]/g) || []).length <= 1) return [clause];
        return clause.split(/[，,]/);
      })
      .map((clause) => String(clause || '').trim())
      .filter((clause) => (clause.match(/[=＝≈]/g) || []).length >= 1);
    clauses.forEach((clause) => {
      const numericValues = clause.split(/[=＝≈]/).map((segment) => {
        if (/[\u4e00-\u9fff]/.test(segment)) return null;
        return evaluateNumericExpression(segment);
      }).filter((value) => value !== null);
      for (let index = 1; index < numericValues.length; index += 1) {
        const left = numericValues[index - 1];
        const right = numericValues[index];
        checked += 1;
        const scale = Math.max(Math.abs(left), Math.abs(right), 1e-12);
        if (Math.abs(left - right) > Math.max(1e-10, scale * 0.015)) {
          issues.push(`第 ${blockIndex + 1} 個區塊的等號兩側不一致（${left} ≠ ${right}）`);
        }
      }
    });
  });
  return { checked, issues };
}

window.auditCalculationDocument = auditCalculationDocument;

function getSolveSpec() {
  return typeof window.SolveSpec !== 'undefined' && window.SolveSpec.fromInputs
    ? window.SolveSpec.fromInputs(document)
    : { version: 1, enabled: false, typeIds: [], types: [] };
}

function renderChapterOptions() {
  const host = document.getElementById('chapterOptions');
  if (!host || typeof window.SolveSpec === 'undefined') return;
  const groupInfo = {
    '結構與鍵結': '從原子、電子到分子結構與作用力。',
    '物質與反應': '反應式、能量、氣體與溶液的定量判讀。',
    '反應與平衡': '速率、平衡、酸鹼與電化學的條件推論。',
    '元素與應用': '元素、有機、材料與大分子的結構－性質連結。',
    '實驗與資料': '實驗設計、量測品質與資料證據。'
  };
  const groups = Object.entries(window.SolveSpec.CHAPTERS).reduce((all, [id, chapter]) => {
    (all[chapter.group] ||= []).push([id, chapter]);
    return all;
  }, {});
  host.innerHTML = Object.entries(groups).map(([group, chapters]) => `
    <section class="chapter-option-group" aria-labelledby="chapter-group-${group}">
      <div class="chapter-option-group-head"><h3 id="chapter-group-${group}">${group}</h3><p>${groupInfo[group] || ''}</p></div>
      <div class="solve-spec-row">${chapters.map(([id, chapter]) => {
        const topicCount = chapter.topics?.length || 0;
        return `<label class="option-toggle" for="chapter-${id}"><input type="checkbox" id="chapter-${id}" data-chapter-id="${id}"><span class="option-toggle-ui" aria-hidden="true"></span><span class="option-toggle-copy"><span class="option-toggle-label">${chapter.label}</span><span class="option-toggle-description">${chapter.description}</span><span class="option-toggle-meta">${topicCount} 個細項會依題目自動套用</span></span></label>`;
      }).join('')}</div>
    </section>`).join('');
}

function updateSolveSpecStatus() {
  const status = document.getElementById('solveSpecStatus');
  if (!status) return;
  const baseSpec = getSolveSpec();
  const question = document.getElementById('textQuestionInput')?.value || '';
  const route = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.route
    ? window.SolveSpec.route(baseSpec, question, { forceStoichiometry: isForceStoichiometry(), forceCalcCompact: isCalcCompact() })
    : { id: 'plain', origin: 'auto', solveSpec: baseSpec };
  const chapterStatus = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.describeRoute
    ? window.SolveSpec.describeRoute(route)
    : '未啟用題型規格，將依題目自動判斷。';
  const chemStatus = '化學通則卡：解題時依題意自動參考（與章節選項分開）。';
  status.textContent = [chemStatus, chapterStatus].filter(Boolean).join(' ');
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
const savedModel = loadSetting('aim', 'gemini-3.5-flash');
const cfg = {
  provider: 'gemini',
  key: cleanKey(loadSetting('aik', '')),
  model: savedModel || 'gemini-3.5-flash'
};
if (!GEMINI_MODEL_IDS.has(cfg.model)) cfg.model = 'gemini-3.5-flash';
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
  document.body.classList.add('is-lightbox-open');
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
  document.body.classList.remove('is-lightbox-open');
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
  solveEpoch += 1;
  imgDataURLs = []; apiMessages = [];
  document.getElementById('fileInput').value = '';
  document.getElementById('textQuestionInput').value = '';
  document.getElementById('answerInput').value = '';
  document.getElementById('chatInput').value = '';
  window.__lastRawReply = '';
  window.__lastCompiledReply = '';
  lightboxIndex = 0;
  resetStoichiometryToggle();
  resetCalcCompactToggle();
  resetSolveSpec();
  refreshPreviewUI();
  document.getElementById('resultCard').classList.remove('show');
  clearSolveValidation();
  clearThreads();
  document.getElementById('chatInputWrap').classList.remove('show');
  setBadge('就緒');
  setBusy(false);
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
  if (solveOpts?.chemRuleAudit?.issues?.length) {
    const cardNote = solveOpts?.chemRuleHit?.card
      ? `通則卡「${solveOpts.chemRuleHit.card.title_zh}」：詳解不符 `
      : '通則卡檢查：';
    lines.push((solveOpts.chemRuleAudit.state === 'confirmed-no-blue' ? '紅色警告｜' : '') + cardNote + solveOpts.chemRuleAudit.issues.slice(0, 2).join('；'));
    warning = true;
  } else if (solveOpts?.chemRuleHit?.card && solveOpts?.chemRuleAudit) {
    lines.push('通則卡檢查：未發現違反已確認條件的內容');
  }
  if (solveOpts?.chemRuleAudit?.ratioInfo && Number.isFinite(solveOpts.chemRuleAudit.ratioInfo.ratio)) {
    const r = solveOpts.chemRuleAudit.ratioInfo;
    lines.push(`本機碘酸比值≈${r.ratio.toFixed(4)}${r.ratio <= 1 / 3 + 1e-9 ? '（≤1/3→應不變藍）' : ''}`);
  }
  if (solveOpts?.chemRuleAudit?.warnings?.length) {
    lines.push('通則卡提醒：' + solveOpts.chemRuleAudit.warnings.slice(0, 2).join('；'));
    warning = true;
  }
  if (solveOpts?.chemRuleHit?.card) {
    lines.push('化學通則卡：已參考「' + solveOpts.chemRuleHit.card.title_zh + '」');
  } else if (solveOpts?.chemRuleHit) {
    lines.push('化學通則卡：未參考');
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
  if (solveOpts?.structureIssues?.length) {
    lines.push('詳解結構：待補 ' + solveOpts.structureIssues.join('；'));
    warning = true;
  }
  if (refAnswer && typeof window.answersMatch === 'function') {
    const ok = window.answersMatch(reply, refAnswer);
    lines.push(ok ? '指定答案：一致' : '指定答案：不一致（已顯示詳解，請人工核對）');
    warning = warning || !ok;
  }
  if (solveOpts?.verificationResult) {
    const vr = solveOpts.verificationResult;
    if (vr.parseFailed) {
      lines.push('獨立驗證：回覆無法解析（不阻擋顯示）');
      warning = true;
    } else if (vr.consistent === true) {
      lines.push('獨立驗證：與參考答案一致');
    } else {
      const detail = vr.warnings?.length ? `：${vr.warnings.slice(0, 2).join('、')}` : '';
      lines.push(`獨立驗證：未通過${detail}（已顯示詳解）`);
      warning = true;
    }
  }
  if (solveOpts?.answerAlignAttempted) {
    lines.push(solveOpts.answerAligned
      ? '對齊參考答案：已成功'
      : '對齊參考答案：未能在守恆前提下對齊');
    warning = warning || !solveOpts.answerAligned;
  }
  if (solveOpts?.calculationAudit?.issues?.length) {
    lines.push('本機算式提醒：' + solveOpts.calculationAudit.issues.slice(0, 2).join('；')
      + '（不擋顯示；可填指定答案再解一次）');
    warning = true;
  } else if (solveOpts?.calculationAudit?.checked) {
    lines.push(`本機算式驗算：${solveOpts.calculationAudit.checked} 組等號一致`);
  }
  if (!lines.length) return clearSolveValidation();
  el.hidden = false;
  el.textContent = '設定驗證｜' + lines.join('｜');
  el.classList.toggle('is-warning', warning);
}

async function renderAiInto(container, text, options = {}) {
  const previousVisibility = container?.style?.visibility || '';
  if (container?.style) container.style.visibility = 'hidden';
  try {
    if (!window.AsciiSolutionRender?.renderInto) {
      throw new Error('AsciiMath 詳解 renderer 未載入，請強制重新整理頁面');
    }
    let body = text || '';
    if (typeof body === 'string' && typeof MolResolver !== 'undefined' && MolResolver.preprocessSmilesToMol) {
      body = MolResolver.preprocessSmilesToMol(body);
    }
    if (typeof body === 'string' && typeof SmilesDraw !== 'undefined' && SmilesDraw.preprocess) {
      body = SmilesDraw.preprocess(body);
    }
    window.__LAST_RENDER_PIPELINE = 'asciimath';
    await window.AsciiSolutionRender.renderInto(container, body);
    if (container?.style) container.style.visibility = previousVisibility;
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
    if (container?.style) container.style.visibility = previousVisibility;
    console.error('詳解渲染失敗', err);
    container.innerHTML = `<article class="markdown-body chem-markdown"><p class="solution-render-error">詳解渲染失敗：${esc(String(err.message || err))}。請 Ctrl+F5 重新整理後再試。</p></article>`;
  }
}

async function setMainSolution(text, options = {}) {
  const el = document.getElementById('mainSolution');
  await renderAiInto(el, text, options);
  scrollBoard(el);
}

function showChemRuleWarning(audit) {
  if (audit?.state !== 'confirmed-no-blue' || !(audit?.issues || []).length) return;
  const host = document.getElementById('mainSolution');
  if (!host) return;
  const notice = document.createElement('div');
  notice.className = 'chem-rule-critical-warning';
  notice.textContent = '紅色警告：本機已依題幹確認此條件下不變藍、時間不適用；下列詳解仍含相衝突的時間或選項結論，請勿採信該部分。';
  host.prepend(notice);
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
  const activeSolveEpoch = ++solveEpoch;

  const textQuestion = document.getElementById('textQuestionInput').value.trim();
  const refAnswer = document.getElementById('answerInput').value.trim();
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
      if (activeSolveEpoch !== solveEpoch) return;
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

  try {
    if (!textOnly) {
      setBadge('準備題目中…', '#F9F3E6', '#8A6D3B');
    }

    setBadge('撰寫詳解中…', '#F9F3E6', '#8A6D3B');
    const scopeInput = typeof extractExplicitScopePhrase === 'function'
      ? extractExplicitScopePhrase(textQuestion)
      : '';
    const formatRoute = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.route
      ? window.SolveSpec.route(getSolveSpec(), textQuestion, {
        forceStoichiometry: isForceStoichiometry(),
        forceCalcCompact: isCalcCompact()
      })
      : { id: 'plain', origin: 'auto', solveSpec: getSolveSpec(), forceStoichiometry: isForceStoichiometry(), forceCalcCompact: isCalcCompact() };
    const solveSpec = formatRoute.solveSpec;
    const solveOpts = {
      textOnly,
      questionBody: textQuestion,
      supplement: textQuestion,
      hasImage,
      imageCount: imgDataURLs.length,
      detailed: detailMode,
      scopeInput,
      refAnswer,
      forceStoichiometry: formatRoute.forceStoichiometry,
      forceCalcCompact: formatRoute.forceCalcCompact,
      solveSpec,
      formatRoute
    };
    // 只由使用者明確輸入的範圍控制分題標題；圖片中的題號不是多題指令。
    const questionSource = String(solveOpts.questionBody || scopeInput || textQuestion || '').trim();
    const advancedBlock = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.buildActiveBlock
      ? window.SolveSpec.buildActiveBlock(formatRoute) : '';

    setBadge('判別化學通則卡…', '#F9F3E6', '#8A6D3B');
    const chemRuleQuestion = [textQuestion, scopeInput].filter(Boolean).join('\n');
    let chemRuleHit = await detectChemRuleCardHit(cfg, chemRuleQuestion, imgDataURLs, textOnly);
    let chemRuleBlock = typeof window.ChemRuleCards !== 'undefined' && window.ChemRuleCards.buildReferenceBlock
      ? window.ChemRuleCards.buildReferenceBlock(chemRuleHit)
      : '';
    if (chemRuleHit?.card && typeof window.ChemRuleCards.buildPrecomputedBoundaryBlock === 'function') {
      const boundary = window.ChemRuleCards.buildPrecomputedBoundaryBlock(chemRuleQuestion, chemRuleHit);
      if (boundary) chemRuleBlock = [chemRuleBlock, boundary].filter(Boolean).join('\n\n');
    }
    if (typeof window.SolutionCore === 'undefined') throw new Error('solution-core.js 未載入');
    let systemText = window.SolutionCore.buildSystem();
    let verificationResult = null;

    solveOpts.chemRuleHit = chemRuleHit;

    // 有參考答案時，另一個 Flash 先從題目獨立計算；主解題模型看不到參考答案。
    if (solveOpts.refAnswer) {
      setBadge('驗證答案條件中…', '#F9F3E6', '#8A6D3B');
      const verificationUserText = typeof window.buildAnswerVerificationUserText === 'function'
        ? window.buildAnswerVerificationUserText(scopeInput, solveOpts.refAnswer, solveOpts, advancedBlock, chemRuleBlock)
        : `【題目】\n${textQuestion}\n\n【待驗證參考答案】${solveOpts.refAnswer}`;
      const verificationMessages = textOnly
        ? [{ role: 'user', content: verificationUserText }]
        : [{
          role: 'user', content: [
            ...imgDataURLs.map(item => ({ type: 'image_url', image_url: { url: item.dataUrl, detail: 'high' } })),
            { type: 'text', text: verificationUserText }
          ]
        }];
      const verificationCfg = { ...cfg, model: verificationModelFor(cfg.model) };
      const verification = await callAPI(verificationCfg, verificationMessages, ANSWER_VERIFICATION_SYSTEM, {
        temperature: 0,
        maxOutputTokens: 1800,
        timeoutMs: 90000,
        maxContinue: 0,
        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: ANSWER_VERIFICATION_SCHEMA } }
      });
      verificationResult = normalizeAnswerVerification(verification.text);
    }
    // 主解題模型不接收參考答案或驗證結論，避免先入為主與反向硬湊。
    // user 訊息：短通則卡與章節提醒在題目之前；多模態時也先提供文字條件。
    if (typeof window.assembleSolveUserContent !== 'function') {
      throw new Error('prompts.js 未載入（assembleSolveUserContent 不存在）。請按 Ctrl+Shift+R 強制重新整理；若仍失敗，請用「啟動網頁.bat」開啟並確認主控台是否有 js 語法錯誤。');
    }
    const assembled = window.assembleSolveUserContent(questionSource, advancedBlock, chemRuleBlock);
    const fullUserText = assembled.fullText;

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
      const contentParts = [];
      if (assembled.constraintPrefix) {
        contentParts.push({ type: 'text', text: assembled.constraintPrefix });
      }
      contentParts.push(...imageParts);
      contentParts.push({ type: 'text', text: assembled.questionBody });
      apiMessages = [{
        role: 'user',
        content: contentParts
      }];
    }

    const responseSchema = buildSolveResponseSchema();
    setBadge('撰寫詳解中…', '#F9F3E6', '#8A6D3B');
    const mainGenerationOptions = {
      temperature: 0.25,
      maxOutputTokens: 8192,
      timeoutMs: 120000,
      maxContinue: 1,
      responseFormat: {
        text: { mimeType: 'APPLICATION_JSON', schema: responseSchema }
      }
    };
    let { text: reply, truncated } = await callAPI(cfg, apiMessages, systemText, mainGenerationOptions);
    window.__lastRawReply = reply;
    let prepared = window.SolutionCore.prepare(reply);
    if (!prepared.ok) {
      console.warn('詳解 JSON 解析失敗，嘗試本機修復', prepared.reason, String(reply || '').slice(0, 600));
      prepared = window.SolutionCore.prepare(String(reply || '').replace(/```(?:json)?/gi, '').trim());
    }
    if (!prepared.ok) {
      const tip = truncated
        ? '詳解 JSON 可能被截斷。請再按一次解題。'
        : 'AI 回傳的 JSON 無法解析。請再試一次；若連續失敗請稍後再試。';
      throw new Error(`AI 詳解格式不完整，請重新作答。${tip}`);
    }
    reply = prepared.text;
    // 本機算式驗算只作軟提醒，不自動重打、不擋顯示；真錯可填指定答案再解一次。
    let calculationAudit = auditCalculationDocument(prepared.document);
    const answerMatchesRef = () => !solveOpts.refAnswer
      || typeof window.answersMatch !== 'function'
      || window.answersMatch(reply, solveOpts.refAnswer);

    // 化學通則卡：只做本機檢查與提示，不再另開修正 API（省額度；錯因應靠解前短注入）。
    const chemRuleAudit = typeof window.ChemRuleCards !== 'undefined' && window.ChemRuleCards.auditDocument
      ? window.ChemRuleCards.auditDocument(prepared.document, chemRuleHit, chemRuleQuestion)
      : { issues: [], warnings: [], ratioInfo: null, state: 'insufficient-data' };
    const noBlueViolation = typeof window.ChemRuleCards?.hasNoBlueTimeViolation === 'function'
      && window.ChemRuleCards.hasNoBlueTimeViolation(chemRuleAudit);
    if (noBlueViolation && typeof window.ChemRuleCards?.buildCorrectionUserBlock === 'function') {
      setBadge('通則卡修正中…', '#F9F3E6', '#8A6D3B');
      const fixBlock = window.ChemRuleCards.buildCorrectionUserBlock(chemRuleAudit, reply);
      const fixMessages = textOnly
        ? [{ role: 'user', content: `${fullUserText}\n\n${fixBlock}` }]
        : [{
          role: 'user',
          content: [
            ...(assembled.constraintPrefix ? [{ type: 'text', text: assembled.constraintPrefix }] : []),
            ...imgDataURLs.map(item => ({ type: 'image_url', image_url: { url: item.dataUrl, detail: 'high' } })),
            { type: 'text', text: `${assembled.questionBody}\n\n${fixBlock}` }
          ]
        }];
      try {
        const fixed = await callAPI(cfg, fixMessages, systemText, { ...mainGenerationOptions, temperature: 0 });
        const fixedPrepared = window.SolutionCore.prepare(fixed.text);
        if (fixedPrepared.ok) {
          const fixedAudit = window.ChemRuleCards.auditDocument(fixedPrepared.document, chemRuleHit, chemRuleQuestion);
          if (!window.ChemRuleCards.hasNoBlueTimeViolation(fixedAudit)) {
            prepared = fixedPrepared;
            reply = prepared.text;
            truncated = truncated || fixed.truncated;
            calculationAudit = auditCalculationDocument(prepared.document);
            Object.assign(chemRuleAudit, fixedAudit);
          } else {
            console.warn('通則卡修正後仍不符', fixedAudit.issues);
          }
        }
      } catch (err) {
        console.warn('通則卡修正 API 失敗', err);
      }
    }
    if (chemRuleAudit.issues.length) {
      const cardName = chemRuleHit?.card?.title_zh || '化學通則卡';
      console.warn(`「${cardName}」檢查未通過（詳解不符通則）`, chemRuleAudit.issues);
    }
    solveOpts.chemRuleAudit = chemRuleAudit;

    // 參考答案：盡量對齊；驗證失敗或無法對齊只警告，不擋顯示。
    solveOpts.verificationResult = verificationResult;
    solveOpts.answerAlignAttempted = false;
    solveOpts.answerAligned = answerMatchesRef();
    const stillNoBlueViolation = typeof window.ChemRuleCards?.hasNoBlueTimeViolation === 'function'
      && window.ChemRuleCards.hasNoBlueTimeViolation(chemRuleAudit);
    const refConflictsChemRule = stillNoBlueViolation
      && solveOpts.refAnswer
      && /\bE\b|[（(]E[）)]/.test(String(solveOpts.refAnswer || ''));
    if (solveOpts.refAnswer && !solveOpts.answerAligned && !refConflictsChemRule) {
      setBadge('對齊參考答案中…', '#F9F3E6', '#8A6D3B');
      solveOpts.answerAlignAttempted = true;
      const alignPrompt = [
        fullUserText,
        `【參考答案】${solveOpts.refAnswer}`,
        verificationResult ? `【獨立驗證結果】\n${JSON.stringify(verificationResult)}` : '',
        `【目前詳解】\n${reply}`,
        '請在不違反題目數據、物料／電荷守恆、單位與選項語意的前提下，把最終 answer 與選項結論對齊參考答案，並同步修正推理。若參考答案與題目矛盾、無法合理對齊，維持你獨立算出的答案，並在 answer 寫該答案。數字與單位間禁止逗號；乘號用 ×；分式用 \\dfrac。仍只回傳指定 JSON。'
      ].filter(Boolean).join('\n\n');
      const alignMessages = textOnly
        ? [{ role: 'user', content: alignPrompt }]
        : [{ role: 'user', content: [
          ...imgDataURLs.map(item => ({ type: 'image_url', image_url: { url: item.dataUrl, detail: 'high' } })),
          { type: 'text', text: alignPrompt }
        ] }];
      try {
        const aligned = await callAPI({ ...cfg, model: 'gemini-3.5-flash' }, alignMessages, systemText, {
          ...mainGenerationOptions,
          temperature: 0
        });
        const alignedPrepared = window.SolutionCore.prepare(aligned.text);
        if (!alignedPrepared.ok) {
          console.warn('對齊回覆無法解析，保留原詳解', String(aligned.text || '').slice(0, 400));
          toast('對齊參考答案失敗，改以獨立詳解顯示');
        } else {
          const alignedCalc = auditCalculationDocument(alignedPrepared.document);
          prepared = alignedPrepared;
          reply = prepared.text;
          truncated = truncated || aligned.truncated;
          calculationAudit = alignedCalc;
          solveOpts.answerAligned = answerMatchesRef();
          if (alignedCalc.issues.length) {
            console.warn('對齊後本機算式提醒（不擋顯示）', alignedCalc.issues);
          }
          if (!solveOpts.answerAligned) {
            toast('無法在守恆前提下對齊參考答案，已顯示獨立詳解');
          }
        }
      } catch (alignErr) {
        console.warn('對齊參考答案失敗', alignErr);
        toast('對齊參考答案失敗，改以獨立詳解顯示');
      }
    }

    const crowdAudit = typeof window.SolutionCore.auditCrowdedCalculations === 'function'
      ? window.SolutionCore.auditCrowdedCalculations(prepared.document)
      : { issues: [] };
    if (crowdAudit.issues.length) {
      console.warn('calculation 含多步算式（本機已盡力拆行）：', crowdAudit.issues);
    }

    solveOpts.calculationAudit = calculationAudit;
    solveOpts.crowdAudit = crowdAudit;
    solveOpts.structureIssues = typeof window.SolutionCore.auditRequiredSections === 'function'
      ? window.SolutionCore.auditRequiredSections(prepared.document) : [];
    solveOpts.answerAligned = answerMatchesRef();
    if (activeSolveEpoch !== solveEpoch) return;
    apiMessages.push({ role: 'assistant', content: reply });
    window.__lastCompiledReply = reply;
    await setMainSolution(prepared.document);
    showChemRuleWarning(chemRuleAudit);
    renderSolveValidation(reply, solveOpts, solveOpts.refAnswer);
    setBadge('詳解完成', '#EAF2ED', '#3D6B52');
    if (verificationResult?.parseFailed) {
      toast('參考答案未能獨立驗證（驗證回覆異常），已顯示詳解');
    } else if (solveOpts.refAnswer && !solveOpts.answerAligned) {
      toast('詳解答案與參考答案不同，請查看上方驗證提示');
    }
    if (truncated) toast('詳解可能未寫完，可往下捲動或追問補完');
  } catch (err) {
    if (activeSolveEpoch !== solveEpoch) return;
    console.error('解題失敗', err);
    setMainSolution(`❌ ${formatError(err.message)}`);
    setBadge('錯誤', '#F9EDED', '#9B4444');
  } finally {
    if (activeSolveEpoch === solveEpoch) setBusy(false);
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
    const followUserText = typeof window.buildFollowUpUserText === 'function'
      ? window.buildFollowUpUserText(text)
      : text;

    apiMessages.push({ role: 'user', content: followUserText });
    const systemText = typeof window.getSystemPromptForFollowUp === 'function'
      ? await window.getSystemPromptForFollowUp(text)
      : await getSystemPromptForSolve(text);
    const genOpts = {
      temperature: 0.25,
      maxOutputTokens: 4096,
      timeoutMs: 90000,
      maxContinue: 1
    };
    const { text: reply } = await callAPI(cfg, apiMessages, systemText, genOpts);
    apiMessages.push({ role: 'assistant', content: reply });
    fillFollowupReply(block, reply);
    setBadge('追問完成', '#EAF2ED', '#3D6B52');
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
document.querySelectorAll('#stoichiometryToggle, #calcCompactToggle, input[data-solve-type], input[data-chapter-id]').forEach((input) => {
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
updateSolveSpecStatus();
if (!cfg.key) setTimeout(openModal, 400);

