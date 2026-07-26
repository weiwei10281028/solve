/* 主解題固定為兩段：先產生審題備忘錄，再由解題 AI 輸出詳解。 */
function parseRequestedSolveScope(input) {
  const text = String(input || '');
  const numbers = [...text.matchAll(/第\s*(\d+)\s*題/g)].map(match => match[1]);
  return numbers.length ? { mode: 'partial', numbers } : { mode: 'default', numbers: [] };
}

const QUESTION_ANALYSIS_SYSTEM = `你是給第二段解題 AI 使用的審題壓縮器。使用繁體中文，只做風險標記，不寫詳解，不給最終答案。
第二段會重新閱讀完整題目；questionText 保留原題，memo 只放必要指令，不摘要、不重抄數據、不列普通公式。
memo 用機器可讀短句，最多 5 行、總長盡量少於 220 字。格式：
TYPE=題型；MUST=最優先門檻/計量/現象檢查
A:查決定性條件；B:查決定性條件；...
只保留會改變答案的最低成本檢查；省略「主張、必查、可能推翻點」等長標籤。
固定優先序：守恆/係數比 > 限量/過量 > 混合後條件/單位 > 現象成立 > 模型適用 > 數值比較。
若題目為秒錶/碘鐘反應，memo 第一行必含「TYPE=秒錶反應」，MUST 優先寫混合後莫耳數、顯色門檻、時間比較是否可用。
若題目為化學平衡移動題，memo 第一行必含「TYPE=化學平衡」，MUST 優先寫擾動瞬間的 Q 與 K 比較；溫度改變時另註明 K 改變。
若題目為溶度積或沉澱題，memo 第一行必含「TYPE=溶度積與沉澱」，MUST 優先寫反應後、混合後的自由離子濃度與 Qsp/Ksp 比較。
若題目為氧化還原或電化學題，memo 第一行必含「TYPE=氧化還原/電化學」，MUST 優先寫氧化還原半反應、電極角色或電子守恆。
若題目為化學計量題，memo 第一行必含「TYPE=化學計量」，MUST 優先寫配平反應式、各反應物莫耳數與 n/係數。
若題目為氣體狀態或水上集氣題，memo 第一行必含「TYPE=氣體與集氣」，MUST 優先寫目標氣體莫耳數與其乾氣分壓。
若題目為熱化學題，memo 第一行必含「TYPE=熱化學」，MUST 優先寫目標反應方向、物態與 ΔH 的對應關係。
若題目為有機反應或官能基檢驗題，memo 第一行必含「TYPE=有機反應」，MUST 優先寫官能基、試劑條件與現象可支持的範圍。
只回傳指定 JSON，不得輸出 Markdown 或其他文字。`;

const QUESTION_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questionText', 'memo'],
  properties: {
    questionText: { type: 'string' },
    memo: { type: 'string' }
  }
};

const CLOCK_REACTION_RULE_CARD = [
  'CARD=秒錶/碘鐘',
  'ORDER:n=C_stock*V_stock -> limiting/color_gate -> rate/time',
  'IO3-HSO3 gate: frac(n_(IO_3^-))(n_(HSO_3^-)) > frac(1)(3) 才可變藍；<= frac(1)(3) 則 no_blue/time_NA，錯因=莫耳數比未達顯色條件',
  'RATE_ORDER: 只用可比實驗；濃度用混合後濃度；same_threshold時才可用1/t比速率',
  'REDOX/LIMITING: 先依反應係數判還原劑、限量/過量、消耗順序',
  'I2_ACCUM: 顯色前I2不累積 => I2消耗步驟快於I2供應步驟',
  'PH: H+入反應式/速率式 => pH may affect rate',
  'TIME: gate_fail => 不變藍/time_NA；gate_pass才可換算變色時間'
].join('\n');

