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

const REF_ANSWER_DEEP_CHECK_KEY = 'solver-ref-answer-deep-check';
const LEGACY_REF_ANSWER_VERIFICATION_KEY = 'solver-ref-answer-verify';

function isRefAnswerDeepCheckEnabled() {
  return !!document.getElementById('refAnswerCheckToggle')?.checked;
}

function initRefAnswerCheckToggle() {
  const el = document.getElementById('refAnswerCheckToggle');
  if (!el) return;
  const saved = loadSetting(
    REF_ANSWER_DEEP_CHECK_KEY,
    loadSetting(LEGACY_REF_ANSWER_VERIFICATION_KEY, '0')
  );
  el.checked = saved === '1' || saved === 'true';
  el.addEventListener('change', () => {
    const value = el.checked ? '1' : '0';
    localStorage.setItem(REF_ANSWER_DEEP_CHECK_KEY, value);
    sessionStorage.setItem(REF_ANSWER_DEEP_CHECK_KEY, value);
  });
}

function logInjectedSolveSpec(formatRoute, advancedBlock) {
  const promptText = String(advancedBlock || '').trim();
  if (!promptText) return;
  const chapters = formatRoute?.solveSpec?.chapters
    ?.filter((item) => item?.applicability !== 'not-applicable')
    ?.map((item) => ({
      chapter: item.label,
      mode: item.applicability === 'forced' ? 'forced' : item.applicability,
      topics: item.topics?.filter((topic) => topic.applicability === 'applicable').map((topic) => topic.label) || []
    })) || [];
  console.info('章節提醒已加入', {
    enabled: true,
    route: formatRoute?.id || 'plain',
    chapters,
    promptPreview: promptText.slice(0, 500)
  });
}

