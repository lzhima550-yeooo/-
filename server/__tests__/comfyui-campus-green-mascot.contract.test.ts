import { afterEach, describe, expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildAnimePersonaPromptFromDiagnosis } from '../lib/spiritPersonaPromptBuilder.js'
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
        '<wlr:Expressive_H:0.5:0.5>, anime, generic girl',
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
      widgets_values: ['fixed negative prompt', true],
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

const createDiagnosisInput = ({
  name,
  symptomTags,
  evidenceTags,
  hostPlant,
  styleMode = 'campus_green_mascot',
}: {
  name: string
  symptomTags: string[]
  evidenceTags: string[]
  hostPlant: string
  styleMode?: string
}) => ({
  name,
  styleMode,
  diagnosisResult: {
    diagnosis: {
      name,
      category: '虫害',
      symptom_tags: symptomTags,
      evidence_tags: evidenceTags,
      host_plant: hostPlant,
      risk_level: 'high',
      confidence: 0.9,
    },
    styleMode,
  },
})

describe('campus_green_mascot prompt constraints', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    tempDirs.splice(0).forEach((dir) => {
      rmSync(dir, { recursive: true, force: true })
    })
    vi.restoreAllMocks()
  })

  test('builds cabbage caterpillar as campus chibi mascot with strict ratio constraints', () => {
    const built = buildAnimePersonaPromptFromDiagnosis(
      createDiagnosisInput({
        name: '菜青虫',
        symptomTags: ['绿色', '分节幼虫', '叶菜', '啃食'],
        evidenceTags: ['cabbage worm', 'caterpillar'],
        hostPlant: '白菜',
      }),
      {},
      'campus_green_mascot',
    )

    const positive = built.positivePrompt.toLowerCase()
    const negative = built.negativePrompt.toLowerCase()

    expect(positive).toContain('cabbage caterpillar-inspired chibi eco mascot')
    expect(positive).toContain('wholesome campus nature spirit')
    expect(positive).toContain('healthy green educational mascot')
    expect(positive).toContain('large head small body')
    expect(positive).toContain('head-to-body ratio around 1:2.5 to 1:3.5')
    expect(positive).toContain('short limbs')
    expect(positive).toContain('child-friendly mascot body ratio')
    expect(positive).toContain('full body')
    expect(positive).toContain('centered composition')
    expect(positive).toContain('fresh cabbage leaf pedestal')
    expect(positive).not.toContain('generic anime girl')

    expect(negative).toContain('sexy')
    expect(negative).toContain('adult body proportion')
    expect(negative).toContain('long legs')
    expect(negative).toContain('generic anime girl')
    expect(negative).toContain('monster girl')
    expect(negative).toContain('realistic woman ratio')
  })

  test('keeps aphid and ladybug in mascot mode instead of mature anime girl', () => {
    const aphid = buildAnimePersonaPromptFromDiagnosis(
      createDiagnosisInput({
        name: '蚜虫',
        symptomTags: ['绿色', '群聚', '吸汁', '叶背', '卷叶'],
        evidenceTags: ['aphid cluster', 'sap-sucking'],
        hostPlant: '月季',
      }),
      {},
      'campus_green_mascot',
    )
    const ladybug = buildAnimePersonaPromptFromDiagnosis(
      createDiagnosisInput({
        name: '七星瓢虫',
        symptomTags: ['红黑斑点', '甲壳', '小型'],
        evidenceTags: ['ladybug', 'seven-spot'],
        hostPlant: '校园花坛',
      }),
      {},
      'campus_green_mascot',
    )

    const aphidPositive = aphid.positivePrompt.toLowerCase()
    const aphidNegative = aphid.negativePrompt.toLowerCase()
    const ladybugPositive = ladybug.positivePrompt.toLowerCase()

    expect(aphidPositive).toContain('aphid-inspired chibi eco mascot')
    expect(aphidPositive).toContain('cluster ornaments')
    expect(aphidPositive).toContain('dew drop motif')
    expect(aphidPositive).toContain('leaf-curl hem')
    expect(aphidPositive).toContain('large head small body')
    expect(aphidNegative).toContain('mature silhouette')
    expect(aphidNegative).toContain('adult body proportion')

    expect(ladybugPositive).toContain('seven-spot ladybug-inspired chibi eco mascot')
    expect(ladybugPositive).toContain('red and black high-contrast palette')
    expect(ladybugPositive).toContain('rounded shell-like cape')
    expect(ladybugPositive).toContain('rounded silhouette')
    expect(ladybugPositive).toContain('child-friendly mascot body ratio')
  })

  test('removes incompatible lora tags and prints campus mascot logs and output spec', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'summer-wood-mascot-'))
    tempDirs.push(tempDir)
    const workflowPath = join(tempDir, 'workflow.json')
    writeFileSync(workflowPath, JSON.stringify(createUiWorkflowTemplate(), null, 2), 'utf8')

    const submittedGraphs: Array<Record<string, unknown>> = []
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

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
          return jsonResponse({ prompt_id: 'prompt-campus-green' })
        }
        if (href.includes('/history/')) {
          return jsonResponse({
            'prompt-campus-green': {
              outputs: {
                '10': {
                  images: [{ filename: 'campus-green.png', type: 'output', subfolder: '' }],
                },
              },
            },
          })
        }
        return jsonResponse({}, 404)
      },
    })

    const result = await service.generateSpiritPortrait(
      createDiagnosisInput({
        name: '菜青虫',
        symptomTags: ['绿色', '分节幼虫', '叶菜', '啃食'],
        evidenceTags: ['cabbage worm', 'caterpillar'],
        hostPlant: '白菜',
      }),
    )

    const graph = submittedGraphs[0] as Record<string, { inputs?: { opt_text?: string; text?: string } }>
    const node27Prompt = String(graph?.['27']?.inputs?.opt_text ?? '')
    expect(node27Prompt.toLowerCase()).toContain('wholesome campus nature spirit')
    expect(node27Prompt).not.toContain('<wlr:Expressive_H')

    const generationTraceCall = infoSpy.mock.calls.find((entry) => String(entry[0]) === '[comfyui] generation_trace')
    expect(generationTraceCall).toBeTruthy()

    const trace = JSON.parse(String(generationTraceCall?.[1] ?? '{}')) as Record<string, unknown>
    expect(String(trace.style_mode)).toBe('campus_green_mascot')
    expect(Array.isArray(trace.softened_insect_features)).toBe(true)
    expect(String(trace.host_plant_anchor).toLowerCase()).toContain('cabbage')
    expect(Array.isArray(trace.ratio_constraints)).toBe(true)
    expect(String(trace.finalPositivePrompt).toLowerCase()).toContain('large head small body')
    expect(String(trace.finalNegativePrompt).toLowerCase()).toContain('adult body proportion')
    expect(Array.isArray(trace.lora_tags_used)).toBe(true)
    expect((trace.lora_tags_used as string[]).length).toBe(0)
    expect((trace.output_spec as { aspect_ratio?: string }).aspect_ratio).toBe('3:4')

    expect(result.outputSpec.aspectRatio).toBe('3:4')
    expect(result.outputSpec.fullBodyRequired).toBe(true)
    expect(result.outputSpec.singleCharacter).toBe(true)
  })

  test('adds campus_green_mascot preset output spec defaults', () => {
    const config = createSpiritGenerationConfig({
      defaultWorkflowPath: join(tmpdir(), 'summer-wood-default-workflow.json'),
    })

    const payload = config.resolvePayload({
      presetId: 'campus_green_mascot',
    })

    expect(payload.presetId).toBe('campus_green_mascot')
    expect(payload.height).toBeGreaterThan(payload.width)
    expect(payload.outputSpec.aspectRatio).toBe('3:4')
    expect(payload.outputSpec.fullBodyRequired).toBe(true)
    expect(payload.outputSpec.singleCharacter).toBe(true)
    expect(payload.outputSpec.cleanBackgroundPreferred).toBe(true)
    expect(payload.outputSpec.hostPlantAnchorAllowed).toBe(true)
  })
})
