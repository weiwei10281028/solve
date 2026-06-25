/**
 * js/render.js - 專業版書排版引擎 (懸掛縮進佈局版)
 * 功能：選項標籤分離、代碼自動修復、局部橫滑、點擊說明
 */

const BOARD_LAYOUT_ENABLED = false;

// ==========================================
// 1. 互動說明邏輯 (Popover)
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
// 2. 核心排版與解析邏輯
// ==========================================

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 自動修復邏輯：將露在數學符號外的 \htmlData 修正回來
 */
function autoFixLatex(raw) {
  return raw.replace(/(?<!\$)\\htmlData\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, '$\\htmlData{$1}{$2}$');
}

/**
 * 智能解析為結構化 HTML：實作懸掛縮進 (Hanging Indent)
 */
function parseToStructuredHtml(raw) {
  const mathItems = [];
  let text = autoFixLatex(raw);

  // 1. 暫存數學標記，避免被 HTML Escape 破壞
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  // 2. 基本 Markdown 轉換
  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. 選項拆分與分行處理
  // 匹配標籤 (A) (1) A. 1. (一) 等格式
  const labelRegex = /^([（(\[]?[A-Za-z0-9一二三四五]{1,2}[）)\]]|(?:\d+|[A-Za-z])[.．：:])\s*(.*)/;
  
  const lines = text.split(/\n+/);
  let structuredHtml = lines.map(line => {
    const content = line.trim();
    if (!content) return '';

    const match = content.match(labelRegex);
    if (match) {
      // 匹配到選項標籤，建立「標籤-內容」分離結構
      const label = match[1];
      const rest = match[2];
      return `
        <div class="choice-block">
          <span class="choice-label">${label}</span>
          <div class="choice-content">${rest}</div>
        </div>`;
    } else {
      // 普通文字段落
      return `<div class="board-row">${content}</div>`;
    }
  }).join('');

  // 4. 還原數學塊
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
 * 主渲染入口
 */
function render(rawText) {
  if (!rawText) return '';

  let body = rawText;
  let answerHtml = '';
  
  // 精準提取答案行
  const answerMatch = rawText.match(/(?:^|\n)\s*(?:\*\*)?答[：:]([^\n]+)/);
  if (answerMatch) {
    body = rawText.replace(answerMatch[0], '').trim();
    let cleanAnswer = answerMatch[1].replace(/\*\*\s*$/, '').trim();
    answerHtml = `<div class="answer-box">答：${esc(cleanAnswer)}</div>`;
  }

  const htmlBody = parseToStructuredHtml(body);
  return `<div class="ai-plain">${htmlBody}${answerHtml}</div>`;
}

/**
 * KaTeX 呼叫
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
