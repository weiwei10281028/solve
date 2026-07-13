/* 知識庫工具共用：只做本機解析、分類、比對與化學式基本檢查。 */
(function (global) {
  'use strict';

  const hints = [
    { words: ['限量', '莫耳比', '產量', '剩餘'], concept: '反應計量', type: '反應計量', method: 'reaction-stoichiometry' },
    { words: ['平衡', 'Kc', 'Kp', 'Ka', 'Kb', 'Ksp', 'pH'], concept: '化學平衡', type: '平衡與酸鹼', method: 'equilibrium-table' },
    { words: ['電解', '法拉第', '電極', '串聯', '並聯'], concept: '電化學', type: '電解', method: 'electrolysis-parallel' },
    { words: ['氧化數', '氧化', '還原', '電子'], concept: '氧化還原', type: '氧化還原', method: 'redox-half-reaction' },
    { words: ['氣體', '分壓', 'mmHg', 'atm', 'PV=nRT'], concept: '氣體', type: '氣體計算', method: 'gas-law' },
    { words: ['結構式', '官能基', '異構物', '有機'], concept: '有機化學', type: '結構與性質', method: 'organic-structure' }
  ];

  function esc(text) {
    return String(text || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  }

  function parseFrontmatter(raw) {
    const text = String(raw || '').replace(/\r\n?/g, '\n');
    if (!text.startsWith('---\n')) return { meta: {}, body: text };
    const close = text.indexOf('\n---', 4);
    if (close < 0) return { meta: {}, body: text };
    const meta = {};
    text.slice(4, close).split('\n').forEach(line => {
      const hit = line.match(/^([^:#]+):\s*(.*)$/);
      if (!hit) return;
      const key = hit[1].trim();
      const value = hit[2].trim().replace(/^['"]|['"]$/g, '');
      if (/^\[.*\]$/.test(value)) {
        try { meta[key] = JSON.parse(value.replace(/'/g, '"')); } catch (_) { meta[key] = value.split(',').map(v => v.trim()).filter(Boolean); }
      } else meta[key] = value;
    });
    return { meta, body: text.slice(close + 4).replace(/^\n/, '') };
  }

  function section(body, labels) {
    const all = String(body || '');
    const name = labels.join('|');
    const re = new RegExp(`^##\\s*(?:${name})\\s*$`, 'im');
    const start = all.search(re);
    if (start < 0) return '';
    const after = all.slice(start).replace(re, '');
    const next = after.search(/^##\s+/m);
    return (next < 0 ? after : after.slice(0, next)).trim();
  }

  function parseMarkdown(raw, filename = '') {
    const { meta, body } = parseFrontmatter(raw);
    const question = section(body, ['題幹', '題目', '問題']) || String(meta.question_text || '');
    const solution = section(body, ['詳解', '解答', '解析']) || body.trim();
    return {
      id: String(meta.id || filename.replace(/\.[^.]+$/, '') || '').trim(),
      source_name: filename,
      subject: meta.subject || '化學', grade: meta.grade || '高中', chapter: meta.topic || meta.chapter || '',
      concepts: meta.concept_tags || meta.concepts || [], question_type: meta.question_type || '',
      question_text: question, teacher_answer: meta.answer_key || meta.teacher_answer || '', solution_text: solution,
      known_conditions: meta.known_conditions || [], target: meta.target || '', method_ids: meta.method_ids || (meta.method_id ? [meta.method_id] : []),
      common_mistakes: meta.pitfalls || [], style_tags: meta.style_tags || [], review_status: 'draft', confidence: 0
    };
  }

  function unique(items) { return [...new Set((items || []).filter(Boolean))]; }
  function localSuggest(item, methods = []) {
    const text = `${item.question_text || ''}\n${item.solution_text || ''}`;
    const matched = hints.filter(h => h.words.some(word => text.includes(word)));
    const concepts = unique([...KnowledgeStore.asArray(item.concepts), ...matched.map(h => h.concept)]);
    const methodIds = unique([...KnowledgeStore.asArray(item.method_ids), ...matched.map(h => h.method)]);
    const known = [];
    const unitMatches = text.match(/(?:\d+(?:\.\d+)?\s*(?:mol|g|mL|L|M|atm|mmHg|K|°C|%))/g) || [];
    if (unitMatches.length) known.push(`題目含定量資料：${unitMatches.slice(0, 5).join('、')}`);
    if (/反應完全|完全反應/.test(text)) known.push('反應完全');
    const type = item.question_type || matched[0]?.type || '';
    const available = new Set(methods.map(m => m.id));
    return {
      ...item, concepts, question_type: type, known_conditions: unique([...KnowledgeStore.asArray(item.known_conditions), ...known]),
      method_ids: methodIds.filter(id => !available.size || available.has(id)),
      style_tags: unique([...KnowledgeStore.asArray(item.style_tags), '逐步列式', '答案附單位']),
      confidence: Math.max(Number(item.confidence) || 0, matched.length ? 0.55 : 0.25)
    };
  }

  function tokenize(text) {
    return unique((String(text || '').toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-z][a-z0-9+\-]*/g) || []).filter(x => x.length > 1));
  }

  function analyzeQuestion(question, methods = [], items = []) {
    const base = localSuggest({ question_text: question, solution_text: '', concepts: [], method_ids: [] }, methods);
    const sourceTokens = tokenize(question);
    const candidates = methods.map(method => {
      const words = tokenize([method.label, ...(method.applicable_when || [])].join(' '));
      const blocked = (method.not_applicable_when || []).filter(x => String(question).includes(x));
      const hits = words.filter(word => sourceTokens.includes(word));
      return { method, score: hits.length * 2 + base.method_ids.includes(method.id), hits, blocked };
    }).filter(x => !x.blocked.length).sort((a, b) => b.score - a.score).slice(0, 4);
    const related = items.map(item => {
      const overlap = tokenize(`${item.question_text}\n${item.concepts.join(' ')}`).filter(x => sourceTokens.includes(x)).length;
      return { item, overlap };
    }).filter(x => x.overlap).sort((a, b) => b.overlap - a.overlap).slice(0, 3);
    const required = unique(candidates.flatMap(x => x.method.required_checks || [])).slice(0, 8);
    return { ...base, candidates, related, required, excluded: methods.filter(m => (m.not_applicable_when || []).some(x => String(question).includes(x))) };
  }

  function answerSet(value) {
    const text = String(value || '').toUpperCase().replace(/[（）()\s]/g, '');
    const letters = text.match(/[A-E]/g);
    return letters ? unique(letters).sort() : [text].filter(Boolean);
  }
  function auditAnswer(expected, rows) {
    const expectedSet = answerSet(expected);
    const selected = rows.filter(r => r.correct).map(r => String(r.label || '').toUpperCase()).sort();
    const missingReason = rows.filter(r => !String(r.reason || '').trim()).map(r => r.label);
    const same = expectedSet.join('') === selected.join('');
    return {
      ok: same && !missingReason.length,
      expected: expectedSet, selected, missingReason,
      conflict: same ? '' : `教師答案為 ${expectedSet.join('')}，逐項判定為 ${selected.join('') || '無'}`
    };
  }

  function parseFormula(formula) {
    const clean = String(formula || '').replace(/\s/g, '')
      .replace(/(?:\([a-z]{1,3}\)|\[[a-z]{1,3}\])$/i, '')
      .replace(/(?:\^?\d*[+\-])$/, '');
    const add = (target, source, multiplier = 1) => Object.entries(source).forEach(([el, count]) => {
      target[el] = (target[el] || 0) + count * multiplier;
    });
    const parseOne = text => {
      const stack = [{}];
      for (let i = 0; i < text.length;) {
        const ch = text[i];
        if (ch === '(' || ch === '[') { stack.push({}); i++; continue; }
        if (ch === ')' || ch === ']') {
          const group = stack.pop() || {}; i++;
          const digits = text.slice(i).match(/^\d+/)?.[0] || '';
          i += digits.length; add(stack[stack.length - 1] || {}, group, Number(digits || 1)); continue;
        }
        const element = text.slice(i).match(/^[A-Z][a-z]?/)?.[0];
        if (element) {
          i += element.length;
          const digits = text.slice(i).match(/^\d+/)?.[0] || '';
          i += digits.length;
          const current = stack[stack.length - 1];
          current[element] = (current[element] || 0) + Number(digits || 1);
          continue;
        }
        i++;
      }
      while (stack.length > 1) add(stack[0], stack.pop());
      return stack[0];
    };
    const total = {};
    clean.split(/[·.]/).filter(Boolean).forEach(part => {
      const prefix = part.match(/^(\d+)(?=[A-Z(\[])/)?.[1] || '';
      add(total, parseOne(part.slice(prefix.length)), Number(prefix || 1));
    });
    return total;
  }
  function parseTerm(term) {
    const hit = String(term || '').trim().match(/^(\d+(?:\.\d+)?)?\s*([^\s]+).*$/);
    if (!hit) return null;
    return { coefficient: Number(hit[1] || 1), formula: hit[2], atoms: parseFormula(hit[2]) };
  }
  function parseReaction(reaction) {
    const pieces = String(reaction || '').split(/(?:→|⇌|=|->)/);
    if (pieces.length !== 2) return null;
    const side = text => text.split(/\s+\+\s+/).map(parseTerm).filter(Boolean);
    return { reactants: side(pieces[0]), products: side(pieces[1]) };
  }
  function totalAtoms(terms) {
    const result = {};
    terms.forEach(term => Object.entries(term.atoms).forEach(([el, count]) => { result[el] = (result[el] || 0) + count * term.coefficient; }));
    return result;
  }
  function checkReaction(reaction) {
    const parsed = parseReaction(reaction);
    if (!parsed) return { ok: false, error: '請以 →、⇌、= 或 -> 分隔反應物與生成物' };
    const left = totalAtoms(parsed.reactants); const right = totalAtoms(parsed.products);
    const elements = unique([...Object.keys(left), ...Object.keys(right)]);
    const difference = elements.filter(el => left[el] !== right[el]).map(el => `${el}: ${left[el] || 0} / ${right[el] || 0}`);
    return { ok: !difference.length, left, right, difference, parsed };
  }
  function stoich(rows) {
    const data = rows.map(row => ({ ...row, amount: Number(row.amount), coefficient: Number(row.coefficient) }));
    const reactants = data.filter(row => row.role === 'reactant' && row.coefficient > 0 && row.amount >= 0);
    const ratios = reactants.map(row => ({ ...row, ratio: row.amount / row.coefficient }));
    const limiting = ratios.length ? ratios.reduce((a, b) => a.ratio <= b.ratio ? a : b) : null;
    const issues = data.filter(row => !Number.isFinite(row.amount) || !Number.isFinite(row.coefficient) || row.coefficient <= 0).map(row => row.name || '未命名列');
    return { limiting, ratios, issues };
  }

  global.KnowledgeTools = { esc, parseMarkdown, localSuggest, analyzeQuestion, answerSet, auditAnswer, checkReaction, stoich, tokenize };
})(window);