const ACID_BASE_RULE_CARD = [
  'CARD=酸鹼計算',
  'ORDER:n=C*V*equiv -> neutralize/region -> dominant_species -> equilibrium -> pH',
  'STRONG: excess strong acid/base controls pH；strong+strong eq=>neutral；禁止平均pH',
  'WEAK: Ka/Kb ICE；sqrt(K*C)近似須先驗x/C small，否則解二次式；弱酸/弱鹼不可當完全解離',
  'NEUTRALIZE: weak+strong before_eq=>buffer；eq=>conjugate hydrolysis；after_eq=>excess strong controls',
  'MIXING: 所有混合後濃度一律以 C_after=n/V_total 重算；兩溶液等體積混合且該物種未反應、未額外加入時，C_after=C_initial/2，禁止沿用原液濃度',
  'BUFFER: 需weak species與conjugate皆>0；先做強酸/強鹼消耗；acid:pH=pKa+log(n_base/n_acid)；base先算pOH',
  'TITRATION: 先用equiv moles分區；polyprotic逐當量點；first_eq常為amphiprotic；between_eq用對應Ka緩衝',
  'POLYPROTIC: 檢查Ka1/Ka2順序、物種守恆/電荷守恆；後續解離只有貢獻可忽略時才略過',
  'CHECK: concentration>=0；mass/charge balance；pH/pOH/Kw相容；混合後濃度用V_total',
  'FORBID: 未分區就套公式；H-H無雙組分；用stock C代混合後C；把當量點一律判pH=7'
].join('\n');

const CHEMICAL_EQUILIBRIUM_RULE_CARD = [
  'CARD=化學平衡',
  'ORDER:write reaction -> valid Q/K expression -> post-disturbance Q -> compare Q/K -> shift -> final trend',
  'K: 同一反應僅temperature改變K；concentration/pressure/volume/catalyst/inert不改變K',
  'EXPR: Q與K同物種同次方；pure solid/liquid activity=1，不列入；gas須與Kc/Kp種類一致',
  'COMPARE: Q<K=>向生成物；Q=K=>無淨移動；Q>K=>向反應物',
  'MIXING: 水溶液混合先以 C_after=n/V_total 重算各物種；兩溶液等體積混合且該物種未反應、未額外加入時，C_after=C_initial/2，再代入 Q 或 Kc',
  'CONC: 先算擾動瞬間實際濃度；只直接改被操作物種，再以Q/K判方向',
  'VOLUME/PRESSURE: 定溫體積改變使各氣體濃度或分壓同倍率變；重算Q；兩側gas係數和相等=>Q不變',
  'INERT: 定V加入惰性氣體=>各反應氣體分壓/Q不變；定P加入=>V增，依膨脹後Q/K判斷',
  'TEMP: heat視為反應物/生成物；升溫偏吸熱、降溫偏放熱；K改變，必用new K',
  'CATALYST/PHASE: catalyst只縮短達平衡時間；純固/液仍存在時增減量不改Q，耗盡或新相出現才重判',
  'CHECK/FORBID: 分開擾動瞬間與新平衡；禁止未寫Q就套勒沙特列、加壓一律判少氣體側、催化劑改K'
].join('\n');

const SOLUBILITY_PRECIPITATION_RULE_CARD = [
  'CARD=溶度積與沉澱',
  'ORDER:write dissolution -> Ksp/Qsp -> react/neutralize if needed -> post-mixing free ions -> compare Qsp/Ksp -> precipitate/equilibrate -> residual ions',
  'GATE: 判斷前先算混合、稀釋與副反應後的free ion；禁止直接用原液或總濃度',
  'EXPR: Qsp/Ksp只含溶解反應的free ion；次方=係數；pure solid不列入',
  'REGION: Qsp<Ksp=>未飽和/無沉澱；Qsp=Ksp=>飽和門檻（原先無固體時僅剛開始）；Qsp>Ksp=>沉澱至Qsp=Ksp或限量離子不足',
  'ONSET: 沉澱量趨近0，令Qsp=Ksp，以未沉澱前free ion求臨界值',
  'DILUTION/COMMON: 混合後各離子用V_total；定溫加水只降Qsp、不改Ksp；共同離子依正確Ksp式降低莫耳溶解度',
  'PRECIPITATE: Qsp>Ksp後先做沉澱化學計量，再以Ksp修正剩餘free ion；不可用初始濃度直接求平衡',
  'SELECTIVE: 各候選分別求開始沉澱的沉澱劑臨界濃度；較小者先，不能只比Ksp；第二者開始時以第一者Ksp求其殘留',
  'CHECK/FORBID: 分析/總/free濃度分開；檢查莫耳守恆、電荷、固相存在與定溫Ksp；禁止忽略V_total、係數或中和/錯合副反應'
].join('\n');

