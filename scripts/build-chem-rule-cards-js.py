# -*- coding: utf-8 -*-
"""Rebuild js/chem-rule-cards.js from chem-rule-cards/*.en.md (intent-first)."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
cards_dir = root / "chem-rule-cards"


def parse_md(path: Path):
    raw = path.read_text(encoding="utf-8")
    meta = {}
    body = raw
    if raw.startswith("---"):
        end = raw.find("---", 3)
        yaml = raw[3:end]
        body = raw[end + 3 :].lstrip("\n")
        for line in yaml.splitlines():
            if ":" in line and not line.strip().startswith("-"):
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip().strip('"').strip("'")
    return meta, body


def load_cards():
    out = []
    for path in sorted(cards_dir.glob("*.en.md")):
        meta, body = parse_md(path)
        cid = meta.get("id") or path.name.replace(".en.md", "")
        out.append(
            {
                "id": cid,
                "title_zh": meta.get("title_zh", cid),
                "title_en": meta.get("title_en", cid),
                "priority": int(meta.get("priority") or 50),
                "status": meta.get("status") or "draft",
                "card_version": meta.get("card_version") or "1.0.0",
                "intent_brief": meta.get("intent_brief") or INTENT_BRIEFS.get(cid, meta.get("title_zh", cid)),
                "body": body,
            }
        )
    return out


INTENT_BRIEFS = {
    "iodine-clock": (
        "碘鐘／秒錶反應：溶液由無色突然變深藍（澱粉），以變色時間討論速率、反應級數或預測時間；"
        "常見 IO3-+HSO3-（Landolt）或 S2O8-+S2O3-／H2O2 等變體"
    ),
}


def main():
    cards = [c for c in load_cards() if c["status"] == "active"]
    cards_js = json.dumps(cards, ensure_ascii=False, indent=2)
    js = f"""/**
 * 化學通則卡：解題前依「題意」預判後注入參考資料（非答案照抄）。
 * 與進階「章節類型」分開。正文來源 chem-rule-cards/*.en.md。
 * 重建：python scripts/build-chem-rule-cards-js.py
 */
