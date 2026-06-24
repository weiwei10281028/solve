let annoCounter = 0;

/** 設為 false：不套用板書分行／橫滑／數字註解，僅顯示 AI 原文 + KaTeX */
const BOARD_LAYOUT_ENABLED = false;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function normalizeHtmlDataNotes(raw) {
  return String(raw || '')
    .replace(/\\htmlData\{\s*data-note\s*=\s*([^}]+)\}\{/g, '\\htmlData{note=$1}{')
    .replace(/\\htmlData\{\s*note\s*=\s*([^}]+)\}\{/g, (_, note) => {
      const clean = String(note).trim().replace(/[,\s]+$/g, '');
      return `\\htmlData{note=${clean}}{`;
    });
}

/** 判斷一行是否像 LaTeX／代數算式（非中文敘述） */
function isMathContentLine(line) {
  const t = String(line || '').trim();
  if (!t || t === '$' || t === '$$') return false;
  if (/^[：:。.．；;，,!?！？]$/.test(t)) return false;
  if (/^[\u4e00-\u9fff]/.test(t) && !/\\[a-zA-Z]/.test(t)) return false;
  if (/\\[a-zA-Z]/.test(t)) return true;
  if (/^[A-Za-z][\w.^{}\\]*\s*[=≈<>]/.test(t)) return true;
  if (/^[\d.]+\s*\\%/.test(t) || /^\\?[\d.]+%$/.test(t)) return true;
  if (/^[\d.]+/.test(t) && /[=≈<>+\-×*/\\]/.test(t)) return true;
  return false;
}

function isNarrativeLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (/^[：:。.．；;，,]$/.test(t)) return false;
  return /^[\u4e00-\u9fff]/.test(t) && !isMathContentLine(t);
}

/**
 * 修復 AI 常見的斷裂數學標記：
 * - 單獨一行的 $
 * - 「代入 $」換行後才是算式
 * - 裸寫 \\dfrac / \\displaystyle 未包 $
 */
function repairBrokenMathDelimiters(raw) {
  const displayChunks = [];
  let s = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\$\$[\s\S]*?\$\$/g, m => {
      displayChunks.push(m);
      return `\x00D${displayChunks.length - 1}\x00`;
    });

  const lines = s.split('\n');
  const out = [];
  let i = 0;

  const collectMathBody = (startIdx, { display = false } = {}) => {
    const parts = [];
    let j = startIdx;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next) { j++; continue; }
      if (next === '$' || next === '$$') { j++; break; }
      if (isNarrativeLine(next)) break;
      if (/^[：:。.．；;，,]$/.test(next)) break;
      if (next.endsWith('$$') && display) {
        parts.push(next.replace(/\$\$$/, '').trim());
        j++;
        break;
      }
      if (next.endsWith('$') && !next.startsWith('$')) {
        parts.push(next.replace(/\$+$/, '').trim());
        j++;
        break;
      }
      parts.push(next);
      j++;
    }
    return { body: parts.join(' ').replace(/\s{2,}/g, ' ').trim(), nextIdx: j };
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      out.push('');
      i++;
      continue;
    }

    if (trimmed === '$$' || trimmed === '$') {
      const display = trimmed === '$$';
      const { body, nextIdx } = collectMathBody(i + 1, { display });
      i = nextIdx;
      if (body) out.push(display ? `$$${body}$$` : `$${body}$`);
      continue;
    }

    const trailOpen = trimmed.match(/^(.+?)\s*\$\s*$/);
    if (trailOpen && !trailOpen[1].includes('$')) {
      const { body, nextIdx } = collectMathBody(i + 1);
      i = nextIdx;
      if (body) out.push(`${trailOpen[1].trim()} $${body}$`);
      else out.push(trimmed);
      continue;
    }

    if (/^\$/.test(trimmed) && !/^\$\$/.test(trimmed) && !/\$$/.test(trimmed.slice(1))) {
      const first = trimmed.slice(1).trim();
      const { body, nextIdx } = collectMathBody(i + 1);
      i = nextIdx;
      const merged = [first, body].filter(Boolean).join(' ').trim();
      if (merged) out.push(`$${merged}$`);
      else out.push(trimmed);
      continue;
    }

    if (isMathContentLine(trimmed) && !trimmed.includes('$')) {
      out.push(`$${trimmed}$`);
      i++;
      continue;
    }

    out.push(lines[i]);
    i++;
  }

  s = out.join('\n');
  displayChunks.forEach((m, idx) => { s = s.replace(`\x00D${idx}\x00`, m); });
  return s;
}

function splitNarrativeMath(raw) {
  let s = String(raw || '');
  s = s.replace(/\s*[∘·•]\s*/g, '\n');
  s = s.replace(/([。；;])\s*(?=\$)/g, '$1\n');
  s = s.replace(/(\$[^$\n]+\$)\s*(?=(反應式|整理得|檢視|答案|故|所以|因此|由|設|則|可知|可得|代入|觀察|混合物中|對照選項))/g, '$1\n');
  s = s.replace(/(反應式|整理得|檢視各選項|檢視|答案|答[：:]|對照選項)\s*[：:，,]?\s*/g, '\n$1：');
  s = s.replace(/\s+(?=(由上述|由碳原子|混合物中|觀察|代入|可知|檢視|對照選項|答案|答[：:]|w_[A-Z]\s*=))/g, '\n');
  s = s.replace(/\s+(?=[（(][A-E][)）])/g, '\n');
  s = s.replace(/([；;])\s*(?=[（(][A-E][)）])/g, '$1\n');
  s = s.replace(/(\$[^$\n]+\$)\s*(?=\$[^$\n]+\$)/g, '$1\n');
  s = s.replace(/([%％])\s+(?=[wW]_|[（(][A-E][)）])/g, '$1\n');
  return s;
}

function renderAnnoRow(pairsStr) {
  const pairs = pairsStr.split(',').map(p => p.trim()).filter(Boolean);
  const id = 'anno-' + (annoCounter++);
  const badges = pairs.map((pair, i) => {
    const arrow = pair.indexOf('→');
    if (arrow === -1) return '';
    const term = pair.slice(0, arrow).trim();
    const meaning = pair.slice(arrow + 1).trim();
    const bid = `${id}-${i}`;
    return `<span class="anno-badge" id="${bid}" onclick="toggleAnno('${bid}')">
      <span class="anno-term">${esc(term)}</span>
      <span class="anno-popup">${esc(meaning)}</span>
    </span>`;
  }).join('');
  return `<div class="anno-row">${badges}</div>`;
}

function toggleAnno(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const wasActive = el.classList.contains('active');
  el.closest('.anno-row')?.querySelectorAll('.anno-badge').forEach(b => b.classList.remove('active'));
  if (!wasActive) el.classList.add('active');
}

function fixSlashFractions(tex) {
  let t = tex;
  const saved = [];
  t = t.replace(/\\htmlData\{note=[^}]*\}\{[^}]*\}/g, m => {
    saved.push(m);
    return `\x00S${saved.length - 1}\x00`;
  });

  let prev;
  do {
    prev = t;
    t = t.replace(/(\d+)\s*\/\s*(\d+)/g, '\\dfrac{$1}{$2}');
  } while (t !== prev);

  saved.forEach((m, i) => { t = t.replace(`\x00S${i}\x00`, m); });
  return t;
}

function enrichMathNotes(tex) {
  if (!/^\$/.test(tex)) return tex;
  let t = tex;
  const saved = [];
  t = t.replace(/\\htmlData\{note=[^}]*\}\{[^}]*\}/g, m => {
    saved.push(m);
    return `\x00H${saved.length - 1}\x00`;
  });

  // 分壓式中 ×1 代表總壓 P
  if (/P_|分壓|K_p|M_\{avg\}/.test(t)) {
    t = t.replace(/(\\times|×)\s*1(?![0-9.])/g, '$1 \\htmlData{note=總壓}{1}');
  }
  t = t.replace(/(\\times|×)\s*0\.082\b/g, '$1 \\htmlData{note=氣體常數R}{0.082}');
  t = t.replace(/(\\times|×)\s*96500\b/g, '$1 \\htmlData{note=法拉第常數}{96500}');
  t = t.replace(/\/\s*22\.4\b/g, '/ \\htmlData{note=莫耳體積}{22.4}');
  t = t.replace(/(\\times|×)\s*2\.4\b/g, '$1 \\htmlData{note=密度}{2.4}');

  // 莫耳數／分子數分式：分子＝總質量，分母＝分子量
  if (/莫耳數|分子數|原子數|分子量|\d+\s*g/.test(t)) {
    t = t.replace(/\\dfrac\{(\d+(?:\.\d+)?)\}\{(\d+(?:\.\d+)?)\}/g, (m, a, b) => {
      if (/\\htmlData/.test(m)) return m;
      return `\\dfrac{\\htmlData{note=總質量}{${a}}}{\\htmlData{note=分子量}{${b}}}`;
    });
  }

  // 乘號後係數（原子數 = 分子數 × n）
  if (/原子數/.test(t)) {
    t = t.replace(/(\\times|×)\s*(\d+)(?![0-9.])/g, (m, op, n) => {
      if (/\\htmlData/.test(m)) return m;
      return `${op} \\htmlData{note=每分子原子數}{${n}}`;
    });
  }

  saved.forEach((m, i) => { t = t.replace(`\x00H${i}\x00`, m); });
  return t;
}

