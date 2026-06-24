const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite（推薦，一般解題）' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash（較強推理）' },
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
  'gemini-3-pro-preview': 'gemini-3.1-pro-preview'
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


let imgDataURL = null, apiMessages = [], busy = false, lastMatchInput = '';
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

function openLightbox() {
  if (!imgDataURL) return;
  const lb = document.getElementById('imgLightbox');
  document.getElementById('lightboxImg').src = imgDataURL;
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
  const f = e.dataTransfer.files[0];
  if (f?.type.startsWith('image/')) onFile(f);
});
document.addEventListener('paste', e => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) onFile(item.getAsFile());
});

function onFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    imgDataURL = e.target.result;
    document.getElementById('prevImg').src = imgDataURL;
    document.getElementById('prevName').textContent = file.name || '貼上的圖片';
    document.getElementById('prevWrap').classList.add('show');
    document.getElementById('solveBtn').disabled = false;
    apiMessages = [];
    clearThreads();
    document.getElementById('chatInputWrap').classList.remove('show');
  };
  reader.readAsDataURL(file);
}

function clearAll() {
  imgDataURL = null; apiMessages = []; lastMatchInput = '';
  document.getElementById('fileInput').value = '';
  document.getElementById('questionInput').value = '';
  document.getElementById('answerInput').value = '';
  document.getElementById('chatInput').value = '';
  document.getElementById('prevWrap').classList.remove('show');
  document.getElementById('solveBtn').disabled = true;
  document.getElementById('resultCard').classList.remove('show');
  clearThreads();
  document.getElementById('chatInputWrap').classList.remove('show');
  setBadge('就緒');
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
  document.getElementById('solveBtn').disabled = on || !imgDataURL;
  document.getElementById('sendBtn').disabled = on;
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

function renderAiInto(container, text) {
  try {
    container.innerHTML = render(text || '');
    doKaTeX(container, { plain: !BOARD_LAYOUT_ENABLED });
  } catch (err) {
    console.error('詳解渲染失敗', err);
    container.textContent = String(text || '（渲染失敗，請重新整理後再試）');
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
  if (!cfg.key) { openModal(); toast('請先設定 Gemini API Key'); return; }
  if (!imgDataURL || busy) return;
  const q = document.getElementById('questionInput').value.trim();
  const refAnswer = document.getElementById('answerInput').value.trim();

  document.getElementById('resultCard').classList.add('show');
  document.getElementById('chatInputWrap').classList.add('show');
  clearThreads();
  setBusy(true);

  let autoHints = '';
  let matchInput = q;

  try {
    setBadge('辨識題目中…', '#F9F3E6', '#8A6D3B');

    if (isDatabaseEnabled()) {
      try {
        const catalogLine = await buildMatchCatalogLine();
        autoHints = await extractImageMatchHints(cfg, imgDataURL, catalogLine);
      } catch (err) {
        console.warn('自動配對辨識失敗', err);
      }
    }
    matchInput = [q, autoHints].filter(Boolean).join(' ').trim();
    lastMatchInput = matchInput;

    setBadge('配對資料庫中…', '#F9F3E6', '#8A6D3B');
    if (isDatabaseEnabled()) {
      await resolveDatabaseMatch(matchInput, { force: true });
    }

    setBadge('撰寫詳解中…', '#F9F3E6', '#8A6D3B');
    const userText = buildSolveUserText(matchInput, refAnswer);
    const dbUserBlock = await buildDatabaseUserBlock(matchInput);
    const systemText = await getSystemPromptForSolve(matchInput);
    apiMessages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imgDataURL, detail: 'high' } },
        { type: 'text', text: userText + dbUserBlock }
      ]
    }];

    const { text: reply, truncated } = await callAPI(cfg, apiMessages, systemText, {
      temperature: 0,
      maxOutputTokens: 8192,
      timeoutMs: 120000,
      maxContinue: 1
    });
    apiMessages.push({ role: 'assistant', content: reply });
    setMainSolution(reply);
    const match = getLastDatabaseMatch();
    if (match?.tier && match.tier < 3) {
      const verify = verifyAnswerLocally(reply, match.answerKey);
      let badgeNote = match.solutionOnly
        ? `純詳解命中：${match.entryId}`
        : `${match.tierLabel}：${match.entryId}`;
      if (verify.note) badgeNote += verify.ok === false ? `（${verify.note}）` : '';
      setBadge(badgeNote, match.tier === 1 ? '#E8F0FA' : '#F9F3E6', match.tier === 1 ? '#2E5C8A' : '#8A6D3B');
      if (verify.ok === false) toast(verify.note);
      else if (match.tier === 1) {
        toast(match.solutionOnly
          ? `已命中純詳解範例：${match.entryId}`
          : `已命中資料庫：${match.entryId}`);
      }
    }
    if (truncated) toast('詳解可能未寫完，可往下捲動或追問補完');
    if (!match?.tier || match.tier >= 3) {
      setBadge('未命中資料庫', '#F9EDED', '#9B4444');
      toast(autoHints ? `未命中資料庫（已辨識：${autoHints.slice(0, 40)}…）` : '未命中資料庫：請確認題目已登記並執行同步資料庫');
    } else if (autoHints && !q) {
      toast(`已自動配對：${autoHints.slice(0, 50)}${autoHints.length > 50 ? '…' : ''}`);
    }
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
  apiMessages.push({ role: 'user', content: text });
  try {
    const qHint = lastMatchInput || document.getElementById('questionInput').value.trim();
    const { text: reply } = await callAPI(cfg, apiMessages, await getSystemPromptForSolve(qHint), {
      temperature: 0,
      maxOutputTokens: 4096,
      timeoutMs: 90000,
      maxContinue: 1
    });
    apiMessages.push({ role: 'assistant', content: reply });
    fillFollowupReply(block, reply);
    setBadge('完成', '#EAF2ED', '#3D6B52');
  } catch (err) {
    apiMessages.pop();
    fillFollowupReply(block, `❌ ${formatError(err.message)}`);
    setBadge('錯誤', '#F9EDED', '#9B4444');
  } finally { setBusy(false); }
}

onProviderChange();
document.getElementById('chatInput').addEventListener('keydown', chatKeydown);
document.getElementById('questionInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); startSolve(); }
});
document.getElementById('answerInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); startSolve(); }
});

(async () => {
  const st = await getDatabaseStatus();
  if (st.ok) {
    console.log(`題庫：${st.loaded}/${st.total} 則，含 meta ${st.withMeta || 0} 則`);
  } else if (st.reason === 'fetch_failed') {
    toast('題庫讀取失敗，已用內建備援');
  }
})();

if (!cfg.key) setTimeout(openModal, 400);
