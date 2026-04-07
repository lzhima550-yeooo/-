import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { createApp } from '../app'

const startedServers: Array<ReturnType<typeof createServer>> = []

const start = async (service: Record<string, unknown>, appOptions: Record<string, unknown>) => {
  const app = createApp(service, appOptions)
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

describe('chat stream memory contract', () => {
  test('POST /api/chat/stream streams delta and persists conversation session + memory summary', async () => {
    const persistChatConversation = vi.fn(async () => ({
      conversationSessionId: '11111111-1111-4111-8111-111111111111',
      memorySummaryId: '22222222-2222-4222-8222-222222222222',
      rolePackId: 'ladybug-guide',
      rolePackName: '瓢虫学姐',
      memoryHits: 2,
    }))

    const baseUrl = await start(
      {
        checkHealth: async () => ({ ok: true, provider: 'supabase' }),
        persistChatConversation,
      },
      {
        siliconflowService: {
          identifyImage: async () => ({}),
          chat: async () => ({
            reply: 'unused',
            provider: 'siliconflow',
            model: 'test-model',
          }),
          chatStream: async (_payload: Record<string, unknown>, handlers: { onDelta?: (text: string) => void | Promise<void> }) => {
            await handlers.onDelta?.('你好')
            await handlers.onDelta?.('，同学')
            return {
              reply: '你好，同学',
              provider: 'siliconflow',
              model: 'deepseek-ai/DeepSeek-V3',
            }
          },
        },
      },
    )

    const response = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: '今天怎么防治白粉病？',
        orchestration: {
          rolePack: {
            id: 'ladybug-guide',
            name: '瓢虫学姐',
          },
          memoryContext: {
            sessionSummary: '上次建议先隔离病叶。',
            longTermFacts: ['用户反馈温室湿度偏高'],
          },
        },
      }),
    })

    const text = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(text).toContain('"type":"delta"')
    expect(text).toContain('"text":"你好"')
    expect(text).toContain('"type":"done"')
    expect(text).toContain('"conversationSessionId":"11111111-1111-4111-8111-111111111111"')
    expect(text).toContain('"memorySummaryId":"22222222-2222-4222-8222-222222222222"')
    expect(text).toContain('"memoryHits":2')
    expect(text).toContain('[DONE]')
    expect(persistChatConversation).toHaveBeenCalledTimes(1)
  })

  test('POST /api/spirit/chat/stream remains compatible', async () => {
    const baseUrl = await start(
      {
        checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      },
      {
        siliconflowService: {
          identifyImage: async () => ({}),
          chat: async () => ({
            reply: 'unused',
            provider: 'siliconflow',
            model: 'test-model',
          }),
          chatStream: async (_payload: Record<string, unknown>, handlers: { onDelta?: (text: string) => void | Promise<void> }) => {
            await handlers.onDelta?.('兼容')
            return {
              reply: '兼容',
              provider: 'siliconflow',
              model: 'deepseek-ai/DeepSeek-V3',
            }
          },
        },
      },
    )

    const response = await fetch(`${baseUrl}/api/spirit/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: '兼容路由是否保留？',
      }),
    })

    const text = await response.text()

    expect(response.status).toBe(200)
    expect(text).toContain('"type":"delta"')
    expect(text).toContain('[DONE]')
  })
})