const SUP_DIGIT_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUB_DIGIT_MAP = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

/** Unicode 下標（H₂A）→ LaTeX */
function normalizeUnicodeSubscripts(raw) {
  return String(raw || '').replace(
    /([A-Za-z])([₀₁₂₃₄₅₆₇₈₉]+)/g,
    (_, sym, subs) => {
      const num = [...subs].map(c => SUB_DIGIT_MAP[c] || '').join('');
      return num ? `$${sym}_{${num}}$` : sym + subs;
    }
  );
}

/** 將正文裡散落的化學／酸鹼符號包進 $...$（不動既有數學區塊） */
function wrapLooseChemNotation(raw) {
  const saved = [];
  let s = String(raw || '').replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+\$/g, m => {
    saved.push(m);
    return `\x00X${saved.length - 1}\x00`;
  });
  s = s.replace(/\bpK_(\d+)\b/g, (_, n) => `$pK_{${n}}$`);
  s = s.replace(/\bpH\b/g, '$pH$');
  s = s.replace(/\bK_\{?a(\d+)\}?\b/g, (_, n) => `$K_{a${n}}$`);
  s = s.replace(/\[([A-Za-z][A-Za-z0-9^+\-_{}\\]*)\]/g, (m, inner) => {
    if (/[+\-\^_{}\\]/.test(inner)) return `$[${inner}]$`;
    return m;
  });
  s = s.replace(/(?<![A-Za-z$])([A-Z][a-z]?)(_\{[^}]+\}|_\d+)(?![A-Za-z{])/g, (_, sym, sub) => `$${sym}${sub}$`);
  saved.forEach((m, i) => { s = s.replace(`\x00X${i}\x00`, m); });
  return s;
}

function preprocessMathText(raw) {
  return wrapLooseChemNotation(
    wrapBareLatexBlocks(
      normalizeUnicodeSubscripts(
        normalizeUnicodeIonCharges(
          repairBrokenMathDelimiters(
            normalizeHtmlDataNotes(String(raw || '').replace(/\r\n/g, '\n'))
          )
        )
      )
    )
  );
}

/** Unicode 離子價數（Co³⁺、Br⁻）轉 KaTeX */
function normalizeUnicodeIonCharges(raw) {
  return String(raw || '').replace(
    /([A-Z][a-z]?)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/g,
    (_, sym, supDigits, sign) => {
      const num = [...supDigits].map(c => SUP_DIGIT_MAP[c] || '').join('');
      const ch = sign === '⁺' ? '+' : '-';
      const sup = num ? `${num}${ch}` : ch;
      return `$${sym}^{${sup}}$`;
    }
  );
}

/** 是否為離子價數上標（非科學記號次方） */
function isIonChargeSuperscript(body) {
  const b = String(body || '').trim();
  if (!b || /\\boldsymbol|\\mathbf/.test(b)) return false;
  if (/^[+\-−]$/.test(b)) return true;
  if (/^\d+[+\-−]$/.test(b)) return true;
  return false;
}

/** LaTeX 上標中的價數正負號加粗（^{3+}、^{-} 等）；不處理 10^{-4} 科學記號 */
function emphasizeIonCharges(tex) {
  let t = tex;
  const saved = [];
  t = t.replace(/\\htmlData\{note=[^}]*\}\{[^}]*\}/g, m => {
    saved.push(m);
    return `\x00I${saved.length - 1}\x00`;
  });
  t = t.replace(/\^\{([^}]*)\}/g, (m, body) => {
    if (!isIonChargeSuperscript(body)) return m;
    const emphasized = body.replace(/([+\-−])/g, (_, s) => `\\boldsymbol{${s === '−' ? '-' : s}}`);
    return `^{${emphasized}}`;
  });
  t = t.replace(/\^([+\-−])(?![0-9a-zA-Z{])/g, (_, s) => {
    const sign = s === '−' ? '-' : s;
    return `^{\\boldsymbol{${sign}}}`;
  });
  saved.forEach((m, i) => { t = t.replace(`\x00I${i}\x00`, m); });
  return t;
}

/** 統一科學記號寫法為 {10}^{-n}，避免 1 與 0 分離 */
function fixScientificNotation(tex) {
  let t = tex;
  t = t.replace(/10\s*\^\s*\{?\s*(-\d+)\s*\}?/g, '{10}^{$1}');
  t = t.replace(/10\s*\^\s*\{?\s*(\d+)\s*\}?/g, '{10}^{$1}');
  // 離子濃度如 10^{-4}M、10^{-4} mol
  t = t.replace(/\{10\}\^\{(-?\d+)\}\s*M\b/g, '{10}^{$1}\\,\\mathrm{M}');
  return t;
}

/** 反應變化表：拉開欄距與列距，hline 不壓到分母 */
function prepareArrayMath(tex) {
  if (!/\\begin\{array\}/.test(tex)) return tex;
  const isDisplay = tex.startsWith('$$');
  let t = tex.replace(/\\displaystyle\s*/g, '');
  if (isDisplay && !/\\arraystretch/.test(t)) {
    t = t.replace(
      /\\begin\{array\}/,
      '\\renewcommand{\\arraystretch}{2.45}\\setlength{\\arraycolsep}{1.25em}\\begin{array}'
    );
  }
  t = t.replace(/\\begin\{array\}\{([^}]*)\}/g, (_, spec) => {
    const cleaned = String(spec || '').replace(/\|/g, '');
    return `\\begin{array}{${cleaned || 'ccccc'}}`;
  });
  return t;
}

function enhanceMath(tex) {
  let t = normalizeHtmlDataNotes(ensureRenderableInlineMath(tex))
    .replace(/\\frac\b/g, '\\dfrac')
    .replace(/\\tfrac\b/g, '\\dfrac')
    .replace(/\\htmlData\{data-note\s*=/g, '\\htmlData{note=')
    .replace(/\\htmlData\{note=(?:代入數值|待補|數值|分子|分母)\}\{([^}]*)\}/g, '$1')
    .replace(/⇌/g, '\\rightleftharpoons ')
    .replace(/↔/g, '\\leftrightarrow ')
    .replace(/→/g, '\\rightarrow ');
  t = t.replace(/\\begin\{array\}\{([^}]*)\}/g, (_, spec) => {
    const cleaned = String(spec || '').replace(/\|/g, '');
    return `\\begin{array}{${cleaned || 'ccc'}}`;
  });
  t = fixSlashFractions(t);
  t = fixScientificNotation(t);
  t = prepareArrayMath(t);
  t = enrichMathNotes(t);
  t = emphasizeIonCharges(t);
  const isInline = t.startsWith('$') && !t.startsWith('$$');
  if (isInline && /\\dfrac/.test(t) && !/\\displaystyle/.test(t) && !/\\begin\{/.test(t)) {
    t = t.replace(/^\$/, '$\\displaystyle ');
  }
  return t;
}

function looksLikeChemicalSpecies(cell) {
  const t = String(cell || '').trim();
  if (!t) return false;
  if (/[=<>]/.test(t)) return false;
  const hasElement = /[A-Z][a-z]?(?:_\{?\d+\}?|\d)?/.test(t);
  const hasPhase = /\((?:g|l|s|aq)\)/.test(t);
  return hasElement && (hasPhase || t.length <= 24);
}

