import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('analytics page p15 filters and pagination', () => {
  beforeEach(() => {
    vi.resetModules()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const urlText = resolveUrl(input)
      const url = new URL(urlText, 'http://localhost')

      if (url.pathname.endsWith('/api/analytics/events/summary')) {
        return jsonResponse({
          data: {
            days: 7,
            total: 11,
            byName: [
              { name: 'identify_submit', count: 8 },
              { name: 'spirit_generate_submit', count: 3 },
            ],
            bySource: [{ source: 'api', count: 11 }],
            generatedAt: new Date().toISOString(),
          },
        })
      }

      if (url.pathname.endsWith('/api/analytics/task-logs')) {
        const taskType = url.searchParams.get('taskType') ?? ''
        const offset = Number(url.searchParams.get('offset') ?? '0')

        if (taskType === 'diagnosis_identify' && offset === 0) {
          return jsonResponse({
            items: [
              {
                id: 'diag-log-1',
                taskType: 'diagnosis_identify',
                taskId: 'identify-task-1',
                status: 'running',
                attempt: 1,
                durationMs: 210,
                error: '',
                createdAt: new Date().toISOString(),
              },
            ],
            page: {
              limit: 20,
              offset: 0,
              hasMore: true,
              nextOffset: 20,
            },
          })
        }

        if (taskType === 'diagnosis_identify' && offset === 20) {
          return jsonResponse({
            items: [
              {
                id: 'diag-log-2',
                taskType: 'diagnosis_identify',
                taskId: 'identify-task-2',
                status: 'succeeded',
                attempt: 1,
                durationMs: 330,
                error: '',
                createdAt: new Date().toISOString(),
              },
            ],
            page: {
              limit: 20,
              offset: 20,
              hasMore: false,
              nextOffset: null,
            },
          })
        }

        return jsonResponse({
          items: [
            {
              id: 'spirit-log-1',
              taskType: 'spirit_generation',
              taskId: 'spirit-task-1',
              status: 'queued',
              attempt: 0,
              durationMs: 0,
              error: '',
              createdAt: new Date().toISOString(),
            },
          ],
          page: {
            limit: 20,
            offset: 0,
            hasMore: false,
            nextOffset: null,
          },
        })
      }

      return jsonResponse({ error: 'not found' }, 404)
    })

    vi.stubGlobal('fetch', fetchMock as typeof fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('clicking summary event drills down logs and supports pagination', async () => {
    const { AnalyticsPage } = await import('../pages/AnalyticsPage')
    const user = userEvent.setup()
    render(<AnalyticsPage />)

    const drilldownTrigger = await screen.findByRole('button', { name: /identify_submit：8/ })
    await user.click(drilldownTrigger)

    expect(await screen.findByText((content) => content.includes('identify-task-1'))).toBeInTheDocument()

    const loadMoreButton = await screen.findByRole('button', { name: '加载更多日志' })
    await user.click(loadMoreButton)

    expect(await screen.findByText((content) => content.includes('identify-task-2'))).toBeInTheDocument()

    await waitFor(() => {
      const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>
      const requested = mockFetch.mock.calls
        .map((entry) => resolveUrl(entry[0]))
        .filter((urlText) => urlText.includes('/api/analytics/task-logs'))
      expect(requested.some((urlText) => urlText.includes('taskType=diagnosis_identify'))).toBe(true)
      expect(requested.some((urlText) => urlText.includes('offset=20'))).toBe(true)
    })
  })
})
