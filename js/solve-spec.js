/**
 * 章節類型與作答格式的單一來源。
 * 大章節由使用者選擇；細項依題目自動命中，避免把整章規則一次強加到答案。
 */
(function (global) {
  'use strict';

  const topic = (id, label, description, match, steps, rule) => Object.freeze({ id, label, description, match, steps, rule });
  const chapter = (group, label, description, match, steps, rule, topics) => Object.freeze({ group, label, description, match, steps, rule, topics: Object.freeze(topics) });

  const CHAPTERS = Object.freeze({
    atomic: chapter('結構與鍵結', '原子結構與週期趨勢', '光譜、軌域、電子組態與週期性質', /氫原子光譜|芮得柏|波耳|量子數|軌域|電子組態|基態|激發態|游離能|電子親和力|電負度|原子半徑|離子半徑|週期趨勢/, ['原子或離子資訊', '電子組態／能階判讀', '週期趨勢依據', '結論'], '先由原子序、電荷與電子數建立基準；比較時須交代同週期或同族的位置與有效核電荷／電子層差異。', [
      topic('spectrum_bohr', '光譜與波耳模型', '光的二重性、氫原子光譜、波耳能階與芮得柏關係', /光的二重性|氫原子光譜|譜線|芮得柏|Rydberg|波耳模型|能階躍遷|發射光譜|吸收光譜/, ['能階或躍遷辨識', '能量／波長關係', '光譜結論'], '說明電子由何能階躍遷、能量改變的正負與波長／頻率的相對關係；不要把發射與吸收混淆。'),
      topic('orbitals_quantum', '軌域與量子數', '量子數、軌域種類與單、多電子原子的能階', /量子數|主量子數|角量子數|磁量子數|自旋量子數|s軌域|p軌域|d軌域|f軌域|軌域形狀|多電子原子能階/, ['量子數或軌域限制', '能階排序', '可行性結論'], '逐一檢查量子數允許範圍與軌域容量；若比較能量，先分辨單電子與多電子原子的排序規則。'),
      topic('electron_configuration', '電子組態', '填入規則、基態／激發態與電子組態表示法', /電子填入|遞建原理|包立|洪德|Hund|基態|激發態|電子組態|價電子|未成對電子/, ['電子數與軌域順序', '填入規則', '組態與性質結論'], '先算電子總數並處理離子得失電子，再依遞建、包立與洪德規則寫組態；必要時指出未成對電子數。'),
      topic('periodic_trends', '週期性質趨勢', '原子半徑、游離能、電子親和力與電負度', /原子半徑|離子半徑|游離能|電子親和力|電負度|同族|同週期|週期性質/, ['比較對象定位', '遮蔽／有效核電荷分析', '趨勢結論'], '比較不可只背方向；需以電子層數、遮蔽效應或有效核電荷解釋，並注意等電子體與常見例外。')
    ]),

    bonding: chapter('結構與鍵結', '化學鍵與分子結構', '離子、金屬與共價鍵；分子形狀、極性與作用力', /路易斯|八隅體|正式電荷|VSEPR|價殼層|混成|鍵角|σ鍵|π鍵|共振|離子鍵|金屬鍵|共價鍵|分子極性|偶極|氫鍵|凡得瓦/, ['價電子或結構式', '鍵結／電子對推論', '幾何或作用力判斷', '結論'], '先畫出或說明合理的路易斯結構；再由電子域、鍵結極性與分子形狀推論，不可把鍵極性直接當成分子極性。', [
      topic('bond_types_solids', '化學鍵與固體', '離子鍵、金屬鍵、共價鍵、晶體與固體性質', /離子鍵|金屬鍵|共價鍵|離子晶體|金屬晶體|網狀共價|分子晶體|導電性|熔點/, ['粒子與鍵結類型', '晶格或電子模型', '性質結論'], '先辨識組成粒子與作用力，再連結熔沸點、導電性、延展性或溶解性；不要把所有固體都當成分子。'),
      topic('lewis_formal_charge', '路易斯結構與正式電荷', '價電子、八隅體、正式電荷與結構合理性', /路易斯|Lewis|正式電荷|八隅體|孤對電子|價電子|配位鍵/, ['價電子總數', '路易斯結構與正式電荷', '合理結構結論'], '列出總價電子後分配鍵結與孤對電子，最後檢查形式電荷與八隅體；必要時指出擴大八隅體的條件。'),
      topic('valence_sigma_pi', '價鍵理論、σ鍵與π鍵', '原子軌域重疊、單雙三鍵與鍵結種類', /價鍵理論|σ鍵|π鍵|sigma|pi鍵|單鍵|雙鍵|三鍵|軌域重疊/, ['鍵結或軌域辨識', 'σ／π鍵計數', '鍵結性質結論'], '以原子軌域的端對端或側向重疊判斷 σ、π 鍵；計數時要先確認骨架與多重鍵位置。'),
      topic('vsepr_hybrid_resonance', 'VSEPR、混成與共振', '電子域、分子形狀、鍵角、混成軌域與共振', /VSEPR|價殼層電子對|電子域|分子形狀|鍵角|sp3|sp2|sp\b|混成|共振/, ['中心原子電子域', '形狀／混成推論', '鍵角或共振結論'], '以中心原子的鍵結域與孤對電子數決定電子域幾何；區分電子域形狀與分子形狀，並說明孤對電子對鍵角的影響。'),
      topic('molecular_polarity', '鍵極性與分子極性', '電偶極、鍵偶極向量與分子整體極性', /鍵極性|分子極性|電偶極|偶極矩|極性分子|非極性分子/, ['鍵偶極方向', '分子形狀與向量合成', '極性結論'], '先判定各鍵是否極性，再以立體形狀合成偶極；對稱分子可能是非極性，需明確說明。'),
      topic('intermolecular_forces', '分子間作用力', '倫敦分散力、偶極－偶極力與氫鍵', /分子間作用力|凡得瓦|分散力|偶極.*偶極|氫鍵|沸點|黏度|表面張力/, ['可用作用力', '強弱比較依據', '巨觀性質結論'], '比較時依序檢查氫鍵、偶極與可極化性／分子量；明確區分分子內共價鍵與分子間作用力。')
    ]),

    stoichiometry: chapter('物質與反應', '化學反應規律與化學計量', '反應式配平、莫耳比、限量試劑、產率與化學程序', /化學方程式|配平|化學計量|莫耳比|限量試劑|過量試劑|理論產率|百分產率|實際產率|質量.*莫耳|莫耳.*質量/, ['配平反應式', '已知量轉成莫耳', '係數比與限量判斷', '結論與單位'], '涉及量的題目必先寫配平反應式並追蹤單位；限量試劑須由各反應物可生成量或消耗比例判定。', [
      topic('equation_balancing', '反應式與配平', '化學方程式、係數、守恆與代數配平', /配平|化學方程式|代數法|反應式係數|原子守恆/, ['物種與反應式', '元素／電荷守恆', '最簡整數係數'], '不可改變化學式下標；以係數滿足每種原子（必要時含電荷）守恆，最後化為最簡整數比。'),
      topic('mole_ratio', '莫耳比與換算', '質量、粒子數、氣體體積與莫耳數的轉換', /莫耳數|mol|阿伏加厥|分子量|莫耳質量|STP|標準狀況|氣體體積/, ['已知量與單位', '莫耳換算', '化學係數比與目標量'], '先把已知量轉成莫耳，再使用反應式係數比；最後才轉回所求單位並保留合理有效數字。'),
      topic('limiting_yield', '限量試劑與產率', '限量／過量試劑、理論產率與百分產率', /限量試劑|過量試劑|理論產率|實際產率|百分產率|產率/, ['各反應物可反應量', '限量試劑判定', '產率計算與結論'], '以同一目標產物比較各反應物的最大生成量，或比較可反應的莫耳比例；百分產率以實際產率除以理論產率。')
    ]),

    thermochemistry: chapter('物質與反應', '反應熱與熱化學', '焓、反應熱、熱量測定、赫斯定律與各類反應熱', /反應熱|熱化學|焓|ΔH|delta H|放熱|吸熱|量熱器|熱量計|比熱|赫斯|Hess|生成熱|燃燒熱|中和熱/, ['系統與狀態判定', '熱量或熱化學方程式', '焓變關係與符號', '結論'], '明確區分系統與周圍、放熱與吸熱；式子中的物質狀態與反應方向會影響 ΔH 的正負與倍數。', [
      topic('enthalpy_thermochemical', '焓與熱化學方程式', '焓、放吸熱、熱化學方程式與反應方向', /焓|ΔH|放熱|吸熱|熱化學方程式|反應方向/, ['系統熱量方向', 'ΔH 符號與反應式', '能量結論'], '先判斷熱由系統流出或流入；反應式反向時 ΔH 變號，係數倍增時 ΔH 同倍增。'),
      topic('calorimetry', '反應熱測定', '量熱、比熱、溫度變化與熱量守恆', /量熱器|熱量計|比熱|溫度變化|q=mcΔT|q=mc/, ['量測對象與溫差', '熱量守恆式', '莫耳反應熱結論'], '先寫溶液／容器與反應系統的熱量關係；溫度上升代表溶液吸熱、反應系統放熱。'),
      topic('hess_and_types', '赫斯定律與反應熱種類', '赫斯定律、生成熱、燃燒熱、中和熱與向量性質', /赫斯|Hess|生成熱|燃燒熱|中和熱|反應熱種類|熱化學循環/, ['目標反應', '已知反應調整', 'ΔH 加總與結論'], '把每個已知反應調整到可相加消去中間物種；同時調整 ΔH，最後確認得到的正是目標反應。')
    ]),

    gases: chapter('物質與反應', '氣體與蒸氣壓', '氣體壓力、氣體定律、理想氣體、分壓與蒸氣壓', /氣體|氣壓|壓力|波以耳|查理|給呂薩克|亞佛加厥|阿伏加德羅|理想氣體|PV=nRT|分壓|道耳頓|蒸氣壓|相對溼度|濕度/, ['系統與狀態條件', '氣體定律或分壓關係', '代入／趨勢判讀', '結論'], '先確認溫度使用 K、壓力單位一致，並分清密閉／開放、乾燥／水上集氣與氣體莫耳數是否改變。', [
      topic('gas_pressure_properties', '氣體性質與壓力', '大氣壓、液柱壓差與氣體微觀性質', /大氣壓|氣體壓力|液柱|壓差|托里切利|barometer|壓力計/, ['壓力來源或液面高差', '壓力關係', '系統壓力結論'], '以同一水平面的壓力相等建立關係；需標明氣體壓力與大氣壓誰大誰小。'),
      topic('gas_laws', '氣體定律', '波以耳、查理－給呂薩克與亞佛加厥定律', /波以耳|查理|給呂薩克|亞佛加厥|P1V1|V1\/T1|氣體定律/, ['保持不變的變因', '正比／反比關係', '比較或計算結論'], '先標出固定的變因，並以絕對溫度處理；趨勢題也要說明 P、V、T、n 的因果關係。'),
      topic('ideal_gas', '理想氣體方程式', 'PV=nRT、莫耳體積與狀態變化', /理想氣體方程式|PV=nRT|氣體常數|R=|莫耳體積/, ['已知狀態量與單位', 'PV=nRT 或組合關係', '所求量與合理性'], '統一壓力、體積、溫度與 R 的單位；涉及反應時先由化學計量取得 n。'),
      topic('partial_vapor_pressure', '分壓與蒸氣壓', '道耳頓分壓定律、水上集氣與液體蒸氣壓', /分壓|總壓|道耳頓|Dalton|水上集氣|水蒸氣壓|蒸氣壓/, ['氣體成分與總壓', '分壓加總或扣除蒸氣壓', '乾燥氣體結論'], '混合氣體總壓為各分壓相加；水上集氣要從總壓扣除同溫下水蒸氣壓。')
    ]),

    solutions: chapter('物質與反應', '溶液、溶解度與依數性質', '濃度、稀釋混合、沉澱、蒸氣壓、溶解度與依數性質', /溶液|莫耳濃度|重量百分|質量百分|稀釋|混合溶液|溶解度|飽和|沉澱|溶度|拉午耳|亨利|沸點上升|凝固點下降|滲透壓|依數性質|膠體/, ['溶液組成或條件', '濃度／平衡關係', '物種或性質判讀', '結論'], '先交代溶質、溶劑與體積是否改變；遇到沉澱、揮發或電解質時，不可直接套一般稀釋式。', [
      topic('solution_types_colloid', '溶液分類與膠體', '真溶液、膠體、分散系與廷得耳效應', /膠體|廷得耳|Tyndall|真溶液|懸浮液|分散系|乳化/, ['分散粒子與現象', '分類依據', '性質或應用結論'], '以粒子分散狀態、透光散射、沉降與過濾行為判斷；不要只依外觀是否透明分類。'),
      topic('concentration_dilution', '濃度、配製、稀釋與混合', '濃度表示法、配製、稀釋、混合與單位換算', /莫耳濃度|M\b|重量百分濃度|體積百分|ppm|稀釋|配製|混合溶液|C1V1/, ['溶質莫耳數或質量', '體積與濃度關係', '混合後結論'], '稀釋前後溶質莫耳數相同；混合時先把各溶液的溶質量加總，並確認最終體積是否可直接相加。'),
      topic('solubility', '溶解度與影響因素', '飽和溶液、溶解度曲線、溫度與壓力影響', /溶解度曲線|飽和溶液|不飽和|過飽和|影響溶解度|冷卻結晶|溶解度/, ['溫度／壓力與飽和狀態', '可溶量或析出量', '溶液狀態結論'], '以指定溫度的溶解度為基準，分清每 100 g 水與每 100 g 溶液；析晶前後水量是否改變要說明。'),
      topic('precipitation_rules', '水溶液沉澱反應', '離子方程式、溶解性規則與沉澱判定', /沉澱反應|離子方程式|淨離子|旁觀離子|溶解性規則|白色沉澱|生成沉澱/, ['溶液中離子', '溶解性／淨離子反應式', '沉澱與觀察結論'], '先把強電解質拆成離子，再依溶解性規則寫淨離子方程式；固體、液體與弱電解質不可任意拆解。'),
      topic('vapor_raoult', '蒸氣壓與拉午耳定律', '蒸氣壓、相對溼度、理想溶液與拉午耳定律', /拉午耳|Raoult|相對溼度|蒸氣壓降低|理想溶液|液相莫耳分率/, ['液相成分或莫耳分率', '蒸氣壓關係', '總壓或濕度結論'], '分辨揮發性與非揮發性溶質；理想溶液的各成分分壓由液相莫耳分率決定。'),
      topic('colligative_henry', '依數性質、亨利定律與滲透壓', '氣體溶解度、沸點上升、凝固點下降與滲透壓', /亨利|Henry|依數性質|沸點上升|凝固點下降|滲透壓|抗凍劑|分子量測定/, ['粒子數或氣體壓力', '依數／亨利關係', '性質變化結論'], '依數性質比較的是有效溶質粒子數；電解質須考慮解離，亨利定律則先確認溫度固定。')
    ]),

    kinetics: chapter('反應與平衡', '反應速率', '速率測定、速率律、反應級數、碰撞理論與催化', /反應速率|速率律|初速率|反應級數|半生期|碰撞理論|活化能|活化複合體|催化劑|秒錶反應/, ['反應條件與觀測量', '速率關係或微觀模型', '因素影響與結論'], '先分清影響速率與影響平衡的因素；速率律只能由題目資料或已給定關係判定，不可只由反應式係數猜測。', [
      topic('rate_measurement', '反應速率與測定', '平均速率、濃度變化、圖像與觀測指標', /平均速率|瞬時速率|速率測定|濃度.*時間|反應速率圖|斜率/, ['觀測量與時間區間', '濃度變化／斜率', '速率結論'], '標明反應物濃度減少或生成物濃度增加；若用圖表，斜率的正負與大小都要解釋。'),
      topic('rate_law_half_life', '速率律、級數與半生期', '初速率法、速率常數、反應級數與半生期', /初速率|速率律|速率常數|反應級數|半生期|k\b|rate=/i, ['實驗比較組', '速率律或級數', '半生期／速率結論'], '只比較一次改變一種濃度的實驗組，求指數後再代回驗證；半生期規律需先確認反應級數。'),
      topic('collision_activation', '碰撞理論與活化能', '有效碰撞、活化能與活化複合體', /碰撞理論|有效碰撞|活化能|活化複合體|能量分布|反應途徑/, ['粒子碰撞條件', '有效碰撞或能障分析', '速率結論'], '有效碰撞需要足夠能量與合適方向；用能量圖時區分活化能與反應熱。'),
      topic('rate_factors', '影響反應速率的因素', '反應物本質、濃度、表面積、溫度與催化劑', /表面積|接觸面積|濃度.*速率|溫度.*速率|催化劑.*速率|影響反應速率/, ['改變的操作條件', '微觀原因', '速率變化'], '每個因素都要連回有效碰撞頻率或能量分布；催化劑提供較低活化能路徑但不改變反應的 ΔH。')
    ]),

    equilibrium: chapter('反應與平衡', '化學平衡', '可逆反應、Kc／Kp、Q、勒沙特列與溶度積', /化學平衡|平衡常數|K_c|Kp|Ksp|反應商|濃度商|勒沙特列|勒夏特列|平衡移動|異相平衡|同離子效應|離子積|選擇性沉澱|ICE/, ['平衡反應與初始狀態', 'K、Q 或變化表關係', '方向／平衡組成判讀', '結論'], '先寫平衡反應式與相態，確認哪些物種進入平衡式；比較 Q 與 K 時，以反應式的正向為基準。', [
      topic('reversible_dynamic', '可逆反應與動態平衡', '正逆反應、平衡建立與巨觀／微觀判讀', /可逆反應|動態平衡|正反應|逆反應|平衡狀態|平衡時/, ['正逆反應速率', '巨觀與微觀狀態', '平衡結論'], '平衡時正逆反應仍持續且速率相等；各物種濃度恆定不代表濃度相等。'),
      topic('equilibrium_constants', '平衡常數 Kc、Kp 與異相平衡', '平衡式、Kc／Kp、反應式倍數與異相平衡', /K_c|Kc|K_p|Kp|平衡定律式|異相平衡|平衡常數.*反應式|平衡常數計算/, ['配平反應式與相態', '正確平衡常數式', 'K 的意義或計算'], '純固體與純液體不寫入 K；反應式係數倍增、反向或相加時，K 要依指數、倒數或相乘規則調整。'),
      topic('reaction_quotient', '反應商 Q 與平衡進行程度', 'Q 與 K 的比較、反應方向與 ICE 表', /反應商|濃度商|Q\b|Qc|Qp|ICE|起始.*變化.*平衡/, ['目前組成與 Q', 'Q 與 K 比較', '反應方向或 ICE 結論'], '以同一平衡式建立 Q；Q<K 時正向進行、Q>K 時逆向進行，ICE 表的變化量符號要與方向一致。'),
      topic('le_chateliers', '影響平衡的因素', '濃度、壓力、體積、溫度、催化劑與哈伯製氨', /勒沙特列|勒夏特列|平衡移動|改變濃度|改變壓力|改變體積|哈伯|催化劑.*平衡/, ['施加的擾動', '系統抵消擾動的方向', '新平衡結論'], '先判斷加入／移除物種、壓縮／膨脹或升／降溫；只有溫度會改變 K，催化劑只加快到達平衡。'),
      topic('ksp_precipitation', '溶度積、同離子效應與選擇性沉澱', 'Ksp、離子積 Qsp、沉澱條件與選擇性沉澱', /Ksp|溶度積|離子積|Qsp|同離子效應|選擇性沉澱|開始沉澱/, ['溶解平衡式', 'Qsp 與 Ksp 比較', '沉澱順序或濃度結論'], '先依溶解反應式寫 Qsp；Qsp>Ksp 才會沉澱，選擇性沉澱需比較各鹽達飽和所需的條件。')
    ]),

    acidbase: chapter('反應與平衡', '酸鹼與鹽類平衡', '酸鹼理論、pH、Ka／Kb、滴定、水解與緩衝溶液', /酸鹼|酸性|鹼性|pH|pOH|K_a|Ka|K_b|Kb|K_w|Kw|水的解離|中和|滴定|當量點|終點|鹽類水解|緩衝|共軛酸鹼|多質子酸/, ['酸鹼物種與反應式', '平衡／當量或 pH 關係', '條件與近似檢查', '結論'], '先判斷強弱酸鹼與主要物種；計算題要說明近似是否合理，滴定題則先定位當量點前、當量點或當量點後。', [
      topic('acidbase_ph_water', '酸鹼命名、pH 與水的解離', '酸鹼強度、pH／pOH、Kw 與水溶液酸鹼性', /酸鹼命名|強酸|強鹼|pH|pOH|水的解離|Kw|K_w|中性|酸性溶液|鹼性溶液/, ['主要離子或 [H+]/[OH−]', 'pH、pOH 或 Kw 關係', '酸鹼性結論'], '強酸強鹼先依化學計量決定主要離子濃度；在指定溫度下使用 pH+pOH 與 Kw 關係，不要把中性固定等同 pH 7。'),
      topic('acidbase_theories', '阿瑞尼士與布－洛酸鹼理論', '酸鹼定義、質子轉移與共軛酸鹼對', /阿瑞尼士|Arrhenius|布.?洛|Bronsted|Brønsted|質子轉移|共軛酸|共軛鹼/, ['酸與鹼角色', '質子轉移與共軛對', '反應判斷'], '布－洛理論中酸提供 H+、鹼接受 H+；一組共軛酸鹼對只相差一個質子。'),
      topic('weak_acids_kakb', '弱酸弱鹼、Ka／Kb 與共軛關係', '弱電解質解離、Ka、Kb 與 KaKb=Kw', /弱酸|弱鹼|Ka|Kb|K_a|K_b|酸解離常數|鹼解離常數|共軛酸鹼對/, ['解離反應與初始濃度', 'Ka／Kb 平衡關係', 'pH 或強弱結論'], '先寫解離反應與平衡式，再判斷 x 相對初濃度的近似是否可用；共軛對在同溫下滿足 Ka×Kb=Kw。'),
      topic('polyprotic_acids', '多質子酸與逐步解離', '多質子酸、Ka1、Ka2 與主要解離步驟', /多質子酸|二元酸|三元酸|Ka1|Ka2|Ka3|逐步解離/, ['逐步解離反應', '各步 Ka 比較', '主要物種或 pH 結論'], '逐步寫出每次解離；通常 Ka1 最大，pH 常由第一步主導，除非題目給定特殊濃度或常數。'),
      topic('acidbase_titration', '酸鹼滴定與滴定曲線', '當量點、終點、強酸強鹼、強弱滴定與指示劑', /酸鹼滴定|滴定曲線|當量點|滴定終點|指示劑|半當量點|滴定管|標定/, ['滴定前的莫耳數', '所在區段與主要反應', 'pH／指示劑或體積結論'], '先做中和莫耳計量，再判斷滴定區段；當量點 pH 是否為 7 取決於酸鹼強弱，終點是指示劑變色範圍。'),
      topic('salt_hydrolysis', '鹽類與水解', '鹽的分類、共軛離子水解與溶液酸鹼性', /鹽類|鹽的水解|水解反應|共軛鹼|共軛酸|NH4|CH3COO/, ['鹽的離子來源', '可能的水解反應', '溶液酸鹼性'], '由鹽的陽、陰離子分別判斷是否為強酸／強鹼的共軛物種；只有會與水反應的離子造成水解。'),
      topic('buffer', '緩衝溶液', '同離子效應、緩衝組成、容量與半當量點', /緩衝溶液|緩衝能力|同離子效應|半當量點|Henderson|配製緩衝/, ['共軛酸鹼對與莫耳數', '加入強酸／強鹼後的計量', 'pH 與緩衝結論'], '緩衝液須含弱酸／共軛鹼或弱鹼／共軛酸；先做加入強酸鹼的完全反應，再用剩餘兩者的比例判斷 pH。')
    ]),

    redox: chapter('反應與平衡', '氧化還原與電化學', '氧化數、半反應、氧化還原滴定、原電池、電解與電鍍', /氧化還原|氧化數|氧化劑|還原劑|失電子|得電子|半反應|氧化還原滴定|原電池|電池電動勢|標準電位|電解|電鍍|法拉第/, ['氧化數或半反應', '電子轉移與配平', '電極／當量或電量關係', '結論'], '先以氧化數或半反應確定電子流向；原電池與電解池都以氧化發生在陽極、還原發生在陰極判斷。', [
      topic('oxidation_numbers', '氧化數、氧化劑與還原劑', '氧化數計算、氧化還原辨識與歧化反應', /氧化數|氧化劑|還原劑|自身氧化還原|歧化|被氧化|被還原/, ['各元素氧化數', '升降與劑的角色', '氧化還原結論'], '氧化數上升是氧化、下降是還原；氧化劑自身被還原，還原劑自身被氧化。'),
      topic('redox_balancing', '氧化還原反應配平', '半反應法、酸性／鹼性介質與電子守恆', /氧化還原.*配平|半反應法|酸性溶液|鹼性溶液|電子守恆|氧化還原反應式/, ['氧化與還原半反應', '原子／電荷與電子配平', '總反應式'], '依介質用 H2O、H+、OH− 配平 O、H 與電荷，最後使失、得電子數相等並消去相同物種。'),
      topic('redox_titration', '氧化還原滴定與當量', '當量數、滴定莫耳電子與終點判定', /氧化還原滴定|當量數|當量|高錳酸|重鉻酸|碘量法/, ['氧化還原半反應', '電子當量或莫耳比', '滴定結論'], '先由半反應確認每莫耳物種轉移的電子數，再建立當量相等或電子莫耳守恆關係。'),
      topic('galvanic_cells', '原電池、電位與雙電池', '電池符號、鹽橋、電極電位與自發性', /原電池|伏打電池|電池電動勢|標準電位|鹽橋|雙電池|陰極|陽極/, ['半電池與氧還方向', '電子／離子流與電位', '自發性結論'], '寫出陽極氧化、陰極還原；電子由陽極流向陰極，鹽橋離子移動用來維持各槽電中性。'),
      topic('electrolysis_plating', '電解、法拉第定律與電鍍', '電解產物、半反應、電量、電鍍與法拉第定律', /電解|電鍍|法拉第|電量|庫侖|C\b|安培|電流|電解產物/, ['電解槽與離子競爭', '半反應與電量關係', '產物／鍍層結論'], '先判斷各電極可放電的物種與電源極性；計量時以 Q=It 轉成電子莫耳數，再用半反應係數換算。')
    ]),

    elements: chapter('元素與應用', '元素化學與配位化合物', '非金屬、主族金屬、過渡金屬與配位化合物', /非金屬|主族金屬|過渡金屬|配位化合物|錯合物|氫氣|氮氣|氧氣|氯氣|矽|矽酸鹽|鹼金屬|鹼土金屬|鈉|鎂|鋁|鐵|銅|銀|金|鋅/, ['元素或離子物種', '性質／反應與條件', '氧化態或觀察證據', '結論'], '以題目給定的反應式、顏色、沉澱、氣體或氧化態為證據；元素性質題不可只列背誦事實而未連回條件。', [
      topic('nonmetals', '非金屬及其化合物', '氫、氮、氧、氯、碳與矽的性質與反應', /氫|氮|氧|氯|碳|矽|氨|硝酸|硫酸|二氧化碳|矽酸鹽|氯化/, ['元素／化合物與氧化態', '反應條件或性質證據', '產物或現象結論'], '先確認題目所指的是元素單質或化合物；化學式、氧化態與反應條件需一致。'),
      topic('main_group_metals', '主族金屬及其化合物', '鹼金屬、鈉、鹼土金屬、鎂與鋁', /鹼金屬|鈉|NaOH|碳酸鈉|鹼土金屬|鈣|鎂|鋁|兩性|硬水/, ['金屬或離子物種', '與水／酸鹼或沉澱反應', '性質與應用結論'], '判斷金屬、氧化物或離子的不同反應性；鋁及其氧化物／氫氧化物的兩性須同時考量酸、鹼條件。'),
      topic('transition_metals', '過渡金屬及其化合物', '過渡元素通性、鐵、銅、銀、金與鋅', /過渡金屬|鐵|銅|銀|金|鋅|Fe2|Fe3|Cu2|Ag\+|氧化態|有色離子/, ['金屬離子氧化態', '反應或觀察證據', '轉化結論'], '以氧化態、配位環境與題幹現象追蹤物種；避免只憑顏色在未給條件下做唯一判定。'),
      topic('coordination', '配位化合物', '配位鍵、配體、錯合物與形成平衡', /配位化合物|錯合物|配體|配位數|配位鍵|氨合|氰合/, ['中心金屬與配體', '配位形成或取代', '性質／平衡結論'], '明確指出中心金屬離子、配體與電荷；配位造成的顏色或溶解度改變要連回形成的錯離子。')
    ]),

    organic: chapter('元素與應用', '有機化學', '組成與結構、烴類、官能基反應、異構物與有機檢驗', /有機|官能基|燃燒分析|結構推論|烷烴|烯烴|炔烴|芳香烴|有機鹵化物|醇|醚|酚|醛|酮|羧酸|酯|胺|醯胺|異構|銀鏡|斐林/, ['官能基或結構辨識', '反應／性質與條件', '物種變化或檢驗證據', '結論'], '先以結構式或官能基判別物質，再依反應條件推理；命名、異構與檢驗必須指出可區分的結構特徵。', [
      topic('organic_composition_structure', '有機組成、燃燒分析與結構推論', '燃燒分析、價鍵原理、分子式與結構式推論', /燃燒分析|最簡式|分子式|不飽和度|物化性質.*結構|結構推論|碳氫氧含量/, ['實驗數據或分子式', '不飽和度／官能基限制', '最可能結構'], '由燃燒產物回推 C、H（必要時 O），再合併分子量、鍵結與物性限制篩選結構；不可只憑單一線索斷定。'),
      topic('hydrocarbons_halides', '烴類與有機鹵化物', '烷、烯、炔、芳香烴與鹵化物反應', /烷烴|烯烴|炔烴|芳香烴|苯環|有機鹵化物|加成反應|取代反應|溴水|高錳酸鉀/, ['碳骨架與不飽和鍵', '反應類型與條件', '產物結構'], '先辨識單鍵、雙鍵、三鍵或芳香環；加成、取代與氧化反應的條件及產物位置要符合官能基特性。'),
      topic('alcohol_ether_phenol', '醇、醚與酚', '羥基位置、醇氧化、醚與酚的性質', /醇類|醚類|酚類|羥基|乙醇|甲醇|酚酞|醇的氧化/, ['官能基與碳原子類型', '反應或作用力分析', '性質／產物結論'], '區分醇的 −OH 與酚的芳香環 −OH；醇氧化時要先判斷一、二、三級醇。'),
      topic('aldehyde_ketone', '醛與酮', '羰基、製備、氧化還原與鑑別', /醛|酮|羰基|醛酮|銀鏡|斐林|Tollens|羰基還原|羰基氧化/, ['羰基結構', '氧化還原或檢驗反應', '鑑別結論'], '醛與酮皆有羰基，但醛較易被氧化；檢驗題須寫出陽性現象與可排除的物種。'),
      topic('carboxylic_esters', '羧酸與酯', '羧基、酯化、水解與香味酯', /羧酸|酯類|酯化|酯水解|乙酸|乙酸乙酯|羧基/, ['羧基／酯基辨識', '酯化或水解條件', '產物與平衡結論'], '酯化為羧酸與醇形成酯與水的可逆反應；水解時分清酸性與鹼性條件下的產物。'),
      topic('amines_amides', '胺與醯胺', '含氮官能基、鹼性與醯胺結構', /胺類|醯胺|胺基|醯胺基|含氮官能基/, ['含氮官能基辨識', '鹼性或反應性比較', '性質結論'], '區分胺的 N 與羰基相鄰的醯胺 N；比較鹼性時需考慮孤對電子是否受共振影響。'),
      topic('organic_tests_isomers', '有機檢驗與異構物', '順反異構、結構異構與官能基檢驗', /順反異構|幾何異構|結構異構|同分異構|有機物檢驗|鑑別|溴水|銀鏡|斐林/, ['候選結構或官能基', '可區分的試劑／現象', '異構或鑑別結論'], '異構物需有相同分子式但結構不同；設計檢驗時要寫出每一候選物的預期現象，而非只列試劑名稱。')
    ]),

    polymers: chapter('元素與應用', '聚合物與生物大分子', '聚合物分類、塑膠橡膠纖維與醣、蛋白質、酶、核酸', /聚合物|高分子|加成聚合|縮合聚合|單體|塑膠|橡膠|合成纖維|耐綸|醣類|蛋白質|酶|核酸/, ['單體或大分子結構', '聚合／分類或功能關係', '性質與應用結論'], '先辨識重複單元與單體關係；涉及生物大分子時，說明結構層次與功能，不把所有聚合物視為同一反應類型。', [
      topic('polymer_classification', '聚合物分類與性質', '單體、加成／縮合聚合、熱塑／熱固與材料性質', /加成聚合|縮合聚合|單體|重複單元|熱塑性|熱固性|聚合物分類/, ['單體與重複單元', '聚合類型或交聯程度', '材料性質結論'], '由單體是否產生小分子副產物判斷加成或縮合聚合；材料性質要連回鏈狀、支鏈或交聯結構。'),
      topic('daily_polymers', '生活中的聚合物', '塑膠、橡膠、合成纖維與耐綸', /塑膠|橡膠|合成纖維|耐綸|尼龍|聚乙烯|PVC|寶特瓶/, ['材料結構或單體', '加工／交聯或作用力', '生活應用結論'], '以材料的結構、彈性、耐熱或耐溶劑性解釋用途；題目若給回收標示，依題幹資訊判讀。'),
      topic('biomolecules', '生物體中的大分子', '醣類、蛋白質、酶與核酸', /醣類|碳水化合物|蛋白質|胺基酸|酶|核酸|DNA|RNA/, ['生物大分子單元', '鍵結或結構層次', '功能結論'], '區分單醣、胺基酸、核苷酸等基本單元；酶題需以專一性、活性條件與蛋白質結構解釋。')
    ]),

    materials: chapter('元素與應用', '材料、化工與永續', '先進材料、化學工業、污染防治與界面活性劑', /奈米材料|奈米碳管|超導|液晶|有機發光二極體|OLED|導電聚乙炔|化學工業|空氣污染|水污染|土壤污染|永續|界面活性劑|清潔劑/, ['材料或污染物特性', '結構／製程與作用機制', '效益、限制或防治結論'], '以題目提供的材料特性或污染資料為依據，明確區分化學機制、實際效益與可能限制；不以未給定的產業知識補推。', [
      topic('advanced_materials', '先進材料', '奈米材料、奈米碳管、超導、液晶、OLED 與導電聚合物', /奈米材料|奈米碳管|超導材料|液晶|有機發光二極體|OLED|導電聚乙炔/, ['材料結構尺度或組成', '對應物理化學特性', '應用與限制'], '由表面積、導電性、排列或能階等題幹資訊連結材料功能；避免把「奈米」直接等同所有性質更好。'),
      topic('industry_sustainability', '化學工業、污染與永續', '空氣、水、土壤污染、防治與永續發展', /化學工業|永續|空氣污染|水污染|土壤污染|溫室氣體|酸雨|廢水|污染防治/, ['污染源或製程資料', '化學轉化／傳輸機制', '防治與永續判斷'], '回答要對應污染物、來源、受影響介質與防治位置；若題幹給數據，先指出其能支持與不能外推的結論。'),
      topic('surfactants', '界面活性劑', '親水／疏水端、膠束與清潔作用', /界面活性劑|膠束|親水端|疏水端|清潔劑|乳化/, ['分子兩親性結構', '界面或膠束作用', '清潔／乳化結論'], '說明疏水端如何包覆油污、親水端如何與水作用；不要把乳化誤認成油脂已被化學分解。')
    ]),

    experiment: chapter('實驗與資料', '實驗設計與數據判讀', '變因、操作、觀察、誤差、圖表與證據範圍', /實驗設計|控制變因|自變因|應變因|誤差|準確|精密|有效數字|圖表|數據|趨勢線|觀察|滴定管|量筒|移液管|比色法/, ['實驗目的與變因', '資料／觀察與證據', '誤差或限制分析', '結論'], '只以題目提供的觀察、圖表與操作條件作答；區分系統誤差與隨機誤差，並指出改進措施對應哪一個誤差來源。', [
      topic('variables_design', '實驗設計與變因', '自變因、應變因、控制變因與對照組', /自變因|應變因|控制變因|對照組|實驗設計|操作變因/, ['研究問題與變因', '控制或對照安排', '可比較的結論'], '每次只改變欲研究的自變因；控制變因需說明為何會影響結果，對照組用來建立比較基準。'),
      topic('data_graphs', '數據、圖表與證據範圍', '表格、座標軸、趨勢、內插外推與相關性', /圖表|座標軸|斜率|趨勢線|內插|外推|相關性|數據判讀/, ['資料軸與比較組', '趨勢或斜率意義', '可支持的結論範圍'], '先讀取變因、單位與資料範圍；相關趨勢不必然表示因果，外推前需檢查是否超出資料範圍。'),
      topic('errors_measurement', '誤差與量測品質', '系統／隨機誤差、準確度、精密度與器材操作', /系統誤差|隨機誤差|準確度|精密度|有效數字|視差|校正|量測誤差/, ['誤差來源與方向', '對結果的影響', '相對應改進'], '系統誤差會造成偏高或偏低的固定趨勢，隨機誤差造成散布；改進方案必須能實際減少所指出的誤差。'),
      topic('titration_analysis', '滴定與分析實驗', '滴定管操作、終點、標準溶液與比色分析', /滴定管|滴定終點|標準溶液|讀數|比色法|吸光度|檢量線/, ['分析物與標準條件', '讀數／終點或檢量線', '濃度與誤差結論'], '滴定須確認讀數方向、氣泡與終點判讀；比色法只能在檢量線有效範圍內以吸光度推估濃度。')
    ])
  });

  const FORMATS = Object.freeze({
    choice: ['選擇題逐項分析', '判斷依據、各選項分析如下、答案', ['判斷依據', '各選項分析如下']],
    calculation: ['計算題四步推導', '已知與目標、關係式、代入計算、結論', ['已知與目標', '關係式', '代入計算', '結論']],
    concept: ['概念／性質三步判斷', '判斷依據、推論過程、結論', ['判斷依據', '推論過程', '結論']]
  });

  function ids(values, map) {
    const seen = {};
    return (Array.isArray(values) ? values : []).filter((id) => map[id] && !seen[id] && (seen[id] = true));
  }
  function chapterView(id) {
    const source = CHAPTERS[id];
    return {
      id, label: source.label, group: source.group, description: source.description, steps: source.steps, rule: source.rule,
      applicability: 'uncertain', matchedTopicIds: [],
      topics: source.topics.map((item) => ({ id: item.id, label: item.label, description: item.description, steps: item.steps, rule: item.rule, applicability: 'available' }))
    };
  }
  function detectChapters(text) {
    const question = String(text || '');
    return Object.keys(CHAPTERS).filter((id) => CHAPTERS[id].match.test(question)).slice(0, 3);
  }
  function create(input) {
    input = input || {};
    const chapterIds = ids(input.chapterIds, CHAPTERS);
    const formatIds = ids(input.formatIds, FORMATS);
    return {
      version: 3, chapterIds, formatIds, chapters: chapterIds.map(chapterView),
      formats: formatIds.map((id) => ({ id, label: FORMATS[id][0], rule: FORMATS[id][1], steps: FORMATS[id][2] })),
      enabled: !!(chapterIds.length || formatIds.length), autoCandidates: []
    };
  }
  function fromInputs(root) {
    const host = root || document;
    return create({
      chapterIds: [...host.querySelectorAll('input[data-chapter-id]:checked')].map((input) => input.dataset.chapterId),
      formatIds: [...host.querySelectorAll('input[data-solve-type]:checked')].map((input) => input.dataset.solveType)
    });
  }
  function withApplicability(spec, question) {
    const next = create(spec);
    const text = String(question || '');
    const detected = detectChapters(text);
    next.autoCandidates = detected;
    next.chapters = next.chapters.map((item) => {
      const source = CHAPTERS[item.id];
      const applicability = !text || !detected.length ? 'uncertain' : (detected.includes(item.id) ? 'applicable' : 'not-applicable');
      const matchedTopicIds = applicability === 'not-applicable' ? [] : source.topics.filter((entry) => entry.match.test(text)).slice(0, 3).map((entry) => entry.id);
      return {
        ...item,
        applicability,
        matchedTopicIds,
        topics: item.topics.map((entry) => ({
          ...entry,
          applicability: applicability === 'not-applicable' ? 'not-applicable' : (matchedTopicIds.includes(entry.id) ? 'applicable' : 'available')
        }))
      };
    });
    return next;
  }
  function countSignals(text, patterns) { return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0); }
  function autoFormatId(question) {
    const text = String(question || '');
    const hasChoices = /\([A-EＡ-Ｅ]\)|選項/.test(text);
    const reactionSignals = countSignals(text, [/反應式|配平|反應/, /限量試劑|足量|過量/, /起始|變化|結果|反應前|反應後/, /生成|產生|消耗|剩餘|逸出/, /莫耳(?:數)?比|化學計量/]);
    const hasQuantity = /莫耳|mol|質量|體積|濃度|產率/.test(text);
    if (hasQuantity && reactionSignals >= 2) return 'reaction_calculation';
    if (hasChoices) return 'choice';
    const calculationSignals = countSignals(text, [/計算|求(?:出|得)?/, /\d+(?:\.\d+)?\s*(?:mol|g|kg|mL|L|M|atm|kPa|%|秒|s)(?:\s|$|[,，。；])/i, /=|\d+\s*[×x*\/]/, /濃度|稀釋|氣體定律|pH|產率|單位換算|莫耳/]);
    if (calculationSignals >= 2) return 'calculation';
    const conceptSignals = countSignals(text, [/比較|何者|判斷|原因|為何|性質|趨勢|正確|錯誤/, /電子組態|鍵角|混成|氧化數|酸鹼|平衡移動|反應速率/]);
    if (conceptSignals >= 1 && !hasQuantity) return 'concept';
    return 'plain';
  }
  function route(spec, question, opts) {
    opts = opts || {};
    const manual = withApplicability(spec, question);
    if (opts.forceStoichiometry) return { id: 'reaction_table', origin: 'manual', solveSpec: manual, forceStoichiometry: true, forceCalcCompact: !!opts.forceCalcCompact };
    if (manual.formatIds.length || manual.chapterIds.length) return { id: 'manual', origin: 'manual', solveSpec: manual, forceStoichiometry: false, forceCalcCompact: !!opts.forceCalcCompact };
    const id = autoFormatId(question);
    const autoSpec = (id === 'calculation' || id === 'concept' || id === 'choice' || id === 'reaction_calculation')
      ? withApplicability(create({ formatIds: [id === 'reaction_calculation' ? 'calculation' : id] }), question)
      : create({});
    autoSpec.autoRoute = id;
    return { id, origin: 'auto', solveSpec: autoSpec, forceStoichiometry: id === 'reaction_table' || id === 'reaction_calculation', forceCalcCompact: !!opts.forceCalcCompact };
  }
  function describeRoute(value) {
    const routeValue = value || {};
    const labels = { plain: '一般詳解', calculation: '計算題四步推導', concept: '概念／性質三步判斷', choice: '選擇題逐項分析', reaction_table: '反應方程式表', reaction_calculation: '反應表＋四步計算', manual: '手動格式' };
    return `${routeValue.origin === 'manual' ? '手動優先' : '自動判斷'}：${labels[routeValue.id] || '一般詳解'}${routeValue.id === 'plain' ? '（題意不明確時不強制套版）' : ''}。`;
  }
  function buildRouteUserBlock(value) {
    if (!value || value.id === 'plain' || value.id === 'manual') return '';
    if (value.id === 'reaction_table') return '【本機格式路由｜反應方程式表】題目同時涉及反應物種與量的變化。先寫配平反應式，再完整輸出起始／變化／結果三列；資料不足不可硬湊表格，改用一般詳解並說明不足。';
    if (value.id === 'reaction_calculation') return '【本機格式路由｜反應表＋四步計算】先用反應方程式表整理反應物種與起始／變化／結果；再依「已知與目標、關係式、代入計算、驗算與結論」完成共用計算。若選項只是數字／比例，最後只需對照並寫答案，不必逐項重複計算。資料不足不可硬湊表格。';
    return `【本機格式路由】本題適合「${({ calculation: '計算題四步推導', concept: '概念／性質三步判斷', choice: '選擇題逐項分析' })[value.id]}」；只套用此格式，不適用時回到一般詳解。`;
  }
  function describe(spec) {
    if (!spec?.enabled) return spec?.autoCandidates?.length ? `自動候選：${spec.autoCandidates.map((id) => CHAPTERS[id].label).join('、')}。未強制套用。` : '未啟用章節或格式規格，將依題目自動判斷。';
    const active = [
      ...spec.chapters.filter((item) => item.applicability !== 'not-applicable').map((item) => `${item.label}${item.matchedTopicIds.length ? `（${item.topics.filter((entry) => entry.applicability === 'applicable').map((entry) => entry.label).join('、')}）` : ''}`),
      ...spec.formats.map((item) => item.label)
    ];
    const skipped = spec.chapters.filter((item) => item.applicability === 'not-applicable').map((item) => item.label);
    return `已啟用：${active.join('、')}${skipped.length ? `；不適用而未強制：${skipped.join('、')}` : ''}。`;
  }
  function buildUserBlock(spec) {
    if (!spec?.enabled) return '';
    const lines = ['【解題規格｜只套用本題適用項】'];
    spec.chapters.filter((item) => item.applicability !== 'not-applicable').forEach((item) => {
      lines.push(`【章節：${item.label}】請以小標依序呈現：${item.steps.join(' → ')}。${item.rule}`);
      item.topics.filter((entry) => entry.applicability === 'applicable').slice(0, 3).forEach((entry) => {
        lines.push(`【細項：${entry.label}】${entry.rule} 請以小標依序呈現：${entry.steps.join(' → ')}。`);
      });
    });
    spec.formats.forEach((item) => lines.push(`【格式：${item.label}】${item.rule}。`));
    return lines.length > 1 ? lines.join('\n') : '';
  }
  function checkReply(spec, reply) {
    if (!spec?.enabled) return [];
    const text = String(reply || '');
    const required = [
      ...spec.chapters.filter((item) => item.applicability !== 'not-applicable').flatMap((item) => [[item.label, item.steps], ...item.topics.filter((entry) => entry.applicability === 'applicable').slice(0, 3).map((entry) => [entry.label, entry.steps])]),
      ...spec.formats.map((item) => [item.label, item.steps])
    ];
    const issues = [];
    required.forEach(([label, steps]) => steps.forEach((step) => { if (!text.includes(step)) issues.push(`${label}缺少「${step}」步驟。`); }));
    return issues;
  }

  global.SolveSpec = Object.freeze({ CHAPTERS, FORMATS, create, fromInputs, withApplicability, detectChapters, autoFormatId, route, describe, describeRoute, buildRouteUserBlock, buildUserBlock, checkReply });
})(typeof window !== 'undefined' ? window : globalThis);
