/**
 * js/molfile-draw.js — 預存 Molfile/SDF 結構繪圖（獨立模組）
 * 依賴：OpenChemLib（按需載入 CDN）
 * 資料：structures/index.json + structures/*.mol
 * 標記格式（預留）：@@MOL:aspirin@@ 或 @@MOL:aspirin|阿斯匹靈@@
 */
(function (global) {
  'use strict';

  const OCL_CDN = 'https://cdn.jsdelivr.net/npm/openchemlib@9.12.0/dist/openchemlib.js';
  const STRUCT_INDEX = 'structures/index.json';
  const INLINE_RE = /^@@MOL:([^|@\n]+)(?:\|([^\n@]+))?@@$/i;
  const DRAW_SIZE = { width: 168, height: 108 };

  let oclPromise = null;
  let indexPromise = null;
  let uid = 0;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nextId() {
    uid += 1;
    return `molfile-draw-${Date.now()}-${uid}`;
  }

  function extractMolBlock(text) {
    const s = String(text || '').trim();
    if (!s) return '';
    const end = s.indexOf('M  END');
    if (end >= 0) return s.slice(0, end + 6);
    const dollar = s.indexOf('$$$$');
    if (dollar >= 0) return s.slice(0, dollar).trim();
    return s;
  }

  async function loadOCL() {
    if (global.OCL?.Molecule) return global.OCL;
    if (!oclPromise) {
      oclPromise = import(OCL_CDN).then((mod) => {
        global.OCL = mod.default || mod;
        return global.OCL;
      });
    }
    return oclPromise;
  }

  function getBundle() {
    return global.STRUCTURES_BUNDLE || null;
  }

  function buildIndexMap(data) {
    const map = new Map();
    for (const entry of data.entries || []) {
      if (!entry?.id || !entry?.file) continue;
      map.set(entry.id, entry);
      for (const alias of entry.aliases || []) {
        if (!alias) continue;
        map.set(alias, entry);
        if (/^[A-Za-z]/.test(alias)) map.set(alias.toLowerCase(), entry);
      }
    }
    return { raw: data, map };
  }

  async function loadIndex(force = false) {
    if (!force && indexPromise) return indexPromise;
    indexPromise = (async () => {
      const bundle = getBundle();
      if (bundle?.index) {
        return { ...buildIndexMap(bundle.index), source: 'bundle' };
      }
      try {
        const r = await fetch(STRUCT_INDEX);
        if (!r.ok) throw new Error(`讀取 ${STRUCT_INDEX} 失敗（HTTP ${r.status}）`);
        return { ...buildIndexMap(await r.json()), source: 'fetch' };
      } catch (err) {
        if (bundle?.index) {
          return { ...buildIndexMap(bundle.index), source: 'bundle-fallback' };
        }
        throw new Error('無法讀取結構目錄。請用「啟動網頁.bat」開啟 http://localhost:8080/');
      }
    })();
    return indexPromise;
  }

  async function fetchMolText(entry) {
    const bundle = getBundle();
    const file = entry?.file;
    if (file && bundle?.files?.[file]) return bundle.files[file];
    const path = entry.path || `structures/${entry.file}`;
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (err) {
      if (file && bundle?.files?.[file]) return bundle.files[file];
      throw new Error(`無法讀取 ${path}。請用「啟動網頁.bat」開啟，或確認 structures-bundle.js 已載入`);
    }
  }

  function showFallback(wrap, detail, message) {
    const slot = wrap.querySelector('.molfile-draw-slot');
    if (slot) slot.innerHTML = '';
    let fb = wrap.querySelector('.molfile-draw-fallback');
    if (!fb) {
      fb = document.createElement('p');
      fb.className = 'molfile-draw-fallback';
      wrap.insertBefore(fb, wrap.firstChild);
    }
    fb.innerHTML = `${esc(message || '結構圖無法繪製')}<code>${detail ? `：${esc(detail)}` : ''}</code>`;
  }

  function createBlock(label) {
    const wrap = document.createElement('div');
    wrap.className = 'molfile-draw-block';
    const slot = document.createElement('div');
    slot.className = 'molfile-draw-slot';
    wrap.appendChild(slot);
    if (label) {
      const cap = document.createElement('p');
      cap.className = 'molfile-draw-label';
      cap.textContent = label;
      wrap.appendChild(cap);
    }
    return { wrap, slot };
  }

  async function renderMolText(block, molText, label) {
    const { wrap, slot } = block;
    try {
      const OCL = await loadOCL();
      const molBlock = extractMolBlock(molText);
      const mol = OCL.Molecule.fromMolfile(molBlock);
      const svg = mol.toSVG(DRAW_SIZE.width, DRAW_SIZE.height, nextId(), {
        autoCrop: true,
        autoCropMargin: 6
      });
      slot.innerHTML = svg;
      wrap.querySelector('.molfile-draw-fallback')?.remove();
      if (label) {
        let cap = wrap.querySelector('.molfile-draw-label');
        if (!cap) {
          cap = document.createElement('p');
          cap.className = 'molfile-draw-label';
          wrap.appendChild(cap);
        }
        cap.textContent = label;
      }
      return { ok: true, node: wrap };
    } catch (err) {
      showFallback(wrap, String(err?.message || err), '繪製失敗');
      return { ok: false, node: wrap, error: String(err?.message || err) };
    }
  }

  /** 依 structures/index.json 的 id 載入並繪圖 */
  async function drawById(id, labelOverride) {
    const block = createBlock('');
    try {
      const { map } = await loadIndex();
      const entry = map.get(String(id || '').trim());
      if (!entry) {
        showFallback(block.wrap, id, '找不到結構 id');
        return { ok: false, node: block.wrap, error: 'not found' };
      }
      const molText = await fetchMolText(entry);
      const label = labelOverride || entry.label || entry.name_en || entry.id;
      return renderMolText(block, molText, label);
    } catch (err) {
      const msg = String(err?.message || err);
      showFallback(block.wrap, id, msg.includes('fetch') || msg.includes('讀取')
        ? '載入失敗，已改用內建備援或請用啟動網頁.bat'
        : msg);
      return { ok: false, node: block.wrap, error: msg };
    }
  }

  /** 直接以 Molfile 字串繪圖 */
  async function drawFromText(molText, label) {
    const block = createBlock('');
    return renderMolText(block, molText, label || '');
  }

  function replacePlainLine(inner, node) {
    const line = inner.closest('.plain-line');
    if (line) line.replaceWith(node);
    else inner.replaceWith(node);
  }

  /** 掃描 @@MOL:id@@ 標記（預留，供詳解整合） */
  async function scan(root) {
    const el = root && root.querySelector ? root : document;
    const targets = [...el.querySelectorAll('.plain-line-inner')].filter((inner) => {
      return INLINE_RE.test((inner.textContent || '').trim());
    });
    if (!targets.length) return 0;

    await Promise.all(targets.map(async (inner) => {
      const m = (inner.textContent || '').trim().match(INLINE_RE);
      if (!m) return;
      const result = await drawById(m[1].trim(), (m[2] || '').trim());
      if (result.node) replacePlainLine(inner, result.node);
    }));

    return targets.length;
  }

  /** 主控台／預覽頁測試：MolfileDraw.show('aspirin', container) */
  async function show(idOrMolText, container, opts) {
    opts = opts || {};
    const parent = container || document.getElementById('molfilePreviewArea') || document.body;
    if (opts.rawMol) {
      const result = await drawFromText(idOrMolText, opts.label || '');
      parent.appendChild(result.node);
      return result;
    }
    const result = await drawById(idOrMolText, opts.label || '');
    parent.appendChild(result.node);
    return result;
  }

  /** 解析 @@MOL:aspirin@@ 或 @@MOL:aspirin|阿斯匹靈@@ */
  function parseRequest(text) {
    const m = String(text || '').trim().match(INLINE_RE);
    if (!m) return null;
    return { id: m[1].trim(), label: (m[2] || '').trim() };
  }

  global.MolfileDraw = {
    loadIndex,
    drawById,
    drawFromText,
    scan,
    show,
    parseRequest,
    extractMolBlock
  };
})(typeof window !== 'undefined' ? window : globalThis);
