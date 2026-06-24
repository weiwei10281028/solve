const TRANSCRIBE_QUESTION_PROMPT = `你是化學題目轉錄員。將圖片中的「題目」轉成 Markdown+LaTeX。
規則：
1. 只轉錄題幹、條件、數據、圖中文字、小題 (1)(2)…；禁止解題、禁止寫答案。
2. 化學式與數字用 $...$；分數用 $\\dfrac{}{}$。
3. 若圖中有裝置示意，簡述關鍵結構（槽數、溶液、電極標記）。
4. 段考請保留「16.」等題號；勿輸出 YAML 檔頭（---）；勿在正文使用 \\--- 或 catalog\\_only 這類跳脫字。
5. 只輸出轉錄結果，不要解釋。`;

const TRANSCRIBE_SOLUTION_PROMPT = `你是化學詳解轉錄員。將圖片中板書詳解轉成 Markdown+LaTeX。
規則：
1. 嚴禁開場白，直接輸出內容；勿輸出 YAML 檔頭。
2. 反應式用 $\\rightarrow$ 或 $\\rightleftharpoons$；平衡題用 array 四行表（物種／起始／變化／\\hline／平衡），不寫「初始、變化、結果」字樣。
3. 分數用 $\\dfrac{}{}$，分式內不放中文；數字加 $\\htmlData{note=繁體中文短註解}{數字}$。
4. (1)(2)(3) 各小題獨立一段，段間空一行；段考詳解保留「16.」等題號。
5. 只輸出轉錄結果，不要解釋。`;

let questionItems = [];
let solutionItems = [];
let importing = false;
let pasteTarget = 'question';

