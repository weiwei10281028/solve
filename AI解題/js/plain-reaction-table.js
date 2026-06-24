/**
 * plain 模式：反應變化表、算式後單位不拆行。
 */

/** 高中化學常見單位（算式結果後方） */
const CHEM_UNIT_SYM = String.raw`(?:g(?:\/mol|\/L)?|mg|kg|μg|ug|ng|mol(?:\/L)?|mmol|μmol|umol|L|mL|cL|dL|cm\^?3|dm\^?3|M(?![a-zA-Z\\])|atm|Pa|kPa|MPa|torr|mmHg|bar|K|°C|℃|kJ(?:\/mol)?|J(?:\/mol)?|cal|kcal|V|A|C(?![a-zA-Z\\])|Ω|s|ms|min|h|％|%)`;
const CHEM_UNIT_COMPOUND = String.raw`(?:g\/mol|mol\/L|g\/L|kJ\/mol|J\/mol|L\s*atm|mol\s*K)`;
const CHEM_UNIT_ANY = `(?:${CHEM_UNIT_COMPOUND}|${CHEM_UNIT_SYM})`;

function chemUnitTailRegex() {
  return new RegExp(
    `^(\\s*(?:\\d+\\.?\\d*\\s*)?(?:${CHEM_UNIT_ANY})(?:[。．.,，])?(?:\\s*（[^）]{0,28}）)?)`,
    'i'
  );
}

function isOrphanUnitLine(text) {
  const s = String(text || '').trim();
  if (!s || s.length > 32) return false;
  if (/^[（(][A-Ea-e][)）]/.test(s)) return false;
  if (/[\u4e00-\u9fff]/.test(s.replace(/（[^）]*）/g, ''))) return false;
  return new RegExp(
    `^(?:\\d+\\.?\\d*\\s*)?(?:${CHEM_UNIT_ANY})(?:[。．.,，])?(?:\\s*（[^）]*）)?$`,
    'i'
  ).test(s);
}

