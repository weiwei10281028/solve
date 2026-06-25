/**
 * js/render.js - 2024 專業重構版
 * 解決：答案框消失、代碼外洩、懸掛縮進排版崩潰
 */

const BOARD_LAYOUT_ENABLED = false;

// 1. 說明 Popover 邏輯 (維持穩定)
let popoverEl = null;
function getPopover() {
    if (!popoverEl) { popoverEl = document.createElement('div'); popoverEl.className = 'math-note-popover'; document.body.appendChild(popoverEl); }
    return popoverEl;
}
function hidePopover() {
    if (popoverEl) popoverEl.classList.remove('show');
    document.querySelectorAll('.active[data-note], .math-note.active').forEach(el => el.classList.remove('active'));
}
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-note], [note], .math-note');
    if (!target) return hidePopover();
    const note = target.getAttribute('data-note') || target.getAttribute('note');
    if (!note) return;
    e.stopPropagation();
    const isActive = target.classList.contains('active');
    hidePopover();
    if (!isActive) {
        target.classList.add('active');
        const pop = getPopover();
        pop.textContent = note; pop.classList.add('show');
        const rect = target.getBoundingClientRect();
        pop.style.left = `${rect.left + rect.width / 2}px`;
        pop.style.top = `${rect.top - 10}px`;
        pop.style.transform = 'translate(-50%, -100%)';
    }
});

// 2. 核心渲染引擎
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function render(rawText) {
    if (!rawText) return '';
    let text = rawText.trim();
    const mathItems = [];

    // 【核心修復 1】先修復並保護數學式，防止代碼外洩
    text = text.replace(/(?<!\$)\\htmlData\{([^{}]*)\}\{([^{}]*)\}(?!\$)/g, '$\\htmlData{$1}{$2}$');
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
        mathItems.push(`<div class="math-scroll-container">${m}</div>`);
        return `__MATH_HOLDER_${mathItems.length - 1}__`;
    });
    text = text.replace(/\$([^\n]+?)\$/g, (m) => {
        // 智慧偵測：長算式或反應式自動變橫滑
        if (m.length > 40 || /\\rightarrow|\\right/.test(m)) {
            mathItems.push(`<div class="math-scroll-container">$$${m.slice(1,-1)}$$</div>`);
            return `__MATH_HOLDER_${mathItems.length - 1}__`;
        }
        mathItems.push(m);
        return `__MATH_HOLDER_${mathItems.length - 1}__`;
    });

    // 【核心修復 2】分離答案框 (智慧識別結論行)
    let body = text;
    let answerHtml = '';
    const answerRegex = /(?:^|\n)(?:\*\*)?(答[：:]|正確選項為|結論為|答案為)([\s\S]+?)(?:\*\*)?$/;
    const answerMatch = text.match(answerRegex);
    if (answerMatch) {
        body = text.replace(answerMatch[0], '').trim();
        answerHtml = `<div class="answer-box">答：${esc(answerMatch[2].replace(/\*/g, '').trim())}</div>`;
    }

    // 【核心修復 3】段落與選項結構化
    const lines = body.split(/\n+/);
    let htmlResult = lines.map(line => {
        const content = line.trim();
        if (!content) return '';
        // 偵測 (A) 類型的選項標籤
        const labelMatch = content.match(/^\s*([（(\[]?[A-Za-z0-9一二三]{1,2}[）)\]]|(?:\d+|[A-Za-z])[.．：:])\s*(.*)/);
        if (labelMatch) {
            return `<div class="choice-block"><span class="choice-label">${labelMatch[1]}</span><div class="choice-content">${labelMatch[2]}</div></div>`;
        }
        return `<div class="board-row">${content}</div>`;
    }).join('');

    // 還原數學標記
    htmlResult = htmlResult.replace(/__MATH_HOLDER_(\d+)__/g, (m, i) => mathItems[i]);

    return `<div class="ai-plain">${htmlResult}${answerHtml}</div>`;
}

function doKaTeX(element) {
    if (typeof renderMathInElement !== 'function') return;
    renderMathInElement(element, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false,
        trust: (ctx) => ctx.command === '\\htmlData',
        macros: { '\\frac': '\\dfrac', '\\tfrac': '\\dfrac' }
    });
}