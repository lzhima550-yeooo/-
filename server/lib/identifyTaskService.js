import { randomUUID } from 'node:crypto'
import { buildDiagnosisActionCards } from './actionCardEngine.js'
import { createInMemoryQueue } from './queue.js'
import { evaluateDiagnosisRisk } from './riskEngine.js'

const defaultTaskTtlMs = 1000 * 60 * 60

const clone = (value) => JSON.parse(JSON.stringify(value))
const nowIso = () => new Date().toISOString()
const safeText = (value) => String(value ?? '').trim()

const toInteger = (value, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.max(0, Math.floor(number))
}

const toStringList = (value, max = 16) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, max)
}

const toConfidence = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0.5
  }

  return Math.max(0, Math.min(1, number))
}

const normalizeTaskStatus = (status) => {
  if (status === 'pending') {
    return 'pending'
  }

  if (status === 'running') {
    return 'running'
  }

  if (status === 'succeeded') {
    return 'succeeded'
  }

  if (status === 'failed') {
    return 'failed'
  }

  return 'queued'
}

const normalizeIdentifyResult = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {}
  const typeLabel = safeText(source.typeLabel) === '病害' ? '病害' : '昆虫'
  const keywords = toStringList(source.keywords, 16)

  return {
    name: safeText(source.name) || '未确定对象',
    scientificName: safeText(source.scientificName) || 'Unknown species',
    confidence: toConfidence(source.confidence),
    typeLabel,
    keywords: keywords.length > 0 ? keywords : ['待复核'],
    summary: safeText(source.summary) || '建议补充更清晰图像后再次识别。',
    controlTips: toStringList(source.controlTips, 4),
    cover: safeText(source.cover),
    spiritPreview: safeText(source.spiritPreview),
    encyclopediaId: safeText(source.encyclopediaId),
    provider: safeText(source.provider),
    model: safeText(source.model),
  }
}

const buildTopResult = (identify) => {
  const name = safeText(identify?.name) || '未确定对象'
  const confidence = toConfidence(identify?.confidence)
  const typeLabel = safeText(identify?.typeLabel)

  let category = '虫害'
  if (typeLabel === '病害') {
    category = '病害'
  } else if (name.includes('未知') || confidence < 0.35) {
    category = '生理异常'
  }

  return {
    name,
    category,
    confidence,
    evidenceTags: toStringList(identify?.keywords, 8),
  }
}

