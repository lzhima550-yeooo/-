const safeText = (value) => String(value ?? '').trim()

export function buildDiagnosisActionCards({ taskId = '', riskLevel = 'medium', identifyResult = {} } = {}) {
  const normalizedTaskId = safeText(taskId) || 'diagnosis'
  const encyclopediaId = safeText(identifyResult.encyclopediaId)
  const objectName = safeText(identifyResult.name) || '目标对象'

  const cards = [
    {
      id: `${normalizedTaskId}-immediate`,
      type: 'immediate',
      title: '立即处理',
      description: `先对 ${objectName} 的受影响部位进行隔离或清理，避免扩散。`,
      ctaLabel: '查看处理要点',
      ctaRoute: '/identify',
      priority: 100,
    },
    {
      id: `${normalizedTaskId}-observe`,
      type: 'observe',
      title: '观察复查',
      description: '建议在 24-48 小时内进行一次复查并记录变化。',
      ctaLabel: '查看复查建议',
      ctaRoute: '/identify',
      priority: 90,
    },
    {
      id: `${normalizedTaskId}-encyclopedia`,
      type: 'encyclopedia',
      title: '图鉴查证',
      description: '进入图鉴查看形态特征、危害路径和治理模板。',
      ctaLabel: '打开图鉴',
      ctaRoute: encyclopediaId ? `/encyclopedia/${encodeURIComponent(encyclopediaId)}` : '/encyclopedia',
      priority: 80,
    },
  ]

  if (riskLevel === 'high' || riskLevel === 'critical') {
    cards.push({
      id: `${normalizedTaskId}-community`,
      type: 'community',
      title: '社区求助',
      description: '当前风险较高，建议带图发帖并请求老师或同学协助复核。',
      ctaLabel: '去社区发帖',
      ctaRoute: '/community/new',
      priority: 95,
    })
  }

  cards.push({
    id: `${normalizedTaskId}-track`,
    type: 'track',
    title: '持续记录',
    description: '将本次识别记录加入历史，便于后续追踪与对比。',
    ctaLabel: '查看历史',
    ctaRoute: '/me',
    priority: 70,
  })

  return cards
}
