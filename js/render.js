/**
 * 通用型 Render.js - 兼顧彈性、自然排版與互動功能
 * 移除所有針對特定題型的硬編碼邏輯
 */

// 1. 注入基礎樣式 (決定間距、移除底線、定義彈出框)
(function injectGlobalStyles() {
  if (document.getElementById('universal-render-style')) return;
  const style = document.createElement('style');
  style.id = 'universal-render-style';
  style.textContent = `
    .ai-plain {
      font-size: 16px;
      line-height: 1.8;
      color: #2c3e50;
      word-wrap: break-word;
      padding: 10px 5px;
    }
    /* 段落間隔 */
    .ai-plain p { margin: 0 0 1.2em 0; }
    
    /* 數學區塊：自動置中並允許橫向捲動 */
    .math-block {
      margin: 1.2em 0;
      text-align: center;
      overflow-x: auto;
      overflow-y: hidden;
    }
    
    /* 互動筆記：移除所有底線，僅保留點擊手勢 */
    .math-note, [data-note], .katex [data-note] {
      border-bottom: none !important;
      text-decoration: none !important;
      cursor: pointer;
    }
    
    /* 彈出說明框樣式 */
    .math-note-popover {
      position: fixed;
      background: rgba(44, 62, 80, 0.95);
      color: #fff;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      display: none;
      pointer-events: none;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      max-width: 250px;
      line-height: 1.5;
      backdrop-filter: blur(4px);
    }
    .math-note-popover.show { display: block; }
    
    /* 通用答案框 */
    .answer-box {
      margin-top: 1.5em;
      padding: 15px 20px;
      background-color: #f0f7ff;
      color: #0056b3;
      border-left: 6px solid #007bff;
      border-radius: 4px;
      font-weight: bold;
      display: block;
    }
  `;
  document.head.appendChild(style);
})();

// 2. 互動說明邏輯 (Popover)
let popoverEl = null;
function getPopover() {
  if (!popoverEl) {
    popoverEl = document.createElement('div');
    popoverEl.className = 'math-note-popover';
    document.body.appendChild(popoverEl);
  }
  return popoverEl;
}

document.addEventListener('click', (e) => {
  // 遍歷路徑找尋是否有帶 data-note 的元素
  const target = e.target.closest('[data-note]');
  const pop = getPopover();
  
  if (target) {
    const note = target.getAttribute('data-note');
    if (!note) return;
    
    pop.textContent = note;
    pop.classList.add('show');
    
    const rect = target.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    
    // 計算彈出位置（置中於元素上方）
    let left = rect.left + (rect.width / 2);
    let top = rect.top - 10;
    
    // 防止超出螢幕左右邊界
    const padding = 10;
    left = Math.max(popRect.width/2 + padding, Math.min(window.innerWidth - popRect.width/2 - padding, left));
    
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    pop.style.transform = 'translate(-50%, -100%)';
    e.stopPropagation();
  } else {
    pop.classList.remove('show');
  }
});

// 3. 核心解析邏輯
const BOARD_LAYOUT_ENABLED = false;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 處理 Markdown：
 * 1. 保護數學式不被 escape
 * 2. 處理換行 (雙換行 = 段落, 單換行 = <br>)
 */
function parseText(raw) {
  const mathItems = [];
  // 1. 暫存所有數學標記，避免中間的符號被處理
  let text = raw.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  // 2. 基本 HTML 安全處理與 Markdown
  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. 轉換段落與換行
  text = text.split(/\n{2,}/).map(p => {
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  // 4. 還原數學標記
  text = text.replace(/__MATH_HOLDER_(\d+)__/g, (m, index) => {
    const item = mathItems[index];
    if (item.type === 'block') {
      return `<div class="math-block">${item.content}</div>`;
    }
    return item.content;
  });

  return text;
}

/**
 * 公開的渲染接口
 */
function render(rawText) {
  if (!rawText) return '';

  // 修正常見的 LaTeX 裸寫 array 錯誤
  let content = rawText.replace(
    /(?:^|\n)((?:\\begin\{array\})[\s\S]*?\\end\{array\})(?=\n|$)/g,
    (m, block) => block.includes('$') ? m : `\n$$${block}$$\n`
  );

  // 嘗試分離答案
  let body = content;
  let answerHtml = '';
  const answerMatch = content.match(/(?:^|\n)\s*(?:\*\*)?答[：:]([\s\S]+?)(?:\*\*)?\s*$/);
  
  if (answerMatch) {
    body = content.slice(0, answerMatch.index).trim();
    answerHtml = `<div class="answer-box">答：${esc(answerMatch[1].trim())}</div>`;
  }

  const htmlBody = parseText(body);
  return `<div class="ai-plain">${htmlBody}${answerHtml}</div>`;
}

/**
 * 公開的 KaTeX 渲染接口
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