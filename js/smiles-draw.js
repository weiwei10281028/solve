/**
 * js/smiles-draw.js — 分子結構 SMILES 繪圖（獨立模組）
 * 依賴：SmilesDrawer（CDN）
 * 標記格式：
 *   @@SMILES:CCO@@
 *   @@SMILES:c1ccccc1|苯@@
 *   @@SMILES@@\nCCO\n@@/SMILES@@
 */
(function (global) {
  'use strict';

  const BLOCK_RE = /@@SMILES@@\s*\n?\s*([^\n@]+?)\s*\n?\s*@@\/SMILES@@/gi;
  const INLINE_RE = /^@@SMILES:([^|@\n]+)(?:\|([^\n@]+))?@@$/i;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeBlock(body) {
    const raw = String(body || '').trim();
    if (!raw) return '';
    const pipe = raw.indexOf('|');
    if (pipe >= 0) {
      const smiles = raw.slice(0, pipe).trim();
      const label = raw.slice(pipe + 1).trim();
      return label ? `@@SMILES:${smiles}|${label}@@` : `@@SMILES:${smiles}@@`;
    }
    return `@@SMILES:${raw}@@`;
  }

  /** 將多行 SMILES 區塊壓成單行標記（在 render 前呼叫） */
  function preprocess(text) {
    return String(text || '').replace(BLOCK_RE, (_, body) => normalizeBlock(body));
  }

  const DRAW_OPTS = {
    width: 168,
    height: 108,
    padding: 8,
    bondThickness: 1,
    bondLength: 14,
    terminalCarbons: false
  };

  function normalizeSmiles(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    if (global.SmilesDrawer?.clean) s = global.SmilesDrawer.clean(s);
    return s;
  }

  function showFallback(wrap, smiles, message) {
    const slot = wrap.querySelector('.smiles-draw-slot');
    if (slot) slot.innerHTML = '';
    let fb = wrap.querySelector('.smiles-draw-fallback');
    if (!fb) {
      fb = document.createElement('p');
      fb.className = 'smiles-draw-fallback';
      wrap.insertBefore(fb, wrap.firstChild);
    }
    fb.innerHTML = `${esc(message || '結構圖無法繪製')}：<code>${esc(smiles)}</code>`;
  }

  function createBlock(smiles, label) {
    const wrap = document.createElement('div');
    wrap.className = 'smiles-draw-block';

    const slot = document.createElement('div');
    slot.className = 'smiles-draw-slot';
    wrap.appendChild(slot);

    if (label) {
      const cap = document.createElement('p');
      cap.className = 'smiles-draw-label';
      cap.textContent = label;
      wrap.appendChild(cap);
    }

    return { wrap, slot, smiles: normalizeSmiles(smiles) };
  }

  function renderInto(block) {
    const { wrap, slot, smiles } = block;
    return new Promise((resolve) => {
      const SD = global.SmilesDrawer;
      if (!SD?.Parser || !SD?.SvgDrawer) {
        showFallback(wrap, smiles, '繪圖套件未載入');
        resolve({ ok: false, node: wrap, error: 'no lib' });
        return;
      }
      if (!smiles) {
        showFallback(wrap, '', 'SMILES 為空');
        resolve({ ok: false, node: wrap, error: 'empty' });
        return;
      }

      try {
        const tree = SD.Parser.parse(smiles);
        const drawer = new SD.SvgDrawer(DRAW_OPTS);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'smiles-draw-svg');
        drawer.draw(tree, svg, 'light');
        slot.innerHTML = '';
        slot.appendChild(svg);
        wrap.querySelector('.smiles-draw-fallback')?.remove();
        resolve({ ok: true, node: wrap });
      } catch (err) {
        showFallback(wrap, smiles, '繪製失敗');
        resolve({ ok: false, node: wrap, error: String(err?.message || err) });
      }
    });
  }

  function drawSmiles(smiles, label) {
    const block = createBlock(smiles, label);
    return renderInto(block).then((r) => ({ ...r, node: block.wrap }));
  }

  function replacePlainLine(inner, node) {
    const line = inner.closest('.plain-line');
    if (line) line.replaceWith(node);
    else inner.replaceWith(node);
  }

  /** 掃描詳解區，將 @@SMILES:…@@ 行換成結構圖 */
  async function scan(root) {
    const el = root && root.querySelector ? root : document;
    const targets = [...el.querySelectorAll('.plain-line-inner')].filter((inner) => {
      return INLINE_RE.test((inner.textContent || '').trim());
    });
    if (!targets.length) return 0;

    await Promise.all(targets.map(async (inner) => {
      const m = (inner.textContent || '').trim().match(INLINE_RE);
      if (!m) return;
      const block = createBlock(m[1].trim(), (m[2] || '').trim());
      replacePlainLine(inner, block.wrap);
      await renderInto(block);
    }));

    return targets.length;
  }

  /** 主控台測試：SmilesDraw.test('CCO', document.getElementById('mainSolution')) */
  async function test(smiles, container) {
    const parent = container || document.body;
    const block = createBlock(smiles, '');
    parent.appendChild(block.wrap);
    return renderInto(block);
  }

  global.SmilesDraw = {
    preprocess,
    scan,
    draw: drawSmiles,
    test
  };
})(typeof window !== 'undefined' ? window : globalThis);