/** 保底：若反應變化表漏箭頭，補一行反應式避免資訊缺漏 */
function ensureReactionArrows(raw) {
  return String(raw || '').replace(/\$\$[\s\S]*?\$\$/g, (block, offset, src) => {
    if (!/\\begin\{array\}/.test(block)) return block;
    if (/\\rightleftharpoons|\\leftrightarrow|\\rightarrow/.test(block)) return block;
    const m = block.match(/&\s*([^&\\]+)\s*&\s*([^\\]+)\\\\/);
    if (!m) return block;
    const left = m[1].trim();
    const right = m[2].trim();
    if (!looksLikeChemicalSpecies(left) || !looksLikeChemicalSpecies(right)) return block;
    const recent = String(src || '').slice(Math.max(0, offset - 220), offset);
    const recentCompact = recent.replace(/\s+/g, '');
    const leftCompact = left.replace(/\s+/g, '');
    const rightCompact = right.replace(/\s+/g, '');
    const hasArrowNearby = /⇌|→|\\rightleftharpoons|\\leftrightarrow|\\rightarrow/.test(recent);
    const hasSameReactionNearby = hasArrowNearby
      && recentCompact.includes(leftCompact)
      && recentCompact.includes(rightCompact);
    if (hasSameReactionNearby) return block;
    return `$$${left} \\rightleftharpoons ${right}$$\n${block}`;
  });
}

const CHEM_LABEL_WORDS = '分子量|原子數|莫耳數|莫耳分率|體積|質量|分壓|濃度|密度|係數';

function boardPlainText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\x00[MCA]\d+\x00/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 段考敘述＋算式：在步驟詞與獨立算式前斷行 */
function insertStepBreaks(raw) {
  let s = String(raw || '');
  s = s.replace(/\s*[∘·•]\s*/g, '\n');
  s = s.replace(/([。.．；])\s*(?=(由|設|故|則|因此|所以|又|可得|可知|代入|化簡|整理|平衡反應式|反應式|w_[A-Z]\s*=))/g, '$1\n');
  s = s.replace(/([。.．])\s*(?=\$\$)/g, '$1\n');
  s = s.replace(/([。.．])\s*(?=\$[^$])/g, '$1\n');
  s = s.replace(/(\$[^$\n]+\$)\s+(?=(由|設|故|則|因此|所以|\$\$|\$[^$]|w_[A-Z]\s*=))/g, '$1\n');
  s = s.replace(/\s+(?=(w_[A-Z]\s*=))/g, '\n');
  return s;
}

/** 未包 $ 的 array／反應表，補上 display 數學區塊 */
function wrapBareLatexBlocks(raw) {
  return String(raw || '').replace(
    /(?:^|\n)((?:\\displaystyle\s*)?(?:\\renewcommand|\\setlength|\\begin\{array\})[\s\S]*?\\end\{array\})(?=\n|$)/g,
    (m, block) => (block.includes('$') ? m : `\n$$${block}$$\n`)
  );
}

function splitDenseMathRuns(raw) {
  let s = String(raw || '');
  s = s.replace(/\s*[∘·•]\s*/g, '\n');
  s = s.replace(/(\$[^$\n]+\$)\s+(?=(?:代入|由|可得|整理|觀察|混合物中|對照選項|答案|答[：:]|w_[A-Z]\s*=))/g, '$1\n');
  s = s.replace(/([。；;])\s+(?=(?:代入|由|可得|整理|觀察|混合物中|對照選項|答案|答[：:]|w_[A-Z]\s*=))/g, '$1\n');
  s = s.replace(/(\$[^$\n]+\$)\s+(?=\$[^$\n]+\$)/g, '$1\n');
  s = s.replace(/([%％])\s+(?=\$|w_[A-Z])/g, '$1\n');
  return s;
}