const REDOX_ELECTROCHEMISTRY_RULE_CARD = [
  'CARD=氧化還原與電化學',
  'ORDER:assign oxidation states -> changed atoms -> oxidation/reduction half-reactions -> balance e- -> cell type -> electrodes/signs -> electron/ion flow',
  'GATE: oxidation number↑=>oxidation/loss e-/reducing agent；oxidation number↓=>reduction/gain e-/oxidizing agent',
  'ELECTRONS/BALANCE: total e- lost=total e- gained；氧化數變化量乘原子數；酸性用H2O/H+/e-，鹼性再加OH-消H+並約H2O',
  'ELECTRODES: anode永遠oxidation；cathode永遠reduction；不得用正負極定義氧化還原',
  'GALVANIC: 自發原電池 anode=負極、cathode=正極；e-由anode經外電路到cathode',
  'ELECTROLYTIC: 電解池 anode=電源正極、cathode=電源負極；e-仍由氧化處送往還原處',
  'IONS: 溶液陽離子往cathode、陰離子往anode；鹽橋陰離子往anode槽、陽離子往cathode槽；e-不經鹽橋/溶液',
  'POTENTIAL: Ecell=Ecathode(reduction)-Eanode(reduction)；Ecell>0正向自發，=0平衡，<0逆向自發；半反應倍乘不倍乘E',
  'QK: 電化學涉及Q/K時，Ecell=0時Q=K；依Nernst的Q變化判Ecell，不把電位判斷誤寫成濃度必然同向改變',
  'PRODUCTS/MASS: 水溶液電解比較可放電物種、濃度、介質與電極材質；活性陽極質量減、金屬陰極析出質量增',
  'FARADAY/CHECK: Q=It；n_(e-)=Q/F，產物依半反應e-係數換算；檢查原子/電荷/e-/電極符號，分開e-流、電流、離子移動',
  'FORBID: 禁止把氧化劑判為被氧化；陰極固定負極或陽極固定正極；讓e-穿過鹽橋；只因離子存在就指定水溶液放電產物'
].join('\n');

const STOICHIOMETRY_LIMITING_REAGENT_RULE_CARD = [
  'CARD=化學計量與限量試劑',
  'ORDER:write species -> balance equation -> convert to moles -> compare n/coefficient -> limiting reagent -> reaction extent -> products/excess -> yield/purity -> units',
  'GATE: 跨物質換算前必有已配平反應式；未配平禁止用係數比',
  'MOLES: mass=>n=m/M；solution=>n=CV；particles=>n=N/N_A；gas依題目用莫耳體積或PV=nRT',
  'RATIO: 係數=粒子/莫耳比；只有同T、P的氣體可直接用體積比',
  'LIMITING: 每個反應物算available n/coefficient；最小值=反應程度與限量試劑；相等=恰好完全反應',
  'EXCESS/PRODUCT: n_remaining=n_initial-extent*coefficient；n_product=extent*coefficient，再轉質量/體積/濃度/粒子數',
  'YIELD/PURITY: %yield=actual/theoretical*100%；理論產量由限量試劑決定；先純度求有效反應物，再求理論產量與產率',
  'SOLUTION/VOLUME: 溶液體積先用於n=CV；要求反應後濃度才用反應後n/V_final；固液不可用體積比，質量比不可直接當係數比',
  'SEQUENCE/CHECK: 多步驟逐步追蹤中間物與各步實際產率；檢查原子守恆、單位、限量耗盡、剩餘非負與同物理量產率',
  'FORBID: 禁止未配平、直接比質量或莫耳數找限量、用過量試劑算理論產量；K/Q或Ksp平衡題不得假設反應完全'
].join('\n');

