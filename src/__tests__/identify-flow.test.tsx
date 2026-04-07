import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('uploads image and completes identify task with risk and action cards', async () => {
  class MockFileReader {
    result: string | ArrayBuffer | null = null
    onload: null | (() => void) = null
    onerror: null | (() => void) = null

    readAsDataURL() {
      this.result = 'data:image/jpeg;base64,AAAA'
      if (this.onload) {
        this.onload()
      }
    }
  }

  vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader)

  let detailCallCount = 0
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = String(input)
    const method = String(init?.method ?? 'GET').toUpperCase()

    if (requestUrl.includes('/api/identify/tasks') && method === 'POST') {
      return new Response(
        JSON.stringify({
          data: {
            id: 'task-identify-001',
            type: 'diagnosis_identify',
            status: 'pending',
          },
        }),
        {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    if (requestUrl.includes('/api/identify/tasks/task-identify-001') && method === 'GET') {
      detailCallCount += 1
      const payload =
        detailCallCount < 2
          ? {
              data: {
                id: 'task-identify-001',
                type: 'diagnosis_identify',
                status: 'running',
              },
            }
          : {
              data: {
                id: 'task-identify-001',
                type: 'diagnosis_identify',
                status: 'succeeded',
                riskLevel: 'high',
                topResult: {
                  name: '白粉病',
                  category: '病害',
                  confidence: 0.93,
                  evidenceTags: ['白色霉层', '蔓延'],
                },
                identify: {
                  name: '白粉病',
                  scientificName: 'Powdery mildew',
                  confidence: 0.93,
                  typeLabel: '病害',
                  keywords: ['白色霉层', '蔓延'],
                  summary: '疑似白粉病，建议先隔离。',
                  controlTips: ['先隔离'],
                  cover: 'https://example.com/powdery.jpg',
                  spiritPreview: '',
                  encyclopediaId: 'enc-powdery',
                },
                actionCards: [
                  {
                    id: 'card-1',
                    type: 'immediate',
                    title: '立即处理',
                    description: '先隔离受影响叶片。',
                    ctaLabel: '查看处理要点',
                    ctaRoute: '/identify',
                    priority: 100,
                  },
                ],
              },
            }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
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

  await user.click(screen.getByRole('button', { name: 'AI识别' }))

  const file = new File(['fake image'], 'leaf.jpg', { type: 'image/jpeg' })
  await user.upload(screen.getByLabelText('上传图片'), file)
  const submitButton = screen.getByRole('button', { name: '开始智能识别' })
  expect(submitButton).toBeEnabled()
  await user.click(submitButton)

  await waitFor(
    () => {
      expect(fetchMock).toHaveBeenCalled()
    },
    {
      timeout: 3000,
    },
  )

  await waitFor(
    () => {
      expect(screen.getByText('识别结果（任务）')).toBeInTheDocument()
      expect(screen.getByText(/风险等级：高/)).toBeInTheDocument()
      expect(screen.getByText('立即处理')).toBeInTheDocument()
      expect(screen.getAllByText(/置信度/).length).toBeGreaterThan(0)
    },
    {
      timeout: 6000,
    },
  )

  expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/api/identify/tasks'))).toBe(true)
})
