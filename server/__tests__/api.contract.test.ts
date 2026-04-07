import { afterEach, describe, expect, test } from 'vitest'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { createApp } from '../app'

type ApiServiceMock = {
  checkHealth: () => Promise<{ ok: boolean; provider: string }>
  listEncyclopedia: (query?: string) => Promise<unknown[]>
  listCommunityPosts: (query?: string) => Promise<unknown[]>
  getHomeFeed?: () => Promise<{
    alerts: Array<{ id: string; name: string; risk: string }>
    picks: Array<{ id: string; title: string }>
    reminders: Array<{ id: string; title: string; type: string }>
    generatedAt: string
  }>
  getMeStats?: (input: {
    account?: string
    profileName?: string
    favoriteCount?: number
    identifyCount?: number
  }) => Promise<{
    publish: number
    answer: number
    favorite: number
    identify: number
    eventSummary: Array<{ name: string; count: number }>
    generatedAt: string
  }>
  createCommunityPost: (payload: { title: string; content: string; image?: string; markdown?: string; mentions?: string[]; topics?: string[] }) => Promise<{ id: string }>
  createCommunityReply: (
    postId: string,
    payload: { content: string; image?: string; role?: 'answer' | 'followup'; replyToFloor?: number; markdown?: string; annotations?: Array<{ x: number; y: number }> },
  ) => Promise<{ id: string }>
}

type SpiritServiceMock = {
  getRuntimeStatus: () => Promise<Record<string, unknown>>
  generateSpiritPortrait: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  validateWorkflowProfile?: (input: { workflowPath: string }) => Promise<Record<string, unknown>>
}

type SiliconflowServiceMock = {
  identifyImage: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  chat: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>
  chatStream: (
    payload: Record<string, unknown>,
    handlers: {
      onDelta?: (deltaText: string) => void | Promise<void>
      onDone?: (donePayload: Record<string, unknown>) => void | Promise<void>
    },
  ) => Promise<Record<string, unknown>>
}

const startedServers: Array<ReturnType<typeof createServer>> = []

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })

const createDefaultSpiritService = (): SpiritServiceMock => ({
  getRuntimeStatus: async () => ({
    ready: true,
    comfyuiOnline: true,
    checkpointCount: 1,
    checkpointNames: ['demo.safetensors'],
    workflowModeCandidate: 'workflow',
    workflowReason: '',
  }),
  generateSpiritPortrait: async () => ({
    promptId: 'prompt-demo',
    imageUrl: 'http://127.0.0.1:8188/view?filename=demo.png&type=output',
  }),
})

const createDefaultSiliconflowService = (): SiliconflowServiceMock => ({
  identifyImage: async () => ({
    name: '瓢虫',
    scientificName: 'Coccinella septempunctata',
    confidence: 0.97,
    typeLabel: '昆虫',
    keywords: ['瓢虫'],
    summary: '默认识图测试返回',
    controlTips: ['默认防治建议'],
    spiritPreview: '',
  }),
  chat: async () => ({
    reply: '默认对话测试返回',
    provider: 'siliconflow',
    model: 'test-model',
  }),
  chatStream: async (_payload, handlers) => {
    if (typeof handlers?.onDelta === 'function') {
      await handlers.onDelta('默认流式返回')
    }
    const donePayload = {
      reply: '默认流式返回',
      provider: 'siliconflow',
      model: 'test-model',
    }
    if (typeof handlers?.onDone === 'function') {
      await handlers.onDone(donePayload)
    }
    return donePayload
  },
})

