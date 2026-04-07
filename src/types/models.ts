export type EncyclopediaType = 'insect' | 'disease'

export interface EncyclopediaItem {
  id: string
  type: EncyclopediaType
  name: string
  scientificName: string
  genus: string
  categoryCode: string
  category: string
  risk: '低' | '中' | '高'
  season: string
  host: string
  summary: string
  morphology: string
  symptoms: string
  image: string
  controlTips: string[]
  placementTips: string[]
  references: string[]
}

export type CommunityFloorRole = 'answer' | 'followup'

export interface AnnotationPoint {
  x: number
  y: number
}

export interface CommunityAnswer {
  id: string
  author: string
  content: string
  markdown?: string
  createdAt: string
  floor?: number
  role?: CommunityFloorRole
  image?: string
  replyToFloor?: number
  fromMe?: boolean
  annotations?: AnnotationPoint[]
}

export interface CommunityPost {
  id: string
  title: string
  content: string
  markdown?: string
  mentions?: string[]
  topics?: string[]
  image?: string
  status: 'open' | 'solved'
  author: string
  ownerAccount?: string
  createdAt: string
  likes: number
  isFavorite?: boolean
  answers: CommunityAnswer[]
}

export type SpiritQuickKey = 'prevention' | 'habit' | 'appearance'

export interface SpiritProfile {
  id: string
  name: string
  englishName: string
  scientificName: string
  genus: string
  keywords: string[]
  expertTags: string[]
  avatar: string
  image: string
  realPhoto: string
  habits: string[]
  chatLines: string[]
  quickReplies: Record<SpiritQuickKey, string>
}

export interface RecognitionResult {
  id: string
  name: string
  confidence: number
  keywords: string[]
  type: '昆虫' | '病害'
  cover: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
}

export interface CanonicalIdentifySnapshot {
  taskId: string
  name: string
  scientificName: string
  confidence: number
  typeLabel: '昆虫' | '病害'
  keywords: string[]
  summary: string
  controlTips: string[]
  cover: string
  spiritPreview: string
  encyclopediaId: string
  sourceRefs: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  provider: string
  model: string
}

export interface Badge {
  id: string
  title: string
  description: string
  icon: string
  metric: 'publish' | 'answer' | 'favorite' | 'identify'
  threshold: number
}
