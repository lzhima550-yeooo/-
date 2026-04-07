import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { SpiritChatBackground } from '../components/spirit-chat/SpiritChatBackground'
import { SpiritChatHeader } from '../components/spirit-chat/SpiritChatHeader'
import { SpiritInputBar } from '../components/spirit-chat/SpiritInputBar'
import { SpiritMessageList } from '../components/spirit-chat/SpiritMessageList'
import { SpiritQuickActions } from '../components/spirit-chat/SpiritQuickActions'
import { generateRecognition } from '../mock/ai'
import {
  buildSpiritGenerationNegativePrompt,
  buildSpiritGenerationPrompt,
  buildSpiritProfileFromSnapshot,
  resolveSpiritRolePack,
  toCanonicalIdentifySnapshot,
  toRecognitionResult,
  type SpiritRolePack,
} from '../services/identifyCanonical'
import { createIdentifyTaskOnServer, waitForIdentifyTask } from '../services/identifyTaskApi'
import { useAppStore } from '../store/useAppStore'
import type { CanonicalIdentifySnapshot, SpiritProfile, SpiritQuickKey } from '../types/models'
import { fetchSpiritGenerationConfigFromServer, type SpiritGenerationConfig, type SpiritWorkflowRoutingRule } from '../services/spiritConfigApi'
import { createSpiritGenerationTaskOnServer, waitForSpiritGenerationTask } from '../services/spiritGenerationTaskApi'
import type { SpiritPersonaDesign } from '../services/spiritGenerateApi'
import { requestSpiritChatOnServer, streamSpiritChatFromServer } from '../services/spiritChatApi'
import {
  buildLocalSpiritCommunityDraft,
  createSpiritCommunityDraftOnServer,
  createSpiritSessionOnServer,
  fetchSpiritGenerationStatsFromServer,
  type SpiritGenerationStats,
} from '../services/spiritSessionApi'
import { fetchSpiritRuntimeStatusFromServer, type SpiritRuntimeStatus } from '../services/spiritRuntimeApi'
import { useImageFallback } from '../utils/imageFallback'

const suggestionKeywords = ['瓢虫', '益虫', '鞘翅目', '红黑鞘翅', '蚜虫天敌']

const quickActions: Array<{ key: SpiritQuickKey; label: string }> = [
  { key: 'prevention', label: '防治建议' },
  { key: 'habit', label: '生活习性' },
  { key: 'appearance', label: '外貌特征' },
]

interface ChatMessage {
  id: string
  role: 'user' | 'spirit'
  text: string
}

const identifyDelayMs = 760
const spiritDelayMs = 900

const toDataUrl = (file: File, signal?: AbortSignal) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    const onAbort = () => {
      reader.abort()
      reject(new Error('identify request aborted'))
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    reader.onerror = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
      reject(new Error('读取图片失败'))
    }

    reader.onload = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }

      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('图片数据为空'))
        return
      }

      resolve(result)
    }

    reader.readAsDataURL(file)
  })

const dedupeKeywords = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === 'AbortError' || /aborted/i.test(error.message))

const buildFallbackIdentifySnapshot = (fileName: string, imagePreview: string): CanonicalIdentifySnapshot => {
  const normalizedName = fileName.toLowerCase()
  if (normalizedName.includes('ladybug') || normalizedName.includes('瓢虫')) {
    return {
      taskId: `fallback-${Date.now()}`,
      name: '瓢虫',
      scientificName: 'Coccinella septempunctata',
      confidence: 0.97,
      typeLabel: '昆虫',
      keywords: ['瓢虫', '益虫', '鞘翅目', '蚜虫天敌'],
      summary: '已切换为离线演示识别：瓢虫通常为益虫，常见于校园绿化区，可协助控制蚜虫。',
      controlTips: ['优先保护天敌，减少广谱杀虫剂使用。', '先观察虫口密度，再决定是否干预。'],
      cover: imagePreview,
      spiritPreview: imagePreview,
      encyclopediaId: '',
      sourceRefs: ['mock:ladybug-preset'],
      riskLevel: 'low',
      provider: 'mock',
      model: 'local',
    }
  }

  const recognition = generateRecognition(fileName)
  const scientificName = recognition.type === '病害' ? 'Unknown disease' : 'Unknown insect'

  return {
    taskId: `fallback-${Date.now()}`,
    name: recognition.name,
    scientificName,
    confidence: recognition.confidence,
    typeLabel: recognition.type,
    keywords: dedupeKeywords(recognition.keywords.length > 0 ? recognition.keywords : suggestionKeywords),
    summary: '后端识别暂不可用，已回退离线识别结果。',
    controlTips:
      recognition.type === '病害'
        ? ['先控湿和通风，再做分阶段治理。', '建议在 24 小时后复查症状扩展。']
        : ['先做局部隔离与人工清除。', '优先保护天敌，避免一次性高压施药。'],
    cover: imagePreview || recognition.cover,
    spiritPreview: imagePreview || recognition.cover,
    encyclopediaId: '',
    sourceRefs: ['mock:generateRecognition'],
    riskLevel: recognition.riskLevel ?? (recognition.type === '病害' ? 'high' : 'medium'),
    provider: 'mock',
    model: 'local',
  }
}

function buildDeepSeekMockReply(question: string, spirit: SpiritProfile) {
  return `当前是演示流式回复：你问的是“${question}”。当前角色为 ${spirit.name}（${spirit.scientificName}）。实际服务接入后会提供完整策略与证据链。`
}

function emitErrorToast(message: string) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: {
        type: 'error',
        message,
      },
    }),
  )
}

function emitInfoToast(message: string) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return
  }

  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: {
        type: 'info',
        message,
      },
    }),
  )
}

const generationStatusLabel = (status: string) => {
  if (status === 'queued') {
    return '任务排队中...'
  }

  if (status === 'running') {
    return '任务执行中...'
  }

  if (status === 'succeeded') {
    return '任务已完成，正在加载图片...'
  }

  if (status === 'failed') {
    return '任务失败，正在回退默认立绘...'
  }

  return '正在构建灵化角色设定并初始化对话...'
}

interface GenerationTraceSnapshot {
  taskId: string
  promptId: string
  presetId: string
  workflowId: string
  workflowPath: string
  workflowMode: string
  workflowFallbackReason: string
  routingRuleId: string
  routingRuleLabel: string
  prompt: string
  negativePrompt: string
}

const emptyGenerationTrace = (): GenerationTraceSnapshot => ({
  taskId: '',
  promptId: '',
  presetId: '',
  workflowId: '',
  workflowPath: '',
  workflowMode: '',
  workflowFallbackReason: '',
  routingRuleId: '',
  routingRuleLabel: '',
  prompt: '',
  negativePrompt: '',
})

const normalizeKeywordForRule = (value: string) => value.trim().toLowerCase()
const normalizeTypeLabelForRule = (value: string) => {
  if (value === '病害') {
    return '病害'
  }
  if (value === '昆虫') {
    return '昆虫'
  }
  return ''
}

const normalizeRiskLevelForRule = (value: string) => {
  const text = value.trim().toLowerCase()
  if (text === 'critical' || text === 'high' || text === 'medium' || text === 'low') {
    return text
  }
  if (text === '高') {
    return 'high'
  }
  if (text === '中') {
    return 'medium'
  }
  if (text === '低') {
    return 'low'
  }
  return ''
}

const truncatePreview = (value: string, max = 140) => {
  const text = value.trim()
  if (!text) {
    return ''
  }
  if (text.length <= max) {
    return text
  }
  return `${text.slice(0, max)}...`
}


