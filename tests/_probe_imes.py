# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright

JS = Path(__file__).resolve().parents[1].joinpath('js/solution-core.js').read_text(encoding='utf-8')

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content('<html></html>')
        page.add_script_tag(content=JS)
        result = page.evaluate(r"""() => {
          const C = SolutionCore;
          const fail = (m) => { throw new Error(m); };

          const tabbed = '0.10 M' + String.fromCharCode(9) + 'imes0.020 L=0.002 0.10 M' + String.fromCharCode(9) + 'imes0.005=0.0005';
          const fixed = C.restoreEatenLatexCommands(tabbed);
          if (fixed.includes(String.fromCharCode(9))) fail('tab remains: ' + JSON.stringify(fixed));
          if (/imes/i.test(fixed.replace(/\\times/g, ''))) fail('imes remains: ' + JSON.stringify(fixed));
          if (!fixed.includes('\\times')) fail('no times: ' + JSON.stringify(fixed));

          const jsonSrc = '{"blocks":[{"type":"calculation","text":"0.10 M' + String.fromCharCode(9) + 'imes0.020=0.002 0.10 M' + String.fromCharCode(9) + 'imes0.005=0.0005"}],"answer":"A"}';
          const srcFixed = C.restoreEatenLatexInJsonSource(jsonSrc);
          if (srcFixed.includes(String.fromCharCode(9))) fail('tab remains in json src');
          const prep = C.prepare(srcFixed);
          if (!prep.ok) fail('prepare eaten');
          if (!/\\times/.test(prep.text)) fail('no times: ' + prep.text);
          if (/\\htmlData/.test(prep.text)) fail('unexpected note');

          const crowded = C.prepare(JSON.stringify({
            blocks: [{ type: 'calculation', text: '0.10 M × 0.020 L = 0.002 0.10 M × 0.005 L = 0.0005 0.002 - 0.0005 = 0.0015' }],
            answer: 'x'
          }));
          const lines = crowded.text.split('\n').filter((l) => l.startsWith('$'));
          if (lines.length < 3) fail('not split enough (' + lines.length + '): ' + crowded.text);

          const comma = C.fullwidth('濃度 0.10, M，體積 20.0, mL');
          if (/0\.10,\s*M/.test(comma) || /20\.0,\s*mL/.test(comma)) fail('comma remains: ' + comma);

          return { ok: true, lines: lines.length };
        }""")
        browser.close()
        print('PROBE_IMES_OK', result)

if __name__ == '__main__':
    main()
