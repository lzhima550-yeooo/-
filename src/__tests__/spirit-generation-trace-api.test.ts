import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('spirit generation config/task trace api', () => {
  test('parses workflow routing rules from /api/spirit/config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        data: {
          defaultPresetId: 'campus_anime',
          defaultWorkflowId: 'default',
          presets: [{ id: 'campus_anime', label: '校园清新风' }],
          workflows: [{ id: 'default', label: '默认工作流', path: 'D:/yeoooo/comfyui/默认原始工作流.json' }],
          workflowRoutingRules: [
            {
              id: 'pest-priority',
              label: '虫害优先策略',
              presetId: 'science_card',
              workflowId: 'default',
              matchKeywords: ['蚜虫', '蓟马'],
            },
          ],
        },
      }),
      text: async () => '',
    } as Response)

    vi.stubGlobal('fetch', fetchMock)
    const { fetchSpiritGenerationConfigFromServer } = await import('../services/spiritConfigApi')
    const result = await fetchSpiritGenerationConfigFromServer()

    expect(result.ok).toBe(true)
    expect(Array.isArray((result.data as unknown as { workflowRoutingRules?: unknown[] }).workflowRoutingRules)).toBe(true)
    expect(
      (result.data as unknown as { workflowRoutingRules?: Array<{ id?: string; workflowId?: string }> }).workflowRoutingRules?.[0]?.id,
    ).toBe('pest-priority')
    expect(
      (result.data as unknown as { workflowRoutingRules?: Array<{ workflowId?: string }> }).workflowRoutingRules?.[0]?.workflowId,
    ).toBe('default')
  })

  test('parses workflow trace fields from /api/spirit/generate/tasks/:id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        data: {
          id: 'task-trace-001',
          status: 'succeeded',
          payload: {
            presetId: 'science_card',
            workflowId: 'default',
            workflowPath: 'D:/yeoooo/comfyui/默认原始工作流.json',
          },
          result: {
            promptId: 'prompt-trace-001',
            imageUrl: 'http://127.0.0.1:8188/view?filename=trace.png&type=output',
            prompt: 'anime botanical spirit, aphid outbreak',
            negativePrompt: 'lowres, watermark',
            workflowMode: 'workflow',
            workflowPath: 'D:/yeoooo/comfyui/默认原始工作流.json',
            workflowFallbackReason: '',
          },
        },
      }),
      text: async () => '',
    } as Response)

    vi.stubGlobal('fetch', fetchMock)
    const { fetchSpiritGenerationTaskFromServer } = await import('../services/spiritGenerationTaskApi')
    const result = await fetchSpiritGenerationTaskFromServer('task-trace-001')

    expect(result.ok).toBe(true)
    expect(result.data.id).toBe('task-trace-001')
    expect((result.data as unknown as { payload?: { presetId?: string } }).payload?.presetId).toBe('science_card')
    expect((result.data as unknown as { payload?: { workflowId?: string } }).payload?.workflowId).toBe('default')
    expect((result.data.result as unknown as { workflowMode?: string })?.workflowMode).toBe('workflow')
    expect((result.data.result as unknown as { workflowPath?: string })?.workflowPath).toContain('默认原始工作流.json')
  })
})
