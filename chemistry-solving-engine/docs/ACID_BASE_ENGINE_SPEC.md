# 酸鹼解題引擎規格 v0.1

## 定位

酸鹼引擎負責：

- 數值計算
- 判斷應呼叫的計算模組
- 回傳所有重要中間值
- 回傳質量守恆、非負濃度及近似條件檢查

酸鹼引擎不負責：

- 閱讀自然語言題目
- 猜測缺少的題目條件
- 撰寫繁體中文詳解
- 決定學生應看到多少步驟

## operation

### `strong_acid_base`

計算單一強酸或強鹼溶液。

```json
{
  "engine": "acid_base",
  "operation": "strong_acid_base",
  "input": {
    "kind": "acid",
    "concentration": 0.1,
    "equivalents": 1,
    "volumeL": 1
  }
}
```

### `weak_acid`

```json
{
  "engine": "acid_base",
  "operation": "weak_acid",
  "input": {
    "species": "CH3COOH",
    "concentration": 0.1,
    "Ka": 0.000018,
    "volumeL": 1
  }
}
```

### `weak_base`

```json
{
  "engine": "acid_base",
  "operation": "weak_base",
  "input": {
    "species": "NH3",
    "concentration": 0.1,
    "Kb": 0.000018,
    "volumeL": 1
  }
}
```

### `neutralization`

支援：

- 強酸＋強鹼
- 弱酸＋強鹼（含雙質子弱酸，需提供 `Ka1`、`Ka2` 或 `equivalents: 2`）
- 弱鹼＋強酸

```json
{
  "engine": "acid_base",
  "operation": "neutralization",
  "input": {
    "acid": {
      "strength": "weak",
      "species": "CH3COOH",
      "concentration": 0.1,
      "volumeL": 0.1,
      "equivalents": 1,
      "Ka": 0.000018
    },
    "base": {
      "strength": "strong",
      "species": "NaOH",
      "concentration": 0.1,
      "volumeL": 0.05,
      "equivalents": 1
    }
  }
}
```

### `weak_acid_diprotic`

雙質子弱酸溶液（電荷平衡精確解）。

```json
{
  "engine": "acid_base",
  "operation": "weak_acid_diprotic",
  "input": {
    "species": "H2S",
    "concentration": 0.1,
    "Ka1": 0.00000091,
    "Ka2": 0.000000000012,
    "volumeL": 1
  }
}
```

### `titration`

酸鹼滴定；單質子題型會轉接 `neutralization`，雙質子弱酸＋強鹼會自動判斷緩衝／第一當量點／第二當量點／過量強鹼。

```json
{
  "engine": "acid_base",
  "operation": "titration",
  "input": {
    "acid": {
      "strength": "weak",
      "species": "H2CO3",
      "concentration": 0.1,
      "volumeL": 0.05,
      "equivalents": 2,
      "Ka1": 0.0000043,
      "Ka2": 0.000000000047
    },
    "base": {
      "strength": "strong",
      "species": "NaOH",
      "concentration": 0.1,
      "volumeL": 0.03,
      "equivalents": 1
    }
  }
}
```

### `buffer`

緩衝溶液（Henderson–Hasselbalch）。

```json
{
  "engine": "acid_base",
  "operation": "buffer",
  "input": {
    "bufferType": "acid",
    "Ka": 0.000018,
    "acidMoles": 0.01,
    "conjugateBaseMoles": 0.01,
    "totalVolumeL": 0.2
  }
}
```

## AI 串接原則

AI 必須：

1. 從題目擷取物種、濃度、體積與常數。
2. 選擇固定的 `operation`。
3. 僅傳送 JSON，不自行建立任意公式字串。
4. 收到結果後，優先使用 `trace`、`intermediates` 與 `checks` 組織高中詳解。
5. 不得竄改引擎回傳的精確數值。
