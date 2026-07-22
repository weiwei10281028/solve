# -*- coding: utf-8 -*-
"""逗號剝除、分式與分段（NOTE 已移除）。"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parents[1]
CORE_JS = (ROOT / 'js' / 'solution-core.js').read_text(encoding='utf-8')
RENDER_JS = (ROOT / 'js' / 'render.js').read_text(encoding='utf-8')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content('<html><body></body></html>')
        page.add_script_tag(content=CORE_JS)
        page.evaluate("""() => {
          window.ChemistryLatex = window.ChemistryLatex || { toCe: (s) => s };
        }""")
        try:
            page.add_script_tag(content=RENDER_JS)
        except Exception:
            pass

        result = page.evaluate(
            """() => {
              const Core = globalThis.SolutionCore;
              const fail = (m) => { throw new Error(m); };
              const sys = Core.SYSTEM;
              if (!sys.includes('禁止任何逗號')) fail('prompt comma');
              if (!sys.includes('一步一式')) fail('prompt split');
              if (sys.includes('\\\\htmlData{note=')) fail('sys still asks NOTE');

              const fw = Core.fullwidth('濃度 0.10, M，體積 20.0， mL');
              if (/0\\.10\\s*[,，]/.test(fw) || /20\\.0\\s*[,，]/.test(fw)) fail('fullwidth comma: ' + fw);

              const calcComma = Core.calculation('0.10, M\\\\times20.0, mL=2.0, mmol');
              if (/0\\.10\\s*,/.test(calcComma) || /20\\.0\\s*,/.test(calcComma)) fail('calc comma: ' + calcComma);

              const prepared = Core.prepare(JSON.stringify({
                blocks: [
                  { type: 'paragraph', text: '已知醋酸初始體積 20.0, mL，濃度 0.10, M。' },
                  { type: 'calculation', text: '0.10M \\\\times 20.0mL = 2.0mmol' },
                  { type: 'calculation', text: '[H+]=1.8\\\\times10^{-5}\\\\times\\\\dfrac{1.5}{0.5}=5.4\\\\times10^{-5}' }
                ],
                answer: 'x'
              }));
              if (!prepared.ok) fail('prepare failed');
              if (/\\\\htmlData/.test(prepared.text)) fail('htmlData remains: ' + prepared.text);
              if (!/\\\\dfrac/.test(prepared.text)) fail('missing dfrac: ' + prepared.text);
              if (/0\\.10\\s*[,，]\\s*M/.test(prepared.text) || /20\\.0\\s*[,，]/.test(prepared.text)) {
                fail('comma remains in prep: ' + prepared.text);
              }

              const eqChem = Core.chemistry('CH3COOH + OH- <=> CH3COO- + H2O');
              if (!eqChem.includes('⇌')) fail('arrow');

              let norm = prepared.text;
              if (typeof normalizeScientificTokens === 'function') {
                norm = normalizeScientificTokens(prepared.text);
                if (/\\$0\\.10\\$\\s*[,，]/.test(norm)) fail('norm split: ' + norm);
                if (/0\\.10\\s*[,，]\\s*(?:\\$)?(?:\\\\mathrm\\{)?M/.test(norm)) fail('norm comma: ' + norm);
              }

              return { ok: true, sample: prepared.text.slice(0, 500), fw, calcComma, norm: String(norm).slice(0, 400) };
            }"""
        )
        browser.close()
        out = ROOT / 'tests' / '_probe_note_comma_out.json'
        out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'ok': result.get('ok')}, ensure_ascii=False))
        return 0 if result.get('ok') else 1


if __name__ == '__main__':
    raise SystemExit(main())
