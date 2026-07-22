# -*- coding: utf-8 -*-
"""呼叫 Gemini API 取得兩題原始 JSON，並做靜態問題掃描。"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests' / 'fixtures'
OUT.mkdir(parents=True, exist_ok=True)

API_KEY = sys.argv[1] if len(sys.argv) > 1 else ''
MODEL = 'gemini-3.5-flash'

QUESTIONS = {
    'acid-strength': """【題目】
下列各酸鹼反應均有利於產物：
(1) CH3COOH + HS- → H2S + CH3COO-
(2) H3O+ + H2PO4- → H3PO4 + H2O
(3) H2S + OH- → H2O + HS-
(4) H3PO4 + CH3COO- → CH3COOH + H2PO4-
下列各布－洛酸的強度順序，何者正確？
(A) H3PO4 > CH3COOH > H3O+ > H2O > H2S
(B) CH3COOH > H3O+ > H3PO4 > H2S > H2O
(C) H3O+ > H3PO4 > CH3COOH > H2S > H2O
(D) H2S > H3O+ > H3PO4 > CH3COOH > H2O""",
    'titration': """【題目】
4. 有一未知濃度的醋酸溶液 20.0 毫升，今以 0.10 M 的 NaOH 標準溶液滴定，當加入 20.0 毫升的 NaOH 溶液時，可達滴定終點。下列有關其滴定過程與滴定終點的敘述，何者正確？（醋酸的 Ka = 1.8 × 10^{-5} ，√(500/18) = 5.27，10/5.27 ≈ 1.90）
(甲) 在加入 5.0 毫升的 NaOH 溶液後，醋酸溶液的氫離子濃度約為 5.4 × 10^{-5} M
(乙) 達滴定終點時，溶液的 pH 值應介於 8 和 9 之間
(丙) 已知溴瑞香草酚藍變色範圍約在 pH 6.0 ~ 8.0 之間，適用於判斷此滴定終點
(A) 只有甲 (B) 只有乙 (C) 只有丙 (D) 甲與乙 (E) 甲與丙""",
}

SCHEMA = {
    'type': 'object',
    'required': ['blocks', 'answer'],
    'properties': {
        'blocks': {
            'type': 'array',
            'items': {
                'type': 'object', 'required': ['type', 'text'],
                'properties': {
                    'type': {'type': 'string', 'enum': ['heading', 'paragraph', 'chemical_equation', 'calculation', 'reaction_table', 'choice']},
                    'text': {'type': 'string'}
                }
            }
        },
        'answer': {'type': 'string'}
    }
}


def load_system() -> str:
    src = (ROOT / 'js' / 'solution-core.js').read_text(encoding='utf-8')
    core = re.search(r"const SYSTEM_CORE = `([\s\S]*?)`;", src)
    calc = re.search(r"const SYSTEM_CALC = `([\s\S]*?)`;", src)
    if not core or not calc:
        raise RuntimeError('無法解析 SYSTEM')
    return core.group(1) + calc.group(1)


def call_gemini(api_key: str, user_text: str, system_text: str) -> str:
    payload = {
        'model': MODEL,
        'system_instruction': {'parts': [{'text': system_text}]},
        'contents': [{'role': 'user', 'parts': [{'text': user_text}]}],
        'generationConfig': {
            'temperature': 0.25,
            'maxOutputTokens': 8192,
            'responseMimeType': 'application/json',
            'responseSchema': SCHEMA,
        },
    }
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={urllib.parse.quote(api_key)}'
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            data = json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'HTTP {e.code}: {body[:800]}') from e
    if data.get('error'):
        raise RuntimeError(data['error'].get('message', str(data['error'])))
    parts = data.get('candidates', [{}])[0].get('content', {}).get('parts', [])
    text = ''.join(p.get('text', '') for p in parts).strip()
    if not text:
        raise RuntimeError('Gemini 無文字回覆')
    return text


def scan_issues(doc: dict) -> list[str]:
    issues = []
    blocks = doc.get('blocks') or []
    for i, block in enumerate(blocks):
        t = str(block.get('text') or '')
        btype = block.get('type')
        if btype == 'calculation':
            dup = re.findall(
                r'(\d+(?:\.\d+)?(?:\s*\\times\s*10\s*\^\s*\{?[-+]?\d+\}?)?)\s*\\htmlData\{[^{}]*\}\{\1\}',
                t
            )
            if dup:
                issues.append(f'block[{i}] calculation 數字+NOTE 重複: {dup[:3]}')
            if re.search(r'\\htmlData\{[^{}]*\}\{[^{}]*\}\s*\\htmlData\{[^{}]*\}\{[^{}]*\}', t):
                issues.append(f'block[{i}] calculation 連續 htmlData 可能巢狀錯誤')
        if btype in ('paragraph', 'choice'):
            if re.search(r'\$\d|\d\^[\{\-]', t):
                issues.append(f'block[{i}] {btype} 含 LaTeX/破碎 $ 或 ^ 科學記號: {t[:80]}...')
            if re.search(r'H\$\d|H_\d', t):
                issues.append(f'block[{i}] {btype} 化學式破碎: {t[:100]}')
            if re.search(r'10\^[\{\-]|10\*\*', t):
                issues.append(f'block[{i}] {btype} 裸科學記號未編譯: {t[:100]}')
    return issues


def main():
    if not API_KEY:
        print('用法: python tests/run-api-e2e.py <API_KEY>')
        sys.exit(1)
    system = load_system()
    summary = []
    for name, question in QUESTIONS.items():
        print(f'=== {name} ===')
        raw = call_gemini(API_KEY, question, system)
        out_path = OUT / f'{name}-raw.json'
        out_path.write_text(raw, encoding='utf-8')
        print(f'已存 {out_path}')
        try:
            doc = json.loads(raw)
        except json.JSONDecodeError as e:
            summary.append(f'{name}: JSON 解析失敗 {e}')
            continue
        issues = scan_issues(doc)
        summary.append(f'{name}: {len(issues)} 個靜態問題')
        for issue in issues:
            print('  ISSUE:', issue)
            summary.append(f'  - {issue}')
        # 印出結果/選項相關 block
        for i, b in enumerate(doc.get('blocks') or []):
            text = str(b.get('text') or '')
            if b.get('type') in ('paragraph', 'choice') and (
                'H3PO4' in text or 'H3O' in text or '10^' in text or '10^{-' in text or '5.4' in text
            ):
                print(f'  [{i}] {b.get("type")}: {text[:200]}')
    print('\n=== SUMMARY ===')
    print('\n'.join(summary))


if __name__ == '__main__':
    main()
