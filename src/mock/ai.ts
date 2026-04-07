import type { RecognitionResult } from '../types/models'

export const recognitionPool: RecognitionResult[] = [
  {
    id: 'r1',
    name: '蚜虫',
    confidence: 0.92,
    keywords: ['卷叶', '群聚', '嫩梢'],
    type: '昆虫',
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDxZsxE0rARJP6bUlm6SBxQJNx1r5fUdmj1COiEKhWQAE5O_glrtEdlKmOgIOxqLFCA2X4r2zvvD2G0dW7E-UBbdMPztcSuY2tZWOgSh243cQzywYK_nfeV90K_AjXonEHzDaZCSdSUcJPtVzeKQT1KN9VH0x3qj6W_MahlBrhFD3s8lCOk-_HO-ElRvrBWXMLxCefMZOaW8RMb5fLYzCEmnViBGUrOY88l98gi-P4MnQ3zToRWvkhPITOxIQBBONXlgD6hZLaIBZA',
  },
  {
    id: 'r2',
    name: '红蜘蛛',
    confidence: 0.86,
    keywords: ['叶背', '灰白斑', '高温干燥'],
    type: '昆虫',
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCV-JYA251RwNdWK4Ai8DbU7KFPqvu00rpT-Lm3peYSDhrSqrytYKxdmaLk-FYB8T5_TrJ_68cM_Ub52yGm1T7BpalIxCpPZw9kksJveVn5d3AtSRCs9iNpHJxazmIErTNAeBGQ04JwNePzUy4qZJa4ndgbyQNERrlLHOd7RnZVgVJRZ6HJOPDLr8F2kW94BaDYUFY31PzVF0pACbJLAP2aX4l5xtgE2qyDUSabojleT076nlLXbv3S_dUaWfeyMbCv2fF2yos0Kxw',
  },
  {
    id: 'r3',
    name: '白粉病',
    confidence: 0.81,
    keywords: ['粉状斑', '潮湿', '通风不足'],
    type: '病害',
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBzkUS5hEWFRyj4tm63W_UvLJb0yTfLOSmnk0Y7dC9-GY9HSsp6ZHo9rSscdV0JGNwSF22EYIzfCU4t7BEAuT8Vgz_8paJFBjRpZ6oXhcW_26izw_9wfbxXAoxnbo-UJZutbAO_6Hui1WwkQI0NtwvwQ39wmMe3ujQbQF7c6RnX_cD4bAMCluto2GuPFNi3FENPVWoqNPp_X5y3bctCixHTF0MGdnXA1Rhow-uEe58yR9ju5PvjZCy9tAU2p0zG4ovVtAGVMiZ0KsI',
  },
]

export const generateRecognition = (seed?: string): RecognitionResult => {
  const hint = seed?.toLowerCase() ?? ''

  if (hint.includes('aphid') || hint.includes('leaf')) {
    return recognitionPool[0]
  }

  if (hint.includes('mite') || hint.includes('spider')) {
    return recognitionPool[1]
  }

  const randomIndex = Math.floor(Math.random() * recognitionPool.length)
  return recognitionPool[randomIndex]
}
