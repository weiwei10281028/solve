/**
 * js/structure-layout.js — 結構圖與子項文字對齊排版（繪圖完成後套用）
 */
(function (global) {
  'use strict';

  const DRAW_SEL = '.molfile-draw-block, .smiles-draw-block';

  function isDrawBlock(el) {
    return el?.matches?.(DRAW_SEL);
  }

  function isSubitemHeading(el) {
    if (!el?.classList?.contains('plain-line')) return false;
    if (el.classList.contains('plain-line--step') || el.classList.contains('plain-line--empty')) return false;
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return /^\*\*\([a-g]\)/i.test(t) || /^\([a-g]\)\s/i.test(t);
  }

  function getLayoutRoot(container) {
    if (!container) return null;
    if (container.classList?.contains('ai-plain')) return container;
    return container.querySelector('.ai-plain') || container;
  }

  /** (a)～(g) 子項：標題 + 結構圖 + 混成／形狀文字並排 */
  function wrapSubitemCards(root) {
    const children = Array.from(root.children);
    let i = 0;
    while (i < children.length) {
      const el = children[i];
      if (!isSubitemHeading(el)) {
        i += 1;
        continue;
      }

      const group = [el];
      let j = i + 1;
      while (j < children.length) {
        const next = children[j];
        if (next.classList.contains('answer-box')) break;
        if (isSubitemHeading(next)) break;
        group.push(next);
        j += 1;
      }

      if (group.length >= 2) {
        const card = document.createElement('div');
        card.className = 'structure-item-card';

        const heading = document.createElement('div');
        heading.className = 'structure-item-heading';

        const body = document.createElement('div');
        body.className = 'structure-item-body';

        let textWrap = null;
        const flushText = () => {
          textWrap = null;
        };
        const appendText = (node) => {
          if (!textWrap) {
            textWrap = document.createElement('div');
            textWrap.className = 'structure-item-text';
            body.appendChild(textWrap);
          }
          textWrap.appendChild(node);
        };

        root.insertBefore(card, group[0]);

        const headLine = group[0];
        const inner = headLine.querySelector('.plain-line-inner');
        if (inner) heading.appendChild(inner);
        else heading.appendChild(headLine);
        headLine.remove();
        card.appendChild(heading);

        for (let k = 1; k < group.length; k += 1) {
          const node = group[k];
          if (isDrawBlock(node)) {
            flushText();
            body.appendChild(node);
          } else if (node.classList.contains('plain-line--empty')) {
            node.remove();
          } else {
            appendText(node);
          }
        }

        card.appendChild(body);
      }

      i = j;
    }
  }

  /** 連續結構圖：2 欄以上 grid 橫排（無子項標題時） */
  function wrapConsecutiveDrawBlocks(root) {
    const children = Array.from(root.children);
    let i = 0;
    while (i < children.length) {
      if (!isDrawBlock(children[i])) {
        i += 1;
        continue;
      }

      const run = [];
      let j = i;
      while (j < children.length && isDrawBlock(children[j])) {
        run.push(children[j]);
        j += 1;
      }

      if (run.length >= 2) {
        const grid = document.createElement('div');
        grid.className = 'structure-draw-grid';
        root.insertBefore(grid, run[0]);
        run.forEach((node) => grid.appendChild(node));
      }

      i = j;
    }
  }

  function apply(container) {
    const root = getLayoutRoot(container);
    if (!root) return;
    wrapSubitemCards(root);
    wrapConsecutiveDrawBlocks(root);
  }

  global.StructureLayout = { apply, wrapSubitemCards, wrapConsecutiveDrawBlocks };
})(typeof window !== 'undefined' ? window : globalThis);
