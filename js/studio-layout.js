/* 工作台的互動行為；版面結構已直接寫在 index.html，避免重新整理時閃現舊表單。 */
(() => {
  const chapterHost = document.getElementById('chapterOptions');
  const picker = document.getElementById('chapterPickerDialog');
  const chapterPreview = document.getElementById('chapterSelectionPreview');
  const summary = document.getElementById('chapterPickerSummary');
  const dialogStatus = document.getElementById('chapterDialogStatus');
  const openPicker = document.getElementById('openChapterPicker');
  if (!chapterHost || !picker || !chapterPreview || !summary || !dialogStatus || !openPicker) return;

  const refreshChapterSummary = () => {
    const selectedInputs = [...chapterHost.querySelectorAll('input[data-chapter-id]:checked')];
    const selected = selectedInputs.map((input) => input.closest('label')?.querySelector('.option-toggle-label')?.textContent?.trim()).filter(Boolean);
    const text = selected.length ? selected.join('、') : '尚未選取';
    summary.textContent = text;
    dialogStatus.textContent = selected.length ? `已選取：${text}` : '尚未選取，將自動判斷';

    const question = document.getElementById('textQuestionInput')?.value?.trim() || '';
    const baseSpec = window.SolveSpec?.create
      ? window.SolveSpec.create({ chapterIds: selectedInputs.map((input) => input.dataset.chapterId) })
      : null;
    const spec = baseSpec && question && window.SolveSpec?.withApplicability
      ? window.SolveSpec.withApplicability(baseSpec, question)
      : baseSpec;
    const chapters = spec?.chapters || [];
    if (!chapters.length) {
      chapterPreview.innerHTML = '<p class="studio-chapter-preview-empty">選取章節後，這裡會顯示本次解題實際加入的規格內容。</p>';
      return;
    }

    const applicabilityText = (chapter) => {
      if (!question) return '尚未輸入題目；解題時才會確認是否適用。';
      if (chapter.applicability === 'applicable') return '目前題目已命中此章節關鍵字，會加入解題規格。';
      if (chapter.applicability === 'not-applicable') return '目前題目未命中此章節關鍵字，不會強制加入解題規格。';
      return '目前無法確認，解題時會保留為可用規格。';
    };
    const topicStateText = (topic) => {
      if (!question) return '等待題目判定';
      if (topic.applicability === 'applicable') return '本次套用';
      if (topic.applicability === 'not-applicable') return '本題不套用';
      return '可用細項';
    };
    chapterPreview.innerHTML = `
      <div class="studio-chapter-preview-head"><span>本次解題會參考</span><small>章節規格與細項推理，不是額外題庫答案</small></div>
      <div class="studio-chapter-preview-list">${chapters.map((chapter) => `
        <article class="studio-chapter-preview-card${chapter.applicability === 'not-applicable' ? ' is-skipped' : ''}">
          <div><h3>${chapter.label}</h3><p>${chapter.description}</p></div>
          <dl><div><dt>章節解題步驟</dt><dd>${chapter.steps.join(' → ')}</dd></div><div><dt>目前判定</dt><dd>${applicabilityText(chapter)}</dd></div></dl>
          <details class="studio-chapter-topic-details"${chapter.topics.some((topic) => topic.applicability === 'applicable') ? ' open' : ''}>
            <summary>細項 ${chapter.topics.length} 項${chapter.matchedTopicIds?.length ? `：本次命中 ${chapter.matchedTopicIds.length} 項` : '：依題目自動判定'}</summary>
            <ul>${chapter.topics.map((topic) => `<li class="is-${topic.applicability}"><div><b>${topic.label}</b><span>${topic.description}</span></div><em>${topicStateText(topic)}</em></li>`).join('')}</ul>
          </details>
        </article>`).join('')}</div>
      <p class="studio-chapter-preview-source">細項規格會隨題目改變：只有命中的細項才會加入 AI 的解題提示與回覆檢核；不會因為勾選而額外載入題庫、講義或既有答案。</p>`;
  };

  chapterHost.addEventListener('change', refreshChapterSummary);
  document.getElementById('textQuestionInput')?.addEventListener('input', refreshChapterSummary);
  refreshChapterSummary();
  openPicker.addEventListener('click', () => picker.showModal());
  picker.querySelector('.studio-dialog-close')?.addEventListener('click', () => picker.close());
  picker.querySelector('.studio-apply-chapters')?.addEventListener('click', () => picker.close());
  picker.querySelector('.studio-clear-chapters')?.addEventListener('click', () => {
    chapterHost.querySelectorAll('input[data-chapter-id]').forEach((input) => { input.checked = false; });
    window.updateSolveSpecStatus?.();
    refreshChapterSummary();
  });
})();