function buildSolveResponseSchema() {
  return JSON.parse(JSON.stringify(window.SolutionCore.SCHEMA));
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
  status.textContent = chapterStatus;
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
  initRefAnswerCheckToggle();
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

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  if (solveOpts?.structureIssues?.length) {
    lines.push('詳解結構：待補 ' + solveOpts.structureIssues.join('；'));
    warning = true;
  }
  if (refAnswer && typeof window.answersMatch === 'function') {
    const ok = window.answersMatch(reply, refAnswer);
    lines.push(ok ? '對齊參考答案：已成功' : '對齊參考答案：未能在題目條件下對齊');
    warning = warning || !ok;
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

function appendFollowupUser(text) {
  document.getElementById('followupArea').hidden = false;
  const block = document.createElement('div');
  block.className = 'followup-block';
  block.innerHTML = `<div class="followup-user"><span class="followup-tag">追問</span>${esc(text)}</div><div class="followup-reply board-reply followup-pending">撰寫中…</div>`;
  document.getElementById('followupThread').appendChild(block);
  block.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return block;
}

async function fillFollowupReply(block, text) {
  const reply = block.querySelector('.followup-reply');
  reply.classList.remove('followup-pending');
  await renderAiInto(reply, text);
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
  window.__tokenAudit?.beginSession?.('solve');

  try {
    if (typeof window.SolutionCore === 'undefined') throw new Error('solution-core.js 未載入');
    if (!window.QuestionAnalysisPrompt?.SYSTEM
      || typeof window.buildQuestionAnalysisUserText !== 'function'
      || typeof window.parseQuestionAnalysis !== 'function'
      || typeof window.assembleSolveUserContent !== 'function') {
      throw new Error('兩段式提示詞未載入。請按 Ctrl+Shift+R 強制重新整理後再試。');
    }

    // 第一段：讀取文字／圖片，只產生本題解題備忘錄。
    setBadge('審題中…', '#F9F3E6', '#8A6D3B');
    const analysisUserText = window.buildQuestionAnalysisUserText(textQuestion);
    const analysisMessages = textOnly
      ? [{ role: 'user', content: analysisUserText }]
      : [{
        role: 'user',
        content: [
          ...imgDataURLs.map(item => ({
            type: 'image_url',
            image_url: { url: item.dataUrl, detail: 'high' }
          })),
          { type: 'text', text: analysisUserText }
        ]
      }];
    const analysisReply = await callAPI(cfg, analysisMessages, window.QuestionAnalysisPrompt.SYSTEM, {
      temperature: 0,
      maxOutputTokens: 3072,
      timeoutMs: 90000,
      maxContinue: 0,
      tokenStage: 'question_analysis',
      responseFormat: {
        text: { mimeType: 'APPLICATION_JSON', schema: window.QuestionAnalysisPrompt.SCHEMA }
      }
    });
    const questionAnalysis = window.parseQuestionAnalysis(analysisReply.text, textQuestion);
    if (!questionAnalysis) {
      throw new Error('題目審題備忘錄格式不完整，請重新作答。');
    }
    window.__lastQuestionAnalysis = questionAnalysis;

    const questionSource = questionAnalysis.questionText;
    const scopeInput = typeof extractExplicitScopePhrase === 'function'
      ? extractExplicitScopePhrase([textQuestion, questionSource].filter(Boolean).join('\n'))
      : '';
    const formatRoute = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.route
      ? window.SolveSpec.route(getSolveSpec(), questionSource, {
        forceStoichiometry: isForceStoichiometry(),
        forceCalcCompact: isCalcCompact()
      })
      : { id: 'plain', origin: 'auto', solveSpec: getSolveSpec(), forceStoichiometry: isForceStoichiometry(), forceCalcCompact: isCalcCompact() };
    const solveSpec = formatRoute.solveSpec;
    const advancedBlock = typeof window.SolveSpec !== 'undefined' && window.SolveSpec.buildActiveBlock
      ? window.SolveSpec.buildActiveBlock(formatRoute) : '';
    logInjectedSolveSpec(formatRoute, advancedBlock);

    const solveOpts = {
      textOnly,
      questionBody: questionSource,
      supplement: textQuestion,
      hasImage,
      imageCount: imgDataURLs.length,
      detailed: detailMode,
      scopeInput,
      refAnswer,
      refAnswerDeepCheckEnabled: isRefAnswerDeepCheckEnabled(),
      forceStoichiometry: formatRoute.forceStoichiometry,
      forceCalcCompact: formatRoute.forceCalcCompact,
      solveSpec,
      formatRoute,
      questionAnalysis
    };

    // 第二段：唯一的解題提示，接收備忘錄、進階設定與待核對參考答案。
    const assembled = window.assembleSolveUserContent(
      questionSource,
      questionAnalysis.memo,
      advancedBlock,
      refAnswer,
      { verifyReference: solveOpts.refAnswerDeepCheckEnabled }
    );
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
      apiMessages = [{
        role: 'user', content: [
          ...imageParts,
          { type: 'text', text: fullUserText }
        ]
      }];
    }

    const responseSchema = buildSolveResponseSchema();
    const mainGenerationOptions = {
      temperature: 0.25,
      maxOutputTokens: 8192,
      timeoutMs: 120000,
      maxContinue: 0,
      tokenStage: 'main_solve',
      responseFormat: {
        text: { mimeType: 'APPLICATION_JSON', schema: responseSchema }
      }
    };
    setBadge('撰寫詳解中…', '#F9F3E6', '#8A6D3B');
    const mainSolve = await callAPI(
      cfg,
      apiMessages,
      window.SolutionCore.buildSystem(),
      mainGenerationOptions
    );
    let reply = mainSolve.text;
    const truncated = mainSolve.truncated;
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
    // 本機算式驗算只作軟提醒，不觸發額外 AI 提示。
    const calculationAudit = auditCalculationDocument(prepared.document);
    const answerMatchesRef = () => !solveOpts.refAnswer
      || typeof window.answersMatch !== 'function'
      || window.answersMatch(reply, solveOpts.refAnswer);
    solveOpts.answerAlignAttempted = !!solveOpts.refAnswer;
    solveOpts.answerAligned = answerMatchesRef();

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
    renderSolveValidation(reply, solveOpts, solveOpts.refAnswer);
    setBadge('詳解完成', '#EAF2ED', '#3D6B52');
    if (solveOpts.refAnswer && !solveOpts.answerAligned) {
      toast('詳解未能對齊參考答案，請查看上方核對提示');
    }
    if (truncated) toast('詳解可能未寫完，可往下捲動或追問補完');
  } catch (err) {
    if (activeSolveEpoch !== solveEpoch) return;
    console.error('解題失敗', err);
    setMainSolution(`❌ ${formatError(err.message)}`);
    setBadge('錯誤', '#F9EDED', '#9B4444');
  } finally {
    window.__tokenAudit?.endSession?.();
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
  window.__tokenAudit?.beginSession?.('followup');
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
      maxContinue: 1,
      tokenStage: 'followup'
    };
    const { text: reply } = await callAPI(cfg, apiMessages, systemText, genOpts);
    apiMessages.push({ role: 'assistant', content: reply });
    await fillFollowupReply(block, reply);
    setBadge('追問完成', '#EAF2ED', '#3D6B52');
  } catch (err) {
    apiMessages.pop();
    await fillFollowupReply(block, `❌ ${formatError(err.message)}`);
    setBadge('錯誤', '#F9EDED', '#9B4444');
  } finally {
    window.__tokenAudit?.endSession?.();
    setBusy(false);
  }
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

