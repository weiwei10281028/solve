---
id: colligative-dimer-half-alpha
type: teaching_rule
label: 偶合（反應物係數1）凡特荷夫因子
inject_mode: conditional
priority: 10
match_aliases:
  - 規定:偶合係數1
  - 規定:偶合
  - rule:dimer-alpha
  - rule:colligative-dimer
trigger_colligative:
  - 依數性
  - 凝固點
  - 沸點上升
  - 蒸氣壓下降
  - 滲透壓
  - 凡特荷夫
  - 拉午耳
  - /K_f|Kf|K_b|Kb/
  - /ΔT_f|ΔTf|ΔT_b|ΔTb/
trigger_calc:
  - 凝固點下降量
  - 沸點上升量
  - 蒸氣壓下降量
  - 滲透壓
  - /求|計算|為何|若干|多少|度數|莫耳濃度|重量莫耳濃度/
  - /C_m|Cm|M_\{?avg\}?|平均分子量|M\s*\/\s*i/
  - /i\s*=\s*[\d.]/
  - /ΔT|π\s*=/
trigger_dimer:
  - /i\s*[<＜]\s*1/
  - 偶合率
  - /1\s*A\s*[→\-=].*(?:A_?2|A_\{2\})/
  - /2\s*A\s*[→\-=].*(?:A_?2|A_\{2\})/
  - /1\s*-\s*(?:\\frac\{1\}\{2\}|0\.5)\s*\\?alpha/
trigger_any:
  - /1\s*A\s*[→\-=]\s*\\?frac\{1\}\{2\}/
suppress_if_any:
  - /\bpH\b/i
  - /\bKa\b/
  - /\bpKa\b/
  - /\bpKb\b/
  - 弱酸解離
  - 酸鹼滴定
  - 滴定
  - 當量點
  - 指示劑
  - 導電度
  - 導電性
  - 緩衝溶液
  - /\[H\^?\+/
  - /\[OH\^?\-/
  - 規定:弱酸解離
  - rule:weak-acid
---

## 教學規定

【何時套用】僅當解題須**用依數性公式計算** $i$、$\alpha$ 或 $M_{\text{avg}}$，且判定為**反應物係數 1 之偶合**（$i<1$）時使用。題幹只概念性提到偶合、或無計算步驟者，不套用。

【反應式（反應物係數為 1）】
$$1\,\text{A} \rightarrow \dfrac{1}{2}\,\text{A}_2$$

【凡特荷夫因子】
$$i = 1 - \dfrac{1}{2}\alpha$$
其中 $\alpha$ 為偶合率。

【計算板書】先寫依數性小標與 $\Delta T = K \times C_m \times i$（或滲透壓等），求出 $i<1$ 後再代入上式；$M_{\text{avg}} = M/i$。
