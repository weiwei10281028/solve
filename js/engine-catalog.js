/**
 * 化學計算引擎目錄：供路由 AI 動態注入，不寫死在 PARSE_SYSTEM。
 */
(function (global) {
  'use strict';

  const ENGINE_ADAPTERS = {
    acid_base: () => global.AcidBaseEngineAdapter,
    equilibrium: () => global.EquilibriumEngineAdapter,
    stoichiometry: () => global.StoichiometryEngineAdapter
  };

  const OPERATION_CATALOG = {
    acid_base: {
      strong_acid_base: {
        purpose: '單一強酸或強鹼溶液',
        inputFields: ['concentration(number)', 'species?(string)']
      },
      weak_acid: {
        purpose: '單一弱酸溶液 pH',
        inputFields: ['concentration(number)', 'Ka(number)', 'species?(string)', 'volumeL?(number)']
      },
      weak_base: {
        purpose: '單一弱鹼溶液 pH',
        inputFields: ['concentration(number)', 'Kb(number)', 'species?(string)', 'volumeL?(number)']
      },
      weak_acid_diprotic: {
        purpose: '雙質子弱酸（已知 C、Ka1、Ka2 求 pH）',
        inputFields: ['concentration(number)', 'Ka1(number)', 'Ka2(number)']
      },
      reconstruct_diprotic_equilibrium: {
        purpose: '雙質子酸已知平衡態（C、pH、α、物種比）反推常數與濃度',
        inputFields: [
          'formalConcentration(number)',
          'pH(number)',
          'degreeOfDissociation(number)',
          'ratioHAtoA2(number)'
        ],
        extractProfile: 'reconstruct_diprotic_equilibrium'
      },
      derive_diprotic_constants: {
        purpose: '已知各物種濃度與 pH 反推 Ka1、Ka2',
        inputFields: ['pH(number)', 'concentrations(object)']
      },
      neutralization: {
        purpose: '酸鹼混合／中和',
        inputFields: ['acid(object)', 'base(object)', 'volumes?(object)']
      },
      titration: {
        purpose: '酸鹼滴定',
        inputFields: ['analyte(object)', 'titrant(object)', 'volumes(object)']
      },
      buffer: {
        purpose: '緩衝溶液 pH',
        inputFields: ['acid(object)', 'conjugateBase(object)', 'volumes?(object)']
      }
    },
    equilibrium: {
      dilution_effect: {
        purpose: '稀釋效應（加水或定濃度稀釋）',
        inputFields: [
          'reaction(object)',
          'K(number)',
          'initialActivities(object)',
          'dilutionFactor(number)',
          'mode(string)',
          'dissociatedSide(string)'
        ]
      },
      reaction_quotient_direction: {
        purpose: '比較 Q 與 K 判斷反應方向',
        inputFields: ['reaction(object)', 'activities(object)', 'K(number)']
      },
      le_chatelier_disturbance: {
        purpose: '勒沙特列擾動方向',
        inputFields: ['reaction(object)', 'disturbance(string)', 'change?(string)']
      }
    },
    stoichiometry: {
      mole_conversion: {
        purpose: '化學量化題的通用輔助：質量、莫耳數、粒子數互換',
        inputFields: ['mode(string)', 'mass_g?(number)', 'amount_mol?(number)', 'molarMass_g_mol?(number)', 'particles?(number)']
      },
      stoichiometric_ratio: {
        purpose: '化學量化題的通用輔助：依反應係數做莫耳比換算',
        inputFields: ['reaction(object)', 'known(object)', 'targetSpeciesId(string)']
      },
      limiting_reagent: {
        purpose: '化學量化題的通用輔助：判斷限量試劑並計算目標產物理論產量',
        inputFields: ['reaction(object)', 'reactantAmounts_mol(object)', 'targetProductId(string)', 'productMolarMass_g_mol?(number)']
      },
      theoretical_yield: {
        purpose: '化學量化題的通用輔助：由係數比計算理論產量或產物量',
        inputFields: ['limitingReactant(object)', 'product(object)']
      },
      percent_yield: {
        purpose: '由實際產量與理論產量計算百分產率',
        inputFields: ['actualYield_g?(number)', 'theoreticalYield_g?(number)', 'actualYield_mol?(number)', 'theoreticalYield_mol?(number)']
      }
    }
  };

  const EXTRACT_PROFILES = {
    reconstruct_diprotic_equilibrium: {
      system: `你是化學題數值抽取器。只從題目（含圖片）讀取指定欄位，輸出 JSON，不寫詳解。
欄位意義：
- formalConcentration：總濃度 mol/L
- pH：溶液 pH
- degreeOfDissociation：總解離度 α（0~1 小數），分數要換算
- ratioHAtoA2：共軛酸鹼莫耳濃度比
全部為 number；讀不到填 null；不猜測。`,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['formalConcentration', 'pH', 'degreeOfDissociation', 'ratioHAtoA2'],
        properties: {
          formalConcentration: { type: 'number' },
          pH: { type: 'number' },
          degreeOfDissociation: { type: 'number' },
          ratioHAtoA2: { type: 'number' }
        }
      },
      userSuffix: '請只輸出 formalConcentration、pH、degreeOfDissociation、ratioHAtoA2 四個 number（讀不到填 null）。'
    }
  };

  function listEngines() {
    return Object.keys(OPERATION_CATALOG);
  }

  function isKnownTask(engine, operation) {
    return !!(OPERATION_CATALOG[engine] && OPERATION_CATALOG[engine][operation]);
  }

  function getExtractProfile(operation) {
    const meta = findOperationMeta(operation);
    if (!meta || !meta.extractProfile) return null;
    return EXTRACT_PROFILES[meta.extractProfile] || null;
  }

  function findOperationMeta(operation) {
    for (const engine of listEngines()) {
      if (OPERATION_CATALOG[engine][operation]) {
        return { engine, ...OPERATION_CATALOG[engine][operation] };
      }
    }
    return null;
  }

  function getAdapter(engineId) {
    const factory = ENGINE_ADAPTERS[String(engineId || '')];
    return factory ? factory() || null : null;
  }

  function buildCatalogBlock() {
    const lines = ['【可用引擎目錄】', '只可使用下列 engine 與 operation，不可自創。'];
    for (const engine of listEngines()) {
      lines.push(`- engine: ${engine}`);
      lines.push('  operations:');
      for (const [opId, meta] of Object.entries(OPERATION_CATALOG[engine])) {
        lines.push(`    - id: ${opId}`);
        lines.push(`      用途: ${meta.purpose}`);
        lines.push(`      input: ${meta.inputFields.join(', ')}`);
      }
    }
    return lines.join('\n');
  }

  function buildPrejudgmentBlock(context) {
    const lines = ['【題意與章節預判】'];
    const spec = context?.solveSpec;
    if (spec?.autoCandidates?.length) {
      lines.push(`- 章節關鍵字命中: ${spec.autoCandidates.join(', ')}`);
    }
    if (spec?.chapters?.length) {
      const active = spec.chapters
        .filter((ch) => ch.applicability === 'applicable' || ch.applicability === 'uncertain')
        .map((ch) => ch.label);
      if (active.length) lines.push(`- 相關章節: ${active.join('、')}`);
    }
    if (lines.length === 1) lines.push('- （無額外預判，請依題目與引擎目錄判斷）');
    lines.push('- 預判僅供路由參考；仍須對照題目與引擎目錄。');
    return lines.join('\n');
  }

  function normalizeRouterResult(raw) {
    if (!raw || typeof raw !== 'object') {
      return { useEngine: false, tasks: [], classification: '', skipReason: 'invalid_router_json' };
    }

    if (typeof raw.useEngine === 'boolean') {
      const tasks = Array.isArray(raw.tasks)
        ? raw.tasks
          .filter((task) => task && task.engine && task.operation)
          .map((task) => ({
            engine: String(task.engine),
            operation: String(task.operation),
            input: task.input && typeof task.input === 'object' && !Array.isArray(task.input) ? task.input : {},
            purpose: String(task.purpose || '')
          }))
        : [];
      return {
        useEngine: raw.useEngine,
        tasks: raw.useEngine ? tasks : [],
        classification: String(raw.classification || ''),
        skipReason: String(raw.skipReason || raw.unsupportedReason || '')
      };
    }

    if (typeof raw.applicable === 'boolean') {
      if (!raw.applicable) {
        return {
          useEngine: false,
          tasks: [],
          classification: String(raw.classification || ''),
          skipReason: String(raw.unsupportedReason || raw.reason || raw.skipReason || 'not_applicable')
        };
      }
      return {
        useEngine: true,
        tasks: [{
          engine: String(raw.engine || 'acid_base'),
          operation: String(raw.operation || ''),
          input: raw.input && typeof raw.input === 'object' && !Array.isArray(raw.input) ? raw.input : {},
          purpose: String(raw.classification || '')
        }],
        classification: String(raw.classification || ''),
        skipReason: ''
      };
    }

    return { useEngine: false, tasks: [], classification: '', skipReason: 'unknown_router_shape' };
  }

  function taskToLegacyParse(task, routerResult) {
    return {
      applicable: true,
      engine: task.engine,
      operation: task.operation,
      input: task.input || {},
      classification: routerResult?.classification || task.purpose || ''
    };
  }

  function legacyParseToRouter(legacy) {
    return normalizeRouterResult(legacy);
  }

  const api = Object.freeze({
    ENGINE_ADAPTERS,
    OPERATION_CATALOG,
    EXTRACT_PROFILES,
    listEngines,
    isKnownTask,
    getExtractProfile,
    findOperationMeta,
    getAdapter,
    buildCatalogBlock,
    buildPrejudgmentBlock,
    normalizeRouterResult,
    taskToLegacyParse,
    legacyParseToRouter
  });

  global.EngineCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