(function (global) {{
  const CARDS = Object.freeze({cards_js}.map((card) => Object.freeze(card)));

  const INTENT_SYSTEM = [
    "你是台灣高中化學題的類型判讀器。只回傳 JSON，不寫詳解。",
    "任務：依題意（實驗目的、觀察現象、要判斷的量）判斷是否適用下列化學通則卡。",
    "以題意為主，不要只因為出現某個化學式就選卡。",
    "最多選 1 張最相關的卡；若不適用，card_ids 必須是空陣列。",
    "輸出：{{\\"card_ids\\":[],\\"intent_summary\\":\\"一句題意類型\\",\\"reason\\":\\"一句理由\\"}}"
  ].join("");

  const INTENT_SCHEMA = {{
    type: "object",
    required: ["card_ids", "intent_summary", "reason"],
    properties: {{
      card_ids: {{ type: "array", items: {{ type: "string" }} }},
      intent_summary: {{ type: "string" }},
      reason: {{ type: "string" }}
    }}
  }};

  function getById(id) {{
    return CARDS.find((card) => card.id === id && card.status === "active") || null;
  }}

  function getIntentCatalog() {{
    return CARDS.filter((card) => card.status === "active").map((card) => ({{
      id: card.id,
      title_zh: card.title_zh,
      intent_brief: card.intent_brief
    }}));
  }}

  function buildIntentUserText(questionText) {{
    const catalog = getIntentCatalog();
    const lines = [
      "【題目文字（可能為空；若有圖片請一併依圖判讀）】",
      String(questionText || "").trim() || "（無文字，請只依圖片題意判斷）",
      "",
      "【可選化學通則卡目錄】"
    ];
    catalog.forEach((item) => {{
      lines.push(`- id: ${{item.id}}｜${{item.title_zh}}｜${{item.intent_brief}}`);
    }});
    lines.push("", "請只從上列 id 選擇；沒有合適者回傳空的 card_ids。");
    return lines.join("\\n");
  }}

  function parseIntentResult(raw) {{
    const fallback = {{ card_ids: [], intent_summary: "", reason: "", parseFailed: true }};
    try {{
      let text = String(raw || "").trim().replace(/^```(?:json)?\\s*/i, "").replace(/\\s*```$/, "");
      const first = text.indexOf("{{");
      const last = text.lastIndexOf("}}");
      if (first >= 0 && last > first) text = text.slice(first, last + 1);
      const parsed = JSON.parse(text);
      const ids = Array.isArray(parsed?.card_ids)
        ? parsed.card_ids.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      const known = new Set(CARDS.map((card) => card.id));
      return {{
        card_ids: ids.filter((id) => known.has(id)).slice(0, 1),
        intent_summary: String(parsed?.intent_summary || "").trim(),
        reason: String(parsed?.reason || "").trim(),
        parseFailed: false
      }};
    }} catch (_) {{
      return fallback;
    }}
  }}

  function resolveFromIntent(intent) {{
    const parsed = intent && Array.isArray(intent.card_ids) ? intent : parseIntentResult(intent);
    const id = parsed.card_ids?.[0];
    const card = id ? getById(id) : null;
    if (!card) {{
      return {{
        card: null,
        source: "intent",
        intent_summary: parsed.intent_summary || "",
        reason: parsed.reason || "",
        parseFailed: !!parsed.parseFailed
      }};
    }}
    return {{
      card,
      source: "intent",
      intent_summary: parsed.intent_summary || "",
      reason: parsed.reason || "",
      parseFailed: !!parsed.parseFailed
    }};
  }}

  function buildMandatoryWorkflowBlock(card) {{
    if (!card) return "";
    const lines = [
      "【化學通則卡｜強制解題順序（必須遵守）】",
      "① 混合後莫耳數：各試劑 c×V，注意總體積 V_total",
      "② 關鍵莫耳數比：依通則寫分式（氧化劑／定時還原劑在分子），與邊界比較",
      "③ 判定條件：觀察現象（變藍／訊號）是否成立；寫明「成立」或「不成立」",
      "④ 僅當③成立，才可討論速率、級數或外推變色時間；不成立則 time 不適用",
      "⑤ 外推時間時，heading「推導」須含完整鏈：對照組 → 濃度比 f → 級數 n → 速率比 → 時間比 → t'（每步 calculation）",
      "⑥ 選項分析：凡含具體秒數的敘述，須引用⑤的 f、n、t'；③不成立者必判錯，answer 不得選入"
    ];
    if (card.id === "iodine-clock") {{
      lines.push(
        "⑦ 碘酸變體：必先算 n(IO3-)/n(HSO3-) 與 1/3；≤1/3 → 不變藍，禁止 800 秒等時間外推"
      );
    }}
    return lines.join("\\n");
  }}

  function buildSystemSupplement(hit) {{
    if (!hit?.card) return "";
    return [
      "",
      "【化學通則卡｜系統約束】",
      `本題已參考「${{hit.card.title_zh}}」。`,
      "必須先完成莫耳數比與判定條件，再寫速率或時間；選項含秒數須有完整推導鏈。",
      "判定現象不成立時，不得把含變色時間的選項判為正確。"
    ].join("\\n");
  }}

  function blockTexts(document) {{
    return (document?.blocks || []).map((b) => String(b.text || ""));
  }}

  function headingIndex(blocks, keyword) {{
    return blocks.findIndex((b) => b.type === "heading" && String(b.text || "").includes(keyword));
  }}

  function choiceMarksCorrect(text) {{
    const t = String(text || "");
    if (/錯誤|不正確|不成立|並非正確/.test(t)) return false;
    return /正確|成立|敘述正確|選項正確/.test(t);
  }}

  function choiceHasClockTime(text) {{
    return /\\d+\\s*秒/.test(String(text || "")) && /變藍|變色|深藍|反應時間|秒錶/.test(String(text || ""));
  }}

  function auditDocument(document, hit) {{
    const issues = [];
    const warnings = [];
    if (!hit?.card || !document?.blocks?.length) return {{ issues, warnings }};
    const blocks = document.blocks;
    const allText = blockTexts(document).join("\\n");
    const deriveIdx = headingIndex(blocks, "推導");
    const choiceIdx = headingIndex(blocks, "選項");
    const deriveText = deriveIdx >= 0
      ? blockTexts({{ blocks: blocks.slice(deriveIdx, choiceIdx >= 0 ? choiceIdx : blocks.length) }})
      : [];
    const deriveJoined = deriveText.join("\\n");
    const hasRatioCheck = /n\\s*\\(\\s*IO3|莫耳數比|1\\s*[\\/／:：]\\s*3|三分之一|IO3.*HSO3|碘酸.*亞硫酸|n\\([^)]*\\)\\s*[\\/／]\\s*n\\(/.test(allText);
    const hasFeasibilityNo = /不變藍|不會變|時間不適用|現象不成立|≤\\s*1\\s*[\\/／]3|小於等於|無法變色|不會出現.*藍/.test(allText);
    const hasTimeChain = /(?:二級|級數|速率比|時間比|倍|dfrac|1\\s*[\\/／]4|16|50\\s*[×x*]|\\^2|f\\^n)/.test(deriveJoined + allText);
    const calcBlocksInDerive = deriveText.filter((t) => /(?:=|＝)/.test(t)).length;

    if (hit.card.id === "iodine-clock") {{
      blocks.filter((b) => b.type === "choice").forEach((block) => {{
        const t = block.text;
        if (choiceHasClockTime(t) && choiceMarksCorrect(t)) {{
          if (!hasRatioCheck) {{
            issues.push("通則卡：含變色秒數且判正確的選項，全文未先檢查關鍵莫耳數比／1/3 邊界");
          }}
          if (!hasTimeChain || calcBlocksInDerive < 2) {{
            issues.push("通則卡：外推變色時間前，「推導」缺少濃度比→級數→時間比的完整 calculation 鏈");
          }}
        }}
      }});
      if (/800\\s*秒/.test(allText) && /[（(]E[）)]/.test(allText) && choiceMarksCorrect(allText.match(/[（(]E[）)][\\s\\S]{{0,120}}/)?.[0] || "")) {{
        if (!hasRatioCheck) issues.push("通則卡：(E) 判正確但未先算 n(IO3-)/n(HSO3-) 與 1/3");
        if (!hasFeasibilityNo && /1\\s*[\\/／:：]\\s*3|0\\.001.*0\\.003|1\\s*甲.*15\\s*乙/.test(allText)) {{
          warnings.push("通則卡：莫耳比可能 ≤1/3，仍判 (E) 含 800 秒為正確");
        }}
      }}
      const ans = String(document.answer || "");
      if (/\\bE\\b|[（(]E[）)]/.test(ans) && /800/.test(allText) && !hasFeasibilityNo) {{
        warnings.push("通則卡：答案含 (E) 且出現 800 秒，請確認 n(IO3-)/n(HSO3-) 是否 > 1/3");
      }}
    }}

    return {{
      issues: [...new Set(issues)],
      warnings: [...new Set(warnings)]
    }};
  }}

  function buildReferenceBlock(hit) {{
    if (!hit?.card) return "";
    const card = hit.card;
    const summary = hit.intent_summary ? `題意摘要：${{hit.intent_summary}}` : "";
    const reason = hit.reason ? `判讀理由：${{hit.reason}}` : "";
    return [
      buildMandatoryWorkflowBlock(card),
      "",
      "【化學通則卡｜參考】",
      `系統依題意參考：「${{card.title_zh}}」（id=${{card.id}}，v${{card.card_version}}）`,
      summary,
      reason,
      "本區塊是解題參考通則，不是題目答案；請依本題數據自行推理，禁止整段照抄。",
      "與使用者勾選的章節類型分開；衝突時優先遵守本卡「判定條件／關鍵通則」。",
      "",
      card.body
    ].filter(Boolean).join("\\n");
  }}

  function describeHit(hit) {{
    if (!hit?.card) return "化學通則卡：未參考。";
    return `化學通則卡：已參考「${{hit.card.title_zh}}」。`;
  }}

  global.ChemRuleCards = Object.freeze({{
    CARDS,
    INTENT_SYSTEM,
    INTENT_SCHEMA,
    getById,
    getIntentCatalog,
    buildIntentUserText,
    parseIntentResult,
    resolveFromIntent,
    buildMandatoryWorkflowBlock,
    buildSystemSupplement,
    buildReferenceBlock,
    auditDocument,
    describeHit
  }});
}})(typeof window !== "undefined" ? window : globalThis);
"""
    # Fix double-encoded braces from f-string for JSON in CARDS - we used {cards_js} which is fine
    # But INTENT_SCHEMA and templates used {{ which is correct
    (root / "js" / "chem-rule-cards.js").write_text(js, encoding="utf-8")
    print(f"wrote chem-rule-cards.js with {len(cards)} card(s)")


if __name__ == "__main__":
    main()