const start = async (
  service: ApiServiceMock,
  spiritService: SpiritServiceMock = createDefaultSpiritService(),
  spiritGenerationConfig?: { listConfig: () => Record<string, unknown>; resolvePayload: (payload: Record<string, unknown>) => Record<string, unknown> },
  appOptions: Record<string, unknown> = {},
) => {
  const siliconflowService =
    appOptions.siliconflowService && typeof appOptions.siliconflowService === 'object'
      ? (appOptions.siliconflowService as SiliconflowServiceMock)
      : createDefaultSiliconflowService()
  const app = createApp(service, {
    spiritService,
    spiritGenerationConfig,
    siliconflowService,
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

describe('backend api contract', () => {
  test('GET /api/health returns health payload', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'p-1' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/health`)
    const body = (await res.json()) as { ok: boolean; provider: string }

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.provider).toBe('supabase')
  })

  test('GET /api/spirit/config returns presets and workflows', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'p-1' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritGenerationConfig = {
      listConfig: () => ({
        defaultPresetId: 'campus_anime',
        defaultWorkflowId: 'default',
        presets: [{ id: 'campus_anime', label: '校园清新风' }],
        workflows: [{ id: 'default', label: '默认工作流', path: 'D:/yeoooo/comfyui/默认原始工作流.json' }],
      }),
      resolvePayload: (payload: Record<string, unknown>) => payload,
    }

    const baseUrl = await start(service, createDefaultSpiritService(), spiritGenerationConfig)
    const res = await fetch(`${baseUrl}/api/spirit/config`)
    const body = (await res.json()) as { data: { presets: Array<{ id: string }>; workflows: Array<{ id: string }> } }

    expect(res.status).toBe(200)
    expect(body.data.presets[0]?.id).toBe('campus_anime')
    expect(body.data.workflows[0]?.id).toBe('default')
  })

  test('GET /api/spirit/config includes workflow routing rules', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'p-1' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/spirit/config`)
    const body = (await res.json()) as {
      data: {
        workflowRoutingRules?: Array<{ id: string; presetId: string; workflowId: string }>
      }
    }

    expect(res.status).toBe(200)
    expect(Array.isArray(body.data.workflowRoutingRules)).toBe(true)
    expect(body.data.workflowRoutingRules?.length).toBeGreaterThan(0)
    expect(body.data.workflowRoutingRules?.[0]?.id).toBeTruthy()
    expect(body.data.workflowRoutingRules?.[0]?.presetId).toBeTruthy()
    expect(body.data.workflowRoutingRules?.[0]?.workflowId).toBeTruthy()
  })

  test('GET /api/spirit/workflow/validate returns workflow mapping summary', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'p-1' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async () => ({
        promptId: 'prompt-validate',
        imageUrl: 'http://127.0.0.1:8188/view?filename=validate.png&type=output',
      }),
      validateWorkflowProfile: async (input) => ({
        ok: true,
        workflowPath: input.workflowPath,
        mode: 'workflow',
        sourceFormat: 'prompt',
        nodeCount: 7,
        classTypes: ['CheckpointLoaderSimple', 'CLIPTextEncode', 'KSampler', 'SaveImage'],
        fieldCoverage: {
          checkpoint: true,
          latentSize: true,
          sampler: true,
          positivePrompt: true,
          negativePrompt: true,
          saveImage: true,
        },
      }),
    }

    const baseUrl = await start(service, spiritService)
    const res = await fetch(`${baseUrl}/api/spirit/workflow/validate?workflowId=default`)
    const body = (await res.json()) as {
      data: {
        items: Array<{ id: string; ok: boolean; mode: string; fieldCoverage: { positivePrompt: boolean; negativePrompt: boolean } }>
      }
    }

    expect(res.status).toBe(200)
    expect(body.data.items.length).toBeGreaterThan(0)
    expect(body.data.items[0]?.id).toBe('default')
    expect(body.data.items[0]?.ok).toBe(true)
    expect(body.data.items[0]?.mode).toBe('workflow')
    expect(body.data.items[0]?.fieldCoverage.positivePrompt).toBe(true)
    expect(body.data.items[0]?.fieldCoverage.negativePrompt).toBe(true)
  })

  test('GET /api/encyclopedia returns items shape', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [{ id: 'e-1', name: '蚜虫' }],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'p-1' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/encyclopedia?q=%E8%9A%9C`)
    const body = (await res.json()) as { items: Array<{ id: string }> }

    expect(res.status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items[0]?.id).toBe('e-1')
  })

  test('POST /api/community/posts validates payload', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'p-1' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: '', content: '' }),
    })

    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(400)
    expect(body.error).toContain('title')
  })

  test('POST /api/community/posts returns id when success', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: '测试标题', content: '测试正文' }),
    })

    const body = (await res.json()) as { id: string }

    expect(res.status).toBe(201)
    expect(body.id).toBe('post-001')
  })

  test('POST /api/spirit/generate returns generated image payload', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    let capturedPayload: Record<string, unknown> | null = null
    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async (payload) => {
        capturedPayload = payload
        return {
          promptId: 'prompt-123',
          imageUrl: 'http://127.0.0.1:8188/view?filename=test.png&type=output',
        }
      },
    }

    const baseUrl = await start(service, spiritService)
    const res = await fetch(`${baseUrl}/api/spirit/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '瓢虫',
        scientificName: 'Coccinella septempunctata',
        keywords: ['益虫', '蚜虫天敌'],
      }),
    })

    const body = (await res.json()) as { data: { imageUrl: string; promptId: string } }

    expect(res.status).toBe(200)
    expect(capturedPayload?.name).toBe('瓢虫')
    expect(capturedPayload?.keywords).toEqual(['益虫', '蚜虫天敌'])
    expect(body.data.promptId).toBe('prompt-123')
    expect(body.data.imageUrl).toContain('view?filename=test.png')
  })

  test('GET /api/spirit/runtime returns runtime payload', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
        comfyuiOnline: true,
        checkpointCount: 1,
        workflowModeCandidate: 'workflow',
      }),
      generateSpiritPortrait: async () => ({
        promptId: 'prompt-123',
        imageUrl: 'http://127.0.0.1:8188/view?filename=test.png&type=output',
      }),
    }

    const baseUrl = await start(service, spiritService)
    const res = await fetch(`${baseUrl}/api/spirit/runtime`)
    const body = (await res.json()) as { data: { ready: boolean; workflowModeCandidate: string } }

    expect(res.status).toBe(200)
    expect(body.data.ready).toBe(true)
    expect(body.data.workflowModeCandidate).toBe('workflow')
  })

  test('GET /api/home/feed returns high alerts, picks and reminders', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      getHomeFeed: async () => ({
        alerts: [{ id: 'e-1', name: '桃蚜', risk: '高' }],
        picks: [{ id: 'p-1', title: '社区精选示例' }],
        reminders: [{ id: 'r-1', title: '草稿待发布', type: 'spirit_draft' }],
        generatedAt: new Date().toISOString(),
      }),
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/home/feed`)
    const body = (await res.json()) as {
      data: {
        alerts: Array<{ id: string; risk: string }>
        picks: Array<{ id: string }>
        reminders: Array<{ id: string; type: string }>
      }
    }

    expect(res.status).toBe(200)
    expect(body.data.alerts[0]?.id).toBe('e-1')
    expect(body.data.alerts[0]?.risk).toBe('高')
    expect(body.data.picks[0]?.id).toBe('p-1')
    expect(body.data.reminders[0]?.type).toBe('spirit_draft')
  })

  test('GET /api/me/stats returns profile counters and event summary', async () => {
    let captured: {
      account?: string
      profileName?: string
      favoriteCount?: number
      identifyCount?: number
    } | null = null

    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      getMeStats: async (input) => {
        captured = input
        return {
          publish: 7,
          answer: 5,
          favorite: input.favoriteCount ?? 0,
          identify: input.identifyCount ?? 0,
          eventSummary: [
            { name: 'community_post_publish', count: 7 },
            { name: 'community_reply_publish', count: 5 },
          ],
          generatedAt: new Date().toISOString(),
        }
      },
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(
      `${baseUrl}/api/me/stats?account=student01&profileName=%E5%B0%8F%E5%A4%8F&favoriteCount=9&identifyCount=3`,
    )
    const body = (await res.json()) as {
      data: {
        publish: number
        answer: number
        favorite: number
        identify: number
        eventSummary: Array<{ name: string; count: number }>
      }
    }

    expect(res.status).toBe(200)
    expect(captured?.account).toBe('student01')
    expect(captured?.profileName).toBe('小夏')
    expect(captured?.favoriteCount).toBe(9)
    expect(captured?.identifyCount).toBe(3)
    expect(body.data.publish).toBe(7)
    expect(body.data.answer).toBe(5)
    expect(body.data.favorite).toBe(9)
    expect(body.data.identify).toBe(3)
    expect(body.data.eventSummary[0]?.name).toBe('community_post_publish')
  })

  test('POST /api/spirit/generate/tasks creates async task', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async () => {
        await wait(30)
        return {
          promptId: 'prompt-async',
          imageUrl: 'http://127.0.0.1:8188/view?filename=task.png&type=output',
        }
      },
    }

    const baseUrl = await start(service, spiritService)
    const createRes = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '瓢虫',
        scientificName: 'Coccinella septempunctata',
        keywords: ['益虫', '蚜虫天敌'],
      }),
    })

    const createBody = (await createRes.json()) as { data: { id: string; status: string } }

    expect(createRes.status).toBe(202)
    expect(createBody.data.id).toBeTruthy()
    expect(createBody.data.status).toBe('queued')
  })

  test('POST /api/spirit/generate/tasks supports idempotency key reuse', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async () => {
        await wait(20)
        return {
          promptId: 'prompt-idempotent',
          imageUrl: 'http://127.0.0.1:8188/view?filename=idempotent.png&type=output',
        }
      },
    }

    const baseUrl = await start(service, spiritService)
    const headers = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'api-contract-idempotent-key',
    }
    const body = JSON.stringify({
      name: '瓢虫',
      scientificName: 'Coccinella septempunctata',
      keywords: ['益虫', '蚜虫天敌'],
    })

    const firstRes = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers,
      body,
    })
    const firstBody = (await firstRes.json()) as { data: { id: string } }

    const secondRes = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers,
      body,
    })
    const secondBody = (await secondRes.json()) as { data: { id: string } }

    expect(firstRes.status).toBe(202)
    expect(secondRes.status).toBe(202)
    expect(secondBody.data.id).toBe(firstBody.data.id)
  })

  test('GET /api/spirit/generate/tasks/:id returns succeeded task result', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async () => {
        await wait(30)
        return {
          promptId: 'prompt-async',
          imageUrl: 'http://127.0.0.1:8188/view?filename=task-done.png&type=output',
        }
      },
    }

    const baseUrl = await start(service, spiritService)
    const createRes = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '瓢虫',
        scientificName: 'Coccinella septempunctata',
        keywords: ['益虫', '蚜虫天敌'],
      }),
    })

    const createBody = (await createRes.json()) as { data: { id: string } }
    const taskId = createBody.data.id

    let finalPayload: { data: { status: string; result?: { imageUrl?: string } } } | null = null

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const detailRes = await fetch(`${baseUrl}/api/spirit/generate/tasks/${encodeURIComponent(taskId)}`)
      const detailBody = (await detailRes.json()) as { data: { status: string; result?: { imageUrl?: string } } }
      expect(detailRes.status).toBe(200)

      if (detailBody.data.status === 'succeeded') {
        finalPayload = detailBody
        break
      }

      await wait(25)
    }

    expect(finalPayload?.data.status).toBe('succeeded')
    expect(finalPayload?.data.result?.imageUrl).toContain('task-done.png')
  })

  test('GET /api/spirit/stats returns task success rate and duration', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async () => {
        await wait(20)
        return {
          promptId: 'prompt-stats',
          imageUrl: 'http://127.0.0.1:8188/view?filename=stats.png&type=output',
        }
      },
    }

    const baseUrl = await start(service, spiritService)
    const createRes = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '瓢虫',
        scientificName: 'Coccinella septempunctata',
        keywords: ['益虫', '蚜虫天敌'],
      }),
    })

    const createBody = (await createRes.json()) as { data: { id: string } }
    const taskId = createBody.data.id

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const detailRes = await fetch(`${baseUrl}/api/spirit/generate/tasks/${encodeURIComponent(taskId)}`)
      const detailBody = (await detailRes.json()) as { data: { status: string } }
      if (detailBody.data.status === 'succeeded') {
        break
      }
      await wait(20)
    }

    const statsRes = await fetch(`${baseUrl}/api/spirit/stats`)
    const statsBody = (await statsRes.json()) as {
      data: { totalTasks: number; succeeded: number; completed: number; successRate: number; averageDurationMs: number }
    }

    expect(statsRes.status).toBe(200)
    expect(statsBody.data.totalTasks).toBeGreaterThanOrEqual(1)
    expect(statsBody.data.succeeded).toBeGreaterThanOrEqual(1)
    expect(statsBody.data.completed).toBeGreaterThanOrEqual(1)
    expect(statsBody.data.successRate).toBeGreaterThan(0)
    expect(statsBody.data.averageDurationMs).toBeGreaterThanOrEqual(0)
  })

  test('POST /api/spirit/sessions binds generated task and returns session id', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const spiritService: SpiritServiceMock = {
      getRuntimeStatus: async () => ({
        ready: true,
      }),
      generateSpiritPortrait: async () => {
        await wait(20)
        return {
          promptId: 'prompt-session',
          imageUrl: 'http://127.0.0.1:8188/view?filename=session.png&type=output',
        }
      },
    }

    const baseUrl = await start(service, spiritService)
    const createTaskRes = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '瓢虫',
        scientificName: 'Coccinella septempunctata',
        keywords: ['益虫', '蚜虫天敌'],
      }),
    })
    const createTaskBody = (await createTaskRes.json()) as { data: { id: string } }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const detailRes = await fetch(`${baseUrl}/api/spirit/generate/tasks/${encodeURIComponent(createTaskBody.data.id)}`)
      const detailBody = (await detailRes.json()) as { data: { status: string } }
      if (detailBody.data.status === 'succeeded') {
        break
      }
      await wait(20)
    }

    const sessionRes = await fetch(`${baseUrl}/api/spirit/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identify: {
          name: '瓢虫',
          scientificName: 'Coccinella septempunctata',
          taskId: 'identify-task-session-001',
          sourceRefs: ['diag:campus-lab', 'manual:insect-guide-v2'],
          keywords: ['益虫', '蚜虫天敌'],
          summary: '用于测试会话绑定',
        },
        generation: {
          taskId: createTaskBody.data.id,
          presetId: 'campus_anime',
          workflowId: 'default',
        },
        messages: [
          { role: 'spirit', text: '你好，我是瓢虫精灵。' },
          { role: 'user', text: '请给我防治建议。' },
        ],
      }),
    })

    const sessionBody = (await sessionRes.json()) as {
      data: {
        id: string
        identify: { taskId: string; sourceRefs: string[] }
        generation: { taskId: string; status: string; imageUrl: string }
      }
    }

    expect(sessionRes.status).toBe(201)
    expect(sessionBody.data.id).toBeTruthy()
    expect(sessionBody.data.identify.taskId).toBe('identify-task-session-001')
    expect(sessionBody.data.identify.sourceRefs).toContain('diag:campus-lab')
    expect(sessionBody.data.generation.taskId).toBe(createTaskBody.data.id)
    expect(sessionBody.data.generation.status).toBe('succeeded')
    expect(sessionBody.data.generation.imageUrl).toContain('session.png')
  })

  test('POST /api/spirit/community-drafts builds draft from session context', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const sessionRes = await fetch(`${baseUrl}/api/spirit/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identify: {
          name: '瓢虫',
          scientificName: 'Coccinella septempunctata',
          taskId: 'identify-task-draft-001',
          sourceRefs: ['diag:field-note-01'],
          keywords: ['益虫', '蚜虫天敌'],
          summary: '会话摘要',
          cover: 'https://example.com/ladybug.png',
        },
        generation: {
          status: 'succeeded',
          imageUrl: 'https://example.com/generated.png',
          durationMs: 2468,
        },
        messages: [{ role: 'spirit', text: '建议优先保护天敌。' }],
      }),
    })

    const sessionBody = (await sessionRes.json()) as { data: { id: string } }

    const draftRes = await fetch(`${baseUrl}/api/spirit/community-drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionBody.data.id,
        extraContext: '希望老师帮我补充药剂轮换方案。',
      }),
    })

    const draftBody = (await draftRes.json()) as {
      data: {
        sessionId: string
        title: string
        content: string
        markdown: string
        image: string
        topics: string[]
      }
    }

    expect(draftRes.status).toBe(201)
    expect(draftBody.data.sessionId).toBe(sessionBody.data.id)
    expect(draftBody.data.title).toContain('灵化记录')
    expect(draftBody.data.content).toContain('希望老师帮我补充药剂轮换方案')
    expect(draftBody.data.markdown).toContain('识别对象')
    expect(draftBody.data.content).toContain('识别任务ID：identify-task-draft-001')
    expect(draftBody.data.content).toContain('识别来源：diag:field-note-01')
    expect(draftBody.data.image).toContain('generated.png')
    expect(draftBody.data.topics.length).toBeGreaterThan(0)
  })

  test('GET/PATCH /api/spirit/community-drafts supports history and refill update', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const sessionRes = await fetch(`${baseUrl}/api/spirit/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identify: {
          name: '瓢虫',
          scientificName: 'Coccinella septempunctata',
          keywords: ['益虫'],
          summary: '用于草稿历史测试',
        },
        generation: {
          status: 'succeeded',
          imageUrl: 'https://example.com/generated.png',
        },
        messages: [{ role: 'spirit', text: '历史草稿测试' }],
      }),
    })
    const sessionBody = (await sessionRes.json()) as { data: { id: string } }

    const createDraftRes = await fetch(`${baseUrl}/api/spirit/community-drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionBody.data.id,
      }),
    })
    const createDraftBody = (await createDraftRes.json()) as { data: { id: string } }

    const listRes = await fetch(`${baseUrl}/api/spirit/community-drafts?limit=10&status=draft`)
    const listBody = (await listRes.json()) as { items: Array<{ id: string; status: string }> }
    expect(listRes.status).toBe(200)
    expect(listBody.items.some((item) => item.id === createDraftBody.data.id)).toBe(true)

    const updateRes = await fetch(`${baseUrl}/api/spirit/community-drafts/${encodeURIComponent(createDraftBody.data.id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '【二次编辑】瓢虫草稿',
        content: '回填后二次编辑内容',
        markdown: '回填后二次编辑内容',
        topics: ['灵化角色', '二次编辑'],
      }),
    })

    const updateBody = (await updateRes.json()) as { data: { title: string; content: string; topics: string[] } }
    expect(updateRes.status).toBe(200)
    expect(updateBody.data.title).toContain('二次编辑')
    expect(updateBody.data.content).toContain('回填后')
    expect(updateBody.data.topics).toContain('二次编辑')
  })

  test('POST /api/spirit/community-drafts/:id/publish publishes draft once', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-published-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const sessionRes = await fetch(`${baseUrl}/api/spirit/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identify: {
          name: '瓢虫',
          scientificName: 'Coccinella septempunctata',
          keywords: ['益虫'],
        },
        generation: {
          status: 'succeeded',
          imageUrl: 'https://example.com/generated.png',
        },
        messages: [{ role: 'spirit', text: '发布测试' }],
      }),
    })
    const sessionBody = (await sessionRes.json()) as { data: { id: string } }

    const createDraftRes = await fetch(`${baseUrl}/api/spirit/community-drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: sessionBody.data.id,
      }),
    })
    const createDraftBody = (await createDraftRes.json()) as { data: { id: string } }

    const publishRes = await fetch(`${baseUrl}/api/spirit/community-drafts/${encodeURIComponent(createDraftBody.data.id)}/publish`, {
      method: 'POST',
    })
    const publishBody = (await publishRes.json()) as {
      data: { postId: string; reused: boolean; draft: { status: string; publishedPostId: string } }
    }
    expect(publishRes.status).toBe(200)
    expect(publishBody.data.postId).toBe('post-published-001')
    expect(publishBody.data.reused).toBe(false)
    expect(publishBody.data.draft.status).toBe('published')
    expect(publishBody.data.draft.publishedPostId).toBe('post-published-001')

    const publishAgainRes = await fetch(
      `${baseUrl}/api/spirit/community-drafts/${encodeURIComponent(createDraftBody.data.id)}/publish`,
      {
        method: 'POST',
      },
    )
    const publishAgainBody = (await publishAgainRes.json()) as { data: { postId: string; reused: boolean } }
    expect(publishAgainRes.status).toBe(200)
    expect(publishAgainBody.data.postId).toBe('post-published-001')
    expect(publishAgainBody.data.reused).toBe(true)
  })

  test('POST /api/spirit/identify returns structured identify payload', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-identify-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service, createDefaultSpiritService(), undefined, {
      siliconflowService: {
        identifyImage: async (payload: Record<string, unknown>) => {
          capturedPayload = payload
          return {
            name: '棉蚜',
            scientificName: 'Aphis gossypii',
            confidence: 0.92,
            typeLabel: '昆虫',
            keywords: ['蚜虫', '刺吸式口器'],
            summary: '测试识图返回',
            controlTips: ['优先保护天敌', '阈值监测后再施药'],
            cover: 'https://example.com/aphid.jpg',
            spiritPreview: 'https://example.com/spirit.jpg',
            encyclopediaId: 'enc-aphid',
            provider: 'siliconflow',
            model: 'Qwen/Qwen2.5-VL-72B-Instruct',
          }
        },
        chat: async () => ({
          reply: 'unused',
        }),
        chatStream: async (_payload, handlers) => {
          const donePayload = {
            reply: 'unused',
            provider: 'siliconflow',
            model: 'test-model',
          }
          if (typeof handlers?.onDone === 'function') {
            await handlers.onDone(donePayload)
          }
          return donePayload
        },
      } satisfies SiliconflowServiceMock,
    })

    const res = await fetch(`${baseUrl}/api/spirit/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: 'https://example.com/upload/leaf.jpg',
      }),
    })

    const body = (await res.json()) as { data: { name: string; scientificName: string; keywords: string[]; provider: string } }

    expect(res.status).toBe(200)
    expect(capturedPayload?.image).toBe('https://example.com/upload/leaf.jpg')
    expect(body.data.name).toBe('棉蚜')
    expect(body.data.scientificName).toBe('Aphis gossypii')
    expect(body.data.keywords).toContain('蚜虫')
    expect(body.data.provider).toBe('siliconflow')
  })

  test('POST /api/spirit/identify validates required image field', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-identify-002' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/spirit/identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(400)
    expect(body.error).toContain('image')
  })

  test('POST /api/spirit/chat returns model reply with metadata', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-chat-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service, createDefaultSpiritService(), undefined, {
      siliconflowService: {
        identifyImage: async () => ({
          name: 'unused',
        }),
        chat: async (payload: Record<string, unknown>) => {
          capturedPayload = payload
          return {
            reply: '建议先做虫口密度调查，再决定是否施药。',
            provider: 'siliconflow',
            model: 'deepseek-ai/DeepSeek-V3',
          }
        },
        chatStream: async (_payload, handlers) => {
          const donePayload = {
            reply: '建议先做虫口密度调查，再决定是否施药。',
            provider: 'siliconflow',
            model: 'deepseek-ai/DeepSeek-V3',
          }
          if (typeof handlers?.onDone === 'function') {
            await handlers.onDone(donePayload)
          }
          return donePayload
        },
      } satisfies SiliconflowServiceMock,
    })

    const res = await fetch(`${baseUrl}/api/spirit/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: '这张图里的虫害要怎么处理？',
        spirit: {
          name: '瓢虫精灵',
          scientificName: 'Coccinella septempunctata',
          keywords: ['益虫', '蚜虫天敌'],
        },
        identify: {
          name: '棉蚜',
          scientificName: 'Aphis gossypii',
          summary: '叶背聚集明显',
          keywords: ['蚜虫', '刺吸式口器'],
        },
        messages: [
          { role: 'user', text: '你好' },
          { role: 'spirit', text: '你好，我是瓢虫精灵。' },
        ],
        orchestration: {
          personaDesign: {
            coreConcept: '蚜虫灵化角色',
            designDirection: '群聚吸汁拟人化',
            colorPalette: ['嫩绿', '叶片黄化'],
            silhouette: ['小型簇拥轮廓'],
            hairDesign: ['触角发饰'],
            outfitElements: ['卷叶裙摆'],
            accessoryElements: ['群聚点阵挂饰'],
            textureMaterials: ['壳面微光'],
            symbolicMotifs: ['吸汁针刺'],
            temperament: ['狡黠'],
            pose: ['前倾侦查'],
            forbiddenElements: ['fixed template character'],
          },
        },
      }),
    })

    const body = (await res.json()) as { data: { reply: string; provider: string; model: string } }

    expect(res.status).toBe(200)
    expect(capturedPayload?.question).toBe('这张图里的虫害要怎么处理？')
    expect(
      (
        (capturedPayload?.orchestration as { personaDesign?: { coreConcept?: string } } | undefined)?.personaDesign
          ?.coreConcept ?? ''
      ).trim(),
    ).toBe('蚜虫灵化角色')
    expect(body.data.reply).toContain('虫口密度调查')
    expect(body.data.provider).toBe('siliconflow')
    expect(body.data.model).toContain('DeepSeek')
  })

  test('POST /api/spirit/chat/stream returns sse payload and done marker', async () => {
    let capturedPayload: Record<string, unknown> | null = null

    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-chat-stream-001' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service, createDefaultSpiritService(), undefined, {
      siliconflowService: {
        identifyImage: async () => ({
          name: 'unused',
        }),
        chat: async () => ({
          reply: 'unused',
        }),
        chatStream: async (payload, handlers) => {
          capturedPayload = payload
          if (typeof handlers?.onDelta === 'function') {
            await handlers.onDelta('你好')
            await handlers.onDelta('，同学')
          }
          const donePayload = {
            reply: '你好，同学',
            provider: 'siliconflow',
            model: 'deepseek-ai/DeepSeek-V3',
          }
          if (typeof handlers?.onDone === 'function') {
            await handlers.onDone(donePayload)
          }
          return donePayload
        },
      } satisfies SiliconflowServiceMock,
    })

    const res = await fetch(`${baseUrl}/api/spirit/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: '你好',
      }),
    })
    const bodyText = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(capturedPayload?.question).toBe('你好')
    expect(bodyText).toContain('"type":"delta"')
    expect(bodyText).toContain('"text":"你好"')
    expect(bodyText).toContain('"type":"done"')
    expect(bodyText).toContain('[DONE]')
  })

  test('POST /api/community/posts rejects unsafe image url', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-unsafe-image' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service)
    const res = await fetch(`${baseUrl}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '测试标题',
        content: '测试正文',
        image: 'javascript:alert(1)',
      }),
    })
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(400)
    expect(body.error).toContain('image')
  })

  test('POST /api/community/posts rate limits repeated writes when configured', async () => {
    const service: ApiServiceMock = {
      checkHealth: async () => ({ ok: true, provider: 'supabase' }),
      listEncyclopedia: async () => [],
      listCommunityPosts: async () => [],
      createCommunityPost: async () => ({ id: 'post-rate-limit' }),
      createCommunityReply: async () => ({ id: 'a-1' }),
    }

    const baseUrl = await start(service, createDefaultSpiritService(), undefined, {
      rateLimitRules: {
        'POST /api/community/posts': { limit: 1, windowMs: 60_000 },
      },
    })

    const payload = JSON.stringify({
      title: '第一条',
      content: '第一条内容',
    })

    const firstRes = await fetch(`${baseUrl}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    })
    expect(firstRes.status).toBe(201)

    const secondRes = await fetch(`${baseUrl}/api/community/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '第二条',
        content: '第二条内容',
      }),
    })
    const secondBody = (await secondRes.json()) as { error: string }

    expect(secondRes.status).toBe(429)
    expect(secondBody.error).toContain('rate limit')
  })
})
