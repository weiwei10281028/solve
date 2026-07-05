const TRANSCRIBE_QUESTION_PROMPT = `你是化學題目轉錄員。將圖片中的「題目」完整轉成 Markdown+LaTeX。
此轉錄僅供 MATCH 關鍵字產生，不會寫入題庫檔案。
規則：
1. 完整轉錄題幹、條件、數據、圖中文字、全部選項 (A)～(E)、小題 (1)(2)…；禁止解題、禁止寫答案。
2. 禁止摘要、禁止「略」「同上」、禁止漏選項。
3. 化學式與數字用 $...$；分數用 $\\dfrac{}{}$。
4. 保留題號「4.」或「第 4 題」；勿輸出 YAML；勿輸出 ---。
5. 只輸出轉錄結果，不要解釋。`;

const TRANSCRIBE_SOLUTION_PROMPT = `你是化學詳解轉錄員。將圖片中板書詳解「完整」轉成 Markdown+LaTeX（將寫入題庫）。
規則：
1. 嚴禁開場白；嚴禁摘要或省略；圖上每一行算式、每一個選項評析都要轉錄。
2. 段考／整卷：每題以「### 第 N 題」開頭（N 為題號）；單題亦同。
3. 反應式用 $\\rightarrow$ 或 $\\rightleftharpoons$；計量／平衡變化表（ICE）必用 $$\\begin{array}{ccccccc}...\\end{array}$$ 獨立成行，第一列含反應式與箭頭，後列寫初／變／平；**禁止**用 cases 排版反應變化表。
4. 聯立、原子不滅（無反應箭頭）才用 $$\\begin{cases}...\\end{cases}$$；列與列用 \\\\ 換行。
5. 分數用 $\\dfrac{}{}$；關鍵數字與算式因子加 $\\htmlData{note=白話短註解}{內容}$（須在 $ 內）。乘積中每個因子、帶指數括號式、整段分數可整段包住；禁止 $\\underbrace$／$\\underset$ 標籤。
6. 選項評析 (A)～(E) 保留在行首；禁止在 $...$ 內再嵌套 $。
7. 勿輸出 YAML 或 ---；只輸出轉錄結果，不要解釋。`;

const GENERATE_MATCH_SYSTEM = `你是高中化學題庫 MATCH 關鍵字編輯。
任務：依「題目轉錄」與「詳解轉錄」，為每一題產出 <!-- MATCH: ... --> 用的配對關鍵字。
學生上傳題目圖後，系統會用子字串比對這些詞；命中才注入該題詳解給解題 AI。

【MATCH 是什麼】
- 搜尋索引，不是題目摘要、不是詳解正文。
- 目標：讓「圖片擷取出的關鍵字」能唯一對到這一題（同卷內不撞題）。

【每題 8～14 個詞，分三層（都要有）】
① 題幹錨點（長，2～4 個，8～25 字）
   - 從題幹抽「同卷其他題不會出現」的句子片段或條件組合。
   - 例：1mol物質A分子量100溶於1kg溶劑B凝固點7度、純溶劑凝固點10度Kf=5
② 條件指紋（短，3～5 個，2～10 字）
   - 圖片 OCR／讀題 AI 容易擷取的數據、物質、單位、反應式壓縮。
   - 例：Kf=5、7°C、ΔTf=3、N2O4分解、r=kBr-BrO3、L·mol⁻¹·min⁻¹
③ 詳解特徵（中，2～4 個，4～18 字）
   - 從詳解抽「解題路徑簽名」：公式、判斷句、關鍵中間值、表格數列、圖形特徵。
   - 詳解幾乎只有算式時，這層必須加強。
   - 例：i小於1締合、ΔTf=iKfCm、半生期逐次加倍二級、濃度表2.0 1.0 0.5 0.25、三相圖固液共存線斜率為正

【圖表題】
- 禁止只寫「如附圖」「三相圖」「實驗裝置」。
- 要寫圖上可辨識的結構：軸向關係、表格關鍵數列、裝置錯誤處、Rf 大小比較等。

【詳解算式怎麼寫進 MATCH】
- 壓成短 token，禁止整段 LaTeX、禁止 $$\\begin{array}。
- 反應式：2O3生成3O2、H2加Br2生成2HBr
- 速率定律：r=kHI平方、r=kBr-BrO3
- 判斷句：係數和相同總壓不變、等差遞減零級、濃度減半時間逐次加倍

【禁止】
- 空泛詞：化學、下列何者、敘述正確、莫耳（單獨）、平衡（單獨）
- 整卷多題共用的泛詞若無該題獨有數據搭配（如單獨寫「反應速率」）
- 重複語意（10 個詞其實只有 3 個概念）
- 逗號後加空格

【格式】
- 繁體中文；逗號分隔；可混中英文與數據符號。
- 每題一行，只輸出：
第1題: 詞1,詞2,詞3
第2題: 詞1,詞2`;

