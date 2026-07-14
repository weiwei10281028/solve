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
  function countSignals(text, patterns) { return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0); }
  function autoFormatId(question) {
    const q=String(question||'');
    const hasChoices=/\([A-EＡ-Ｅ]\)|選項/.test(q);
    const reactionSignals=countSignals(q,[/反應式|配平|反應/,/限量試劑|足量|過量/,/起始|變化|結果|反應前|反應後/,/生成|產生|消耗|剩餘|逸出/,/莫耳(?:數)?比|化學計量/]);
    const hasQuantity=/莫耳|mol|質量|體積|濃度|產率/.test(q);
    if(hasQuantity && reactionSignals>=2) return 'reaction_calculation';
    if(hasChoices) return 'choice';
    const calculationSignals=countSignals(q,[/計算|求(?:出|得)?/,/\d+(?:\.\d+)?\s*(?:mol|g|kg|mL|L|M|atm|kPa|%|秒|s)(?:\s|$|[,，。；])/i,/=|\d+\s*[×x*\/]/,/濃度|稀釋|氣體定律|pH|產率|單位換算|莫耳/]);
    if(calculationSignals>=2) return 'calculation';
    const conceptSignals=countSignals(q,[/比較|何者|判斷|原因|為何|性質|趨勢|正確|錯誤/,/電子組態|鍵角|混成|氧化數|酸鹼|平衡移動|反應速率/]);
    if(conceptSignals>=1 && !hasQuantity) return 'concept';
    return 'plain';
  }
  function route(spec, question, opts) {
    opts=opts||{};
    const manual=withApplicability(spec,question);
    if(opts.forceStoichiometry) return {id:'reaction_table',origin:'manual',solveSpec:manual,forceStoichiometry:true,forceCalcCompact:!!opts.forceCalcCompact};
    if(manual.formatIds.length || manual.chapterIds.length) return {id:'manual',origin:'manual',solveSpec:manual,forceStoichiometry:false,forceCalcCompact:!!opts.forceCalcCompact};
    const id=autoFormatId(question);
    const autoSpec=(id==='calculation'||id==='concept'||id==='choice'||id==='reaction_calculation')
      ? withApplicability(create({formatIds:[id==='reaction_calculation'?'calculation':id]}),question)
      : create({});
    autoSpec.autoRoute=id;
    return {id,origin:'auto',solveSpec:autoSpec,forceStoichiometry:id==='reaction_table'||id==='reaction_calculation',forceCalcCompact:!!opts.forceCalcCompact};
  }
  function describeRoute(value) {
    const routeValue=value||{};
    const labels={plain:'一般詳解',calculation:'計算題四步推導',concept:'概念／性質三步判斷',choice:'選擇題逐項分析',reaction_table:'反應方程式表',reaction_calculation:'反應表＋四步計算',manual:'手動格式'};
    return `${routeValue.origin==='manual'?'手動優先':'自動判斷'}：${labels[routeValue.id]||'一般詳解'}${routeValue.id==='plain'?'（題意不明確時不強制套版）':''}。`;
  }
  function buildRouteUserBlock(value) {
    if(!value || value.id==='plain' || value.id==='manual') return '';
    if(value.id==='reaction_table') return '【本機格式路由｜反應方程式表】題目同時涉及反應物種與量的變化。先寫配平反應式，再完整輸出起始／變化／結果三列；資料不足不可硬湊表格，改用一般詳解並說明不足。';
    if(value.id==='reaction_calculation') return '【本機格式路由｜反應表＋四步計算】先用反應方程式表整理反應物種與起始／變化／結果；再依「已知與目標、關係式、代入計算、驗算與結論」完成共用計算。若選項只是數字／比例，最後只需對照並寫答案，不必逐項重複計算。資料不足不可硬湊表格。';
    return `【本機格式路由】本題適合「${({calculation:'計算題四步推導',concept:'概念／性質三步判斷',choice:'選擇題逐項分析'})[value.id]}」；只套用此格式，不適用時回到一般詳解。`;
  }
  function describe(spec) { if(!spec?.enabled) return spec?.autoCandidates?.length?'自動候選：'+spec.autoCandidates.map(id=>CHAPTERS[id][0]).join('、')+'。未強制套用。':'未啟用章節或格式規格，將依題目自動判斷。'; const active=[...spec.chapters.filter(c=>c.applicability!=='not-applicable').map(c=>c.label),...spec.formats.map(f=>f.label)]; const skipped=spec.chapters.filter(c=>c.applicability==='not-applicable').map(c=>c.label); return '已啟用：'+active.join('、')+(skipped.length?'；不適用而未強制：'+skipped.join('、'):'')+'。'; }
  function buildUserBlock(spec) { if(!spec?.enabled)return ''; const lines=['【解題規格｜只套用本題適用項】']; spec.chapters.filter(c=>c.applicability!=='not-applicable').forEach(c=>lines.push('【章節：'+c.label+'】依序呈現：'+c.steps.join(' → ')+'。')); spec.formats.forEach(f=>lines.push('【格式：'+f.label+'】'+f.rule+'。')); return lines.length>1?lines.join('\n'):''; }
  function checkReply(spec,reply) { if(!spec?.enabled)return []; const text=String(reply||''), issues=[]; [...spec.chapters.filter(c=>c.applicability!=='not-applicable').map(c=>[c.label,c.steps]),...spec.formats.map(f=>[f.label,f.steps])].forEach(([label,steps])=>steps.forEach(step=>{if(!text.includes(step))issues.push(label+'缺少「'+step+'」步驟。');})); return issues; }
  global.SolveSpec=Object.freeze({CHAPTERS,FORMATS,create,fromInputs,withApplicability,detectChapters,autoFormatId,route,describe,describeRoute,buildRouteUserBlock,buildUserBlock,checkReply});
})(typeof window!=='undefined'?window:globalThis);