export function SpiritPage() {
  const favoriteSpiritIds = useAppStore((state) => state.favoriteSpiritIds)
  const toggleFavoriteSpirit = useAppStore((state) => state.toggleFavoriteSpirit)
  const latestIdentifySnapshot = useAppStore((state) => state.latestIdentifySnapshot)
  const setLatestIdentifySnapshot = useAppStore((state) => state.setLatestIdentifySnapshot)
  const addSpiritIdentifyRecord = useAppStore((state) => state.addSpiritIdentifyRecord)
  const navigate = useNavigate()

  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const streamTimerRef = useRef<number | null>(null)
  const identifyTimerRef = useRef<number | null>(null)
  const identifyRequestIdRef = useRef(0)
  const identifyAbortRef = useRef<AbortController | null>(null)
  const chatAbortRef = useRef<AbortController | null>(null)

  const [selectedImage, setSelectedImage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [identifyResult, setIdentifyResult] = useState<CanonicalIdentifySnapshot | null>(null)
  const [generatedPortrait, setGeneratedPortrait] = useState('')
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [isGeneratingSpirit, setIsGeneratingSpirit] = useState(false)
  const [current, setCurrent] = useState<SpiritProfile | null>(null)
  const [currentRolePack, setCurrentRolePack] = useState<SpiritRolePack | null>(null)
  const [currentPersonaDesign, setCurrentPersonaDesign] = useState<SpiritPersonaDesign | null>(null)
  const [showRealPhoto, setShowRealPhoto] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatDraft, setChatDraft] = useState('')
  const [isChatRequesting, setIsChatRequesting] = useState(false)
  const [generationTaskStatus, setGenerationTaskStatus] = useState('')
  const [generationConfig, setGenerationConfig] = useState<SpiritGenerationConfig | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('')
  const [runtimeStatus, setRuntimeStatus] = useState<SpiritRuntimeStatus | null>(null)
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(true)
  const [latestSessionId, setLatestSessionId] = useState('')
  const [isDraftPreparing, setIsDraftPreparing] = useState(false)
  const [lastGenerationTaskId, setLastGenerationTaskId] = useState('')
  const [lastGenerationDurationMs, setLastGenerationDurationMs] = useState(0)
  const [lastGenerationTrace, setLastGenerationTrace] = useState<GenerationTraceSnapshot>(emptyGenerationTrace)
  const [generationStats, setGenerationStats] = useState<SpiritGenerationStats | null>(null)
  const [chatConversationSessionId, setChatConversationSessionId] = useState('')
  const [isDiagnosticsExpanded, setIsDiagnosticsExpanded] = useState(false)
  const [chatTheme] = useState('spirit_wechat_fresh')
  const [chatDebugMeta, setChatDebugMeta] = useState<{
    rolePackId: string
    rolePackName: string
    memoryHits: number
    memorySummaryId: string
  }>({
    rolePackId: '',
    rolePackName: '',
    memoryHits: 0,
    memorySummaryId: '',
  })

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current)
      }
      if (identifyTimerRef.current) {
        window.clearTimeout(identifyTimerRef.current)
      }
      if (identifyAbortRef.current) {
        identifyAbortRef.current.abort()
        identifyAbortRef.current = null
      }
      if (chatAbortRef.current) {
        chatAbortRef.current.abort()
        chatAbortRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!latestIdentifySnapshot) {
      return
    }

    setIdentifyResult((prev) => {
      if (prev?.taskId && prev.taskId === latestIdentifySnapshot.taskId) {
        return prev
      }
      return { ...latestIdentifySnapshot }
    })
    setSelectedImage((prev) => prev || latestIdentifySnapshot.cover || '')
  }, [latestIdentifySnapshot])

  useEffect(() => {
    return () => {
      if (selectedImage.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImage)
      }
    }
  }, [selectedImage])

  useEffect(() => {
    let canceled = false

    const loadGenerationConfig = async () => {
      const response = await fetchSpiritGenerationConfigFromServer()
      if (canceled) {
        return
      }

      setGenerationConfig(response.data)

      if (response.data.defaultPresetId) {
        setSelectedPresetId(response.data.defaultPresetId)
      } else if (response.data.presets[0]?.id) {
        setSelectedPresetId(response.data.presets[0].id)
      }

      if (response.data.defaultWorkflowId) {
        setSelectedWorkflowId(response.data.defaultWorkflowId)
      } else if (response.data.workflows[0]?.id) {
        setSelectedWorkflowId(response.data.workflows[0].id)
      }
    }

    void loadGenerationConfig()

    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    let canceled = false

    const loadRuntimeStatus = async () => {
      setIsRuntimeLoading(true)
      const response = await fetchSpiritRuntimeStatusFromServer()

      if (canceled) {
        return
      }

      setRuntimeStatus(response.data)
      setIsRuntimeLoading(false)
    }

    void loadRuntimeStatus()

    return () => {
      canceled = true
    }
  }, [])

  useEffect(() => {
    let canceled = false

    const loadGenerationStats = async () => {
      const response = await fetchSpiritGenerationStatsFromServer()
      if (canceled) {
        return
      }

      setGenerationStats(response.data)
    }

    void loadGenerationStats()

    return () => {
      canceled = true
    }
  }, [])

  const isFavorite = useMemo(() => {
    if (!current) {
      return false
    }

    return favoriteSpiritIds.includes(current.id)
  }, [current, favoriteSpiritIds])

  const recognizedTags = useMemo(() => {
    if (!current) {
      return []
    }

    const identifyTags = identifyResult?.keywords ?? suggestionKeywords

    return Array.from(new Set([...current.expertTags, ...identifyTags, current.scientificName, `${current.genus}属`]))
  }, [current, identifyResult])

  const currentPortraitUrl = useMemo(() => {
    if (generatedPortrait) {
      return generatedPortrait
    }
    if (current?.image) {
      return current.image
    }
    if (current?.avatar) {
      return current.avatar
    }
    return '/images/914ec19753ff41c467235a1cc8413f5f.jpg'
  }, [generatedPortrait, current?.image, current?.avatar])

  const currentStatusText = useMemo(() => {
    if (isChatRequesting) {
      return '正在整理叶片线索'
    }
    if (identifyResult?.name) {
      return `正在陪你观察${identifyResult.name}`
    }
    return '正在陪你观察这株植物'
  }, [isChatRequesting, identifyResult?.name])

  const runtimeBadge = useMemo(() => {
    if (isRuntimeLoading) {
      return { text: '检测中', className: 'bg-white/80 text-[var(--text-soft)]' }
    }

    if (runtimeStatus?.ready) {
      return { text: '可用', className: 'bg-emerald-100 text-emerald-700' }
    }

    if (runtimeStatus?.comfyuiOnline) {
      return { text: '降级', className: 'bg-amber-100 text-amber-700' }
    }

    return { text: '离线', className: 'bg-rose-100 text-rose-700' }
  }, [isRuntimeLoading, runtimeStatus])

  const selectedPreset = useMemo(() => {
    const presets = generationConfig?.presets ?? []
    if (presets.length === 0) {
      return null
    }

    const found = presets.find((preset) => preset.id === selectedPresetId)
    return found ?? presets[0]
  }, [generationConfig, selectedPresetId])

  const selectedWorkflow = useMemo(() => {
    const workflows = generationConfig?.workflows ?? []
    if (workflows.length === 0) {
      return null
    }

    const found = workflows.find((workflow) => workflow.id === selectedWorkflowId)
    return found ?? workflows[0]
  }, [generationConfig, selectedWorkflowId])

  const matchedRoutingRule = useMemo(() => {
    if (!identifyResult || !generationConfig?.workflowRoutingRules?.length) {
      return null
    }

    const typeLabel = normalizeTypeLabelForRule(identifyResult.typeLabel)
    const riskLevel = normalizeRiskLevelForRule(identifyResult.riskLevel)
    const keywords = dedupeKeywords(identifyResult.keywords)
      .map((item) => normalizeKeywordForRule(item))
      .filter(Boolean)

    let best: { score: number; rule: SpiritWorkflowRoutingRule } | null = null

    for (const rule of generationConfig.workflowRoutingRules) {
      const typeLabels = rule.typeLabels.map((item) => normalizeTypeLabelForRule(item)).filter(Boolean)
      if (typeLabels.length > 0 && (!typeLabel || !typeLabels.includes(typeLabel))) {
        continue
      }

      const riskLevels = rule.riskLevels.map((item) => normalizeRiskLevelForRule(item)).filter(Boolean)
      if (riskLevels.length > 0 && (!riskLevel || !riskLevels.includes(riskLevel))) {
        continue
      }

      const ruleKeywords = rule.matchKeywords.map((item) => normalizeKeywordForRule(item)).filter(Boolean)
      const matchedKeywords = ruleKeywords.filter((keyword) =>
        keywords.some((item) => item.includes(keyword) || keyword.includes(item)),
      )
      if (ruleKeywords.length > 0 && matchedKeywords.length === 0) {
        continue
      }

      const score = Number(rule.priority || 0) + matchedKeywords.length * 5
      if (!best || score > best.score) {
        best = { score, rule }
      }
    }

    if (best) {
      return best.rule
    }

    return null
  }, [identifyResult, generationConfig])

  useEffect(() => {
    if (!matchedRoutingRule) {
      return
    }

    if (matchedRoutingRule.presetId) {
      setSelectedPresetId(matchedRoutingRule.presetId)
    }
    if (matchedRoutingRule.workflowId) {
      setSelectedWorkflowId(matchedRoutingRule.workflowId)
    }
  }, [matchedRoutingRule?.id, matchedRoutingRule?.presetId, matchedRoutingRule?.workflowId])

  const createSessionSnapshot = async (
    messageSnapshot: ChatMessage[],
    generationOverride?: {
      taskId?: string
      status?: string
      imageUrl?: string
      promptId?: string
      prompt?: string
      negativePrompt?: string
      durationMs?: number
      presetId?: string
      workflowId?: string
      workflowPath?: string
      workflowMode?: string
      workflowFallbackReason?: string
      routingRuleId?: string
      routingRuleLabel?: string
    },
  ) => {
    if (!identifyResult) {
      return ''
    }

    const response = await createSpiritSessionOnServer({
      identify: {
        taskId: identifyResult.taskId,
        name: identifyResult.name,
        scientificName: identifyResult.scientificName,
        sourceRefs: identifyResult.sourceRefs ?? [],
        keywords: identifyResult.keywords,
        summary: identifyResult.summary,
        cover: identifyResult.cover,
        encyclopediaId: identifyResult.encyclopediaId,
        provider: identifyResult.provider,
        model: identifyResult.model,
      },
      generation: {
        taskId: generationOverride?.taskId || lastGenerationTaskId || undefined,
        status: generationOverride?.status || (generatedPortrait ? 'succeeded' : undefined),
        imageUrl: generationOverride?.imageUrl || generatedPortrait || undefined,
        promptId: generationOverride?.promptId || lastGenerationTrace.promptId || undefined,
        prompt: generationOverride?.prompt || lastGenerationTrace.prompt || undefined,
        negativePrompt: generationOverride?.negativePrompt || lastGenerationTrace.negativePrompt || undefined,
        durationMs: generationOverride?.durationMs || lastGenerationDurationMs || undefined,
        presetId: generationOverride?.presetId || lastGenerationTrace.presetId || selectedPreset?.id || undefined,
        workflowId: generationOverride?.workflowId || lastGenerationTrace.workflowId || selectedWorkflow?.id || undefined,
        workflowPath: generationOverride?.workflowPath || lastGenerationTrace.workflowPath || undefined,
        workflowMode: generationOverride?.workflowMode || lastGenerationTrace.workflowMode || undefined,
        workflowFallbackReason: generationOverride?.workflowFallbackReason || lastGenerationTrace.workflowFallbackReason || undefined,
        routingRuleId: generationOverride?.routingRuleId || lastGenerationTrace.routingRuleId || undefined,
        routingRuleLabel: generationOverride?.routingRuleLabel || lastGenerationTrace.routingRuleLabel || undefined,
      },
      messages: messageSnapshot
        .map((item) => ({
          id: item.id,
          role: item.role,
          text: item.text.trim(),
        }))
        .filter((item) => Boolean(item.text)),
    })

    if (!response.ok || !response.data.id) {
      return ''
    }

    setLatestSessionId(response.data.id)

    const statsResponse = await fetchSpiritGenerationStatsFromServer()
    setGenerationStats(statsResponse.data)

    return response.data.id
  }

  const onCreateCommunityDraft = async () => {
    if (!identifyResult || !current || isDraftPreparing) {
      return
    }

    setIsDraftPreparing(true)

    try {
      const messageSnapshot = [...messages]
      let sessionId = latestSessionId

      const refreshedSessionId = await createSessionSnapshot(messageSnapshot)
      if (refreshedSessionId) {
        sessionId = refreshedSessionId
      }

      let draft = null
      if (sessionId) {
        const draftResponse = await createSpiritCommunityDraftOnServer({
          sessionId,
        })

        if (draftResponse.ok && draftResponse.data.title) {
          draft = draftResponse.data
        }
      }

      if (!draft) {
        draft = buildLocalSpiritCommunityDraft({
          identifyTaskId: identifyResult.taskId,
          identifyName: identifyResult.name,
          scientificName: identifyResult.scientificName,
          sourceRefs: identifyResult.sourceRefs ?? [],
          keywords: identifyResult.keywords,
          summary: identifyResult.summary,
          imageUrl: generatedPortrait,
          generationTaskId: lastGenerationTaskId || undefined,
          generationPromptId: lastGenerationTrace.promptId || undefined,
          generationPrompt: lastGenerationTrace.prompt || undefined,
          generationNegativePrompt: lastGenerationTrace.negativePrompt || undefined,
          generationPresetId: lastGenerationTrace.presetId || selectedPreset?.id,
          generationWorkflowId: lastGenerationTrace.workflowId || selectedWorkflow?.id,
          generationWorkflowPath: lastGenerationTrace.workflowPath || undefined,
          generationWorkflowMode: lastGenerationTrace.workflowMode || undefined,
          generationWorkflowFallbackReason: lastGenerationTrace.workflowFallbackReason || undefined,
          generationRoutingRuleLabel: lastGenerationTrace.routingRuleLabel || undefined,
          durationMs: lastGenerationDurationMs,
          messages: messageSnapshot,
        })
        emitInfoToast('已切换本地草稿模式，你可以继续编辑后发布。')
      }

      navigate('/community/new', {
        state: {
          spiritDraftId: draft.id || undefined,
          spiritDraft: draft,
        },
      })
    } finally {
      setIsDraftPreparing(false)
    }
  }

  const appendSpiritText = (messageId: string, chunk: string) => {
    if (!chunk) {
      return
    }

    setMessages((prev) =>
      prev.map((item) =>
        item.id === messageId
          ? {
              ...item,
              text: `${item.text}${chunk}`,
            }
          : item,
      ),
    )
  }

  const startStreamReply = (reply: string, options?: { targetMessageId?: string }) => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current)
    }

    const streamId = options?.targetMessageId || `spirit-${Date.now()}`
    if (!options?.targetMessageId) {
      setMessages((prev) => [...prev, { id: streamId, role: 'spirit', text: '' }])
    } else {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === streamId
            ? {
                ...item,
                text: '',
              }
            : item,
        ),
      )
    }

    let index = 0
    streamTimerRef.current = window.setInterval(() => {
      index += 1
      const nextText = reply.slice(0, index)
      setMessages((prev) => prev.map((item) => (item.id === streamId ? { ...item, text: nextText } : item)))

      if (index >= reply.length && streamTimerRef.current) {
        window.clearInterval(streamTimerRef.current)
        streamTimerRef.current = null
      }
    }, 20)

    return streamId
  }

  const resetSpiritConversationState = () => {
    setGeneratedPortrait('')
    setCurrent(null)
    setCurrentRolePack(null)
    setMessages([])
    setShowRealPhoto(false)
    setIsGeneratingSpirit(false)
    setGenerationTaskStatus('')
    setLatestSessionId('')
    setLastGenerationTaskId('')
    setLastGenerationDurationMs(0)
    setLastGenerationTrace(emptyGenerationTrace())
    setChatConversationSessionId('')
    setChatDebugMeta({
      rolePackId: '',
      rolePackName: '',
      memoryHits: 0,
      memorySummaryId: '',
    })
  }

  const cancelRunningStreams = () => {
    if (identifyTimerRef.current) {
      window.clearTimeout(identifyTimerRef.current)
      identifyTimerRef.current = null
    }
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current)
      streamTimerRef.current = null
    }
    if (identifyAbortRef.current) {
      identifyAbortRef.current.abort()
      identifyAbortRef.current = null
    }
    if (chatAbortRef.current) {
      chatAbortRef.current.abort()
      chatAbortRef.current = null
    }
    setIsChatRequesting(false)
  }

  const runIdentify = (file: File, localImage: string) => {
    cancelRunningStreams()
    resetSpiritConversationState()
    setIdentifyResult(null)
    setIsRecognizing(true)

    const requestId = identifyRequestIdRef.current + 1
    identifyRequestIdRef.current = requestId
    const controller = new AbortController()
    identifyAbortRef.current = controller

    identifyTimerRef.current = window.setTimeout(async () => {
      try {
        const imageData = await toDataUrl(file, controller.signal)
        const createdTask = await createIdentifyTaskOnServer({
          image: imageData,
        })

        if (!createdTask.ok || !createdTask.data.id) {
          throw new Error(createdTask.message || '创建识别任务失败')
        }

        const finalTask = await waitForIdentifyTask(createdTask.data.id, {
          intervalMs: 900,
          timeoutMs: 90_000,
        })

        if (!finalTask.ok) {
          throw new Error(finalTask.message || '识别任务执行失败')
        }

        if (finalTask.data.status !== 'succeeded') {
          throw new Error(finalTask.data.error || '识别任务未成功完成')
        }

        if (identifyRequestIdRef.current !== requestId) {
          return
        }

        const snapshot = toCanonicalIdentifySnapshot(finalTask.data, localImage)
        setIdentifyResult(snapshot)
        setLatestIdentifySnapshot(snapshot)
        addSpiritIdentifyRecord(toRecognitionResult(snapshot))
      } catch (error) {
        if (identifyRequestIdRef.current !== requestId || isAbortError(error)) {
          return
        }

        const fallback = buildFallbackIdentifySnapshot(file.name, localImage)
        setIdentifyResult(fallback)
        setLatestIdentifySnapshot(fallback)
        addSpiritIdentifyRecord(toRecognitionResult(fallback))
        emitInfoToast(`识别服务暂不可用，已切换离线识别。${error instanceof Error ? error.message : ''}`)
      } finally {
        if (identifyRequestIdRef.current === requestId) {
          setIsRecognizing(false)
          identifyTimerRef.current = null
          identifyAbortRef.current = null
        }
      }
    }, identifyDelayMs)
  }

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    event.target.value = ''

    const localImage = URL.createObjectURL(file)
    setSelectedFile(file)
    setSelectedImage(localImage)
    runIdentify(file, localImage)
  }

  const onReIdentify = () => {
    if (!selectedFile || isRecognizing) {
      return
    }

    runIdentify(selectedFile, selectedImage || identifyResult?.cover || '')
  }

  const onGenerate = async () => {
    if (!identifyResult || isGeneratingSpirit) {
      return
    }

    const rolePack = resolveSpiritRolePack(identifyResult)
    const prompt = buildSpiritGenerationPrompt(identifyResult, rolePack)
    const negativePrompt = buildSpiritGenerationNegativePrompt(identifyResult, rolePack, selectedPreset?.negativePrompt || '')
    const generationKeywords = dedupeKeywords([...identifyResult.keywords, ...rolePack.visualKeywords]).slice(0, 16)

    setIsGeneratingSpirit(true)
    setGenerationTaskStatus('queued')
    setCurrent(null)
    setCurrentRolePack(rolePack)
    setCurrentPersonaDesign(null)
    setLatestSessionId('')
    setLastGenerationTaskId('')
    setLastGenerationDurationMs(0)
    setLastGenerationTrace(emptyGenerationTrace())

    let nextPortrait = identifyResult.spiritPreview || identifyResult.cover
    let resolvedTaskId = ''
    let resolvedDurationMs = 0
    let resolvedGenerationStatus = 'failed'
    let resolvedTrace = emptyGenerationTrace()
    let resolvedPersonaDesign: SpiritPersonaDesign | null = null

    try {
      const generationFlowPromise = (async () => {
        const createdTask = await createSpiritGenerationTaskOnServer({
          name: identifyResult.name,
          scientificName: identifyResult.scientificName,
          keywords: generationKeywords,
          autoRoute: true,
          identifyTypeLabel: identifyResult.typeLabel,
          identifyRiskLevel: identifyResult.riskLevel,
          prompt,
          negativePrompt: negativePrompt || undefined,
          presetId: selectedPreset?.id || undefined,
          workflowId: selectedWorkflow?.id || undefined,
          width: selectedPreset?.width,
          height: selectedPreset?.height,
          steps: selectedPreset?.steps,
          cfgScale: selectedPreset?.cfgScale,
          denoise: selectedPreset?.denoise,
          samplerName: selectedPreset?.samplerName,
          scheduler: selectedPreset?.scheduler,
          diagnosisResult: {
            diagnosis: {
              name: identifyResult.name,
              category: identifyResult.typeLabel === '病害' ? '病害' : '虫害',
              symptom_tags: identifyResult.keywords.slice(0, 12),
              evidence_tags: identifyResult.keywords.slice(0, 12),
              host_plant: '',
              risk_level: identifyResult.riskLevel,
              confidence: identifyResult.confidence,
            },
            rolePack: {
              id: rolePack.id,
              name: rolePack.name,
              style: rolePack.style,
              persona: rolePack.persona,
              guardrails: rolePack.guardrails,
              visualKeywords: rolePack.visualKeywords,
              negativeKeywords: rolePack.negativeKeywords,
            },
            styleMode: selectedPreset?.id || rolePack.id,
          },
          rolePack: {
            id: rolePack.id,
            name: rolePack.name,
            style: rolePack.style,
            persona: rolePack.persona,
            guardrails: rolePack.guardrails,
            visualKeywords: rolePack.visualKeywords,
            negativeKeywords: rolePack.negativeKeywords,
          },
          styleMode: selectedPreset?.id || rolePack.id,
        })

        if (!createdTask.ok || !createdTask.data.id) {
          return {
            ok: false,
            message: createdTask.message || '创建生图任务失败。',
            imageUrl: '',
            taskId: '',
            durationMs: 0,
            status: 'failed',
            personaDesign: null,
            trace: {
              ...emptyGenerationTrace(),
              prompt,
              negativePrompt,
            },
          }
        }

        resolvedTaskId = createdTask.data.id
        setGenerationTaskStatus(createdTask.data.status)

        const baseTrace: GenerationTraceSnapshot = {
          taskId: createdTask.data.id,
          promptId: '',
          presetId: createdTask.data.payload?.presetId || selectedPreset?.id || '',
          workflowId: createdTask.data.payload?.workflowId || selectedWorkflow?.id || '',
          workflowPath: createdTask.data.payload?.workflowPath || '',
          workflowMode: '',
          workflowFallbackReason: '',
          routingRuleId: createdTask.data.payload?.routingRuleId || '',
          routingRuleLabel: createdTask.data.payload?.routingRuleLabel || '',
          prompt: createdTask.data.payload?.prompt || prompt,
          negativePrompt: createdTask.data.payload?.negativePrompt || negativePrompt,
        }

        const taskResult = await waitForSpiritGenerationTask(createdTask.data.id, {
          timeoutMs: 120_000,
          intervalMs: 1_200,
          onProgress(task) {
            setGenerationTaskStatus(task.status)
          },
        })

        if (!taskResult.ok) {
          return {
            ok: false,
            message: taskResult.message || '查询生图任务失败。',
            imageUrl: '',
            taskId: createdTask.data.id,
            durationMs: 0,
            status: 'failed',
            personaDesign: null,
            trace: baseTrace,
          }
        }

        const durationMs = Number.isFinite(Number(taskResult.data.durationMs)) ? Number(taskResult.data.durationMs) : 0

        if (taskResult.data.status !== 'succeeded') {
          return {
            ok: false,
            message: taskResult.data.error || '生图任务执行失败。',
            imageUrl: '',
            taskId: createdTask.data.id,
            durationMs,
            status: taskResult.data.status,
            personaDesign: taskResult.data.result?.personaDesignJson || null,
            trace: {
              ...baseTrace,
              workflowMode: taskResult.data.result?.workflowMode || '',
              workflowPath: taskResult.data.result?.workflowPath || baseTrace.workflowPath,
              workflowFallbackReason: taskResult.data.result?.workflowFallbackReason || '',
              promptId: taskResult.data.result?.promptId || '',
              presetId: taskResult.data.result?.presetId || baseTrace.presetId,
              workflowId: taskResult.data.result?.workflowId || baseTrace.workflowId,
              routingRuleId: taskResult.data.result?.routingRuleId || baseTrace.routingRuleId,
              routingRuleLabel: taskResult.data.result?.routingRuleLabel || baseTrace.routingRuleLabel,
              prompt: taskResult.data.result?.prompt || baseTrace.prompt,
              negativePrompt: taskResult.data.result?.negativePrompt || baseTrace.negativePrompt,
            },
          }
        }

        const imageUrl = taskResult.data.result?.imageUrl?.trim() || ''
        if (!imageUrl) {
          return {
            ok: false,
            message: '生图任务已完成，但图片地址为空。',
            imageUrl: '',
            taskId: createdTask.data.id,
            durationMs,
            status: 'failed',
            personaDesign: taskResult.data.result?.personaDesignJson || null,
            trace: {
              ...baseTrace,
              workflowMode: taskResult.data.result?.workflowMode || '',
              workflowPath: taskResult.data.result?.workflowPath || baseTrace.workflowPath,
              workflowFallbackReason: taskResult.data.result?.workflowFallbackReason || '',
              promptId: taskResult.data.result?.promptId || '',
              presetId: taskResult.data.result?.presetId || baseTrace.presetId,
              workflowId: taskResult.data.result?.workflowId || baseTrace.workflowId,
              routingRuleId: taskResult.data.result?.routingRuleId || baseTrace.routingRuleId,
              routingRuleLabel: taskResult.data.result?.routingRuleLabel || baseTrace.routingRuleLabel,
              prompt: taskResult.data.result?.prompt || baseTrace.prompt,
              negativePrompt: taskResult.data.result?.negativePrompt || baseTrace.negativePrompt,
            },
          }
        }

        return {
          ok: true,
          message: '',
          imageUrl,
          taskId: createdTask.data.id,
          durationMs,
          status: taskResult.data.status,
          personaDesign: taskResult.data.result?.personaDesignJson || null,
          trace: {
            ...baseTrace,
            workflowMode: taskResult.data.result?.workflowMode || '',
            workflowPath: taskResult.data.result?.workflowPath || baseTrace.workflowPath,
            workflowFallbackReason: taskResult.data.result?.workflowFallbackReason || '',
            promptId: taskResult.data.result?.promptId || '',
            presetId: taskResult.data.result?.presetId || baseTrace.presetId,
            workflowId: taskResult.data.result?.workflowId || baseTrace.workflowId,
            routingRuleId: taskResult.data.result?.routingRuleId || baseTrace.routingRuleId,
            routingRuleLabel: taskResult.data.result?.routingRuleLabel || baseTrace.routingRuleLabel,
            prompt: taskResult.data.result?.prompt || baseTrace.prompt,
            negativePrompt: taskResult.data.result?.negativePrompt || baseTrace.negativePrompt,
          },
        }
      })()

      const [generationFlow] = await Promise.all([
        generationFlowPromise,
        new Promise<void>((resolve) => {
          window.setTimeout(() => resolve(), spiritDelayMs)
        }),
      ])

      if (generationFlow.ok && generationFlow.imageUrl) {
        nextPortrait = generationFlow.imageUrl
        resolvedTaskId = generationFlow.taskId || resolvedTaskId
        resolvedDurationMs = generationFlow.durationMs || 0
        resolvedGenerationStatus = 'succeeded'
        resolvedTrace = generationFlow.trace || resolvedTrace
        resolvedPersonaDesign = generationFlow.personaDesign || resolvedPersonaDesign
        setGenerationTaskStatus('succeeded')
      } else if (generationFlow.message) {
        resolvedTaskId = generationFlow.taskId || resolvedTaskId
        resolvedDurationMs = generationFlow.durationMs || 0
        resolvedGenerationStatus = generationFlow.status || 'failed'
        resolvedTrace = generationFlow.trace || resolvedTrace
        resolvedPersonaDesign = generationFlow.personaDesign || resolvedPersonaDesign
        setGenerationTaskStatus('failed')
        emitErrorToast(`灵化生图失败，已使用默认立绘。${generationFlow.message}`)
      }
    } finally {
      const profile = buildSpiritProfileFromSnapshot(identifyResult, rolePack, {
        portraitUrl: nextPortrait || undefined,
        realPhotoUrl: selectedImage || identifyResult.cover || undefined,
      })
      const portraitForUi = nextPortrait || profile.image
      const initialMessages = profile.chatLines.map((line, index) => ({
        id: `init-${index}`,
        role: 'spirit' as const,
        text: line,
      }))

      setGeneratedPortrait(portraitForUi)
      setCurrent(profile)
      setCurrentRolePack(rolePack)
      setCurrentPersonaDesign(resolvedPersonaDesign)
      setShowRealPhoto(false)
      setMessages(initialMessages)
      setLastGenerationTaskId(resolvedTaskId)
      setLastGenerationDurationMs(resolvedDurationMs)
      setLastGenerationTrace(resolvedTrace)
      setIsGeneratingSpirit(false)
      setGenerationTaskStatus('')

      void createSessionSnapshot(initialMessages, {
        taskId: resolvedTaskId,
        status: resolvedGenerationStatus,
        imageUrl: resolvedGenerationStatus === 'succeeded' ? portraitForUi : '',
        promptId: resolvedTrace.promptId,
        prompt: resolvedTrace.prompt,
        negativePrompt: resolvedTrace.negativePrompt,
        durationMs: resolvedDurationMs,
        presetId: resolvedTrace.presetId,
        workflowId: resolvedTrace.workflowId,
        workflowPath: resolvedTrace.workflowPath,
        workflowMode: resolvedTrace.workflowMode,
        workflowFallbackReason: resolvedTrace.workflowFallbackReason,
        routingRuleId: resolvedTrace.routingRuleId,
        routingRuleLabel: resolvedTrace.routingRuleLabel,
      })
    }
  }

  const resolveSpiritReply = async (input: {
    question: string
    fallbackReply: string
    messageSnapshot: ChatMessage[]
    targetMessageId: string
  }) => {
    if (!current) {
      startStreamReply(input.fallbackReply, { targetMessageId: input.targetMessageId })
      return
    }

    const rolePack = currentRolePack ?? (identifyResult ? resolveSpiritRolePack(identifyResult) : null)
    const rolePersonaSummary =
      currentPersonaDesign && (currentPersonaDesign.coreConcept || currentPersonaDesign.designDirection)
        ? `${currentPersonaDesign.coreConcept || current.name}。${currentPersonaDesign.designDirection || ''}`.trim()
        : ''

    const payload = {
      question: input.question,
      spirit: {
        name: current.name,
        scientificName: current.scientificName,
        summary: identifyResult?.summary || current.habits?.[0] || '',
        keywords: current.keywords,
      },
      identify: identifyResult
        ? {
            name: identifyResult.name,
            scientificName: identifyResult.scientificName,
            summary: identifyResult.summary,
            keywords: identifyResult.keywords,
            typeLabel: identifyResult.typeLabel,
          }
        : undefined,
      messages: input.messageSnapshot.map((item) => ({
        role: item.role,
        text: item.text,
      })),
      orchestration: {
        sessionId: chatConversationSessionId || undefined,
        rolePack: {
          id: rolePack?.id || `spirit-${current.id}`,
          name: rolePack?.name || current.name,
          style: rolePack?.style || '校园植保陪伴',
          persona: rolePersonaSummary || rolePack?.persona || `${current.name}，擅长将复杂植保建议拆解为可执行步骤。`,
          guardrails: rolePack?.guardrails || ['先观察后处置', '不确定先复核', '避免过量施药'],
        },
        personaDesign: currentPersonaDesign
          ? {
              coreConcept: currentPersonaDesign.coreConcept,
              designDirection: currentPersonaDesign.designDirection,
              colorPalette: currentPersonaDesign.colorPalette,
              silhouette: currentPersonaDesign.silhouette,
              hairDesign: currentPersonaDesign.hairDesign,
              outfitElements: currentPersonaDesign.outfitElements,
              accessoryElements: currentPersonaDesign.accessoryElements,
              textureMaterials: currentPersonaDesign.textureMaterials,
              symbolicMotifs: currentPersonaDesign.symbolicMotifs,
              temperament: currentPersonaDesign.temperament,
              pose: currentPersonaDesign.pose,
              forbiddenElements: currentPersonaDesign.forbiddenElements,
            }
          : undefined,
        diagnosisContext: identifyResult
          ? {
              identifyTaskId: identifyResult.taskId,
              identifyName: identifyResult.name,
              scientificName: identifyResult.scientificName,
              riskLevel: identifyResult.riskLevel,
              summary: identifyResult.summary,
              actionCards: identifyResult.controlTips,
              sourceRefs: identifyResult.sourceRefs ?? [],
            }
          : undefined,
        retrievalContext: identifyResult
          ? {
              sourceIndex: [
                {
                  title: '本轮识别摘要',
                  snippet: identifyResult.summary,
                  confidenceLabel: identifyResult.confidence >= 0.85 ? '高' : identifyResult.confidence >= 0.6 ? '中' : '低',
                },
                ...(identifyResult.sourceRefs ?? []).slice(0, 5).map((item, index) => ({
                  title: `识别来源 ${index + 1}`,
                  snippet: item,
                  confidenceLabel: '中',
                })),
              ],
              treatmentTemplate: {
                immediateActions: identifyResult.controlTips.slice(0, 2),
                environmentAdjustments: identifyResult.controlTips.slice(2, 4),
              },
            }
          : undefined,
        memoryContext: {
          sessionSummary: input.messageSnapshot
            .slice(-4)
            .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.text}`)
            .join('；'),
          longTermFacts: identifyResult?.keywords.slice(0, 3) ?? [],
        },
        currentIntent: input.question,
      },
    }

    if (chatAbortRef.current) {
      chatAbortRef.current.abort()
    }
    const controller = new AbortController()
    chatAbortRef.current = controller

    const streamResponse = await streamSpiritChatFromServer(payload, {
      signal: controller.signal,
      onDelta: (chunk) => appendSpiritText(input.targetMessageId, chunk),
    })

    if (chatAbortRef.current === controller) {
      chatAbortRef.current = null
    }

    if (streamResponse.ok && streamResponse.data.reply) {
      const nextConversationSessionId = streamResponse.data.conversationSessionId?.trim()
      if (nextConversationSessionId) {
        setChatConversationSessionId(nextConversationSessionId)
      }

      const nextDebug = streamResponse.data.debug
      if (nextDebug) {
        setChatDebugMeta({
          rolePackId: nextDebug.rolePackId || '',
          rolePackName: nextDebug.rolePackName || '',
          memoryHits: Number.isFinite(Number(nextDebug.memoryHits)) ? Math.max(0, Math.floor(Number(nextDebug.memoryHits))) : 0,
          memorySummaryId: streamResponse.data.memorySummaryId?.trim() || '',
        })
      }
      return
    }

    const fallbackRemoteResponse = await requestSpiritChatOnServer(payload)
    if (fallbackRemoteResponse.ok && fallbackRemoteResponse.data.reply) {
      startStreamReply(fallbackRemoteResponse.data.reply, { targetMessageId: input.targetMessageId })
      return
    }

    const reason = streamResponse.message || fallbackRemoteResponse.message
    if (reason) {
      emitInfoToast(`对话服务暂不可用，已回退本地回复。${reason}`)
    }

    startStreamReply(input.fallbackReply, { targetMessageId: input.targetMessageId })
  }

  const onQuickAsk = async (key: SpiritQuickKey, label: string) => {
    if (!current) {
      return
    }

    if (isChatRequesting) {
      return
    }

    const userMessage = { id: `user-${Date.now()}`, role: 'user' as const, text: label }
    const messageSnapshot = [...messages, userMessage]
    const spiritMessageId = `spirit-${Date.now()}`
    setMessages([...messageSnapshot, { id: spiritMessageId, role: 'spirit', text: '' }])
    setIsChatRequesting(true)

    try {
      await resolveSpiritReply({
        question: label,
        fallbackReply: current.quickReplies[key],
        messageSnapshot,
        targetMessageId: spiritMessageId,
      })
    } finally {
      setIsChatRequesting(false)
    }
  }

  const onSubmitChat = async (event: FormEvent) => {
    event.preventDefault()
    if (!current) {
      return
    }

    const question = chatDraft.trim()
    if (!question) {
      return
    }

    if (isChatRequesting) {
      return
    }

    const userMessage = { id: `user-${Date.now()}`, role: 'user' as const, text: question }
    const messageSnapshot = [...messages, userMessage]
    const spiritMessageId = `spirit-${Date.now()}`
    setMessages([...messageSnapshot, { id: spiritMessageId, role: 'spirit', text: '' }])
    setChatDraft('')
    setIsChatRequesting(true)

    try {
      await resolveSpiritReply({
        question,
        fallbackReply: buildDeepSeekMockReply(question, current),
        messageSnapshot,
        targetMessageId: spiritMessageId,
      })
    } finally {
      setIsChatRequesting(false)
    }
  }

  return (
    <div>
      <PageHeader title="灵化互动" subtitle="智能鉴别 -> 生成灵化角色 -> 灵化对话" />

      <main className="space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[var(--text-main)]">识别入口</p>
          <p className="mt-1 text-xs text-[var(--text-soft)]">先拍照或上传，系统先智能鉴别，点击生成灵化角色后再展示二次元人设图并进入对话。</p>

          <input
            ref={captureInputRef}
            data-testid="spirit-capture-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onUpload}
            className="hidden"
          />
          <input
            ref={uploadInputRef}
            data-testid="spirit-upload-input"
            type="file"
            accept="image/*"
            onChange={onUpload}
            className="hidden"
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => captureInputRef.current?.click()}
              className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--card-soft)] text-sm font-semibold text-[var(--text-main)]"
            >
              拍照识别
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--card-soft)] text-sm font-semibold text-[var(--text-main)]"
            >
              相册上传
            </button>
          </div>

          <section data-testid="spirit-runtime-panel" className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--text-main)]">生图引擎状态</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${runtimeBadge.className}`}>{runtimeBadge.text}</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-soft)]">
              模式：{runtimeStatus?.workflowModeCandidate || 'unknown'} · WeiLin：{runtimeStatus?.weilinAvailable ? '已加载' : '未加载'} ·
              Checkpoint：{runtimeStatus?.checkpointCount ?? 0}
            </p>
            {runtimeStatus?.workflowReason ? (
              <p className="mt-1 text-[11px] text-[var(--text-soft)]">说明：{runtimeStatus.workflowReason}</p>
            ) : null}
          </section>

          {generationConfig?.presets.length ? (
            <section data-testid="spirit-generation-config" className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
              <p className="text-xs font-semibold text-[var(--text-main)]">生图参数预设</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] text-[var(--text-soft)]">
                  风格预设
                  <select
                    value={selectedPreset?.id ?? ''}
                    onChange={(event) => setSelectedPresetId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2 text-xs text-[var(--text-main)]"
                  >
                    {(generationConfig.presets ?? []).map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-[var(--text-soft)]">
                  工作流
                  <select
                    value={selectedWorkflow?.id ?? ''}
                    onChange={(event) => setSelectedWorkflowId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2 text-xs text-[var(--text-main)]"
                  >
                    {(generationConfig.workflows ?? []).map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedPreset ? (
                <p className="mt-2 text-[11px] text-[var(--text-soft)]">
                  参数：{selectedPreset.width}x{selectedPreset.height} · steps {selectedPreset.steps} · cfg {selectedPreset.cfgScale} ·{' '}
                  {selectedPreset.samplerName}/{selectedPreset.scheduler}
                </p>
              ) : null}
              {generationConfig.workflowRoutingRules.length > 0 ? (
                <section data-testid="spirit-routing-rules" className="mt-2 rounded-lg border border-[var(--line)] bg-white p-2 text-[11px] text-[var(--text-soft)]">
                  <p className="font-semibold text-[var(--text-main)]">识别标签 -&gt; 工作流画像映射</p>
                  <p className="mt-1">
                    当前命中：
                    {matchedRoutingRule
                      ? `${matchedRoutingRule.label}（preset=${matchedRoutingRule.presetId} / workflow=${matchedRoutingRule.workflowId}）`
                      : '未命中，使用默认策略'}
                  </p>
                  <div className="mt-1 space-y-1">
                    {generationConfig.workflowRoutingRules.slice(0, 5).map((rule) => (
                      <p key={rule.id}>
                        [{rule.priority}] {rule.label} -&gt; {rule.presetId}/{rule.workflowId}
                        {rule.matchKeywords.length > 0 ? ` · 关键词：${rule.matchKeywords.join(' / ')}` : ' · 通用规则'}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}

          {selectedImage ? (
            <img src={selectedImage} alt="上传昆虫图" className="mt-3 h-44 w-full rounded-xl object-cover" />
          ) : null}

          <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[linear-gradient(145deg,#f8fbf6,#ecf3e7)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-main)]">智能鉴别</h3>
                <p className="text-xs text-[var(--text-soft)]">上传后自动鉴别昆虫/病害，并提取知识要点。</p>
              </div>
              {isRecognizing ? (
                <div data-testid="spirit-identify-loading" className="inline-flex items-center gap-2 text-xs text-[var(--accent-deep)]">
                  <span className="spirit-loading-ring h-4 w-4" />
                  鉴别中...
                </div>
              ) : (
                <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] text-[var(--text-soft)]">待机</span>
              )}
            </div>

            {isRecognizing ? (
              <div className="mt-3 space-y-2">
                <div className="spirit-loading-shimmer h-4 w-2/5 rounded-full" />
                <div className="spirit-loading-shimmer h-3 w-4/5 rounded-full" />
                <div className="spirit-loading-shimmer h-3 w-3/5 rounded-full" />
              </div>
            ) : null}

            {!isRecognizing && identifyResult ? (
              <article className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <img
                    src={identifyResult.cover}
                    alt={identifyResult.name}
                    className="h-16 w-16 rounded-lg object-cover"
                    onError={(event) => useImageFallback(event, selectedImage || '/images/914ec19753ff41c467235a1cc8413f5f.jpg')}
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-[var(--text-main)]">{identifyResult.name}</h4>
                    <p className="text-xs text-[var(--text-soft)]">{identifyResult.scientificName}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-soft)]">
                      类型：{identifyResult.typeLabel} · 置信度 {(identifyResult.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-xs leading-5 text-[var(--text-soft)]">{identifyResult.summary}</p>

                <ul className="mt-2 space-y-1 text-xs text-[var(--text-soft)]">
                  {identifyResult.controlTips.map((tip) => (
                    <li key={tip}>• {tip}</li>
                  ))}
                </ul>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {identifyResult.keywords.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[color:var(--accent-deep)/0.18] bg-[color:var(--accent)/0.35] px-2 py-0.5 text-[11px] text-[var(--accent-deep)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    data-testid="spirit-reidentify"
                    type="button"
                    onClick={onReIdentify}
                    disabled={!selectedFile || isRecognizing || isGeneratingSpirit}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-3 text-xs font-semibold text-[var(--text-main)] disabled:opacity-60"
                  >
                    重新识别
                  </button>
                  {identifyResult.encyclopediaId ? (
                    <Link
                      to={`/encyclopedia/${identifyResult.encyclopediaId}`}
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-3 text-xs font-semibold text-[var(--accent-deep)]"
                    >
                      查看相关图鉴
                    </Link>
                  ) : (
                    <span
                      data-testid="spirit-no-encyclopedia"
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-dashed border-[var(--line)] px-3 text-xs text-[var(--text-soft)]"
                    >
                      图鉴暂未收录，优先以 AI 识别结果推进灵化与对话
                    </span>
                  )}
                </div>
              </article>
            ) : null}
          </section>

          {identifyResult ? (
            <section data-testid="spirit-keywords-panel" className="mt-3">
              <p className="mb-2 text-sm font-medium text-[var(--text-main)]">特征关键词</p>
              <div className="flex flex-wrap gap-2">
                {(identifyResult.keywords.length > 0 ? identifyResult.keywords : suggestionKeywords).map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-[var(--card-soft)] px-3 py-1 text-[11px] text-[var(--text-soft)]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {identifyResult ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                data-testid="spirit-generate"
                type="button"
                onClick={onGenerate}
                disabled={isGeneratingSpirit || isRecognizing}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--text-main)] disabled:opacity-70"
              >
                {isGeneratingSpirit ? (
                  <>
                    <span className="spirit-loading-ring h-4 w-4" />
                    生成灵化角色中...
                  </>
                ) : current ? (
                  '重新灵化角色'
                ) : (
                  '生成灵化角色'
                )}
              </button>
              <button
                data-testid="spirit-regenerate"
                type="button"
                onClick={onGenerate}
                disabled={!current || isGeneratingSpirit || isRecognizing}
                className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--card-soft)] text-sm font-semibold text-[var(--text-main)] disabled:opacity-60"
              >
                重新灵化
              </button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-[var(--text-soft)]">完成智能鉴别后，将自动开放灵化角色按钮。</p>
          )}

          {isGeneratingSpirit ? (
            <div
              data-testid="spirit-generate-loading"
              className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3 text-xs text-[var(--text-soft)]"
            >
              <div className="flex items-center gap-2">
                <span className="spirit-loading-ring h-4 w-4" />
                {generationStatusLabel(generationTaskStatus)}
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="spirit-loading-shimmer h-2 w-11/12 rounded-full" />
                <div className="spirit-loading-shimmer h-2 w-4/5 rounded-full" />
              </div>
            </div>
          ) : null}
        </section>

        {current ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <article
              data-testid="spirit-upper-layer"
              className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(160deg,#f8fbf7,#e9f2e7)] p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <img src={current.avatar} alt={current.name} className="h-14 w-14 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-[var(--text-main)]">{current.name}</h3>
                  <p className="text-xs text-[var(--text-soft)]">
                    {current.englishName} · {current.scientificName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavoriteSpirit(current.id)}
                  className="flex min-h-[44px] items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-xs text-[var(--text-main)]"
                >
                  <MaterialSymbol
                    name={isFavorite ? 'favorite' : 'favorite_border'}
                    filled={isFavorite}
                    className={`text-[17px] ${isFavorite ? 'text-emerald-600' : 'text-[var(--text-soft)]'}`}
                  />
                  <span>{isFavorite ? '已收藏' : '收藏'}</span>
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--text-soft)]">上半部：幻化卡片（点击切换立绘/实拍）</p>
                <button
                  data-testid="spirit-toggle-image"
                  type="button"
                  onClick={() => setShowRealPhoto((prev) => !prev)}
                  className="mt-2 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-[radial-gradient(circle_at_50%_20%,#f2f8ef,#e3ecdf)]"
                >
                  <div className="grid h-80 place-items-center px-3 py-2">
                    <img
                      data-testid="spirit-portrait-image"
                      src={showRealPhoto ? selectedImage || identifyResult?.cover || current.realPhoto : generatedPortrait || current.image}
                      alt={showRealPhoto ? '昆虫实拍图' : '灵化立绘'}
                      className="h-full w-full object-contain"
                      onError={(event) => useImageFallback(event, '/images/914ec19753ff41c467235a1cc8413f5f.jpg')}
                    />
                  </div>
                  <p className="border-t border-[var(--line)] px-3 py-2 text-center text-xs font-semibold text-[var(--accent-deep)]">
                    {showRealPhoto ? '点击查看灵化立绘' : '点击查看昆虫实拍图'}
                  </p>
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--text-soft)]">中间部：专业特征标签</p>
                <div data-testid="spirit-tags" className="mt-2 flex flex-wrap gap-2">
                  {recognizedTags.map((tag, index) => (
                    <span
                      key={tag}
                      className="spirit-tag-rise rounded-full border border-[color:var(--accent-deep)/0.22] bg-[linear-gradient(145deg,#f5fbf2,#e5f1df)] px-2.5 py-1 text-[11px] text-[var(--accent-deep)]"
                      style={{ animationDelay: `${index * 0.04}s` }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            <article
              data-testid="spirit-lower-layer"
              className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(160deg,#f9fcf7,#edf7ef)] p-2 shadow-sm sm:p-3"
            >
              <SpiritChatBackground theme={chatTheme}>
                <SpiritChatHeader portraitUrl={currentPortraitUrl} name={current.name} statusText={currentStatusText} />
                <SpiritMessageList
                  messages={messages}
                  spiritAvatarUrl={currentPortraitUrl}
                  spiritName={current.name}
                  streamingState={isChatRequesting}
                />
                <SpiritQuickActions
                  actions={quickActions}
                  disabled={isChatRequesting}
                  onQuickAsk={(actionKey, label) => onQuickAsk(actionKey as SpiritQuickKey, label)}
                />
                <SpiritInputBar value={chatDraft} disabled={isChatRequesting} onChange={setChatDraft} onSubmit={onSubmitChat} />
              </SpiritChatBackground>

              <section className="mt-3 rounded-xl border border-[var(--line)] bg-white/85 p-3 text-xs text-[var(--text-soft)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    data-testid="spirit-toggle-diagnostics"
                    type="button"
                    onClick={() => setIsDiagnosticsExpanded((prev) => !prev)}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700"
                  >
                    {isDiagnosticsExpanded ? '隐藏运行详情' : '查看运行详情'}
                  </button>
                  <button
                    data-testid="spirit-create-draft"
                    type="button"
                    onClick={onCreateCommunityDraft}
                    disabled={isDraftPreparing}
                    className="min-h-[36px] rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-slate-900 disabled:opacity-65"
                  >
                    {isDraftPreparing ? '生成草稿中...' : '一键生成社区草稿'}
                  </button>
                </div>

                {isDiagnosticsExpanded ? (
                  <div className="mt-3 space-y-2">
                    <section data-testid="spirit-p4-panel" className="rounded-lg border border-[var(--line)] bg-[var(--card-soft)] p-3">
                      <p className="text-xs font-semibold text-[var(--text-main)]">P4 闭环状态</p>
                      <p className="mt-2">会话ID：{latestSessionId || '未创建'}</p>
                      <p className="mt-1">
                        生图成功率：{generationStats ? `${(generationStats.successRate * 100).toFixed(1)}%` : '0.0%'} · 平均耗时：
                        {generationStats ? `${generationStats.averageDurationMs}ms` : '0ms'}
                      </p>
                      <p className="mt-1">当前任务耗时：{lastGenerationDurationMs > 0 ? `${lastGenerationDurationMs}ms` : '未记录'}</p>
                    </section>

                    <section data-testid="spirit-p18-trace" className="rounded-lg border border-[var(--line)] bg-[var(--card-soft)] p-3">
                      <p className="text-xs font-semibold text-[var(--text-main)]">P18 生图追踪快照</p>
                      <p className="mt-2">任务ID：{lastGenerationTrace.taskId || '未记录'} · PromptID：{lastGenerationTrace.promptId || '未记录'}</p>
                      <p className="mt-1">
                        profile：preset={lastGenerationTrace.presetId || '-'} / workflow={lastGenerationTrace.workflowId || '-'}
                      </p>
                      <p className="mt-1">工作流画像：{lastGenerationTrace.routingRuleLabel || '默认/手动'}</p>
                      <p className="mt-1">
                        执行模式：{lastGenerationTrace.workflowMode || 'unknown'} · 路径：{lastGenerationTrace.workflowPath || '未记录'}
                      </p>
                      {lastGenerationTrace.workflowFallbackReason ? (
                        <p className="mt-1">工作流说明：{lastGenerationTrace.workflowFallbackReason}</p>
                      ) : null}
                      <p className="mt-1">正向提示词：{truncatePreview(lastGenerationTrace.prompt) || '未记录'}</p>
                      <p className="mt-1">反向提示词：{truncatePreview(lastGenerationTrace.negativePrompt) || '未记录'}</p>
                    </section>

                    {import.meta.env.DEV ? (
                      <section data-testid="spirit-chat-debug" className="rounded-lg border border-[var(--line)] bg-[var(--card-soft)] p-3">
                        <p className="text-xs font-semibold text-[var(--text-main)]">P11 调试信息（仅开发环境）</p>
                        <p className="mt-2">当前角色包：{chatDebugMeta.rolePackName || currentRolePack?.name || current.name}</p>
                        <p className="mt-1">角色包ID：{chatDebugMeta.rolePackId || currentRolePack?.id || `spirit-${current.id}`}</p>
                        <p className="mt-1">记忆命中：{chatDebugMeta.memoryHits}</p>
                        <p className="mt-1">会话链路：{chatConversationSessionId || '未建立'}</p>
                        <p className="mt-1">摘要ID：{chatDebugMeta.memorySummaryId || '未生成'}</p>
                      </section>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  )
}