const GENERATE_MATCH_SOLUTION_ONLY_SYSTEM = `你是高中化學題庫 MATCH 關鍵字編輯。
只有詳解轉錄、沒有題目正文；須從詳解板書盡量還原「學生題目圖上會出現什麼」。

【限制】
- 詳解太簡略時，仍要從算式、表格、判斷句抽特徵；並在腦中補足題幹可能條件（數據、反應式、問法）。
- 每題 8～14 個詞，三層都要有（詳解少時②③層加重）：
  ① 題幹錨點：從詳解反推題目可能敘述（長句）
  ② 條件指紋：數據、物質、單位、反應式壓縮（短）
  ③ 詳解特徵：公式、判斷、數列、圖形描述（中）
- 純計算題必寫：公式名＋關鍵判斷＋特徵數字或表格序列。
- 禁止空泛詞、禁止整段 LaTeX、禁止「如附圖」。
- 繁體；逗號分隔無空格。

只輸出：
第1題: 詞1,詞2
第2題: ...`;

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
    .slice(0, 64);
}

function normalizeEntryId(raw) {
  let id = String(raw || '').trim().replace(/\.md$/i, '');
  if (!id) return '';
  return id.replace(/-(question|solution)$/i, '');
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
  const v = checked?.value || 'exam';
  if (v === 'single' || v === 'exam' || v === 'solution_only') return v;
  return 'exam';
}

function isSolutionOnlyImport() {
  return getImportMode() === 'solution_only';
}

function needsQuestionImages() {
  return getImportMode() !== 'solution_only';
}

function onImportModeChange() {
  updateImportModeUI();
  updateFilenamePreview();
}

function updateImportModeUI() {
  const mode = getImportMode();
  const solutionOnly = mode === 'solution_only';
  const questionCol = document.getElementById('questionCol');
  const grid = document.querySelector('.pair-upload-grid');
  const hint = document.getElementById('importModeHint');
  const solutionHint = document.getElementById('solutionColHint');
  const startBtn = document.getElementById('startImportBtn');
  const qLabelInput = document.getElementById('qLabel');

  if (questionCol) questionCol.style.display = solutionOnly ? 'none' : '';
  if (grid) grid.classList.toggle('pair-upload-grid--solution-only', solutionOnly);
  if (qLabelInput) qLabelInput.disabled = mode !== 'single';
  if (hint) {
    const hints = {
      single: '單題：題目圖僅用於產生 MATCH，不寫入 MD。詳解區輸出一個 ### 第 N 題。',
      exam: '整份：題目圖與詳解圖依題號對齊，每題一組 MATCH。MD 僅含詳解（solution_only）。',
      solution_only: '僅詳解圖：MATCH 只能從板書推斷；若板書太簡略，建議改單題／整份並補題目圖。'
    };
    hint.textContent = hints[mode] || hints.exam;
  }
  if (solutionHint) {
    solutionHint.textContent = solutionOnly
      ? '完整轉錄板書；建議保留「### 第 N 題」小節標題'
      : '完整轉錄，勿摘要；每題以 ### 第 N 題 開頭';
  }
  if (startBtn) {
    const labels = {
      single: '開始匯入單題（下載 .md）',
      exam: '開始匯入整份（下載 .md）',
      solution_only: '開始匯入純詳解（下載 .md）'
    };
    startBtn.textContent = labels[mode] || labels.exam;
  }
  if (solutionOnly) pasteTarget = 'solution';
}

