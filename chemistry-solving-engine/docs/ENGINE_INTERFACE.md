# 共用引擎介面規格

## 目的

所有章節引擎皆接收 JSON，並回傳 JSON；不得直接產生學生詳解。

## 共用輸入

```json
{
  "engine": "acid_base",
  "operation": "weak_acid",
  "input": {},
  "options": {
    "temperatureC": 25,
    "approximationThreshold": 0.05,
    "returnAllIntermediates": true
  }
}
```

## 共用輸出

```json
{
  "success": true,
  "engine": "acid_base",
  "operation": "weak_acid",
  "method": "quadratic_exact",
  "result": {},
  "intermediates": {},
  "checks": {},
  "trace": [],
  "warnings": []
}
```

## 失敗格式

```json
{
  "success": false,
  "engine": "acid_base",
  "operation": "weak_acid",
  "error": {
    "code": "INVALID_INPUT",
    "message": "concentration 必須大於 0",
    "field": "input.concentration"
  }
}
```

## 模組互相呼叫

章節 Router 可以根據前一模組結果，自動呼叫下一模組。例如：

```text
neutralization
  → buffer
  → hydrolysis
  → strong_acid_base
```

AI 不需要參與模組間轉接。
