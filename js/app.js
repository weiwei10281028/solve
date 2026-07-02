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

function cleanKey(value) {
  return String(value || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
}
function loadSetting(name, fallback = '') {
  return localStorage.getItem(name) || sessionStorage.getItem(name) || fallback;
}
function keySummary(key) {
  const k = cleanKey(key);
  if (!k) return '目前未儲存 API Key';
  return `已儲存 Key：${k.slice(0, 6)}...${k.slice(-4)}（長度 ${k.length}）`;
}


let imgDataURLs = [], apiMessages = [], busy = false, lastMatchInput = '';
const detailMode = false;
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
  const lb = document.getElementById('imgLightbox');
  document.getElementById('lightboxImg').src = img.dataUrl;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
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
    { wrap: 'prevWrap', img: 'prevImg', name: 'prevName', remove: 'previewRemove0' },
    { wrap: 'prevWrap2', img: 'prevImg2', name: 'prevName2', remove: 'previewRemove1' }
  ];
  slots.forEach((slot, i) => {
    const item = imgDataURLs[i];
    const wrap = document.getElementById(slot.wrap);
    if (!wrap) return;
    const removeBtn = document.getElementById(slot.remove);
    if (item) {
      document.getElementById(slot.img).src = item.dataUrl;
      document.getElementById(slot.name).textContent = item.name || `圖片 ${i + 1}`;
      wrap.classList.add('show');
      if (removeBtn) {
        removeBtn.hidden = false;
        removeBtn.disabled = busy;
      }
    } else {
      document.getElementById(slot.img).src = '';
      document.getElementById(slot.name).textContent = '';
      wrap.classList.remove('show');
      if (removeBtn) removeBtn.hidden = true;
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
  document.getElementById('chatInput').value = '';
  refreshPreviewUI();
  document.getElementById('resultCard').classList.remove('show');
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

async function ensureBoardStyleReply(cfg, apiMessages, systemText, reply, genOpts = {}) {
  const check = typeof window.checkSolutionBoardStyle === 'function'
    ? window.checkSolutionBoardStyle
    : null;
  const buildFix = typeof window.buildBoardStyleFixUserText === 'function'
    ? window.buildBoardStyleFixUserText
    : null;
  const fixCount = Number(genOpts._boardStyleFixed) || 0;
  if (!check || !buildFix) return reply;

  const refText = typeof getLastDatabaseRefSolution === 'function'
    ? getLastDatabaseRefSolution()
    : '';
  const questionCtx = String(genOpts.questionCtx || '');
  let issues = check(reply, refText, questionCtx);
  if (!issues.length) return reply;
  console.warn('[板書檢查] 初稿問題：', issues);

  const maxFix = 1;
  if (fixCount >= maxFix) return reply;

  let current = reply;
  for (let attempt = fixCount; attempt < maxFix; attempt++) {
    const fixMessages = [
      ...apiMessages,
      { role: 'assistant', content: current },
      { role: 'user', content: buildFix(issues) }
    ];
    try {
      const { text: fixed } = await callAPI(cfg, fixMessages, systemText, {
        ...genOpts,
        maxContinue: 0,
        temperature: 0.35,
        _boardStyleFixed: attempt + 1
      });
      if (!fixed) break;
      current = fixed;
      issues = check(fixed, refText, questionCtx);
      if (!issues.length) return fixed;
    } catch (err) {
      console.warn('板書修正重試失敗', err);
      break;
    }
  }
  if (issues.length) toast('反應變化表或板書格式可能未完全符合');
  return current;
}

/** 第二層：參考答案與 @@ANSWER@@ 不一致時內部重寫（學生僅見最終版） */
async function ensureReferenceAnswerReply(cfg, apiMessages, systemText, reply, refAnswer, genOpts = {}) {
  if (!refAnswer || genOpts.refAnswerSkipped) return reply;
  if (typeof window.answersMatch !== 'function' || typeof window.buildRefAnswerFixUserText !== 'function') {
    return reply;
  }
  if (window.answersMatch(reply, refAnswer)) return reply;
  console.warn('[參考答案] 與推導不一致，保留依題推導結果');
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

  const issues = check(reply);
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
    if (fixed && !check(fixed).length) return fixed;
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
    let body = text || '';
    if (typeof MolResolver !== 'undefined' && MolResolver.preprocessSmilesToMol) {
      body = MolResolver.preprocessSmilesToMol(body);
    }
    if (typeof SmilesDraw !== 'undefined' && SmilesDraw.preprocess) {
      body = SmilesDraw.preprocess(body);
    }
    container.innerHTML = render(body);
    doKaTeX(container);
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
      refAnswerSkipped: !!refConflict.conflict
    };
    updateSolveHeadingMode(scopeInput || matchInput);
    if (typeof window.buildSolveUserText !== 'function') {
      throw new Error('prompts.js 未載入（buildSolveUserText 不存在）。請按 Ctrl+Shift+R 強制重新整理；若仍失敗，請用「啟動網頁.bat」開啟並確認主控台是否有 js 語法錯誤。');
    }
    const userText = window.buildSolveUserText(scopeInput, solveOpts.refAnswer, solveOpts);
    const dbUserBlock = await buildDatabaseUserBlock(matchInput);
    const dbMatch = typeof getLastDatabaseMatch === 'function' ? getLastDatabaseMatch() : null;
    const noteUserBlock = typeof NoteBlock !== 'undefined' && NoteBlock.buildUserBlock
      ? NoteBlock.buildUserBlock({
        matchInput,
        detailed: detailMode,
        conceptLabels: dbMatch?.conceptLabels || [],
        match: dbMatch
      })
      : '';
    const fullUserText = userText + dbUserBlock + noteUserBlock;
    const systemText = await getSystemPromptForSolve(matchInput, solveOpts);

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
      maxOutputTokens: 8192,
      timeoutMs: 120000,
      maxContinue: 1
    });
    reply = await ensureBoardStyleReply(cfg, apiMessages, systemText, reply, {
      questionCtx: scopeInput || matchInput || textQuestion,
      temperature: 0.25,
      maxOutputTokens: 8192,
      timeoutMs: 90000
    });
    if (typeof NoteEnsure !== 'undefined' && NoteEnsure.ensureDensityReply) {
      reply = await NoteEnsure.ensureDensityReply(callAPI, cfg, apiMessages, systemText, reply, {
        temperature: 0.2,
        maxOutputTokens: 8192,
        timeoutMs: 90000,
        maxNoteFix: 1
      });
    }
    if (typeof repairKspAgClReactionTables === 'function') {
      const qctx = typeof getLastMatchInput === 'function' ? getLastMatchInput() : '';
      reply = repairKspAgClReactionTables(reply, qctx);
    }
    reply = await ensureReferenceAnswerReply(cfg, apiMessages, systemText, reply, solveOpts.refAnswer, {
      refAnswerSkipped: solveOpts.refAnswerSkipped,
      temperature: 0.25,
      maxOutputTokens: 8192,
      timeoutMs: 90000
    });
    apiMessages.push({ role: 'assistant', content: reply });
    setMainSolution(reply);
    const noteReport = typeof NoteCheck !== 'undefined' && NoteCheck.check
      ? NoteCheck.check(reply)
      : null;
    if (noteReport && !noteReport.skipped && !noteReport.ok) {
      console.warn('[NOTE 檢查]', noteReport);
    }
    if (!isDatabaseEnabled()) {
      setBadge('詳解完成（純提示詞）', '#EAF2ED', '#3D6B52');
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
    const scopeInput = /第\s*[\d一二三四五六七八九十]+\s*題|[\(（][一二三四五六七八九十1-9][\)）]|題組全解|都解|全解|選項\s*[A-Ea-e]|只(?:解|講|評析)/.test(text)
      ? [supplementHint, text].filter(Boolean).join(' ')
      : supplementHint;
    const combinedInput = [lastMatchInput, supplementHint, text].filter(Boolean).join(' ');
    updateSolveHeadingMode(scopeInput || lastMatchInput);
    const followOpts = {
      scopeInput,
      textOnly: !imgDataURLs.length,
      hasImage: !!imgDataURLs.length,
      detailed: detailMode,
      followUp: true
    };

    let rulesBlock = '';
    if (isDatabaseEnabled() && typeof buildTeachingRulesUserBlock === 'function') {
      try {
        rulesBlock = await buildTeachingRulesUserBlock(combinedInput);
      } catch (err) {
        console.warn('追問教學規定載入失敗', err);
      }
    }
    const dbMatch = typeof getLastDatabaseMatch === 'function' ? getLastDatabaseMatch() : null;
    const noteUserBlock = typeof NoteBlock !== 'undefined' && NoteBlock.buildUserBlock
      ? NoteBlock.buildUserBlock({
        matchInput: combinedInput,
        detailed: detailMode,
        conceptLabels: dbMatch?.conceptLabels || [],
        match: dbMatch,
        followUp: true
      })
      : '';
    const followUserText = typeof window.buildFollowUpUserText === 'function'
      ? window.buildFollowUpUserText(text, {
        rulesBlock,
        noteBlock: noteUserBlock,
        detailed: detailMode
      })
      : text;

    apiMessages.push({ role: 'user', content: followUserText });
    const systemText = await getSystemPromptForSolve(combinedInput, followOpts);
    const genOpts = {
      temperature: 0.25,
      maxOutputTokens: 4096,
      timeoutMs: 90000,
      maxContinue: 1
    };
    let { text: reply } = await callAPI(cfg, apiMessages, systemText, genOpts);
    reply = await ensureFollowUpBoardStyleReply(cfg, apiMessages, systemText, reply, genOpts);
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
document.getElementById('textQuestionInput').addEventListener('input', updateSolveButtonState);
document.getElementById('textQuestionInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); startSolve(); }
});
document.getElementById('answerInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); startSolve(); }
});
updateSolveButtonState();

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

if (!cfg.key) setTimeout(openModal, 400);