function cleanKey(value) {
  return String(value || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
}
function getKey() {
  return cleanKey(localStorage.getItem('aik') || sessionStorage.getItem('aik') || '');
}
function log(msg) {
  const el = document.getElementById('log');
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}
function clearLog() { document.getElementById('log').textContent = ''; }
function setProgress(pct) {
  document.getElementById('progressFill').style.width = pct + '%';
}
function sanitizeFilename(name) {
  return String(name || '')
    .replace(/\.md$/i, '')
    .replace(/[<>:"/\\|?*\s\u4e00-\u9fff]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function normalizeEntryId(raw) {
  let id = sanitizeFilename(raw);
  id = id.replace(/-(question|solution)$/i, '');
  return id;
}

function generateRandomEntryId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `db-${t}-${r}`;
}

function resolveEntryId(raw) {
  const id = normalizeEntryId(raw);
  return id || generateRandomEntryId();
}

function getEntryFilename(entryId) {
  return `${resolveEntryId(entryId)}.md`;
}

function getImportMode() {
  const checked = document.querySelector('input[name="importMode"]:checked');
  return checked?.value === 'solution_only' ? 'solution_only' : 'full';
}

function isSolutionOnlyImport() {
  return getImportMode() === 'solution_only';
}

function onImportModeChange() {
  updateImportModeUI();
  updateFilenamePreview();
}

function updateImportModeUI() {
  const solutionOnly = isSolutionOnlyImport();
  const questionCol = document.getElementById('questionCol');
  const grid = document.querySelector('.pair-upload-grid');
  const typeRow = document.getElementById('entryTypeRow');
  const hint = document.getElementById('importModeHint');
  const solutionHint = document.getElementById('solutionColHint');
  const startBtn = document.getElementById('startImportBtn');

  if (questionCol) questionCol.style.display = solutionOnly ? 'none' : '';
  if (grid) grid.classList.toggle('pair-upload-grid--solution-only', solutionOnly);
  if (typeRow) typeRow.style.display = solutionOnly ? 'none' : '';
  if (hint) {
    hint.textContent = solutionOnly
      ? '純詳解模式：只需上傳詳解圖。題幹區為占位說明，各小節（第 N 題、類題）會自動加 MATCH 配對標記。'
      : '需上傳題目圖與詳解圖，自動產生 MATCH 配對標記。';
  }
  if (solutionHint) {
    solutionHint.textContent = solutionOnly
      ? '可拖多張詳解板書，依序合併；建議保留「第 N 題」「類題」等小節標題'
      : '可拖多張，依序合併為詳解區塊';
  }
  if (startBtn) {
    startBtn.textContent = solutionOnly
      ? '開始匯入純詳解（下載單一 .md）'
      : '開始匯入（下載單一 .md）';
  }
  if (solutionOnly) pasteTarget = 'solution';
}

function updateFilenamePreview() {
  const el = document.getElementById('filenamePreview');
  if (!el) return;
  const raw = document.getElementById('entryId')?.value?.trim() || '';
  const fn = getEntryFilename(raw);
  const solutionOnly = isSolutionOnlyImport();
  if (raw) {
    el.innerHTML = solutionOnly
      ? `將下載單一檔案：<code>${fn}</code>（純詳解，含 YAML、占位題幹、詳解）`
      : `將下載單一檔案：<code>${fn}</code>（含 YAML 檔頭、題幹、詳解）`;
  } else {
    el.innerHTML = `未輸入時將自動隨機命名，格式：<code>db-xxxx.md</code>`;
  }
}

function generateEntryId() {
  const input = document.getElementById('entryId');
  if (!input) return;
  input.value = generateRandomEntryId();
  updateFilenamePreview();
  log(`已產生名稱：${input.value}`);
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function openKeyModal() {
  document.getElementById('keyInput').value = getKey();
  document.getElementById('overlay').classList.add('show');
}
function closeKeyModal() { document.getElementById('overlay').classList.remove('show'); }
function overlayClick(e) { if (e.target.id === 'overlay') closeKeyModal(); }
function saveKey() {
  const k = cleanKey(document.getElementById('keyInput').value);
  localStorage.setItem('aik', k);
  sessionStorage.setItem('aik', k);
  closeKeyModal();
  log('API 金鑰已儲存');
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function addImagesToList(files, listName) {
  const list = listName === 'question' ? questionItems : solutionItems;
  let added = 0;
  for (const file of files) {
    if (!file?.type?.startsWith('image/')) continue;
    const dataUrl = await readFileAsDataURL(file);
    const id = `${listName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    list.push({ id, name: file.name || '貼上的圖片', dataUrl });
    added++;
  }
  if (!added) return;
  renderPreview(listName);
  const label = listName === 'question' ? '題目' : '詳解';
  log(`已加入 ${added} 張${label}圖，共 ${list.length} 張`);
}

function renderPreview(listName) {
  const list = listName === 'question' ? questionItems : solutionItems;
  const gridId = listName === 'question' ? 'questionPreview' : 'solutionPreview';
  const grid = document.getElementById(gridId);
  grid.innerHTML = list.map((item, i) => `
    <div class="preview-item" data-id="${item.id}">
      <button type="button" class="remove-btn" onclick="removeImage('${listName}','${item.id}')" title="移除">×</button>
      <span class="preview-page">p${i + 1}</span>
      <img src="${item.dataUrl}" alt="">
      <span>${item.name}</span>
    </div>
  `).join('');
}

function removeImage(listName, id) {
  if (listName === 'question') {
    questionItems = questionItems.filter(i => i.id !== id);
    renderPreview('question');
  } else {
    solutionItems = solutionItems.filter(i => i.id !== id);
    renderPreview('solution');
  }
}

function clearQuestionImages() {
  questionItems = [];
  renderPreview('question');
}
function clearSolutionImages() {
  solutionItems = [];
  renderPreview('solution');
}
function clearAllImport() {
  questionItems = [];
  solutionItems = [];
  renderPreview('question');
  renderPreview('solution');
  document.getElementById('entryId').value = '';
  document.getElementById('qLabel').value = '';
  document.getElementById('entryTopic').value = '';
  document.getElementById('matchAlias').value = '';
  document.getElementById('matchKeywords').value = '';
  clearLog();
  setProgress(0);
}

function setupDropZone(zoneEl, inputEl, listName) {
  zoneEl.setAttribute('tabindex', '0');
  zoneEl.addEventListener('focus', () => { pasteTarget = listName; });
  zoneEl.addEventListener('click', () => { pasteTarget = listName; });
  zoneEl.addEventListener('dragover', e => { e.preventDefault(); zoneEl.classList.add('over'); });
  zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('over'));
  zoneEl.addEventListener('drop', e => {
    e.preventDefault();
    zoneEl.classList.remove('over');
    pasteTarget = listName;
    addImagesToList([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')), listName);
  });
  inputEl.addEventListener('change', e => {
    pasteTarget = listName;
    addImagesToList([...e.target.files], listName);
    inputEl.value = '';
  });
}

const questionZone = document.getElementById('questionZone');
const solutionZone = document.getElementById('solutionZone');
setupDropZone(questionZone, document.getElementById('questionInput'), 'question');
setupDropZone(solutionZone, document.getElementById('solutionInput'), 'solution');

document.addEventListener('paste', e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (!item) return;
  const file = item.getAsFile();
  if (!file) return;
  e.preventDefault();
  addImagesToList([file], pasteTarget);
});

async function transcribeImage(dataUrl, kind, cfg) {
  const prompt = kind === 'question' ? TRANSCRIBE_QUESTION_PROMPT : TRANSCRIBE_SOLUTION_PROMPT;
  const system = kind === 'question' ? '你是化學題目轉錄員。' : '你是化學詳解轉錄員。';
  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
      { type: 'text', text: prompt }
    ]
  }];
  const { text } = await callAPI(cfg, messages, system, { temperature: 0, maxOutputTokens: 4096 });
  return text;
}

function mergePagesMd(items, kind, parts) {
  return parts.map((text, i) => `<!-- ${kind} p${i + 1}: ${items[i].name} -->\n${text}`).join('\n\n');
}

function downloadFile(filename, content, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function readInstalledDatabaseBundle() {
  try {
    const raw = localStorage.getItem('databaseUserBundle');
    if (!raw) return { files: {} };
    const parsed = JSON.parse(raw);
    return { files: parsed.files || {} };
  } catch {
    return { files: {} };
  }
}

function installDatabaseFile(filename, content) {
  const prev = readInstalledDatabaseBundle();
  const bundle = {
    files: { ...prev.files, [filename]: content },
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem('databaseUserBundle', JSON.stringify(bundle));
  sessionStorage.setItem('databaseUserBundle', JSON.stringify(bundle));
  if (typeof clearDatabaseCache === 'function') clearDatabaseCache();
}

function parseMatchKeywordsInput(raw = '') {
  return String(raw || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

async function startDatabaseImport() {
  if (importing) return;
  const key = getKey();
  if (!key) { openKeyModal(); return; }

  const solutionOnly = isSolutionOnlyImport();
  if (!solutionOnly && !questionItems.length) { log('請至少上傳 1 張題目圖'); return; }
  if (!solutionItems.length) { log('請至少上傳 1 張詳解圖'); return; }

  const entryId = resolveEntryId(document.getElementById('entryId').value.trim());
  document.getElementById('entryId').value = entryId;
  updateFilenamePreview();
  const filename = getEntryFilename(entryId);
  const qLabel = document.getElementById('qLabel').value.trim() || '';
  const topic = document.getElementById('entryTopic').value.trim() || (solutionOnly ? '純詳解範例' : '一般');
  const subject = document.getElementById('entrySubject').value.trim() || '化學';
  const matchAlias = document.getElementById('matchAlias')?.value?.trim() || '';
  const matchKeywords = parseMatchKeywordsInput(document.getElementById('matchKeywords')?.value);
  const typeSel = document.getElementById('entryTypeSel')?.value || 'auto';
  const catalogOnly = !solutionOnly && typeSel === 'exam';

  importing = true;
  document.getElementById('startImportBtn').disabled = true;
  clearLog();
  log(`開始匯入：${entryId}${solutionOnly ? '（純詳解）' : ''}`);
  if (solutionOnly) {
    log(`詳解 ${solutionItems.length} 張（無題目圖）`);
  } else {
    log(`題目 ${questionItems.length} 張 → 詳解 ${solutionItems.length} 張`);
  }

  const cfg = { key, model: localStorage.getItem('aim') || 'gemini-3.1-flash-lite' };
  const totalSteps = (solutionOnly ? 0 : questionItems.length) + solutionItems.length;
  let done = 0;

  let questionMd = '';
  if (!solutionOnly) {
    const questionParts = [];
    for (const item of questionItems) {
      log(`轉錄題目：${item.name}（p${done + 1}）…`);
      try {
        questionParts.push(await transcribeImage(item.dataUrl, 'question', cfg));
        log('  ✓ 完成');
      } catch (err) {
        questionParts.push(`<!-- ERROR: ${err.message} -->`);
        log(`  ✗ ${err.message}`);
      }
      done++;
      setProgress(Math.round((done / totalSteps) * 100));
      await delay(300);
    }
    questionMd = mergePagesMd(questionItems, 'question', questionParts);
  }

  const solutionParts = [];
  for (const item of solutionItems) {
    log(`轉錄詳解：${item.name}…`);
    try {
      solutionParts.push(await transcribeImage(item.dataUrl, 'solution', cfg));
      log('  ✓ 完成');
    } catch (err) {
      solutionParts.push(`<!-- ERROR: ${err.message} -->`);
      log(`  ✗ ${err.message}`);
    }
    done++;
    setProgress(Math.round((done / totalSteps) * 100));
    await delay(300);
  }

  const solutionMd = mergePagesMd(solutionItems, 'solution', solutionParts);
  const methodIdOverride = document.getElementById('methodIdSel')?.value || 'auto';
  const type = solutionOnly
    ? 'solution_only'
    : (typeSel === 'auto'
      ? ((extractQuestionNumbers?.(questionMd)?.length || 0) > 8 ? 'exam' : 'single')
      : typeSel);

  const integratedMd = repairDatabaseMdRaw(buildIntegratedDatabaseMd({
    id: entryId,
    type,
    subject,
    topic: qLabel ? `${topic} ${qLabel}`.trim() : topic,
    qLabel,
    matchAlias,
    catalogOnly: catalogOnly || type === 'exam',
    solutionOnly,
    questionMd,
    solutionMd,
    matchKeywords,
    metaExtra: { method_id: methodIdOverride === 'auto' ? undefined : methodIdOverride }
  }));

  const validation = typeof validateDatabaseMd === 'function'
    ? validateDatabaseMd(integratedMd, filename)
    : { ok: true, issues: [], parsed: entryFromDatabaseMd(integratedMd, filename) };

  downloadFile(filename, integratedMd);
  installDatabaseFile(filename, integratedMd);

  const parsed = validation.parsed || entryFromDatabaseMd(integratedMd, filename);
  const meta = parsed.meta || {};
  const matchSource = solutionOnly ? parsed.solutionText : parsed.questionText;
  const matchCount = (matchSource.match(/<!--\s*MATCH:/gi) || []).length;

  log(`\n完成！已產生單一檔案：${filename}`);
  log(`  YAML 檔頭：---（標準格式，已排除 \\--- / catalog\\_only）`);
  log(`  類型：${parsed.type || type}${meta.solution_only ? '（純詳解）' : ''}${meta.catalog_only ? '（catalog_only）' : ''}`);
  log(`  配對別名：${parsed.match_alias || matchAlias || '（無）'}`);
  log(`  MATCH 標記：${matchCount} 處（${solutionOnly ? '詳解小節' : '題幹'}配對）`);
  log(`  method_id：${meta.method_id || '（自動）'}`);
  log(`  指紋：${(meta.fingerprint || []).join(', ') || '（無）'}`);
  log(`  配對關鍵字：${(meta.match_keywords || []).join(', ') || '（無）'}`);
  log(`  概念：${(meta.concept_tags || []).join(', ') || '（無）'}`);
  log(`  關鍵判斷：${meta.critical_judgment || '（無）'}`);
  log(`  答案：${meta.answer_key || '（無）'}`);
  if (!solutionOnly) {
    log(`  題號：${(meta.q_numbers || []).join(', ') || '（無）'}`);
  }
  if (validation.issues?.length) {
    log(`  檢查提醒：${validation.issues.join('；')}`);
  }
  log('已安裝到本機測試模式（可直接雙擊 index.html 生效）');
  log('【重要】若要正式納入題庫：將檔案放入 database/ 資料夾，執行「同步資料庫.bat」');

  importing = false;
  document.getElementById('startImportBtn').disabled = false;
  setProgress(100);
}

if (!getKey()) setTimeout(openKeyModal, 400);
updateImportModeUI();
updateFilenamePreview();
