const toText = (value) => String(value ?? '').trim()
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toList = (value, max = 16) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, max)
}

const dedupe = (items) => Array.from(new Set((Array.isArray(items) ? items : []).map((item) => toText(item)).filter(Boolean)))

const clampConfidence = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0.5
  }
  return Math.max(0, Math.min(1, number))
}

const categoryAliases = {
  pest: '虫害',
  insect: '虫害',
  bug: '虫害',
  mite: '虫害',
  disease: '病害',
  fungal: '病害',
  fungus: '病害',
  mildew: '病害',
  physiology: '生理异常',
  physiological: '生理异常',
  imbalance: '生理异常',
}

const normalizeCategory = (value) => {
  const raw = toText(value)
  const lower = raw.toLowerCase()

  if (raw.includes('虫')) {
    return '虫害'
  }
  if (raw.includes('病')) {
    return '病害'
  }
  if (raw.includes('生理') || raw.includes('异常') || raw.includes('失衡')) {
    return '生理异常'
  }

  if (categoryAliases[lower]) {
    return categoryAliases[lower]
  }

  for (const [alias, category] of Object.entries(categoryAliases)) {
    if (lower.includes(alias)) {
      return category
    }
  }

  return ''
}

const normalizeRiskLevel = (value) => {
  const raw = toText(value)
  const lower = raw.toLowerCase()
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') {
    return lower
  }
  if (raw === '高') {
    return 'high'
  }
  if (raw === '中') {
    return 'medium'
  }
  if (raw === '低') {
    return 'low'
  }
  return ''
}

const inferCategory = ({ name, category, symptomTags, evidenceTags }) => {
  const normalized = normalizeCategory(category)
  if (normalized) {
    return normalized
  }

  const corpus = [name, ...symptomTags, ...evidenceTags].join(' ').toLowerCase()
  if (/病|霉|白粉|锈|腐烂|坏死|黄化|mildew|disease|fung|lesion|blight|rot|chlorosis|necrosis/.test(corpus)) {
    return '病害'
  }
  if (/虫|蚜|螨|飞虱|蓟马|介壳|咬食|吸汁|insect|pest|aphid|mite|thrips|scale/.test(corpus)) {
    return '虫害'
  }
  return '生理异常'
}

const normalizeRolePack = (input) => {
  const source = isRecord(input) ? input : {}
  return {
    id: toText(source.id),
    name: toText(source.name),
    style: toText(source.style),
    persona: toText(source.persona),
    guardrails: toList(source.guardrails, 12),
    visualKeywords: toList(source.visualKeywords ?? source.visual_keywords, 12),
    negativeKeywords: toList(source.negativeKeywords ?? source.negative_keywords, 16),
  }
}

const normalizeDiagnosisResult = (diagnosisResult) => {
  const source = isRecord(diagnosisResult) ? diagnosisResult : {}
  const diagnosis = isRecord(source.diagnosis) ? source.diagnosis : source

  const name = toText(diagnosis.name || source.name)
  const symptomTags = dedupe([
    ...toList(diagnosis.symptom_tags ?? diagnosis.symptomTags, 12),
    ...toList(diagnosis.keywords, 12),
  ]).slice(0, 12)
  const evidenceTags = dedupe([
    ...toList(diagnosis.evidence_tags ?? diagnosis.evidenceTags, 12),
    ...toList(source.evidence_tags ?? source.evidenceTags, 12),
  ]).slice(0, 12)
  const hostPlant = toText(diagnosis.host_plant ?? diagnosis.hostPlant ?? source.host_plant ?? source.hostPlant)
  const riskLevel = normalizeRiskLevel(diagnosis.risk_level ?? diagnosis.riskLevel ?? source.risk_level ?? source.riskLevel)
  const confidence = clampConfidence(diagnosis.confidence ?? source.confidence)
  const category = inferCategory({
    name,
    category: diagnosis.category ?? diagnosis.typeLabel ?? source.category ?? source.typeLabel,
    symptomTags,
    evidenceTags,
  })

  return {
    diagnosis: {
      name: name || '未知对象',
      category,
      symptom_tags: symptomTags,
      evidence_tags: evidenceTags,
      host_plant: hostPlant,
      risk_level: riskLevel || 'medium',
      confidence,
    },
  }
}

