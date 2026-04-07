const nowIso = () => new Date().toISOString()

const safeErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error ?? 'unknown error')
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const normalizeDelay = (value, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) {
    return fallback
  }

  return Math.floor(number)
}

export function createInMemoryQueue({
  worker,
  onJobChange,
  concurrency = 1,
  retryBaseDelayMs = 250,
  retryMaxDelayMs = 5000,
} = {}) {
  if (typeof worker !== 'function') {
    throw new Error('worker is required')
  }

  const maxConcurrency = Math.max(1, Math.min(16, Number(concurrency) || 1))
  const baseDelayMs = normalizeDelay(retryBaseDelayMs, 250)
  const maxDelayMs = Math.max(baseDelayMs, normalizeDelay(retryMaxDelayMs, 5000))

  const jobs = new Map()
  const waitingJobIds = []
  const retryTimers = new Map()
  let activeWorkers = 0

  const notify = (job) => {
    if (!job || typeof onJobChange !== 'function') {
      return
    }

    const snapshot = clone(job)
    queueMicrotask(() => {
      Promise.resolve(onJobChange(snapshot)).catch(() => {
        // Ignore observer failures to keep queue loop stable.
      })
    })
  }

  const removeWaiting = (jobId) => {
    const index = waitingJobIds.indexOf(jobId)
    if (index >= 0) {
      waitingJobIds.splice(index, 1)
    }
  }

  const markQueued = (job, reason) => {
    removeWaiting(job.id)
    waitingJobIds.push(job.id)
    job.status = 'queued'
    job.queueReason = reason
    job.updatedAt = nowIso()
    notify(job)
  }

  const computeRetryDelayMs = (attempt) => {
    const scaled = baseDelayMs * 2 ** Math.max(0, attempt - 1)
    return Math.min(maxDelayMs, scaled)
  }

  const finalizeFailure = (job, error) => {
    job.status = 'failed'
    job.error = safeErrorMessage(error)
    job.failureReason = job.error
    job.finishedAt = nowIso()
    job.updatedAt = nowIso()
    job.durationMs = Math.max(0, Date.parse(job.finishedAt) - Date.parse(job.startedAt || job.createdAt))
    notify(job)
  }

  const runDrain = () => {
    while (activeWorkers < maxConcurrency && waitingJobIds.length > 0) {
      const nextJobId = waitingJobIds.shift()
      const job = nextJobId ? jobs.get(nextJobId) : null
      if (!job || job.status !== 'queued') {
        continue
      }

      activeWorkers += 1
      job.status = 'running'
      job.queueReason = ''
      job.startedAt = nowIso()
      job.updatedAt = nowIso()
      job.attempt = Math.max(1, Number(job.attempt) + 1)
      notify(job)

      void Promise.resolve()
        .then(async () => {
          const result = await worker(clone(job.payload), clone(job))
          job.result = result
          job.error = ''
          job.failureReason = ''
          job.status = 'succeeded'
          job.finishedAt = nowIso()
          job.updatedAt = nowIso()
          job.durationMs = Math.max(0, Date.parse(job.finishedAt) - Date.parse(job.startedAt || job.createdAt))
          notify(job)
        })
        .catch((error) => {
          job.error = safeErrorMessage(error)
          job.failureReason = job.error
          job.updatedAt = nowIso()

          if (job.attempt < job.maxAttempts) {
            const delayMs = computeRetryDelayMs(job.attempt)
            job.nextRetryAt = new Date(Date.now() + delayMs).toISOString()
            job.status = 'retrying'
            notify(job)
            const timer = setTimeout(() => {
              retryTimers.delete(job.id)
              job.nextRetryAt = ''
              markQueued(job, 'retry')
              runDrain()
            }, delayMs)
            retryTimers.set(job.id, timer)
            return
          }

          finalizeFailure(job, error)
        })
        .finally(() => {
          activeWorkers = Math.max(0, activeWorkers - 1)
          runDrain()
        })
    }
  }

  return {
    enqueue(payload, options = {}) {
      const id = String(options.id ?? '')
      if (!id) {
        throw new Error('job id is required')
      }

      const existing = jobs.get(id)
      if (existing) {
        return clone(existing)
      }

      const timestamp = nowIso()
      const maxAttempts = Math.max(1, Math.min(6, Number(options.maxAttempts) || 2))
      const job = {
        id,
        status: 'queued',
        queueReason: 'new',
        createdAt: timestamp,
        updatedAt: timestamp,
        startedAt: '',
        finishedAt: '',
        nextRetryAt: '',
        attempt: 0,
        maxAttempts,
        durationMs: null,
        payload: clone(payload),
        result: null,
        error: '',
        failureReason: '',
      }

      jobs.set(id, job)
      markQueued(job, 'new')
      runDrain()

      return clone(job)
    },

    getJob(jobId) {
      const job = jobs.get(String(jobId))
      return job ? clone(job) : null
    },

    listJobs(limit = 20) {
      const safeLimit = Math.max(1, Math.min(500, Number(limit) || 20))
      return Array.from(jobs.values())
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, safeLimit)
        .map((job) => clone(job))
    },

    close() {
      retryTimers.forEach((timer) => {
        clearTimeout(timer)
      })
      retryTimers.clear()
    },
  }
}

