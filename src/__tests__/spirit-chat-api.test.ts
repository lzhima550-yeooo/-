import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('spirit chat api', () => {
  test('calls /api/spirit/chat and returns normalized reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        data: {
          reply: '建议先做虫口密度调查。',
          provider: 'siliconflow',
          model: 'deepseek-ai/DeepSeek-V3',
        },
      }),
      text: async () => '',
    } as Response)

    vi.stubGlobal('fetch', fetchMock)
    const { requestSpiritChatOnServer } = await import('../services/spiritChatApi')

    const result = await requestSpiritChatOnServer({
      question: '这张图该怎么处理？',
      spirit: {
        name: '瓢虫精灵',
        scientificName: 'Coccinella septempunctata',
        keywords: ['益虫'],
      },
      identify: {
        name: '棉蚜',
        scientificName: 'Aphis gossypii',
        keywords: ['蚜虫'],
      },
      messages: [{ role: 'user', text: '你好' }],
    })

    expect(result.ok).toBe(true)
    expect(result.data.reply).toContain('虫口密度')
    expect(result.data.provider).toBe('siliconflow')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/spirit/chat')
  })

  test('returns request_failed when api request throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchMock)
    const { requestSpiritChatOnServer } = await import('../services/spiritChatApi')

    const result = await requestSpiritChatOnServer({
      question: '你好',
      spirit: {
        name: '瓢虫精灵',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('request_failed')
    expect(result.data.reply).toBe('')
  })

  test('streams /api/chat/stream and yields delta chunks', async () => {
    const encoder = new TextEncoder()
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"delta","text":"你好"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"delta","text":"，同学"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"done","provider":"siliconflow","model":"deepseek-ai/DeepSeek-V3"}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: streamBody,
    } as Response)

    vi.stubGlobal('fetch', fetchMock)
    const { streamSpiritChatFromServer } = await import('../services/spiritChatApi')
    const chunks: string[] = []

    const result = await streamSpiritChatFromServer(
      {
        question: '你好',
      },
      {
        onDelta(chunk) {
          chunks.push(chunk)
        },
      },
    )

    expect(result.ok).toBe(true)
    expect(result.data.reply).toBe('你好，同学')
    expect(result.data.provider).toBe('siliconflow')
    expect(chunks).toEqual(['你好', '，同学'])
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/chat/stream')
  })
})
