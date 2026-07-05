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