const pestCueRules = [
  { pattern: /蚜虫|aphid/, cue: 'tiny green clustered pest' },
  { pattern: /介壳|scale/, cue: 'shell-like armored body' },
  { pattern: /红蜘蛛|螨|mite/, cue: 'red micro predator vibe' },
  { pattern: /蓟马|thrips/, cue: 'slender fast-moving silhouette' },
  { pattern: /飞虱|leafhopper|planthopper/, cue: 'jumping winged movement' },
  { pattern: /吸汁|sap/, cue: 'sap-sucking damage marks' },
  { pattern: /啃食|咬食|chew/, cue: 'leaf-chewing edge traces' },
  { pattern: /潜叶|leaf mine/, cue: 'leaf-mining tunnel motifs' },
  { pattern: /群聚|聚集|cluster/, cue: 'clustered repetitive micro motifs' },
  { pattern: /附着|attach/, cue: 'sticky adhesion details' },
  { pattern: /飞行|swarm|flying/, cue: 'fluttering wing rhythm' },
  { pattern: /爬行|crawl/, cue: 'creeping joint movement' },
  { pattern: /卷叶|curl/, cue: 'curled leaf edge forms' },
  { pattern: /虫孔|hole/, cue: 'hollow puncture decorations' },
]

const diseaseCueRules = [
  { pattern: /白粉|powdery/, cue: 'powder mist layering' },
  { pattern: /霉|mold|mildew/, cue: 'mold veil spread texture' },
  { pattern: /坏死|necrosis|necrotic/, cue: 'dark necrotic edge pattern' },
  { pattern: /黄化|chlorosis|yellow/, cue: 'pale yellow fading gradient' },
  { pattern: /水渍|water-soaked|wet/, cue: 'watery translucent stain effect' },
  { pattern: /病斑|斑|lesion|spot/, cue: 'spot-cluster disease symbols' },
  { pattern: /扩散|蔓延|spread/, cue: 'radiating spread lines' },
  { pattern: /卷叶|curl/, cue: 'spiral curled silhouette' },
]

const physiologicalCueRules = [
  { pattern: /黄化|chlorosis|yellow/, cue: 'nutrient-deficiency pale tones' },
  { pattern: /焦边|burnt|scorch/, cue: 'burnt edge gradient' },
  { pattern: /萎蔫|wilt/, cue: 'drooping contour language' },
  { pattern: /徒长|etiolation/, cue: 'elongated weak silhouette' },
  { pattern: /积水|waterlog/, cue: 'heavy moisture drag texture' },
  { pattern: /失衡|imbalance/, cue: 'asymmetric balance motifs' },
]

const collectCues = (category, tags) => {
  const corpus = tags.join(' ')
  const rules = category === '病害' ? diseaseCueRules : category === '生理异常' ? physiologicalCueRules : pestCueRules
  const matched = []
  rules.forEach((rule) => {
    if (rule.pattern.test(corpus)) {
      matched.push(rule.cue)
    }
  })
  return dedupe(matched).slice(0, 10)
}

const defaultInsectMorphologyProfile = {
  anatomyAnchors: ['species-accurate insect anatomy', 'segmented arthropod limbs', 'visible antennae'],
  behaviorAnchors: ['species-accurate insect posture'],
  colorPalette: [],
  silhouette: ['arthropod body segmentation'],
  hairDesign: [],
  outfitElements: [],
  accessoryElements: [],
  textureMaterials: ['layered insect cuticle'],
  symbolicMotifs: [],
  forbiddenElements: ['plain school uniform', 'fully human silhouette'],
  negativeAnatomy: ['generic human hairstyle', 'plain school uniform', 'missing antennae', 'missing segmented arthropod limbs'],
}

const insectMorphologyProfiles = [
  {
    pattern: /蚜虫|aphid/,
    anatomyAnchors: ['slender segmented antennae', 'pear-shaped abdomen', 'cornicle tailpipes'],
    behaviorAnchors: ['clustered sap-sucking posture'],
    colorPalette: ['aphid green translucent body'],
    silhouette: ['pear-shaped abdomen profile'],
    hairDesign: ['fine antennae crest'],
    outfitElements: ['cornicle-tailpipe waist ornament'],
    accessoryElements: ['sap-droplet diagnostic charm'],
    textureMaterials: ['soft translucent cuticle'],
    symbolicMotifs: ['clustered aphid colony dots'],
    forbiddenElements: ['fully human cardigan silhouette'],
    negativeAnatomy: ['missing pear-shaped abdomen', 'missing cornicle tailpipes'],
  },
  {
    pattern: /瓢虫|ladybug|ladybird/,
    anatomyAnchors: ['domed beetle shell', 'elytra', 'black spotted shell'],
    behaviorAnchors: ['compact beetle stance'],
    colorPalette: ['glossy red shell with black spots'],
    silhouette: ['domed beetle shell profile'],
    hairDesign: ['short antennae crown'],
    outfitElements: ['split elytra cape'],
    accessoryElements: ['black spotted shell brooch'],
    textureMaterials: ['polished beetle shell'],
    symbolicMotifs: ['elytra seam line', 'black spotted shell pattern'],
    forbiddenElements: ['flat human blazer silhouette'],
    negativeAnatomy: ['missing elytra', 'missing spotted shell'],
  },
  {
    pattern: /介壳|scale/,
    anatomyAnchors: ['armored scale shell', 'attached shield-like back plate'],
    behaviorAnchors: ['static clustered infestation posture'],
    textureMaterials: ['waxy armored shell texture'],
    symbolicMotifs: ['shield-shell colony marks'],
    negativeAnatomy: ['missing armored shell'],
  },
  {
    pattern: /红蜘蛛|螨|mite/,
    anatomyAnchors: ['eight-limbed mite silhouette', 'tiny red orb abdomen'],
    behaviorAnchors: ['rapid web-spinning stance'],
    textureMaterials: ['fine silk web texture'],
    symbolicMotifs: ['mite-web radial lines'],
    negativeAnatomy: ['missing mite limb count'],
  },
  {
    pattern: /蓟马|thrips/,
    anatomyAnchors: ['needle-thin insect body', 'fringed narrow wings'],
    behaviorAnchors: ['fast darting thrips posture'],
    silhouette: ['needle-thin insect silhouette'],
    negativeAnatomy: ['missing fringed wings'],
  },
]

