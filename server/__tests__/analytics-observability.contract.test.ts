import { afterEach, describe, expect, test, vi } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app'

type ApiServiceMock = {
  checkHealth: () => Promise<{ ok: boolean; provider: string }>
  listEncyclopedia: (query?: string) => Promise<unknown[]>
  listCommunityPosts: (query?: string) => Promise<unknown[]>
  createCommunityPost: (payload: { title: string; content: string }) => Promise<{ id: string }>
  createCommunityReply: (postId: string, payload: { content: string }) => Promise<{ id: string }>
  getAnalyticsEventSummary?: (input: { days?: number; limit?: number; source?: string; eventName?: string }) => Promise<unknown>
  listAnalyticsEvents?: (input: { days?: number; limit?: number; source?: string; eventName?: string }) => Promise<unknown[]>
  listTaskLogs?: (input: {
    limit?: number
    offset?: number
    taskType?: string
    status?: string
    taskId?: string
  }) => Promise<unknown[]>
  appendAnalyticsEvent?: (payload: Record<string, unknown>) => Promise<unknown>
}

const startedServers: Array<ReturnType<typeof createServer>> = []

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })

const createServiceMock = (): ApiServiceMock => ({
  checkHealth: async () => ({ ok: true, provider: 'supabase' }),
  listEncyclopedia: async () => [],
  listCommunityPosts: async () => [],
  createCommunityPost: async () => ({ id: 'post-1' }),
  createCommunityReply: async () => ({ id: 'reply-1' }),
})

const start = async (service: ApiServiceMock) => {
  const app = createApp(service as never, {
    siliconflowService: {
      identifyImage: async () => ({
        name: '测试对象',
        confidence: 0.9,
        typeLabel: '病害',
        keywords: ['测试'],
      }),
      chat: async () => ({ reply: 'ok', provider: 'mock', model: 'mock' }),
      chatStream: async (_payload: unknown, handlers: { onDelta?: (text: string) => void | Promise<void> }) => {
        await handlers.onDelta?.('ok')
        return { reply: 'ok', provider: 'mock', model: 'mock' }
      },
    },
  })

  const server = createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  startedServers.push(server)
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(
    startedServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
        }),
    ),
  )
})

