/* 將正式解題功能安裝進 studio-home 的工作台骨架，不使用任何展示資料。 */
(() => {
  const panel = document.querySelector('.panel-input');
  const zone = document.getElementById('zone');
  const note = document.getElementById('textQuestionInput')?.closest('.field-group');
  const answer = document.getElementById('answerInput')?.closest('.field-group');
  const formula = document.getElementById('formulaTools');
  const preferences = document.querySelector('.solve-options');
  const specs = [...document.querySelectorAll('.solve-spec')];
  const actionRow = document.querySelector('.action-row');
  const solveButton = document.getElementById('solveBtn');
  const clearButton = actionRow?.querySelector('[onclick="clearAll()"]');
  const panelHead = panel?.querySelector('.panel-head');
  if (!panel || !zone || !note || !answer || !formula || !preferences || !actionRow || !solveButton || !clearButton) return;

  document.getElementById('appTitle').innerHTML = '把題目攤開，<span>一步一步看懂它。</span>';
  document.querySelector('.app-hero > p:last-child')?.remove();
  zone.querySelector('input')?.setAttribute('aria-label', '上傳題目圖片，最多兩張');
  zone.classList.add('studio-upload');

  const title = document.createElement('div');
  title.className = 'bench-title';
  title.innerHTML = '<span class="status-dot" aria-hidden="true"></span><strong>建立一份新題目</strong>';
  panelHead?.replaceWith(title);

  const grid = document.createElement('div');
  grid.className = 'studio-core-grid';
  const attachment = document.createElement('section');
  attachment.className = 'studio-field studio-attachment';
  attachment.innerHTML = '<div class="studio-field-head"><h2>題目附件與參考答案</h2><span>圖片最多 2 張</span></div>';
  const uploadRow = document.createElement('div');
  uploadRow.className = 'studio-upload-row';
  uploadRow.append(zone, document.getElementById('prevWrap'), document.getElementById('prevWrap2'));
  attachment.append(uploadRow, answer);

  grid.append(attachment);

  const explanation = document.createElement('details');
  explanation.className = 'studio-advanced studio-note';
  explanation.innerHTML = '<summary><span><b>補充說明</b><small>補充題意或指定作答範圍</small></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg></summary>';
  const explanationBody = document.createElement('div');
  explanationBody.className = 'studio-advanced-body';
  explanationBody.append(note, clearButton);
  explanation.append(explanationBody);

  const advanced = document.createElement('details');
  advanced.className = 'studio-advanced';
  advanced.innerHTML = '<summary><span><b>進階設定</b><small>章節類型、作答格式、公式與計算偏好</small></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg></summary>';
  const advancedBody = document.createElement('div');
  advancedBody.className = 'studio-advanced-body';
  const advancedFirst = document.createElement('div');
  advancedFirst.className = 'studio-advanced-layout';
  advancedBody.append(advancedFirst);
  advanced.append(advancedBody);

  const dock = document.createElement('div');
  dock.className = 'studio-solve-dock';
  dock.append(solveButton);

  actionRow.remove();
  panel.append(grid, explanation, advanced);
  document.body.append(dock);

  const chapterHost = document.getElementById('chapterOptions');
  const chapterSpec = chapterHost?.closest('.solve-spec');
  const formatSpec = document.getElementById('solveSpecTitle')?.closest('.solve-spec');
  if (!chapterHost || !chapterSpec) return;

  const chapterControl = document.createElement('section');
  chapterControl.className = 'studio-chapter-control';
  chapterControl.innerHTML = `
    <h2>章節與作答方式</h2>
    <p>先選大章節；系統會再依題目命中 Ka、滴定、Ksp、官能基等細項。</p>
    <button class="studio-chapter-trigger" type="button" id="openChapterPicker"><span><b>章節類型</b><small id="chapterPickerSummary">尚未選取</small></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"></path></svg></button>`;
  chapterSpec.remove();
  const studySettings = document.createElement('section');
  studySettings.className = 'studio-advanced-block studio-study-settings';
  studySettings.innerHTML = '<div class="studio-advanced-block-head"><h2>章節與作答方式</h2><p>先選大章節；系統會再依題目命中 Ka、滴定、Ksp、官能基等細項。</p></div>';
  studySettings.append(chapterControl);
  if (formatSpec) studySettings.append(formatSpec);
  const preferencesSettings = document.createElement('section');
  preferencesSettings.className = 'studio-advanced-block studio-preferences-settings';
  preferencesSettings.innerHTML = '<div class="studio-advanced-block-head"><h2>解題偏好</h2><p>調整反應式、計算與公式輸入方式。</p></div>';
  preferencesSettings.append(preferences, formula);
  advancedFirst.append(studySettings, preferencesSettings);

  const picker = document.createElement('dialog');
  picker.className = 'studio-chapter-dialog';
  picker.id = 'chapterPickerDialog';
  picker.innerHTML = `
    <div class="studio-dialog-head"><div><h2>選擇章節類型</h2><p>可複選 1–3 個大章節；細項會由題目自動命中並加強解題步驟。</p></div><button type="button" class="studio-dialog-close" aria-label="關閉">×</button></div>
    <div class="studio-dialog-body"></div>
    <div class="studio-dialog-foot"><span id="chapterDialogStatus">尚未選取，將自動判斷</span><div><button type="button" class="btn-ghost studio-clear-chapters">清除</button><button type="button" class="btn-primary studio-apply-chapters">套用選擇</button></div></div>`;
  const dialogBody = picker.querySelector('.studio-dialog-body');
  const chapterPreview = document.createElement('section');
  chapterPreview.className = 'studio-chapter-preview';
  chapterPreview.id = 'chapterSelectionPreview';
  chapterPreview.setAttribute('aria-live', 'polite');
  dialogBody.append(chapterHost, chapterPreview);
  document.body.append(picker);

  const summary = picker.querySelector('#chapterPickerSummary') || document.getElementById('chapterPickerSummary');
  const dialogStatus = picker.querySelector('#chapterDialogStatus');
  const refreshChapterSummary = () => {
    const selectedInputs = [...chapterHost.querySelectorAll('input[data-chapter-id]:checked')];
    const selected = selectedInputs.map((input) => input.closest('label')?.querySelector('.option-toggle-label')?.textContent?.trim()).filter(Boolean);
    const text = selected.length ? selected.join('、') : '尚未選取';
    document.getElementById('chapterPickerSummary').textContent = text;
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
  document.getElementById('openChapterPicker').addEventListener('click', () => picker.showModal());
  picker.querySelector('.studio-dialog-close').addEventListener('click', () => picker.close());
  picker.querySelector('.studio-apply-chapters').addEventListener('click', () => picker.close());
  picker.querySelector('.studio-clear-chapters').addEventListener('click', () => {
    chapterHost.querySelectorAll('input[data-chapter-id]').forEach((input) => { input.checked = false; });
    window.updateSolveSpecStatus?.();
    refreshChapterSummary();
  });
})();
