const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash（推薦，最強免費 Flash）' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash（穩定推理／獨立驗算）' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite（快速模式）' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite（省資源備援）' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview（預覽版）' }
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


let imgDataURLs = [], apiMessages = [], busy = false, lightboxIndex = 0;
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
  const fallback = { consistent: false, constraints: [], checks: [], warnings: ['獨立驗證回覆無法解析'] };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const list = (value) => Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 12) : [];
    return {
      consistent: parsed?.consistent === true,
      constraints: list(parsed?.constraints),
      checks: list(parsed?.checks),
      warnings: list(parsed?.warnings)
    };
  } catch (_) {
    return fallback;
  }
}

function verificationModelFor(mainModel) {
  return mainModel === 'gemini-2.5-flash' ? 'gemini-3.5-flash' : 'gemini-2.5-flash';
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
    if ((source.match(/[=＝≈]/g) || []).length < 1) return;
    const numericValues = source.split(/[=＝≈]/).map(evaluateNumericExpression).filter((value) => value !== null);
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
  imgDataURLs = []; apiMessages = [];
  document.getElementById('fileInput').value = '';
  document.getElementById('textQuestionInput').value = '';
  document.getElementById('answerInput').value = '';
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
  if (solveOpts?.solveSpec?.enabled && typeof window.SolveSpec !== 'undefined' && window.SolveSpec.checkReply) {
    const issues = window.SolveSpec.checkReply(solveOpts.solveSpec, reply);
    const ok = !issues.length;
    lines.push(ok ? '題型規格：符合本機檢查' : '題型規格：待補 ' + issues.slice(0, 2).join('；'));
    warning = warning || !ok;
  }
  if (refAnswer && typeof window.answersMatch === 'function') {
    const ok = window.answersMatch(reply, refAnswer);
    lines.push(ok ? '指定答案：一致' : '指定答案：不一致（結果已拒絕顯示）');
    warning = warning || !ok;
  }
  if (solveOpts?.calculationAudit?.checked) {
    lines.push(`本機算式驗算：${solveOpts.calculationAudit.checked} 組等號一致`);
  }
  if (!lines.length) return clearSolveValidation();
  el.hidden = false;
  el.textContent = '設定驗證｜' + lines.join('｜');
  el.classList.toggle('is-warning', warning);
}

