/** 章節類型與作答格式的單一 solveSpec 來源。 */
(function (global) {
  'use strict';
  const CHAPTERS = Object.freeze({
    atomic: ['原子結構與週期表', '電子組態、週期趨勢、游離能、原子半徑', /電子組態|游離能|原子半徑|週期表|電負度|價電子/, ['電子組態或週期位置', '比較依據', '結論']],
    bonding: ['化學鍵與分子結構', '路易斯結構、VSEPR、混成、鍵角、分子形狀', /路易斯|VSEPR|混成|鍵角|分子形狀|孤對電子|八隅體/, ['結構或價電子判斷', '電子對／鍵結推論', '結論']],
    stoichiometry: ['化學計量', '配平、莫耳比、限量試劑、產率與單位換算', /莫耳|限量試劑|產率|配平|化學計量|質量.*莫耳|莫耳.*質量/, ['配平反應式', '莫耳比或換算', '結論']],
    gases: ['氣體', '理想氣體、分壓、氣體定律與收集氣體', /氣體|分壓|PV=nRT|波以耳|查理|道耳頓/, ['已知條件', '氣體關係式', '結論']],
    solutions: ['溶液與濃度', '濃度、稀釋、溶解度、依數性質', /濃度|莫耳濃度|稀釋|溶解度|重量百分濃度|凝固點|沸點上升/, ['濃度定義或條件', '代入或比較', '結論']],
    acidbase: ['酸鹼', '酸鹼反應、pH、滴定、Ka、Kb、緩衝溶液', /酸鹼|pH|pOH|滴定|Ka|Kb|緩衝|中和/, ['酸鹼角色或反應式', '當量或平衡關係', '結論']],
    redox: ['氧化還原與電化學', '氧化數、氧化劑、還原劑、原電池與電解', /氧化還原|氧化數|氧化劑|還原劑|原電池|電解|電極電位/, ['氧化數或半反應', '失得電子／電極判斷', '結論']],
    equilibrium: ['化學平衡', '平衡移動、Kc、Kp、反應商與平衡表', /平衡常數|K_c|Kp|平衡移動|勒夏特列|反應商|ICE/, ['平衡條件或反應式', '平衡關係或變化表', '結論']],
    kinetics: ['反應速率', '速率律、碰撞理論、活化能與催化', /反應速率|速率律|活化能|催化|初速率|碰撞理論/, ['影響因子或速率關係', '推論或速率式', '結論']],
    organic: ['有機化學', '官能基、命名、異構物與有機反應', /有機|官能基|異構|烷|烯|炔|醇|酯|苯|聚合/, ['官能基或結構辨識', '反應／性質推論', '結論']],
    experiment: ['實驗與數據判讀', '實驗設計、觀察、誤差與圖表資料', /實驗|誤差|數據|圖表|觀察|控制變因|滴定管/, ['資料或實驗條件', '判讀依據', '結論']]
  });
  const FORMATS = Object.freeze({
    choice: ['選擇題逐項分析', '判斷依據、各選項分析如下、答案', ['判斷依據', '各選項分析如下']],
    calculation: ['計算題四步推導', '已知與目標、關係式、代入計算、結論', ['已知與目標', '關係式', '代入計算', '結論']],
    concept: ['概念／性質三步判斷', '判斷依據、推論過程、結論', ['判斷依據', '推論過程', '結論']]
  });
  function ids(values, map) { const seen={}; return (Array.isArray(values)?values:[]).filter(id=>map[id]&&!seen[id]&&(seen[id]=true)); }
  function detectChapters(text) { const q=String(text||''); return Object.keys(CHAPTERS).filter(id=>CHAPTERS[id][2].test(q)).slice(0,3); }
  function create(input) {
    input=input||{}; const chapterIds=ids(input.chapterIds,CHAPTERS), formatIds=ids(input.formatIds,FORMATS);
    return {version:2, chapterIds, formatIds, chapters:chapterIds.map(id=>({id,label:CHAPTERS[id][0],description:CHAPTERS[id][1],steps:CHAPTERS[id][3],applicability:'uncertain'})), formats:formatIds.map(id=>({id,label:FORMATS[id][0],rule:FORMATS[id][1],steps:FORMATS[id][2]})), enabled:!!(chapterIds.length||formatIds.length), autoCandidates:[]};
  }
  function fromInputs(root) { const h=root||document; return create({chapterIds:[...h.querySelectorAll('input[data-chapter-id]:checked')].map(x=>x.dataset.chapterId),formatIds:[...h.querySelectorAll('input[data-solve-type]:checked')].map(x=>x.dataset.solveType)}); }
  function withApplicability(spec, question) { const next=create(spec); const detected=detectChapters(question); next.autoCandidates=detected; next.chapters=next.chapters.map(c=>({...c,applicability:!detected.length?'uncertain':(detected.includes(c.id)?'applicable':'not-applicable')})); return next; }
  function describe(spec) { if(!spec?.enabled) return spec?.autoCandidates?.length?'自動候選：'+spec.autoCandidates.map(id=>CHAPTERS[id][0]).join('、')+'。未強制套用。':'未啟用章節或格式規格，將依題目自動判斷。'; const active=[...spec.chapters.filter(c=>c.applicability!=='not-applicable').map(c=>c.label),...spec.formats.map(f=>f.label)]; const skipped=spec.chapters.filter(c=>c.applicability==='not-applicable').map(c=>c.label); return '已啟用：'+active.join('、')+(skipped.length?'；不適用而未強制：'+skipped.join('、'):'')+'。'; }
  function buildUserBlock(spec) { if(!spec?.enabled)return ''; const lines=['【解題規格｜只套用本題適用項】']; spec.chapters.filter(c=>c.applicability!=='not-applicable').forEach(c=>lines.push('【章節：'+c.label+'】依序呈現：'+c.steps.join(' → ')+'。')); spec.formats.forEach(f=>lines.push('【格式：'+f.label+'】'+f.rule+'。')); return lines.length>1?lines.join('\n'):''; }
  function checkReply(spec,reply) { if(!spec?.enabled)return []; const text=String(reply||''), issues=[]; [...spec.chapters.filter(c=>c.applicability!=='not-applicable').map(c=>[c.label,c.steps]),...spec.formats.map(f=>[f.label,f.steps])].forEach(([label,steps])=>steps.forEach(step=>{if(!text.includes(step))issues.push(label+'缺少「'+step+'」步驟。');})); return issues; }
  global.SolveSpec=Object.freeze({CHAPTERS,FORMATS,create,fromInputs,withApplicability,detectChapters,describe,buildUserBlock,checkReply});
})(typeof window!=='undefined'?window:globalThis);
