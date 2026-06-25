/**
 * 通用型 Render.js - 加強版：長算式橫向捲動 + 固定顯示滑桿
 */

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
    .ai-plain p { margin: 0 0 1.2em 0; }
    
    /* 數學區塊：長算式不換行 + 強制顯示捲軸 */
    .math-block {
      margin: 1.2em 0;
      text-align: center;
      overflow-x: scroll !important; /* 強制開啟橫向捲動 */
      overflow-y: hidden;
      padding-bottom: 12px; /* 為捲軸預留空間，避免遮到字 */
      -webkit-overflow-scrolling: touch; /* 讓手機滑動更順暢 */
    }

    /* --- 強制讓滑桿（捲軸）在手機上顯示出來 --- */
    .math-block::-webkit-scrollbar {
      height: 8px; /* 橫向捲軸的高度 */
      display: block !important;
    }
    .math-block::-webkit-scrollbar-track {
      background: #f1f1f1; /* 捲軸軌道顏色 */
      border-radius: 10px;
    }
    .math-block::-webkit-scrollbar-thumb {
      background: #adb5bd; /* 捲軸本體顏色（灰色，較明顯） */
      border-radius: 10px;
      border: 2px solid #f1f1f1;
    }
    .math-block::-webkit-scrollbar-thumb:hover {
      background: #6c757d;
    }

    /* 確保 KaTeX 內部不會自動換行，強制橫向伸展 */
    .math-block .katex-display {
      display: inline-block;
      min-width: 100%;
      margin: 0 !important;
      text-align: center;
      white-space: nowrap; /* 強制不換行 */
    }
    
    .math-note, [data-note], .katex [data-note] {
      border-bottom: none !important;
      text-decoration: none !important;
      cursor: pointer;
    }
    
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
  const target = e.target.closest('[data-note]');
  const pop = getPopover();
  if (target) {
    const note = target.getAttribute('data-note');
    if (!note) return;
    pop.textContent = note;
    pop.classList.add('show');
    const rect = target.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = rect.left + (rect.width / 2);
    let top = rect.top - 10;
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

const BOARD_LAYOUT_ENABLED = false;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseText(raw) {
  const mathItems = [];
  let text = raw.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  text = text.split(/\n{2,}/).map(p => {
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  text = text.replace(/__MATH_HOLDER_(\d+)__/g, (m, index) => {
    const item = mathItems[index];
    if (item.type === 'block') {
      return `<div class="math-block">${item.content}</div>`;
    }
    return item.content;
  });

  return text;
}

function render(rawText) {
  if (!rawText) return '';
  let content = rawText.replace(
    /(?:^|\n)((?:\\begin\{array\})[\s\S]*?\\end\{array\})(?=\n|$)/g,
    (m, block) => block.includes('$') ? m : `\n$$${block}$$\n`
  );
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