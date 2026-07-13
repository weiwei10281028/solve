/* 教師知識庫：獨立於舊 database/，只用瀏覽器本機儲存與 JSON 匯出。 */
(function (global) {
  'use strict';

  const KEY = 'chemKnowledgeWorkspace.v1';
  const VERSION = 1;
  const empty = () => ({ version: VERSION, updatedAt: '', items: [], methods: [], audits: [], tests: [], apiLog: [] });

  function uid(prefix) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function asArray(value) {
    if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
    return String(value || '').split(/[、,，\n]/).map(v => v.trim()).filter(Boolean);
  }

  function now() { return new Date().toISOString(); }

  function normalizeItem(raw = {}) {
    const item = {
      id: String(raw.id || uid('item')).trim(),
      subject: String(raw.subject || '化學').trim(),
      grade: String(raw.grade || '高中').trim(),
      chapter: String(raw.chapter || '').trim(),
      concepts: asArray(raw.concepts),
      question_type: String(raw.question_type || '').trim(),
      question_text: String(raw.question_text || '').trim(),
      options: Array.isArray(raw.options) ? raw.options : [],
      teacher_answer: String(raw.teacher_answer || '').trim(),
      solution_text: String(raw.solution_text || '').trim(),
      source_name: String(raw.source_name || '').trim(),
      known_conditions: asArray(raw.known_conditions),
      target: String(raw.target || '').trim(),
      constraints: asArray(raw.constraints),
      method_ids: asArray(raw.method_ids),
      method_summary: String(raw.method_summary || '').trim(),
      common_mistakes: asArray(raw.common_mistakes),
      style_tags: asArray(raw.style_tags),
      equations: Array.isArray(raw.equations) ? raw.equations : [],
      tables: Array.isArray(raw.tables) ? raw.tables : [],
      review_status: ['draft', 'reviewed', 'published'].includes(raw.review_status) ? raw.review_status : 'draft',
      confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
      updated_at: raw.updated_at || now()
    };
    return item;
  }

  function normalizeMethod(raw = {}) {
    return {
      id: String(raw.id || uid('method')).trim(),
      label: String(raw.label || '').trim(),
      applicable_when: asArray(raw.applicable_when),
      not_applicable_when: asArray(raw.not_applicable_when),
      required_checks: asArray(raw.required_checks),
      candidate_steps: asArray(raw.candidate_steps),
      common_mistakes: asArray(raw.common_mistakes),
      example_ids: asArray(raw.example_ids),
      updated_at: raw.updated_at || now()
    };
  }

  function validateItem(raw) {
    const item = normalizeItem(raw);
    const errors = [];
    if (!item.id) errors.push('缺少 ID');
    if (!item.question_text && !item.solution_text) errors.push('至少需要題目或教師詳解');
    if (item.confidence < 0 || item.confidence > 1) errors.push('信心值必須介於 0 與 1');
    return { ok: !errors.length, errors, item };
  }

  function validateMethod(raw) {
    const method = normalizeMethod(raw);
    const errors = [];
    if (!method.id) errors.push('缺少方法 ID');
    if (!method.label) errors.push('缺少方法名稱');
    if (!method.applicable_when.length) errors.push('至少填一項適用條件');
    if (!method.required_checks.length) errors.push('至少填一項必要檢查');
    return { ok: !errors.length, errors, method };
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || raw.version !== VERSION) return empty();
      return {
        version: VERSION,
        updatedAt: raw.updatedAt || '',
        items: (raw.items || []).map(normalizeItem),
        methods: (raw.methods || []).map(normalizeMethod),
        audits: Array.isArray(raw.audits) ? raw.audits : [],
        tests: Array.isArray(raw.tests) ? raw.tests : [],
        apiLog: Array.isArray(raw.apiLog) ? raw.apiLog : []
      };
    } catch (_) { return empty(); }
  }

  let state = read();
  function persist() {
    state.updatedAt = now();
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  }
  function snapshot() { return JSON.parse(JSON.stringify(state)); }
  function upsert(collection, value, normalize) {
    const next = normalize(value);
    const list = state[collection];
    const index = list.findIndex(x => x.id === next.id);
    if (index >= 0) list[index] = next;
    else list.push(next);
    persist();
    return next;
  }
  function remove(collection, id) {
    state[collection] = state[collection].filter(x => x.id !== id);
    persist();
  }
  function replaceAll(next) {
    state = {
      version: VERSION,
      updatedAt: now(),
      items: (next.items || []).map(normalizeItem),
      methods: (next.methods || []).map(normalizeMethod),
      audits: Array.isArray(next.audits) ? next.audits : [],
      tests: Array.isArray(next.tests) ? next.tests : [],
      apiLog: Array.isArray(next.apiLog) ? next.apiLog : []
    };
    persist();
    return snapshot();
  }
  function download(filename, content, mime = 'application/json;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  global.KnowledgeStore = {
    VERSION, asArray, uid, now, read: snapshot, persist, replaceAll, download,
    validateItem, validateMethod,
    addItem: value => upsert('items', value, normalizeItem),
    addMethod: value => upsert('methods', value, normalizeMethod),
    removeItem: id => remove('items', id),
    removeMethod: id => remove('methods', id),
    saveAudit: value => upsert('audits', { ...value, id: value.id || uid('audit'), updated_at: now() }, x => x),
    saveTest: value => upsert('tests', { ...value, id: value.id || uid('test'), updated_at: now() }, x => x),
    logApi: value => { state.apiLog.unshift({ id: uid('api'), created_at: now(), ...value }); persist(); },
    exportJson: () => JSON.stringify(snapshot(), null, 2),
    importJson: text => replaceAll(JSON.parse(text)),
    clear: () => { state = empty(); persist(); }
  };
})(window);
