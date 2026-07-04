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

function isHlineRow(r) {
  return r === '\\hline' || /^\\hline\b/.test(String(r || '').trim());
}

/** 反應式列中物種欄位索引（跳過空白與 +、→ 等運算符） */
function getReactionSpeciesColumnIndices(cells) {
  const indices = [];
  for (let i = 0; i < cells.length; i++) {
    const c = String(cells[i] || '').trim();
    if (!c || isOperatorCell(c)) continue;
    indices.push(i);
  }
  return indices;
}

/** 資料列是否已與反應式列同欄數對齊（含運算符空欄） */
function isGridAlignedDataRow(reactionCells, dataCells) {
  return dataCells.length === reactionCells.length && dataCells.length > 1;
}

/** 緊湊資料列（起始／變化／結果）展開到反應式欄位網格 */
function expandDataRowToReactionGrid(reactionCells, dataCells) {
  const rCells = reactionCells.map((c) => String(c || '').trim());
  const dCells = dataCells.map((c) => String(c || '').trim());
  if (isGridAlignedDataRow(rCells, dCells)) return dCells;

  const grid = new Array(rCells.length).fill('');
  const speciesIdx = getReactionSpeciesColumnIndices(rCells);
  const hasLabel = /\\text\{/.test(dCells[0] || '');
  if (hasLabel) grid[0] = dCells[0];

  const rawVals = (hasLabel ? dCells.slice(1) : dCells).filter((v) => v !== '');
  const vals = rawVals.slice(0, speciesIdx.length);
  while (vals.length < speciesIdx.length) vals.push('');

  for (let j = 0; j < speciesIdx.length; j++) {
    grid[speciesIdx[j]] = normalizeTableDataCell(vals[j] || '');
  }
  return grid;
}

/** 化簡純數字合併結果（1-1→0） */
function simplifyMergedCell(tex) {
  let t = String(tex || '').trim();
  if (!t) return t;
  t = t.replace(/\s*([+\-−－])\s*/g, '$1');
  const sub = t.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (sub && parseFloat(sub[1]) === parseFloat(sub[2])) return '0';
  const add = t.match(/^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$/);
  if (add) {
    const sum = parseFloat(add[1]) + parseFloat(add[2]);
    return Number.isInteger(sum) ? String(sum) : String(sum);
  }
  return t;
}

function normalizeTableDataCell(tex) {
  const t = String(tex || '').trim();
  if (/^\d+(?:\.\d+)?\s*[-+]\s*\d+(?:\.\d+)?$/.test(t)) return simplifyMergedCell(t);
  return t;
}

/** 起始量 + 變化量 → 結果量（字串拼接，保留 LaTeX） */
function mergeStartChangeCells(start, change) {
  const s = String(start || '').trim();
  let c = String(change || '').trim();
  if (!c || c === '-' || c === '—' || c === '－') return s || '—';
  if (/^[+＋]/.test(c)) {
    const tail = c.replace(/^[+＋]\s*/, '').trim();
    if (!s || s === '0' || s === '-') return simplifyMergedCell(tail || '0');
    return simplifyMergedCell(`${s}+${tail}`);
  }
  if (/^[-−－]/.test(c)) {
    const tail = c.replace(/^[-−－]\s*/, '').trim();
    if (!s || s === '0') return simplifyMergedCell(tail ? `-${tail}` : '0');
    if (!tail) return s;
    return simplifyMergedCell(`${s}-${tail}`);
  }
  return simplifyMergedCell(`${s}${c}`);
}

/**
 * 反應表結構正規化：保留多列資料（含中間步驟），僅做欄位對齊；不壓成三列、不推斷 1/2/0。
 * 僅在「有起始＋單一變化、缺結果」時才補結果列。
 */
function ensureReactionTableStructure(rows) {
  const items = (rows || []).map((r) => String(r || '').trim()).filter(Boolean);
  const dataRows = items.filter((r) => !isHlineRow(r));
  if (dataRows.length < 2) return items;

  const firstIsReaction = /\\rightleftharpoons|\\rightarrow/.test(dataRows[0] || '');
  if (!firstIsReaction) return items;

  const reaction = dataRows[0];
  const rCells = splitArrayRowCells(reaction);
  const speciesCount = getReactionSpeciesColumnIndices(rCells).length;
  let bodyRows = dataRows.slice(1).map((row) => {
    const cells = splitArrayRowCells(row);
    if (!isGridAlignedDataRow(rCells, cells) && speciesCount > 0) {
      return expandDataRowToReactionGrid(rCells, cells).join(' & ');
    }
    return row;
  });

  const hasStart = bodyRows.some((r) => /\\text\{(?:起始|初|I)\}/.test(r));
  const hasResult = bodyRows.some((r) => /\\text\{(?:結果|平衡|E|平)\}/.test(r));
  const changeLike = (r) => /\\text\{(?:變化|變|C|完全反應|移至左|移至右|完全移至|完全向左|再向右)\}/.test(r);
  const changeCount = bodyRows.filter(changeLike).length;

  if (!hasResult && hasStart && changeCount === 1 && bodyRows.length === 2) {
    const startRow = bodyRows.find((r) => /\\text\{(?:起始|初|I)\}/.test(r));
    const changeRow = bodyRows.find(changeLike);
    if (startRow && changeRow) {
      bodyRows = [...bodyRows, buildResultRowFromStartChange(reaction, startRow, changeRow)];
    }
  }

  return normalizeReactionTableHline([reaction, ...bodyRows]);
}

function buildResultRowFromStartChange(reactionRow, startRow, changeRow) {
  const rCells = splitArrayRowCells(reactionRow);
  const sCells = splitArrayRowCells(startRow);
  const cCells = splitArrayRowCells(changeRow);

  if (isGridAlignedDataRow(rCells, sCells) && isGridAlignedDataRow(rCells, cCells)) {
    const out = sCells.map((s, i) => {
      if (i === 0 && /\\text\{/.test(s)) return '\\text{結果}';
      if (!s && !cCells[i]) return '';
      if (isOperatorCell(rCells[i])) return '';
      return mergeStartChangeCells(s, cCells[i]);
    });
    if (/\\text\{/.test(out[0] || '')) out[0] = '\\text{結果}';
    return out.join(' & ');
  }

  const speciesIdx = getReactionSpeciesColumnIndices(rCells);
  const sHas = /\\text\{/.test(sCells[0] || '');
  const cHas = /\\text\{/.test(cCells[0] || '');
  const sVals = (sHas ? sCells.slice(1) : sCells).filter((v) => String(v).trim() !== '');
  const cVals = (cHas ? cCells.slice(1) : cCells).filter((v) => String(v).trim() !== '');
  const resultVals = [];
  for (let j = 0; j < speciesIdx.length; j++) {
    resultVals.push(mergeStartChangeCells(sVals[j] || '', cVals[j] || ''));
  }
  return ['\\text{結果}', ...resultVals].join(' & ');
}

/** @deprecated 使用 ensureReactionTableStructure */
function ensureReactionTableResultRow(rows) {
  return ensureReactionTableStructure(rows);
}

/** 將 \\hline 校正到最末資料列之前；反應表須有結果列才畫線，避免孤兒橫線造成空白 */
function normalizeReactionTableHline(rows) {
  const items = rows.map((r) => String(r || '').trim()).filter(Boolean);
  const isHline = (r) => r === '\\hline' || /^\\hline\b/.test(r);
  const dataRows = items.filter((r) => !isHline(r));
  if (dataRows.length < 2) return dataRows;

  const firstIsReaction = /\\rightleftharpoons|\\rightarrow/.test(dataRows[0] || '');
  const minRowsForHline = firstIsReaction ? 3 : 2;

  if (dataRows.length >= minRowsForHline) {
    const out = [...dataRows];
    out.splice(out.length - 1, 0, '\\hline');
    return out;
  }
  return dataRows;
}

/** 移除沒有後續資料列的孤兒橫線 */
function dropOrphanReactionHlines(parsedRows) {
  const out = [];
  for (let i = 0; i < parsedRows.length; i++) {
    if (parsedRows[i].type === 'hline') {
      const hasDataAfter = parsedRows.slice(i + 1).some((p) => p.type === 'data');
      if (!hasDataAfter) continue;
    }
    out.push(parsedRows[i]);
  }
  return out;
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
    normalizeReactionTableHline(
      ensureReactionTableStructure(
        splitArrayBodyRows(arr[2]).map((r) => r.trim()).filter(Boolean)
      )
    )
  );
  if (rows.length < 3) return null;

  const dataRows = rows.filter(r => r !== '\\hline' && !/^\\hline\s*$/.test(r));
  if (dataRows.length < 3) return null;

  const parsedRows = [];
  let reactionCells = null;
  let maxCols = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row === '\\hline' || /^\\hline\s*$/.test(row)) {
      parsedRows.push({ type: 'hline' });
      continue;
    }
    let cells = splitArrayRowCells(row);
    if (!reactionCells && /\\rightleftharpoons|\\rightarrow/.test(row)) {
      reactionCells = cells;
      maxCols = cells.length;
    } else if (reactionCells) {
      cells = expandDataRowToReactionGrid(reactionCells, cells);
    } else {
      maxCols = Math.max(maxCols, cells.length);
    }
    const next = rows[i + 1];
    const nextIsHline = next === '\\hline' || /^\\hline\s*$/.test(next || '');
    parsedRows.push({ type: 'data', cells, preHline: nextIsHline });
  }
  if (!maxCols && reactionCells) maxCols = reactionCells.length;
  if (maxCols < 2) return null;

  const rowsForRender = dropOrphanReactionHlines(parsedRows);

  const parts = [
    '<div class="reaction-table-stacked">',
    `<div class="reaction-table-grid" style="--rt-cols:${maxCols}">`
  ];

  for (const item of rowsForRender) {
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

/** KaTeX 後清除殘留 $ 文字（含單獨一行的 $） */
function stripStrayDollarsInPlain(root) {
  if (!root) return;
  root.querySelectorAll('.plain-line-inner, .choice-body').forEach(inner => {
    inner.childNodes.forEach(node => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      let t = node.textContent || '';
      const orig = t;
      if (/^\s*\$+\s*$/.test(t)) {
        node.textContent = '';
        return;
      }
      while (/\$(\s*)$/.test(t)) t = t.replace(/\$(\s*)$/, '$1');
      if (t !== orig) node.textContent = t;
    });
    const flat = (inner.textContent || '').replace(/\s/g, '');
    if (flat === '$' || flat === '$$') {
      inner.textContent = '';
      inner.closest('.plain-line')?.classList.add('plain-line--empty');
    }
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

function parseNumericTableCell(tex) {
  const t = String(tex || '').trim();
  if (!t || /[xXyYsS]/.test(t)) return null;
  const m = t.match(/^([+\−－-])?\s*([\d.]+)/);
  if (!m) return null;
  const sign = m[1] && /^[-−－]/.test(m[1]) ? -1 : 1;
  return sign * parseFloat(m[2]);
}

function formatTableChangeCell(delta, refCell) {
  if (Math.abs(delta) < 1e-12) return '0';
  const refDec = decimalPlacesOfNum(String(refCell || '').replace(/^[+\−－-]/, ''));
  const dec = Math.max(refDec, 2);
  let s = Math.abs(delta).toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return delta > 0 ? `+${s}` : `-${s}`;
}

/** 步驟列若為無正負號之濃度快照，視為「結果列」誤放在變化步驟 */
function isKspResultStyleStepRow(stepRow) {
  const cells = splitArrayRowCells(stepRow);
  const vals = cells.slice(1).map((c) => String(c || '').trim()).filter(Boolean);
  if (!vals.length) return false;
  const hasNumericChange = vals.some((c) => /^[+\−－-]\s*[\d.]/.test(c));
  if (hasNumericChange) return false;
  const hasVarChange = vals.some((c) => /^[+\−－-]?[xXyYsS]\b/.test(c));
  if (hasVarChange) return false;
  return vals.some((c) => /^[\d.]+$/.test(c));
}

function convertStepRowResultsToChanges(reaction, startRow, stepRow) {
  const rCells = splitArrayRowCells(reaction);
  const sGrid = expandDataRowToReactionGrid(rCells, splitArrayRowCells(startRow));
  const lGrid = expandDataRowToReactionGrid(rCells, splitArrayRowCells(stepRow));
  const label = splitArrayRowCells(stepRow)[0] || '\\text{完全向左}';
  const out = rCells.map(() => '');
  out[0] = /\\text\{/.test(label) ? label : '\\text{完全向左}';
  for (let i = 0; i < rCells.length; i++) {
    if (i === 0) continue;
    if (isOperatorCell(rCells[i])) continue;
    const sv = parseNumericTableCell(sGrid[i]);
    const lv = parseNumericTableCell(lGrid[i]);
    if (sv !== null && lv !== null) {
      out[i] = formatTableChangeCell(lv - sv, sGrid[i] || lGrid[i]);
    } else {
      out[i] = lGrid[i] || '';
    }
  }
  return out.join(' & ');
}

function recomputeBalanceRowFromChanges(reaction, startRow, changeRows) {
  const rCells = splitArrayRowCells(reaction);
  let merged = expandDataRowToReactionGrid(rCells, splitArrayRowCells(startRow));
  for (const ch of changeRows) {
    const cGrid = expandDataRowToReactionGrid(rCells, splitArrayRowCells(ch));
    merged = merged.map((v, i) => {
      if (i === 0) return v;
      if (isOperatorCell(rCells[i])) return '';
      return mergeStartChangeCells(v, cGrid[i]);
    });
  }
  merged[0] = '\\text{平衡}';
  return merged.join(' & ');
}

/** Ksp 四列表：中間步驟列寫變化量，平衡列寫最終量（泛用，不限 AgCl） */
function normalizeKspPrecipitationSemantics(block) {
  const full = String(block || '').trim();
  if (!/\\begin\{array\}/.test(full) || !/\\rightleftharpoons/.test(full)) return null;
  if (!/\\text\{(?:起始|初)\}/.test(full)) return null;
  if (!/\\text\{(?:完全向左|移至左|完全移至|完全反應)\}/.test(full)) return null;

  const inner = full.startsWith('$$') && full.endsWith('$$') ? full.slice(2, -2).trim() : full;
  const arr = inner.match(/\\begin\{array\}\{([^}]*)\}([\s\S]*?)\\end\{array\}/);
  if (!arr) return null;

  const spec = arr[1] || 'ccccc';
  const bodyRows = normalizeArrayRows(
    splitArrayBodyRows(arr[2]).map((r) => r.trim()).filter((r) => r && !isHlineRow(r))
  );
  if (bodyRows.length < 4 || !/\\rightleftharpoons/.test(bodyRows[0])) return null;

  const reaction = bodyRows[0];
  const rows = bodyRows.slice(1);
  const findIdx = (pat) => rows.findIndex((r) => pat.test(r));
  const startIdx = findIdx(/\\text\{(?:起始|初)\}/);
  const leftIdx = findIdx(/\\text\{(?:完全向左|移至左|完全移至|完全反應)\}/);
  const rightIdx = findIdx(/\\text\{再向右\}/);
  const balIdx = findIdx(/\\text\{(?:平衡|結果)\}/);
  if (startIdx < 0 || leftIdx < 0) return null;

  let changed = false;
  const startRow = rows[startIdx];
  if (isKspResultStyleStepRow(rows[leftIdx])) {
    rows[leftIdx] = convertStepRowResultsToChanges(reaction, startRow, rows[leftIdx]);
    changed = true;
  }

  const changeRows = [rows[leftIdx]];
  if (rightIdx >= 0) changeRows.push(rows[rightIdx]);
  if (changed && balIdx >= 0 && changeRows.length) {
    rows[balIdx] = recomputeBalanceRowFromChanges(reaction, startRow, changeRows);
  }
  if (!changed) return null;

  const newRows = normalizeReactionTableHline([reaction, ...rows]);
  return `$$\\begin{array}{${spec}}\n${newRows.join(' \\\\\n ')}\n\\end{array}$$`;
}

/** 從離子濃度敘述行取最後一個數值（混合稀釋後濃度） */
function lastNumericOnChemLine(line) {
  const nums = String(line || '').match(/[\d.]+/g);
  return nums && nums.length ? nums[nums.length - 1] : null;
}

function decimalPlacesOfNum(s) {
  const m = String(s || '').match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

function formatChemDifference(a, b) {
  const pa = parseFloat(a);
  const pb = parseFloat(b);
  if (Number.isNaN(pa) || Number.isNaN(pb)) return null;
  const dec = Math.max(decimalPlacesOfNum(a), decimalPlacesOfNum(b), 3);
  const r = pa - pb;
  let out = r.toFixed(dec);
  if (out.includes('.')) out = out.replace(/0+$/, '').replace(/\.$/, '');
  return out;
}

function parseAgClInitFromContext(ctx) {
  const text = String(ctx || '');
  const agLine = text.match(/\[Ag\^\+?\][^\n]+/);
  const clLine = text.match(/\[Cl\^\-?\][^\n]+/);
  const ag0 = agLine ? lastNumericOnChemLine(agLine[0]) : null;
  const cl0 = clLine ? lastNumericOnChemLine(clLine[0]) : null;
  return { ag0, cl0 };
}

function buildLabeledKspRow(rCells, label, speciesVals) {
  const speciesIdx = getReactionSpeciesColumnIndices(rCells);
  const out = new Array(rCells.length).fill('');
  out[0] = label;
  speciesIdx.forEach((idx, j) => {
    out[idx] = speciesVals[j] != null ? speciesVals[j] : '';
  });
  return out.join(' & ');
}

function inferKspStartValues(rCells, contextBefore, bodyRows) {
  const speciesIdx = getReactionSpeciesColumnIndices(rCells);
  const startVals = new Array(speciesIdx.length).fill('0');
  const ctx = String(contextBefore || '');
  const { ag0, cl0 } = parseAgClInitFromContext(ctx);

  if (ag0 && cl0 && speciesIdx.length >= 3) {
    return ['0', ag0, cl0];
  }

  const ionLines = ctx.match(/\[[^\]]+\](?:_0|_\{0\})?[^\n]+/g) || [];
  const ionNums = ionLines.map((line) => lastNumericOnChemLine(line)).filter(Boolean);
  if (ionNums.length >= speciesIdx.length - 1) {
    for (let j = 1; j < speciesIdx.length; j++) {
      startVals[j] = ionNums[j - 1] || '0';
    }
    return startVals;
  }

  if (bodyRows.length >= 1) {
    const expanded = expandDataRowToReactionGrid(rCells, splitArrayRowCells(bodyRows[0]));
    const snap = speciesIdx.map((i) => expanded[i]);
    const precip = parseNumericTableCell(snap[0]);
    const ion1 = parseNumericTableCell(snap[1]);
    const ion2 = parseNumericTableCell(snap[2]);
    if (precip != null && precip > 0 && ion1 === 0 && ion2 != null) {
      startVals[0] = '0';
      startVals[1] = String(precip);
      startVals[2] = String(precip + ion2);
      return startVals;
    }
  }
  return null;
}

/** 難溶鹽混合沉澱題：裸數字兩列 → 四列標準表（中間列寫變化量） */
function tryRebuildBareKspTable(block, contextBefore) {
  const full = String(block || '').trim();
  if (!/\\begin\{array\}/.test(full) || !/\\rightleftharpoons/.test(full)) return null;
  if (/\\text\{(?:起始|初)\}/.test(full)) return null;

  const inner = full.startsWith('$$') && full.endsWith('$$') ? full.slice(2, -2).trim() : full;
  const arr = inner.match(/\\begin\{array\}\{([^}]*)\}([\s\S]*?)\\end\{array\}/);
  if (!arr) return null;

  const spec = arr[1] || 'ccccc';
  const dataRows = splitArrayBodyRows(arr[2]).map((r) => r.trim()).filter((r) => r && !isHlineRow(r));
  if (dataRows.length < 2 || !/\\rightleftharpoons/.test(dataRows[0])) return null;

  const reaction = dataRows[0];
  const bodyRows = dataRows.slice(1);
  const rCells = splitArrayRowCells(reaction);
  const speciesIdx = getReactionSpeciesColumnIndices(rCells);
  if (speciesIdx.length < 2) return null;

  const startVals = inferKspStartValues(rCells, contextBefore, bodyRows);
  if (!startVals) return null;

  const ionNums = startVals.slice(1).map((v) => parseFloat(v)).filter((n) => !Number.isNaN(n));
  if (!ionNums.length) return null;
  const limitAmt = String(Math.min(...ionNums));
  const limitedIonVal = Math.min(...ionNums);

  const leftVals = startVals.map((_, j) => (j === 0 ? `+${limitAmt}` : `-${limitAmt}`));
  const rightVals = startVals.map((_, j) => (j === 0 ? '-x' : '+x'));
  const balVals = startVals.map((s, j) => {
    if (j === 0) return `${limitAmt}-x`;
    if (parseFloat(s) === limitedIonVal) return 'x';
    const res = formatChemDifference(s, limitAmt);
    return res ? `${res}+x` : 'x';
  });

  const newRows = normalizeReactionTableHline([
    reaction,
    buildLabeledKspRow(rCells, '\\text{起始}', startVals),
    buildLabeledKspRow(rCells, '\\text{完全向左}', leftVals),
    buildLabeledKspRow(rCells, '\\text{再向右}', rightVals),
    buildLabeledKspRow(rCells, '\\text{平衡}', balVals),
  ]);
  return `$$\\begin{array}{${spec}}\n${newRows.join(' \\\\\n ')}\n\\end{array}$$`;
}

/** @deprecated 保留舊名；請用 tryRebuildBareKspTable */
function tryRebuildAgClKspArrayBlock(block, contextBefore) {
  return tryRebuildBareKspTable(block, contextBefore);
}

/** @deprecated 不再刪除反應表（曾誤刪「各選項分析」題之平衡表） */
function stripMisplacedKspTables(text, questionCtx) {
  return String(text || '');
}

/** 全文掃描：修補並正規化 Ksp 沉澱四列表 */
function repairKspAgClReactionTables(text, questionCtx) {
  const full = stripMisplacedKspTables(text, questionCtx);
  const q = String(questionCtx || '');
  if (typeof isConceptualJudgmentContext === 'function' && isConceptualJudgmentContext(q + '\n' + full)) {
    return full;
  }
  if (typeof needsKspPrecipitationTable === 'function' && !needsKspPrecipitationTable(q + '\n' + full)) {
    return full;
  }
  if (!/K_\{sp\}|Ksp|溶解度積|溶解平衡|沉澱平衡/.test(full) || !/反應式如下/.test(full)) {
    return full;
  }

  const re = /(\$\$[\s\S]*?\$\$)/g;
  let out = '';
  let last = 0;
  let ctx = '';
  let m;
  while ((m = re.exec(full)) !== null) {
    const before = full.slice(0, m.index);
    out += full.slice(last, m.index);
    let block = m[1];
    const prefix = ctx + before.slice(Math.max(0, before.length - 2500));
    if (/\\begin\{array\}/.test(block) && /\\rightleftharpoons/.test(block)) {
      const rebuilt = tryRebuildBareKspTable(block, prefix);
      if (rebuilt) block = rebuilt;
      const normalized = normalizeKspPrecipitationSemantics(block);
      if (normalized) block = normalized;
    }
    out += block;
    ctx += full.slice(last, m.index) + block;
    last = m.index + m[0].length;
  }
  out += full.slice(last);
  return out;
}

/** 化學平衡反應表：拆開 array 內誤嵌的 cases，校正 hline 位置，並清除多餘列距指令 */
function flattenReactionIceTables(text) {
  let s = repairKspAgClReactionTables(String(text || ''));
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (full, inner) => {
    if (!/\\begin\{array\}/.test(inner)) return full;
    if (!/\\rightleftharpoons|\\rightarrow/.test(inner)) return full;
    const specM = inner.match(/\\begin\{array\}\{([^}]*)\}/);
    const spec = specM ? specM[1] : 'ccccc';
    let body = inner
      .replace(/\\begin\{array\}\{[^}]*\}/, '')
      .replace(/\\end\{array\}\s*$/, '');
    if (/\\begin\{cases\}/.test(body)) {
      body = body.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, cb) => (
        cb.replace(/\\+\[[^\]]*\]/g, '\\\\').trim()
      ));
    }
    body = body.replace(/\\+\[[^\]]*\]/g, '\\\\');
    const rowList = normalizeArrayRows(
      normalizeReactionTableHline(
        ensureReactionTableStructure(
          splitArrayBodyRows(body).map((r) => r.trim()).filter(Boolean)
        )
      )
    );
    return `$$\\begin{array}{${spec}}\n${rowList.join(' \\\\\n ')}\n\\end{array}$$`;
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
