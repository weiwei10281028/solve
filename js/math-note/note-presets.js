/**
 * js/math-note/note-presets.js — NOTE 語意類型（可擴充，不綁定特定物質或數值）
 *
 * 新增方式：在 PRESETS 陣列加一筆 { id, tags, title, hints, example }
 * tags 用於與 conceptLabels、matchInput 模糊配對；勿寫「Mg」「5730」等題目專用值。
 */
(function (global) {
  'use strict';

  const PRESETS = [
    {
      id: 'mole_stoichiometry',
      tags: ['莫耳', '反應計量', '限量試劑', '分子量', '原子量', '式量', '質量'],
      title: '莫耳計量',
      hints: [
        '質量、莫耳質量、莫耳數等須標「{該物質或離子}的{物理量}」，勿單寫「質量」「莫耳數」。',
        '莫耳數×原子量（或分子量）求質量時：標兩因子；最終質量若已是題幹所求，可不必標。',
        '換算因子（×10的次方）依該行前後單位判斷 note（如體積換成 L、質量換成 g）。',
      ],
      example: '某反應物的質量 ÷ 該物質的莫耳質量 = 該物質的莫耳數',
    },
    {
      id: 'first_order_kinetics',
      tags: ['一級反應', '半衰期', '衰變', '剩餘率', '等比遞減', '速率常數', '14C', '放射性', '核反應'],
      title: '一級反應／衰變',
      hints: [
        '半衰期、速率常數、經過時間、衰變後剩餘比例等，note 須對應該行符號或題意。',
        '題目附表常數用「題目給定{名稱}」；比例類寫清剩餘或初始對現存之比。',
      ],
      example: 't_{1/2}→半衰期；[A]_t/[A]_0→衰變後剩餘比例；k→速率常數',
    },
    {
      id: 'colligative',
      tags: ['依數性', '凝固點', '沸點', '滲透壓', '凡特荷夫', '拉午耳', '蒸氣壓', 'Kf', 'Kb'],
      title: '溶液依數性',
      hints: [
        'ΔT_f、ΔT_b、i、C_m、K_f、K_b 等依符號標物理量名；題目給定溫度先標 T 再算差。',
        '解離度 α、平均分子量、粒子總濃度等中間量第一次出現皆应標。',
      ],
      example: '凝固點下降量；凡特荷夫因子；重量莫耳濃度',
    },
    {
      id: 'equilibrium',
      tags: ['平衡', 'ICE', '分壓', '莫耳分率', 'Kp', 'Kc', '勒沙特列'],
      title: '化學平衡',
      hints: [
        '分壓、莫耳分率、平衡常數、反應商等整段分數可包在一個 htmlData（整體語意）。',
        'ICE 表數值若寫在等號式中，須標「初值／變化量／平衡值」等對應欄位語意。',
      ],
      example: 'SO₃莫耳分率；平衡常數 K_p',
    },
    {
      id: 'acid_base',
      tags: ['酸鹼', 'pH', 'pKa', 'pKb', '解離度', '弱酸', '弱鹼', '緩衝'],
      title: '酸鹼平衡',
      hints: [
        '[H⁺]、[OH⁻]、K_a、K_b、解離度 α 等須標符號或題意；稀釋、中和步驟的中間濃度亦应標。',
      ],
      example: '解離度；氫離子濃度；題目給定 pH',
    },
    {
      id: 'gas_law',
      tags: ['理想氣體', '分壓', '總壓', 'PV', 'nRT', '氣體定律', '阿瑞尼士', '逸散', '反應速率', '速率比', '定容', '定壓', '莫耳濃度'],
      title: '氣體／分壓／速率比',
      hints: [
        '分壓、總壓、莫耳數、體積、溫度等須標清楚；混合氣體求分率時標「某組分的莫耳分率」等。',
        '速率定律代入濃度時，$\\dfrac{n}{V}$ 型分式：分子莫耳數（9、6、4…）與分母 $V$、$2V$ **分開標**；定壓加氣後體積倍率（2V）須寫清語意。',
        '速率比較式：分子、分母皆寫 $k\\cdot\\dfrac{n}{V}\\cdot\\dfrac{n}{V}$ 展開式；禁止分母預先合併成 $\\dfrac{4k}{V^2}$。',
      ],
      example: '加 N₂ 後莫耳數 9；定壓新體積 2V；初態 N₂ 莫耳數 4；初態體積 V',
    },
    {
      id: 'charge_stoichiometry',
      tags: ['電解', '法拉第', '電量', '庫侖', '库仑', '電流', '電子', '安培', '電解池', '陰極', '陽極'],
      title: '電量／電解計量',
      hints: [
        'Q=I×t：電流、時間、換算後時間等各因子分標；勿只標乘積結果。',
        'n=Q/F 或類似分數：分子（總電量）、分母（法拉第常數等）分標；求得的莫耳數应标。',
        'n×M 求質量：標莫耳數與原子量（或分子量）因子；最終質量若為題求可略。',
      ],
      example: 'I→電流；t→反應時間；Q→總電量；F→法拉第常數；n→產物莫耳數；M→原子量',
    },
    {
      id: 'unit_conversion',
      tags: ['單位', '換算', 'mL', 'L', 'mg', 'g', 'cm', 'atm', 'Pa', 'kPa'],
      title: '單位換算',
      hints: [
        '×10^n、÷1000 等因子：依該行確定是「{前單位}換成{後單位}」，同一數字在不同式子可能不同義。',
      ],
      example: '體積換成 L；質量換成 g；壓力換成 atm',
    },
  ];

  // 初稿只帶最相關的兩種題型，避免 NOTE 提示壓過題目本身。
  const MAX_PRESETS = 2;

  function collectTagSources(opts) {
    opts = opts || {};
    const parts = [];
    if (opts.matchInput) parts.push(String(opts.matchInput));
    for (const label of opts.conceptLabels || []) {
      if (label) parts.push(String(label));
    }
    for (const label of opts.match?.conceptLabels || []) {
      if (label) parts.push(String(label));
    }
    return parts.join(' ').toLowerCase();
  }

  function scorePreset(preset, haystack) {
    if (!haystack) return 0;
    let score = 0;
    for (const tag of preset.tags || []) {
      const t = String(tag).toLowerCase();
      if (!t) continue;
      if (haystack.includes(t)) score += t.length >= 4 ? 2 : 1;
    }
    return score;
  }

  /** 依題目／concept 配對 preset（分數 > 0 才納入） */
  function matchPresets(opts, limit) {
    const haystack = collectTagSources(opts);
    if (!haystack) return [];
    const ranked = PRESETS.map((p) => ({ preset: p, score: scorePreset(p, haystack) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit == null ? MAX_PRESETS : limit).map((x) => x.preset);
  }

  function buildPresetAppendix(opts) {
    const matched = matchPresets(opts);
    if (!matched.length) return '';
    const lines = [
      '',
      '【本題 NOTE 類型提示（語意類別；具體字串仍依該行等號式判斷，勿套用固定物質或數值）】',
    ];
    for (const p of matched) {
      lines.push(`■ ${p.title}`);
      for (const h of p.hints || []) lines.push(`  - ${h}`);
      if (p.example) lines.push(`  例（模式）：${p.example}`);
    }
    return lines.join('\n');
  }

  function listPresets() {
    return PRESETS.slice();
  }

  global.NotePresets = {
    PRESETS,
    matchPresets,
    buildPresetAppendix,
    listPresets,
  };
})(typeof window !== 'undefined' ? window : globalThis);
