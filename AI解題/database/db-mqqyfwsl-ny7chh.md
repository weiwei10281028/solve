---
id: db-mqqyfwsl-ny7chh
type: single
subject: 化學
topic: 一般
method_id: general-chem
catalog_only: false
q_numbers: [33]
fingerprint: ["pH4.0","0.24M","α11/12","比10","二質子","弱酸"]
core_fingerprints: ["pH4.0","0.24M","α11/12","比10","二質子","弱酸"]
match_keywords: ["pH4.0","0.24M","α11/12","比10","二質子","弱酸","H2A","酸鹼中和背景","平衡","解離度","一般","二質子弱酸"]
concept_tags: ["弱酸","二質子","H2A","酸鹼中和背景","平衡","解離度","一般"]
critical_judgment: 此處 濃度為 ，解離度高達 ，可是 卻只有 ，可知此時並非酸自身解離，而是在發生酸鹼中和，此時將 帶入計算。
forbidden_steps: ["禁止把解離產生的 0.22 當平衡 [H⁺]","禁止僅做一步弱酸解離","平衡列 [H⁺] 須為 10⁻⁴（恆定），變化列 H⁺ 欄寫 —"]
pitfalls: ["此處 濃度為 ，解離度高達 ，可是 卻只有 ，可知此時並非酸自身解離，而是在發生酸鹼中和，此時將 帶入計算。","& 0.02M & & 10^{-4}M(\\text{恆定}) & & 0.22M","& 0.22-x & & 10^{-4}M(\\text{恆定}) & & x","① ， ，可知 、 。","禁止沒有 **答：** 就結束"]
---

## 題幹

<!-- question p1: 螢幕擷取畫面 2026-06-23 000802.png -->
33. 在 $0.24\text{ M}$ 之某二質子弱酸 ($\text{H}_2\text{A}$) 水溶液中，$\text{H}_2\text{A}$ 之解離度為 $\dfrac{11}{12}$，當溶液之 $\text{pH}$ 為 $4.0$，且 $[\text{HA}^-] / [\text{A}^{2-}] = 10$。下列關係式或敘述，哪些正確？
<!-- MATCH: 弱酸,解離度 -->
(A) $\text{pK}_1 = 3.0$
(B) $\text{pK}_2 = 6.0$
(C) $[\text{H}_2\text{A}] = [\text{A}^{2-}]$
(D) $[\text{HA}^-] = 0.20\text{ M}$
(E) 將 $\text{H}_2\text{A}(\text{aq})$ 稀釋為 $0.10\text{ M}$ ($\text{pH}$ 仍維持 $4.0$)，則 $\text{H}_2\text{A}$ 之解離度會增加

## 詳解

<!-- solution p1: image.png -->
此處 $H_2A$ 濃度為 $0.24M$，解離度高達 $\dfrac{11}{12}$，可是 $[H^+]$ 卻只有 $10^{-4}M$，可知此時並非酸自身解離，而是在發生酸鹼中和，此時將 $[H^+]=10^{-4}M$ 帶入計算。

第一步解離：
$$
\begin{array}{ccccccc}
 & H_2A & \rightleftharpoons & H^+ & + & HA^- \\
 & 0.24M & & & & \\
 & -0.24 \times \dfrac{11}{12} & & & & +0.22M \\
\hline
 & 0.02M & & 10^{-4}M(\text{恆定}) & & 0.22M
\end{array}
$$

第二步解離：
$$
\begin{array}{ccccccc}
 & HA^- & \rightleftharpoons & H^+ & + & A^{2-} \\
 & 0.22M & & & & \\
 & -x & & & & +x \\
\hline
 & 0.22-x & & 10^{-4}M(\text{恆定}) & & x
\end{array}
$$
$\text{考慮第二步}$

① $\dfrac{[HA^-]}{[A^{2-}]} = \dfrac{0.22-x}{x} = 10$， $x=0.02M$，可知 $[HA^-]=0.22-0.02=0.2M$、$[A^{2-}]=0.02M$。

② $K_{a2} = \dfrac{[H^+][A^{2-}]}{[HA^-]} = 10^{-4} \times \dfrac{1}{10} = 1 \times 10^{-5}$， $K_{a2}=10^{-5}$、$pK_{a2}=5$。

③ $K_{a1} = \dfrac{[H^+][HA^-]}{[H_2A]} = \dfrac{10^{-4} \times 0.2}{0.02} = 10^{-3}$， $pK_{a1}=3$。