function updateFilenamePreview() {
  const el = document.getElementById('filenamePreview');
  if (!el) return;
  const raw = document.getElementById('entryId')?.value?.trim() || '';
  const fn = raw ? `${normalizeEntryId(raw) || resolveEntryId('')}.md` : getEntryFilename('');
  if (raw) {
    el.innerHTML = `將下載：<code>${fn}</code>（solution_only · 僅詳解 + MATCH · 無題幹正文）`;
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
  const maxTokens = kind === 'solution' ? 8192 : 4096;
  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
      { type: 'text', text: prompt }
    ]
  }];
  const { text, truncated } = await callAPI(cfg, messages, system, {
    temperature: 0,
    maxOutputTokens: maxTokens,
    maxContinue: kind === 'solution' ? 1 : 0
  });
  if (truncated) log('  ⚠ 轉錄可能未完整，請檢查下載檔');
  return text;
}

function mergePagesMd(items, kind, parts) {
  return parts.map((text, i) => `<!-- ${kind} p${i + 1}: ${items[i].name} -->\n${text}`).join('\n\n');
}

function extractPageComments(md) {
  const comments = [];
  const body = String(md || '').replace(/^<!--\s*(?:question|solution)\s+p\d+:[\s\S]*?-->\s*\n?/gm, (m) => {
    comments.push(m.trim());
    return '';
  });
  return { comments, body: body.trim() };
}

function parseQuestionNumberFromLabel(qLabel) {
  const m = String(qLabel || '').match(/(\d{1,2})/);
  return m ? Number(m[1]) : null;
}

function splitBlocksByQuestionNumber(text) {
  const clean = String(text || '').replace(/<!--[\s\S]*?-->/g, '\n').trim();
  const re = /(?:^|\n)(\d{1,2})\.\s/g;
  const heads = [...clean.matchAll(re)];
  if (heads.length < 2) return [];
  const items = [];
  for (let i = 0; i < heads.length; i++) {
    const n = Number(heads[i][1]);
    const start = heads[i].index + (heads[i][0].startsWith('\n') ? 1 : 0);
    const next = heads[i + 1];
    const end = next ? next.index + (next[0].startsWith('\n') ? 1 : 0) : clean.length;
    items.push({ number: n, text: clean.slice(start, end).trim() });
  }
  return items;
}

function splitSolutionSections(solutionBody) {
  if (typeof splitSolutionIntoSections === 'function') {
    const secs = splitSolutionIntoSections(solutionBody);
    if (secs.length) {
      return secs.map((sec) => {
        const nm = sec.title.match(/第\s*(\d{1,2})\s*題/);
        const num = nm ? Number(nm[1]) : null;
        let body = sec.text.replace(/^#{1,3}\s*第\s*\d+\s*題\s*\n?/, '').trim();
        body = body.replace(/^<!--\s*MATCH:[\s\S]*?-->\s*\n?/i, '').trim();
        return { number: num, title: sec.title, body };
      });
    }
  }
  const byNum = splitBlocksByQuestionNumber(solutionBody);
  if (byNum.length) {
    return byNum.map((b) => ({ number: b.number, title: `第 ${b.number} 題`, body: b.text }));
  }
  const t = solutionBody.trim();
  return t ? [{ number: null, title: '詳解', body: t }] : [];
}

/** 將誤用 cases 或裸寫的反應變化表，改為單一 array 版型 */
function normalizeReactionTables(text) {
  let s = String(text || '');
  if (typeof flattenReactionIceTables === 'function') s = flattenReactionIceTables(s);
  if (typeof collapseReactionTableBlocks === 'function') s = collapseReactionTableBlocks(s);
  return s;
}

function normalizeSolutionStructure(solutionMd, mode, qLabel) {
  const { comments, body } = extractPageComments(solutionMd);
  let sections = splitSolutionSections(body);

  if (mode === 'single') {
    const n = parseQuestionNumberFromLabel(qLabel) || sections[0]?.number || 1;
    const mergedBody = sections.length
      ? sections.map(s => s.body).join('\n\n')
      : body;
    sections = [{ number: n, title: `第 ${n} 題`, body: mergedBody.trim() }];
  } else if (sections.length === 1 && !sections[0].number && mode === 'exam') {
    const byNum = splitBlocksByQuestionNumber(body);
    if (byNum.length > 1) {
      sections = byNum.map(b => ({ number: b.number, title: `第 ${b.number} 題`, body: b.text }));
    }
  }

  for (const sec of sections) {
    sec.body = normalizeReactionTables(sec.body);
    if (sec.number == null && /^\d{1,2}\./.test(sec.body)) {
      const m = sec.body.match(/^(\d{1,2})\./);
      if (m) sec.number = Number(m[1]);
    }
  }

  return { comments, sections };
}

function pairQuestionSolutionSections(questionMd, sections) {
  const qBlocks = splitBlocksByQuestionNumber(questionMd);
  const qMap = new Map(qBlocks.map(b => [b.number, b.text]));
  return sections.map((sec, idx) => {
    const n = sec.number ?? (idx + 1);
    return {
      number: n,
      question: qMap.get(n) || extractQuestionChunkForSection(questionMd, n) || '',
      solution: sec.body
    };
  });
}

function extractQuestionChunkForSection(questionMd, number) {
  const blocks = splitBlocksByQuestionNumber(questionMd);
  const hit = blocks.find(b => b.number === number);
  if (hit) return hit.text;
  if (blocks.length === 1) return blocks[0].text;
  const re = new RegExp(`(?:^|\\n)${number}\\.\\s[\\s\\S]*?(?=\\n\\d{1,2}\\.\\s|$)`);
  const m = String(questionMd || '').match(re);
  return m ? m[0].trim() : String(questionMd || '').trim();
}

function parseMatchLines(text) {
  const map = new Map();
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/第\s*(\d{1,2})\s*題\s*[:：]\s*(.+)/);
    if (!m) continue;
    const kws = m[2].split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    if (kws.length) map.set(Number(m[1]), kws);
  }
  return map;
}