const collectInsectMorphology = (category, tags) => {
  if (category !== '虫害') {
    return {
      anatomyAnchors: [],
      behaviorAnchors: [],
      colorPalette: [],
      silhouette: [],
      hairDesign: [],
      outfitElements: [],
      accessoryElements: [],
      textureMaterials: [],
      symbolicMotifs: [],
      forbiddenElements: [],
      negativeAnatomy: [],
    }
  }

  const corpus = tags.join(' ').toLowerCase()
  const merged = {
    anatomyAnchors: [...defaultInsectMorphologyProfile.anatomyAnchors],
    behaviorAnchors: [...defaultInsectMorphologyProfile.behaviorAnchors],
    colorPalette: [...defaultInsectMorphologyProfile.colorPalette],
    silhouette: [...defaultInsectMorphologyProfile.silhouette],
    hairDesign: [...defaultInsectMorphologyProfile.hairDesign],
    outfitElements: [...defaultInsectMorphologyProfile.outfitElements],
    accessoryElements: [...defaultInsectMorphologyProfile.accessoryElements],
    textureMaterials: [...defaultInsectMorphologyProfile.textureMaterials],
    symbolicMotifs: [...defaultInsectMorphologyProfile.symbolicMotifs],
    forbiddenElements: [...defaultInsectMorphologyProfile.forbiddenElements],
    negativeAnatomy: [...defaultInsectMorphologyProfile.negativeAnatomy],
  }

  insectMorphologyProfiles.forEach((profile) => {
    if (!profile.pattern.test(corpus)) {
      return
    }

    merged.anatomyAnchors.push(...toList(profile.anatomyAnchors, 8))
    merged.behaviorAnchors.push(...toList(profile.behaviorAnchors, 8))
    merged.colorPalette.push(...toList(profile.colorPalette, 6))
    merged.silhouette.push(...toList(profile.silhouette, 6))
    merged.hairDesign.push(...toList(profile.hairDesign, 6))
    merged.outfitElements.push(...toList(profile.outfitElements, 6))
    merged.accessoryElements.push(...toList(profile.accessoryElements, 6))
    merged.textureMaterials.push(...toList(profile.textureMaterials, 6))
    merged.symbolicMotifs.push(...toList(profile.symbolicMotifs, 6))
    merged.forbiddenElements.push(...toList(profile.forbiddenElements, 6))
    merged.negativeAnatomy.push(...toList(profile.negativeAnatomy, 8))
  })

  return {
    anatomyAnchors: dedupe(merged.anatomyAnchors).slice(0, 8),
    behaviorAnchors: dedupe(merged.behaviorAnchors).slice(0, 6),
    colorPalette: dedupe(merged.colorPalette).slice(0, 6),
    silhouette: dedupe(merged.silhouette).slice(0, 6),
    hairDesign: dedupe(merged.hairDesign).slice(0, 6),
    outfitElements: dedupe(merged.outfitElements).slice(0, 6),
    accessoryElements: dedupe(merged.accessoryElements).slice(0, 6),
    textureMaterials: dedupe(merged.textureMaterials).slice(0, 6),
    symbolicMotifs: dedupe(merged.symbolicMotifs).slice(0, 6),
    forbiddenElements: dedupe(merged.forbiddenElements).slice(0, 8),
    negativeAnatomy: dedupe(merged.negativeAnatomy).slice(0, 10),
  }
}

