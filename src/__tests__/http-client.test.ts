import { describe, expect, test, vi } from 'vitest'
import { createHttpClient } from '../services/httpClient'

describe('http client', () => {
  test('sends GET request with query params and parses json response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ items: [1, 2, 3] }),
      text: async () => '',
    } as Response)

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl: fetchMock,
      timeoutMs: 3000,
    })

    const result = await client.get<{ items: number[] }>('/encyclopedia', {
      query: { q: 'aphis', type: 'insect' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('https://api.example.com/encyclopedia?q=aphis&type=insect')
    expect(result.items).toEqual([1, 2, 3])
  })

  test('sends POST request with auth header and json body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'p-1' }),
      text: async () => '',
    } as Response)

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl: fetchMock,
    })

    client.setAuthToken('token-123')

    await client.post('/community/posts', {
      body: {
        title: '测试贴',
        content: '内容',
      },
    })

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    const headers = requestInit.headers as Record<string, string>

    expect(requestInit.method).toBe('POST')
    expect(headers.Authorization).toBe('Bearer token-123')
    expect(requestInit.body).toContain('测试贴')
  })
})
