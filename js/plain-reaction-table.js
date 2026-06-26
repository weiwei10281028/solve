/**
 * plain 模式：反應變化表、算式後單位不拆行。
 */

/** 高中化學常見單位（算式結果後方） */
const CHEM_UNIT_SYM = String.raw`(?:g(?:\/mol|\/L)?|mg|kg|μg|ug|ng|mol(?:\/L)?|mmol|μmol|umol|L|mL|cL|dL|cm\^?3|dm\^?3|M(?![a-zA-Z\\])|atm|Pa|kPa|MPa|torr|mmHg|bar|K|°C|℃|kJ(?:\/mol)?|J(?:\/mol)?|cal|kcal|V|A|C(?![a-zA-Z\\])|Ω|s|ms|min|h|％|%)`;
const CHEM_UNIT_COMPOUND = String.raw`(?:M\s*s\s*(?:\^?\{?\s*[-−]1\s*\}?|[-−]1)?|g\/mol|mol\/L|g\/L|kJ\/mol|J\/mol|L\s*atm|mol\s*K)`;
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
  const mathUnwrapped = s.replace(/^\s*\$+\s*/, '').replace(/\s*\$+\s*([。．.,，]?)\s*$/, '$1');
  return new RegExp(
    `^(?:\\d+\\.?\\d*\\s*)?(?:${CHEM_UNIT_ANY})(?:[。．.,，])?(?:\\s*（[^）]*）)?$`,
    'i'
  ).test(mathUnwrapped);
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
      const unitText = t.replace(/^\s*\$+\s*/, '').replace(/\s*\$+\s*([。．.,，]?)\s*$/, '$1');
      if (/^M\s*s\s*(?:\^?\{?\s*[-−]1\s*\}?|[-−]1)?[。．.,，]?\s*$/i.test(unitText) && /\$\s*$/.test(out[out.length - 1])) {
        const punct = (unitText.match(/[。．.,，]\s*$/) || [''])[0].trim();
        out[out.length - 1] = out[out.length - 1].replace(/\$\s*$/, () => `\\,\\mathrm{M\\,s^{-1}}$${punct}`);
      } else {
        out[out.length - 1] = `${out[out.length - 1].replace(/\s*$/, '')}${t}`;
      }
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

/** 合併相鄰 $…$ 片段（例：$…=$ $…$、$結果$ $M s^{-1}$） */
function mergeAdjacentInlineMath(raw) {
  let s = String(raw || '');
  for (let pass = 0; pass < 6; pass++) {
    const prev = s;
    s = s.replace(/\$([^$\n]+?)\$\s*\$([^$\n]+?)\$/g, (m, a, b) => {
      const aTrim = a.trim();
      const bTrim = b.trim();
      if (/^\\(?:mathrm|text)\{[^}]*M[^}]*s/i.test(bTrim) || /^M\\,s\^\{-1\}$/i.test(bTrim.replace(/\s/g, ''))) {
        return `$${aTrim}\\,${bTrim}$`;
      }
      if (/^[=＝≈]/.test(bTrim)) return `$${aTrim}${bTrim}$`;
      if (/^\\(?:dfrac|frac|tfrac)/.test(bTrim) || /^\d/.test(bTrim)) return `$${aTrim}${bTrim}$`;
      return m;
    });
    if (s === prev) break;
  }
  return s;
}

