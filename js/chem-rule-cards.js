/**
 * 化學通則卡：解題前依「題意」預判後注入參考資料（非答案照抄）。
 * 與進階「章節類型」分開。正文來源 chem-rule-cards/*.en.md。
 * 重建：python scripts/build-chem-rule-cards-js.py
 */
(function (global) {
  const CARDS = Object.freeze([
  {
    "id": "iodine-clock",
    "title_zh": "碘鐘／秒錶反應",
    "status": "active",
    "card_version": "1.3.0",
    "intent_brief": "碘鐘／秒錶反應：溶液由無色轉為深藍色，以變色時間比較反應速率、反應級數或預測時間；常見碘酸根－亞硫酸氫根、過硫酸根－硫代硫酸根等變體。",
    "body": "# 關鍵通則\n- oxidant capacity ≤ timer-reductant capacity → NO color signal → time = null (do not output seconds)\n- iodate (Landolt): n(IO3-)/n(HSO3-) > 1/3 → can turn blue; n(IO3-)/n(HSO3-) ≤ 1/3 → no blue → time = null\n- persulfate: n(S2O8^2-)/n(S2O3^2-) > 1/2 → can signal; n(S2O8^2-)/n(S2O3^2-) ≤ 1/2 → no signal → time = null\n- Rate from consumed timer reductant: Rate = Δ[oxidant]/Δt = (stoich factor) × [timer]_mixed / Δt\n- 1/t ∝ initial rate ONLY IF [timer]_mixed is the same across compared trials\n- all concentrations use V_total after mixing reagents + water\n\n# 試劑角色\n- oxidant: S2O8^2- OR IO3- OR H2O2\n- main reductant (often regenerated): I-\n- timer_reductant: S2O3^2- OR HSO3- OR ascorbic acid\n- indicator: starch\n- intermediate / signal species: I2 (or I3-)\n- catalyst (optional): Cu^2+, Fe^3+, MoO4^2-\n- other: water to keep V_total constant across trials\n\n# 觀察現象\n- what: sudden deep blue / blue-black (starch–iodine)\n- appears_when:\n  - timer_reductant fully consumed\n  - oxidant still remains so I2 can accumulate\n  - starch present\n- never_when:\n  - n(oxidant)/n(timer) at or below stoichiometric boundary (see 化學計量)\n  - starch omitted\n  - no I2-generation pathway\n\n# 化學計量\n- iodate_Landolt:\n  - net: 1 IO3- neutralizes 3 HSO3-\n  - blue requires: n(IO3-)/n(HSO3-) > 1/3\n  - no blue if: n(IO3-)/n(HSO3-) ≤ 1/3 (exact 1/3 included)\n- persulfate:\n  - 1 S2O8^2- → 1 I2; 1 I2 consumes 2 S2O3^2-\n  - signal requires: n(S2O8^2-)/n(S2O3^2-) > 1/2\n  - rate_eq: -Δ[S2O8^2-]/Δt = (1/2)×[S2O3^2-]_mixed / Δt\n- H2O2 variant: often same timer stoich as persulfate vs S2O3^2- (check stem equations)\n- compute: n = C_stock × V_stock; [X]_mixed = n / V_total\n\n# 實驗條件\n- temperature: higher T → larger k → shorter Δt (do not extrapolate if T regime changes a lot)\n- acidity: very low pH can decompose S2O3^2- (S ppt); very high pH can disproportionate I2\n- concentration: [timer] usually << [oxidant] for initial-rate style clock analysis\n- mixing_order: clock starts when the last key reagent enters\n- other: verify V_total = sum of all stocks + water each trial\n\n# 反應步驟\n- 1. oxidant + I- → I2 (SLOW, RDS; exact equation from stem)\n- 2. I2 + timer_reductant → I- (FAST)\n- 3. I2 + starch → blue-black (visible only after timer gone)\n\n# 解題步驟\n- 1. Identify variant (iodate / persulfate / H2O2 / other from stem)\n- 2. Compute V_total\n- 3. Compute n(oxidant), n(timer); form ratio with oxidant in numerator\n- 4. Apply color boundary (fraction form) before any time claim\n- 5. Compute mixed concentrations\n- 6. If signal possible and [timer] comparable across trials, use Rate or 1/t as allowed\n- 7. Fit Rate = k[oxidant]^m[I-]^n only with justified comparable conditions\n\n# 判定條件\n- 若不成立：缺澱粉 → 則：無可靠目視變色時間\n- 若不成立：n(IO3-)/n(HSO3-) ≤ 1/3（碘酸變體）→ 則：不變藍；time = null\n- 若不成立：n(S2O8^2-)/n(S2O3^2-) ≤ 1/2（過硫酸變體）→ 則：無訊號；time = null\n- 若不成立：各組 [timer]_mixed 不同卻直接比 1/Δt → 則：改算 Rate = Δ[oxidant]/Δt 再比\n\n# 解題禁忌\n- 判定變色可能前，禁止輸出變色秒數\n- 禁止用未混合的 stock 濃度直接代入速率式\n- 禁止在 timer 量改變時仍假設 1/t = Rate\n- 禁止設 Δ[oxidant] = [oxidant]_initial（變色時反應未進行至氧化劑耗盡）\n\n# 常見錯誤\n- wrong: jump to order/time scaling first → right: check n(oxidant)/n(timer) fraction boundary first\n- wrong: Rate = [S2O8^2-]_0 / Δt → right: Rate = (1/2)×[S2O3^2-]_mixed / Δt\n- wrong: treat exact ratio 1/3 (iodate) as “very slow blue” → right: no blue; time = null\n- wrong: assume [I-] drops a lot before blue → right: I- regenerated in fast step until timer ends\n\n# 常見變體\n- Landolt: IO3- + HSO3-; blue iff n(IO3-)/n(HSO3-) > 1/3\n- Persulfate–thiosulfate: signal iff n(S2O8^2-)/n(S2O3^2-) > 1/2\n- H2O2–iodide–thiosulfate: use stem stoich; timer often S2O3^2-\n\n# 解題書寫通則\n- 順序固定：混合後莫耳數 → 關鍵莫耳數比（分式）→ 判定現象是否成立 →（僅成立）才外推時間\n- 外推時間時「推導」必含：對照組 → 濃度或莫耳比 f → 級數 n → 速率比 f^n → 時間比 1/f^n → t'（逐步 calculation）\n- 選項若給具體秒數：須引用前面已算出的 f、n、t'；禁止只列濃度就寫秒數\n- 判定不成立（如 n(IO3-)/n(HSO3-) ≤ 1/3）：含「○秒後變藍」的選項必判錯，answer 不得選入\n\n# 擴充\n- stem equations override pattern equations when they conflict\n\n# 擴充_活化能\n- ln(t2/t1) = (Ea/R)×(1/T1 − 1/T2) when only T changes and signal remains possible\n- ln(1/t) vs 1/T slope ≈ −Ea/R\n"
  }
].map((card) => Object.freeze(card)));

  const INTENT_SYSTEM = [
    "你是台灣高中化學題的類型判讀器。只回傳 JSON，不寫詳解。",
    "任務：依題意（實驗目的、觀察現象、要判斷的量）判斷是否適用下列化學通則卡。",
    "以題意為主，不要只因為出現某個化學式就選卡。",
    "碘鐘卡僅適用於：以變色時間討論速率、級數或預測秒數的秒錶／碘鐘實驗；單純酸鹼、氧化還原滴定、寫反應式者不選。",
    "最多選 1 張最相關的卡；若不適用，card_ids 必須是空陣列。",
    "輸出：{\"card_ids\":[],\"intent_summary\":\"一句題意類型\",\"reason\":\"一句理由\"}"
  ].join("");

  const INTENT_SCHEMA = {
    type: "object",
    required: ["card_ids", "intent_summary", "reason"],
    properties: {
      card_ids: { type: "array", items: { type: "string" } },
      intent_summary: { type: "string" },
      reason: { type: "string" }
    }
  };

  function getById(id) {
    return CARDS.find((card) => card.id === id && card.status === "active") || null;
  }

  function getIntentCatalog() {
    return CARDS.filter((card) => card.status === "active").map((card) => ({
      id: card.id,
      title_zh: card.title_zh,
      intent_brief: card.intent_brief
    }));
  }

  function buildIntentUserText(questionText) {
    const catalog = getIntentCatalog();
    const lines = [
      "【題目文字（可能為空；若有圖片請一併依圖判讀）】",
      String(questionText || "").trim() || "（無文字，請只依圖片題意判斷）",
      "",
      "【可選化學通則卡目錄】"
    ];
    catalog.forEach((item) => {
      lines.push(`- id: ${item.id}｜${item.title_zh}｜${item.intent_brief}`);
    });
    lines.push("", "請只從上列 id 選擇；沒有合適者回傳空的 card_ids。");
    return lines.join("\n");
  }

  function parseIntentResult(raw) {
    const fallback = { card_ids: [], intent_summary: "", reason: "", parseFailed: true };
    try {
      let text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first >= 0 && last > first) text = text.slice(first, last + 1);
      const parsed = JSON.parse(text);
      const ids = Array.isArray(parsed?.card_ids)
        ? parsed.card_ids.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const known = new Set(CARDS.map((card) => card.id));
      return {
        card_ids: ids.filter((id) => known.has(id)).slice(0, 1),
        intent_summary: String(parsed?.intent_summary || "").trim(),
        reason: String(parsed?.reason || "").trim(),
        parseFailed: false
      };
    } catch (_) {
      return fallback;
    }
  }

  function resolveFromIntent(intent) {
    const parsed = intent && Array.isArray(intent.card_ids) ? intent : parseIntentResult(intent);
    const id = parsed.card_ids?.[0];
    const card = id ? getById(id) : null;
    if (!card) {
      return {
        card: null,
        source: "intent",
        intent_summary: parsed.intent_summary || "",
        reason: parsed.reason || "",
        parseFailed: !!parsed.parseFailed
      };
    }
    return {
      card,
      source: "intent",
      intent_summary: parsed.intent_summary || "",
      reason: parsed.reason || "",
      parseFailed: !!parsed.parseFailed
    };
  }

  function extractCardSections(body, names) {
    const text = String(body || "");
    const parts = [];
    (names || []).forEach((name) => {
      const re = new RegExp(String.raw`#\s*${name}\s*\n([\s\S]*?)(?=\n#\s|$)`);
      const m = text.match(re);
      if (m) parts.push(`# ${name}\n${String(m[1] || "").trim()}`);
    });
    return parts.join("\n\n");
  }

  function buildDecisionRuleBlock(card) {
    if (!card) return "";
    const shared = "題幹已提供反應式、計量關係、實驗條件或定義時，一律依題幹；通則卡只補足題幹未明示的判定條件。";
    if (card.id === "iodine-clock") {
      return [
        "【碘鐘判定條件】",
        shared,
        "碘酸－亞硫酸氫變體：先計算混合後 n(IO3-)/n(HSO3-)。比值≤1/3（含恰等於）時不變藍，變藍時間不適用，任何「幾秒後變藍」的選項均錯；比值>1/3 才可討論速率或時間。",
        "過硫酸鹽－硫代硫酸鹽變體：先計算混合後 n(S2O8^2-)/n(S2O3^2-)。比值≤1/2 時無訊號；比值>1/2 才可討論速率或時間。"
      ].join("\n");
    }
    return ["【化學判定條件】", shared].join("\n");
  }

  function blockTexts(document) {
    return (document?.blocks || []).map((b) => String(b.text || ""));
  }

  function headingIndex(blocks, keyword) {
    return blocks.findIndex((b) => b.type === "heading" && String(b.text || "").includes(keyword));
  }

  function choiceMarksCorrect(text) {
    const t = String(text || "");
    if (/錯誤|不正確|不成立|並非正確|敘述錯誤|不可選|不應選/.test(t)) return false;
    return /正確|成立|敘述正確|選項正確|應選|可選/.test(t);
  }

  function choiceHasClockTime(text) {
    const t = String(text || "");
    if (/\d+\s*秒/.test(t) && /變藍|變色|深藍|反應時間|秒錶|後.*變|變為|預測時間|反應時間/.test(t)) return true;
    return /(?:約|為|是|=|＝|非)\s*\d+\s*秒|\d+\s*秒(?:後|左右)?/.test(t);
  }

  function statesNoBlue(text) {
    return /不變藍|不會變藍|不會變色|時間不適用|無法變色|無變色|不會出現.*藍|不會呈.*藍|不發生顯色|無法顯色|莫耳比[^。]{0,20}≤\s*1\s*[／\/]3[^。]{0,20}(?:不變|不適用)/.test(String(text || ""));
  }

  /** 仍用「會變藍／多少秒」討論，卻沒寫不變藍 */
  function claimsBlueTimeWithoutNoBlue(text) {
    const t = String(text || "");
    if (!choiceHasClockTime(t)) return false;
    if (statesNoBlue(t)) return false;
    // 「非 800 秒／約 533 秒」仍暗示會變色計時
    return true;
  }

  function parsePlainNumber(raw) {
    const s = String(raw || "").replace(/,/g, "").replace(/\s+/g, "");
    const sci = s.match(/^(\d+(?:\.\d+)?)(?:\\times|×|x|\*)10\^\{?([+-]?\d+)\}?$/i)
      || s.match(/^(\d+(?:\.\d+)?)[eE]([+-]?\d+)$/);
    if (sci) return Number(sci[1]) * (10 ** Number(sci[2]));
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function findSpeciesValues(text, speciesAlt) {
    const t = String(text || "");
    const values = [];
    const re = new RegExp(
      String.raw`(?:\[\s*(?:\\ce\{)?(?:${speciesAlt})(?:\})?\s*\]|(?:${speciesAlt})\s*(?:濃度|混[合後]*)?)\s*[=＝:：]\s*([0-9]+(?:\.[0-9]+)?(?:\s*(?:\\times|×|x)\s*10\^\{?[+-]?\d+\}?)?)`,
      "gi"
    );
    let m;
    while ((m = re.exec(t))) {
      const v = parsePlainNumber(m[1]);
      if (v != null) values.push(v);
    }
    return values;
  }

  function inferStockConcentrations(text) {
    const t = String(text || "");
    let stockIo3 = null;
    let stockHso3 = null;
    // 0.428 g / 214 → 0.02 M（甲）
    if (/0\.428/.test(t) && /214/.test(t)) stockIo3 = 0.02;
    const ioDirect = t.match(/0\.02\d*\s*M/);
    if (ioDirect) stockIo3 = parsePlainNumber(ioDirect[0]) ?? stockIo3;
    const ioVals = findSpeciesValues(t, "IO_?3\\^?-?|碘酸根|KIO3|甲溶液");
    if (ioVals.some((v) => v >= 0.01 && v <= 0.05)) stockIo3 = ioVals.find((v) => v >= 0.01 && v <= 0.05) ?? stockIo3;

    if (/0\.004\d*\s*M/.test(t) || /乙溶液[^。]{0,40}0\.004/.test(t)) stockHso3 = 0.004;
    const hsVals = findSpeciesValues(t, "HSO_?3\\^?-?|亞硫酸氫根|NaHSO3|乙溶液");
    if (hsVals.some((v) => v >= 0.001 && v <= 0.01)) {
      stockHso3 = hsVals.find((v) => v >= 0.001 && v <= 0.01) ?? stockHso3;
    }
    return { stockIo3: stockIo3 ?? 0.02, stockHso3: stockHso3 ?? 0.004, inferredIo: stockIo3 != null, inferredHs: stockHso3 != null };
  }

  function parseVolumeMlPair(text) {
    const t = String(text || "");
    const patterns = [
      /甲[^。\n]{0,40}?(\d+(?:\.\d+)?)\s*mL[^。\n]{0,60}?乙[^。\n]{0,40}?(\d+(?:\.\d+)?)\s*mL/i,
      /乙[^。\n]{0,40}?(\d+(?:\.\d+)?)\s*mL[^。\n]{0,60}?甲[^。\n]{0,40}?(\d+(?:\.\d+)?)\s*mL/i,
      /(?:solution\s*)?A[^.\n]{0,40}?(\d+(?:\.\d+)?)\s*mL[^.\n]{0,60}?(?:solution\s*)?B[^.\n]{0,40}?(\d+(?:\.\d+)?)\s*mL/i,
      /(?:IO3|碘酸)[^。\n]{0,30}?(\d+(?:\.\d+)?)\s*mL[^。\n]{0,60}?(?:HSO3|亞硫)[^。\n]{0,30}?(\d+(?:\.\d+)?)\s*mL/i,
      /(\d+(?:\.\d+)?)\s*mL[^。\n]{0,30}甲[^。\n]{0,60}?(\d+(?:\.\d+)?)\s*mL[^。\n]{0,30}乙/i
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (!m) continue;
      const a = parsePlainNumber(m[1]);
      const b = parsePlainNumber(m[2]);
      if (a != null && b != null && a > 0 && b > 0) return { vIo3: a, vHso3: b, swapped: /乙/.test(re.source) && re.source.indexOf("甲") > re.source.indexOf("乙") };
    }
    return null;
  }

  function parseTotalVolumeMl(text) {
    const t = String(text || "");
    const m = t.match(/(?:總|合計|總共|保持|維持)[^。\n]{0,20}?(\d+(?:\.\d+)?)\s*mL/i)
      || t.match(/V\s*[=＝]\s*(\d+(?:\.\d+)?)\s*mL/i)
      || t.match(/(\d+(?:\.\d+)?)\s*mL[^。\n]{0,16}(?:總體積|總容量)/i);
    return m ? parsePlainNumber(m[1]) : null;
  }

  /** 只接受題幹可明確辨識的資料；不再以小濃度或經典題型猜測。 */
  function inferIodateTimerRatio(text) {
    const t = String(text || "");
    const ratioEq = t.match(/n\s*\(\s*(?:\\ce\{)?IO_?3[^)]*\)\s*[／\/]\s*n\s*\(\s*(?:\\ce\{)?HSO_?3[^)]*\)\s*[=＝]\s*([0-9]+\s*[／\/]\s*[0-9]+|[0-9.]+)/i);
    if (ratioEq) {
      const raw = ratioEq[1];
      const frac = String(raw).match(/([0-9.]+)\s*[／\/]\s*([0-9.]+)/);
      const ratio = frac ? Number(frac[1]) / Number(frac[2]) : parsePlainNumber(raw);
      if (ratio != null && Number.isFinite(ratio)) return { ratio, io3: null, hso3: null, source: "題幹明示莫耳比", confidence: "verified" };
    }
    const stocks = inferStockConcentrations(t);
    const volPair = parseVolumeMlPair(t);
    if (stocks.inferredIo && stocks.inferredHs && volPair) {
      const vIo3 = volPair.swapped ? volPair.vHso3 : volPair.vIo3;
      const vHso3 = volPair.swapped ? volPair.vIo3 : volPair.vHso3;
      if (vHso3 > 0) {
        const ratio = (stocks.stockIo3 * vIo3) / (stocks.stockHso3 * vHso3);
        return { ratio, io3: null, hso3: null, source: "題幹明示原液濃度與取用體積", confidence: "verified" };
      }
    }
    return null;
  }

  function isNoBlueRatio(ratio) {
    return ratio != null && Number.isFinite(ratio) && ratio <= 1 / 3 + 1e-9;
  }

  function suggestsIodateNoBlue(text) {
    const t = String(text || "");
    if (/≤\s*1\s*[／\/]3|<\s*1\s*[／\/]3|≤\s*0\.33|小於等於\s*1\s*[／\/]3|恰[為等於]\s*1\s*[／\/]3|等於\s*1\s*[／\/]3/.test(t)) return true;
    return false;
  }

  function choiceLabel(text) {
    const m = String(text || "").match(/^[（(]?\s*([A-Ha-h①-⑩⑴-⑽]|[一二三四五六七八九十]+|[0-9]+)\s*[）)]?/);
    return m ? String(m[1]).toUpperCase() : "";
  }

  function resolveFromDocument(document) {
    const t = blockTexts(document).join("\n");
    if (!t.trim()) return null;
    if (/碘量滴定|直接加澱粉驗碘/.test(t)) return null;
    const landolt = /IO3|碘酸|KIO3|0\.428/.test(t) && /HSO3|亞硫酸|NaHSO3|0\.004/.test(t);
    const clock = /秒錶|碘鐘|變藍|澱粉|Landolt|\d+\s*秒|800/.test(t);
    if (!(landolt && clock)) return null;
    const card = getById("iodine-clock");
    if (!card) return null;
    return {
      card,
      source: "document",
      intent_summary: "詳解內容命中碘鐘／秒錶反應",
      reason: "詳解含 IO3/HSO3 與變色時間語意",
      parseFailed: false
    };
  }

  function auditDocument(document, hit, questionText) {
    const issues = [];
    const warnings = [];
    if (!document?.blocks?.length) return { issues, warnings, ratioInfo: null, state: "insufficient-data" };
    const effectiveHit = hit;
    if (!effectiveHit?.card) return { issues, warnings, ratioInfo: null, state: "insufficient-data" };

    const blocks = document.blocks;
    const allText = blockTexts(document).join("\n");
    const ans = String(document.answer || "");
    const ratioInfo = effectiveHit.card.id === "iodine-clock"
      ? inferIodateTimerRatio(String(questionText || ""))
      : null;
    const computedNoBlue = !!(ratioInfo?.confidence === "verified" && isNoBlueRatio(ratioInfo.ratio));
    const state = ratioInfo?.confidence === "verified"
      ? (computedNoBlue ? "confirmed-no-blue" : "confirmed-blue")
      : "insufficient-data";
    const noBlueEvidence = computedNoBlue;
    const docStatesNoBlue = statesNoBlue(allText);

    if (effectiveHit.card.id === "iodine-clock") {
      // 核心硬規則：比值≤1/3 時，任何「用秒數討論變色」且未寫不變藍 → 一律不合格
      // （含：判錯誤但理由是「533 秒不是 800 秒」這種假修正）
      if (computedNoBlue || noBlueEvidence) {
        const detail = ratioInfo && Number.isFinite(ratioInfo.ratio)
          ? (ratioInfo.io3 != null
            ? `本機比值≈${ratioInfo.ratio.toFixed(4)}（[IO3]≈${ratioInfo.io3}，[HSO3]≈${ratioInfo.hso3}，${ratioInfo.source}）`
            : `本機比值≈${ratioInfo.ratio.toFixed(4)}（${ratioInfo.source}）`)
          : "莫耳比≤1/3";

        blocks.filter((b) => b.type === "choice").forEach((block) => {
          const t = block.text;
          if (!claimsBlueTimeWithoutNoBlue(t)) return;
          issues.push(`通則卡：${detail} → 必須寫「不變藍／時間不適用」；禁止用任何預測秒數（含 800／533）當理由`);
          const label = choiceLabel(t);
          if (label && new RegExp(String.raw`\b${label}\b|[（(]${label}[）)]`).test(ans) && choiceMarksCorrect(t)) {
            issues.push(`通則卡：答案含（${label}）但該條件下不變藍，不得入選`);
          }
        });

        // 全文層：出現 800／533 等秒數外推，卻沒有不變藍結論
        if (/\d+\s*秒/.test(allText) && !docStatesNoBlue && (computedNoBlue || /800|533|1\s*mL|15\s*mL/.test(allText))) {
          issues.push(`通則卡：${detail}；全文須明確「不變藍、時間不適用」，不得只改秒數或說非 800 秒`);
        }
        if (!docStatesNoBlue) {
          issues.push("通則卡：本機判定 ≤1/3，詳解缺少「不變藍／時間不適用」關鍵句");
        }
      }

      // 仍保留：把「秒數選項判正確」當額外硬錯
      blocks.filter((b) => b.type === "choice").forEach((block) => {
        const t = block.text;
        if (!(choiceHasClockTime(t) && choiceMarksCorrect(t))) return;
        if (computedNoBlue || noBlueEvidence) {
          issues.push("通則卡：≤1/3（不變藍）時，含秒數選項不得判正確");
        }
      });
    }

    return {
      issues: [...new Set(issues)],
      warnings: [...new Set(warnings)],
      ratioInfo,
      state
    };
  }

  function hasNoBlueTimeViolation(audit) {
    return audit?.state === "confirmed-no-blue" && (audit?.issues || []).length > 0;
  }

  function documentStatesNoBlue(document) {
    return statesNoBlue(blockTexts(document).join("\n"));
  }

  function buildPrecomputedBoundaryBlock(questionText, hit) {
    if (!hit?.card || hit.card.id !== "iodine-clock") return "";
    const ratioInfo = inferIodateTimerRatio(String(questionText || ""));
    if (!ratioInfo || ratioInfo.confidence !== "verified" || !Number.isFinite(ratioInfo.ratio) || ratioInfo.ratio > 1 / 3 + 1e-9) return "";
    const ratio = ratioInfo.ratio;
    const ratioLabel = Math.abs(ratio - 1 / 3) <= 1e-6
      ? "1/3（恰等於邊界）"
      : `≤1/3（約 ${ratio.toFixed(4)}）`;
    const detail = ratioInfo.io3 != null
      ? `[IO3]混合≈${ratioInfo.io3} M，[HSO3]混合≈${ratioInfo.hso3} M（${ratioInfo.source}）`
      : `n(IO3-)/n(HSO3-)≈${ratio.toFixed(4)}（${ratioInfo.source}）`;
    return [
      "【題幹已確認的碘鐘條件】",
      `依題目可辨識數據：${detail}，莫耳比 ${ratioLabel}。`,
      "碘酸 Landolt：n(IO3-)/n(HSO3-) ≤ 1/3 → 不變藍，時間不適用（禁止給任何秒數）。",
      "凡選項寫「○秒後變深藍／變色」者，在此條件下必判錯，answer 不得選入。"
    ].join("\n");
  }

  function buildCorrectionUserBlock(audit, previousReply) {
    const issues = (audit?.issues || []).slice(0, 6);
    if (!issues.length) return "";
    const ratio = audit?.ratioInfo;
    const ratioLine = ratio && Number.isFinite(ratio.ratio)
      ? `本機莫耳比≈${ratio.ratio.toFixed(4)}（${ratio.source || ""}），≤1/3 → 不變藍。`
      : "莫耳比 ≤1/3 → 不變藍。";
    return [
      "【通則卡修正｜必須重寫詳解】",
      "上一版詳解違反碘鐘通則卡，請完全重寫 JSON（不要只改 answer）。",
      ratioLine,
      ...issues.map((msg, i) => `${i + 1}. ${msg}`),
      "修正要求：推導須先算混合後莫耳比並判定能否變藍；≤1/3 時明寫「不變藍、時間不適用」；含秒數的選項必判錯；answer 不得選入這類選項。",
      "【上一版詳解（僅供對照錯誤，勿沿用錯誤秒數）】",
      String(previousReply || "").slice(0, 4000)
    ].join("\n");
  }

  function resolveFromKeywords(questionText) {
    const t = String(questionText || "");
    if (!t.trim()) return null;
    if (/碘量滴定|直接加澱粉驗碘/.test(t)) return null;
    const hitClock = /秒錶反應|碘鐘|碘鐘反應|Landolt|iodine\s*clock|澱粉變藍|無色.*深藍|突然.*變藍|變色時間|反應時間.*秒|秒錶|深藍色/i.test(t);
    const hitLandolt = /IO3|碘酸根|碘酸鹽|KIO3|0\.428/.test(t) && /HSO3|亞硫酸氫|亞硫酸根|NaHSO3|0\.004/.test(t);
    const hitPersulfate = /S2O8|過硫酸/.test(t) && /S2O3|硫代硫酸/.test(t);
    const hitRateStudy = /反應速率級數|反應時間與濃度|反應機制.*速率|速率.*反應機制/.test(t);
    if (hitClock || hitRateStudy || (hitLandolt && /變藍|澱粉|秒|反應時間|甲溶液|乙溶液/.test(t)) || (hitPersulfate && hitClock)) {
      const card = getById("iodine-clock");
      return card
        ? { card, source: "keyword", intent_summary: "關鍵字命中碘鐘／秒錶反應", reason: "題幹含秒錶／碘鐘或典型試劑對", parseFailed: false }
        : null;
    }
    return null;
  }

  function buildReferenceBlock(hit) {
    if (!hit?.card) return "";
    const card = hit.card;
    return buildDecisionRuleBlock(card);
  }

  function describeHit(hit) {
    if (!hit?.card) return "化學通則卡：未參考。";
    return `化學通則卡：已參考「${hit.card.title_zh}」。`;
  }

  global.ChemRuleCards = Object.freeze({
    CARDS,
    INTENT_SYSTEM,
    INTENT_SCHEMA,
    getById,
    getIntentCatalog,
    buildIntentUserText,
    parseIntentResult,
    resolveFromIntent,
    documentStatesNoBlue,
    inferIodateTimerRatio,
    hasNoBlueTimeViolation,
    buildPrecomputedBoundaryBlock,
    buildCorrectionUserBlock,
    extractCardSections,
    buildDecisionRuleBlock,
    buildReferenceBlock,
    auditDocument,
    describeHit
  });
})(typeof window !== "undefined" ? window : globalThis);
