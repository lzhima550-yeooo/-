import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

const resolveUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

describe('home/me/analytics backend linkage', () => {
  beforeEach(() => {
    vi.resetModules()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveUrl(input)

      if (url.includes('/api/home/feed')) {
        return jsonResponse({
          data: {
            alerts: [
              {
                id: 'alert-1',
                name: '服务端高警报',
                risk: '高',
                summary: '用于前端联调验证',
                image: '/images/community-post-fallback.svg',
                season: '春季',
              },
            ],
            picks: [
              {
                id: 'pick-1',
                title: '服务端社区精选',
                author: 'API',
                image: '/images/community-post-fallback.svg',
                likes: 99,
                status: 'open',
                createdAt: new Date().toISOString(),
              },
            ],
            reminders: [
              {
                id: 'reminder-1',
                type: 'spirit_draft',
                title: '服务端草稿待发布',
                status: 'draft',
                sessionId: 'session-1',
                updatedAt: new Date().toISOString(),
                publishedPostId: '',
              },
            ],
            generatedAt: new Date().toISOString(),
          },
        })
      }

      if (url.includes('/api/me/stats')) {
        return jsonResponse({
          data: {
            publish: 6,
            answer: 4,
            favorite: 3,
            identify: 2,
            generatedAt: new Date().toISOString(),
          },
        })
      }

      if (url.includes('/api/analytics/events/summary')) {
        return jsonResponse({
          data: {
            days: 7,
            total: 12,
            byName: [
              { name: 'identify_submit', count: 8 },
              { name: 'chat_stream_done', count: 4 },
            ],
            bySource: [{ source: 'api', count: 12 }],
            generatedAt: new Date().toISOString(),
          },
        })
      }

      if (url.includes('/api/analytics/task-logs')) {
        return jsonResponse({
          items: [
            {
              id: 'log-1',
              taskType: 'diagnosis_identify',
              taskId: 'task-1',
              status: 'failed',
              attempt: 2,
              durationMs: 1280,
              error: '400 status code (no body)',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'log-2',
              taskType: 'spirit_generation',
              taskId: 'task-2',
              status: 'succeeded',
              attempt: 1,
              durationMs: 840,
              error: '',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }

      return jsonResponse({ error: 'not found' }, 404)
    })

    vi.stubGlobal('fetch', fetchMock as typeof fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('hydrates home feed, me stats and analytics summary from backend APIs', async () => {
    const { default: App } = await import('../App')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '进入探索' }))
    await user.type(screen.getByTestId('login-account'), 'student01')
    await user.type(screen.getByTestId('login-password'), '123456')
    await user.click(screen.getByTestId('login-submit'))

    expect(await screen.findByText((content) => content.includes('服务端高警报'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('服务端社区精选'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('服务端草稿待发布'))).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '我的成就' }))
    expect(await screen.findByTestId('me-stat-publish')).toHaveTextContent('6')
    expect(screen.getByTestId('me-stat-answer')).toHaveTextContent('4')

    await user.click(screen.getByRole('link', { name: '分析面板' }))

    expect(await screen.findByText('identify_submit：8')).toBeInTheDocument()
    expect(screen.getByText('chat_stream_done：4')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('近7天事件总量：12'))).toBeInTheDocument()
    expect(await screen.findByText((content) => content.includes('diagnosis_identify · failed'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('spirit_generation · succeeded'))).toBeInTheDocument()
  })
})
