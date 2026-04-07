import { afterEach, describe, expect, test } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createComfyuiService } from '../lib/comfyuiService'
import { createSpiritGenerationConfig } from '../lib/spiritGenerationConfig'

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

const createUiWorkflowTemplate = () => ({
  last_node_id: 27,
  last_link_id: 41,
  nodes: [
    {
      id: 4,
      type: 'CheckpointLoaderSimple',
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [13, 37] },
        { name: 'CLIP', type: 'CLIP', links: [38] },
        { name: 'VAE', type: 'VAE', links: [15] },
      ],
      widgets_values: ['demo.safetensors'],
    },
    {
      id: 27,
      type: 'WeiLinPromptUI',
      inputs: [
        { name: 'opt_text', type: '*', link: null },
        { name: 'opt_clip', type: 'CLIP', link: 38 },
        { name: 'opt_model', type: 'MODEL', link: 37 },
      ],
      outputs: [
        { name: 'STRING', type: 'STRING', links: null },
        { name: 'CONDITIONING', type: 'CONDITIONING', links: [39] },
        { name: 'CLIP', type: 'CLIP', links: [41] },
        { name: 'MODEL', type: 'MODEL', links: [40] },
      ],
      widgets_values: [
        'anime, red hair, fixed girl, fixed character prompt',
        false,
        '',
        '',
        '',
        '',
        '',
        '',
      ],
    },
    {
      id: 7,
      type: 'CLIPTextEncode',
      inputs: [{ name: 'clip', type: 'CLIP', link: 41 }],
      outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [17] }],
      widgets_values: ['score_4, score_3, fixed negative prompt', true],
    },
    {
      id: 3,
      type: 'EmptyLatentImage',
      inputs: [],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [12] }],
      widgets_values: [768, 1024, 1],
    },
    {
      id: 8,
      type: 'KSampler',
      inputs: [
        { name: 'model', type: 'MODEL', link: 13 },
        { name: 'positive', type: 'CONDITIONING', link: 39 },
        { name: 'negative', type: 'CONDITIONING', link: 17 },
        { name: 'latent_image', type: 'LATENT', link: 12 },
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [14] }],
      widgets_values: [123456, 'fixed', 24, 7, 'euler', 'normal', 1],
    },
    {
      id: 9,
      type: 'VAEDecode',
      inputs: [
        { name: 'samples', type: 'LATENT', link: 14 },
        { name: 'vae', type: 'VAE', link: 15 },
      ],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [16] }],
      widgets_values: [],
    },
    {
      id: 10,
      type: 'SaveImage',
      inputs: [{ name: 'images', type: 'IMAGE', link: 16 }],
      outputs: [],
      widgets_values: ['summer-wood/spirit'],
    },
  ],
  links: [
    [37, 4, 0, 27, 2],
    [38, 4, 1, 27, 1],
    [41, 27, 2, 7, 0],
    [39, 27, 1, 8, 1],
    [17, 7, 0, 8, 2],
    [13, 4, 0, 8, 0],
    [12, 3, 0, 8, 3],
    [14, 8, 0, 9, 0],
    [15, 4, 2, 9, 1],
    [16, 9, 0, 10, 0],
  ],
})

const createObjectInfoPayload = () => ({
  CheckpointLoaderSimple: { input_order: { required: [], optional: [] } },
  WeiLinPromptUI: { input_order: { required: ['opt_text', 'opt_clip', 'opt_model'], optional: [] } },
  CLIPTextEncode: { input_order: { required: ['text', 'clip'], optional: [] } },
  EmptyLatentImage: { input_order: { required: ['width', 'height', 'batch_size'], optional: [] } },
  KSampler: { input_order: { required: ['seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'], optional: [] } },
  VAEDecode: { input_order: { required: [], optional: [] } },
  SaveImage: { input_order: { required: ['filename_prefix'], optional: [] } },
})