const GAS_LAWS_WATER_DISPLACEMENT_RULE_CARD = [
  'CARD=氣體與水上集氣',
  'ORDER:identify gas source -> balance/limiting if needed -> gas moles -> dry/wet -> target gas pressure -> gas law -> collection check',
  'SOURCE: 反應產氣先配平，以限量試劑求實際n_gas；禁止直接將反應物資料代PV=nRT',
  'PRESSURE: PV=nRT中的P是目標氣體分壓，不一定是容器總壓或大氣壓；混合氣體依Dalton與Pi=Xi*Ptotal',
  'WATER: 排水集氣為濕氣；達平衡時P_dry gas=P_total-P_H2O；已乾燥才不可再扣P_H2O，且P_H2O依當時溫度',
  'LEVEL: 內外液面等高才P_total=P_atm；管內液面高=>P_total<P_atm，低=>P_total>P_atm；先修正液柱壓差再扣P_H2O',
  'STATE: P1V1/T1=P2V2/T2只限同一固定n；n改變須回到PV=nRT或先做反應計量',
  'RATIO/COLLECTION: 同T、P氣體體積比才可當莫耳/係數比；氣體易溶於水或與水反應時，排水集氣量可能偏低或不適用',
  'FORBID: 禁止濕氣總壓當乾氣分壓、液面不等高仍令P_total=P_atm、任意條件套固定莫耳體積'
].join('\n');

const THERMOCHEMISTRY_RULE_CARD = [
  'CARD=熱化學',
  'ORDER:target process -> balance reaction -> align direction/scale/phase -> Hess or enthalpy method -> reaction extent -> system/surroundings heat -> sign check',
  'GATE: ΔH屬於特定方向、係數與物態的完整反應；改方向、倍數或物態時ΔH必同步調整',
  'REVERSE/SCALE: 反轉反應=>ΔH變號；反應式乘/除k=>ΔH同乘/除k；Hess相加前先確認中間物與物態可消去',
  'FORMATION: ΔH°rxn=ΣνΔH°f(products)-ΣνΔH°f(reactants)；每個係數納入；只有標準態元素ΔH°f=0',
  'BOND: ΔH≈ΣE(bonds broken)-ΣE(bonds formed)；斷鍵吸熱、成鍵放熱；平均鍵能為估算，不與生成焓公式混用',
  'BORN_HABER: 由元素標準態到離子晶體拆成升華/原子化、鍵解離、游離、電子親和與晶格形成；逐步方向與符號一致後代數相加',
  'CALORIMETRY: q_solution=mcΔT；q_reaction=-q_surroundings，含量熱器時q_reaction=-(q_solution+q_calorimeter)；周圍升溫通常代表反應放熱',
  'PHASE/STOICH: 同式不同物態不可消去；相變反向ΔH變號；每莫耳反應焓須按實際反應程度（必要時限量試劑）換算總熱',
  'CHECK/FORBID: 核對目標反應、係數、物態、系統歸屬與正負號；禁止只改反應式不改ΔH、令q_reaction=q_solution、以ΔH單獨判自發性'
].join('\n');

const ORGANIC_FUNCTIONAL_GROUP_TESTS_RULE_CARD = [
  'CARD=有機反應與官能基檢驗',
  'ORDER:identify all functional groups -> reagent/conditions -> reaction type -> bond or group change -> observation -> exclude alternatives -> strongest justified conclusion',
  'GATE/EVIDENCE: 同時核對官能基、試劑、酸鹼環境與加熱/光照；單一陽性現象只支持一類結構或還原性，不唯一確認完整物質',
  'UNSATURATED/AROMATIC: 烯炔可加成；苯環不等同普通C=C，通常依條件取代；溴水褪色也可能來自酚，不能單判烯炔',
  'OXIDATION: 1° alcohol=>aldehyde=>acid，2° alcohol=>ketone，3° alcohol高中溫和條件通常不易氧化；醛可被氧化，酮通常非一般銀鏡/斐林陽性',
  'TESTS: KMnO4褪色只表示可氧化結構；銀鏡/斐林陽性可支持醛或還原糖；FeCl3顏色支持酚；碘液藍黑支持澱粉',
  'ACID_BASE_SIGNAL: carboxylic acid+HCO3-=>CO2；phenol通常不與HCO3-明顯產氣；alcohol/phenol/acid皆可能與Na產H2，選擇性低',
  'CHECK/FORBID: 多官能基逐一判斷；鑑別選能給不同結果的最少試劑組；禁止以褪色、沉澱、氣泡、香味或分層唯一斷定物質'
].join('\n');

