/**
 * js/render.js - 優化增強版 (專業排版引擎)
 * 解決：智慧橫滑偵測、分式對齊、懸掛縮進穩定化、代碼自動修正
 */

const BOARD_LAYOUT_ENABLED = false;

// ==========================================
// 1. 互動說明邏輯 (Popover) - 效能優化版
// ==========================================
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
  document.querySelectorAll('.active[data-note], .active[note], .math-note.active').forEach(el => {
    el.classList.remove('active');
  });
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-note], [note], .math-note');
  const pop = getPopover();
  if (target) {
    const noteText = target.getAttribute('data-note') || target.getAttribute('note');
    if (!noteText) return;
    e.stopPropagation();
    const isActive = target.classList.contains('active');
    hidePopover();
    if (!isActive) {
      target.classList.add('active');
      pop.textContent = noteText;
      pop.classList.add('show');
      const rect = target.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      let left = rect.left + (rect.width / 2);
      let top = rect.top - 10;
      const padding = 12;
      left = Math.max(popRect.width / 2 + padding, Math.min(window.innerWidth - popRect.width / 2 - padding, left));
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.style.transform = 'translate(-50%, -100%)';
    }
  } else { hidePopover(); }
});

// ==========================================
// 2. 核心優化排版引擎
// ==========================================

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 智慧修正與 LaTeX 清理
 */
function smartFixLatex(raw) {
  let t = String(raw || '');
  // 1. 修復露在 $ 外面的 \htmlData
  t = t.replace(/(?<!\$)\\htmlData\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, '$\\htmlData{$1}{$2}$');
  // 2. 修復 AI 寫錯的箭頭語法
  t = t.replace(/->/g, '\\rightarrow ').replace(/=>/g, '\\Rightarrow ');
  return t;
}

/**
 * 結構化解析：實作懸掛縮進與智慧橫滑
 */
function parseToStructuredHtml(raw) {
  const mathItems = [];
  let text = smartFixLatex(raw);

  // 1. 暫存並偵測數學塊
  // 偵測 $$ 塊 (固定橫滑)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  
  // 偵測 $ 塊 (智慧判定：若含反應箭頭則升級為橫滑塊)
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    // 智慧升級邏輯：含有箭頭或長度超過 30 字，則升級
    const isReaction = /\\rightarrow|\\rightleftharpoons|\\rightleftarrows|\\long/.test(m);
    const isVeryLong = m.length > 35;
    
    if (isReaction || isVeryLong) {
      mathItems.push({ type: 'block', content: `$$${m.slice(1, -1)}$$` });
      return `\n__MATH_HOLDER_${mathItems.length - 1}__\n`;
    }
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  // 2. HTML 安全處理與 Markdown
  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. 選項標籤識別邏輯
  const labelRegex = /^\s*([（(\[]?[A-Za-z0-9一二三四五]{1,2}[）)\]]|(?:\d+|[A-Za-z])[.．：:])\s*(.*)/;
  
  const lines = text.split(/\n+/);
  let structuredHtml = lines.map(line => {
    const content = line.trim();
    if (!content) return '';

    const match = content.match(labelRegex);
    if (match) {
      // 成功識別 (A) 類標籤，使用分欄佈局
      return `
        <div class="choice-block">
          <span class="choice-label">${match[1]}</span>
          <div class="choice-content">${match[2]}</div>
        </div>`;
    } else {
      // 普通文字行
      return `<div class="board-row">${content}</div>`;
    }
  }).join('');

  // 4. 還原數學內容
  structuredHtml = structuredHtml.replace(/__MATH_HOLDER_(\d+)__/g, (m, index) => {
    const item = mathItems[index];
    if (item.type === 'block') {
      return `<div class="math-scroll-container">${item.content}</div>`;
    }
    return item.content;
  });

  return structuredHtml;
}

/**
 * 主渲染入口：精準答案抽離
 */
function render(rawText) {
  if (!rawText) return '';

  let body = rawText;
  let answerHtml = '';
  
  // 答案行匹配邏輯：抓取「答：」之後整行
  const answerMatch = rawText.match(/(?:^|\n)\s*(?:\*\*)?答[：:]([^\n]+)/);
  if (answerMatch) {
    body = rawText.replace(answerMatch[0], '').trim();
    let cleanAnswer = answerMatch[1].replace(/\*\*\s*$/, '').trim();
    answerHtml = `<div class="answer-box">答：${esc(cleanAnswer)}</div>`;
  }

  const resultBody = parseToStructuredHtml(body);
  return `<div class="ai-plain">${resultBody}${answerHtml}</div>`;
}

/**
 * KaTeX 渲染：針對分式對齊優化
 */
function doKaTeX(element) {
  if (typeof renderMathInElement !== 'function') return;
  
  renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    trust: (context) => context.command === '\\htmlData',
    macros: {
      '\\frac': '\\dfrac',
      '\\tfrac': '\\dfrac'
    }
  });
}