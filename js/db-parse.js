/* 題庫 .md 解析：YAML 檔頭 + ## 題幹 / ## 詳解 */

function splitFrontmatter(raw = '') {
  let text = String(raw).replace(/^\uFEFF/, '');
  if (text.startsWith('\\---')) text = '---' + text.slice(4);
  if (!text.startsWith('---')) return { meta: {}, body: text.trim() };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: text.trim() };
  const yaml = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\s*/, '');
  return { meta: parseSimpleYaml(yaml), body: body.trim() };
}

function parseSimpleYaml(yaml = '') {
  const obj = {};
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    const joined = buf.join('\n').trim();
    obj[key] = parseYamlValue(joined);
    key = null;
    buf = [];
  };
  for (const line of String(yaml).split('\n')) {
    const km = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (km) {
      flush();
      key = km[1].replace(/\\/g, '');
      const rest = km[2].trim();
      if (rest) buf.push(rest);
    } else if (key && /^\s+-\s+/.test(line)) {
      buf.push(line.trim());
    } else if (key && line.trim()) {
      buf.push(line.trim());
    }
  }
  flush();
  return obj;
}

function parseYamlValue(raw = '') {
  const v = String(raw).trim();
  if (!v) return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('[')) {
    try { return JSON.parse(v.replace(/'/g, '"')); } catch { return []; }
  }
  if (/^- /.test(v)) {
    return v.split(/\n/).map(s => s.replace(/^- /, '').trim()).filter(Boolean);
  }
  return v.replace(/^["']|["']$/g, '');
}

function serializeMeta(meta = {}) {
  const lines = ['---'];
  const order = [
    'id', 'type', 'subject', 'topic', 'q_label', 'match_alias', 'method_id',
    'solution_only', 'catalog_only', 'q_numbers', 'fingerprint', 'core_fingerprints',
    'match_keywords', 'concept_tags', 'answer_key', 'critical_judgment',
    'forbidden_steps', 'pitfalls'
  ];
  const seen = new Set();
  for (const k of order) {
    if (meta[k] === undefined || meta[k] === '' || meta[k] === null) continue;
    lines.push(formatYamlLine(k, meta[k]));
    seen.add(k);
  }
  for (const [k, val] of Object.entries(meta)) {
    if (seen.has(k) || val === undefined || val === '') continue;
    lines.push(formatYamlLine(k, val));
  }
  lines.push('---');
  return lines.join('\n');
}

function formatYamlLine(key, val) {
  const safeKey = String(key).replace(/\\/g, '');
  if (Array.isArray(val)) {
    if (!val.length) return `${safeKey}: []`;
    if (val.every(x => typeof x === 'string' || typeof x === 'number')) {
      return `${safeKey}: ${JSON.stringify(val)}`;
    }
    return `${safeKey}:\n${val.map(v => `  - ${v}`).join('\n')}`;
  }
  if (typeof val === 'boolean') return `${safeKey}: ${val}`;
  if (typeof val === 'number') return `${safeKey}: ${val}`;
  const s = String(val);
  if (/[:#\[\]{}]/.test(s)) return `${safeKey}: "${s.replace(/"/g, '\\"')}"`;
  return `${safeKey}: ${s}`;
}

/** 修正匯入／手動編輯常見的 YAML 檔頭錯誤（\\---、catalog\\_only 等） */
function repairDatabaseMdRaw(raw = '') {
  let text = String(raw).replace(/^\uFEFF/, '');
  if (text.startsWith('\\---')) text = '---' + text.slice(4);
  text = text.replace(/\n\\---(\s*\n)/g, '\n---$1');
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('\n---', 3);
  if (end < 0) return text;
  const yaml = text.slice(3, end)
    .split('\n')
    .map(line => line.replace(/^([a-zA-Z_][\w\\-]*):/, m => m.replace(/\\/g, '')))
    .join('\n');
  return `---${yaml}${text.slice(end)}`;
}

/** 在題幹自動插入 <!-- MATCH: ... -->（供圖片配對；段考逐題、單題整段） */
function injectMatchComments(questionMd = '', extraKeywords = []) {
  const extra = (extraKeywords || []).map(s => String(s).trim()).filter(Boolean);
  const addComment = (block, keywords) => {
    const kw = [...new Set([...(keywords || []), ...extra])].filter(Boolean);
    if (!kw.length) return block;
    const comment = `<!-- MATCH: ${kw.join(',')} -->`;
    const firstNl = block.indexOf('\n');
    if (firstNl === -1) return `${block}\n${comment}`;
    return `${block.slice(0, firstNl)}\n${comment}${block.slice(firstNl)}`;
  };

  let text = String(questionMd || '').trim();
  if (!text) return text;

  const stemKw = typeof extractStemPhraseKeywords === 'function'
    ? extractStemPhraseKeywords(text)
    : [];

  const numbered = [...text.matchAll(/(?:^|\n)(\d{1,2})\.\s[^\n]*/g)];
  if (numbered.length) {
    return text.replace(
      /(?:^|\n)(\d{1,2})\.\s[\s\S]*?(?=\n\d{1,2}\.\s|\n##\s|$)/g,
      block => {
        if (/<!--\s*MATCH:/i.test(block)) return block;
        const kw = typeof extractStemPhraseKeywords === 'function'
          ? extractStemPhraseKeywords(block)
          : stemKw;
        const prefix = block.startsWith('\n') ? '\n' : '';
        const body = prefix ? block.slice(1) : block;
        return prefix + addComment(body, kw);
      }
    );
  }

  if (/<!--\s*MATCH:/i.test(text)) return text;
  return addComment(text, stemKw);
}

const SOLUTION_SECTION_HEAD = /(?:^|\n)(#{1,3}\s*)?((?:第\s*\d+\s*題|類題\s*[\d.\-]+)[^\n]*)/g;

/** 純詳解：各小節（第 N 題、類題）加 MATCH 供圖片配對 */
function injectSolutionMatchComments(solutionMd = '', extraKeywords = []) {
  const extra = (extraKeywords || []).map(s => String(s).trim()).filter(Boolean);
  let text = String(solutionMd || '').trim();
  if (!text) return text;

  const addComment = (block, keywords) => {
    const kw = [...new Set([...(keywords || []), ...extra])].filter(Boolean);
    if (!kw.length) return block;
    if (/<!--\s*MATCH:/i.test(block)) return block;
    const comment = `<!-- MATCH: ${kw.join(',')} -->`;
    const firstNl = block.indexOf('\n');
    if (firstNl === -1) return `${block}\n${comment}`;
    return `${block.slice(0, firstNl)}\n${comment}${block.slice(firstNl)}`;
  };

  const heads = [...text.matchAll(SOLUTION_SECTION_HEAD)];
  if (!heads.length) {
    const kw = typeof extractStemPhraseKeywords === 'function'
      ? extractStemPhraseKeywords(text)
      : [];
    return addComment(text, kw);
  }

  return text.replace(
    /(?:^|\n)(#{1,3}\s*)?((?:第\s*\d+\s*題|類題\s*[\d.\-]+)[\s\S]*?)(?=\n#{1,3}\s*(?:第\s*\d+\s*題|類題\s*[\d.\-]+)|\n第\s*\d+\s*題|\n類題\s*[\d.\-]+|$)/g,
    block => {
      if (/<!--\s*MATCH:/i.test(block)) return block;
      const kw = typeof extractStemPhraseKeywords === 'function'
        ? extractStemPhraseKeywords(block)
        : [];
      const prefix = block.startsWith('\n') ? '\n' : '';
      const body = prefix ? block.slice(1) : block;
      return prefix + addComment(body, kw);
    }
  );
}

const SOLUTION_ONLY_STEM_PLACEHOLDER = '（本筆為純詳解範例，無題幹；解題時依圖片條件與詳解內 MATCH 關鍵字配對。）';

/** 匯出前最終整理：修 YAML、注入 MATCH、重寫標準檔頭 */
function finalizeDatabaseMd(md, overrides = {}) {
  const repaired = repairDatabaseMdRaw(md);
  const { meta, body } = splitFrontmatter(repaired);
  const { questionText, solutionText } = splitSections(body);
  const solutionOnly = !!meta.solution_only || meta.type === 'solution_only' || !!overrides.solutionOnly;
  const manualKw = overrides.matchKeywords || meta.match_keywords || [];
  const questionFixed = solutionOnly ? '' : injectMatchComments(questionText, manualKw);
  const solutionFixed = solutionOnly
    ? injectSolutionMatchComments(solutionText, manualKw)
    : solutionText;

  return buildIntegratedDatabaseMd({
    id: meta.id || overrides.id,
    type: meta.type || overrides.type || 'single',
    subject: meta.subject || overrides.subject || '化學',
    topic: meta.topic || overrides.topic || '',
    qLabel: meta.q_label || meta.qLabel || overrides.qLabel || '',
    matchAlias: meta.match_alias || overrides.matchAlias || '',
    catalogOnly: meta.catalog_only ?? overrides.catalogOnly ?? false,
    solutionOnly,
    questionMd: questionFixed,
    solutionMd: solutionFixed,
    metaExtra: {
      ...meta,
      match_keywords: manualKw.length ? manualKw : meta.match_keywords,
      method_id: overrides.methodId || meta.method_id
    }
  });
}

/** 檢查 .md 是否可被題庫正確讀取 */
function validateDatabaseMd(md, filename = '') {
  const issues = [];
  const warnings = [];
  const raw = String(md || '');
  const headChunk = raw.split('\n---')[0] || raw.slice(0, 1200);
  if (raw.startsWith('\\---')) issues.push('YAML 檔頭以 \\--- 開頭（應為 ---）');
  if (!raw.trim().startsWith('---')) issues.push('缺少 YAML 檔頭 ---（topic／match_keywords 等 meta 無法讀取）');
  if (/\\_only:|\\_id:|\\_numbers:/.test(headChunk)) {
    issues.push('YAML 欄位名稱含多餘反斜線（應為 catalog_only 等）');
  }
  if (/\]\s*##\s*題幹/.test(headChunk)) {
    issues.push('pitfalls 或陣列結尾與 ## 題幹 黏在同一行（應換行並以 --- 結束 YAML）');
  }

  const repaired = repairDatabaseMdRaw(raw);
  const { meta: yamlMeta, body } = splitFrontmatter(repaired);
  const pitfallKind = String(yamlMeta.kind || '').trim();

  if (pitfallKind === 'format') {
    if (!yamlMeta.id?.trim()) issues.push('版型缺少 id');
    if (!yamlMeta.label?.trim()) issues.push('版型缺少 label');
    if (!yamlMeta.layout_id?.trim()) issues.push('版型缺少 layout_id');
    if (!body.trim() || !/##\s+\S/.test(body)) issues.push('版型正文須含 ## 小節內容');
    const allIssues = [...issues, ...warnings];
    return { ok: !issues.length, issues: allIssues, errors: issues, warnings, parsed: null };
  }

  if (pitfallKind === 'type' || pitfallKind === 'trap') {
    if (!yamlMeta.id?.trim()) issues.push('題眼卡缺少 id');
    if (!yamlMeta.label?.trim()) issues.push('題眼卡缺少 label');
    const hasTrigger = (Array.isArray(yamlMeta.trigger_all) && yamlMeta.trigger_all.length)
      || (Array.isArray(yamlMeta.trigger_any) && yamlMeta.trigger_any.length);
    if (!hasTrigger) issues.push('題眼卡須有 trigger_all 或 trigger_any');
    if (!body.trim() || !/##\s+\S/.test(body)) issues.push('題眼卡正文須含 ## 小節內容');
    if (pitfallKind === 'trap' && !(yamlMeta.error_signals || []).length) {
      warnings.push('難題題眼建議設 error_signals（答案不符時偵測用）');
    }
    const allIssues = [...issues, ...warnings];
    return { ok: !issues.length, issues: allIssues, errors: issues, warnings, parsed: null };
  }

  const parsed = entryFromDatabaseMd(repaired, filename);
  const isSolutionOnly = !!parsed.meta?.solution_only || parsed.type === 'solution_only';
  if (!parsed.meta?.topic?.trim()) warnings.push('topic 為空（章節風格配對會變弱）');
  if (isSolutionOnly && parsed.meta?.style_reference !== true) {
    warnings.push('建議設 style_reference: true');
  }
  if (!isSolutionOnly && !parsed.questionText?.trim()) issues.push('缺少 ## 題幹 內容');
  if (!parsed.solutionText?.trim()) issues.push('缺少 ## 詳解 內容');
  if (!isSolutionOnly && !/<!--\s*MATCH:/i.test(parsed.questionText) && parsed.type === 'single') {
    warnings.push('單題建議含 <!-- MATCH: ... -->（已嘗試自動補上）');
  }
  if (isSolutionOnly && !/<!--\s*MATCH:/i.test(parsed.solutionText)) {
    warnings.push('純詳解建議含 <!-- MATCH: ... -->（已嘗試自動補上）');
  }
  if (isSolutionOnly && !/###\s*板書風格範本/.test(parsed.solutionText || '')) {
    warnings.push('建議含「### 板書風格範本」小節（供 AI 模仿 NOTE 與開場）');
  }
  if (isSolutionOnly && !/###\s*類題/.test(parsed.solutionText || '')) {
    warnings.push('建議含「### 類題」同型小節（供章節泛用配對）');
  }
  if (parsed.type === 'exam' && !parsed.meta?.catalog_only) {
    warnings.push('段考卷建議設 catalog_only: true');
  }
  const allIssues = [...issues, ...warnings];
  return { ok: !issues.length, issues: allIssues, errors: issues, warnings, parsed };
}

function splitSections(body = '') {
  const text = String(body);
  const qMatch = text.match(/##\s*題幹\s*\n([\s\S]*?)(?=\n##\s*詳解|$)/i);
  const sMatch = text.match(/##\s*詳解\s*\n([\s\S]*)$/i);
  if (qMatch || sMatch) {
    return {
      questionText: (qMatch?.[1] || '').trim(),
      solutionText: (sMatch?.[1] || '').trim()
    };
  }
  return { questionText: '', solutionText: text.trim() };
}

/** 將單一 .md 轉成程式用的 entry */
function entryFromDatabaseMd(raw, filename = '') {
  const { meta: yamlMeta, body } = splitFrontmatter(raw);
  const pitfallKind = String(yamlMeta.kind || '').trim();
  const formatBody = pitfallKind === 'format' ? body.trim() : '';
  const pitfallBody = (pitfallKind === 'type' || pitfallKind === 'trap') ? body.trim() : '';
  const { questionText, solutionText } = formatBody || pitfallBody
    ? { questionText: '', solutionText: formatBody || pitfallBody }
    : splitSections(body);
  const id = yamlMeta.id || filename.replace(/\.md$/i, '');
  const type = yamlMeta.type || (yamlMeta.catalog_only ? 'exam' : (pitfallKind || 'single'));
  const solutionOnly = !!yamlMeta.solution_only || type === 'solution_only';
  const meta = {
    kind: pitfallKind || yamlMeta.kind || '',
    label: yamlMeta.label || '',
    layout_id: yamlMeta.layout_id || '',
    inject: yamlMeta.inject || '',
    priority: yamlMeta.priority != null ? yamlMeta.priority : 10,
    trigger_all: yamlMeta.trigger_all || [],
    trigger_any: yamlMeta.trigger_any || [],
    suppress_if_any: yamlMeta.suppress_if_any || [],
    inject_stage: yamlMeta.inject_stage || '',
    error_signals: yamlMeta.error_signals || [],
    method_id: yamlMeta.method_id || 'general-chem',
    fingerprint: yamlMeta.fingerprint || [],
    core_fingerprints: yamlMeta.core_fingerprints || yamlMeta.fingerprint || [],
    concept_tags: yamlMeta.concept_tags || [],
    match_keywords: yamlMeta.match_keywords || [],
    q_numbers: yamlMeta.q_numbers || [],
    answer_key: yamlMeta.answer_key || '',
    critical_judgment: yamlMeta.critical_judgment || '',
    forbidden_steps: yamlMeta.forbidden_steps || [],
    pitfalls: yamlMeta.pitfalls || [],
    catalog_only: !!yamlMeta.catalog_only || type === 'exam',
    solution_only: solutionOnly
  };
  const needsAuto = !pitfallKind
    && !meta.catalog_only
    && (!meta.fingerprint.length || !meta.match_keywords.length || (!solutionOnly && !meta.q_numbers.length));
  if (needsAuto && typeof buildEntryMeta === 'function' && (questionText || solutionText)) {
    const auto = buildEntryMeta({
      id,
      topic: yamlMeta.topic || '',
      qLabel: yamlMeta.q_label || yamlMeta.qLabel || '',
      questionMd: solutionOnly ? '' : questionText,
      solutionMd: solutionText,
      methodIdOverride: yamlMeta.method_id || 'auto',
      solutionOnly
    });
    if (!meta.fingerprint.length && auto.fingerprint?.length) meta.fingerprint = auto.fingerprint;
    if (!meta.core_fingerprints.length && auto.core_fingerprints?.length) {
      meta.core_fingerprints = auto.core_fingerprints;
    }
    if (!meta.match_keywords.length && auto.match_keywords?.length) meta.match_keywords = auto.match_keywords;
    if (!meta.q_numbers.length && auto.q_numbers?.length) meta.q_numbers = auto.q_numbers;
    if (!meta.answer_key && auto.answer_key) meta.answer_key = auto.answer_key;
    if (!meta.critical_judgment && auto.critical_judgment) meta.critical_judgment = auto.critical_judgment;
  }
  return {
    id,
    file: filename,
    type,
    subject: yamlMeta.subject || '化學',
    topic: yamlMeta.topic || yamlMeta.label || '',
    qLabel: yamlMeta.q_label || yamlMeta.qLabel || '',
    match_alias: yamlMeta.match_alias || '',
    chars: questionText.length + solutionText.length,
    meta,
    questionText,
    solutionText
  };
}

/** 匯入頁：組合成單一 .md */
function buildIntegratedDatabaseMd({
  id,
  type = 'single',
  subject = '化學',
  topic = '',
  qLabel = '',
  matchAlias = '',
  catalogOnly = false,
  solutionOnly = false,
  questionMd = '',
  solutionMd = '',
  metaExtra = {},
  matchKeywords = []
} = {}) {
  if (solutionOnly) {
    return buildSolutionOnlyDatabaseMd({
      id, subject, topic, qLabel, matchAlias, solutionMd, metaExtra, matchKeywords
    });
  }
  const questionBody = injectMatchComments(
    String(questionMd || '').trim(),
    matchKeywords.length ? matchKeywords : (metaExtra.match_keywords || [])
  );
  const autoMeta = typeof buildEntryMeta === 'function'
    ? buildEntryMeta({
      id,
      topic,
      qLabel,
      questionMd: questionBody,
      solutionMd,
      methodIdOverride: metaExtra.method_id || metaExtra.methodIdOverride || 'auto'
    })
    : {};
  const isExam = type === 'exam' || catalogOnly
    || (extractQuestionNumbers?.(questionBody)?.length || 0) > 8;
  const manualKw = matchKeywords.length ? matchKeywords : (metaExtra.match_keywords || []);
  const meta = {
    id,
    type: isExam ? 'exam' : 'single',
    subject,
    topic,
    q_label: qLabel,
    match_alias: matchAlias,
    catalog_only: isExam,
    ...autoMeta,
    ...metaExtra
  };
  if (manualKw.length) meta.match_keywords = manualKw;
  if (isExam) meta.catalog_only = true;
  return `${serializeMeta(meta)}\n\n## 題幹\n\n${questionBody}\n\n## 詳解\n\n${String(solutionMd || '').trim()}\n`;
}

/** 純詳解範例（無題幹） */
function buildSolutionOnlyDatabaseMd({
  id,
  subject = '化學',
  topic = '',
  qLabel = '',
  matchAlias = '',
  solutionMd = '',
  metaExtra = {},
  matchKeywords = []
} = {}) {
  const manualKw = matchKeywords.length ? matchKeywords : (metaExtra.match_keywords || []);
  const solutionBody = injectSolutionMatchComments(String(solutionMd || '').trim(), manualKw);
  const autoMeta = typeof buildEntryMeta === 'function'
    ? buildEntryMeta({
      id,
      topic,
      qLabel,
      questionMd: '',
      solutionMd: solutionBody,
      methodIdOverride: metaExtra.method_id || metaExtra.methodIdOverride || 'auto',
      solutionOnly: true
    })
    : {};
  const meta = {
    id,
    type: 'solution_only',
    subject,
    topic,
    q_label: qLabel,
    match_alias: matchAlias,
    style_reference: true,
    solution_only: true,
    catalog_only: false,
    ...autoMeta,
    ...metaExtra,
    solution_only: true,
    type: 'solution_only'
  };
  if (meta.style_reference !== false) meta.style_reference = true;
  if (manualKw.length) meta.match_keywords = manualKw;
  return `${serializeMeta(meta)}\n\n## 題幹\n\n${SOLUTION_ONLY_STEM_PLACEHOLDER}\n\n## 詳解\n\n${solutionBody}\n`;
}