describe('analytics observability api contract', () => {
  test('GET /api/analytics/events/summary forwards query filters', async () => {
    let captured: { days?: number; limit?: number; source?: string; eventName?: string } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      getAnalyticsEventSummary: async (input) => {
        captured = input
        return {
          days: 7,
          total: 12,
          byName: [{ name: 'identify_submit', count: 5 }],
          bySource: [{ source: 'api', count: 12 }],
        }
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/analytics/events/summary?days=7&limit=100&source=api&eventName=identify_submit`)
    const body = (await res.json()) as {
      data: {
        total: number
        byName: Array<{ name: string; count: number }>
      }
    }

    expect(res.status).toBe(200)
    expect(captured?.days).toBe(7)
    expect(captured?.limit).toBe(100)
    expect(captured?.source).toBe('api')
    expect(captured?.eventName).toBe('identify_submit')
    expect(body.data.total).toBe(12)
    expect(body.data.byName[0]?.name).toBe('identify_submit')
  })

  test('GET /api/analytics/task-logs supports filters', async () => {
    let captured: { limit?: number; offset?: number; taskType?: string; status?: string; taskId?: string } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      listTaskLogs: async (input) => {
        captured = input
        return [
          {
            id: 'log-1',
            taskType: 'diagnosis_identify',
            taskId: 'task-1',
            status: 'succeeded',
          },
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(
      `${baseUrl}/api/analytics/task-logs?limit=20&taskType=diagnosis_identify&status=succeeded&taskId=task-1`,
    )
    const body = (await res.json()) as { items: Array<{ id: string; taskType: string }> }

    expect(res.status).toBe(200)
    expect(captured?.limit).toBe(21)
    expect(captured?.offset).toBe(0)
    expect(captured?.taskType).toBe('diagnosis_identify')
    expect(captured?.status).toBe('succeeded')
    expect(captured?.taskId).toBe('task-1')
    expect(body.items[0]?.id).toBe('log-1')
  })

  test('GET /api/analytics/task-logs returns pagination metadata', async () => {
    let captured: { limit?: number; offset?: number; taskType?: string; status?: string; taskId?: string } | null = null
    const service: ApiServiceMock = {
      ...createServiceMock(),
      listTaskLogs: async (input) => {
        captured = input
        return [
          {
            id: 'log-41',
            taskType: 'diagnosis_identify',
            taskId: 'task-41',
            status: 'running',
          },
          {
            id: 'log-42',
            taskType: 'diagnosis_identify',
            taskId: 'task-42',
            status: 'running',
          },
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/analytics/task-logs?limit=1&offset=40`)
    const body = (await res.json()) as {
      items: Array<{ id: string }>
      page?: {
        limit: number
        offset: number
        hasMore: boolean
        nextOffset: number | null
      }
    }

    expect(res.status).toBe(200)
    expect(captured?.limit).toBe(2)
    expect(captured?.offset).toBe(40)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.id).toBe('log-41')
    expect(body.page?.limit).toBe(1)
    expect(body.page?.offset).toBe(40)
    expect(body.page?.hasMore).toBe(true)
    expect(body.page?.nextOffset).toBe(41)
  })

  test('GET /api/analytics/export returns snapshot with observability dimensions', async () => {
    let summaryCaptured: { days?: number; limit?: number; source?: string; eventName?: string } | null = null
    let eventsCaptured: { days?: number; limit?: number; source?: string; eventName?: string } | null = null
    let logsCaptured: { limit?: number; offset?: number; taskType?: string; status?: string; taskId?: string } | null = null

    const service: ApiServiceMock = {
      ...createServiceMock(),
      getAnalyticsEventSummary: async (input) => {
        summaryCaptured = input
        return {
          days: 7,
          total: 2,
          byName: [{ name: 'chat_stream_done', count: 2 }],
          bySource: [{ source: 'api', count: 2 }],
        }
      },
      listAnalyticsEvents: async (input) => {
        eventsCaptured = input
        return [
          {
            id: 'evt-1',
            eventName: 'chat_stream_done',
            eventSource: 'api',
            payload: {
              channel: 'chat',
              taskType: 'spirit_chat',
              status: 'done',
              provider: 'siliconflow',
              model: 'Qwen/Qwen2.5-7B-Instruct',
              latencyMs: 920,
            },
          },
        ]
      },
      listTaskLogs: async (input) => {
        logsCaptured = input
        return [
          {
            id: 'log-1',
            taskType: 'diagnosis_identify',
            taskId: 'task-1',
            status: 'failed',
          },
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(
      `${baseUrl}/api/analytics/export?days=7&limit=100&source=api&eventName=chat_stream_done&taskType=diagnosis_identify&status=failed&taskLimit=10&taskOffset=20`,
    )
    const body = (await res.json()) as {
      data?: {
        eventsSummary?: {
          total: number
        }
        taskLogs?: {
          items: Array<{ id: string }>
          page?: {
            limit: number
            offset: number
          }
        }
        observability?: {
          channels?: Array<{ channel: string; count: number }>
          providers?: Array<{ provider: string; count: number }>
        }
      }
    }

    expect(res.status).toBe(200)
    expect(summaryCaptured?.days).toBe(7)
    expect(summaryCaptured?.limit).toBe(100)
    expect(summaryCaptured?.source).toBe('api')
    expect(summaryCaptured?.eventName).toBe('chat_stream_done')
    expect(eventsCaptured?.limit).toBe(100)
    expect(logsCaptured?.limit).toBe(11)
    expect(logsCaptured?.offset).toBe(20)
    expect(logsCaptured?.taskType).toBe('diagnosis_identify')
    expect(logsCaptured?.status).toBe('failed')
    expect(body.data?.eventsSummary?.total).toBe(2)
    expect(body.data?.taskLogs?.items[0]?.id).toBe('log-1')
    expect(body.data?.taskLogs?.page?.limit).toBe(10)
    expect(body.data?.taskLogs?.page?.offset).toBe(20)
    expect(body.data?.observability?.channels?.[0]?.channel).toBe('chat')
    expect(body.data?.observability?.providers?.[0]?.provider).toBe('siliconflow')
  })

  test('POST /api/community/posts emits analytics event', async () => {
    const appendAnalyticsEvent = vi.fn(async () => ({ id: 'evt-1' }))
    const service: ApiServiceMock = {
      ...createServiceMock(),
      appendAnalyticsEvent,
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trace-Id': 'trace-analytics-001',
      },
      body: JSON.stringify({
        title: '联调事件采集',
        content: '用于验证 analytics event 采集',
      }),
    })

    expect(res.status).toBe(201)
    await wait(15)
    expect(appendAnalyticsEvent).toHaveBeenCalled()
    const firstCall = appendAnalyticsEvent.mock.calls[0]?.[0] as Record<string, unknown>
    expect(String(firstCall?.eventName ?? '')).toBe('community_post_publish')
    expect(String(firstCall?.traceId ?? '')).toBe('trace-analytics-001')
  })

  test('POST /api/identify/tasks emits unified observability dimensions', async () => {
    const appendAnalyticsEvent = vi.fn(async () => ({ id: 'evt-identify-1' }))
    const service: ApiServiceMock = {
      ...createServiceMock(),
      appendAnalyticsEvent,
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/identify/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: 'https://example.com/leaf.jpg',
        prompt: '识别并评估风险',
      }),
    })

    expect(res.status).toBe(202)
    await wait(15)
    expect(appendAnalyticsEvent).toHaveBeenCalled()
    const firstCall = appendAnalyticsEvent.mock.calls[0]?.[0] as Record<string, unknown>
    const payload = (firstCall?.payload ?? {}) as Record<string, unknown>
    expect(String(firstCall?.eventName ?? '')).toBe('identify_submit')
    expect(String(payload.channel ?? '')).toBe('identify')
    expect(String(payload.taskType ?? '')).toBe('diagnosis_identify')
    expect(String(payload.status ?? '')).toBe('submitted')
  })
})
