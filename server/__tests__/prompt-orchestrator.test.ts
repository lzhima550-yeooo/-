import { describe, expect, test, vi } from 'vitest'
import { createPromptOrchestrator } from '../lib/promptOrchestrator'
import { createSiliconflowService } from '../lib/siliconflowService'

describe('prompt orchestrator', () => {
  test('builds chat messages with policy, role, diagnosis, retrieval and memory contexts', () => {
    const orchestrator = createPromptOrchestrator({
      defaultSystemPolicy: '你是四季夏木校园植保助手。',
    })

    const messages = orchestrator.resolveChatMessages({
      question: '叶片上有白粉，现在要怎么处理？',
      messages: [
        { role: 'user', text: '上次你让我先隔离病叶。' },
        { role: 'spirit', text: '是的，先隔离并记录扩散速度。' },
      ],
      orchestration: {
        systemPolicy: '不要夸大结论，不确定时提示复核。',
        rolePack: {
          id: 'ladybug-guide',
          name: '瓢虫学姐',
          style: '冷静、可执行',
          guardrails: ['先观察后处置', '避免过量施药'],
        },
        personaDesign: {
          coreConcept: '白粉病灵化角色',
          designDirection: '粉雾覆盖与蔓延感',
          colorPalette: ['灰白', '病斑黄'],
          silhouette: ['扩散层叠'],
          hairDesign: ['雾化渐变发束'],
          outfitElements: ['粉层纱裙'],
          accessoryElements: ['孢子挂饰'],
          textureMaterials: ['粉雾颗粒'],
          symbolicMotifs: ['扩散环'],
          temperament: ['冷静'],
          pose: ['侧身观察'],
          forbiddenElements: ['generic anime girl'],
        },
        diagnosisContext: {
          identifyName: '白粉病',
          scientificName: 'Powdery mildew',
          riskLevel: 'high',
          summary: '疑似白粉病，扩散较快。',
          actionCards: ['隔离病叶', '降低湿度', '48 小时复查'],
        },
        retrievalContext: {
          sourceIndex: [
            {
              title: '农业教材',
              snippet: '白粉病在高湿环境扩散更快。',
              confidenceLabel: '高',
            },
          ],
          treatmentTemplate: {
            immediateActions: ['隔离病叶'],
            environmentAdjustments: ['降低湿度'],
          },
        },
        memoryContext: {
          sessionSummary: '上轮对话中用户反馈白粉在下层叶片更明显。',
          longTermFacts: ['用户所在温室通风较差'],
        },
        currentIntent: '本轮需要给出马上可执行的处理步骤',
      },
    })

    expect(messages[0]?.role).toBe('system')

    const systemBlock = messages
      .filter((item) => item.role === 'system')
      .map((item) => String(item.content))
      .join('\n')

    expect(systemBlock).toContain('系统策略')
    expect(systemBlock).toContain('角色包')
    expect(systemBlock).toContain('诊断上下文')
    expect(systemBlock).toContain('检索上下文')
    expect(systemBlock).toContain('记忆上下文')
    expect(systemBlock).toContain('当前意图')
    expect(systemBlock).toContain('Role Identity Contract')
    expect(systemBlock).toContain('Persona Design')
    expect(systemBlock).toContain('白粉病灵化角色')
    expect(systemBlock).toContain('粉雾覆盖与蔓延感')
    expect(systemBlock).toContain('农业教材')
    expect(systemBlock).toContain('用户所在温室通风较差')

    expect(messages.at(-1)).toMatchObject({
      role: 'user',
      content: '叶片上有白粉，现在要怎么处理？',
    })
  })

  test('siliconflow service uses orchestrator output for chat messages', async () => {
    const createMock = vi.fn(async () => ({
      model: 'deepseek-ai/DeepSeek-V3',
      choices: [{ message: { content: '建议先隔离病叶并复查湿度。' } }],
    }))

    const mockClient = {
      chat: {
        completions: {
          create: createMock,
        },
      },
    }

    const service = createSiliconflowService({
      apiKey: 'test-key',
      chatModel: 'deepseek-ai/DeepSeek-V3',
      client: mockClient,
    })

    const result = await service.chat({
      question: '我应该先做什么？',
      orchestration: {
        rolePack: {
          name: '瓢虫学姐',
        },
        diagnosisContext: {
          identifyName: '白粉病',
          riskLevel: 'high',
        },
        memoryContext: {
          sessionSummary: '上轮你建议过先隔离。',
        },
      },
    })

    expect(result.reply).toContain('隔离病叶')
    expect(createMock).toHaveBeenCalledTimes(1)

    const sentPayload = createMock.mock.calls[0]?.[0] as { messages?: Array<{ role: string; content: string }> }
    const systemBlock = (sentPayload.messages ?? [])
      .filter((item) => item.role === 'system')
      .map((item) => item.content)
      .join('\n')

    expect(systemBlock).toContain('角色包')
    expect(systemBlock).toContain('诊断上下文')
    expect(systemBlock).toContain('记忆上下文')
  })
})
