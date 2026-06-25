/**
 * 簡化版 Render.js - 專注於自然排版與舒適間距
 * 請直接全選並取代你原本的程式碼
 */

// 1. 自動注入排版 CSS (確保行距舒適、數學式不會擠在一起、擁有漂亮的答案框)
(function injectStyles() {
  if (document.getElementById('simple-render-style')) return;
  const style = document.createElement('style');
  style.id = 'simple-render-style';
  style.textContent = `
    .ai-plain {
      font-size: 16px;
      line-height: 1.8; /* 舒適行高 */
      color: #2c3e50;
      word-wrap: break-word;
      padding: 10px 0;
    }
    .ai-plain p {
      margin: 0 0 1.2em 0; /* 段落之間的間距 */
    }
    /* 獨立數學式排版 */
    .ai-plain .math-block {
      margin: 1.2em 0;
      padding: 0.5em 1em;
      overflow-x: auto; /* 手機版算式太長可以左右滑動 */
      text-align: center;
    }
    .ai-plain .katex-display {
      margin: 0 !important; /* 覆蓋 KaTeX 預設，交給 math-block 控制 */
    }
    .ai-plain .katex {
      font-size: 1.1em; /* 讓數學式稍微放大，更好閱讀 */
    }
    /* 答案框樣式 */
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

// ==========================================
// 2. 核心渲染功能
// ==========================================

const BOARD_LAYOUT_ENABLED = false;

/**
 * 轉義 HTML 特殊字元，防止破壞版面
 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 抽取文末的「答：XXX」，獨立加上藍色框框樣式
 */
function extractAnswer(raw) {
  let s = String(raw || '').trim();
  let answerText = '';
  // 匹配最後一行的「答：...」
  const m = s.match(/(?:^|\n)\s*(?:\*\*)?答[：:]\s*(.+?)(?:\*\*)?\s*$/);
  if (m) {
    answerText = m[1].trim();
    s = s.slice(0, m.index).trim(); // 把答案從正文中移除
  }
  return { body: s, answer: answerText };
}

/**
 * 將文字轉換為流暢的 HTML 段落
 */
function parseMarkdownToHtml(text) {
  const mathBlocks = [];
  
  // 保護獨立數學式 $$...$$
  let processed = text.replace(/\$\$([\s\S]+?)\$\$/g, (m) => {
    mathBlocks.push(m);
    return `__MATH_DISPLAY_${mathBlocks.length - 1}__`;
  });
  
  // 保護行內數學式 $...$
  processed = processed.replace(/\$([^\n]+?)\$/g, (m) => {
    mathBlocks.push(m);
    return `__MATH_INLINE_${mathBlocks.length - 1}__`;
  });

  // 處理粗體與跳脫
  processed = esc(processed);
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 段落處理 (\n\n 變段落，單一 \n 變換行)
  processed = processed
    .split(/\n{2,}/)
    .map(p => {
      const lineHtml = p.replace(/\n/g, '<br>');
      return `<p>${lineHtml}</p>`;
    })
    .join('\n');

  // 還原數學式
  processed = processed.replace(/__MATH_DISPLAY_(\d+)__/g, (m, i) => {
    return `<div class="math-block">${mathBlocks[i]}</div>`;
  });
  processed = processed.replace(/__MATH_INLINE_(\d+)__/g, (m, i) => {
    return mathBlocks[i];
  });

  return processed;
}

/**
 * 外部呼叫的主渲染函數 (代替舊版的 render)
 */
function render(rawText) {
  if (!rawText) return '';

  // 如果有漏掉 $$ 的反應表 (array)，自動補上 $$
  let fixedText = rawText.replace(
    /(?:^|\n)((?:\\begin\{array\})[\s\S]*?\\end\{array\})(?=\n|$)/g,
    (m, block) => (block.includes('$') ? m : `\n$$${block}$$\n`)
  );

  // 抽離「答案」與「正文」
  const { body, answer } = extractAnswer(fixedText);

  // 解析正文成為自然的 HTML
  let html = parseMarkdownToHtml(body);

  // 加上漂亮的答案框
  if (answer) {
    let cleanAnswer = answer.replace(/^答[：:]\s*/, '');
    html += `<div class="answer-box">答：${esc(cleanAnswer)}</div>`;
  }

  return `<div class="ai-plain">${html}</div>`;
}

/**
 * 外部呼叫的 KaTeX 渲染函數 (代替舊版的 doKaTeX)
 */
function doKaTeX(element) {
  if (typeof renderMathInElement !== 'function') {
    console.warn('KaTeX renderMathInElement 尚未載入');
    return;
  }

  try {
    renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false, // 避免單一錯誤毀掉整個畫面
      trust: (context) => context.command === '\\htmlData', // 允許 AI 產生的 \htmlData 標籤
      macros: {
        '\\frac': '\\dfrac',   // 自動將所有小分式轉為直立大分式，化學看起來才清楚
        '\\tfrac': '\\dfrac'
      }
    });
  } catch (err) {
    console.error('KaTeX 渲染失敗', err);
  }
}