const resolveCategoryDefaults = (category) => {
  if (category === '病害') {
    return {
      coreConceptSuffix: '病害症状灵化角色',
      designDirection: '症状扩散与覆盖感的植物幻想角色',
      colorPalette: ['灰白粉雾', '病斑黄褐', '低饱和墨绿'],
      silhouette: ['扩散型层叠轮廓', '带卷曲边缘的披风线条'],
      hairDesign: ['雾化渐变发束', '粉层状发饰'],
      outfitElements: ['层叠轻纱外披', '病斑纹理裙摆', '叶脉裂纹缝线'],
      accessoryElements: ['孢子环饰', '菌丝纹徽章'],
      textureMaterials: ['粉雾颗粒感', '潮湿霉层质地'],
      symbolicMotifs: ['扩散环形纹', '病斑点阵', '侵染边缘'],
      temperament: ['冷静', '压抑'],
      pose: ['侧身观察', '缓慢扩散式手势'],
      forbiddenElements: ['昆虫甲壳主体', '元气校园制服模板'],
      prototypeTag: 'disease-inspired botanical fantasy character',
      antiTraits: ['insect swarm as main subject', 'no disease traits'],
    }
  }

  if (category === '生理异常') {
    return {
      coreConceptSuffix: '生理失衡灵化角色',
      designDirection: '植物失衡状态拟人化角色',
      colorPalette: ['失绿黄', '干枯褐', '暗叶绿'],
      silhouette: ['失衡倾斜轮廓', '细长与下垂并存的线条'],
      hairDesign: ['枯叶层次发束', '不对称叶片发饰'],
      outfitElements: ['缺素裂纹纹理', '焦边层叠裙摆', '水分失衡腰封'],
      accessoryElements: ['滴水纹坠饰', '缺素符号臂环'],
      textureMaterials: ['干湿对比肌理', '纤维化叶脉纹理'],
      symbolicMotifs: ['失衡刻线', '萎蔫曲线', '缺素斑块'],
      temperament: ['疲惫', '克制'],
      pose: ['支撑式站姿', '低重心防护姿态'],
      forbiddenElements: ['夸张幻想铠甲', '无关虫体元素'],
      prototypeTag: 'physiological-stress-inspired anime character',
      antiTraits: ['no botanical motifs', 'generic anime girl'],
    }
  }

  return {
    coreConceptSuffix: '虫害灵化角色',
    designDirection: '虫体结构与危害行为驱动的拟人角色',
    colorPalette: ['虫体主色', '植物受害色', '高对比警示色'],
    silhouette: ['圆润壳面与细肢结合轮廓', '附着/群聚感边缘结构'],
    hairDesign: ['触角意象发饰', '节肢分段发束'],
    outfitElements: ['甲壳质感肩甲', '卷边叶片裙摆', '镂空虫孔装饰'],
    accessoryElements: ['透明翼状披饰', '群聚点阵挂饰'],
    textureMaterials: ['甲壳光泽', '叶面蜡质与纤维纹理'],
    symbolicMotifs: ['吸汁刺针符号', '虫孔图案', '群聚重复纹'],
    temperament: ['敏捷', '狡黠'],
    pose: ['前倾侦查姿态', '贴附式平衡动作'],
    forbiddenElements: ['病斑扩散主体', '固定红发模板角色'],
    prototypeTag: 'insect-inspired botanical fantasy character',
    antiTraits: ['no insect traits', 'fixed template character'],
  }
}

const CAMPUS_GREEN_MASCOT_MODE = 'campus_green_mascot'

const campusGreenMascotStyleKeywords = [
  'wholesome campus nature spirit',
  'healthy green educational mascot',
  'child-friendly eco character',
  'cute botanical insect spirit',
  'soft pastel illustration',
  'chibi anime mascot',
  'clean and gentle visual tone',
]

const campusGreenMascotTemperament = ['innocent', 'gentle', 'quiet', 'friendly', 'non-threatening', 'soft', 'approachable']

const campusGreenMascotRatioConstraints = [
  'chibi proportion',
  'large head small body',
  'head-to-body ratio around 1:2.5 to 1:3.5',
  'short limbs',
  'small hands and feet',
  'soft rounded form',
  'child-friendly mascot body ratio',
]

const campusGreenMascotCompositionConstraints = [
  'full body',
  'centered composition',
  'simple clean background',
  'low clutter',
  'single character focus',
  'no dynamic battle pose',
  'no perspective exaggeration',
  'no dramatic foreshortening',
]

const campusGreenMascotSilhouetteConstraints = ['rounded silhouette', 'low visual aggression', 'soft edges', 'compact body shape']

const campusGreenMascotNegativeKeywords = [
  'sexy',
  'mature',
  'mature woman',
  'seductive',
  'adult body proportion',
  'adult proportion',
  'long legs',
  'long torso',
  'long limbs',
  'mature torso',
  'mature silhouette',
  'realistic anatomy',
  'realistic human figure ratio',
  'realistic woman ratio',
  'fashion model proportion',
  'fashion-model silhouette',
  'sexy anatomy',
  'revealing clothes',
  'seductive pose',
  'nsfw',
  'dark horror',
  'dark horror insect',
  'monster girl',
  'body horror',
  'realistic insect horror',
  'realistic insect mouth',
  'multiple insect legs',
  'creepy anatomy',
  'aggressive',
  'aggressive expression',
  'combat style',
  'gothic',
  'armor',
  'weapon',
  'dark background',
  'overdecorated costume',
  'generic fantasy princess',
  'generic anime girl',
  'idol outfit',
  'dramatic pose',
  'battle scene',
]

