import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('loads evidence search and detail sections from backend', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = String(input)
    const method = String(init?.method ?? 'GET').toUpperCase()

    if (requestUrl.includes('/api/encyclopedia/search') && method === 'GET') {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'enc-powdery',
              type: 'disease',
              name: '白粉病',
              scientific_name: 'Powdery mildew',
              genus: 'Erysiphales',
              category_code: 'fungal',
              category: '真菌性病害',
              risk: '高',
              season: '春夏',
              host: '月季',
              summary: '叶片白粉层明显，扩散较快。',
              morphology: '叶面白粉',
              symptoms: '叶片卷曲发黄',
              image: '/images/community-post-fallback.svg',
              control_tips: ['隔离病叶', '通风降湿'],
              placement_tips: ['避免过密摆放'],
              references: ['https://example.com/source-1'],
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (requestUrl.includes('/api/encyclopedia/enc-powdery') && method === 'GET') {
      return new Response(
        JSON.stringify({
          data: {
            id: 'enc-powdery',
            entry: {
              id: 'enc-powdery',
              type: 'disease',
              name: '白粉病',
              scientific_name: 'Powdery mildew',
              genus: 'Erysiphales',
              category_code: 'fungal',
              category: '真菌性病害',
              risk: '高',
              season: '春夏',
              host: '月季',
              summary: '疑似白粉病',
              morphology: '叶面白粉',
              symptoms: '叶片卷曲发黄',
              image: '/images/community-post-fallback.svg',
              control_tips: ['隔离病叶', '通风降湿'],
              placement_tips: ['避免过密摆放'],
              references: ['https://example.com/source-1'],
            },
            sourceIndex: [
              {
                id: 'src-1',
                sourceType: 'reference',
                title: '农业教材',
                url: 'https://example.com/source-1',
                snippet: '白粉病在高湿环境下扩散更快。',
                confidenceScore: 88,
                confidenceLabel: '高',
              },
            ],
            treatmentTemplate: {
              entryId: 'enc-powdery',
              immediateActions: ['隔离病叶'],
              environmentAdjustments: ['降低湿度'],
              followUpSchedule: ['48 小时复查'],
              cautionNotes: ['避免过量喷药'],
            },
            relatedEntries: [
              {
                id: 'enc-downy',
                type: 'disease',
                name: '霜霉病',
                scientific_name: 'Downy mildew',
                genus: 'Peronosporaceae',
                category_code: 'fungal',
                category: '真菌性病害',
                risk: '高',
                season: '春夏',
                host: '黄瓜',
                summary: '同季节高发',
                morphology: '',
                symptoms: '',
                image: '/images/community-post-fallback.svg',
                control_tips: [],
                placement_tips: [],
                references: [],
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  })

  vi.stubGlobal('fetch', fetchMock)
  vi.resetModules()
  const { default: App } = await import('../App')

  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('link', { name: '进入探索' }))
  await user.type(screen.getByTestId('login-account'), 'student01')
  await user.type(screen.getByTestId('login-password'), '123456')
  await user.click(screen.getByTestId('login-submit'))

  await user.click(screen.getByRole('link', { name: '图鉴' }))
  await user.click(screen.getByLabelText('联网专业检索'))
  await user.click(screen.getByRole('button', { name: '联网检索' }))

  await waitFor(() => {
    expect(screen.getByText(/已同步云端图鉴/)).toBeInTheDocument()
    expect(screen.getByText('白粉病')).toBeInTheDocument()
  })

  await user.click(screen.getByRole('link', { name: '白粉病' }))

  await waitFor(() => {
    expect(screen.getByText('来源索引')).toBeInTheDocument()
    expect(screen.getByText('治理模板')).toBeInTheDocument()
    expect(screen.getByText('相关推荐')).toBeInTheDocument()
    expect(screen.getByText('农业教材')).toBeInTheDocument()
  })

  expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/encyclopedia/search'))).toBe(true)
  expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/encyclopedia/enc-powdery'))).toBe(true)
})