const ORGANIC_ACYL_POLYMER_RULE_CARD = [
  'CARD=有機酸衍生物、酸鹼與聚合',
  'ORDER:identify carboxyl/acyl group and nucleophile -> inspect acid/base/heat/catalyst -> determine esterification, hydrolysis, acyl substitution, salt formation, or polymerization -> track product form and evidence',
  'ESTER: carboxylic acid+alcohol under acid/heat is reversible esterification；不可假設完全反應，濃H2SO4為催化/吸水條件而非固定反應物',
  'HYDROLYSIS/SAPONIFICATION: ester酸水解=>acid+alcohol；鹼水解=>carboxylate salt+alcohol，皂化較不易直接逆轉；油脂=>glycerol+fatty-acid salts',
  'NUCLEOPHILIC_SUBSTITUTION: 含可離去基的有機物與親核物反應，須以題示試劑/溶劑/加熱判定；不可只因有鹵素或胺就假設必取代',
  'NUCLEOPHILIC_ACYL: 羧酸衍生物（含酯）與NH3/amine等親核物，僅在題示適當條件下以酰基取代形成amide；酯+NH3/amine時副產alcohol，反向不可憑空假設',
  'ACID_BASE/SOLUBILITY: acid與base形成carboxylate，amine與acid形成ammonium salt，離子鹽常較易入水層；加酸/鹼回復中性物析出不代表新共價物',
  'POLYMER/HARD_WATER: addition polymer由C=C通常無小分子；condensation polymer需比較雙官能基單體與小分子；soap遇Ca2+/Mg2+成難溶鹽，合成清潔劑不可一概視為酯',
  'CHECK/FORBID: 羧酸、酚、醇與酯分開；水解前後檢驗分開；禁止把酸鹼成鹽當氧化還原、把油脂與肥皂當同一類、超出題目引入機構或立體化學'
].join('\n');

function isClockReaction(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  if (/(?:秒錶反應|秒表反應|碘鐘(?:反應)?|iodine\s*clock|Landolt)/i.test(text)) return true;
  const hasSignal = /(?:澱粉|深藍|變藍|變色時間|顯色)/i.test(text);
  const iodateBisulfite = /(?:IO_?3|碘酸根|KIO3)/i.test(text) && /(?:HSO_?3|亞硫酸氫|NaHSO3)/i.test(text);
  const persulfateThiosulfate = /(?:S2O8|過硫酸)/i.test(text) && /(?:S2O3|硫代硫酸)/i.test(text);
  return hasSignal && (iodateBisulfite || persulfateThiosulfate);
}

function isAcidBaseCalculation(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text || isClockReaction(questionText, analysisMemo)) return false;
  const hasAcidBaseCore = /(?:酸鹼|酸.?鹼|中和|滴定|當量點|半當量|緩衝|共軛酸|共軛鹼|水解|多質子|二質子|兩性|amphiprotic|buffer|titration|neutralization)/i.test(text);
  const hasCalculationSignal = /(?:pH|pOH|K_a|Ka\b|K_b|Kb\b|pK_a|pKa|pK_b|pKb|K_w|Kw|Henderson|ICE|莫耳|濃度|M\b|mol|mL|L\b)/i.test(text);
  const hasDirectConstant = /(?:pH|pOH|K_a|Ka\b|K_b|Kb\b|pK_a|pKa|pK_b|pKb|K_w|Kw)/i.test(text);
  return (hasAcidBaseCore && hasCalculationSignal) || hasDirectConstant;
}

function isSolubilityPrecipitation(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text || isClockReaction(questionText, analysisMemo)) return false;
  const hasIonicEquilibrium = /(?:Ksp|K_sp|Qsp|Q_sp|溶度積|離子積|溶解平衡|難溶鹽|微溶|共同離子|選擇性沉澱|開始沉澱|沉澱先後|莫耳溶解度|自由離子|殘留濃度|沉澱劑|錯合(?:劑|物)?|配位)/i.test(text);
  const hasDecisionSignal = /(?:沉澱|飽和|未飽和|過飽和|混合|稀釋|總體積|加入|逐滴|臨界濃度|分離|pH(?:控制|改變)?|氫氧化物)/i.test(text);
  const onlyStoichiometry = /(?:沉澱完全|完全沉澱)/i.test(text) && /(?:莫耳數|質量|重量|產量)/i.test(text) && !/(?:Ksp|K_sp|Qsp|Q_sp|溶度積|離子積|自由離子|殘留濃度|開始沉澱|選擇性)/i.test(text);
  return hasIonicEquilibrium && hasDecisionSignal && !onlyStoichiometry;
}