const isCampusGreenMascotMode = (styleMode) => toText(styleMode).toLowerCase() === CAMPUS_GREEN_MASCOT_MODE

const resolveStyleTokens = (styleMode, rolePack) => {
  const styleKey = toText(styleMode).toLowerCase()
  const tokens = []
  if (styleKey.includes('science') || styleKey.includes('card')) {
    tokens.push('clean educational character-sheet composition')
  }
  if (isCampusGreenMascotMode(styleMode)) {
    tokens.push(...campusGreenMascotStyleKeywords)
  } else if (styleKey.includes('campus')) {
    tokens.push('campus plant-protection anime atmosphere')
  }
  if (styleKey.includes('portrait')) {
    tokens.push('portrait-focused framing')
  }
  if (tokens.length === 0) {
    tokens.push('anime character concept art')
  }
  if (rolePack.style) {
    tokens.push(rolePack.style)
  }
  if (rolePack.persona) {
    tokens.push(rolePack.persona)
  }
  tokens.push(...rolePack.visualKeywords)
  return dedupe(tokens).slice(0, 16)
}

const buildDiagnosisCorpus = (diagnosis) =>
  dedupe([diagnosis?.name, ...(diagnosis?.symptom_tags ?? []), ...(diagnosis?.evidence_tags ?? []), diagnosis?.host_plant])
    .join(' ')
    .toLowerCase()

const resolveHostPlantAnchor = ({ hostPlant, fallback }) => {
  const host = toText(hostPlant)
  if (!host) {
    return fallback
  }

  return `${host} leafy platform`
}

const resolveCampusMascotProfile = (diagnosis) => {
  const corpus = buildDiagnosisCorpus(diagnosis)
  const hasCabbageCaterpillar = /菜青虫|cabbage caterpillar|cabbage worm|pieris|brassica/.test(corpus)
  const hasAphid = /蚜虫|aphid/.test(corpus)
  const hasLadybug = /七星瓢虫|瓢虫|ladybug|ladybird|coccinella/.test(corpus)
  const hasSegmentation = /分节|segmented|larva|caterpillar/.test(corpus)
  const hasAntenna = /触角|antenna/.test(corpus)
  const hasShell = /甲壳|鞘翅|shell|elytra/.test(corpus)
  const hasWing = /翅|wing/.test(corpus)
  const hasCluster = /群聚|聚集|cluster/.test(corpus)
  const hasSapSucking = /吸汁|sap/.test(corpus)
  const hasChew = /啃食|咀嚼|chew/.test(corpus)
  const hasLeafCurl = /卷叶|leaf.?curl|curl/.test(corpus)

  if (hasCabbageCaterpillar) {
    return {
      prototype: 'cabbage caterpillar-inspired chibi eco mascot',
      mainPalette: ['tender green and pale yellow-green palette'],
      softenedInsectFeatures: [
        'soft rounded segmented caterpillar tail',
        'cute round antenna headband',
        'simple leaf-inspired dress',
        'soft spiral lower-body motif',
        'leaf-edge motif as playful pattern',
        'big bright green eyes',
        'innocent smile',
        'gentle mascot posture',
      ],
      hostPlantAnchor: 'fresh cabbage leaf pedestal',
    }
  }

  if (hasAphid) {
    return {
      prototype: 'aphid-inspired chibi eco mascot',
      mainPalette: ['fresh leaf-green and mint palette'],
      softenedInsectFeatures: [
        'small rounded body with compact silhouette',
        'soft antenna accessory',
        'cluster ornaments',
        'dew drop motif',
        'leaf-curl hem',
        'friendly leaf-back helper posture',
      ],
      hostPlantAnchor: resolveHostPlantAnchor({
        hostPlant: diagnosis?.host_plant,
        fallback: 'leaf-back host plant platform',
      }),
    }
  }

  if (hasLadybug) {
    return {
      prototype: 'seven-spot ladybug-inspired chibi eco mascot',
      mainPalette: ['red and black high-contrast palette'],
      softenedInsectFeatures: [
        'rounded shell-like cape',
        'black spotted shell pattern',
        'compact rounded body',
        'tiny antenna headband',
        'friendly classroom-garden mascot posture',
      ],
      hostPlantAnchor: resolveHostPlantAnchor({
        hostPlant: diagnosis?.host_plant,
        fallback: 'leaf throne platform',
      }),
    }
  }

  const softenedInsectFeatures = []
  if (hasSegmentation) {
    softenedInsectFeatures.push('rounded segmented tail motif')
  }
  if (hasAntenna) {
    softenedInsectFeatures.push('soft antenna accessory')
  }
  if (hasShell) {
    softenedInsectFeatures.push('rounded shell-like cape')
  }
  if (hasWing) {
    softenedInsectFeatures.push('translucent wing-like shawl')
  }
  if (hasCluster) {
    softenedInsectFeatures.push('repeating bead ornaments')
  }
  if (hasSapSucking) {
    softenedInsectFeatures.push('dew drop motif')
  }
  if (hasChew) {
    softenedInsectFeatures.push('leaf-edge motif pattern')
  }
  if (hasLeafCurl) {
    softenedInsectFeatures.push('leaf-curl hem')
  }

  return {
    prototype: 'insect-inspired chibi eco mascot',
    mainPalette: ['fresh botanical green palette'],
    softenedInsectFeatures: dedupe([
      ...softenedInsectFeatures,
      'cute botanical helper accessories',
      'gentle mascot posture',
      'big bright eyes',
      'friendly smile',
    ]),
    hostPlantAnchor: resolveHostPlantAnchor({
      hostPlant: diagnosis?.host_plant,
      fallback: 'leafy host-plant platform',
    }),
  }
}