async function generateMatchKeywords(cfg, pairs, { topic, matchAlias, solutionOnly }) {
  if (!pairs.length) return new Map();

  const body = pairs.map((p) => {
    if (solutionOnly) {
      return `【第${p.number}題 詳解】\n${p.solution.slice(0, 3500)}`;
    }
    return `【第${p.number}題 題目】\n${(p.question || '（無）').slice(0, 2500)}\n\n【第${p.number}題 詳解】\n${p.solution.slice(0, 3500)}`;
  }).join('\n\n---\n\n');

  const userText = `卷別：${topic || '化學'}\n別名：${matchAlias || '無'}\n\n${body}\n\n請輸出每題 MATCH 關鍵字（格式：第N題: 詞1,詞2）。`;
  const system = solutionOnly ? GENERATE_MATCH_SOLUTION_ONLY_SYSTEM : GENERATE_MATCH_SYSTEM;
  const { text } = await callAPI(cfg, [{
    role: 'user',
    content: [{ type: 'text', text: userText }]
  }], system, { temperature: 0, maxOutputTokens: 2048, maxContinue: 0 });

  return parseMatchLines(text);
}

function formatSolutionMd(comments, sections, matchMap) {
  const parts = [];
  if (comments.length) parts.push(comments.join('\n\n'));
  for (const sec of sections) {
    const n = sec.number ?? '?';
    const header = `### 第 ${n} 題`;
    const kws = matchMap.get(sec.number);
    const matchLine = kws?.length
      ? `<!-- MATCH: ${kws.join(',')} -->`
      : (typeof extractStemPhraseKeywords === 'function' && sec.body
        ? `<!-- MATCH: ${[...new Set(extractStemPhraseKeywords(sec.body))].slice(0, 8).join(',')} -->`
        : '');
    parts.push([header, matchLine, sec.body].filter(Boolean).join('\n\n'));
  }
  return parts.join('\n\n');
}

function collectRollupKeywords(matchMap, topic, matchAlias, manualKw) {
  const set = new Set();
  for (const kws of matchMap.values()) kws.forEach(k => set.add(k));
  for (const k of manualKw) set.add(k);
  if (matchAlias) set.add(matchAlias);
  if (topic) {
    for (const part of topic.split(/\s+/)) {
      if (part.length >= 2) set.add(part);
    }
  }
  return [...set].filter(Boolean);
}

