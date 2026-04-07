import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { generateRecognition } from '../mock/ai'
import {
  createIdentifyTaskOnServer,
  type IdentifyTask,
  type IdentifyTaskStatus,
  waitForIdentifyTask,
} from '../services/identifyTaskApi'
import { toCanonicalIdentifySnapshot, toRecognitionResult } from '../services/identifyCanonical'
import { useAppStore } from '../store/useAppStore'
import type { RecognitionResult } from '../types/models'

const identifyMode = (import.meta.env.VITE_IDENTIFY_TASK_MODE ?? 'backend').trim().toLowerCase()
const isMockIdentifyMode = identifyMode === 'mock'

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('图片数据为空'))
        return
      }
      resolve(result)
    }
    reader.readAsDataURL(file)
  })

const emitErrorToast = (message: string) => {
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

const buildMockTask = (recognition: RecognitionResult, preview: string): IdentifyTask => ({
  id: recognition.id,
  type: 'diagnosis_identify',
  status: 'succeeded',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: '',
  finishedAt: '',
  durationMs: 0,
  error: '',
  riskLevel: recognition.type === '病害' ? 'high' : 'medium',
  topResult: {
    name: recognition.name,
    category: recognition.type === '病害' ? '病害' : '虫害',
    confidence: recognition.confidence,
    evidenceTags: recognition.keywords,
  },
  identify: {
    name: recognition.name,
    scientificName: '',
    confidence: recognition.confidence,
    typeLabel: recognition.type,
    keywords: recognition.keywords,
    summary: '当前为离线演示结果。',
    controlTips: ['可切换 `VITE_IDENTIFY_TASK_MODE=backend` 进入真实识别任务链路。'],
    cover: preview || recognition.cover,
    spiritPreview: '',
    encyclopediaId: '',
    provider: 'mock',
    model: 'local',
  },
  actionCards: [
    {
      id: `${recognition.id}-encyclopedia`,
      type: 'encyclopedia',
      title: '图鉴查证',
      description: '进入图鉴查看更完整信息。',
      ctaLabel: '打开图鉴',
      ctaRoute: '/encyclopedia',
      priority: 80,
    },
  ],
  encyclopediaRefs: [],
  sourceRefs: ['mock:identify'],
})

const statusLabel: Record<IdentifyTaskStatus, string> = {
  pending: '待提交',
  queued: '排队中',
  running: '识别中',
  succeeded: '识别完成',
  failed: '识别失败',
}

const riskLabel = (level: string) => {
  if (level === 'critical') {
    return '极高'
  }
  if (level === 'high') {
    return '高'
  }
  if (level === 'medium') {
    return '中'
  }
  return '低'
}

export function IdentifyPage() {
  const addIdentifyRecord = useAppStore((state) => state.addIdentifyRecord)
  const setLatestIdentifySnapshot = useAppStore((state) => state.setLatestIdentifySnapshot)
  const history = useAppStore((state) => state.identifyHistory)
  const previewUrlRef = useRef('')
  const [preview, setPreview] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [task, setTask] = useState<IdentifyTask | null>(null)
  const [status, setStatus] = useState<IdentifyTaskStatus>('pending')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const recent = useMemo(() => history.slice(0, 3), [history])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = ''
      }
    }
  }, [])

  const onFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }

    const nextPreview = URL.createObjectURL(file)
    previewUrlRef.current = nextPreview
    setSelectedFile(file)
    setFileName(file.name)
    setPreview(nextPreview)
    setTask(null)
    setStatus('pending')
  }

  const onGenerate = async () => {
    if (!selectedFile || !fileName) {
      return
    }

    if (isMockIdentifyMode) {
      const recognition = generateRecognition(fileName)
      const mockTask = buildMockTask(recognition, preview)
      setTask(mockTask)
      setStatus('succeeded')
      addIdentifyRecord(recognition)
      setLatestIdentifySnapshot(toCanonicalIdentifySnapshot(mockTask, preview))
      return
    }

    setIsSubmitting(true)
    setTask(null)
    setStatus('pending')

    try {
      const imageData = await toDataUrl(selectedFile)
      const createResult = await createIdentifyTaskOnServer({
        image: imageData,
      })

      if (!createResult.ok || !createResult.data.id) {
        throw new Error(createResult.message || '创建识别任务失败')
      }

      setTask(createResult.data)
      setStatus(createResult.data.status)

      const finalResult = await waitForIdentifyTask(createResult.data.id, {
        intervalMs: 900,
        timeoutMs: 90_000,
        onProgress(nextTask) {
          setTask(nextTask)
          setStatus(nextTask.status)
        },
      })

      if (!finalResult.ok) {
        throw new Error(finalResult.message || '识别任务执行失败')
      }

      setTask(finalResult.data)
      setStatus(finalResult.data.status)

      if (finalResult.data.status === 'succeeded') {
        const snapshot = toCanonicalIdentifySnapshot(finalResult.data, preview)
        setLatestIdentifySnapshot(snapshot)
        addIdentifyRecord(toRecognitionResult(snapshot))
      } else if (finalResult.data.error) {
        emitErrorToast(finalResult.data.error)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '识别失败，请稍后重试。'
      const fallbackRecognition = generateRecognition(fileName)
      const fallbackTask = buildMockTask(fallbackRecognition, preview)
      setTask(fallbackTask)
      setStatus('succeeded')
      addIdentifyRecord(fallbackRecognition)
      setLatestIdentifySnapshot(toCanonicalIdentifySnapshot(fallbackTask, preview))
      emitErrorToast(`${message} 已切换离线识别。`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="AI识别" subtitle="识别任务化：风险等级 + 行动卡片 + 历史追踪" />

      <main className="space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <label htmlFor="identify-upload" className="mb-2 block text-sm font-medium text-[var(--text-main)]">
            上传图片
          </label>
          <input
            id="identify-upload"
            name="identify-upload"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileSelect}
            className="block w-full text-xs text-[var(--text-soft)]"
          />

          <div className="mt-3 overflow-hidden rounded-xl border border-dashed border-[var(--line)] bg-[var(--card-soft)]">
            {preview ? (
              <img src={preview} alt="预览" className="h-44 w-full object-cover" />
            ) : (
              <div className="grid h-44 place-items-center text-sm text-[var(--text-soft)]">请选择图片开始识别</div>
            )}
          </div>

          <button
            data-testid="identify-generate"
            type="button"
            onClick={onGenerate}
            className="mt-4 h-11 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!fileName || !selectedFile || isSubmitting}
          >
            {isSubmitting ? '识别任务执行中...' : '开始智能识别'}
          </button>

          <p className="mt-2 text-xs text-[var(--text-soft)]">
            当前状态：{statusLabel[status]}
            {isMockIdentifyMode ? '（离线演示）' : ''}
          </p>
        </section>

        {task?.status === 'succeeded' ? (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <p className="text-xs text-[var(--text-soft)]">识别结果（任务）</p>
            <div className="mt-2 flex gap-3">
              <img
                src={task.identify.cover || preview}
                alt={task.topResult.name || task.identify.name}
                className="h-20 w-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <h3 className="text-base font-bold text-[var(--text-main)]">{task.topResult.name || task.identify.name}</h3>
                <p className="mt-1 text-xs text-[var(--text-soft)]">类别：{task.topResult.category || task.identify.typeLabel}</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">
                  置信度：{Math.round((task.topResult.confidence || task.identify.confidence || 0) * 100)}%
                </p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">风险等级：{riskLabel(task.riskLevel)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(task.topResult.evidenceTags.length > 0 ? task.topResult.evidenceTags : task.identify.keywords).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-[var(--card-soft)] px-2 py-1 text-[11px] text-[var(--text-soft)]">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {task.identify.summary ? (
              <p className="mt-3 rounded-xl bg-[var(--card-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">{task.identify.summary}</p>
            ) : null}

            {task.actionCards.length > 0 ? (
              <div className="mt-3 space-y-2">
                {task.actionCards
                  .slice()
                  .sort((a, b) => b.priority - a.priority)
                  .map((card) => (
                    <div key={card.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
                      <p className="text-sm font-semibold text-[var(--text-main)]">{card.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">{card.description}</p>
                      {card.ctaRoute ? (
                        <Link to={card.ctaRoute} className="mt-2 inline-flex text-xs font-medium text-emerald-700 underline underline-offset-2">
                          {card.ctaLabel || '查看'}
                        </Link>
                      ) : null}
                    </div>
                  ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {task?.status === 'failed' ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-sm font-semibold text-rose-700">识别失败</p>
            <p className="mt-1 text-xs text-rose-600">{task.error || '请重试或切换更清晰的图片。'}</p>
          </section>
        ) : null}

        {recent.length > 0 ? (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--text-main)]">最近识别</h3>
            <ul data-testid="identify-recent-list" className="mt-2 space-y-2">
              {recent.map((item) => (
                <li key={`${item.id}-${item.confidence}`} className="text-xs text-[var(--text-soft)]">
                  {item.name} · 置信度 {Math.round(item.confidence * 100)}%
                  {item.riskLevel ? ` · 风险 ${riskLabel(item.riskLevel)}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  )
}
