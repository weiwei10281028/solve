# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / 'js' / 'solution-core.js').read_text(encoding='utf-8')


def main():
    cases = {
        'legacyNote': r'[\ce{IO3^-}]=\dfrac{\htmlData{note=碘酸鉀質量（g）}{0.428}}{\htmlData{note=碘酸鉀式量}{214}}=0.02M',
        'stickyExpr': r'$K_{b}=\dfrac{K_{w}}{K_{a}}\approx 5.56 \times 10^{-10} $[\ce{OH-}]=\sqrt{5.56\times10^{-10}\times0.05}$',
        'slash': '3/4=0.75',
        'bareExpr': r'x=\dfrac{1}{2}=0.5',
        'crowded': '0.10 M × 0.020 L = 0.002 0.10 M × 0.005 L = 0.0005',
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content('<html><body></body></html>')
        page.add_script_tag(content=JS)
        result = page.evaluate(
            """(cases) => {
              const Core = globalThis.SolutionCore;
              const fail = (m) => { throw new Error(m); };
              if (!Core.SYSTEM.includes('一步一式')) fail('one-step');
              if (!Core.SYSTEM.includes('禁止任何逗號')) fail('comma rule');
              if (!Core.SYSTEM.includes('\\\\dfrac')) fail('dfrac');
              if (Core.SYSTEM.includes('\\\\htmlData{note=')) fail('sys still asks NOTE');
              if (typeof Core.auditNotes === 'function') fail('auditNotes still exported');

              const legacy = Core.prepare(JSON.stringify({
                blocks: [{ type: 'calculation', text: cases.legacyNote }],
                answer: '0.02'
              }));
              if (!legacy.ok) fail('legacy prepare');
              if (/\\\\htmlData/.test(legacy.text)) fail('htmlData remains: ' + legacy.text);
              if (!legacy.text.includes('0.428') || !/\\\\dfrac/.test(legacy.text)) fail('dfrac/values lost');

              const sticky = Core.prepare(JSON.stringify({
                blocks: [{ type: 'calculation', expression: cases.stickyExpr }],
                answer: 'x'
              }));
              if (sticky.text.split('\\n').filter((l) => l.startsWith('$')).length < 2) fail('sticky not split');

              const slash = Core.calculation(cases.slash);
              if (!slash.includes('\\\\dfrac{3}{4}')) fail('slash');

              const bare = Core.prepare(JSON.stringify({
                blocks: [{ type: 'calculation', expression: cases.bareExpr }],
                answer: '0.5'
              }));
              if (/\\\\htmlData/.test(bare.text)) fail('bare got note');

              const crowded = Core.prepare(JSON.stringify({
                blocks: [{ type: 'calculation', text: cases.crowded }],
                answer: 'x'
              }));
              const lines = crowded.text.split('\\n').filter((l) => l.startsWith('$'));
              if (lines.length < 2) fail('crowded not split: ' + crowded.text);

              const comma = Core.calculation('20.0, mL');
              if (/20\\.0,\\s*mL/.test(comma)) fail('comma remains: ' + comma);

              return { ok: true, lines: lines.length };
            }""",
            cases,
        )
        browser.close()
        print('PROBE_THIN_OK', result)


if __name__ == '__main__':
    main()
