/**
 * js/math-note/math-note.js — 數學 NOTE（\htmlData）前處理、點擊 popover、KaTeX 後處理
 */
(function () {
  'use strict';

  const KATEX_TRUST = (ctx) => ctx.command === '\\htmlData' || ctx.command === '\\htmlClass';
  const KATEX_MACROS = { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' };

  /** 白話語意 NOTE：整段式子不拆分子分母 */
  const SEMANTIC_NOTE_RE = /比例|分率|剩餘|因子|影響|轉化|排泄|衰變|清除|分壓|莫耳分率|速率影響|對.*影響|後剩|體內|半衰|濃度對|溫度對/;

  let popoverEl = null;

  function getPopover() {
    if (!popoverEl) {
      popoverEl = document.createElement('div');
      popoverEl.className = 'math-note-popover';
      document.body.appendChild(popoverEl);
    }
    return popoverEl;
  }

  function hidePopover() {
    if (popoverEl) popoverEl.classList.remove('show');
    document.querySelectorAll('.active[data-note], .math-note.active').forEach((el) => {
      el.classList.remove('active');
    });
  }

  function parseHtmlDataNote(raw) {
    return String(raw || '').replace(/^note\s*[=：:]\s*/i, '').trim();
  }

  function isSemanticNote(noteText) {
    const n = parseHtmlDataNote(noteText);
    if (!n) return false;
    if (/^整體[:：]/.test(n)) return true;
    if (/分子|分母|式量|質量/.test(n) && !SEMANTIC_NOTE_RE.test(n)) return false;
    return SEMANTIC_NOTE_RE.test(n) || n.length >= 4;
  }

  function isComplexNoteBody(body) {
    const b = String(body || '');
    return /\\(?:d)?frac|\\left|\\right|\^|_\{/.test(b);
  }

  function closeBraceIndex(str, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /** 逐段解析 \\htmlData{attr}{body}（支援巢狀大括號） */
  function forEachHtmlData(text, fn) {
    const s = String(text || '');
    let out = '';
    let i = 0;
    while (i < s.length) {
      const start = s.indexOf('\\htmlData', i);
      if (start < 0) {
        out += s.slice(i);
        break;
      }
      out += s.slice(i, start);
      const attrOpen = s.indexOf('{', start + 9);
      if (attrOpen < 0) {
        out += s.slice(start);
        break;
      }
      const attrClose = closeBraceIndex(s, attrOpen);
      if (attrClose < 0) {
        out += s.slice(start);
        break;
      }
      const bodyOpen = attrClose + 1;
      if (s[bodyOpen] !== '{') {
        out += s.slice(start, attrClose + 1);
        i = attrClose + 1;
        continue;
      }
      const bodyClose = closeBraceIndex(s, bodyOpen);
      if (bodyClose < 0) {
        out += s.slice(start);
        break;
      }
      const attr = s.slice(attrOpen + 1, attrClose);
      const body = s.slice(bodyOpen + 1, bodyClose);
      out += fn(attr, body);
      i = bodyClose + 1;
    }
    return out;
  }

  function unwrapSingleHtmlDataDollars(text) {
    let s = String(text || '');
    let out = '';
    let pos = 0;
    while (pos < s.length) {
      const dOpen = s.indexOf('$', pos);
      if (dOpen < 0) {
        out += s.slice(pos);
        break;
      }
      out += s.slice(pos, dOpen);
      if (s[dOpen + 1] === '$') {
        out += '$';
        pos = dOpen + 1;
        continue;
      }
      const afterD = dOpen + 1;
      const hd = s.indexOf('\\htmlData', afterD);
      if (hd < 0 || hd > dOpen + 80 || !/^\s*\\htmlData/.test(s.slice(afterD, hd + 9))) {
        out += '$';
        pos = dOpen + 1;
        continue;
      }
      const attrOpen = s.indexOf('{', hd + 9);
      const attrClose = closeBraceIndex(s, attrOpen);
      if (attrClose < 0 || s[attrClose + 1] !== '{') {
        out += '$';
        pos = dOpen + 1;
        continue;
      }
      const bodyClose = closeBraceIndex(s, attrClose + 1);
      if (bodyClose < 0) {
        out += '$';
        pos = dOpen + 1;
        continue;
      }
      const tail = s.slice(bodyClose + 1);
      const closeM = tail.match(/^\s*\$/);
      if (!closeM) {
        out += '$';
        pos = dOpen + 1;
        continue;
      }
      out += s.slice(hd, bodyClose + 1);
      pos = bodyClose + 1 + closeM[0].length;
    }
    return out;
  }

  function wrapBareHtmlData(text) {
    let s = unwrapSingleHtmlDataDollars(text);
    return s.split('\n').map((line) => {
      const indent = line.match(/^\s*/)[0];
      const t = line.trim();
      if (!t || /^\$\$/.test(t)) return line;
      if (!/\\htmlData|\\approx|\\dfrac|\\frac/.test(t)) return line;
      const bare = t.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$\n]+\$/g, '');
      if (!/\\htmlData|\\approx|\\dfrac|\\frac/.test(bare)) return line;
      let inner = t;
      inner = forEachHtmlData(inner, (attr, body) => `\\htmlData{${attr}}{${body}}`);
      if (/^\$[^$]+\$$/.test(inner)) return line;
      const stepTail = inner.match(/^(\(\d+\)\s*[^\\=＝≈$]*[：:][^\\=＝≈$]*)(.+)$/);
      if (stepTail && /\\htmlData|\\approx|\\dfrac|\\frac/.test(stepTail[2])) {
        const head = stepTail[1].trimEnd();
        const tail = stepTail[2].trim();
        return tail ? `${indent}${head}\n${indent}$${tail}$` : line;
      }
      if (/^[=＝≈a-zA-Z0-9_+\-×·^()%\\\s.]+$/.test(inner) || (/\\htmlData/.test(inner) && /[=＝≈]/.test(inner))) {
        return `${indent}$${inner}$`;
      }
      return line;
    }).join('\n');
  }

  /** 僅在明確標分子／分母時才拆；語意型整段分數保留 */
  function splitHtmlDataWrappedFractions(text) {
    return forEachHtmlData(text, (attr, body) => {
      const fracM = body.match(/^\\(?:d)?frac\{([^{}]*)\}\{([^{}]*)\}$/);
      if (!fracM) return `\\htmlData{${attr}}{${body}}`;
      const note = parseHtmlDataNote(attr) || '';
      if (isSemanticNote(note) || isComplexNoteBody(body)) {
        return `\\htmlData{${attr}}{${body}}`;
      }
      if (!/分子|分母/.test(note)) return `\\htmlData{${attr}}{${body}}`;
      const numNote = /分母/.test(note) ? note.replace(/分母/g, '分子') : note;
      const denNote = /分子/.test(note) ? note.replace(/分子/g, '分母') : note;
      return `\\dfrac{\\htmlData{note=${numNote}}{${fracM[1]}}}{\\htmlData{note=${denNote}}{${fracM[2]}}}`;
    });
  }

  function normalizeHtmlDataNotes(text) {
    return forEachHtmlData(text, (attr, body) => {
      let a = String(attr || '').trim();
      if (/^note\s*[=：:]/i.test(a)) {
        a = 'note=' + a.replace(/^note\s*[=：:]\s*/i, '');
      } else if (a && !/^note=/i.test(a)) {
        a = `note=${a}`;
      }
      return `\\htmlData{${a}}{${body}}`;
    });
  }

  function createNoteSpan(noteRaw, displayText) {
    const span = document.createElement('span');
    span.className = 'math-note';
    const note = parseHtmlDataNote(noteRaw);
    span.setAttribute('data-note', note);
    if (isSemanticNote(noteRaw) || isComplexNoteBody(displayText)) {
      span.classList.add('math-note--whole');
      span.setAttribute('data-note-scope', 'whole');
    }
    const body = String(displayText || '');
    if (typeof katex !== 'undefined' && /\\|[\^_]/.test(body)) {
      try {
        katex.render(body, span, {
          throwOnError: false,
          strict: 'ignore',
          trust: KATEX_TRUST,
          macros: KATEX_MACROS
        });
        return span;
      } catch (_) { /* fall through */ }
    }
    span.textContent = body;
    return span;
  }

  function isWholeNoteElement(el) {
    if (!el) return false;
    if (el.classList.contains('math-note--whole')) return true;
    if (el.getAttribute('data-note-scope') === 'whole') return true;
    const note = el.getAttribute('data-note') || '';
    if (isSemanticNote(note)) return true;
    if (el.querySelector('.mfrac, .msupsub, .minner, .mopen, .mclose')) return true;
    return isComplexNoteBody(el.textContent || '');
  }

  function promoteFractionNoteParts(root) {
    if (!root) return;
    root.querySelectorAll('.katex .mfrac').forEach((mfrac) => {
      mfrac.querySelectorAll('.vlist-t [data-note], .vlist-t .math-note').forEach((el) => {
        if (!el.closest('[data-note-scope="whole"], .math-note--whole')) {
          el.classList.add('math-note--frac-part');
        }
      });
      mfrac.querySelectorAll('.vlist-b [data-note], .vlist-b .math-note').forEach((el) => {
        if (!el.closest('[data-note-scope="whole"], .math-note--whole')) {
          el.classList.add('math-note--frac-part');
        }
      });
      const outer = mfrac.parentElement?.closest('[data-note]');
      if (!outer || isWholeNoteElement(outer)) return;
      if (outer.querySelector('.mfrac') === mfrac && !outer.querySelector('.math-note--frac-part')) {
        outer.classList.remove('math-note');
        outer.style.background = 'transparent';
        outer.style.borderBottom = 'none';
        outer.style.padding = '0';
      }
    });
  }

  function markWholeExpressionNotes(root) {
    if (!root) return;
    root.querySelectorAll('.katex [data-note], .katex [note], .math-note').forEach((el) => {
      if (!isWholeNoteElement(el)) return;
      el.classList.add('math-note--whole');
      el.setAttribute('data-note-scope', 'whole');
    });
  }

  function ensureKatexFractionsVisible(root) {
    if (!root) return;
    root.querySelectorAll('.katex').forEach((katexEl) => {
      katexEl.style.overflow = 'visible';
      const html = katexEl.querySelector('.katex-html');
      if (html) html.style.overflow = 'visible';
    });
    root.querySelectorAll('.mfrac').forEach((mfrac) => {
      mfrac.style.overflow = 'visible';
    });
  }

  function decorateHtmlDataNotes(root) {
    if (!root) return;
    root.querySelectorAll('[data-note], [note]').forEach((el) => {
      if (el.classList.contains('math-note-popover')) return;
      if (!el.closest('.ai-plain, .board-reply, .board')) return;
      el.classList.add('math-note');
      const note = parseHtmlDataNote(el.getAttribute('data-note') || el.getAttribute('note') || '');
      if (note) el.setAttribute('data-note', note);
    });
    root.querySelectorAll('.katex [data-note], .katex [note]').forEach((el) => {
      el.classList.add('math-note');
      const note = parseHtmlDataNote(el.getAttribute('data-note') || el.getAttribute('note') || '');
      if (note) el.setAttribute('data-note', note);
    });
  }

  function recoverRawHtmlDataInText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const fixes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('.math-note, .katex')) continue;
      const t = node.textContent || '';
      if (!/\\htmlData\{/.test(t)) continue;
      const parts = [];
      let last = 0;
      let pos = 0;
      while (pos < t.length) {
        const start = t.indexOf('\\htmlData', pos);
        if (start < 0) break;
        if (start > last) parts.push(document.createTextNode(t.slice(last, start)));
        const attrOpen = t.indexOf('{', start + 9);
        if (attrOpen < 0) break;
        const attrClose = closeBraceIndex(t, attrOpen);
        if (attrClose < 0) break;
        const bodyOpen = attrClose + 1;
        if (t[bodyOpen] !== '{') {
          pos = attrClose + 1;
          continue;
        }
        const bodyClose = closeBraceIndex(t, bodyOpen);
        if (bodyClose < 0) break;
        const attr = t.slice(attrOpen + 1, attrClose);
        const body = t.slice(bodyOpen + 1, bodyClose);
        parts.push(createNoteSpan(attr, body));
        last = bodyClose + 1;
        pos = bodyClose + 1;
      }
      if (last < t.length) parts.push(document.createTextNode(t.slice(last)));
      if (parts.length > 1) fixes.push({ node, parts });
    }
    for (const f of fixes) {
      const parent = f.node.parentNode;
      if (!parent) continue;
      for (const p of f.parts) parent.insertBefore(p, f.node);
      parent.removeChild(f.node);
    }
  }

  function enhanceNotePointerTargets(root) {
    if (!root) return;
    markWholeExpressionNotes(root);
    promoteFractionNoteParts(root);
    root.querySelectorAll('.math-note, .katex [data-note], .katex [note]').forEach((el) => {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.style.overflow = 'visible';
      if (el.classList.contains('math-note--whole')) {
        el.querySelectorAll('*').forEach((child) => {
          child.style.pointerEvents = 'none';
        });
      }
      if (/\\times\s*10\^/.test(el.textContent || '')) {
        el.classList.add('math-note--sci');
      }
    });
  }

  function recoverKatexNoteErrors(root) {
    if (!root) return;
    root.querySelectorAll('.katex-error').forEach((el) => {
      const tex = (el.textContent || '').trim();
      if (!/\\htmlData\{/.test(tex)) return;
      const start = tex.indexOf('\\htmlData');
      const attrOpen = tex.indexOf('{', start + 9);
      const attrClose = closeBraceIndex(tex, attrOpen);
      if (attrClose < 0 || tex[attrClose + 1] !== '{') return;
      const bodyClose = closeBraceIndex(tex, attrClose + 1);
      if (bodyClose < 0) return;
      el.replaceWith(createNoteSpan(
        tex.slice(attrOpen + 1, attrClose),
        tex.slice(attrClose + 2, bodyClose)
      ));
    });
  }

  /** 修正 NOTE 只包住 2x、上標 ^2 落在外面的錯誤（應為 (2x)^2） */
  function repairHtmlDataSquaredTerms(text) {
    return forEachHtmlData(String(text || ''), (attr, body) => {
      const b = String(body || '').trim();
      if (/^2[xX]\^?\{?\s*2\s*\}?$/i.test(b) || /^2[xX]$/i.test(b)) {
        return `\\htmlData{${attr}}{(2x)^{2}}`;
      }
      return `\\htmlData{${attr}}{${body}}`;
    }).replace(
      /\\htmlData(\{note=[^}]+\})\{2[xX]\}(\^?\{?\s*2\s*\}?)/g,
      '\\htmlData$1{(2x)^{2}}'
    ).replace(
      /\(\\htmlData(\{note=[^}]+\})\{(?:2[xX]|\(2[xX]\)\^?\{?\s*2\s*\}?)\}\)(\^?\{?\s*2\s*\}?)/gi,
      '\\htmlData$1{(2x)^{2}}'
    ).replace(
      /\\htmlData(\{note=[^}]+\})\{\(2[xX]\)\^?\{?\s*2\s*\}?\}(\^?\{?\s*2\s*\}?)/g,
      '\\htmlData$1{(2x)^{2}}'
    );
  }

  function preprocessEarly(text) {
    let s = String(text || '');
    s = repairHtmlDataSquaredTerms(s);
    s = splitHtmlDataWrappedFractions(s);
    s = wrapBareHtmlData(s);
    s = normalizeHtmlDataNotes(s);
    return s;
  }

  function preprocessLate(text) {
    return wrapBareHtmlData(String(text || ''));
  }

  function postProcessBoard(root) {
    if (!root) return;
    recoverKatexNoteErrors(root);
    recoverRawHtmlDataInText(root);
    decorateHtmlDataNotes(root);
    markWholeExpressionNotes(root);
    promoteFractionNoteParts(root);
    ensureKatexFractionsVisible(root);
    enhanceNotePointerTargets(root);
  }

  function initClickHandler() {
    document.addEventListener('click', (e) => {
      const raw = e.target.closest('[data-note], [note], .math-note');
      if (!raw) return hidePopover();
      const target = raw.classList.contains('math-note--frac-part')
        ? raw.closest('[data-note].math-note--whole, [data-note][data-note-scope="whole"]') || raw
        : raw;
      const note = target.getAttribute('data-note') || target.getAttribute('note');
      if (!note) return;
      e.stopPropagation();
      const isActive = target.classList.contains('active');
      hidePopover();
      if (!isActive) {
        target.classList.add('active');
        const pop = getPopover();
        pop.textContent = note;
        pop.classList.add('show');
        const rect = target.getBoundingClientRect();
        pop.style.left = `${rect.left + rect.width / 2}px`;
        pop.style.top = `${rect.top - 10}px`;
        pop.style.transform = 'translate(-50%, -100%)';
      }
    });
  }

  window.MathNote = {
    preprocessEarly,
    preprocessLate,
    postProcessBoard,
    getKatexTrust: () => KATEX_TRUST,
    getKatexMacros: () => KATEX_MACROS,
    parseHtmlDataNote,
    createNoteSpan,
    isSemanticNote
  };

  initClickHandler();
})();