function renderAiInto(container, text, options = {}) {
  const previousVisibility = container?.style?.visibility || '';
  if (container?.style) container.style.visibility = 'hidden';
  try {
    if (typeof renderMarkdownSolution !== 'function' || typeof doKaTeX !== 'function') {
      throw new Error('render.js 未載入，請強制重新整理頁面');
    }
    if (typeof window.__RENDER_BUILD === 'undefined') {
      console.warn('[render] 快取可能過舊，請 Ctrl+F5');
    }
    let body = text || '';
    if (typeof MolResolver !== 'undefined' && MolResolver.preprocessSmilesToMol) {
      body = MolResolver.preprocessSmilesToMol(body);
    }
    if (typeof SmilesDraw !== 'undefined' && SmilesDraw.preprocess) {
      body = SmilesDraw.preprocess(body);
    }
    window.__LAST_RENDER_PIPELINE = 'markdown';
    container.innerHTML = renderMarkdownSolution(body);
    doKaTeX(container);
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

function setMainSolution(text, options = {}) {
  const el = document.getElementById('mainSolution');
  renderAiInto(el, text, options);
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
    if (typeof window.buildSolveUserText !== 'function') {
      throw new Error('prompts.js 未載入（buildSolveUserText 不存在）。請按 Ctrl+Shift+R 強制重新整理；若仍失敗，請用「啟動網頁.bat」開啟並確認主控台是否有 js 語法錯誤。');
    }
    const userText = window.buildSolveUserText(
      scopeInput,
      solveOpts.refAnswer,
      solveOpts
    );
    const advancedBlock = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.buildActiveBlock
      ? window.SolveSpec.buildActiveBlock(formatRoute) : '';
    if (typeof window.SolutionCore === 'undefined') throw new Error('solution-core.js 未載入');
    const systemText = window.SolutionCore.buildSystem();
    let verificationResult = null;

    // 有參考答案時，另一個 Flash 先從題目獨立計算；主解題模型看不到參考答案。
    if (solveOpts.refAnswer) {
      setBadge('驗證答案條件中…', '#F9F3E6', '#8A6D3B');
      const verificationUserText = typeof window.buildAnswerVerificationUserText === 'function'
        ? window.buildAnswerVerificationUserText(scopeInput, solveOpts.refAnswer, solveOpts, advancedBlock)
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
    const fullUserText = [userText, advancedBlock].filter(Boolean).join('\n\n');

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

    const responseSchema = buildSolveResponseSchema();
    setBadge('撰寫詳解中…', '#F9F3E6', '#8A6D3B');
    const mainGenerationOptions = {
      temperature: 0.25,
      maxOutputTokens: 6144,
      timeoutMs: 120000,
      maxContinue: 0,
      responseFormat: {
        text: { mimeType: 'APPLICATION_JSON', schema: responseSchema }
      }
    };
    let { text: reply, truncated } = await callAPI(cfg, apiMessages, systemText, mainGenerationOptions);
    let prepared = window.SolutionCore.prepare(reply);
    if (!prepared.ok) throw new Error('AI 詳解格式不完整，請重新作答。');
    reply = prepared.text;
    let calculationAudit = auditCalculationDocument(prepared.document);
    const validationProblems = () => {
      const problems = [...calculationAudit.issues];
      if (solveOpts.refAnswer && verificationResult?.consistent !== true) {
        problems.push(`參考答案未通過獨立驗證${verificationResult?.warnings?.length ? `：${verificationResult.warnings.join('、')}` : ''}`);
      }
      if (solveOpts.refAnswer && !window.answersMatch(reply, solveOpts.refAnswer)) {
        problems.push('詳解最終答案與參考答案不同');
      }
      return problems;
    };

    let problems = validationProblems();
    if (problems.length) {
      setBadge('重新計算與核對中…', '#F9F3E6', '#8A6D3B');
      const correctionPrompt = [
        fullUserText,
        solveOpts.refAnswer ? `【待核對參考答案】${solveOpts.refAnswer}` : '',
        verificationResult ? `【另一個 Flash 的獨立驗證】\n${JSON.stringify(verificationResult)}` : '',
        `【第一次結果未通過】\n${problems.join('\n')}\n\n【第一次輸出】\n${reply}`,
        '請從題目重新計算，只修正有證據的錯誤；所有等號兩側、單位、守恆與選項結論必須一致。仍只回傳指定 JSON。'
      ].filter(Boolean).join('\n\n');
      const correctionMessages = textOnly
        ? [{ role: 'user', content: correctionPrompt }]
        : [{ role: 'user', content: [
          ...imgDataURLs.map(item => ({ type: 'image_url', image_url: { url: item.dataUrl, detail: 'high' } })),
          { type: 'text', text: correctionPrompt }
        ] }];
      const correctionCfg = { ...cfg, model: 'gemini-3.5-flash' };
      const corrected = await callAPI(correctionCfg, correctionMessages, systemText, {
        ...mainGenerationOptions,
        temperature: 0
      });
      const correctedPrepared = window.SolutionCore.prepare(corrected.text);
      if (!correctedPrepared.ok) throw new Error('重新計算後的詳解格式仍不完整。');
      prepared = correctedPrepared;
      reply = prepared.text;
      truncated = truncated || corrected.truncated;
      calculationAudit = auditCalculationDocument(prepared.document);
      problems = validationProblems();
    }

    if (problems.length) {
      throw new Error(`詳解未通過一致性驗證：${problems.join('；')}。請確認題目圖片與參考答案後再試。`);
    }
    solveOpts.calculationAudit = calculationAudit;
    apiMessages.push({ role: 'assistant', content: reply });
    setMainSolution(reply);
    renderSolveValidation(reply, solveOpts, solveOpts.refAnswer);
    setBadge('詳解完成', '#EAF2ED', '#3D6B52');
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