function ensureDisplayMath(tex) {
  const t = String(tex || '');
  const inner = t.replace(/^\$+|\$+$/g, '').trim();
  if (/\\begin\{(?:array|aligned|matrix)|\\renewcommand|\\setlength/.test(inner)) {
    return `$$${inner.replace(/^\\displaystyle\s*/, '')}$$`;
  }
  return t;
}

function extractAnswerLine(raw) {
  let s = String(raw || '');
  let answer = '';
  const patterns = [
    /(?:^|\n)\s*(?:\*\*)?\s*答[：:]\s*([^。\n<]+(?:。)?)(?:\*\*)?\s*$/m,
    /(?:^|\n|\s)答[：:]\s*([（(]?[A-E0-9][^。\n<]*(?:。)?)/m
  ];
  for (const pattern of patterns) {
    const m = s.match(pattern);
    if (!m) continue;
    answer = `答：${m[1].trim()}`;
    s = s.slice(0, m.index) + s.slice(m.index + m[0].length);
    break;
  }
  return { body: s.trim(), answer };
}

/** 純詳解模式：抽出答案文字（不含「答：」），供藍色答案框顯示 */
function extractPlainAnswer(raw) {
  let s = String(raw || '');
  let answerText = '';
  const patterns = [
    /(?:^|\n)\s*\*\*答[：:]\s*([\s\S]*?)\*\*\s*$/m,
    /(?:^|\n)\s*\*\*答[：:]\s*([\s\S]*?)\*\*/m,
    /(?:^|\n)\s*答[：:]\s*([^\n]+?)\s*$/m
  ];
  for (const pattern of patterns) {
    const m = s.match(pattern);
    if (!m) continue;
    answerText = m[1].trim().replace(/[。.．]\s*$/, '');
    s = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).trim();
    break;
  }
  return { body: s, answerText };
}

function buildAnswerBoxHtml(answerText) {
  const t = String(answerText || '').trim();
  if (!t) return '';
  const safe = /\$/.test(t) ? t : esc(t);
  return `<div class="answer-box answer-box--final">${safe}</div>`;
}

function narrativeChineseCount(html) {
  return (boardPlainText(html).match(/[\u4e00-\u9fff]/g) || []).length;
}

function looksLikeMathLine(t) {
  const plain = boardPlainText(t);
  if (!plain) return false;
  if (/^\$|\\\(|\\dfrac|\\frac|\x00C\d+\x00/.test(plain)) return true;
  if (/^[=≠≈<>≤≥]/.test(plain)) return true;
  if (/^\d+\s*[:：]\s*\d+/.test(plain)) return true;
  if (/^[A-Z]\s*[:：]\s*[A-Z]/.test(plain)) return true;
  if (new RegExp(`^(${CHEM_LABEL_WORDS})`).test(plain)) return true;
  if (/[+\-×÷*/=≠≈<>≤≥]/.test(plain) && /[\d$\\(（]/.test(plain)) return true;
  return false;
}

/** 判斷下一行是否應併入上一行（數學續行、碎標點、物種標記等） */
function shouldMergeBoardContinuation(prev, next) {
  const p = boardPlainText(prev);
  const n = boardPlainText(next);
  if (!p || !n) return false;
  if (/^(反應式|整理得|檢視各選項|檢視|答案|答[：:]|[（(][A-E][)）])/.test(n)) return false;

  if (/^mol/i.test(n)) return true;
  if (/^[。.．,，、；：:）)]$/.test(n)) return true;

  // 「，B」與下一行「分子量」被 AI 拆開
  if (/[，,]\s*[A-Z]$/.test(p) && new RegExp(`^(${CHEM_LABEL_WORDS})`).test(n)) return true;
  if (/\s[A-Z]$/.test(p) && new RegExp(`^(${CHEM_LABEL_WORDS})`).test(n)) return true;

  // 中文敘述未句點結束：僅併入極短算式續行（如「= 4 + x」），不整段併成一行
  if (/[\u4e00-\u9fff]/.test(p) && !/[。.．！？]$/.test(p)) {
    if (n.length <= 28 && (/^[=≠≈<>]/.test(n) || /^\d+\s*[=≠]/.test(n))) return true;
  }

  // 上一行以冒號／等號結尾 + 算式續行
  if (/[：:=]$/.test(p) && (looksLikeMathLine(n) || /\$/.test(n))) return true;

  if (!looksLikeMathLine(n)) return false;

  // 運算式未寫完：上一行以運算符結尾
  if (/[≠≈=<>≤≥：:+×÷*/（(－-]$/.test(p)) return true;

  // 不等號／比之後的結果（例：≠ 1 : 1）
  if (/^[≠≈=<>≤≥]/.test(n) && /[=≠≈：:\d+×÷（(\/]/.test(p)) return true;
  if (/^\d+\s*:\s*\d+/.test(n) && /[=≠≈：:\d+×÷（(\/]/.test(p)) return true;

  // 短數學尾段（例：1 : 1）
  if (n.length <= 8 && /^[\d:：\s.]+$/.test(n) && /[=≠≈]/.test(p)) return true;

  // 連續算式行
  if (looksLikeMathLine(p) && looksLikeMathLine(n)) return true;

  return false;
}

function appendBoardPart(prev, next) {
  const n = String(next || '').trim();
  if (/^[。.．,，、；：:）)]$/.test(n)) return prev + n;
  return `${prev} ${n}`;
}

function shouldMergeSoftFragment(prev, next) {
  const p = boardPlainText(prev);
  const n = boardPlainText(next);
  if (!p || !n || n.length > 20) return false;
  if (/^[（(][A-E][)）]|^\d+\.|^\*\*答/.test(n)) return false;
  if (looksLikeMathLine(n) || shouldMergeBoardContinuation(prev, next)) return false;
  if (/[。.．！？]$/.test(p)) return false;
  if (/^(故|則|所以|因此|由此|又|且|得|為|即)/.test(n)) return true;
  return n.length <= 10 && /^[\u4e00-\u9fff]/.test(n);
}

/** 保留 AI 換行；合併數學續行、碎標點、物種標記等不合理斷行 */
function normalizeBoardBreaks(raw) {
  const chunks = [];
  let s = repairBrokenMathDelimiters(normalizeHtmlDataNotes(String(raw || '').replace(/\r\n/g, '\n')));
  s = splitDenseMathRuns(splitNarrativeMath(insertStepBreaks(wrapBareLatexBlocks(s))));

  s = s.replace(/\$\$[\s\S]*?\$\$/g, m => {
    chunks.push(m);
    return `\x00C${chunks.length - 1}\x00`;
  });

  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/(\d+(?:\.\d+)?)\s*\n\s*mol([。.]?)/gi, '$1 mol$2');
  s = s.replace(/([≠≈=<>≤≥])\s*\n\s*(\d+\s*:\s*\d+[^\n]*)/g, '$1 $2');
  s = s.replace(/([，,]\s*[A-Z])\s*\n\s*(分子量|原子數|莫耳數|莫耳分率|體積|質量|分壓|濃度)/g, '$1 $2');
  s = s.replace(/\n\s*([。.．])\s*(?=\n|$)/g, '$1');

  const lines = s.split('\n');
  const out = [];
  let buf = '';

  const flush = () => {
    const t = buf.replace(/\s{2,}/g, ' ').trim();
    if (t) out.push(t);
    buf = '';
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flush(); continue; }

    if (buf && shouldMergeBoardContinuation(buf, t)) {
      buf = appendBoardPart(buf, t);
      continue;
    }
    if (buf && shouldMergeSoftFragment(buf, t)) {
      buf = appendBoardPart(buf, t);
      continue;
    }
    if (/^\x00C\d+\x00$/.test(t) || /^[（(]\d+[)）]/.test(t) || /^\*\*答[：:]/.test(t)) {
      flush();
      out.push(t);
      continue;
    }

    if (buf) { flush(); }
    buf = t;
  }
  flush();

  s = out.join('\n');
  chunks.forEach((m, i) => { s = s.replace(`\x00C${i}\x00`, m); });
  return repairBrokenMathDelimiters(s);
}

function ensureRenderableInlineMath(tex) {
  if (!tex.startsWith('$') || tex.startsWith('$$')) return tex;
  const inner = tex.slice(1, -1).trim();
  if (!inner || /\\/.test(inner)) return tex;
  if (/[A-Za-z]\s*:\s*[A-Za-z0-9]/.test(inner) && !/\\text|\\mathrm/.test(inner)) {
    const body = inner.replace(/([A-Za-z0-9])\s*:\s*/g, '$1{:}');
    return `$\\displaystyle ${body}$`;
  }
  return tex;
}

function shouldPromoteDisplayMath(tex) {
  if (tex.startsWith('$$')) return tex;
  const inner = tex.replace(/^\$|\$$/g, '');
  if (/\\begin\{(?:array|aligned|matrix|pmatrix|bmatrix)\}|\\renewcommand|\\setlength/.test(inner)) {
    return `$$${inner.replace(/^\\displaystyle\s*/, '')}$$`;
  }
  const fracCount = (inner.match(/\\dfrac|\\frac/g) || []).length;
  if (fracCount >= 2 && inner.length > 56) return `$$${inner}$$`;
  if (inner.length > 84 && /[=≈]/.test(inner)) return `$$${inner}$$`;
  return tex;
}

function isFormulaLine(html) {
  if (/math-block--array/.test(html)) return true;
  const plain = boardPlainText(html);
  const chinese = (plain.match(/[\u4e00-\u9fff]/g) || []).length;
  if (/class="math-block/.test(html)) return chinese <= 10;
  if (chinese >= 12) return false;
  if (chinese < 4 && /[=≠≈]|\\dfrac|\\frac|\d+\s*:\s*\d+/.test(plain)) return true;
  return false;
}

function needsNowrapLine(html) {
  if (/math-block--array/.test(html)) return false;
  if (narrativeChineseCount(html) >= 8) return false;
  if (/class="math-block/.test(html)) return true;
  if (/\$[^$]+\$/.test(html) && narrativeChineseCount(html) < 4) return true;
  const plain = boardPlainText(html);
  return /[=≠≈]|\\dfrac|\\frac|\d+\s*:\s*\d+/.test(plain) && narrativeChineseCount(html) < 6;
}

function hasBoardMath(html) {
  return /class="math-block|\$[^$]+\$/.test(html);
}

function boardLineOpts(html) {
  const chinese = narrativeChineseCount(html);
  const math = hasBoardMath(html);
  const plain = boardPlainText(html);
  const mathCount = (html.match(/\$[^$]+\$/g) || []).length;
  const formula = isFormulaLine(html) || (math && chinese < 5);
  const scroll = plain.length > 42 || mathCount >= 2 || (math && plain.length > 32);
  const nowrap = (formula && needsNowrapLine(html)) || scroll;
  return { formula, nowrap, scroll };
}

function splitDenseBoardPart(html) {
  const plain = boardPlainText(html);
  const mathCount = (html.match(/\$[^$]+\$/g) || []).length;
  if (plain.length < 56 && mathCount < 2) return [html];

  const pieces = html.split(/(?=<div class="math-block)|(?<=\$[^$]+\$)/).filter(Boolean);
  if (pieces.length >= 2) {
    return pieces.map(p => p.trim()).filter(Boolean);
  }
  if (narrativeChineseCount(html) < 4 && mathCount >= 2) return [html];

  const lines = plain.split(/\s*(?=[wW]_[A-Z]\s*=|代入|由上述|故|則|因此|所以)/).filter(s => s.trim());
  if (lines.length > 1) return lines;
  return [html];
}

function toBoardLineHtml(part, opts = {}) {
  const trimmed = String(part || '').replace(/<br\s*\/?>/gi, ' ').trim();
  if (!trimmed) return '';
  const formula = !!opts.formula;
  const nowrap = !!opts.nowrap;
  const scroll = !!opts.scroll;
  const hasMath = hasBoardMath(trimmed);
  const cls = [
    'board-line',
    formula ? 'board-line--formula' : '',
    nowrap ? 'board-line--nowrap' : '',
    scroll ? 'board-line--scroll' : '',
    hasMath ? 'board-line--has-math' : ''
  ].filter(Boolean).join(' ');
  return `<div class="${cls}"><div class="board-line-inner">${trimmed}</div></div>`;
}

function mergeBoardParts(parts) {
  const merged = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (merged.length && shouldMergeBoardContinuation(merged[merged.length - 1], t)) {
      merged[merged.length - 1] = appendBoardPart(merged[merged.length - 1], t);
      continue;
    }
    if (merged.length && shouldMergeSoftFragment(merged[merged.length - 1], t)) {
      merged[merged.length - 1] = appendBoardPart(merged[merged.length - 1], t);
      continue;
    }
    merged.push(t);
  }
  return merged;
}

function wrapBoardLines(html) {
  const parts = mergeBoardParts(html.split(/<br\s*\/?>/i));
  const out = [];
  let i = 0;

  while (i < parts.length) {
    const trimmed = parts[i];
    const subqMatch = trimmed.match(/^[（(](\d+)[)）]\s*(.*)$/s);
    if (subqMatch) {
      const bodyParts = [];
      if (subqMatch[2]?.trim()) bodyParts.push(subqMatch[2]);
      i++;
      while (i < parts.length
        && !/^[（(]\d+[)）]/.test(parts[i])
        && !parts[i].includes('class="answer-box"')
        && !parts[i].includes('class="anno-hint"')) {
        bodyParts.push(parts[i]);
        i++;
      }
      const body = bodyParts.map(p => toBoardLineHtml(p, boardLineOpts(p))).join('');
      out.push(`<div class="subq-block"><div class="subq-label">(${subqMatch[1]})</div>${body ? `<div class="subq-content">${body}</div>` : ''}</div>`);
      continue;
    }

    const chemMatch = trimmed.match(/^\(([A-E])\)\s*(.*)$/s);
    if (chemMatch) {
      if (/答[：:]|%|％|^\$?\\?\d/.test(chemMatch[2] || '')) {
        out.push(toBoardLineHtml(trimmed, boardLineOpts(trimmed)));
        i++;
        continue;
      }
      const bodyParts = [];
      if (chemMatch[2]?.trim()) bodyParts.push(chemMatch[2]);
      i++;
      while (i < parts.length
        && !/^\([A-E]\)\s/.test(parts[i])
        && !/^[（(]\d+[)）]/.test(parts[i])
        && !/^\d+\.\s/.test(parts[i].trim())
        && !parts[i].includes('class="answer-box"')
        && !parts[i].includes('class="anno-hint"')
        && !parts[i].includes('class="anno-row"')) {
        bodyParts.push(parts[i]);
        i++;
      }
      const bodyMerged = mergeBoardParts(bodyParts).join(' ');
      const body = bodyMerged ? toBoardLineHtml(bodyMerged, boardLineOpts(bodyMerged)) : '';
      out.push(`<div class="chem-row"><span class="chem-label">(${chemMatch[1]})</span><div class="chem-content">${body}</div></div>`);
      continue;
    }
    if (trimmed.includes('class="answer-box"') || trimmed.includes('class="anno-hint"') || trimmed.includes('class="anno-row"')) {
      out.push(trimmed);
      i++;
      continue;
    }
    for (const piece of splitDenseBoardPart(trimmed)) {
      out.push(toBoardLineHtml(piece, boardLineOpts(piece)));
    }
    i++;
    continue;
  }
  return out.join('');
}

/** solve.html 同款 + 直式分式（\\dfrac） */
function enhanceMathSolve(tex) {
  let t = normalizeHtmlDataNotes(String(tex || ''))
    .replace(/\\frac\b/g, '\\dfrac')
    .replace(/\\tfrac\b/g, '\\dfrac');
  t = fixSlashFractions(t);
  const isInline = t.startsWith('$') && !t.startsWith('$$');
  if (isInline && /\\dfrac/.test(t) && !/\\displaystyle/.test(t) && !/\\begin\{/.test(t)) {
    t = t.replace(/^\$/, '$\\displaystyle ');
  }
  return t;
}

/** 移除行尾未配對的 $（AI 常多打一個） */
function stripStrayLineEndDollars(raw) {
  return String(raw || '').replace(/^(.*)$/gm, line => {
    if (!line.trim() || /\x00M\d+\x00/.test(line)) return line;
    let s = line;
    while (/\$(\s*)$/.test(s) && (s.match(/\$/g) || []).length % 2 === 1) {
      s = s.replace(/\$(\s*)$/, '$1');
    }
    return s;
  });
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches;
}

/** 手機：每個「。」後斷成獨立 plain-line（保護數學／註解佔位符） */
function splitPlainTextAtPeriod(text) {
  return String(text || '').split('\n').map(line => {
    if (!line.trim()) return line;
    let out = '';
    for (let i = 0; i < line.length; i++) {
      const placeholder = line.slice(i).match(/^(\x00[MA]\d+\x00)/);
      if (placeholder) {
        out += placeholder[1];
        i += placeholder[1].length - 1;
        continue;
      }
      out += line[i];
      if (line[i] === '。') {
        let j = i + 1;
        while (j < line.length && line[j] === ' ') j++;
        if (j < line.length) out += '\n';
      }
    }
    return out;
  }).join('\n');
}

/** 每行獨立區塊 + 固定行距（類 Word，行高不影響行與行之間隔） */
function wrapPlainLines(html) {
  return String(html || '').split('\n').map(line => {
    if (!line.trim()) return '<div class="plain-line plain-line--empty"></div>';

    if (typeof wrapPlainLineAsChoices === 'function') {
      const choiceHtml = wrapPlainLineAsChoices(line);
      if (choiceHtml) return choiceHtml;
    }

    let cleaned = line;
    if (!/\x00M\d+\x00/.test(cleaned)) {
      while (/\$(\s*)$/.test(cleaned) && (cleaned.match(/\$/g) || []).length % 2 === 1) {
        cleaned = cleaned.replace(/\$(\s*)$/, '$1');
      }
    }
    return `<div class="plain-line"><div class="plain-line-inner">${cleaned}</div></div>`;
  }).join('');
}

/** 對齊 solve.html 的 render()：先保護數學式、再 esc／分行 */
function renderSolveStyle(raw) {
  const { body: rawBody, answerText } = extractPlainAnswer(raw);
  const math = [];
  const mathPattern = /(\$\$[\s\S]+?\$\$|\$\\begin\{(?:array|aligned|matrix|pmatrix|bmatrix)\}[\s\S]+?\\end\{(?:array|aligned|matrix|pmatrix|bmatrix)\}\$|\$[^$\n]+?\$)([。；，、,.])?/g;
  let s = wrapBareLatexBlocks(repairBrokenMathDelimiters(
    stripStrayLineEndDollars(
      (typeof mergeOrphanUnitLines === 'function' ? mergeOrphanUnitLines : raw => raw)(
        String(rawBody || '').replace(/\r\n/g, '\n')
      )
    )
  ));

  s = s.replace(mathPattern, (m, formula, punct = '') => {
    const enhanced = enhanceMathSolve(formula);
    if (typeof splitPlainReactionArray === 'function') {
      const stacked = splitPlainReactionArray(enhanced);
      if (stacked) {
        math.push(`${stacked}${punct}`);
        return `\x00M${math.length - 1}\x00`;
      }
    }
    const safeMath = enhanced.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isInline = enhanced.startsWith('$') && !enhanced.startsWith('$$');
    const fracCount = (enhanced.match(/\\dfrac|\\over/g) || []).length;
    const needsBlock = isInline && (
      /\\begin\{array\}|\\begin\{aligned\}/.test(enhanced) ||
      fracCount >= 2 ||
      (fracCount >= 1 && enhanced.length > 95)
    );
    math.push(needsBlock ? `<div class="math-block">${safeMath}${punct}</div>` : `${safeMath}${punct}`);
    return `\x00M${math.length - 1}\x00`;
  });

  const annos = [];
  let hasAnno = false;
  s = s.replace(/^@注\[(.+)\][ \t]*$/gm, (_, inner) => {
    annos.push(renderAnnoRow(inner));
    hasAnno = true;
    return `\x00A${annos.length - 1}\x00`;
  });

  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(<strong>答[：:][^<]*<\/strong>)/g, '');
  s = s.replace(/^\s*答[：:][^\n]*$/gm, '');
  if (isMobileViewport()) s = splitPlainTextAtPeriod(s);
  s = wrapPlainLines(s);
  math.forEach((m, i) => { s = s.replace(`\x00M${i}\x00`, m); });
  annos.forEach((html, i) => { s = s.replace(`\x00A${i}\x00`, html); });
  if (hasAnno) s = '<div class="anno-hint">點擊標籤查看意義</div>' + s;
  const answerHtml = buildAnswerBoxHtml(answerText);
  return `<div class="ai-plain">${s}</div>${answerHtml}`;
}

function renderPlain(raw) {
  return renderSolveStyle(raw);
}

function render(raw) {
  if (!BOARD_LAYOUT_ENABLED) return renderPlain(raw);
  const withArrows = ensureReactionArrows(raw);
  const extracted = extractAnswerLine(withArrows);
  const normalized = normalizeBoardBreaks(normalizeUnicodeIonCharges(extracted.body));
  const math = [];
  const mathPattern = /(\$\$[\s\S]+?\$\$|\$\\begin\{(?:array|aligned|matrix|pmatrix|bmatrix)\}[\s\S]+?\\end\{(?:array|aligned|matrix|pmatrix|bmatrix)\}\$|\$[^$\n]+?\$)([。；，、,.])?/g;
  let s = normalized.replace(mathPattern, (m, formula, punct = '') => {
    const promoted = ensureDisplayMath(shouldPromoteDisplayMath(enhanceMath(formula)));
    const enhanced = promoted;
    const safeMath = enhanced.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isDisplay = enhanced.startsWith('$$');
    const isArray = /\\begin\{(?:array|aligned)/.test(enhanced);
    const needsBlock = isDisplay || isArray;
    const blockClass = isArray ? 'math-block math-block--array' : 'math-block';
    math.push(needsBlock ? `<div class="${blockClass}">${safeMath}${punct}</div>` : `${safeMath}${punct}`);
    return `\x00M${math.length - 1}\x00`;
  });

  const annos = [];
  let hasAnno = false;
  s = s.replace(/^@注\[(.+)\][ \t]*$/gm, (_, inner) => {
    annos.push(renderAnnoRow(inner));
    hasAnno = true;
    return `\x00A${annos.length - 1}\x00`;
  });

  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(<strong>答[：:].*?<\/strong>)/g, '<div class="answer-box">$1</div>');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(mol)([。.]?)/gi,
    (_, n, _mol, punct) => `$\\displaystyle ${n}\\,\\mathrm{mol}$${punct}`);
  s = s.replace(/\n/g, '<br>');
  math.forEach((m, i) => { s = s.replace(`\x00M${i}\x00`, m); });
  s = s.replace(/(\$[^$]+\$)\s*(mol)([。.]?)/gi,
    (_, math, _mol, punct) => `${math}$\\displaystyle \\mathrm{mol}$${punct}`);
  s = s.replace(/(<div class="math-block[^"]*">[\s\S]*?<\/div>)\s*(mol)([。.]?)/gi,
    (_, block, _mol, punct) => `${block}$\\displaystyle \\mathrm{mol}$${punct}`);
  s = s.replace(/(<div class="math-block[^"]*">[\s\S]*?<\/div>)(\s*[≠≈=<>≤≥]\s*[^<\n]+)/g,
    '$1<span class="board-math-tail">$2</span>');
  s = s.replace(/(\d+\s*:\s*\d+[^<\n]*?)(\s*[。.．])(?=<br|$)/g,
    '<span class="board-math-tail">$1$2</span>');
  annos.forEach((html, i) => { s = s.replace(`\x00A${i}\x00`, html); });
  if (hasAnno) s = '<div class="anno-hint">點擊標籤查看意義</div>' + s;
  const answerHtml = extracted.answer
    ? `<div class="answer-box">${esc(extracted.answer)}</div>`
    : '';
  return wrapBoardLines(s) + answerHtml;
}

function ensureMathNotePopover() {
  let pop = document.getElementById('mathNotePopover');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'mathNotePopover';
    pop.className = 'math-note-popover';
    document.body.appendChild(pop);
  }
  return pop;
}

function hideMathNote() {
  document.querySelectorAll('.math-note.active').forEach(el => el.classList.remove('active'));
  ensureMathNotePopover().classList.remove('show');
}

function showMathNote(el) {
  const pop = ensureMathNotePopover();
  const note = el.dataset.note || el.getAttribute('data-note') || el.getAttribute('note');
  if (!note) return;
  document.querySelectorAll('.math-note.active').forEach(item => {
    if (item !== el) item.classList.remove('active');
  });
  el.classList.add('active');
  pop.textContent = note;
  pop.classList.add('show');
  const rect = el.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - popRect.width / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - popRect.width - 12));
  let top = rect.top - popRect.height - 10;
  if (top < 12) top = rect.bottom + 10;
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

function inferNoteFromKatexEl(el) {
  const txt = (el.textContent || '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(txt)) return null;
  if (el.getAttribute('data-note') || el.hasAttribute('note')) return null;

  const katexRoot = el.closest('.katex');
  const lineText = el.closest('.board-line-inner')?.innerText || '';
  const formulaText = katexRoot?.textContent || '';

  let prev = '';
  let node = el.previousElementSibling;
  for (let i = 0; i < 5 && node; i++) {
    prev = (node.textContent || '') + prev;
    node = node.previousElementSibling;
  }
  let next = '';
  node = el.nextElementSibling;
  for (let i = 0; i < 5 && node; i++) {
    next += node.textContent || '';
    node = node.nextElementSibling;
  }

  const mfrac = el.closest('.mfrac');
  if (mfrac) {
    const top = mfrac.querySelector('.vlist-t');
    const bot = mfrac.querySelector('.vlist-b');
    const inTop = top?.contains(el);
    const partText = inTop ? (top?.textContent || '') : (bot?.textContent || '');
    if (txt === '53.2') return '題目給的碳質量百分比';
    if (txt === '12' && /53/.test(partText)) return '碳的原子量';
    if (txt === '100' && inTop && /130|88|y|碳/.test(lineText + partText)) return '混合物總質量';
    if (txt === '130' && !inTop) return '甲酸戊酯分子量';
    if (txt === '88' && !inTop) return '乙酸乙酯分子量';
    if (txt === '2' && inTop && /16|氧|氫|w_/.test(lineText)) return '氫氧原子數比中的氫';
    if (txt === '16' && !inTop && /氧|w_/.test(lineText)) return '氧的原子量';
    if (txt === '1' && inTop && /8|w_/.test(lineText)) return '氫佔氧質量的換算係數';
    if (txt === '8' && !inTop && /氧|w_/.test(lineText)) return '氫氧總量比的分母';
    if (txt === '9' && !inTop && /氧|w_/.test(lineText)) return '氫氧總量比總份數';
    const partNote = inferFractionPartNote(lineText, inTop ? 'top' : 'bot', partText);
    return partNote || null;
  }

  const context = `${lineText} ${formulaText}`;
  if (/分子量/.test(context) && /[×+]/.test(context)) {
    if (['4', '8', '2', '6', '12'].includes(txt) && /[×]/.test(next)) return '分子式中的原子個數';
    if (txt === '12') return '碳的原子量';
    if (txt === '1') return '氫的原子量';
    if (txt === '16') return '氧的原子量';
    if (txt === '88') return '乙酸乙酯分子量';
    if (txt === '130') return '甲酸戊酯分子量';
  }
  if (txt === '100' && /混合物|總重|總質量/.test(context)) return '混合物總質量';
  if (txt === '53.2') return '題目給的碳質量';
  if (txt === '4.433') return '碳原子莫耳數';
  if (txt === '97.526') return '移項整理後的常數項';
  if (txt === '2.474') return '解出的 y 值';
  if (txt === '46.8') return '氧的重量百分比';
  if (txt === '41.6') return '氫氧原子數比換算結果';
  if (txt === '88') return '乙酸乙酯分子量';
  if (txt === '130') return '甲酸戊酯分子量';
  if (txt === '22') return '每莫耳含 22 mol 原子';

  if (txt === '1' && (/×/.test(prev) || /\\times/.test(formulaText)) && (/P_|分壓|K_p/.test(formulaText) || /分壓/.test(lineText))) {
    return '總壓';
  }
  if (/×/.test(prev) && /原子數/.test(lineText)) return '每分子原子數';
  if (/×/.test(prev) && /分子數/.test(lineText)) return '每分子原子數';
  if (/莫耳數/.test(lineText) && /=/.test(lineText) && txt === '1') return '莫耳數';
  if (/分子數/.test(lineText) && /=/.test(formulaText) && (txt === '2' || txt === '1')) return '分子數';
  if (txt === '0.082') return '氣體常數R';
  if (txt === '22.4') return '莫耳體積';
  if (txt === '96500') return '法拉第常數';
  if (txt === '2.4' && /密度|g\/L|M_\{avg\}/.test(lineText + formulaText)) return '密度';
  if (txt === '92' && /取|最小公倍數|質量/.test(lineText)) return '總質量';
  if ((txt === '30' || txt === '46') && /分子量/.test(lineText)) return '分子量';
  if (txt === '0.5' && /K_p|分壓/.test(formulaText + lineText)) return '平衡常數';
  if (/≈|=$/.test(prev) || /=/.test(prev)) {
    if (/w_[A-Z]/.test(lineText)) return '重量百分比計算結果';
    return '計算結果';
  }

  if (/莫耳數/.test(lineText) && txt === '1') return '莫耳數';
  if (/原子數/.test(lineText) && /[×]/.test(prev)) return '每分子原子數';

  return null;
}

function inferFractionPartNote(lineText, part, blockText) {
  const t = String(lineText || '');
  const bt = String(blockText || '').trim();
  if (/100\s*[−-]\s*130\s*y|100−130y|100-130y/.test(bt) || /碳原子方程式|聯立方程式|代入碳原子/.test(t)) {
    return part === 'top' ? '乙酸乙酯剩餘質量' : '乙酸乙酯分子量';
  }
  if (/53\.2/.test(bt) && /12/.test(bt)) {
    return part === 'top' ? '碳的總質量' : '碳的原子量';
  }
  if (/2/.test(bt) && /16/.test(bt) && /氧|氫/.test(t)) {
    return part === 'top' ? '每分子含氧原子數' : '氧的原子量';
  }
  if (/1/.test(bt) && /8/.test(bt) && /氧|氫/.test(t)) {
    return part === 'top' ? '氫氧原子數比中的氫' : '氫氧原子數比換算分母';
  }
  if (/8/.test(bt) && /9/.test(bt) && /氧|氫/.test(t)) {
    return part === 'top' ? '氫氧原子數比中的氫' : '氫氧原子數比總份數';
  }
  if (/莫耳數|分子數|原子數/.test(t) && /分子量|質量/.test(t)) {
    return part === 'top' ? '總質量' : '分子量';
  }
  if (/混合|稀釋/.test(t)) {
    return part === 'top' ? '取用體積' : '混合後總體積';
  }
  if (/反應速率|反應速度|速率/.test(t) || /\bv\s*=/.test(t)) {
    if (part === 'bot') return '時間（秒）';
    if (part === 'top') return '濃度變化量';
  }
  if (/Δ\s*\[|Δ\[/.test(t) && part === 'top') return '濃度變化量';
  return null;
}

function inferWholeFractionNote(lineText, blockText) {
  const t = `${lineText} ${blockText}`;
  if (/100\s*[−-]\s*130\s*y|100−130y|100-130y/.test(t)) return '乙酸乙酯莫耳數';
  if (/53\.2/.test(t) && /12/.test(t)) return '碳原子莫耳數';
  if (/2/.test(t) && /16/.test(t) && /氧|氫/.test(t)) return '氧原子量換算比';
  if (/8/.test(t) && /9/.test(t) && /氧|氫/.test(t)) return '氫在氫氧總量中的比例';
  if (/莫耳數/.test(t)) return '莫耳數換算式';
  if (/分子數|原子數/.test(t)) return '粒子數換算式';
  if (/百分比|%/.test(t)) return '百分比換算式';
  return '';
}

function annotateFractionParts(root) {
  root.querySelectorAll('.katex .mfrac').forEach(mfrac => {
    const lineText = mfrac.closest('.board-line-inner')?.innerText || '';
    const wholeNote = inferWholeFractionNote(lineText, mfrac.textContent || '');
    if (wholeNote) {
      mfrac.dataset.note = wholeNote;
      mfrac.classList.add('math-note');
    }
    mfrac.querySelectorAll('.vlist-t .mord, .vlist-b .mord').forEach(m => {
      if (m.closest('.msupsub') || m.dataset.note) return;
      const note = inferNoteFromKatexEl(m);
      if (!note) return;
      m.dataset.note = note;
      m.classList.add('math-note');
    });
  });
}

function isPartOfSciNotation(el) {
  if (!el?.classList?.contains('mord')) return false;
  const t = (el.textContent || '').trim();
  if (t === '1') {
    const mid = el.nextElementSibling;
    const sup = mid?.nextElementSibling;
    return mid?.classList.contains('mord') && mid.textContent.trim() === '0'
      && sup?.classList.contains('msupsub') && /^-?\d+$/.test(sup.textContent.trim());
  }
  if (t === '0') {
    const lead = el.previousElementSibling;
    const sup = el.nextElementSibling;
    return lead?.classList.contains('mord') && lead.textContent.trim() === '1'
      && sup?.classList.contains('msupsub') && /^-?\d+$/.test(sup.textContent.trim());
  }
  return false;
}

function inferSciNotationNote(exp, lineText) {
  const e = String(exp || '').trim();
  if (/K_|平衡常數|K_a|K_b|K_{?a}?|K_{?b}?|K_{?sp}?|K_w|K_p/.test(lineText)) {
    return `平衡常數：10${e}`;
  }
  if (/\[H|\[OH|濃度|pH/.test(lineText)) return `濃度（科學記號 10${e}）`;
  return `科學記號 10${e}`;
}

function wrapScientificNotationGroups(root) {
  root.querySelectorAll('.katex .base').forEach(base => {
    const nodes = [...base.children];
    for (let i = 0; i < nodes.length - 2; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const c = nodes[i + 2];
      if (!a?.classList.contains('mord') || !b?.classList.contains('mord')) continue;
      if (!c?.classList.contains('msupsub')) continue;
      if (a.textContent.trim() !== '1' || b.textContent.trim() !== '0') continue;
      const exp = c.textContent.trim();
      if (!/^-?\d+$/.test(exp)) continue;
      if (a.closest('.math-note--sci')) continue;

      a.classList.remove('math-note', 'active');
      b.classList.remove('math-note', 'active');
      a.removeAttribute('data-note');
      b.removeAttribute('data-note');

      const lineText = base.closest('.board-line-inner')?.innerText || '';
      const wrap = document.createElement('span');
      wrap.className = 'math-note math-note--sci';
      wrap.dataset.note = inferSciNotationNote(exp, lineText);
      base.insertBefore(wrap, a);
      wrap.append(a, b, c);
      i += 2;
    }
  });
}

function annotateOrphanKatexNumbers(root) {
  root.querySelectorAll('.katex .mord, .katex .mord.mathnormal').forEach(el => {
    if (isPartOfSciNotation(el)) return;
    if (el.closest('.mfrac')) return;
    if (el.closest('[data-note], [note]')) return;
    if (el.getAttribute('data-note') || el.classList.contains('math-note')) return;
    const note = inferNoteFromKatexEl(el);
    if (!note) return;
    el.setAttribute('data-note', note);
    el.classList.add('math-note');
  });
  root.querySelectorAll('.katex [data-note-from], .katex [data-note]').forEach(el => {
    const note = el.getAttribute('data-note-from') || el.getAttribute('data-note');
    if (!note) return;
    el.dataset.note = note;
    el.classList.add('math-note');
  });
  annotateFractionParts(root);
  wrapScientificNotationGroups(root);
}

function recoverUnrenderedHtmlDataNotes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/\\htmlData\{note=[^}]+\}\{[^}]+\}/.test(node.nodeValue || '')) {
      targets.push(node);
    }
  }

  for (const node of targets) {
    const text = node.nodeValue || '';
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(/\\htmlData\{note=([^}]+)\}\{([^}]+)\}/g, (m, note, body, offset) => {
      if (offset > last) frag.append(document.createTextNode(text.slice(last, offset)));
      const span = document.createElement('span');
      span.className = 'math-note';
      span.dataset.note = note.trim();
      span.textContent = body.trim();
      frag.append(span);
      last = offset + m.length;
      return m;
    });
    if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
    node.parentNode?.replaceChild(frag, node);
  }

  root.querySelectorAll('.board-line-inner').forEach(inner => {
    for (const node of [...inner.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const val = node.nodeValue || '';
      if (/\\(?:dfrac|displaystyle|frac|times|approx|htmlData|begin\{)/.test(val)) continue;
      node.nodeValue = val
        .replace(/\$/g, '')
        .replace(/\\rightarrow/g, '→')
        .replace(/\\rightleftharpoons/g, '⇌')
        .replace(/\\times/g, '×')
        .replace(/\\text\{([^}]+)\}/g, '$1');
    }
  });
}

function initMathNotes(root) {
  const mark = el => {
    const note = el.getAttribute('data-note') || el.getAttribute('note');
    if (!note) return;
    el.dataset.note = note;
    el.classList.add('math-note');
  };

  root.querySelectorAll('[data-note], [note]').forEach(mark);
  root.querySelectorAll('.katex [data-note], .katex [note]').forEach(mark);

  if (!root._mathNoteClickBound) {
    root._mathNoteClickBound = true;
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-note], [note], .math-note, .katex [data-note]');
      if (!el || !root.contains(el)) return;
      const note = el.dataset.note || el.getAttribute('data-note') || el.getAttribute('note');
      if (!note) return;
      e.stopPropagation();
      e.preventDefault();
      const wasActive = el.classList.contains('active');
      hideMathNote();
      if (!wasActive) showMathNote(el);
    });
  }
}

