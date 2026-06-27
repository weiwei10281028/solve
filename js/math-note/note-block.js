/**
 * js/math-note/note-block.js — 組裝注入 user 訊息的 [NOTE 附錄]
 */
(function (global) {
  'use strict';

  function buildUserBlock(opts) {
    opts = opts || {};
    const parts = [];
    if (global.NoteRules?.buildAppendixText) {
      parts.push(global.NoteRules.buildAppendixText(opts));
    }
    if (global.NotePresets?.buildPresetAppendix) {
      parts.push(global.NotePresets.buildPresetAppendix(opts));
    }
    return parts.join('');
  }

  global.NoteBlock = {
    buildUserBlock
  };
})(typeof window !== 'undefined' ? window : globalThis);