const buildCampusGreenMascotPromptSet = ({ diagnosis, styleTokens, rolePack, negativeAnatomy, persona }) => {
  const profile = resolveCampusMascotProfile(diagnosis)
  const positiveTokens = dedupe([
    profile.prototype,
    ...campusGreenMascotStyleKeywords,
    ...profile.mainPalette,
    ...profile.softenedInsectFeatures,
    profile.hostPlantAnchor,
    ...campusGreenMascotTemperament,
    ...campusGreenMascotRatioConstraints,
    ...campusGreenMascotCompositionConstraints,
    ...campusGreenMascotSilhouetteConstraints,
    ...toList(persona.symbolic_motifs, 6),
    ...styleTokens,
  ])

  const negativeTokens = dedupe([
    ...campusGreenMascotNegativeKeywords,
    ...negativeAnatomy,
    ...toList(persona.forbidden_elements, 12),
    ...toList(rolePack.negativeKeywords, 16),
    'worst quality',
    'lowres',
    'blurry',
    'text',
    'watermark',
    'logo',
    'bad anatomy',
    'deformed',
    'extra fingers',
  ])

  return {
    positivePrompt: positiveTokens.slice(0, 96).join(', '),
    negativePrompt: negativeTokens.slice(0, 96).join(', '),
    softenedInsectFeatures: profile.softenedInsectFeatures.slice(0, 24),
    hostPlantAnchor: profile.hostPlantAnchor,
    ratioConstraints: [...campusGreenMascotRatioConstraints],
  }
}

const buildKeywordDrivenVisuals = ({ category, allTags, cues, defaults }) => {
  const palette = [...defaults.colorPalette]
  const silhouette = [...defaults.silhouette]
  const outfit = [...defaults.outfitElements]
  const accessories = [...defaults.accessoryElements]
  const materials = [...defaults.textureMaterials]
  const motifs = [...defaults.symbolicMotifs]

  const corpus = allTags.join(' ')

  if (/红黑|red black/.test(corpus)) {
    palette.push('红黑高对比配色')
    motifs.push('波点图案')
    silhouette.push('圆润壳面轮廓')
  }
  if (/白粉|powder/.test(corpus)) {
    palette.push('灰白粉雾色')
    materials.push('轻纱粉雾质感')
  }
  if (/卷叶|curl/.test(corpus)) {
    silhouette.push('卷边螺旋轮廓')
    outfit.push('卷边裙摆结构')
  }
  if (/虫孔|hole/.test(corpus)) {
    outfit.push('镂空破边叶片装饰')
    motifs.push('孔洞环形符号')
  }
  if (/群聚|聚集|cluster/.test(corpus)) {
    accessories.push('成簇重复挂饰')
    motifs.push('黏附重复图样')
  }
  if (/甲壳|shell/.test(corpus)) {
    silhouette.push('硬质壳面披肩')
    materials.push('壳面高光材质')
  }
  if (/透明翅|翅|wing/.test(corpus)) {
    accessories.push('透明翼状披肩')
    materials.push('轻薄层叠膜质')
  }

  if (category === '病害' && /潮湿|闷|湿/.test(corpus)) {
    materials.push('潮湿凝结质感')
    motifs.push('闷热气流纹')
  }

  return {
    color_palette: dedupe([...palette, ...cues]).slice(0, 8),
    silhouette: dedupe(silhouette).slice(0, 6),
    outfit_elements: dedupe(outfit).slice(0, 8),
    accessory_elements: dedupe(accessories).slice(0, 6),
    texture_materials: dedupe(materials).slice(0, 6),
    symbolic_motifs: dedupe(motifs).slice(0, 8),
  }
}

