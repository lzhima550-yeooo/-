import { randomUUID } from 'node:crypto'
import { createInMemoryQueue } from './queue.js'

const defaultTaskTtlMs = 1000 * 60 * 60
const defaultIdempotencyTtlMs = 1000 * 60 * 30

const clone = (value) => JSON.parse(JSON.stringify(value))
const nowIso = () => new Date().toISOString()

const toInteger = (value, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.max(0, Math.floor(number))
}

const normalizeTaskStatus = (status) => {
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

const normalizeIdempotencyKey = (value) => {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }

  return text.slice(0, 128)
}

export function createSpiritTaskService({
  spiritService,
  onTaskChange,
  taskTtlMs: inputTaskTtlMs,
  idempotencyTtlMs: inputIdempotencyTtlMs,
  maxAttempts: inputMaxAttempts,
  retryBaseDelayMs: inputRetryBaseDelayMs,
  retryMaxDelayMs: inputRetryMaxDelayMs,
} = {}) {
  if (!spiritService || typeof spiritService.generateSpiritPortrait !== 'function') {
    throw new Error('spiritService.generateSpiritPortrait is required')
  }

  const tasks = new Map()
  const idempotency = new Map()
  const taskTtlMs = Math.max(1000, toInteger(inputTaskTtlMs, toInteger(process.env.SPIRIT_TASK_TTL_MS, defaultTaskTtlMs)))
  const idempotencyTtlMs = Math.max(
    1000,
    toInteger(inputIdempotencyTtlMs, toInteger(process.env.SPIRIT_IDEMPOTENCY_TTL_MS, defaultIdempotencyTtlMs)),
  )
  const queueMaxAttempts = Math.max(
    1,
    Math.min(6, toInteger(inputMaxAttempts, toInteger(process.env.SPIRIT_QUEUE_MAX_ATTEMPTS, 2) || 2)),
  )
  const queueRetryBaseDelayMs = Math.max(
    20,
    toInteger(inputRetryBaseDelayMs, toInteger(process.env.SPIRIT_QUEUE_RETRY_BASE_MS, 250) || 250),
  )
  const queueRetryMaxDelayMs = Math.max(
    queueRetryBaseDelayMs,
    toInteger(inputRetryMaxDelayMs, toInteger(process.env.SPIRIT_QUEUE_RETRY_MAX_MS, 2000) || 2000),
  )

  const removeExpiredTasks = () => {
    const now = Date.now()
    for (const [taskId, task] of tasks.entries()) {
      const updatedAt = Date.parse(task.updatedAt)
      if (Number.isFinite(updatedAt) && now - updatedAt > taskTtlMs) {
        tasks.delete(taskId)
      }
    }

    for (const [key, record] of idempotency.entries()) {
      if (now - record.createdAtMs > idempotencyTtlMs) {
        idempotency.delete(key)
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
        // Ignore persistence errors to avoid breaking the runtime generation chain.
      })
    })
  }

  const queue = createInMemoryQueue({
    worker: async (payload) => spiritService.generateSpiritPortrait(payload),
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
      task.durationMs = Number.isFinite(Number(job.durationMs)) ? Number(job.durationMs) : null
      task.result = job.result ?? null
      task.error = String(job.error ?? '').trim()
      task.failureReason = String(job.failureReason ?? '').trim()
      task.attempt = Number.isFinite(Number(job.attempt)) ? Number(job.attempt) : 0
      task.maxAttempts = Number.isFinite(Number(job.maxAttempts)) ? Number(job.maxAttempts) : queueMaxAttempts
      task.nextRetryAt = String(job.nextRetryAt ?? '').trim()
      notifyTaskChange(task)
    },
  })

  const getReusableTaskByIdempotency = (idempotencyKey) => {
    if (!idempotencyKey) {
      return null
    }

    const record = idempotency.get(idempotencyKey)
    if (!record) {
      return null
    }

    const task = tasks.get(record.taskId)
    if (!task) {
      idempotency.delete(idempotencyKey)
      return null
    }

    return task
  }

  const createTaskRecord = (id, payload, idempotencyKey) => {
    const timestamp = nowIso()
    return {
      id,
      type: 'spirit_generation',
      status: 'queued',
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: '',
      finishedAt: '',
      nextRetryAt: '',
      durationMs: null,
      attempt: 0,
      maxAttempts: queueMaxAttempts,
      idempotencyKey,
      payload: clone(payload),
      result: null,
      error: '',
      failureReason: '',
    }
  }

  const getGenerationTask = (taskId) => {
    const task = tasks.get(taskId)
    return task ? clone(task) : null
  }

  return {
    createGenerationTask(payload, options = {}) {
      removeExpiredTasks()

      const idempotencyKey = normalizeIdempotencyKey(options.idempotencyKey)
      const reusableTask = getReusableTaskByIdempotency(idempotencyKey)
      if (reusableTask) {
        return clone(reusableTask)
      }

      const id = randomUUID()
      const task = createTaskRecord(id, payload, idempotencyKey)

      tasks.set(id, task)
      if (idempotencyKey) {
        idempotency.set(idempotencyKey, {
          taskId: id,
          createdAtMs: Date.now(),
        })
      }

      queue.enqueue(payload, {
        id,
        maxAttempts: Math.max(1, Math.min(6, Number(options.maxAttempts) || queueMaxAttempts)),
      })

      return clone(task)
    },

    getGenerationTask(taskId) {
      removeExpiredTasks()
      return getGenerationTask(String(taskId))
    },

    listGenerationTasks(limit = 20) {
      removeExpiredTasks()

      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20))
      return Array.from(tasks.values())
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, safeLimit)
        .map((task) => clone(task))
    },

    getGenerationStats() {
      removeExpiredTasks()

      const allTasks = Array.from(tasks.values())
      const counts = {
        totalTasks: allTasks.length,
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
      }

      allTasks.forEach((task) => {
        if (task.status === 'queued') {
          counts.queued += 1
          return
        }

        if (task.status === 'running') {
          counts.running += 1
          return
        }

        if (task.status === 'succeeded') {
          counts.succeeded += 1
          return
        }

        if (task.status === 'failed') {
          counts.failed += 1
        }
      })

      const completed = counts.succeeded + counts.failed
      const durationSource = allTasks
        .map((task) => Number(task.durationMs))
        .filter((value) => Number.isFinite(value) && value >= 0)
      const durationTotal = durationSource.reduce((acc, value) => acc + value, 0)
      const averageDurationMs = durationSource.length > 0 ? Math.round(durationTotal / durationSource.length) : 0

      const lastUpdatedTask = allTasks
        .slice()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]

      return {
        ...counts,
        completed,
        successRate: completed > 0 ? Number((counts.succeeded / completed).toFixed(4)) : 0,
        averageDurationMs,
        lastTaskUpdatedAt: lastUpdatedTask?.updatedAt ?? '',
      }
    },

    close() {
      queue.close()
    },
  }
}
