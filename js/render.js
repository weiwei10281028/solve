/**
 * 通用型 Render.js (修復藍框邏輯 + 實作點擊互動)
 */

const BOARD_LAYOUT_ENABLED = false;

// ==========================================
// 1. Popover (點擊說明框) 互動邏輯
// ==========================================

let popoverEl = null;

// 取得或建立 Popover 元素
function getPopover() {
  if (!popoverEl) {
    popoverEl = document.createElement('div');
    popoverEl.className = 'math-note-popover';
    document.body.appendChild(popoverEl);
  }
  return popoverEl;
}

// 隱藏說明框並移除所有數字的反白狀態
function hidePopover() {
  if (popoverEl) popoverEl.classList.remove('show');
  document.querySelectorAll('.active[data-note], .active[note], .math-note.active').forEach(el => {
    el.classList.remove('active');
  });
}

// 監聽全局點擊事件
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-note], [note], .math-note');
  const pop = getPopover();
  
  if (target) {
    // 取得註解文字（支援多種屬性名稱）
    const noteText = target.getAttribute('data-note') || target.getAttribute('note');
    if (!noteText) return;
    
    // 阻止事件冒泡，避免觸發外層的隱藏邏輯
    e.stopPropagation();
    
    // 切換點擊狀態 (如果已經是 active 且被點擊，就隱藏)
    const isActive = target.classList.contains('active');
    hidePopover(); // 先清除畫面上的其他標記
    
    if (!isActive) {
      target.classList.add('active'); // 加上反白樣式
      pop.textContent = noteText;
      pop.classList.add('show');
      
      // 計算彈出框的位置（置中於數字正上方）
      const rect = target.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      
      let left = rect.left + (rect.width / 2);
      let top = rect.top - 10;
      
      // 防止超出螢幕左右邊界
      const padding = 10;
      left = Math.max(popRect.width / 2 + padding, Math.min(window.innerWidth - popRect.width / 2 - padding, left));
      
      // 防止超出螢幕上方（如果上方空間不夠，就彈到數字下方）
      if (top - popRect.height < 0) {
        top = rect.bottom + popRect.height + 10; 
      }

      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
      pop.style.transform = 'translate(-50%, -100%)';
    }
  } else {
    // 點擊空白處隱藏框框
    hidePopover();
  }
});

// ==========================================
// 2. 核心文字處理與渲染
// ==========================================

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 處理 Markdown 並保護數學式
 */
function parseText(raw) {
  const mathItems = [];
  
  // 保護獨立數學式
  let text = raw.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathItems.push({ type: 'block', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });
  
  // 保護行內數學式
  text = text.replace(/\$([^\n]+?)\$/g, (m) => {
    mathItems.push({ type: 'inline', content: m });
    return `__MATH_HOLDER_${mathItems.length - 1}__`;
  });

  // HTML 安全處理與粗體
  text = esc(text);
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 段落處理 (雙換行轉 p，單換行轉 br)
  text = text.split(/\n{2,}/).map(p => {
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  // 還原數學式
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

  // 1. 自動補全漏掉的 $$ (針對裸寫的反應表)
  let content = rawText.replace(
    /(?:^|\n)((?:\\begin\{array\})[\s\S]*?\\end\{array\})(?=\n|$)/g,
    (m, block) => block.includes('$') ? m : `\n$$${block}$$\n`
  );

  // 2. 【核心修復】精準分離答案
  // 邏輯：從「答：」開始抓，只抓到換行為止 ([^\n]+)。絕不跨行。
  let body = content;
  let answerHtml = '';
  const answerMatch = content.match(/(?:^|\n)\s*(?:\*\*)?答[：:]([^\n]+)/);
  
  if (answerMatch) {
    // 把答案那一行從正文中剔除
    const fullMatchStr = answerMatch[0];
    body = content.replace(fullMatchStr, '').trim();
    
    // 把抓到的答案放進藍色框框，並去除尾部可能帶有的 ** 符號
    let cleanAnswer = answerMatch[1].replace(/\*\*\s*$/, '').trim();
    answerHtml = `<div class="answer-box">答：${esc(cleanAnswer)}</div>`;
  }

  // 3. 渲染剩下的詳解正文
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
    throwOnError: false, // 防止單一錯誤導致全版白畫面
    trust: (context) => context.command === '\\htmlData', // 允許 note 標籤
    macros: {
      '\\frac': '\\dfrac',
      '\\tfrac': '\\dfrac'
    }
  });
}