function buildStemPlaceholder(topic, matchAlias) {
  const label = topic || matchAlias || '本卷';
  return `（本筆為${label}純詳解；題目見上傳圖，配對依詳解內 MATCH 關鍵字。）`;
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
    return { files: JSON.parse(raw).files || {} };
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

function showImportValidation(validation) {
  const el = document.getElementById('importValidation');
  if (!el) return;
  const issues = validation?.issues || [];
  if (!issues.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const hasError = (validation.errors || []).length > 0;
  el.hidden = false;
  el.className = 'import-validation' + (hasError ? ' import-validation--error' : ' import-validation--warn');
  const title = hasError ? '格式錯誤（請修正後再同步）' : '格式提醒（已下載，建議補齊）';
  el.innerHTML = `<p class="import-validation-title">${title}</p><ul>${
    issues.map(i => `<li>${String(i).replace(/</g, '&lt;')}</li>`).join('')
  }</ul>`;
}

function parseMatchKeywordsInput(raw = '') {
  return String(raw || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean);
}

async function startDatabaseImport() {
  if (importing) return;
  const key = getKey();
  if (!key) { openKeyModal(); return; }

  const mode = getImportMode();
  const solutionOnly = mode === 'solution_only';
  if (needsQuestionImages() && !questionItems.length) {
    log('請至少上傳 1 張題目圖（僅用於 MATCH，不寫入 MD）');
    return;
  }
  if (!solutionItems.length) { log('請至少上傳 1 張詳解圖'); return; }

  const entryId = resolveEntryId(document.getElementById('entryId').value.trim());
  document.getElementById('entryId').value = entryId;
  updateFilenamePreview();
  const filename = `${entryId}.md`;
  const qLabel = document.getElementById('qLabel').value.trim() || '';
  const topic = document.getElementById('entryTopic').value.trim() || (solutionOnly ? '純詳解' : '一般');
  const subject = document.getElementById('entrySubject').value.trim() || '化學';
  const matchAlias = document.getElementById('matchAlias')?.value?.trim() || '';
  const manualKw = parseMatchKeywordsInput(document.getElementById('matchKeywords')?.value);
  const methodIdOverride = document.getElementById('methodIdSel')?.value || 'auto';

  importing = true;
  document.getElementById('startImportBtn').disabled = true;
  clearLog();
  log(`開始匯入：${entryId}（模式：${mode}）`);
  log('輸出格式：solution_only（MD 僅含詳解，題目不寫入檔案）');

  const cfg = { key, model: localStorage.getItem('aim') || 'gemini-3.1-flash-lite' };
  const transcribeSteps = (needsQuestionImages() ? questionItems.length : 0) + solutionItems.length + 1;
  let done = 0;
  const tick = () => {
    done++;
    setProgress(Math.round((done / transcribeSteps) * 100));
  };

  let questionMd = '';
  if (needsQuestionImages()) {
    const questionParts = [];
    for (const item of questionItems) {
      log(`轉錄題目（僅 MATCH 用）：${item.name}…`);
      try {
        questionParts.push(await transcribeImage(item.dataUrl, 'question', cfg));
        log('  ✓ 完成（不寫入 MD）');
      } catch (err) {
        questionParts.push('');
        log(`  ✗ ${err.message}`);
      }
      tick();
      await delay(300);
    }
    questionMd = mergePagesMd(questionItems, 'question', questionParts);
    const { body } = extractPageComments(questionMd);
    questionMd = body;
  }

  const solutionParts = [];
  for (const item of solutionItems) {
    log(`轉錄詳解（寫入 MD）：${item.name}…`);
    try {
      solutionParts.push(await transcribeImage(item.dataUrl, 'solution', cfg));
      log('  ✓ 完成');
    } catch (err) {
      solutionParts.push(`<!-- ERROR: ${err.message} -->`);
      log(`  ✗ ${err.message}`);
    }
    tick();
    await delay(300);
  }

  const rawSolutionMd = mergePagesMd(solutionItems, 'solution', solutionParts);
  const { comments, sections } = normalizeSolutionStructure(rawSolutionMd, mode, qLabel);
  log(`詳解小節：${sections.length} 段`);

  const pairs = solutionOnly
    ? sections.map((sec, i) => ({
      number: sec.number ?? (i + 1),
      question: '',
      solution: sec.body
    }))
    : pairQuestionSolutionSections(questionMd, sections);

  if (!solutionOnly) {
  for (const p of pairs) {
      if (!p.question) log(`  ⚠ 第 ${p.number} 題：題目轉錄未對齊，MATCH 將主要依詳解`);
    }
  }

  log('產生 MATCH 關鍵字（題目＋詳解合併）…');
  let matchMap = new Map();
  try {
    matchMap = await generateMatchKeywords(cfg, pairs, { topic, matchAlias, solutionOnly });
    log(`  ✓ 已產生 ${matchMap.size} 組 MATCH`);
  } catch (err) {
    log(`  ✗ MATCH 產生失敗：${err.message}（將改用詳解自動抽詞）`);
  }
  tick();

  const solutionMd = formatSolutionMd(comments, sections, matchMap);
  const rollupKw = collectRollupKeywords(matchMap, topic, matchAlias, manualKw);

  let integratedMd = typeof buildSolutionOnlyDatabaseMd === 'function'
    ? buildSolutionOnlyDatabaseMd({
      id: entryId,
      subject,
      topic,
      qLabel,
      matchAlias,
      solutionMd,
      matchKeywords: rollupKw,
      metaExtra: {
        style_reference: true,
        method_id: methodIdOverride === 'auto' ? undefined : methodIdOverride,
        q_numbers: [],
        fingerprint: [],
        core_fingerprints: []
      }
    })
    : solutionMd;

  if (typeof finalizeDatabaseMd === 'function') {
    integratedMd = finalizeDatabaseMd(integratedMd, {
      id: entryId,
      subject,
      topic,
      matchAlias,
      solutionOnly: true,
      matchKeywords: rollupKw,
      metaExtra: { style_reference: true, method_id: methodIdOverride === 'auto' ? 'general-exam' : methodIdOverride }
    });
  } else if (typeof repairDatabaseMdRaw === 'function') {
    integratedMd = repairDatabaseMdRaw(integratedMd);
  }

  const stem = buildStemPlaceholder(topic, matchAlias);
  if (typeof SOLUTION_ONLY_STEM_PLACEHOLDER !== 'undefined') {
    integratedMd = integratedMd.replace(SOLUTION_ONLY_STEM_PLACEHOLDER, stem);
  } else {
    integratedMd = integratedMd.replace(
      /（本筆為[^）]+純詳解[^）]*）/,
      stem
    );
  }

  const validation = typeof validateDatabaseMd === 'function'
    ? validateDatabaseMd(integratedMd, filename)
    : { ok: true, issues: [], errors: [], warnings: [], parsed: entryFromDatabaseMd?.(integratedMd, filename) };

  showImportValidation(validation);

  downloadFile(filename, integratedMd);
  installDatabaseFile(filename, integratedMd);

  const parsed = validation.parsed || (typeof entryFromDatabaseMd === 'function' ? entryFromDatabaseMd(integratedMd, filename) : {});
  const meta = parsed.meta || {};
  const matchCount = (parsed.solutionText || solutionMd).match(/<!--\s*MATCH:/gi)?.length || 0;

  log(`\n完成！${filename}`);
  log(`  類型：solution_only（純詳解，無題幹正文）`);
  log(`  題目圖：${needsQuestionImages() ? '已用於 MATCH，未寫入 MD' : '無'}`);
  log(`  MATCH 標記：${matchCount} 處（詳解小節）`);
  log(`  配對別名：${parsed.match_alias || matchAlias || '（無）'}`);
  log(`  整卷關鍵字：${(meta.match_keywords || rollupKw).slice(0, 12).join(', ')}${(meta.match_keywords || rollupKw).length > 12 ? '…' : ''}`);
  log(`  method_id：${meta.method_id || '（自動）'}`);
  if (validation.issues?.length) {
    const level = validation.errors?.length ? '錯誤' : '提醒';
    log(`  格式${level}：${validation.issues.join('；')}`);
  }
  log('已安裝到本機測試；正式使用請放入 database/ 並執行「同步資料庫.bat」');

  importing = false;
  document.getElementById('startImportBtn').disabled = false;
  setProgress(100);
}

if (!getKey()) setTimeout(openKeyModal, 400);
updateImportModeUI();
updateFilenamePreview();
