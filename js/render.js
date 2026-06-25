/**
 * 增強版 Render.js - 自然排版 + 恢復點擊說明 + 移除底線
 */

// 1. 自動注入排版與 UI 樣式
(function injectStyles() {
  if (document.getElementById('simple-render-style')) return;
  const style = document.createElement('style');
  style.id = 'simple-render-style';
  style.textContent = `
    .ai-plain {
      font-size: 16px;
      line-height: 1.8;
      color: #2c3e50;
      word-wrap: break-word;
      padding: 10px 0;
    }
    .ai-plain p { margin: 0 0 1.2em 0; }
    .ai-plain .math-block {
      margin: 1.2em 0;
      text-align: center;
      overflow-x: auto;
    }
    /* 強制移除底線 */
    .math-note, [data-note], .katex [data-note] {
      border-bottom: none !important; 
      text-decoration: none !important;
      cursor: pointer; /* 讓使用者知道可以點 */
    }
    /* 彈出說明小框框的樣式 */
    .math-note-popover {
      position: fixed;
      background: #333;
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 9999;
      display: none;
      pointer-events: none;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 200px;
    }
    .math-note-popover.show { display: block; }
    /* 答案框 */
    .answer-box {
      margin-top: 1.5em;
      padding: 12px 20px;
      background-color: #e3f2fd;
      color: #0d47a1;
      border-left: 5px solid #1976d2;
      border-radius: 4px;
      font-weight: bold;
      display: inline-block;
    }
  `;
  document.head.appendChild(style);
})();

// 2. 點擊說明邏輯 (Popover)
let popoverEl = null;
function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.className = 'math-note-popover';
  document.body.appendChild(popoverEl);
  return popoverEl;
}

// 監聽全局點擊事件來觸發說明
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-note]');
  const pop = ensurePopover();
  
  if (target) {
    const note = target.getAttribute('data-note');
    if (!note) return;
    
    pop.textContent = note;
    pop.classList.add('show');
    
    // 計算位置
    const rect = target.getBoundingClientRect();
    pop.style.left = `${rect.left + rect.width / 2}px`;
    pop.style.top = `${rect.top - 10}px`;
    pop.style.transform = 'translate(-50%, -100%)';
  } else {
    pop.classList.remove('show');
  }
});

// ==========================================
// 3. 核心渲染功能
// ==========================================

const BOARD_LAYOUT_ENABLED = false;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractAnswer(raw) {
  let s = String(raw || '').trim();
  let answerText = '';
  const m = s.match(/(?:^|\n)\s*(?:\*\*)?答[：:]\s*(.+?)(?:\*\*)?\s*$/);
  if (m) {
    answerText = m[1].trim();
    s = s.slice(0, m.index).trim();
  }
  return { body: s, answer: answerText };
}

function parseMarkdownToHtml(text) {
  const mathBlocks = [];
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathBlocks.push(m);
    return `__MATH_DISPLAY_${mathBlocks.length - 1}__`;
  });
  processed = processed.replace(/\$([^\n]+?)\$/g, (m) => {
    mathBlocks.push(m);
    return `__MATH_INLINE_${mathBlocks.length - 1}__`;
  });

  processed = esc(processed);
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  processed = processed
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  processed = processed.replace(/__MATH_DISPLAY_(\d+)__/g, (m, i) => `<div class="math-block">${mathBlocks[i]}</div>`);
  processed = processed.replace(/__MATH_INLINE_(\d+)__/g, (m, i) => mathBlocks[i]);

  return processed;
}

function render(rawText) {
  if (!rawText) return '';
  let fixedText = rawText.replace(
    /(?:^|\n)((?:\\begin\{array\})[\s\S]*?\\end\{array\})(?=\n|$)/g,
    (m, block) => (block.includes('$') ? m : `\n$$${block}$$\n`)
  );
  const { body, answer } = extractAnswer(fixedText);
  let html = parseMarkdownToHtml(body);
  if (answer) {
    html += `<div class="answer-box">答：${esc(answer.replace(/^答[：:]\s*/, ''))}</div>`;
  }
  return `<div class="ai-plain">${html}</div>`;
}

function doKaTeX(element) {
  if (typeof renderMathInElement !== 'function') return;
  renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false,
    trust: (context) => context.command === '\\htmlData',
    macros: { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' }
  });
}