const createDiagnosisPayload = ({
  name,
  category,
  symptomTags,
  evidenceTags,
  hostPlant,
  riskLevel,
}: {
  name: string
  category: string
  symptomTags: string[]
  evidenceTags: string[]
  hostPlant: string
  riskLevel: string
}) => ({
  name,
  keywords: [...symptomTags],
  diagnosisResult: {
    diagnosis: {
      name,
      category,
      symptom_tags: symptomTags,
      evidence_tags: evidenceTags,
      host_plant: hostPlant,
      risk_level: riskLevel,
      confidence: 0.92,
    },
    rolePack: {
      id: category === '病害' ? 'disease-guardian' : 'pest-scout',
      name: category === '病害' ? '病害诊断员' : '虫害观察员',
      style: '校园植保陪伴',
      persona: '根据识图标签生成角色',
      guardrails: ['诊断语义优先'],
    },
    styleMode: 'campus_anime',
  },
  rolePack: {
    id: category === '病害' ? 'disease-guardian' : 'pest-scout',
    name: category === '病害' ? '病害诊断员' : '虫害观察员',
    style: '校园植保陪伴',
    persona: '根据识图标签生成角色',
    guardrails: ['诊断语义优先'],
  },
  styleMode: 'campus_anime',
})

describe('comfyui diagnosis-driven prompt alignment', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    tempDirs.splice(0).forEach((dir) => {
      rmSync(dir, { recursive: true, force: true })
    })
  })

  test('injects diagnosis-driven prompt into workflow and should not keep fixed WeiLin template prompt', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'summer-wood-comfy-'))
    tempDirs.push(tempDir)
    const workflowPath = join(tempDir, 'workflow.json')
    writeFileSync(workflowPath, JSON.stringify(createUiWorkflowTemplate(), null, 2), 'utf8')

    const submittedGraphs: Array<Record<string, unknown>> = []

    const service = createComfyuiService({
      baseUrl: 'http://mock-comfyui.local',
      workflowPath,
      checkpoint: 'demo.safetensors',
      fetchImpl: async (url, init) => {
        const href = String(url)
        if (href.endsWith('/models/checkpoints')) {
          return jsonResponse(['demo.safetensors'])
        }
        if (href.endsWith('/object_info')) {
          return jsonResponse(createObjectInfoPayload())
        }
        if (href.endsWith('/prompt')) {
          const body = init?.body ? JSON.parse(String(init.body)) : {}
          submittedGraphs.push((body.prompt ?? {}) as Record<string, unknown>)
          return jsonResponse({ prompt_id: `prompt-${submittedGraphs.length}` })
        }
        if (href.includes('/history/')) {
          const promptId = href.split('/history/')[1]
          return jsonResponse({
            [promptId]: {
              outputs: {
                '10': {
                  images: [{ filename: `out-${promptId}.png`, type: 'output', subfolder: '' }],
                },
              },
            },
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const result = await service.generateSpiritPortrait(
      createDiagnosisPayload({
        name: '蚜虫',
        category: '虫害',
        symptomTags: ['卷叶', '聚集', '吸汁'],
        evidenceTags: ['tiny green clustered pest'],
        hostPlant: '月季',
        riskLevel: 'high',
      }),
    )

    const graph = submittedGraphs[0] as Record<string, { class_type?: string; inputs?: { text?: string; opt_text?: string } }>
    const node27Prompt = String(graph?.['27']?.inputs?.opt_text ?? '')
    const node7Negative = String(graph?.['7']?.inputs?.text ?? '')

    expect(node27Prompt).toContain('蚜虫')
    expect(node27Prompt.toLowerCase()).toContain('insect-inspired')
    expect(node27Prompt.toLowerCase()).not.toContain('red hair')
    expect(result.prompt.toLowerCase()).toContain('insect-inspired')
    expect(node7Negative.length).toBeGreaterThan(0)
    expect(result.personaDesignJson).toBeTruthy()
    expect(String(result.personaDesignJson?.core_concept ?? '').length).toBeGreaterThan(0)
    expect(Array.isArray(result.personaDesignJson?.color_palette)).toBe(true)
    expect(result.promptStages?.visualMapping).toBeTruthy()
    expect(result.promptStages?.promptGeneration).toBeTruthy()
  })

  test('switches prompt strategy by diagnosis category between pest and disease', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'summer-wood-comfy-'))
    tempDirs.push(tempDir)
    const workflowPath = join(tempDir, 'workflow.json')
    writeFileSync(workflowPath, JSON.stringify(createUiWorkflowTemplate(), null, 2), 'utf8')

    const submittedGraphs: Array<Record<string, unknown>> = []

    const service = createComfyuiService({
      baseUrl: 'http://mock-comfyui.local',
      workflowPath,
      checkpoint: 'demo.safetensors',
      fetchImpl: async (url, init) => {
        const href = String(url)
        if (href.endsWith('/models/checkpoints')) {
          return jsonResponse(['demo.safetensors'])
        }
        if (href.endsWith('/object_info')) {
          return jsonResponse(createObjectInfoPayload())
        }
        if (href.endsWith('/prompt')) {
          const body = init?.body ? JSON.parse(String(init.body)) : {}
          submittedGraphs.push((body.prompt ?? {}) as Record<string, unknown>)
          return jsonResponse({ prompt_id: `prompt-${submittedGraphs.length}` })
        }
        if (href.includes('/history/')) {
          const promptId = href.split('/history/')[1]
          return jsonResponse({
            [promptId]: {
              outputs: {
                '10': {
                  images: [{ filename: `out-${promptId}.png`, type: 'output', subfolder: '' }],
                },
              },
            },
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const pest = await service.generateSpiritPortrait(
      createDiagnosisPayload({
        name: '蚜虫',
        category: '虫害',
        symptomTags: ['卷叶', '聚集', '吸汁'],
        evidenceTags: ['tiny green clustered pest'],
        hostPlant: '月季',
        riskLevel: 'high',
      }),
    )
    const disease = await service.generateSpiritPortrait(
      createDiagnosisPayload({
        name: '白粉病',
        category: '病害',
        symptomTags: ['白粉', '黄化', '扩散'],
        evidenceTags: ['white powdery fungal infection'],
        hostPlant: '黄瓜',
        riskLevel: 'high',
      }),
    )

    expect(pest.prompt).toContain('蚜虫')
    expect(pest.prompt.toLowerCase()).toContain('insect-inspired')
    expect(pest.prompt.toLowerCase()).not.toContain('disease-inspired')
    expect(disease.prompt).toContain('白粉病')
    expect(disease.prompt.toLowerCase()).toContain('disease-inspired')
    expect(disease.prompt.toLowerCase()).not.toContain('insect-inspired')
    expect(pest.prompt).not.toBe(disease.prompt)
    expect(submittedGraphs.length).toBe(2)
  })

  test('adds species-specific anatomy anchors for aphid and ladybug personas', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'summer-wood-comfy-'))
    tempDirs.push(tempDir)
    const workflowPath = join(tempDir, 'workflow.json')
    writeFileSync(workflowPath, JSON.stringify(createUiWorkflowTemplate(), null, 2), 'utf8')

    const service = createComfyuiService({
      baseUrl: 'http://mock-comfyui.local',
      workflowPath,
      checkpoint: 'demo.safetensors',
      fetchImpl: async (url) => {
        const href = String(url)
        if (href.endsWith('/models/checkpoints')) {
          return jsonResponse(['demo.safetensors'])
        }
        if (href.endsWith('/object_info')) {
          return jsonResponse(createObjectInfoPayload())
        }
        if (href.endsWith('/prompt')) {
          return jsonResponse({ prompt_id: `prompt-${Date.now()}` })
        }
        if (href.includes('/history/')) {
          const promptId = href.split('/history/')[1]
          return jsonResponse({
            [promptId]: {
              outputs: {
                '10': {
                  images: [{ filename: `out-${promptId}.png`, type: 'output', subfolder: '' }],
                },
              },
            },
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const aphid = await service.generateSpiritPortrait(
      createDiagnosisPayload({
        name: '蚜虫',
        category: '虫害',
        symptomTags: ['卷叶', '聚集', '吸汁'],
        evidenceTags: ['tiny green clustered pest'],
        hostPlant: '月季',
        riskLevel: 'high',
      }),
    )

    const ladybug = await service.generateSpiritPortrait(
      createDiagnosisPayload({
        name: '瓢虫',
        category: '虫害',
        symptomTags: ['益虫', '鞘翅目', '红黑鞘翅'],
        evidenceTags: ['ladybug', 'beneficial predator', 'black spotted shell'],
        hostPlant: '校园月季',
        riskLevel: 'low',
      }),
    )

    expect(aphid.prompt.toLowerCase()).toContain('pear-shaped abdomen')
    expect(aphid.prompt.toLowerCase()).toContain('cornicle tailpipes')
    expect(aphid.prompt.toLowerCase()).toContain('slender segmented antennae')
    expect(ladybug.prompt.toLowerCase()).toContain('domed beetle shell')
    expect(ladybug.prompt.toLowerCase()).toContain('elytra')
    expect(ladybug.prompt.toLowerCase()).toContain('black spotted shell')
    expect(ladybug.negativePrompt.toLowerCase()).toContain('missing elytra')
  })

  test('routes insect diagnoses to the anatomy-oriented preset', () => {
    const config = createSpiritGenerationConfig({
      defaultWorkflowPath: join(tmpdir(), 'summer-wood-default-workflow.json'),
    })

    const aphid = config.resolvePayload({
      autoRoute: true,
      identifyTypeLabel: '昆虫',
      identifyRiskLevel: 'high',
      keywords: ['蚜虫', '卷叶', '吸汁', '聚集'],
    })

    const ladybug = config.resolvePayload({
      autoRoute: true,
      identifyTypeLabel: '昆虫',
      identifyRiskLevel: 'low',
      keywords: ['瓢虫', '益虫', '鞘翅目', '红黑鞘翅'],
    })

    expect(aphid.presetId).toBe('campus_green_mascot')
    expect(ladybug.presetId).toBe('campus_green_mascot')
  })

  test('patches node 27 positive and node 7 negative before submitting to ComfyUI', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'summer-wood-comfy-'))
    tempDirs.push(tempDir)
    const workflowPath = join(tempDir, 'workflow.json')
    writeFileSync(workflowPath, JSON.stringify(createUiWorkflowTemplate(), null, 2), 'utf8')

    const submittedGraphs: Array<Record<string, unknown>> = []

    const service = createComfyuiService({
      baseUrl: 'http://mock-comfyui.local',
      workflowPath,
      checkpoint: 'demo.safetensors',
      fetchImpl: async (url, init) => {
        const href = String(url)
        if (href.endsWith('/models/checkpoints')) {
          return jsonResponse(['demo.safetensors'])
        }
        if (href.endsWith('/object_info')) {
          return jsonResponse(createObjectInfoPayload())
        }
        if (href.endsWith('/prompt')) {
          const body = init?.body ? JSON.parse(String(init.body)) : {}
          submittedGraphs.push((body.prompt ?? {}) as Record<string, unknown>)
          return jsonResponse({ prompt_id: 'prompt-1' })
        }
        if (href.includes('/history/')) {
          return jsonResponse({
            'prompt-1': {
              outputs: {
                '10': {
                  images: [{ filename: 'out-prompt-1.png', type: 'output', subfolder: '' }],
                },
              },
            },
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const result = await service.generateSpiritPortrait(
      createDiagnosisPayload({
        name: '蚜虫',
        category: '虫害',
        symptomTags: ['卷叶', '聚集', '吸汁'],
        evidenceTags: ['tiny green clustered pest'],
        hostPlant: '月季',
        riskLevel: 'high',
      }),
    )

    const graph = submittedGraphs[0] as Record<string, { inputs?: { text?: string; opt_text?: string } }>
    const node27Prompt = String(graph?.['27']?.inputs?.opt_text ?? '')
    const node7Negative = String(graph?.['7']?.inputs?.text ?? '')

    expect(node27Prompt).toBe(result.prompt)
    expect(node7Negative).toBe(result.negativePrompt)
    expect(node27Prompt).not.toContain('fixed character prompt')
    expect(node7Negative).not.toContain('fixed negative prompt')
  })
})
