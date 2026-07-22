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
          const C = SolutionCore;
          const cases = [
            { name: 'ok', raw: '{"blocks":[{"type":"paragraph","text":"測試"}],"answer":"A"}' },
            { name: 'trunc', raw: '{"blocks":[{"type":"calculation","text":"a=\\\\dfrac{1}{2}"}],"answer":"A"' },
            { name: 'fence', raw: '```json\\n{"blocks":[{"type":"choice","text":"（甲）正確"}],"answer":"甲"}\\n```' },
            { name: 'htmlTrunc', raw: '{"blocks":[{"type":"calculation","text":"n=\\\\htmlData{note=醋酸濃度（M）}{0.10}"}],"ans' },
            { name: 'unescaped', raw: '{"blocks":[{"type":"calculation","text":"n=\\dfrac{1}{2}=0.5"}],"answer":"A"}' }
          ];
          return cases.map((c) => {
            const prep = C.prepare(c.raw);
            return { name: c.name, ok: !!prep.ok, reason: prep.reason || null, hasText: !!(prep.text && prep.text.length) };
          });
        }""")
        browser.close()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        bad = [x for x in result if not x['ok'] and x['name'] in ('ok', 'trunc', 'fence', 'unescaped')]
        return 1 if bad else 0

if __name__ == '__main__':
    raise SystemExit(main())