export function buildPersonaDesignFromDiagnosis(diagnosisResult, rolePackInput, styleModeInput) {
  const normalizedDiagnosis = normalizeDiagnosisResult(diagnosisResult)
  const rolePack = normalizeRolePack(rolePackInput ?? diagnosisResult?.rolePack)
  const styleMode = toText(styleModeInput ?? diagnosisResult?.styleMode)
  const diagnosis = normalizedDiagnosis.diagnosis

  const defaults = resolveCategoryDefaults(diagnosis.category)
  const allTags = dedupe([diagnosis.name, ...diagnosis.symptom_tags, ...diagnosis.evidence_tags]).slice(0, 20)
  const cues = collectCues(diagnosis.category, allTags)
  const insectMorphology = collectInsectMorphology(diagnosis.category, allTags)
  const visuals = buildKeywordDrivenVisuals({
    category: diagnosis.category,
    allTags,
    cues,
    defaults,
  })

  const styleTokens = resolveStyleTokens(styleMode, rolePack)
  const coreConcept = `${diagnosis.name}的${defaults.coreConceptSuffix}`
  const designDirection = `${defaults.designDirection}，并融合${diagnosis.host_plant || '校园植物'}语义`

  const personaDesignJson = {
    core_concept: coreConcept,
    design_direction: designDirection,
    color_palette: dedupe([...insectMorphology.colorPalette, ...visuals.color_palette]).slice(0, 8),
    silhouette: dedupe([...insectMorphology.silhouette, ...visuals.silhouette]).slice(0, 6),
    hair_design: dedupe([...insectMorphology.hairDesign, ...defaults.hairDesign, ...cues]).slice(0, 6),
    outfit_elements: dedupe([...insectMorphology.outfitElements, ...visuals.outfit_elements]).slice(0, 8),
    accessory_elements: dedupe([...insectMorphology.accessoryElements, ...visuals.accessory_elements]).slice(0, 6),
    texture_materials: dedupe([...insectMorphology.textureMaterials, ...visuals.texture_materials]).slice(0, 6),
    symbolic_motifs: dedupe([...insectMorphology.symbolicMotifs, ...visuals.symbolic_motifs]).slice(0, 8),
    temperament: dedupe(defaults.temperament).slice(0, 4),
    pose: dedupe(defaults.pose).slice(0, 4),
    anatomy_anchors: insectMorphology.anatomyAnchors,
    behavior_anchors: insectMorphology.behaviorAnchors,
    negative_anatomy: insectMorphology.negativeAnatomy,
    forbidden_elements: dedupe([
      ...insectMorphology.forbiddenElements,
      ...defaults.forbiddenElements,
      'generic anime girl',
      'random school uniform',
      'fixed template character',
    ]).slice(0, 10),
    style_tokens: styleTokens,
  }

  return {
    personaDesignJson,
    diagnosisResult: normalizedDiagnosis,
    rolePack,
    styleMode,
    extractedPersonaTags: dedupe([
      ...insectMorphology.anatomyAnchors,
      ...insectMorphology.behaviorAnchors,
      ...cues,
      ...diagnosis.symptom_tags,
      ...diagnosis.evidence_tags,
    ]).slice(0, 24),
    prototypeTag: defaults.prototypeTag,
    antiTraits: defaults.antiTraits,
  }
}

const toPromptPart = (items, max = 10) => dedupe(items).slice(0, max).join(', ')

