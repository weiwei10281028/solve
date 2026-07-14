/* 詳解格式閘門與 SolutionDocument 編譯器。
 * 同一份驗證規則可被瀏覽器與 Node serverless 使用；AI 永遠不直接提供 HTML。 */
(function (global) {
  'use strict';

  const VERSION = 1;
  const BLOCK_TYPES = new Set(['section', 'paragraph', 'choice_analysis', 'math', 'chemical_equation', 'stoichiometry_table', 'calculation', 'answer']);
  const NOTE_KINDS = new Set(['condition', 'concept', 'quantity', 'conversion', 'factor', 'table_state']);
  const VAGUE_NOTE_RE = /^(?:數值|結果|公式|計算|濃度|體積|質量|莫耳數|因子)$/;
  const FORBIDDEN_LATEX_RE = /(?:\\(?:html|href|url|includegraphics|class|style|tag|def|newcommand)|<|>|javascript:|data:)/i;
  const FORBIDDEN_TEXT_RE = /(?:<\/?[a-z]|javascript:|data:text\/html)/i;

  /* Google Structured Output 可使用的 JSON Schema 子集；語意規則由 validate 再檢查。 */
  const SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'blocks'],
    properties: {
      version: { type: 'integer', enum: [VERSION] },
      blocks: {
        type: 'array', minItems: 1, maxItems: 48,
        items: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', enum: [...BLOCK_TYPES] },
            title: { type: 'string' }, text: { type: 'string' }, latex: { type: 'string' }, display: { type: 'boolean' },
            content: { type: 'array', items: { type: 'object' } }, notes: { type: 'array', items: { type: 'object' } },
            items: { type: 'array', items: { type: 'object' } }, reaction: { type: 'object' }, species: { type: 'array', items: { type: 'object' } },
            mode: { type: 'string', enum: ['initial_change_final', 'initial_complete_reverse_equilibrium'] },
            quantity: { type: 'string' }, unit: { type: 'string' }, rows: { type: 'array', items: { type: 'object' } },
            answer: { type: 'object' }, explanation: { type: 'string' }, verification: { type: 'object' }
          }
        }
      }
    }
  };

  function validate(latex, displayMode) {
    if (typeof global.katex === 'undefined' || !global.katex.renderToString) return true;
    global.katex.renderToString(latex, { displayMode: !!displayMode, throwOnError: true, strict: 'ignore', trust: false });
    return true;
  }

  function normalizeDelimiters(text) {
    return String(text || '').replace(/\r\n?/g, '\n')
      .replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => `$$${String(tex).trim()}$$`)
      .replace(/\\\(([^\n]*?)\\\)/g, (_, tex) => `$${String(tex).trim()}$`)
      .replace(/\$\$\s*\n?([\s\S]*?)\n?\s*\$\$/g, (_, tex) => `$$${String(tex).trim()}$$`);
  }

  function mathRanges(text) {
    const ranges = [];
    const re = /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
    let match;
    while ((match = re.exec(text))) ranges.push({ start: match.index, end: re.lastIndex, latex: (match[1] == null ? match[2] : match[1]).trim(), display: match[1] != null });
    return ranges;
  }

  function outsideMath(text, ranges) {
    let cursor = 0;
    return ranges.map(range => { const part = text.slice(cursor, range.start); cursor = range.end; return part; }).join('') + text.slice(cursor);
  }

  function check(text) {
    const ranges = mathRanges(text); const errors = []; const warnings = [];
    ranges.forEach(range => {
      if (!range.latex) errors.push('發現空白公式分隔符號');
      else { try { validate(range.latex, range.display); } catch (err) { errors.push(`公式無法渲染：${String(err.message || err).slice(0, 80)}`); } }
    });
    const plain = outsideMath(text, ranges);
    const leaked = plain.match(/\\(?:d?frac|sqrt|times|cdot|left|right|mathrm|text|ce|cech|rightarrow|rightleftharpoons|Delta|alpha|beta|gamma|log)\b/g);
    if (leaked?.length) errors.push(`發現 ${leaked.length} 個未包進 $...$ 的 LaTeX 指令`);
    if ((plain.match(/(?<!\\)\$/g) || []).length) errors.push('發現未配對的 $ 符號');
    if (/〔[^〕]*〕/.test(text)) warnings.push('部分公式已降級為可讀文字，請在匯出前確認原意');
    return { ok: !errors.length, errors, warnings, mathCount: ranges.length };
  }

  function format(raw) {
    const original = String(raw || '');
    let text = normalizeDelimiters(original).replace(/[ \t]+\n/g, '\n').trim();
    if (global.LatexSanitize?.sanitizeText) text = global.LatexSanitize.sanitizeText(text, { validate });
    const report = check(text);
    return { text, report, changed: text !== original.trim() };
  }

  function cleanString(value, label, errors, max = 900) {
    const text = String(value == null ? '' : value).trim();
    if (!text) errors.push(`${label} 不可空白`);
    else if (text.length > max) errors.push(`${label} 過長`);
    else if (FORBIDDEN_TEXT_RE.test(text)) errors.push(`${label} 不可含 HTML、URL 或指令`);
    return text;
  }

  function cleanLatex(value, label, errors, display) {
    const latex = String(value == null ? '' : value).trim();
    if (!latex) { errors.push(`${label} 不可空白`); return latex; }
    if (latex.length > 1800 || FORBIDDEN_LATEX_RE.test(latex)) { errors.push(`${label} 含不允許的 LaTeX／HTML`); return latex; }
    try { validate(latex, display); } catch (err) { errors.push(`${label} 無法由 KaTeX 渲染：${String(err.message || err).slice(0, 90)}`); }
    return latex;
  }

  function validateSegments(parts, label, errors, noteSink) {
    if (!Array.isArray(parts) || !parts.length) { errors.push(`${label} 須有 content`); return []; }
    if (parts.length > 32) errors.push(`${label} content 過多`);
    const result = [];
    parts.forEach((part, index) => {
      if (!part || typeof part !== 'object') { errors.push(`${label}.content[${index}] 格式錯誤`); return; }
      const type = String(part.type || 'text');
      if (type === 'text') result.push({ type, text: cleanString(part.text, `${label}.content[${index}].text`, errors) });
      else if (type === 'inline_note') {
        const text = cleanString(part.text, `${label}.content[${index}].text`, errors, 160);
        const note = cleanString(part.note, `${label}.content[${index}].note`, errors, 220);
        const kind = String(part.kind || 'concept');
        if (!NOTE_KINDS.has(kind)) errors.push(`${label}.content[${index}].kind 不合法`);
        if (VAGUE_NOTE_RE.test(note)) errors.push(`${label}.content[${index}].note 太泛`);
        result.push({ type, text, note, kind }); noteSink.push({ text, note, kind, label });
      } else errors.push(`${label}.content[${index}] type 不合法`);
    });
    return result;
  }

  function validateMathNotes(notes, latex, label, errors, noteSink) {
    if (notes == null) return [];
    if (!Array.isArray(notes)) { errors.push(`${label}.notes 須為陣列`); return []; }
    const found = [];
    notes.forEach((entry, index) => {
      const anchor = cleanString(entry?.anchor, `${label}.notes[${index}].anchor`, errors, 80);
      const note = cleanString(entry?.note, `${label}.notes[${index}].note`, errors, 220);
      const kind = String(entry?.kind || 'quantity');
      if (!NOTE_KINDS.has(kind)) errors.push(`${label}.notes[${index}].kind 不合法`);
      if (/[{}\\]/.test(note) || VAGUE_NOTE_RE.test(note)) errors.push(`${label}.notes[${index}].note 不可含 LaTeX／空泛字詞`);
      const count = anchor ? latex.split(anchor).length - 1 : 0;
      if (anchor && count !== 1) errors.push(`${label}.notes[${index}].anchor 必須在公式中剛好出現一次`);
      found.push({ anchor, note, kind }); noteSink.push({ text: anchor, note, kind, label });
    });
    return found;
  }

  function numberValue(value) {
    const text = String(value ?? '').trim();
    return /^[-+]?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
  }

  function verifyArithmetic(verification, label, errors) {
    if (!verification || typeof verification !== 'object') { errors.push(`${label}.verification 缺少可重算的關鍵數值`); return; }
    const expression = String(verification.expression || '').trim().replace(/\^/g, '**');
    const expected = Number(verification.expected);
    const tolerance = verification.tolerance == null ? 1e-8 : Number(verification.tolerance);
    if (!expression || expression.length > 160 || !/^[\d\s.+*/()\-Ee*]+$/.test(expression) || !Number.isFinite(expected) || !Number.isFinite(tolerance) || tolerance < 0) {
      errors.push(`${label}.verification 格式不合法`); return;
    }
    let actual;
    try { actual = Function(`"use strict"; return (${expression});`)(); } catch (_) { errors.push(`${label}.verification 算式無法重算`); return; }
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > Math.max(tolerance, Math.abs(expected) * tolerance)) errors.push(`${label}.verification 重算結果不一致`);
  }

  function validateTable(block, label, errors, noteSink) {
    const mode = String(block.mode || '');
    const expected = mode === 'initial_change_final'
      ? ['initial', 'change', 'final']
      : mode === 'initial_complete_reverse_equilibrium'
        ? ['initial', 'complete_right', 'reverse_left', 'equilibrium'] : null;
    if (!expected) { errors.push(`${label}.mode 不合法`); return; }
    const reaction = block.reaction || {};
    cleanLatex(reaction.latex, `${label}.reaction.latex`, errors, true);
    if (reaction.plain && global.KnowledgeTools?.checkReaction) {
      const checked = global.KnowledgeTools.checkReaction(reaction.plain);
      if (!checked.ok) errors.push(`${label}.reaction 元素未守恆：${(checked.difference || []).join('、') || checked.error}`);
    }
    if (!Array.isArray(block.species) || block.species.length < 2 || block.species.length > 8) errors.push(`${label}.species 須為 2～8 個物種`);
    const species = Array.isArray(block.species) ? block.species : [];
    species.forEach((item, i) => {
      cleanLatex(item?.latex, `${label}.species[${i}].latex`, errors, false);
      if (!Number.isFinite(Number(item?.coefficient)) || Number(item.coefficient) <= 0) errors.push(`${label}.species[${i}].coefficient 須為正數`);
      if (!/^(reactant|product)$/.test(String(item?.role || ''))) errors.push(`${label}.species[${i}].role 須為 reactant 或 product`);
    });
    cleanString(block.quantity, `${label}.quantity`, errors, 40); cleanString(block.unit, `${label}.unit`, errors, 32);
    if (!Array.isArray(block.rows) || block.rows.length !== expected.length) errors.push(`${label}.rows 須依模式包含 ${expected.join('、')}`);
    const rows = Array.isArray(block.rows) ? block.rows : [];
    rows.forEach((row, i) => {
      if (String(row?.state || '') !== expected[i]) errors.push(`${label}.rows[${i}].state 應為 ${expected[i]}`);
      if (!Array.isArray(row?.values) || row.values.length !== species.length) errors.push(`${label}.rows[${i}].values 欄數須等於物種數`);
      (row?.values || []).forEach((cell, j) => cleanLatex(cell, `${label}.rows[${i}].values[${j}]`, errors, false));
    });
    const checkStoichDelta = (deltas, reverse, phase) => {
      const ratios = [];
      deltas.forEach((value, j) => {
        const n = numberValue(value); const speciesItem = species[j];
        if (n == null || !speciesItem || !Number.isFinite(Number(speciesItem.coefficient))) return;
        const direction = String(speciesItem.role) === 'reactant' ? -1 : 1;
        ratios.push(n / (Number(speciesItem.coefficient) * direction * (reverse ? -1 : 1)));
      });
      if (ratios.length > 1 && ratios.some(ratio => Math.abs(ratio - ratios[0]) > 1e-8)) errors.push(`${label} ${phase}不符合化學係數比例`);
    };
    if (rows.length === expected.length && species.length) {
      if (mode === 'initial_change_final') species.forEach((_, j) => {
        const x = numberValue(rows[0]?.values?.[j]); const y = numberValue(rows[1]?.values?.[j]); const z = numberValue(rows[2]?.values?.[j]);
        if (x != null && y != null && z != null && Math.abs((x + y) - z) > 1e-8) errors.push(`${label} 第 ${j + 1} 欄數值不符合 起始 + 變化 = 結果`);
        if (z != null && z < 0) errors.push(`${label} 第 ${j + 1} 欄出現負的最終量`);
      });
      if (mode === 'initial_change_final') checkStoichDelta(rows[1]?.values || [], false, '變化列');
      else species.forEach((_, j) => {
        const initial = numberValue(rows[0]?.values?.[j]); const complete = numberValue(rows[1]?.values?.[j]);
        const reverse = numberValue(rows[2]?.values?.[j]); const equilibrium = numberValue(rows[3]?.values?.[j]);
        if (complete != null && complete < 0) errors.push(`${label} 第 ${j + 1} 欄完全向右後出現負量`);
        if (complete != null && reverse != null && equilibrium != null && Math.abs((complete + reverse) - equilibrium) > 1e-8) errors.push(`${label} 第 ${j + 1} 欄數值不符合 完全向右 + 再向左 = 平衡`);
        if (equilibrium != null && equilibrium < 0) errors.push(`${label} 第 ${j + 1} 欄出現負的平衡量`);
        if (initial != null && complete != null && Math.abs(initial - complete) < 1e-12 && reverse != null && Math.abs(reverse) > 1e-12) errors.push(`${label} 第 ${j + 1} 欄未呈現第一段完全反應變化`);
      });
      if (mode === 'initial_complete_reverse_equilibrium') {
        const firstDelta = species.map((_, j) => {
          const a = numberValue(rows[0]?.values?.[j]); const b = numberValue(rows[1]?.values?.[j]);
          return a == null || b == null ? '' : String(b - a);
        });
        checkStoichDelta(firstDelta, false, '完全向右');
        checkStoichDelta(rows[2]?.values || [], true, '再向左');
      }
    }
    validateMathNotes(block.notes, `${reaction.latex || ''} ${(rows || []).flatMap(r => r.values || []).join(' ')}`, label, errors, noteSink);
  }

  function checkNotes(doc, collected) {
    const coverage = []; const quality = []; const anchors = [];
    const seen = new Set();
    collected.forEach(item => {
      const key = `${item.text}|${item.note}`;
      if (seen.has(key)) quality.push(`重複 NOTE：${item.text}`); else seen.add(key);
      if (item.text.length > 80) anchors.push(`NOTE 錨點過長：${item.text.slice(0, 24)}`);
    });
    const choices = (doc.blocks || []).filter(b => b.type === 'choice_analysis');
    choices.forEach((block, i) => {
      const count = (block.items || []).filter(item => (item.content || []).some(p => p.type === 'inline_note')).length;
      if (count < Math.min(2, (block.items || []).length)) coverage.push(`選項分析 ${i + 1} 缺少至少兩個判斷依據 NOTE`);
    });
    (doc.blocks || []).forEach((block, i) => {
      if (block.type === 'calculation' && (block.notes || []).length < 2) coverage.push(`計算段 ${i + 1} 缺少關鍵量／換算 NOTE`);
      if (block.type === 'stoichiometry_table' && (block.notes || []).length < 3) coverage.push(`反應表 ${i + 1} 缺少起始、變化與表格意義 NOTE`);
    });
    return { ok: !coverage.length && !quality.length && !anchors.length, coverage, quality, anchor: anchors, ui: [] };
  }

  function validateDocument(doc, options) {
    const errors = []; const collected = [];
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['SolutionDocument 必須為物件'], diagnostics: {} };
    if (Number(doc.version) !== VERSION) errors.push(`version 須為 ${VERSION}`);
    if (!Array.isArray(doc.blocks) || !doc.blocks.length) errors.push('blocks 須為非空陣列');
    if (Array.isArray(doc.blocks) && doc.blocks.length > 48) errors.push('blocks 過多');
    let hasAnswer = false;
    (doc.blocks || []).forEach((block, index) => {
      const label = `blocks[${index}]`; const type = String(block?.type || '');
      if (!BLOCK_TYPES.has(type)) { errors.push(`${label}.type 不合法`); return; }
      if (type === 'section') cleanString(block.title, `${label}.title`, errors, 120);
      if (type === 'paragraph') validateSegments(block.content, label, errors, collected);
      if (type === 'choice_analysis') {
        if (!Array.isArray(block.items) || !block.items.length || block.items.length > 5) errors.push(`${label}.items 須為 1～5 個選項`);
        (block.items || []).forEach((item, i) => {
          if (!/^[A-E]$/.test(String(item?.letter || '').toUpperCase())) errors.push(`${label}.items[${i}].letter 須為 A～E`);
          validateSegments(item?.content, `${label}.items[${i}]`, errors, collected);
          if (item?.verdict != null) cleanString(item.verdict, `${label}.items[${i}].verdict`, errors, 80);
        });
      }
      if (type === 'math' || type === 'chemical_equation' || type === 'calculation') {
        const latex = cleanLatex(block.latex, `${label}.latex`, errors, !!block.display || type !== 'math');
        if (block.explanation != null) cleanString(block.explanation, `${label}.explanation`, errors, 240);
        validateMathNotes(block.notes, latex, label, errors, collected);
        if (type === 'calculation' && /\d/.test(latex)) verifyArithmetic(block.verification, label, errors);
      }
      if (type === 'stoichiometry_table') validateTable(block, label, errors, collected);
      if (type === 'answer') { hasAnswer = true; validateSegments(block.content, label, errors, collected); if (block.unit != null) cleanString(block.unit, `${label}.unit`, errors, 32); }
    });
    if (!hasAnswer) errors.push('必須有一個 answer block');
    const noteReport = checkNotes(doc, collected);
    if (options?.noteGate !== false && !noteReport.ok) errors.push(...noteReport.coverage, ...noteReport.quality, ...noteReport.anchor);
    return { ok: !errors.length, errors, diagnostics: noteReport, noteCount: collected.length };
  }

  function noteAttr(note) { return String(note || '').replace(/[{}\\]/g, '').replace(/[\r\n]+/g, ' ').trim(); }
  function compileMath(latex, notes, display) {
    let result = String(latex || '');
    (notes || []).forEach(entry => { if (entry?.anchor) result = result.replace(entry.anchor, `\\htmlData{note=${noteAttr(entry.note)}}{${entry.anchor}}`); });
    return display ? `$$${result}$$` : `$${result}$`;
  }

  function compileDocument(doc) {
    const validation = validateDocument(doc); if (!validation.ok) return { ok: false, validation, text: '', notes: [] };
    const notes = []; let sequence = 0;
    const segments = (parts) => (parts || []).map(part => {
      if (part.type !== 'inline_note') return String(part.text || '');
      const id = `SDN${sequence++}`; notes.push({ id, note: part.note, kind: part.kind });
      return `[[${id}]]${part.text}[[/${id}]]`;
    }).join('');
    const lines = []; let answer = '—';
    (doc.blocks || []).forEach(block => {
      if (block.type === 'section') lines.push(`【${block.title}】`);
      else if (block.type === 'paragraph') lines.push(segments(block.content));
      else if (block.type === 'choice_analysis') (block.items || []).forEach(item => lines.push(`(${String(item.letter).toUpperCase()}) ${segments(item.content)}${item.verdict ? `；${item.verdict}` : ''}`));
      else if (block.type === 'math') lines.push(compileMath(block.latex, block.notes, !!block.display));
      else if (block.type === 'chemical_equation') lines.push(compileMath(block.latex, block.notes, true));
      else if (block.type === 'calculation') { if (block.explanation) lines.push(block.explanation); lines.push(compileMath(block.latex, block.notes, false)); }
      else if (block.type === 'stoichiometry_table') {
        const tableNotes = block.notes || [];
        const reactionNotes = tableNotes.filter(note => String(block.reaction?.latex || '').includes(note.anchor));
        const headers = (block.species || []).map(s => s.latex); let tableRows = (block.rows || []).map(row => {
          const state = { initial: '起始', change: '變化', final: '結果', complete_right: '完全向右', reverse_left: '再向左', equilibrium: '平衡' }[row.state] || row.state;
          return `\\text{${state}} & ${(row.values || []).join(' & ')}`;
        });
        let tableText = tableRows.join(' \\\\ ');
        tableNotes.filter(note => !reactionNotes.includes(note)).forEach(note => {
          tableText = tableText.replace(note.anchor, `\\htmlData{note=${noteAttr(note.note)}}{${note.anchor}}`);
        });
        lines.push(compileMath(block.reaction.latex, reactionNotes, true));
        lines.push(`$$\\begin{array}{l${'c'.repeat(headers.length)}}\\text{${block.quantity}（${block.unit}）} & ${headers.join(' & ')} \\\\ \\hline ${tableText}\\end{array}$$`);
      } else if (block.type === 'answer') answer = `${segments(block.content)}${block.unit ? ` ${block.unit}` : ''}`.trim();
    });
    return { ok: true, validation, text: `${lines.filter(Boolean).join('\n')}\n@@ANSWER@@${answer}`, notes };
  }

  function applyInlineNotes(root, registry) {
    if (!root || !registry?.length || typeof document === 'undefined') return 0;
    const byId = new Map(registry.map(n => [n.id, n])); let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = []; let node;
    while ((node = walker.nextNode())) if (/\[\[SDN\d+\]\]/.test(node.nodeValue || '')) targets.push(node);
    targets.forEach(textNode => {
      const text = textNode.nodeValue || ''; const re = /\[\[(SDN\d+)\]\]([\s\S]*?)\[\[\/\1\]\]/g;
      let cursor = 0; let match; const fragment = document.createDocumentFragment();
      while ((match = re.exec(text))) {
        fragment.append(document.createTextNode(text.slice(cursor, match.index)));
        const item = byId.get(match[1]); const anchor = document.createElement('span');
        anchor.className = `math-note solution-note solution-note--${item?.kind || 'concept'}`;
        anchor.tabIndex = 0; anchor.setAttribute('role', 'button'); anchor.setAttribute('data-note', item?.note || ''); anchor.textContent = match[2];
        fragment.append(anchor); cursor = re.lastIndex; count++;
      }
      if (cursor) { fragment.append(document.createTextNode(text.slice(cursor))); textNode.replaceWith(fragment); }
    });
    return count;
  }

  function toPlainPreview(text) { return String(text || '').replace(/\n{3,}/g, '\n\n'); }
  function repairInstruction(diagnostics) {
    const bits = [...(diagnostics?.coverage || []), ...(diagnostics?.quality || []), ...(diagnostics?.anchor || [])];
    return `只修正 SolutionDocument 的 NOTE 欄位；不可改變答案、選項判斷、公式或其他 block。待補項目：${bits.join('；')}`;
  }

  const api = { VERSION, SCHEMA, validate: validateDocument, compile: compileDocument, applyInlineNotes, checkNotes, repairInstruction, isDocument: value => !!value && typeof value === 'object' && Number(value.version) === VERSION && Array.isArray(value.blocks) };
  global.SolutionDocument = api;
  global.SolutionFormat = { format, check, normalizeDelimiters, toPlainPreview };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