/** 單位／句點被 AI 另起一行時，併回上一行 */
function mergeOrphanUnitLines(raw) {
  const lines = String(raw || '').split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    if (out.length && isOrphanUnitLine(t)) {
      out[out.length - 1] = `${out[out.length - 1].replace(/\s*$/, '')}${t}`;
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

function bindUnitAfterEl(el) {
  const next = el.nextSibling;
  if (next?.nodeType !== Node.TEXT_NODE) return;
  const m = next.textContent.match(chemUnitTailRegex());
  if (!m) return;
  const span = document.createElement('span');
  span.className = 'math-unit-tail';
  el.parentNode.insertBefore(span, el);
  span.appendChild(el);
  span.appendChild(document.createTextNode(m[1]));
  next.textContent = next.textContent.slice(m[1].length);
}

function splitArrayBodyRows(body) {
  const rows = [];
  let cur = '';
  let depth = 0;
  let i = 0;
  const s = String(body || '');
  while (i < s.length) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === '\\' && s[i + 1] === '\\' && depth === 0) {
      rows.push(cur);
      cur = '';
      i += 2;
      while (i < s.length && /\s/.test(s[i])) i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim()) rows.push(cur);
  return rows;
}

/** 將 \\hline 與同一列的資料拆開 */
function normalizeArrayRows(rows) {
  const out = [];
  for (const raw of rows) {
    let row = String(raw || '').trim();
    if (!row) continue;
    if (/^\\hline\b/.test(row)) {
      const rest = row.replace(/^\\hline\s*/, '').trim();
      out.push('\\hline');
      if (rest) out.push(rest);
      continue;
    }
    out.push(row);
  }
  return out;
}

function splitArrayRowCells(row) {
  const cells = [];
  let cur = '';
  let depth = 0;
  const s = String(row || '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === '&' && depth === 0) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function escCellTex(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function alignFromSpec(spec, colIndex) {
  const ch = String(spec || 'c')[colIndex] || 'c';
  if (ch === 'l') return 'l';
  if (ch === 'r') return 'r';
  return 'c';
}

/** 箭頭、加號等運算符欄 — 縮小左右留白 */
function isOperatorCell(tex) {
  const t = String(tex || '').trim();
  if (!t) return true;
  return /^\\(?:rightleftharpoons|leftrightarrow|rightarrow|leftarrow|to|pm|mp|times)\b$/.test(t)
    || /^[+\-=⇌→↔]$/.test(t);
}

/** 將 $$...array...$$ 拆成欄位網格 HTML；失敗則回傳 null */
function splitPlainReactionArray(tex) {
  let t = String(tex || '').trim();
  if (t.startsWith('$$') && t.endsWith('$$')) {
    t = t.slice(2, -2).trim();
  } else if (t.startsWith('$') && t.endsWith('$')) {
    t = t.slice(1, -1).trim();
  } else {
    return null;
  }

  t = t
    .replace(/\\displaystyle\s*/g, '')
    .replace(/\\renewcommand\{[^}]*\}\{[^}]*\}/g, '')
    .replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, '');

  const arr = t.match(/\\begin\{array\}\{([^}]*)\}([\s\S]*?)\\end\{array\}/);
  if (!arr) return null;

  const alignSpec = String(arr[1] || '').replace(/\|/g, '') || 'ccccc';
  const rows = normalizeArrayRows(
    splitArrayBodyRows(arr[2]).map(r => r.trim()).filter(Boolean)
  );
  if (rows.length < 3) return null;

  const dataRows = rows.filter(r => r !== '\\hline' && !/^\\hline\s*$/.test(r));
  if (dataRows.length < 3) return null;

  const parsedRows = [];
  let maxCols = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row === '\\hline' || /^\\hline\s*$/.test(row)) {
      parsedRows.push({ type: 'hline' });
      continue;
    }
    const cells = splitArrayRowCells(row);
    maxCols = Math.max(maxCols, cells.length);
    const next = rows[i + 1];
    const nextIsHline = next === '\\hline' || /^\\hline\s*$/.test(next || '');
    parsedRows.push({ type: 'data', cells, preHline: nextIsHline });
  }
  if (maxCols < 2) return null;

  const parts = [
    '<div class="reaction-table-stacked">',
    `<div class="reaction-table-grid" style="--rt-cols:${maxCols}">`
  ];

  for (const item of parsedRows) {
    if (item.type === 'hline') {
      parts.push('<div class="reaction-table-hline" aria-hidden="true"></div>');
      continue;
    }
    const cells = [...item.cells];
    while (cells.length < maxCols) cells.push('');
    cells.forEach((cell, ci) => {
      const align = alignFromSpec(alignSpec, ci);
      const op = isOperatorCell(cell);
      const cls = [
        'reaction-table-cell',
        `reaction-table-cell--${align}`,
        op ? 'reaction-table-cell--op' : '',
        item.preHline ? 'reaction-table-cell--pre-hline' : '',
        cell ? '' : 'reaction-table-cell--empty'
      ].filter(Boolean).join(' ');
      const inner = cell ? `$${cell}$` : '';
      parts.push(
        `<div class="${cls}" data-col="${ci + 1}" data-align="${align}">${escCellTex(inner)}</div>`
      );
    });
  }

  parts.push('</div></div>');
  return parts.join('');
}

function adjustPlainReactionTables(root) {
  if (!root) return;
  root.querySelectorAll('.ai-plain .katex-display').forEach(display => {
    if (display.closest('.reaction-table-stacked')) return;
    if (!display.querySelector('.array')) return;
    display.classList.add('reaction-table-fallback');
  });
}

/** KaTeX 後：所有算式結果與後接單位不拆行 */
function keepMathUnitTails(root) {
  if (!root) return;
  root.querySelectorAll('.ai-plain .plain-line-inner, .ai-plain .choice-body').forEach(inner => {
    inner.querySelectorAll(':scope > .math-block').forEach(bindUnitAfterEl);
    inner.querySelectorAll(':scope > .katex').forEach(katex => {
      if (katex.closest('.reaction-table-stacked')) return;
      bindUnitAfterEl(katex);
    });
  });
}

/** KaTeX 後清除行尾殘留 $ 文字 */
function stripStrayDollarsInPlain(root) {
  if (!root) return;
  root.querySelectorAll('.plain-line-inner, .choice-body').forEach(inner => {
    inner.childNodes.forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      let t = node.textContent || '';
      const orig = t;
      while (/\$(\s*)$/.test(t)) t = t.replace(/\$(\s*)$/, '$1');
      if (t !== orig) node.textContent = t;
    });
  });
}