export function buildComfyPromptFromPersonaDesign(personaDesignJsonInput, input = {}) {
  const persona = isRecord(personaDesignJsonInput) ? personaDesignJsonInput : {}
  const diagnosisBlock = normalizeDiagnosisResult(input?.diagnosisResult ?? {})
  const diagnosis = diagnosisBlock.diagnosis
  const rolePack = normalizeRolePack(input?.rolePack)
  const styleMode = toText(input?.styleMode)
  const defaults = resolveCategoryDefaults(diagnosis.category)
  const styleTokens = resolveStyleTokens(styleMode, rolePack)
  const anatomyAnchors = toList(persona.anatomy_anchors ?? persona.anatomyAnchors, 8)
  const behaviorAnchors = toList(persona.behavior_anchors ?? persona.behaviorAnchors, 6)
  const negativeAnatomy = toList(persona.negative_anatomy ?? persona.negativeAnatomy, 12)
  const isPestCategory = defaults.prototypeTag === 'insect-inspired botanical fantasy character'

  if (isCampusGreenMascotMode(styleMode) && isPestCategory) {
    const campusPrompt = buildCampusGreenMascotPromptSet({
      diagnosis,
      styleTokens,
      rolePack,
      negativeAnatomy,
      persona,
    })

    const extractedPersonaTags = dedupe([
      ...campusPrompt.softenedInsectFeatures,
      ...toList(persona.symbolic_motifs, 8),
      ...campusPrompt.ratioConstraints,
      campusPrompt.hostPlantAnchor,
    ]).slice(0, 24)

    return {
      positivePrompt: campusPrompt.positivePrompt,
      negativePrompt: campusPrompt.negativePrompt,
      extractedPersonaTags,
      diagnosisResult: diagnosisBlock,
      rolePack,
      styleMode,
      softenedInsectFeatures: campusPrompt.softenedInsectFeatures,
      hostPlantAnchor: campusPrompt.hostPlantAnchor,
      ratioConstraints: campusPrompt.ratioConstraints,
    }
  }

  const rolePrototype = toText(persona.core_concept) || `${diagnosis.name} anthropomorphic anime role`
  const sourceIntent = toText(persona.design_direction) || defaults.designDirection
  const weightedAnatomyAnchors = anatomyAnchors.map((item) => `(${item}:1.35)`)
  const weightedBehaviorAnchors = behaviorAnchors.map((item) => `(${item}:1.2)`)

  const positiveParts = [
    rolePrototype,
    diagnosis.name,
    diagnosis.category === '病害' ? 'disease symptom persona source' : diagnosis.category === '生理异常' ? 'physiological stress persona source' : 'insect trait persona source',
    toPromptPart(weightedAnatomyAnchors, 8),
    toPromptPart(weightedBehaviorAnchors, 6),
    sourceIntent,
    toPromptPart(persona.color_palette),
    toPromptPart(persona.silhouette),
    toPromptPart(persona.hair_design),
    toPromptPart(persona.outfit_elements),
    toPromptPart(persona.accessory_elements),
    toPromptPart(persona.texture_materials),
    toPromptPart(persona.symbolic_motifs),
    toPromptPart(persona.temperament, 4),
    defaults.prototypeTag,
    toPromptPart(styleTokens, 8),
    'full body',
    'anime illustration',
    'character design sheet',
    'high detail',
  ]

  const positivePrompt = toPromptPart(positiveParts, 40)

  const negativePrompt = toPromptPart(
    [
      'generic anime girl',
      'random school uniform',
      'unrelated fantasy armor',
      'unrelated hair color',
      'no insect traits',
      ...negativeAnatomy,
      'no disease traits',
      'no botanical motifs',
      'fixed template character',
      'oversexualized unrelated design',
      'irrelevant background clutter',
      ...defaults.antiTraits,
      ...toList(persona.forbidden_elements, 12),
      ...rolePack.negativeKeywords,
      'worst quality',
      'lowres',
      'blurry',
      'text',
      'watermark',
      'logo',
      'bad anatomy',
      'deformed',
      'extra fingers',
    ],
    40,
  )

  const extractedPersonaTags = dedupe([
    ...anatomyAnchors,
    ...behaviorAnchors,
    ...toList(persona.color_palette, 8),
    ...toList(persona.silhouette, 8),
    ...toList(persona.hair_design, 8),
    ...toList(persona.outfit_elements, 8),
    ...toList(persona.accessory_elements, 8),
    ...toList(persona.texture_materials, 8),
    ...toList(persona.symbolic_motifs, 8),
  ]).slice(0, 24)

  return {
    positivePrompt,
    negativePrompt,
    extractedPersonaTags,
    diagnosisResult: diagnosisBlock,
    rolePack,
    styleMode,
    softenedInsectFeatures: [],
    hostPlantAnchor: '',
    ratioConstraints: [],
  }
}

export function buildAnimePersonaPromptFromDiagnosis(diagnosisResult, rolePackInput, styleModeInput) {
  const stage1 = buildPersonaDesignFromDiagnosis(diagnosisResult, rolePackInput, styleModeInput)
  const stage2 = buildComfyPromptFromPersonaDesign(stage1.personaDesignJson, {
    diagnosisResult: stage1.diagnosisResult,
    rolePack: stage1.rolePack,
    styleMode: stage1.styleMode,
  })

  return {
    personaDesignJson: stage1.personaDesignJson,
    positivePrompt: stage2.positivePrompt,
    negativePrompt: stage2.negativePrompt,
    extractedPersonaTags: stage2.extractedPersonaTags,
    diagnosisResult: stage2.diagnosisResult,
    rolePack: stage2.rolePack,
    styleMode: stage2.styleMode,
    softenedInsectFeatures: stage2.softenedInsectFeatures,
    hostPlantAnchor: stage2.hostPlantAnchor,
    ratioConstraints: stage2.ratioConstraints,
  }
}
