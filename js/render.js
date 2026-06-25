/**
 * js/render.js - B 方案專業排版重構版
 * 解決：代碼外漏修復、段落結構化、單題橫滑容器
 */

const BOARD_LAYOUT_ENABLED = false;

// ==========================================
// 1. 互動說明邏輯 (Popover) - 維持 A 方案功能
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
      const padding = 10;
      left = Math.max(popRect.width / 2 + padding, Math.min(window.innerWidth - popRect.width / 2 - padding, left));
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.style.transform = 'translate(-50%, -100%)';
    }
  } else { hidePopover(); }
});

// ==========================================
// 2. 核心渲染邏輯 (針對 B 方案強化)
// ==========================================

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 預處理：修復 AI 寫在 $ 外面的 \htmlData 指令
 */
function fixStrayHtmlData(raw) {
  // 匹配 \htmlData{...}{...} 但其前後沒有 $ 的情況
  // 這是一個保險機制，防止原始碼直接顯示在網頁上
  return raw.replace(/(?<!\$)\\htmlData\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, '$\\htmlData{$1}{$2}$');
}

/**
 * 將文字解析為結構化的 HTML 區塊
 */
function parseTextToBlocks(raw) {
  const mathItems = [];
  let text = fixStrayHtmlData(raw);

  // 1. 保護數學標記，避免被 HTML Escape 破壞
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  // 2. 基本 HTML 安全處理與粗體
  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. 段落結構化處理：將雙換行、單換行都視為獨立的一行區塊
  // 這樣每一行都能透過 CSS 控制一致的行間距
  const lines = text.split(/\n+/);
  let htmlResult = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    return `<div class="board-row">${trimmed}</div>`;
  }).join('');

  // 4. 還原數學標記並包入專屬容器
  htmlResult = htmlResult.replace(/__MATH_HOLDER_(\d+)__/g, (m, index) => {
    const item = mathItems[index];
    if (item.type === 'block') {
      // 這裡就是你要求的：只有這一行算式可以橫向滑動
      return `<div class="math-scroll-container">${item.content}</div>`;
    }
    return item.content;
  });

  return htmlResult;
}

/**
 * 公開的渲染接口
 */
function render(rawText) {
  if (!rawText) return '';

  let content = rawText;
  
  // 分離答案邏輯 (精準抓取一行)
  let body = content;
  let answerHtml = '';
  const answerMatch = content.match(/(?:^|\n)\s*(?:\*\*)?答[：:]([^\n]+)/);
  
  if (answerMatch) {
    const fullMatchStr = answerMatch[0];
    body = content.replace(fullMatchStr, '').trim();
    let cleanAnswer = answerMatch[1].replace(/\*\*\s*$/, '').trim();
    answerHtml = `<div class="answer-box">答：${esc(cleanAnswer)}</div>`;
  }

  const structuredBody = parseTextToBlocks(body);
  
  return `<div class="ai-plain">${structuredBody}${answerHtml}</div>`;
}

/**
 * KaTeX 渲染
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