/**
 * js/board-formats.js — 板書版型（讀 database-bundle formats/）
 */
(function (global) {
  'use strict';

  function getFormatFiles() {
    const emb = typeof global.EMBEDDED_DATABASE !== 'undefined' ? global.EMBEDDED_DATABASE : {};
    if (emb.formats && Object.keys(emb.formats).length) return emb.formats;
    const files = emb.files || {};
    const out = {};
    Object.keys(files).forEach(function (key) {
      if (key.startsWith('formats/')) out[key] = files[key];
    });
    return out;
  }

  function parseFormat(raw, fileKey) {
    if (typeof global.entryFromDatabaseMd !== 'function') return null;
    const entry = global.entryFromDatabaseMd(String(raw || ''), fileKey);
    if (!entry || entry.meta?.kind !== 'format') return null;
    return {
      id: entry.id,
      file: fileKey,
      label: entry.meta.label || entry.id,
      layoutId: entry.meta.layout_id || '',
      inject: String(entry.meta.inject || '').toLowerCase() === 'always',
      priority: Number(entry.meta.priority) || 10,
      body: entry.solutionText || ''
    };
  }

  function loadFormats() {
    const files = getFormatFiles();
    const list = [];
    Object.keys(files).forEach(function (key) {
      const f = parseFormat(files[key], key);
      if (f && f.body) list.push(f);
    });
    list.sort(function (a, b) { return b.priority - a.priority; });
    return list;
  }

  function buildBoardFormatUserBlock() {
    const formats = loadFormats().filter(function (f) { return f.inject; });
    if (!formats.length) return '';
    const parts = formats.map(function (f) {
      return '### ' + f.label + '（' + f.layoutId + '）\n' + f.body.trim();
    });
    console.info('[板書版型]', formats.map(function (f) { return f.id; }).join(', '));
    return '\n\n[板書版型｜輸出須符合]\n'
      + parts.join('\n\n')
      + '\n\n數字依本題重算；版型只規定排版，不規定答案。';
  }

  function getRxnGridFormatSpec() {
    const f = loadFormats().find(function (x) { return x.layoutId === 'rxn-grid'; });
    return f ? f.body : '';
  }

  global.BoardFormats = {
    loadFormats,
    buildBoardFormatUserBlock,
    getRxnGridFormatSpec
  };
})(typeof window !== 'undefined' ? window : global);
