/** chem-structure.js - combined structure resolver, drawers, and layout. */

/* ---- js\mol-resolver.js ---- */
/**
 * js/mol-resolver.js — 由標籤／化學式對應 STRUCTURES_BUNDLE id
 */
(function (global) {
  'use strict';

  /** 標籤關鍵字 → bundle id（優先於自動比對） */
  const LABEL_HINTS = [
    [/SO[₃3]²[⁻\-]|SO3\s*2-|亞硫酸根/, '亞硫酸根'],
    [/SO[₄4]²?[⁻\-]?|硫酸根/, '硫酸根'],
    [/NO[₃3][⁻\-]?|硝酸根/, '硝酸根'],
    [/NO[₂2][⁻\-]?|亞硝酸根/, '亞硝酸根'],
    [/CO[₃3]²?[⁻\-]?|碳酸根離子|碳酸根/, '碳酸根'],
    [/BF[₄4][⁻\-]?|四氟化硼/, '四氟化硼根'],
    [/SO[₃3](?![²2])|三氧化硫/, '三氧化硫'],
    [/SO[₂2]/, '二氧化硫'],
    [/BF[₃3]/, '三氟化硼'],
    [/PCl[₃3]/, '三氯化磷'],
    [/PF[₅5]/, '五氟化磷'],
    [/SF[₆6]/, '六氟化硫'],
    [/NF[₃3]/, '三氟化氮'],
    [/NCl[₃3]/, '三氯化氮'],
    [/CF[₄4]/, '四氟化碳'],
    [/CO[₂2]/, '二氧化碳'],
    [/(?<![A-Za-z])CO(?![₂2O]|₃)/, '一氧化碳'],
    [/O[₃3]/, '臭氧'],
    [/H[₂2]O[₂2]|過氧化氫|H₂O₂/, '過氧化氫'],
    [/OF[₂2]/, '二氟化氧'],
    [/N[₂2]O[₄4]/, '四氧化二氮'],
    [/N[₂2]H[₄4]|肼|聯氨/, '聯氨'],
    [/NH[₄4][⁺+]?|銨根/, '銨根離子'],
    [/NH[₃3]/, '氨'],
    [/H[₃3]O[⁺+]|水合氫/, '水合氫離子'],
    [/HCN|氰化氫/, '氰化氫'],
    [/CHCl[₃3]|三氯甲烷|氯仿|chloroform/i, '三氯甲烷'],
    [/CHBr[₃3]|三溴甲烷|溴仿/, '三溴甲烷'],
    [/CHI[₃3]|三碘甲烷|碘仿/, '三碘甲烷'],
    [/CHF[₃3]|三氟甲烷/, '三氟甲烷'],
    [/CH[₂2]Cl[₂2]|二氯甲烷/, '二氯甲烷'],
    [/CH[₃3]Cl|氯甲烷|一氯甲烷/, '氯甲烷'],
    [/CH[₃3]Br|溴甲烷/, '溴甲烷'],
    [/CH[₃3]I|碘甲烷/, '碘甲烷'],
    [/CH[₃3]F|氟甲烷/, '氟甲烷'],
    [/CCl[₄4]|四氯化碳/, '四氯化碳'],
    [/CF[₄4]|四氟化碳/, '四氟化碳'],
    [/CBr[₄4]|四溴化碳/, '四溴化碳'],
    [/CI[₄4]|四碘化碳/, '四碘化碳'],
    [/(?<![A-Za-z0-9])HCl(?![A-Za-z0-9])|(?<![A-Za-z])氯化氫(?![A-Za-z])/, '氯化氫'],
    [/(?<![A-Za-z0-9])HF(?![A-Za-z0-9])|(?<![A-Za-z])氟化氫(?![A-Za-z])/, '氟化氫'],
    [/(?<![A-Za-z0-9])HBr(?![A-Za-z0-9])|(?<![A-Za-z])溴化氫(?![A-Za-z])/, '溴化氫'],
    [/(?<![A-Za-z0-9])HI(?![A-Za-z0-9])|(?<![A-Za-z])碘化氫(?![A-Za-z])/, '碘化氫'],
    [/H[₂2]O(?![₂2])/, '水'],
    [/NaF|氟化鈉/, '氟化鈉'],
    [/KBr|溴化鉀/, '溴化鉀'],
    [/KCl|氯化鉀/, '氯化鉀'],
    [/BeCl[₂2]/, '二氯化鈹'],
    [/CCO|乙醇/, '乙醇'],
    [/c1ccccc1|苯(?!環)/, '苯'],
    [/C=C=C|丙二烯/, '丙二烯'],
    [/C#C|乙炔/, '乙炔'],
    [/C=C|乙烯/, '乙烯'],
    [/^CC[^O#=]|乙烷/, '乙烷'],
    [/CH[₄4]|甲烷/, '甲烷'],
    [/ClCl|Cl[₂2]|氯氣/, '氯氣'],
    [/O=O|O[₂2]/, '氧氣'],
    [/N#N|N[₂2]/, '氮氣'],
    [/\[H\]\[H\]|H[₂2](?!O)|氫分子|氫氣/, '氫氣'],
    [/H[₂2]S|硫化氫/, '硫化氫'],
    [/OCl[₂2]/, '二氯化硫'],
    [/ClOCl/, '二氯化硫'],
  ];

  function norm(s) {
    return String(s || '')
      .replace(/\s+/g, '')
      .replace(/[＋+]/g, '+')
      .replace(/[⁻−-]/g, '-')
      .toLowerCase();
  }

  function buildLookup() {
    const bundle = global.STRUCTURES_BUNDLE;
    if (!bundle?.index?.entries) return new Map();
    const map = new Map();
    for (const entry of bundle.index.entries) {
      if (!entry?.id) continue;
      map.set(entry.id, entry);
      map.set(norm(entry.id), entry);
      if (entry.label) map.set(norm(entry.label), entry);
      if (entry.formula) map.set(norm(entry.formula), entry);
      if (entry.name_en) map.set(norm(entry.name_en), entry);
      if (entry.common) map.set(norm(entry.common), entry);
      for (const a of entry.aliases || []) {
        if (!a) continue;
        map.set(a, entry);
        map.set(norm(a), entry);
      }
    }
    return map;
  }

  let lookupCache = null;

  function getLookup() {
    if (!lookupCache) lookupCache = buildLookup();
    return lookupCache;
  }

  function resetLookup() {
    lookupCache = null;
  }

  function formulaTokenMatch(text, key) {
    const t = norm(text);
    const k = norm(key);
    if (!k || k.length < 2) return false;
    if (t === k) return true;
    const re = new RegExp(`(?:^|[\\s,，、；;：:（(「『]|画|畫|绘|繪|结构|結構|式|的|是|请|請|看|出|画)${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s,，、；;：:）)」』])`, 'i');
    if (re.test(String(text || ''))) return true;
    // 化學式 token：前後不可再接英數（避免 CHCl3 命中 hcl）
    const chemRe = new RegExp(`(?<![A-Za-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i');
    return chemRe.test(String(text || ''));
  }

  /** 由 @@SMILES:…|標籤@@ 或純標籤解析 bundle id */
  function resolveMolId(label, smiles) {
    const text = String(label || '').trim();
    const smi = String(smiles || '').trim();
    if (!text && !smi) return null;

    const map = getLookup();
    const candidates = [text, smi];
    const parts = text.split(/[（(]/)[0].trim();
    if (parts && parts !== text) candidates.push(parts);

    for (const c of candidates) {
      if (!c) continue;
      const hit = map.get(c) || map.get(norm(c));
      if (hit?.id) return hit.id;
    }

    for (const [re, id] of LABEL_HINTS) {
      if (re.test(text) || (smi && re.test(smi))) {
        if (map.get(id)) return id;
      }
    }

    let best = null;
    let bestLen = 0;
    for (const [key, entry] of map.entries()) {
      if (key.length < 2) continue;
      if (formulaTokenMatch(text, key) || (smi && formulaTokenMatch(smi, key))) {
        if (key.length > bestLen) {
          bestLen = key.length;
          best = entry.id;
        }
      }
    }
    return best;
  }

  /** @@SMILES:smi|label@@ → { id, label } 或 null */
  function resolveFromSmilesLine(line) {
    const t = String(line || '').trim();
    const labeled = /^@@SMILES:([^|\n]+)\|([^\n]+)@@$/i.exec(t);
    const plain = /^@@SMILES:([^\n]+)@@$/i.exec(t);
    let smiles = '';
    let label = '';
    if (labeled) {
      smiles = labeled[1].trim();
      label = labeled[2].trim();
    } else if (plain) {
      smiles = plain[1].trim();
      label = plain[1].trim();
    } else return null;
    const id = resolveMolId(label, smiles);
    if (!id) return null;
    return { id, label: label || id };
  }

  /** 預處理：可對應的 @@SMILES 改寫為 @@MOL */
  function preprocessSmilesToMol(text) {
    return String(text || '').replace(/^@@SMILES:([^\n]+)@@$/gim, (full) => {
      const resolved = resolveFromSmilesLine(full);
      if (!resolved) return full;
      const cap = resolved.label ? `|${resolved.label}` : '';
      return `@@MOL:${resolved.id}${cap}@@`;
    });
  }

  /** @@MOL:id|label@@ → 解析 bundle id */
  function resolveFromMolLine(line) {
    const t = String(line || '').trim();
    const labeled = /^@@MOL:([^|@\n]+)(?:\|([^\n@]+))?@@$/i.exec(t);
    if (!labeled) return null;
    const raw = labeled[1].trim();
    const label = (labeled[2] || labeled[1] || '').trim();
    const map = getLookup();
    const direct = map.get(raw) || map.get(norm(raw));
    if (direct?.id) return { id: direct.id, label: label || direct.label || direct.id };
    const resolved = resolveMolId(label || raw, '');
    if (resolved) return { id: resolved, label: label || resolved };
    return { id: raw, label: label || raw };
  }

  global.MolResolver = {
    resolveMolId,
    resolveFromSmilesLine,
    resolveFromMolLine,
    preprocessSmilesToMol,
    resetLookup,
    LABEL_HINTS
  };
})(typeof window !== 'undefined' ? window : globalThis);


/* ---- js\molfile-draw.js ---- */
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

  /** 依 structures/index.json 的 id 載入並繪圖（id 可為 bundle id、中文名或化學式） */
  async function drawById(id, labelOverride) {
    const block = createBlock('');
    try {
      const { map } = await loadIndex();
      const rawId = String(id || '').trim();
      let entry = map.get(rawId);
      if (!entry && /離子$/.test(rawId)) {
        entry = map.get(rawId.replace(/離子$/, ''));
      }
      if (!entry && /^[A-Za-z]/.test(rawId)) {
        entry = map.get(rawId.toLowerCase());
      }
      if (!entry && global.MolResolver?.resolveMolId) {
        const resolved = global.MolResolver.resolveMolId(rawId, labelOverride || '');
        if (resolved) entry = map.get(resolved);
      }
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

  /** 解析 @@MOL:aspirin@@ 或 @@MOL:aspirin|阿斯匹靈@@；亦支援自然語言「畫苯的結構」 */
  function parseRequest(text) {
    const s = String(text || '').trim();
    const m = s.match(INLINE_RE);
    if (m) return { id: m[1].trim(), label: (m[2] || '').trim() };
    if (/畫|繪|結構|鍵線|路易斯|長什麼|長怎樣|結構式/.test(s) && global.MolResolver?.resolveMolId) {
      const id = global.MolResolver.resolveMolId(s, '');
      if (id) return { id, label: id };
    }
    return null;
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


/* ---- js\structure-layout.js ---- */
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
    if (container.classList?.contains('chem-markdown')) return container;
    return container.querySelector('.chem-markdown') || container;
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

      // 只有真正包含結構圖時才建立卡片；一般題目的 (a)～(d) 敘述
      // 不可被誤包成另一層白色區塊。
      const hasDrawBlock = group.slice(1).some(isDrawBlock);
      if (group.length >= 2 && hasDrawBlock) {
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


/* ---- js\smiles-draw.js ---- */
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

  const BLOCK_RE = /@@SMILES@@\s*\n?\s*([\s\S]+?)\s*\n?\s*@@\/SMILES@@/gi;

  /** 解析單行 @@SMILES:…@@（SMILES 可含立體標記 @，不可含 |） */
  function parseInlineLine(text) {
    const t = String(text || '').trim();
    const labeled = /^@@SMILES:([^|\n]+)\|([^\n]+)@@$/i.exec(t);
    if (labeled) {
      return { smiles: labeled[1].trim(), label: labeled[2].trim() };
    }
    const plain = /^@@SMILES:([^\n]+)@@$/i.exec(t);
    if (plain) return { smiles: plain[1].trim(), label: '' };
    return null;
  }

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
      return parseInlineLine(inner.textContent) !== null;
    });
    if (!targets.length) return 0;

    await Promise.all(targets.map(async (inner) => {
      const parsed = parseInlineLine(inner.textContent);
      if (!parsed) return;
      const block = createBlock(parsed.smiles, parsed.label);
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

