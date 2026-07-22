# -*- coding: utf-8 -*-
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

JS = Path(__file__).resolve().parents[1].joinpath('js/solution-core.js').read_text(encoding='utf-8')

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content('<html></html>')
        page.add_script_tag(content=JS)
        result = page.evaluate("""() => {
          const tab = String.fromCharCode(9);
          const input = '0.10 M' + tab + 'imes0.020';
          const inline = input.split(tab + 'imes').join('\\\\times');
          const fn = String(SolutionCore.restoreEatenLatexCommands);
          const out = SolutionCore.restoreEatenLatexCommands(input);
          return {
            inputCodes: [...input].map((c) => c.charCodeAt(0)),
            inline,
            inlineCodes: [...inline].map((c) => c.charCodeAt(0)),
            out,
            outCodes: [...out].map((c) => c.charCodeAt(0)),
            fnHasSplit: fn.includes('fromCharCode(9)'),
            fnSlice: fn.slice(0, 280)
          };
        }""")
        browser.close()
        Path('_probe_imes_debug.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

if __name__ == '__main__':
    raise SystemExit(main())
