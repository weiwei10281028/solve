/*
 * Public GitHub build: API transport intentionally omitted.
 * This file contains no provider endpoint, proxy configuration, or credential.
 */
(function () {
  const unavailable = () => Promise.reject(new Error('公開版本未包含 API 功能；請在本機使用私有 API 模組。'));
  window.callAPI = unavailable;
  window.extractImageMatchHints = unavailable;
})();
