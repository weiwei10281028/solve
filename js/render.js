/**
 * js/render.js - 專業版書排版引擎 (終極完整版)
 * 功能：代碼自動修復、單行算式橫滑、精準答案分離、垂直節奏結構化
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

// 使用事件委託監聽點擊
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
      
      // 邊界修正
      const padding = 12;
      left = Math.max(popRect.width / 2 + padding, Math.min(window.innerWidth - popRect.width / 2 - padding, left));
      
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.style.transform = 'translate(-50%, -100%)';
    }
  } else {
    hidePopover();
  }
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
  let t = String(raw || '');
  // 修復被 AI 寫在 $ 外面的 \htmlData
  t = t.replace(/(?<!\$)\\htmlData\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, '$\\htmlData{$1}{$2}$');
  return t;
}

/**
 * 將 AI 純文字解析為具備垂直節奏的 HTML 結構
 */
function parseToStructuredHtml(raw) {
  const mathItems = [];
  let text = autoFixLatex(raw);

  // 1. 暫存數學塊，避免被 Escape 破壞
  // 處理 $$ 塊 (獨立行，具備橫滑能力)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  
  // 處理 $ 塊 (行內，不折行保護)
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  // 2. 基本 Markdown 轉換
  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 3. 垂直節奏處理：將內容按換行拆分為獨立區塊 (.board-row)
  // 這能配合 CSS line-height 確保高分式與文字間距完美一致
  const lines = text.split(/\n+/);
  let structuredHtml = lines.map(line => {
    const content = line.trim();
    if (!content) return '';
    return `<div class="board-row">${content}</div>`;
  }).join('');

  // 4. 還原數學塊並根據類型套用容器
  structuredHtml = structuredHtml.replace(/__MATH_HOLDER_(\d+)__/g, (m, index) => {
    const item = mathItems[index];
    if (item.type === 'block') {
      // 套用 CSS 中設定好的橫向滾動容器
      return `<div class="math-scroll-container">${item.content}</div>`;
    }
    // 行內數學式直接回傳 (CSS 會處理其 white-space)
    return item.content;
  });

  return structuredHtml;
}

/**
 * 主渲染入口
 */
function render(rawText) {
  if (!rawText) return '';

  // 第一步：先將「答案行」分離出來，確保不被包入普通的 board-row
  let body = rawText;
  let answerHtml = '';
  
  // 精準匹配：抓取「答：」之後直到該行結束的所有文字
  const answerMatch = rawText.match(/(?:^|\n)\s*(?:\*\*)?答[：:]([^\n]+)/);
  
  if (answerMatch) {
    // 從正文中移除答案這一段
    body = rawText.replace(answerMatch[0], '').trim();
    
    // 清理答案文字（移除可能多出的 Markdown 粗體結尾）
    let cleanAnswer = answerMatch[1].replace(/\*\*\s*$/, '').trim();
    answerHtml = `<div class="answer-box">答：${esc(cleanAnswer)}</div>`;
  }

  // 第二步：處理剩餘的詳解正文
  const htmlBody = parseToStructuredHtml(body);

  // 第三步：組合回傳
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