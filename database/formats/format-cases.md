---
id: format-cases
kind: format
label: 聯立方程式
layout_id: cases
inject: always
priority: 80
---

## 用途

多個方程式聯立求解（體積、莫耳、濃度關係等）。

## 輸出規格

1. 整段放在**一個** `$$…$$` 內
2. 使用 `\begin{cases}…\end{cases}`；解與題意相鄰時可用 `\quad\Rightarrow\quad` 連接第二個 cases
3. 中文說明可寫在 cases 外、或每行方程前的文字於 `$` 外

## 範例骨架

$$
\begin{cases}
\text{條件一} \\
\text{條件二}
\end{cases}
\quad\Rightarrow\quad
\begin{cases}
x=\cdots \\
y=\cdots
\end{cases}
$$