function isRedoxElectrochemistry(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  const hasElectrochemistry = /(?:原電池|伏打電池|化學電池|電解池|電解(?:精煉)?|電鍍|半反應|陽極|陰極|正極|負極|鹽橋|外電路|電子流|電池電位|電極電位|標準還原電位|E_?cell|法拉第|通電時間|電流)/i.test(text);
  const hasRedoxCore = /(?:氧化還原|氧化劑|還原劑|被氧化|被還原|失去電子|得到電子|電子轉移|電子守恆|氧化還原配平|歧化|歸中)/i.test(text);
  const hasRedoxDecision = /(?:反應(?:式)?|配平|判斷|比較|誰(?:是|被)|電子|氧化數(?:升|降|變化)|自發|產物|電極|離子移動)/i.test(text);
  return hasElectrochemistry || (hasRedoxCore && hasRedoxDecision);
}

function isStoichiometryLimitingReagent(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  const hasEquilibriumConstraint = /(?:Ksp|K_sp|Qsp|Q_sp|溶度積|離子積|平衡常數|反應商|\bKc?\b|\bKp\b|\bQ\b|平衡組成|平衡濃度)/i.test(text);
  if (hasEquilibriumConstraint) return false;
  const hasStoichSignal = /(?:化學計量|係數比|莫耳比|限量(?:試劑|反應物)|過量(?:試劑|反應物)|剩餘量|理論產量|實際產量|百分產率|收率|純度|有效成分|燃燒分析|氣體生成量|沉澱質量|滴定當量|多步驟|總產率|最多生成|恰好(?:完全)?反應)/i.test(text);
  const hasQuantities = /(?:\d|質量|重量|莫耳數|莫耳質量|粒子數|亞佛加厥|濃度|體積|\bCV\b|\bPV\s*=\s*nRT\b|氣體莫耳體積|產量|純度|產率|通電時間|電流)/i.test(text);
  const hasReaction = /(?:反應(?:式)?|生成物|反應物|消耗|生成|配平|中和|滴定|燃燒|電解|沉澱)/i.test(text);
  return hasStoichSignal && hasQuantities && hasReaction;
}

function isGasLawsWaterDisplacement(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  const isEquilibriumPressureQuestion = /(?:平衡常數|反應商|\bKc?\b|\bKp\b|\bQ\b|平衡(?:移動|位置|組成))/i.test(text);
  if (isEquilibriumPressureQuestion) return false;
  const hasGasConcept = /(?:理想氣體|氣體方程式|PV\s*=\s*nRT|波以耳|查理|亞佛加厥|綜合氣體定律|分壓|總壓|莫耳分率|道耳頓|水上集氣|排水集氣|濕氣(?:體)?|乾氣(?:體)?|水蒸氣壓|飽和蒸氣壓|量氣管|集氣瓶|液面(?:等高|高低|不等高)|液柱壓差|氣體莫耳體積)/i.test(text);
  const hasStateTask = /(?:求|計算|比較|換算|判斷|壓力|體積|莫耳數|溫度|大氣壓|水蒸氣壓|收集(?:量|方法)?)/i.test(text);
  return hasGasConcept && hasStateTask;
}

function isThermochemistry(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  const hasDirectEnthalpy = /(?:ΔH|焓變|反應熱|熱化學|Hess|赫斯|生成焓|生成熱|燃燒焓|燃燒熱|鍵能|鍵解離|斷鍵|成鍵|Born.?Haber|波恩.?哈伯|晶格能|量熱(?:法|器)|比熱|熱容量|q\s*=\s*mc|相變焓|熔化熱|汽化熱)/i.test(text);
  const entropyOnly = /(?:熵|自由能|ΔG|自發性)/i.test(text) && !hasDirectEnthalpy;
  if (entropyOnly) return false;
  const hasThermalTask = /(?:求|計算|判斷|比較|反轉|倍乘|相加|放熱|吸熱|熱量|溫度變化|反應式|每莫耳|量熱)/i.test(text);
  return hasDirectEnthalpy && hasThermalTask;
}