/** 換行被拆開的短算式（例：上一行結尾「取」、下一行 $…$倍） */
function mergeOrphanMathContinuationLines(raw) {
  const lines = String(raw || '').split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    if (out.length) {
      const prevTrim = out[out.length - 1].trim();
      const mathStart = /^\$[^$\n]+\$/.test(t) || /^\$[^$\n]+\$[^$\n]{0,8}$/.test(t);
      const prevNeedsMath = /(?:取|為|得|即|乘|除)\s*$/.test(prevTrim) || /[，：:]\s*$/.test(prevTrim);
      if (/\\begin\{cases\}|^\$\$/.test(t)) {
        out.push(line);
        continue;
      }
      if (mathStart && prevNeedsMath && !/\$\s*$/.test(prevTrim)) {
        out[out.length - 1] = `${out[out.length - 1].replace(/\s*$/, '')}${t}`;
        continue;
      }
      if (/^[^\s$]{0,12}\$[^$\n]+\$[^\s$]{0,8}$/.test(t) && /(?:取|為|得|即)\s*$/.test(prevTrim)) {
        out[out.length - 1] = `${out[out.length - 1].replace(/\s*$/, '')}${t}`;
        continue;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function isKatexUnitOnly(katex) {
  if (!katex?.classList?.contains('katex')) return false;
  const flat = (katex.textContent || '').replace(/\s/g, '').replace(/[。．.,，]/g, '');
  if (/^Ms?[−\-]?1$/i.test(flat)) return true;
  if (/^M/i.test(flat) && /s/i.test(flat) && /-?1/.test(flat)) return true;
  return /\\mathrm\{M/i.test(katex.innerHTML || '') && /s/i.test(flat) && /-?1|\^-?\{?-?1/.test(katex.innerHTML || '');
}

/** KaTeX 後：相鄰 .katex（結果 + 單位）併成 .math-unit-tail */
function bindAdjacentKatexUnits(root) {
  if (!root) return;
  let changed = true;
  while (changed) {
    changed = false;
    root.querySelectorAll('.ai-plain .plain-line-inner, .ai-plain .choice-step .plain-line-inner, .ai-plain .choice-body').forEach(inner => {
      let node = inner.firstChild;
      while (node) {
        const next = node.nextSibling;
        if (node.nodeType !== Node.ELEMENT_NODE || !node.classList?.contains('katex')) {
          node = next;
          continue;
        }
        if (node.closest('.math-unit-tail, .plain-katex-nowrap')) {
          node = next;
          continue;
        }
        let sibling = next;
        while (sibling?.nodeType === Node.TEXT_NODE && /^\s*$/.test(sibling.textContent || '')) {
          sibling = sibling.nextSibling;
        }
        if (sibling?.nodeType === Node.ELEMENT_NODE && sibling.classList?.contains('katex') && !sibling.closest('.math-unit-tail')) {
          const curHasEq = /[=＝]/.test(node.textContent || '');
          const sibUnitOnly = isKatexUnitOnly(sibling);
          if (sibUnitOnly || (curHasEq && !isKatexUnitOnly(node))) {
            const wrap = document.createElement('span');
            wrap.className = 'math-unit-tail';
            inner.insertBefore(wrap, node);
            wrap.appendChild(node);
            let after = wrap.nextSibling;
            while (after?.nodeType === Node.TEXT_NODE && /^\s*$/.test(after.textContent || '')) {
              wrap.appendChild(after);
              after = wrap.nextSibling;
            }
            if (after?.nodeType === Node.ELEMENT_NODE && after.classList?.contains('katex')) {
              wrap.appendChild(after);
              changed = true;
              return;
            }
          }
        }
        node = next;
      }
    });
  }
}

/** KaTeX 後：短中文 + 算式 + 短中文整段不拆行（例：取 10/1000=0.01 倍） */
function wrapMathAdjacentClusters(root) {
  if (!root) return;
  root.querySelectorAll('.ai-plain .plain-line-inner, .ai-plain .choice-step .plain-line-inner, .ai-plain .choice-body').forEach(inner => {
    if (!inner.querySelector('.katex')) return;
    let node = inner.firstChild;
    while (node) {
      if (node.nodeType !== Node.ELEMENT_NODE || !node.classList?.contains('katex') || node.closest('.plain-katex-nowrap, .math-unit-tail')) {
        node = node.nextSibling;
        continue;
      }
      let start = node;
      let end = node;
      const prev = start.previousSibling;
      if (prev?.nodeType === Node.TEXT_NODE) {
        const pt = prev.textContent || '';
        if (pt.length > 0 && pt.length <= 10 && !/[。；！？\n]/.test(pt)) start = prev;
      }
      let n = end.nextSibling;
      if (n?.nodeType === Node.TEXT_NODE) {
        const nt = n.textContent || '';
        if (nt.length > 0 && nt.length <= 12 && !/[。；！？\n]/.test(nt)) end = n;
      }
      n = end.nextSibling;
      while (n?.nodeType === Node.ELEMENT_NODE && (
        n.classList.contains('katex')
        || n.classList.contains('math-unit-tail')
        || n.classList.contains('plain-katex-nowrap')
      )) {
        end = n;
        n = end.nextSibling;
        if (n?.nodeType === Node.TEXT_NODE) {
          const nt = n.textContent || '';
          if (nt.length > 0 && nt.length <= 12 && !/[。；！？\n]/.test(nt)) {
            end = n;
            n = end.nextSibling;
          } else {
            break;
          }
        }
      }
      if (start !== node || end !== node) {
        const wrap = document.createElement('span');
        wrap.className = 'plain-katex-nowrap';
        inner.insertBefore(wrap, start);
        let cur = start;
        while (cur) {
          const nxt = cur === end ? null : cur.nextSibling;
          wrap.appendChild(cur);
          if (cur === end) break;
          cur = nxt;
        }
        node = wrap.nextSibling;
        continue;
      }
      node = node.nextSibling;
    }
  });
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

/** KaTeX 後：最後一個「=」後的結果與單位整段不換行（僅最外層 base） */
function bindEquationResultTail(base) {
  const nodes = [...base.children];
  let lastEq = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].classList?.contains('mrel') && /[=＝]/.test(nodes[i].textContent || '')) {
      lastEq = i;
    }
  }
  if (lastEq < 0 || lastEq >= nodes.length - 1) return;
  if (nodes[lastEq + 1]?.closest?.('.math-unit-tail')) return;
  const tailText = nodes.slice(lastEq + 1).map(n => n.textContent || '').join('');
  if (!/[\d.Ms^−\-]/.test(tailText)) return;
  const wrap = document.createElement('span');
  wrap.className = 'math-unit-tail';
  base.insertBefore(wrap, nodes[lastEq + 1]);
  while (lastEq + 1 < base.children.length) {
    wrap.appendChild(base.children[lastEq + 1]);
  }
}

/** 整段 KaTeX 不換行（避免 M s⁻¹ 的 -1 被斷到下一行） */
function wrapKatexNowrap(root) {
  if (!root) return;
  root.querySelectorAll('.ai-plain .plain-line-inner, .ai-plain .choice-step .plain-line-inner, .ai-plain .choice-body').forEach(inner => {
    inner.querySelectorAll('.katex').forEach(katex => {
      if (katex.parentElement?.classList.contains('plain-katex-nowrap')) return;
      const flat = (katex.textContent || '').replace(/\s/g, '');
      const needs = katex.querySelector('.mfrac')
        || (/=/.test(katex.textContent || '') && /Δ|0\.\d|\d+\/\d/.test(flat))
        || /Ms?[−-]?1|M.*s[−-]?1/i.test(flat)
        || /\\mathrm\{M/.test(katex.innerHTML || '');
      if (!needs) return;
      const wrap = document.createElement('span');
      wrap.className = 'plain-katex-nowrap';
      katex.parentNode.insertBefore(wrap, katex);
      wrap.appendChild(katex);
    });
  });
}

/** KaTeX 後：算式結果與 M s⁻¹ 等單位不拆行 */
function bindKatexNumericUnits(root) {
  if (!root) return;
  root.querySelectorAll('.ai-plain .katex, .board .katex, .board-reply .katex').forEach(katex => {
    if (katex.closest('.math-unit-tail')) return;
    const outerBases = katex.querySelectorAll(':scope > .katex-html > .base');
    const bases = outerBases.length
      ? [...outerBases]
      : [katex.querySelector('.base')].filter(Boolean);
    bases.forEach(base => {
      bindEquationResultTail(base);
      const nodes = [...base.children];
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const compact = (n.textContent || '').replace(/\s/g, '');
        const isMsUnit = (n.classList?.contains('mathrm') || n.classList?.contains('mord'))
          && /Ms?[−-]?1|M.*s[−-]?1/i.test(compact);
        if (!isMsUnit) continue;

        let numIdx = i - 1;
        while (numIdx >= 0 && nodes[numIdx].classList?.contains('mrel')) numIdx--;
        if (numIdx < 0 || !/^\d/.test((nodes[numIdx].textContent || '').trim())) continue;

        const wrap = document.createElement('span');
        wrap.className = 'math-unit-tail';
        base.insertBefore(wrap, nodes[numIdx]);
        wrap.appendChild(nodes[numIdx]);
        wrap.appendChild(n);
        break;
      }

      const refreshed = [...base.children];
      for (let i = refreshed.length - 1; i >= 2; i--) {
        const sup = refreshed[i];
        if (!sup.classList?.contains('msupsub')) continue;
        const exp = sup.textContent.trim().replace(/−/g, '-');
        if (!/^-?1$/.test(exp)) continue;
        let start = i;
        if (refreshed[start - 1]?.textContent.trim() === 's') start -= 1;
        if (refreshed[start - 1]?.textContent.trim() === 'M') start -= 1;
        let numIdx = start - 1;
        while (numIdx >= 0 && refreshed[numIdx].classList?.contains('mrel')) numIdx--;
        if (numIdx < 0) continue;
        const numNode = refreshed[numIdx];
        const numText = (numNode.textContent || '').trim();
        const isSci = numNode.classList?.contains('math-note--sci')
          || numNode.closest?.('.math-note--sci');
        if (!/^\d/.test(numText) && !isSci) continue;
        if (refreshed[numIdx].closest?.('.math-unit-tail')) continue;
        const wrap = document.createElement('span');
        wrap.className = 'math-unit-tail';
        base.insertBefore(wrap, refreshed[numIdx]);
        for (let k = numIdx; k <= i; k++) wrap.appendChild(refreshed[k]);
        if (refreshed[i + 1] && /^[。.．]$/.test(refreshed[i + 1].textContent.trim())) {
          wrap.appendChild(refreshed[i + 1]);
        }
        break;
      }
    });
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
  bindAdjacentKatexUnits(root);
}

/** KaTeX 後：以 inline style 強制含算式行不在片段間斷行（蓋過舊版 CSS 快取） */
function applyPlainLineBreakFixes(root) {
  if (!root) return;
  root.querySelectorAll('.ai-plain .plain-line-inner, .ai-plain .choice-step .plain-line-inner, .ai-plain .choice-body').forEach(inner => {
    if (!inner.querySelector('.katex, .math-block, .math-unit-tail, .plain-katex-nowrap')) return;
    inner.style.overflowWrap = 'normal';
    inner.style.wordBreak = 'normal';
    inner.querySelectorAll('.katex, .math-unit-tail, .plain-katex-nowrap').forEach(el => {
      el.style.whiteSpace = 'nowrap';
      el.style.display = 'inline-block';
      el.style.maxWidth = 'none';
    });
    const flat = (inner.textContent || '').replace(/\s/g, '');
    if (flat.length <= 110 || /取|倍|Ms[−-]?1|×10|\\frac|dfrac|=/.test(flat)) {
      inner.style.whiteSpace = 'nowrap';
      inner.classList.add('plain-line--hscroll');
    }
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

/** 多行 $$…$$ 反應變化表壓成單行，供 layout 辨識 */
function collapseReactionTableBlocks(text) {
  return String(text || '').replace(/\$\$([\s\S]*?)\$\$/g, (full, inner) => {
    if (!/\\begin\{array\}/.test(inner) || !/\\rightleftharpoons|\\rightarrow/.test(inner)) return full;
    const oneLine = inner.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return `$$${oneLine}$$`;
  });
}

/** 併回被拆開的 $$…$$ 區塊（含跨行 array） */
function mergeMultilineDisplayMath(lines) {
  const out = [];
  let buf = null;
  const flush = () => {
    if (buf !== null) {
      out.push(buf);
      buf = null;
    }
  };
  for (const line of lines) {
    const t = String(line ?? '');
    if (buf === null) {
      const opens = (t.match(/\$\$/g) || []).length;
      if (opens % 2 === 1) {
        buf = t;
        continue;
      }
      out.push(t);
      continue;
    }
    buf = `${buf}\n${t}`;
    const total = (buf.match(/\$\$/g) || []).length;
    if (total % 2 === 0) {
      flush();
    }
  }
  flush();
  return out;
}

/** 化學平衡 ICE：拆開 array 內誤嵌的 cases，並清除多餘列距指令 */
function flattenReactionIceTables(text) {
  let s = String(text || '');
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (full, inner) => {
    if (!/\\begin\{array\}/.test(inner) || !/\\begin\{cases\}/.test(inner)) return full;
    const specM = inner.match(/\\begin\{array\}\{([^}]*)\}/);
    const spec = specM ? specM[1] : 'ccccc';
    let body = inner
      .replace(/\\begin\{array\}\{[^}]*\}/, '')
      .replace(/\\end\{array\}\s*$/, '');
    body = body.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, cb) => (
      cb.replace(/\\+\[[^\]]*\]/g, '\\\\').trim()
    ));
    body = body.replace(/\\+\[[^\]]*\]/g, '\\\\');
    return `$$\\begin{array}{${spec}}\n${body.trim()}\n\\end{array}$$`;
  });
  s = s.replace(/\$\$\s*\\begin\{cases\}([\s\S]*?)\\end\{cases\}\s*\$\$/g, (full, inner) => {
    if (!/\\rightleftharpoons|\\rightarrow/.test(inner)) return full;
    if (/原子不滅|莫耳數不變|聯立/.test(inner) && !/\\text\{(初|變|平|起始|變化|平衡)\}/.test(inner)) return full;
    const cleaned = inner.replace(/\\+\[[^\]]*\]/g, '\\\\').trim();
    return `$$\\begin{array}{ccccc}\n${cleaned}\n\\end{array}$$`;
  });
  return s;
}

const REACTION_TABLE_STASH = [];

/** 預處理階段（escape 前）將反應變化表轉成欄位網格 HTML，以占位符暫存 */
function injectReactionTableHtml(text) {
  REACTION_TABLE_STASH.length = 0;
  return String(text || '').replace(/\$\$([\s\S]*?)\$\$/g, (full) => {
    if (!/\\begin\{array\}/.test(full) || !/\\rightleftharpoons|\\rightarrow/.test(full)) return full;
    const html = splitPlainReactionArray(full);
    if (!html) return full;
    const id = REACTION_TABLE_STASH.length;
    REACTION_TABLE_STASH.push(html);
    return `\n⟦RTABLE${id}⟧\n`;
  });
}

/** escape 後還原占位符為 HTML */
function restoreReactionTablePlaceholders(text) {
  return String(text || '').replace(/⟦RTABLE(\d+)⟧/g, (_, id) => {
    return REACTION_TABLE_STASH[Number(id)] || '';
  });
}
