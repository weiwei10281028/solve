/** 新 reference 資料的最小本機檢索器；不取代舊 database 相容層。 */
(function (global) {
  'use strict';
  function terms(query) {
    return String(query || '').toLowerCase().split(/[\s,，、；;。()（）]+/).filter(function (term) { return term.length > 1; });
  }
  function search(records, query, limit) {
    const wanted = terms(query);
    const max = Math.max(1, Math.min(Number(limit) || 3, 3));
    return (Array.isArray(records) ? records : []).map(function (record) {
      const haystack = [record.title, record.content, (record.type_tags || []).join(' ')].join(' ').toLowerCase();
      const score = wanted.reduce(function (sum, term) { return sum + (haystack.includes(term) ? 1 : 0); }, 0);
      return { record: record, score: score };
    }).filter(function (item) { return item.score > 0 && item.record.verification !== 'rejected'; })
      .sort(function (a, b) { return b.score - a.score || String(a.record.id).localeCompare(String(b.record.id)); })
      .slice(0, max).map(function (item) { return item.record; });
  }
  global.ReferenceStore = Object.freeze({ search: search });
})(typeof window !== 'undefined' ? window : globalThis);
