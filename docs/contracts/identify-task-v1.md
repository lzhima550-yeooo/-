# Identify Task API v1

## `POST /api/identify/tasks`

### Request

```json
{
  "image": "data:image/png;base64,...",
  "prompt": "可选自定义提示词",
  "hostPlant": "可选寄主信息"
}
```

### Response `202`

```json
{
  "data": {
    "id": "uuid",
    "type": "diagnosis_identify",
    "status": "pending",
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  }
}
```

## `GET /api/identify/tasks/:id`

### Response `200`

```json
{
  "data": {
    "id": "uuid",
    "type": "diagnosis_identify",
    "status": "succeeded",
    "topResult": {
      "name": "白粉病",
      "category": "病害",
      "confidence": 0.94,
      "evidenceTags": ["白色霉层", "蔓延"]
    },
    "riskLevel": "high",
    "actionCards": [
      {
        "id": "uuid-immediate",
        "type": "immediate",
        "title": "立即处理",
        "description": "先对受影响部位进行隔离或清理，避免扩散。",
        "ctaLabel": "查看处理要点",
        "ctaRoute": "/identify",
        "priority": 100
      }
    ],
    "encyclopediaRefs": ["enc-powdery"],
    "sourceRefs": ["rule:type:病害", "rule:confidence:0.94", "rule:score:82"]
  }
}
```

### Response `404`

```json
{
  "error": "identify task not found"
}
```
