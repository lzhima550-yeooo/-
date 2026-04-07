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
}

const startedServers: Array<ReturnType<typeof createServer>> = []

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const createServiceMock = (): ApiServiceMock => ({
  checkHealth: async () => ({ ok: true, provider: 'supabase' }),
  listEncyclopedia: async () => [],
  listCommunityPosts: async () => [],
  createCommunityPost: async () => ({ id: 'post-1' }),
  createCommunityReply: async () => ({ id: 'reply-1' }),
})

const start = async (service: ApiServiceMock, appOptions: Record<string, unknown> = {}) => {
  const overrideSiliconflow =
    appOptions.siliconflowService && typeof appOptions.siliconflowService === 'object'
      ? (appOptions.siliconflowService as Record<string, unknown>)
      : {}

  const app = createApp(service, {
    siliconflowService: {
      identifyImage: async () => ({
        name: '棉蚜',
        scientificName: 'Aphis gossypii',
        confidence: 0.91,
        typeLabel: '病害',
        keywords: ['叶片黄化', '扩散'],
        summary: '测试识别结果',
        controlTips: ['先隔离'],
        encyclopediaId: 'enc-aphid',
        cover: 'https://example.com/aphid.jpg',
        spiritPreview: 'https://example.com/aphid-spirit.jpg',
        provider: 'siliconflow',
        model: 'vision-test',
      }),
      chat: async () => ({ reply: 'unused', provider: 'siliconflow', model: 'chat-test' }),
      chatStream: async (_payload: unknown, handlers: { onDone?: (payload: Record<string, unknown>) => void | Promise<void> }) => {
        const donePayload = { reply: 'unused', provider: 'siliconflow', model: 'chat-test' }
        if (typeof handlers?.onDone === 'function') {
          await handlers.onDone(donePayload)
        }
        return donePayload
      },
      ...overrideSiliconflow,
    },
    ...appOptions,
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

describe('identify task api contract', () => {
  test('POST /api/identify/tasks returns pending task with id', async () => {
    const baseUrl = await start(createServiceMock())
    const res = await fetch(`${baseUrl}/api/identify/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: 'data:image/png;base64,AAAA',
      }),
    })

    const body = (await res.json()) as { data: { id: string; status: string; type: string } }

    expect(res.status).toBe(202)
    expect(body.data.id).toBeTruthy()
    expect(body.data.type).toBe('diagnosis_identify')
    expect(['pending', 'queued', 'running', 'succeeded']).toContain(body.data.status)
  })

  test('POST /api/identify/tasks validates image field', async () => {
    const baseUrl = await start(createServiceMock())
    const res = await fetch(`${baseUrl}/api/identify/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: '',
      }),
    })

    const body = (await res.json()) as { error: string }
    expect(res.status).toBe(400)
    expect(body.error).toContain('image')
  })

  test('GET /api/identify/tasks/:id returns 404 when task does not exist', async () => {
    const baseUrl = await start(createServiceMock())
    const res = await fetch(`${baseUrl}/api/identify/tasks/not-found-task`)
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(404)
    expect(body.error).toContain('identify task not found')
  })

  test('GET /api/identify/tasks/:id returns task with topResult, riskLevel and actionCards', async () => {
    const baseUrl = await start(createServiceMock(), {
      siliconflowService: {
        identifyImage: async () => {
          await wait(30)
          return {
            name: '白粉病',
            scientificName: 'Powdery mildew',
            confidence: 0.94,
            typeLabel: '病害',
            keywords: ['白色霉层', '蔓延'],
            summary: '疑似白粉病',
            controlTips: ['先隔离', '降低湿度'],
            encyclopediaId: 'enc-powdery',
            cover: 'https://example.com/powdery.jpg',
            spiritPreview: 'https://example.com/powdery-spirit.jpg',
            provider: 'siliconflow',
            model: 'vision-test',
          }
        },
      },
    })

    const createRes = await fetch(`${baseUrl}/api/identify/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: 'data:image/png;base64,AAAA',
      }),
    })
    const createBody = (await createRes.json()) as { data: { id: string } }
    const taskId = createBody.data.id

    let finalBody: {
      data: {
        status: string
        topResult: { name: string; category: string; confidence: number }
        riskLevel: string
        actionCards: Array<{ id: string; type: string; title: string }>
      }
    } | null = null

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const detailRes = await fetch(`${baseUrl}/api/identify/tasks/${encodeURIComponent(taskId)}`)
      const detailBody = (await detailRes.json()) as {
        data: {
          status: string
          topResult: { name: string; category: string; confidence: number }
          riskLevel: string
          actionCards: Array<{ id: string; type: string; title: string }>
        }
      }

      expect(detailRes.status).toBe(200)
      if (detailBody.data.status === 'succeeded') {
        finalBody = detailBody
        break
      }

      await wait(20)
    }

    expect(finalBody?.data.status).toBe('succeeded')
    expect(finalBody?.data.topResult.name).toBe('白粉病')
    expect(finalBody?.data.topResult.category).toBe('病害')
    expect(finalBody?.data.topResult.confidence).toBeGreaterThan(0.8)
    expect(['high', 'critical']).toContain(finalBody?.data.riskLevel)
    expect((finalBody?.data.actionCards ?? []).length).toBeGreaterThanOrEqual(3)
  })
})
