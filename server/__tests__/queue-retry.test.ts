import { afterEach, describe, expect, test } from 'vitest'
import { createInMemoryQueue } from '../lib/queue'
import { createSpiritTaskService } from '../lib/spiritTaskService'

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })

const waitFor = async (matcher: () => boolean, timeoutMs = 2500, intervalMs = 20) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (matcher()) {
      return
    }
    await wait(intervalMs)
  }
  throw new Error('waitFor timeout')
}

const closers: Array<() => void> = []

afterEach(() => {
  while (closers.length > 0) {
    const close = closers.pop()
    close?.()
  }
})

describe('queue and retry reliability', () => {
  test('in-memory queue retries failed job and eventually succeeds', async () => {
    let calls = 0
    const transitions: string[] = []

    const queue = createInMemoryQueue({
      retryBaseDelayMs: 15,
      retryMaxDelayMs: 15,
      worker: async () => {
        calls += 1
        if (calls === 1) {
          throw new Error('first attempt failed')
        }

        return {
          ok: true,
        }
      },
      onJobChange(job) {
        transitions.push(String(job.status))
      },
    })
    closers.push(() => queue.close())

    queue.enqueue({ foo: 'bar' }, { id: 'job-1', maxAttempts: 2 })

    await waitFor(() => queue.getJob('job-1')?.status === 'succeeded')

    const finalJob = queue.getJob('job-1')
    expect(finalJob?.status).toBe('succeeded')
    expect(finalJob?.attempt).toBe(2)
    expect(calls).toBe(2)
    expect(transitions.includes('retrying')).toBe(true)
  })

  test('spirit task service reuses task by idempotency key and keeps single execution chain', async () => {
    let calls = 0
    const spiritService = {
      generateSpiritPortrait: async () => {
        calls += 1
        if (calls === 1) {
          throw new Error('transient error')
        }
        return {
          promptId: 'prompt-ok',
          imageUrl: 'https://example.com/success.png',
        }
      },
    }

    const taskService = createSpiritTaskService({
      spiritService,
      maxAttempts: 2,
      retryBaseDelayMs: 15,
      retryMaxDelayMs: 15,
    })
    closers.push(() => taskService.close())

    const first = taskService.createGenerationTask({ name: 'ladybug' }, { idempotencyKey: 'same-key' })
    const second = taskService.createGenerationTask({ name: 'ladybug' }, { idempotencyKey: 'same-key' })

    expect(second.id).toBe(first.id)

    await waitFor(() => taskService.getGenerationTask(first.id)?.status === 'succeeded')

    const finalTask = taskService.getGenerationTask(first.id)
    expect(finalTask?.status).toBe('succeeded')
    expect(finalTask?.attempt).toBe(2)
    expect(calls).toBe(2)
  })

  test('spirit task service marks failed after max retry attempts', async () => {
    const spiritService = {
      generateSpiritPortrait: async () => {
        throw new Error('permanent failure')
      },
    }

    const taskService = createSpiritTaskService({
      spiritService,
      maxAttempts: 2,
      retryBaseDelayMs: 15,
      retryMaxDelayMs: 15,
    })
    closers.push(() => taskService.close())

    const task = taskService.createGenerationTask({ name: 'aphid' }, { idempotencyKey: 'failure-key' })

    await waitFor(() => taskService.getGenerationTask(task.id)?.status === 'failed')

    const finalTask = taskService.getGenerationTask(task.id)
    expect(finalTask?.status).toBe('failed')
    expect(finalTask?.attempt).toBe(2)
    expect(finalTask?.failureReason).toContain('permanent failure')
  })
})

