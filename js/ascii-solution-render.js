/* js/ascii-solution-render.js — AI 詳解唯一排版器：JSON → HTML → MathJax AsciiMath */
(function (global) {
  'use strict';

  const MATHJAX_SRC = 'https://cdn.jsdelivr.net/npm/mathjax@4/startup.js';
  const CJK_RE = /[\u3400-\u9fff]/;
  const DISPLAY_RE = /(?:=|->|<->|>=|<=|!=|→|⟶|⇌|↔|⇄|⟷)/;
  const MATH_HINT_RE = /[\\/_^=<>*+]|->|<->|[→⟶⇌↔⇄⟷]|\d+(?:\.\d+)?\s*[A-Za-z]|\b[A-Z][A-Za-z]*\d|\b[A-Za-z]+_\d/;
  let mathJaxPromise = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isLoosePunctuation(value) {
    return /^[\s.,;:!?，。；：！？、】【、]*$/.test(String(value || ''));
  }

  function trimLoosePunctuation(value) {
    return String(value || '').replace(/[.,;:!?，。；：！？、】【、]+$/g, '');
  }

  function isLikelyAsciiMath(value) {
    const text = String(value || '').trim();
    return Boolean(text && !isLoosePunctuation(text) && /[A-Za-z0-9]/.test(text));
  }

  function isDisplayAsciiMath(value) {
    const text = String(value || '').trim();
    return isLikelyAsciiMath(text) && !CJK_RE.test(text) && MATH_HINT_RE.test(text)
      && (DISPLAY_RE.test(text) || text.length > 32);
  }

  // AI 偶爾把水溶態寫成 ^(aq)；本詳解固定將其排為化學式下標。
  function normaliseAsciiMath(value) {
    return String(value || '')
      // 顯示端容錯：即使模型誤用 Unicode 箭頭，也統一交給 AsciiMath。
      .replace(/\s*[⇌↔⇄⟷]\s*/g, ' <-> ')
      .replace(/\s*[→⟶]\s*/g, ' -> ')
      .replace(/\^\s*\(\s*aq\s*\)/gi, '_(aq)')
      // AsciiMath 將 Fe^2+ 視為「Fe 的 2 次方再加 1」，使 + 留在基線。
      // 化學離子的數字電荷須包成同一組上標；一般 x^2 + y 不受影響。
      .replace(/([A-Z][A-Za-z0-9_()]*)\^(\d+)([+-])(?=\s|$|[),.;:])/g, '$1^($2$3)')
      // AI 偶爾在 V(...)、n(...)、W(...) 中漏掉組成數字的底線。
      .replace(/([nVW])\(\s*([A-Z][A-Za-z0-9]*)\s*\)/g, (_, quantity, species) =>
        `${quantity}(${species.replace(/([A-Z][a-z]?)(\d+)/g, '$1_$2')})`)
      // 反應式的加號固定與前後物種分開；電荷組內的 2+／+ 因後面緊接 ) 不受影響。
      .replace(/\+(?!\))/g, ' + ')
      // AsciiMath 不接受在既有上標後直接再接 _(aq)。以空白基底承接物態下標；
      // 雙層括號保留可見的 (aq)，並讓 aq 維持 AsciiMath 變數斜體。
      .replace(/_\(\s*(aq|l|s|g)\s*\)/gi, '""_(($1))');
  }

  function math(value, display) {
    const body = escapeHtml(normaliseAsciiMath(value).trim());
    return `<span class="am-math am-math--${display ? 'display' : 'inline'}">\`${body}\`</span>`;
  }

  function renderInline(value) {
    const source = String(value || '');
    const parts = [];
    let buffer = '';
    let ascii = null;
    const push = () => {
      if (!buffer) return;
      // 中文與英數交界不保留模型偶發的外側半形空白，避免只在公式右側出現大縫隙。
      // 英數片段內部空白仍完整保留，比例、單位與算式不受影響。
      const segment = ascii ? buffer.trim() : buffer;
      const candidate = ascii ? trimLoosePunctuation(segment) : segment;
      if (ascii && isLikelyAsciiMath(candidate)) {
        parts.push(math(candidate, false));
        const tail = segment.slice(candidate.length);
        if (tail) parts.push(escapeHtml(tail));
      } else {
        parts.push(escapeHtml(segment));
      }
      buffer = '';
    };
    for (const ch of source) {
      const nextAscii = ch.charCodeAt(0) <= 0x7f;
      if (ascii === null) ascii = nextAscii;
      if (nextAscii !== ascii) {
        push();
        ascii = nextAscii;
      }
      buffer += ch;
    }
    push();
    return parts.join('');
  }

  function displayFormula(value) {
    return `<div class="am-display-scroll" tabindex="0" role="region" aria-label="公式（可橫向滑動）"><div class="am-display-content">${math(value, true)}</div></div>`;
  }

  function normaliseText(value) {
    return String(value || '').trim().replace(/^\/\/\s*/, '');
  }

  function isStructureMarker(value) {
    return /^@@(?:SMILES|MOL):/i.test(String(value || '').trim());
  }

  function plainLine(value, className) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (isStructureMarker(text)) {
      return `<div class="plain-line ${className || ''}"><div class="plain-line-inner">${escapeHtml(text)}</div></div>`;
    }
    if (isDisplayAsciiMath(text)) return displayFormula(text);
    return `<p class="${className || ''}">${renderInline(text)}</p>`;
  }

  function renderHeading(value) {
    const title = normaliseText(value);
    return title ? `<h2 class="am-section-title"><span>${renderInline(title)}</span></h2>` : '';
  }

  function renderChoice(block) {
    let label = String(block.label || '').replace(/[()（）\s]/g, '').trim();
    let text = String(block.text || '').trim();
    const embedded = text.match(/^\s*[（(]\s*([^（）()\s]{1,16})\s*[）)]\s*(.*)$/);
    if (!label && embedded) {
      label = embedded[1];
      text = embedded[2];
    } else if (label && embedded && embedded[1] === label) {
      text = embedded[2];
    }
    if (!label && !text) return '';
    return `<section class="am-choice"><strong class="am-choice-label">（${renderInline(label)}）</strong><div class="am-choice-body">${plainLine(text)}</div></section>`;
  }

  function renderReactionTable(block) {
    const species = Array.isArray(block.species) ? block.species : [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    if (!species.length || !rows.length) return plainLine(block.text || '');
    const head = species.map((item) => `<th>${renderInline(item)}</th>`).join('');
    const body = rows.map((row) => {
      const values = Array.isArray(row.values) ? row.values : [];
      return `<tr><th>${renderInline(row.label || '')}</th>${species.map((_, index) => `<td>${renderInline(values[index] || '—')}</td>`).join('')}</tr>`;
    }).join('');
    return `<div class="am-table-scroll" tabindex="0" role="region" aria-label="反應變化表"><table class="am-reaction-table"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function splitResultItems(value) {
    const source = String(value || '').trim();
    if (!source) return [];
    const marker = /(?:^|[；;\n]\s*)[（(]?\s*(\d+)\s*(?:[)）.．、])\s*/g;
    const matches = [];
    let match;
    while ((match = marker.exec(source))) {
      matches.push({ start: match.index, bodyStart: marker.lastIndex });
    }
    if (!matches.length) return [{ text: source, explicit: false }];
    const prefix = source.slice(0, matches[0].start).replace(/[；;\s]+$/g, '').trim();
    const items = matches.map((item, index) => ({
      text: source.slice(item.bodyStart, matches[index + 1]?.start ?? source.length).replace(/[；;\s]+$/g, '').trim(),
      explicit: true
    })).filter((item) => item.text);
    return prefix ? [{ text: prefix, explicit: false }, ...items] : items;
  }

  function renderResultItems(items) {
    const valid = items.filter((item) => item?.text);
    if (!valid.length) return '';
    if (valid.length === 1 && !valid[0].explicit) return plainLine(valid[0].text, 'am-result-summary');
    return `<ol class="am-result-list">${valid.map((item, index) => (
      `<li class="am-result-item"><strong class="am-result-index">${renderInline(String(index + 1))}.</strong><div class="am-result-body">${renderInline(item.text)}</div></li>`
    )).join('')}</ol>`;
  }

  function renderAnswer(answer) {
    const text = String(answer || '').trim();
    if (!text) return '';
    return `<div class="answer-box answer-box--final"><span class="answer-box-inline">答：<span class="answer-box-value">${renderInline(text)}</span></span></div>`;
  }

  function renderDocument(documentValue) {
    if (!documentValue || !Array.isArray(documentValue.blocks)) {
      return `<article class="chem-markdown am-solution">${String(documentValue || '').split(/\r?\n/).map((line) => {
        const value = String(line || '').trim();
        if (!value) return '';
        if (value.startsWith('//')) return renderHeading(value);
        if (isDisplayAsciiMath(value)) return displayFormula(value);
        return plainLine(value);
      }).join('')}</article>`;
    }
    let inDerivation = false;
    let inResult = false;
    let derivation = null;
    let resultItems = [];
    const blocks = [];
    const flushDerivation = () => {
      if (!derivation) return;
      blocks.push(`<section class="am-derivation"><span class="am-derivation-bullet">•</span><div class="am-derivation-body"><p class="am-derivation-text">${renderInline(derivation.lead)}</p>${derivation.details.join('')}</div></section>`);
      derivation = null;
    };
    const flushResults = () => {
      if (!resultItems.length) return;
      blocks.push(renderResultItems(resultItems));
      resultItems = [];
    };
    const ensureDerivationLead = (kind) => {
      if (!inDerivation) return false;
      if (!derivation) derivation = { lead: kind === 'chemical_equation' ? '相關反應式如下：' : '計算如下：', details: [] };
      return true;
    };
    documentValue.blocks.forEach((block) => {
      if (!block || !block.type) return;
      const type = block.type;
      if (type === 'heading') {
        flushDerivation();
        flushResults();
        inDerivation = /依據|推導/.test(String(block.text || ''));
        inResult = /^結果$/.test(normaliseText(block.text));
        blocks.push(renderHeading(block.text));
      } else if (type === 'paragraph') {
        const text = String(block.text || '').replace(/^•\s*/, '');
        if (inDerivation && text) {
          flushDerivation();
          derivation = { lead: text, details: [] };
        } else if (inResult && text) {
          resultItems.push(...splitResultItems(text));
        } else {
          blocks.push(plainLine(text));
        }
      } else if (type === 'calculation') {
        flushResults();
        const expression = String(block.expression || block.text || '').trim();
        if (block.text && block.expression) {
          if (ensureDerivationLead(type)) derivation.details.push(plainLine(block.text, 'am-derivation-text'));
          else blocks.push(plainLine(block.text));
        }
        if (expression) {
          if (ensureDerivationLead(type)) derivation.details.push(displayFormula(expression));
          else blocks.push(displayFormula(expression));
        }
      } else if (type === 'chemical_equation') {
        flushResults();
        const expression = String(block.expression || block.text || '').trim();
        if (block.text && block.expression) {
          if (ensureDerivationLead(type)) derivation.details.push(plainLine(block.text, 'am-derivation-text'));
          else blocks.push(plainLine(block.text));
        }
        if (expression) {
          if (ensureDerivationLead(type)) derivation.details.push(displayFormula(expression));
          else blocks.push(displayFormula(expression));
        }
      } else if (type === 'reaction_table') {
        flushDerivation();
        flushResults();
        blocks.push(renderReactionTable(block));
      } else if (type === 'choice') {
        flushDerivation();
        flushResults();
        blocks.push(renderChoice(block));
      }
    });
    flushDerivation();
    flushResults();
    blocks.push(renderAnswer(documentValue.answer));
    return `<article class="chem-markdown am-solution">${blocks.join('')}</article>`;
  }

  function ensureMathJax() {
    if (global.MathJax?.typesetPromise) return Promise.resolve(global.MathJax);
    if (mathJaxPromise) return mathJaxPromise;
    global.MathJax = global.MathJax || {};
    global.MathJax.loader = Object.assign({ load: ['input/asciimath', 'output/chtml'] }, global.MathJax.loader || {});
    global.MathJax.chtml = Object.assign({ scale: 1, matchFontHeight: true }, global.MathJax.chtml || {});
    global.MathJax.asciimath = Object.assign({ delimiters: [['`', '`']] }, global.MathJax.asciimath || {});
    global.MathJax.startup = Object.assign({ typeset: false }, global.MathJax.startup || {});
    mathJaxPromise = new Promise((resolve, reject) => {
      const found = document.querySelector(`script[src="${MATHJAX_SRC}"]`);
      const script = found || document.createElement('script');
      script.defer = true;
      script.src = MATHJAX_SRC;
      script.onload = () => (global.MathJax.startup?.promise || Promise.resolve()).then(() => resolve(global.MathJax), reject);
      script.onerror = () => reject(new Error('MathJax 4 AsciiMath 載入失敗'));
      if (!found) document.head.appendChild(script);
    });
    return mathJaxPromise;
  }

  function enhanceHorizontalMath(root) {
    root.querySelectorAll('.am-display-scroll').forEach((wrap) => {
      const content = wrap.querySelector('.am-display-content');
      if (content) wrap.classList.toggle('am-display-scroll--overflow', content.scrollWidth > wrap.clientWidth + 1);
    });
  }

  async function renderInto(root, documentValue) {
    if (!root) return null;
    root.innerHTML = renderDocument(documentValue);
    try {
      const mathJax = await ensureMathJax();
      mathJax.typesetClear([root]);
      await mathJax.typesetPromise([root]);
    } catch (error) {
      console.warn('AsciiMath 詳解渲染失敗', error);
      root.querySelector('.am-solution')?.classList.add('am-solution--math-error');
    }
    enhanceHorizontalMath(root);
    return root;
  }

  global.AsciiSolutionRender = Object.freeze({ renderInto, renderDocument, ensureMathJax, enhanceHorizontalMath });
})(window);