export function createIdentifyTaskService({
  identifyService,
  onTaskChange,
  taskTtlMs: inputTaskTtlMs,
  maxAttempts: inputMaxAttempts,
  retryBaseDelayMs: inputRetryBaseDelayMs,
  retryMaxDelayMs: inputRetryMaxDelayMs,
} = {}) {
  if (!identifyService || typeof identifyService.identifyImage !== 'function') {
    throw new Error('identifyService.identifyImage is required')
  }

  const tasks = new Map()
  const taskTtlMs = Math.max(1000, toInteger(inputTaskTtlMs, toInteger(process.env.IDENTIFY_TASK_TTL_MS, defaultTaskTtlMs)))
  const queueMaxAttempts = Math.max(
    1,
    Math.min(5, toInteger(inputMaxAttempts, toInteger(process.env.IDENTIFY_QUEUE_MAX_ATTEMPTS, 2) || 2)),
  )
  const queueRetryBaseDelayMs = Math.max(
    20,
    toInteger(inputRetryBaseDelayMs, toInteger(process.env.IDENTIFY_QUEUE_RETRY_BASE_MS, 250) || 250),
  )
  const queueRetryMaxDelayMs = Math.max(
    queueRetryBaseDelayMs,
    toInteger(inputRetryMaxDelayMs, toInteger(process.env.IDENTIFY_QUEUE_RETRY_MAX_MS, 2000) || 2000),
  )

  const removeExpiredTasks = () => {
    const now = Date.now()
    for (const [taskId, task] of tasks.entries()) {
      const updatedAt = Date.parse(task.updatedAt)
      if (Number.isFinite(updatedAt) && now - updatedAt > taskTtlMs) {
        tasks.delete(taskId)
      }
    }
  }

  const notifyTaskChange = (task) => {
    if (typeof onTaskChange !== 'function' || !task) {
      return
    }

    const snapshot = clone(task)
    queueMicrotask(() => {
      Promise.resolve(onTaskChange(snapshot)).catch(() => {
        // Ignore persistence errors and keep identify runtime available.
      })
    })
  }

  const queue = createInMemoryQueue({
    worker: async (payload) => identifyService.identifyImage(payload),
    retryBaseDelayMs: queueRetryBaseDelayMs,
    retryMaxDelayMs: queueRetryMaxDelayMs,
    onJobChange(job) {
      const task = tasks.get(job.id)
      if (!task) {
        return
      }

      task.status = normalizeTaskStatus(job.status)
      task.updatedAt = job.updatedAt || nowIso()
      task.startedAt = job.startedAt || ''
      task.finishedAt = job.finishedAt || ''
      task.durationMs = Number.isFinite(Number(job.durationMs)) ? Number(job.durationMs) : 0
      task.error = safeText(job.error) || safeText(job.failureReason)
      task.failureReason = safeText(job.failureReason)
      task.attempt = Number.isFinite(Number(job.attempt)) ? Number(job.attempt) : 0
      task.maxAttempts = Number.isFinite(Number(job.maxAttempts)) ? Number(job.maxAttempts) : queueMaxAttempts
      task.nextRetryAt = safeText(job.nextRetryAt)

      if (task.status === 'succeeded') {
        task.rawResult = job.result ?? {}
        task.identify = normalizeIdentifyResult(job.result)
        task.topResult = buildTopResult(task.identify)

        const risk = evaluateDiagnosisRisk(task.identify)
        task.riskLevel = risk.riskLevel
        task.sourceRefs = risk.sourceRefs
        task.encyclopediaRefs = task.identify.encyclopediaId ? [task.identify.encyclopediaId] : []
        task.actionCards = buildDiagnosisActionCards({
          taskId: task.id,
          riskLevel: task.riskLevel,
          identifyResult: task.identify,
        })
      }

      if (task.status === 'failed') {
        task.actionCards = []
      }

      notifyTaskChange(task)
    },
  })

  const createTaskRecord = (id, payload) => {
    const timestamp = nowIso()
    return {
      id,
      type: 'diagnosis_identify',
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: '',
      finishedAt: '',
      nextRetryAt: '',
      durationMs: 0,
      attempt: 0,
      maxAttempts: queueMaxAttempts,
      payload: clone(payload),
      rawResult: {},
      identify: {},
      topResult: {},
      riskLevel: 'medium',
      actionCards: [],
      encyclopediaRefs: [],
      sourceRefs: [],
      error: '',
      failureReason: '',
    }
  }

  const getTask = (taskId) => {
    const task = tasks.get(taskId)
    return task ? clone(task) : null
  }

  return {
    createIdentifyTask(payload, options = {}) {
      removeExpiredTasks()
      const id = randomUUID()
      const task = createTaskRecord(id, payload)
      tasks.set(id, task)

      notifyTaskChange(task)

      queueMicrotask(() => {
        const currentTask = tasks.get(id)
        if (!currentTask) {
          return
        }

        currentTask.status = 'queued'
        currentTask.updatedAt = nowIso()
        notifyTaskChange(currentTask)
        queue.enqueue(payload, {
          id,
          maxAttempts: Math.max(1, Math.min(5, Number(options.maxAttempts) || queueMaxAttempts)),
        })
      })

      return clone(task)
    },

    getIdentifyTask(taskId) {
      removeExpiredTasks()
      return getTask(safeText(taskId))
    },

    listIdentifyTasks(limit = 20) {
      removeExpiredTasks()
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20))
      return Array.from(tasks.values())
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, safeLimit)
        .map((task) => clone(task))
    },

    close() {
      queue.close()
    },
  }
}
