import { afterEach, describe, expect, test } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp } from '../app'

type ApiServiceMock = {
  checkHealth: () => Promise<{ ok: boolean; provider: string }>
  listEncyclopedia: (query?: string) => Promise<unknown[]>
  listCommunityPosts: (query?: string) => Promise<unknown[]>
  createCommunityPost: (payload: { title: string; content: string }) => Promise<{ id: string }>
  createCommunityReply: (postId: string, payload: { content: string }) => Promise<{ id: string }>
  searchEncyclopedia?: (input: {
    q?: string
    type?: string
    risk?: string
    category?: string
    limit?: number
  }) => Promise<unknown[]>
  getEncyclopediaDetail?: (id: string) => Promise<unknown | null>
}

const startedServers: Array<ReturnType<typeof createServer>> = []

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
      identifyImage: async () => ({}),
      chat: async () => ({}),
      chatStream: async (_payload: unknown, handlers: { onDone?: (payload: Record<string, unknown>) => void | Promise<void> }) => {
        if (typeof handlers?.onDone === 'function') {
          await handlers.onDone({ reply: '', provider: 'mock', model: 'mock' })
        }
        return { reply: '', provider: 'mock', model: 'mock' }
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

describe('encyclopedia evidence api contract', () => {
  test('GET /api/encyclopedia/search supports structured filters', async () => {
    let capturedInput: {
      q?: string
      type?: string
      risk?: string
      category?: string
      limit?: number
    } | null = null

    const service: ApiServiceMock = {
      ...createServiceMock(),
      searchEncyclopedia: async (input) => {
        capturedInput = input
        return [
          {
            id: 'enc-powdery',
            name: '白粉病',
            type: 'disease',
            risk: '高',
          },
        ]
      },
    }

    const baseUrl = await start(service)
    const res = await fetch(
      `${baseUrl}/api/encyclopedia/search?q=%E7%99%BD%E7%B2%89&type=disease&risk=high&category=%E7%9C%9F%E8%8F%8C&limit=5`,
    )

    const body = (await res.json()) as { items: Array<{ id: string; name: string }> }

    expect(res.status).toBe(200)
    expect(capturedInput?.q).toBe('白粉')
    expect(capturedInput?.type).toBe('disease')
    expect(capturedInput?.risk).toBe('high')
    expect(capturedInput?.category).toBe('真菌')
    expect(capturedInput?.limit).toBe(5)
    expect(body.items[0]?.id).toBe('enc-powdery')
  })

  test('GET /api/encyclopedia/:id returns detail with source index and treatment template', async () => {
    const service: ApiServiceMock = {
      ...createServiceMock(),
      getEncyclopediaDetail: async (id) => ({
        id,
        entry: {
          id,
          name: '白粉病',
          risk: '高',
        },
        sourceIndex: [
          {
            id: 'src-1',
            sourceType: 'reference',
            title: '农业教材',
            confidenceLabel: '高',
          },
        ],
        treatmentTemplate: {
          entryId: id,
          immediateActions: ['隔离病叶'],
          environmentAdjustments: ['降低湿度'],
          followUpSchedule: ['48 小时复查'],
          cautionNotes: ['避免过量用药'],
        },
        relatedEntries: [
          {
            id: 'enc-downy',
            name: '霜霉病',
            risk: '高',
          },
        ],
      }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/encyclopedia/enc-powdery`)
    const body = (await res.json()) as {
      data: {
        sourceIndex: Array<{ id: string; title: string }>
        treatmentTemplate: { immediateActions: string[] }
        relatedEntries: Array<{ id: string }>
      }
    }

    expect(res.status).toBe(200)
    expect(body.data.sourceIndex[0]?.id).toBe('src-1')
    expect(body.data.treatmentTemplate.immediateActions[0]).toContain('隔离')
    expect(body.data.relatedEntries[0]?.id).toBe('enc-downy')
  })

  test('GET /api/encyclopedia/:id returns 404 when detail not found', async () => {
    const service: ApiServiceMock = {
      ...createServiceMock(),
      getEncyclopediaDetail: async () => null,
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/encyclopedia/not-found`)
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(404)
    expect(body.error).toContain('encyclopedia entry not found')
  })
})
