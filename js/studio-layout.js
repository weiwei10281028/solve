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

  const explanation = document.createElement('section');
  explanation.className = 'studio-field studio-note';
  explanation.innerHTML = '<div class="studio-field-head"><h2>補充說明</h2><span>選填</span></div>';
  explanation.append(note);
  grid.append(attachment, explanation);

  const advanced = document.createElement('details');
  advanced.className = 'studio-advanced';
  advanced.innerHTML = '<summary><span><b>進階設定</b><small>章節類型、作答格式、公式與計算偏好</small></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg></summary>';
  const advancedBody = document.createElement('div');
  advancedBody.className = 'studio-advanced-body';
  const advancedFirst = document.createElement('div');
  advancedFirst.className = 'studio-advanced-layout';
  advancedBody.append(advancedFirst);
  advanced.append(advancedBody);

  explanation.append(clearButton);

  const dock = document.createElement('div');
  dock.className = 'studio-solve-dock';
  dock.append(solveButton);

  actionRow.remove();
  panel.append(grid, advanced);
  document.body.append(dock);

  const chapterHost = document.getElementById('chapterOptions');
  const chapterSpec = chapterHost?.closest('.solve-spec');
  const formatSpec = document.getElementById('solveTypeChoice')?.closest('.solve-spec');
  if (!chapterHost || !chapterSpec || !formatSpec) return;

  const chapterControl = document.createElement('section');
  chapterControl.className = 'studio-chapter-control';
  chapterControl.innerHTML = `
    <h2>章節與作答方式</h2>
    <p>先選題目的章節，解題步驟會依它調整；不選時保持自動判斷。</p>
    <button class="studio-chapter-trigger" type="button" id="openChapterPicker"><span><b>章節類型</b><small id="chapterPickerSummary">尚未選取</small></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"></path></svg></button>`;
  chapterSpec.remove();
  const studySettings = document.createElement('section');
  studySettings.className = 'studio-advanced-block studio-study-settings';
  studySettings.innerHTML = '<div class="studio-advanced-block-head"><h2>章節與作答方式</h2><p>先選題目的章節，解題步驟會依它調整；不選時保持自動判斷。</p></div>';
  studySettings.append(chapterControl, formatSpec);
  const preferencesSettings = document.createElement('section');
  preferencesSettings.className = 'studio-advanced-block studio-preferences-settings';
  preferencesSettings.innerHTML = '<div class="studio-advanced-block-head"><h2>解題偏好</h2><p>調整反應式、計算與公式輸入方式。</p></div>';
  preferencesSettings.append(preferences, formula);
  advancedFirst.append(studySettings, preferencesSettings);

  const picker = document.createElement('dialog');
  picker.className = 'studio-chapter-dialog';
  picker.id = 'chapterPickerDialog';
  picker.innerHTML = `
    <div class="studio-dialog-head"><div><h2>選擇章節類型</h2><p>可複選 1–3 項；保留所有目前頁面的章節類型。</p></div><button type="button" class="studio-dialog-close" aria-label="關閉">×</button></div>
    <div class="studio-dialog-body"></div>
    <div class="studio-dialog-foot"><span id="chapterDialogStatus">尚未選取，將自動判斷</span><div><button type="button" class="btn-ghost studio-clear-chapters">清除</button><button type="button" class="btn-primary studio-apply-chapters">套用選擇</button></div></div>`;
  picker.querySelector('.studio-dialog-body').append(chapterHost);
  document.body.append(picker);

  const summary = picker.querySelector('#chapterPickerSummary') || document.getElementById('chapterPickerSummary');
  const dialogStatus = picker.querySelector('#chapterDialogStatus');
  const refreshChapterSummary = () => {
    const selected = [...chapterHost.querySelectorAll('input[data-chapter-id]:checked')].map((input) => input.closest('label')?.querySelector('.option-toggle-label')?.textContent?.trim()).filter(Boolean);
    const text = selected.length ? selected.join('、') : '尚未選取';
    document.getElementById('chapterPickerSummary').textContent = text;
    dialogStatus.textContent = selected.length ? `已選取：${text}` : '尚未選取，將自動判斷';
  };
  chapterHost.addEventListener('change', refreshChapterSummary);
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