function isOrganicFunctionalGroupTests(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  const organicCore = /(?:官能基|有機(?:反應|物|鑑別)|烷|烯|炔|苯|芳香族|醇|酚|醛|酮|醚|羧酸|酯|胺|醯胺|糖類?|澱粉)/i.test(text);
  const reactionOrTest = /(?:加成|取代|氧化|還原|酯化|水解|皂化|聚合|溴水|過錳酸鉀|銀鏡|斐林|三氯化鐵|碘液|碳酸氫鈉|金屬鈉|褪色|磚紅|藍黑|鑑別|現象|氣泡|沉澱|分層|水溶性)/i.test(text);
  const advancedOnly = /(?:NMR|IR|質譜|MS|立體化學|手性|電子推移|反應機構)/i.test(text);
  return organicCore && reactionOrTest && !advancedOnly;
}

function isOrganicAcylPolymer(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text) return false;
  const hasAcylOrPolymer = /(?:羧酸|酯|醯胺|醯基|油脂|肥皂|脂肪酸|皂化|酯化|水解|縮合聚合|加成聚合|聚合物|清潔劑|硬水|胺(?:類)?|氨)/i.test(text);
  const hasTransformation = /(?:反應|生成|水解|皂化|酯化|取代|親核|加熱|催化|酸性|鹼性|NaOH|NH3|胺|Ca2\+|Mg2\+|溶解|析出|分層|聚合)/i.test(text);
  return hasAcylOrPolymer && hasTransformation;
}

function isChemicalEquilibrium(questionText, analysisMemo) {
  const text = [questionText, analysisMemo].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
  if (!text || isClockReaction(questionText, analysisMemo) || isAcidBaseCalculation(questionText, analysisMemo) || isSolubilityPrecipitation(questionText, analysisMemo)) return false;
  const hasEquilibriumCore = /(?:化學平衡|平衡(?:狀態|位置|組成|移動|重新建立)?|平衡常數|反應商|(?:^|[^A-Za-z])Kc?\b|K_p\b|Kp\b|(?:^|[^A-Za-z])Q\b|勒沙特列|Le\s*Chatelier|純固體|純液體)/i.test(text);
  const hasDecisionSignal = /(?:Q\s*[<=>]|[<=>]\s*K|比較\s*Q|平衡(?:向|往|移動|偏|重新建立|組成)|改變(?:濃度|莫耳數|壓力|體積|溫度)|(?:加|減|升|降)(?:壓|溫)|壓縮|膨脹|催化劑|惰性氣體|加入|移除|增減|吸熱|放熱|氣體莫耳數)/i.test(text);
  return hasEquilibriumCore && hasDecisionSignal;
}

function buildLocalAuditCardBlock(questionText, analysisMemo) {
  const cards = [];
  if (isClockReaction(questionText, analysisMemo)) cards.push(CLOCK_REACTION_RULE_CARD);
  if (cards.length < 3 && isStoichiometryLimitingReagent(questionText, analysisMemo)) cards.push(STOICHIOMETRY_LIMITING_REAGENT_RULE_CARD);
  if (cards.length < 3 && isThermochemistry(questionText, analysisMemo)) cards.push(THERMOCHEMISTRY_RULE_CARD);
  if (cards.length < 3 && isOrganicFunctionalGroupTests(questionText, analysisMemo)) cards.push(ORGANIC_FUNCTIONAL_GROUP_TESTS_RULE_CARD);
  if (cards.length < 3 && isOrganicAcylPolymer(questionText, analysisMemo)) cards.push(ORGANIC_ACYL_POLYMER_RULE_CARD);
  if (cards.length < 3 && isGasLawsWaterDisplacement(questionText, analysisMemo)) cards.push(GAS_LAWS_WATER_DISPLACEMENT_RULE_CARD);
  if (cards.length < 3 && isSolubilityPrecipitation(questionText, analysisMemo)) cards.push(SOLUBILITY_PRECIPITATION_RULE_CARD);
  if (cards.length < 3 && !isSolubilityPrecipitation(questionText, analysisMemo) && isAcidBaseCalculation(questionText, analysisMemo)) cards.push(ACID_BASE_RULE_CARD);
  if (cards.length < 3 && isRedoxElectrochemistry(questionText, analysisMemo)) cards.push(REDOX_ELECTROCHEMISTRY_RULE_CARD);
  if (cards.length < 3 && isChemicalEquilibrium(questionText, analysisMemo)) cards.push(CHEMICAL_EQUILIBRIUM_RULE_CARD);
  return cards.join('\n\n');
}

