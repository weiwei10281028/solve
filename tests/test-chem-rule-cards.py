# -*- coding: utf-8 -*-
"""Smoke-check ChemRuleCards intent + short core inject."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / "js" / "chem-rule-cards.js").read_text(encoding="utf-8")
assert "auditDocument" in js
assert "buildDecisionRuleBlock" in js
assert "碘鐘判定條件" in js
assert "題幹已提供反應式" in js
assert "inferIodateTimerRatio" in js
assert "hasNoBlueTimeViolation" in js
assert "documentStatesNoBlue" in js
assert "applyLocalGateFix" not in js
assert "buildPresolveGateBlock" not in js

app = (root / "js" / "app.js").read_text(encoding="utf-8")
assert "chemRuleAudit" in app
assert "buildSystemSupplement" not in app
assert "applyLocalGateFix" not in app
assert "依通則卡修正詳解" not in app
assert "通則卡修正" in app

# 主解題只注入短條件，不注入整張教案。
assert "buildDecisionRuleBlock(card)" in js

print("chem-rule-cards audit smoke OK")