let activePanDrag = null;

function ensureBoardPanGlobals() {
  if (window._boardPanGlobalsReady) return;
  window._boardPanGlobalsReady = true;
  window.addEventListener('mousemove', e => {
    if (!activePanDrag) return;
    const dx = e.clientX - activePanDrag.startX;
    if (Math.abs(dx) > 3) activePanDrag.moved = true;
    activePanDrag.inner.scrollLeft = activePanDrag.scrollStart - dx;
  });
  window.addEventListener('mouseup', () => {
    if (!activePanDrag) return;
    const { line, moved } = activePanDrag;
    line.classList.remove('is-panning');
    if (moved) line.dataset.suppressClick = '1';
    setTimeout(() => { delete line.dataset.suppressClick; }, 0);
    activePanDrag = null;
  });
}

function initBoardLinePan(root) {
  ensureBoardPanGlobals();
  root.querySelectorAll('.board-line-inner').forEach(inner => {
    if (inner.dataset.panInit) return;
    inner.dataset.panInit = '1';
    const line = inner.parentElement;
    if (!line) return;

    const refresh = () => {
      const parent = inner.parentElement;
      const scrollable = parent?.classList.contains('board-line--nowrap')
        || parent?.classList.contains('board-line--scroll');
      const overflow = inner.scrollWidth > inner.clientWidth + 2;
      inner.classList.toggle('can-pan', scrollable && overflow);
    };
    refresh();
    requestAnimationFrame(refresh);
    setTimeout(refresh, 80);
    setTimeout(refresh, 320);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => refresh());
      ro.observe(inner);
      inner._panResizeObserver = ro;
    }

    inner.addEventListener('mousedown', e => {
      if (e.target.closest('.math-note, [data-note], [note], .katex [data-note]')) return;
      if (e.button !== 0 || !inner.classList.contains('can-pan')) return;
      activePanDrag = {
        inner,
        line,
        startX: e.clientX,
        scrollStart: inner.scrollLeft,
        moved: false
      };
      line.classList.add('is-panning');
    });

    inner.addEventListener('wheel', e => {
      if (!inner.classList.contains('can-pan')) return;
      if (inner.scrollWidth <= inner.clientWidth + 2) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY !== 0) {
        inner.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  });

  if (!root._suppressNoteOnPan) {
    root._suppressNoteOnPan = true;
    root.addEventListener('click', e => {
      const line = e.target.closest('.board-line');
      if (line?.dataset.suppressClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }
}

function adjustReactionTableSpacing(root) {
  root.querySelectorAll('.math-block--array .katex .arrayrow').forEach(row => {
    const hasFrac = !!row.querySelector('.mfrac');
    if (!hasFrac) return;
    row.classList.add('arrayrow--frac');
    row.querySelectorAll('.mfrac .vlist-t').forEach(node => {
      node.style.paddingTop = '0.28em';
    });
    row.querySelectorAll('.mfrac .vlist-b').forEach(node => {
      node.style.paddingBottom = '1.05em';
    });
    row.querySelectorAll('.mfrac .frac-line').forEach(node => {
      node.style.marginTop = '0.14em';
      node.style.marginBottom = '0.16em';
    });
    const next = row.nextElementSibling;
    if (next?.classList?.contains('arrayrow')) {
      next.classList.add('arrayrow--after-frac');
    }
  });
  root.querySelectorAll('.math-block--array .katex td.hline, .math-block--array .katex .hline').forEach(td => {
    td.style.paddingTop = '0.55em';
    td.style.paddingBottom = '0.35em';
    td.style.borderTopWidth = '0.075em';
  });
  root.querySelectorAll('.math-block--array .katex .mfrac .frac-line').forEach(line => {
    line.style.borderBottomWidth = '0.075em';
  });
}

function retryBareLatexLines(root, opts) {
  root.querySelectorAll('.board-line-inner').forEach(inner => {
    if (inner.querySelector('.katex')) return;
    const raw = (inner.textContent || '').trim();
    if (!/\\(?:dfrac|displaystyle|frac|times|approx)/.test(raw)) return;
    const fixed = repairBrokenMathDelimiters(raw);
    if (fixed === raw && !/^\$/.test(raw)) return;
    inner.textContent = fixed;
    try {
      renderMathInElement(inner, opts);
    } catch (_) { /* ignore */ }
  });
}

function fixKatexErrors(root) {
  root.querySelectorAll('.katex-error').forEach(errEl => {
    const raw = (errEl.textContent || '').trim();
    if (!/\\begin\{(?:array|aligned)|\\renewcommand|\\setlength/.test(raw)) return;
    const katexWrap = errEl.closest('.katex');
    const line = errEl.closest('.board-line-inner');
    if (!katexWrap || !line) return;
    const fixed = `$$${raw.replace(/^\\displaystyle\s*/, '')}$$`;
    const holder = document.createElement('div');
    holder.className = 'math-block math-block--array';
    holder.textContent = fixed;
    katexWrap.replaceWith(holder);
    try {
      renderMathInElement(holder, {
        delimiters: [{ left: '$$', right: '$$', display: true }],
        throwOnError: false,
        trust: ctx => ctx.command === '\\htmlData',
        macros: { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' }
      });
    } catch (_) { /* ignore */ }
  });
}

function wrapPlainMathScroll(root) {
  if (!root) return;
  const containers = root.querySelectorAll(
    '.ai-plain .plain-line-inner, .ai-plain .choice-body'
  );
  containers.forEach(inner => {
    const toWrap = [];
    inner.querySelectorAll('.reaction-table-stacked, .math-unit-tail, .math-block, .katex-display').forEach(el => {
      if (!el.closest('.plain-math-scroll')) toWrap.push(el);
    });
    inner.querySelectorAll('span.katex').forEach(el => {
      if (el.closest('.plain-math-scroll, .math-block, .math-unit-tail, .reaction-table-stacked, .katex-display')) return;
      toWrap.push(el);
    });
    toWrap.sort((a, b) => {
      const pos = a.compareDocumentPosition(b);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    for (const el of toWrap) {
      if (!el.parentNode || el.closest('.plain-math-scroll')) continue;
      const wrap = document.createElement('span');
      const isBlock = el.classList.contains('math-block')
        || el.classList.contains('reaction-table-stacked')
        || el.classList.contains('katex-display');
      wrap.className = isBlock ? 'plain-math-scroll plain-math-scroll--block' : 'plain-math-scroll';
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
    }
  });
}

function doKaTeX(el, { plain = !BOARD_LAYOUT_ENABLED } = {}) {
  if (typeof renderMathInElement !== 'function') return;
  const opts = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    trust: context => context.command === '\\htmlData',
    macros: { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' }
  };
  try {
    renderMathInElement(el, opts);
    if (plain) {
      if (typeof adjustPlainReactionTables === 'function') adjustPlainReactionTables(el);
      if (typeof stripStrayDollarsInPlain === 'function') stripStrayDollarsInPlain(el);
      if (typeof keepMathUnitTails === 'function') keepMathUnitTails(el);
      wrapPlainMathScroll(el);
      recoverUnrenderedHtmlDataNotes(el);
      initMathNotes(el);
      return;
    }
    adjustReactionTableSpacing(el);
    retryBareLatexLines(el, opts);
    fixKatexErrors(el);
    recoverUnrenderedHtmlDataNotes(el);
    adjustReactionTableSpacing(el);
    annotateOrphanKatexNumbers(el);
    initMathNotes(el);
    initBoardLinePan(el);
  } catch (err) {
    console.error('KaTeX 渲染失敗', err);
  }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.anno-badge')) {
    document.querySelectorAll('.anno-badge.active').forEach(b => b.classList.remove('active'));
  }
  if (!e.target.closest('.math-note') && !e.target.closest('.math-note-popover')) {
    hideMathNote();
  }
});