window.isClockReaction = isClockReaction;
window.isAcidBaseCalculation = isAcidBaseCalculation;
window.isSolubilityPrecipitation = isSolubilityPrecipitation;
window.isRedoxElectrochemistry = isRedoxElectrochemistry;
window.isStoichiometryLimitingReagent = isStoichiometryLimitingReagent;
window.isGasLawsWaterDisplacement = isGasLawsWaterDisplacement;
window.isThermochemistry = isThermochemistry;
window.isOrganicFunctionalGroupTests = isOrganicFunctionalGroupTests;
window.isOrganicAcylPolymer = isOrganicAcylPolymer;
window.isChemicalEquilibrium = isChemicalEquilibrium;
window.buildLocalAuditCardBlock = buildLocalAuditCardBlock;

window.buildQuestionAnalysisUserText = function (questionText) {
  const scope = parseRequestedSolveScope(questionText);
  let questionBody = String(questionText || '').trim();
  if (scope.mode === 'partial') questionBody += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  return questionBody
    ? `【題目或使用者補充】\n${questionBody}\n\n請逐一掃描選項或子題，輸出解題前必須注意的高風險問題點。`
    : '請完整讀取圖片中的題目，逐一掃描選項或子題，輸出解題前必須注意的高風險問題點。';
};

window.parseQuestionAnalysis = function (raw, fallbackQuestion = '') {
  try {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(text);
    const questionText = String(parsed?.questionText || fallbackQuestion || '').trim();
    const memo = String(parsed?.memo || '').trim();
    if (!questionText || !memo) return null;
    return { questionText, memo };
  } catch (_) {
    return null;
  }
};

window.assembleSolveUserContent = function (questionText, analysisMemo, advancedBlock, refAnswer, opts = {}) {
  const scope = parseRequestedSolveScope(questionText);
  let questionBody = String(questionText || '').trim();
  if (scope.mode === 'partial') questionBody += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;

  const auditCardBlock = String(opts.localAuditCardBlock || buildLocalAuditCardBlock(questionBody, analysisMemo)).trim();
  const memoBlock = [String(analysisMemo || '').trim(), auditCardBlock].filter(Boolean).join('\n\n');
  const parts = [
    `【原題】\n${questionBody}`,
    `【本題解題備忘錄｜僅供內部參考】\n${memoBlock}`
  ];
  const advanced = String(advancedBlock || '').trim();
  if (advanced) parts.push(`【使用者啟用的進階設定】\n${advanced}`);

  const reference = String(refAnswer || '').trim();
  if (reference) {
    const mode = opts.verifyReference
      ? '請加強檢查關鍵數值、守恆、單位與每個選項後再對齊。'
      : '請完成必要計算與驗算後再對齊。';
    parts.push(`【待對齊參考答案】${reference}\n${mode}若參考答案與題目及正確推導相容，answer 與「選項分析」必須對齊；若確有矛盾，才可不對齊，且不得改寫題目條件或硬湊計算。`);
  }

  return {
    constraintPrefix: advanced,
    questionBody: `【原題】\n${questionBody}`,
    fullText: parts.join('\n\n')
  };
};

window.buildSolveUserText = function (scopeInput, _refAnswer, opts = {}) {
  const question = String(opts.questionBody || scopeInput || '').trim();
  const scope = parseRequestedSolveScope(scopeInput || opts.questionBody);
  let text = `【題目】\n${question}`;
  if (scope.mode === 'partial') text += `\n\n【範圍】只解第 ${scope.numbers.join('、')} 題。`;
  return text;
};

window.buildFollowUpUserText = function (followText) {
  return String(followText || '').trim();
};

window.getQuestionAnalysisSystem = function () {
  return QUESTION_ANALYSIS_SYSTEM;
};

window.getSystemPromptForSolve = async function () {
  return window.SolutionCore?.buildSystem?.() || '';
};

window.getSystemPromptForFollowUp = async function () {
  return '';
};

var buildSolveUserText = window.buildSolveUserText;
var buildFollowUpUserText = window.buildFollowUpUserText;
var getSystemPromptForSolve = window.getSystemPromptForSolve;

window.QuestionAnalysisPrompt = Object.freeze({
  SYSTEM: QUESTION_ANALYSIS_SYSTEM,
  SCHEMA: QUESTION_ANALYSIS_SCHEMA
});
