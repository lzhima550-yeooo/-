const safeText = (value) => String(value ?? '').trim()

const toStringList = (value, max = 12) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, max)
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const hasAnyKeyword = (keywords, patterns) => {
  const normalized = keywords.map((item) => item.toLowerCase())
  return patterns.some((pattern) => normalized.some((item) => item.includes(pattern)))
}

export function evaluateDiagnosisRisk(identifyResult = {}) {
  const typeLabel = safeText(identifyResult.typeLabel) === '病害' ? '病害' : '昆虫'
  const confidenceRaw = Number(identifyResult.confidence)
  const confidence = Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : 0.5
  const keywords = toStringList(identifyResult.keywords, 16)

  let score = typeLabel === '病害' ? 70 : 45
  if (confidence >= 0.9) {
    score += 12
  } else if (confidence < 0.6) {
    score -= 8
  }

  if (hasAnyKeyword(keywords, ['霉', '腐', '枯', '蔓延', '爆发', '高密度'])) {
    score += 12
  }

  if (hasAnyKeyword(keywords, ['益虫', '天敌'])) {
    score -= 15
  }

  score = clamp(score, 5, 98)

  let riskLevel = 'medium'
  if (score >= 85) {
    riskLevel = 'critical'
  } else if (score >= 65) {
    riskLevel = 'high'
  } else if (score < 35) {
    riskLevel = 'low'
  }

  return {
    riskLevel,
    score,
    sourceRefs: [
      `rule:type:${typeLabel}`,
      `rule:confidence:${confidence.toFixed(2)}`,
      `rule:score:${Math.round(score)}`,
    ],
  }
}
