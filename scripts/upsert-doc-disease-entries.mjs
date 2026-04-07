import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const loadDotEnv = () => {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return
  }

  const text = readFileSync(envPath, 'utf8')
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const index = line.indexOf('=')
      if (index <= 0) {
        return
      }

      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!key || process.env[key] !== undefined) {
        return
      }

      process.env[key] = value
    })
}

const safeText = (value) => String(value ?? '').trim()

const buildQuery = (query) => {
  const params = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  })

  return params.toString()
}

const createRestClient = ({ supabaseUrl, serviceRoleKey }) => {
  const baseUrl = safeText(supabaseUrl).replace(/\/+$/, '')
  const apiKey = safeText(serviceRoleKey)

  if (!baseUrl || !apiKey) {
    throw new Error('SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 未配置。')
  }

  if (apiKey.startsWith('sb_publishable_')) {
    throw new Error('当前 SUPABASE_SERVICE_ROLE_KEY 是 publishable key，无法写入数据库。请改为 service_role(secret) key。')
  }

  const request = async (table, options = {}) => {
    const queryText = buildQuery(options.query)
    const endpoint = `${baseUrl}/rest/v1/${table}${queryText ? `?${queryText}` : ''}`

    const response = await fetch(endpoint, {
      method: options.method ?? 'GET',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const payload = await response.text()
      throw new Error(`Supabase request failed (${response.status}): ${payload}`)
    }

    if (response.status === 204) {
      return null
    }

    const payloadText = await response.text()
    if (!payloadText) {
      return null
    }

    try {
      return JSON.parse(payloadText)
    } catch {
      return payloadText
    }
  }

  return { request }
}

const rows = [
  {
    id: 'disease-phytophthora-infestans-tomato',
    type: 'disease',
    name: '番茄晚疫病',
    scientific_name: 'Phytophthora infestans',
    genus: 'Phytophthora',
    category_code: 'oomycete',
    category_name: '卵菌病害',
    risk_level: 'high',
    season: '保护地秋冬、露地秋季（9–11月）',
    host_range: '番茄、马铃薯及茄科野生植物',
    summary: '番茄晚疫病由致病疫霉引起，在18-22℃与持续高湿条件下可快速暴发，叶、茎、果均可受害。',
    morphology: '病原为致病疫霉（Phytophthora infestans），属卵菌病害，常在叶背产生白色霉层。',
    symptoms: '叶片先见暗绿色水渍状不规则病斑，湿度高时叶背生白霉；茎秆褐色凹陷条斑，青果出现油渍状后转黑褐硬斑。',
    image_url: '/images/encyclopedia/doc/doc-disease-01.png',
    control_tips: ['与非茄科轮作3年', '高垄覆膜并采用滴灌控湿', '初发期轮换使用氟啶胺、氰霜唑、精甲霜灵·锰锌等药剂'],
    placement_tips: ['保护地加强通风降湿', '雨后及时清除病叶病果', '避免植株郁闭和长时间叶面结露'],
    references: [
      'https://www.vegetables.cornell.edu/crops/tomatoes/late-blight/',
      'https://ipm.ucanr.edu/PMG/GARDEN/VEGES/DISEASES/lateblight.html',
      'https://www.fao.org/plant-health/en/',
      'https://www.natesc.org.cn/',
      'http://www.moa.gov.cn/',
    ],
  },
  {
    id: 'disease-erysiphe-cichoracearum-cucumber',
    type: 'disease',
    name: '黄瓜白粉病',
    scientific_name: 'Erysiphe cichoracearum',
    genus: 'Erysiphe',
    category_code: 'powdery',
    category_name: '白粉病类',
    risk_level: 'high',
    season: '保护地春秋季（4–6月、9–10月）',
    host_range: '黄瓜、甜瓜、南瓜及部分茄科作物',
    summary: '黄瓜白粉病在保护地春秋季高发，昼夜温差大且夜间结露时流行快，主要危害叶片。',
    morphology: '主要病原为白粉菌（Erysiphe cichoracearum 等），初期可见白色粉点并迅速扩展。',
    symptoms: '叶面与叶背出现白色粉斑，后期灰白并产生黑色小点（闭囊壳），重病叶片枯黄发脆。',
    image_url: '/images/encyclopedia/doc/doc-disease-02.png',
    control_tips: ['优先选用抗病品种', '及时摘除病叶老叶并加强通风', '初发期交替使用醚菌酯、戊唑醇、吡唑醚菌酯等药剂'],
    placement_tips: ['控制棚内湿度与结露时长', '避免高温时段喷药', '增施磷钾肥提高抗性'],
    references: [
      'https://extension.usu.edu/vegetableguide/cucurbits/powdery-mildew',
      'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx',
      'https://www.fao.org/plant-health/en/',
      'https://www.natesc.org.cn/',
      'http://www.moa.gov.cn/',
    ],
  },
  {
    id: 'disease-xanthomonas-citri-canker',
    type: 'disease',
    name: '柑橘溃疡病',
    scientific_name: 'Xanthomonas citri subsp. citri',
    genus: 'Xanthomonas',
    category_code: 'bacterial',
    category_name: '细菌性病害',
    risk_level: 'high',
    season: '春梢（4–5月）、夏梢（6–7月）、秋梢（8–9月）生长期',
    host_range: '柑橘属（甜橙、脐橙、酸橙最感病，宽皮柑橘次之）',
    summary: '柑橘溃疡病由黄单胞菌引起，风雨和潜叶蛾造成伤口后更易侵染，属高风险细菌性病害。',
    morphology: '病斑多为隆起木栓化，中央凹陷并可开裂呈火山口状，周围常见黄色晕圈。',
    symptoms: '叶片、枝梢和果实均可受害，重病时引起落叶落果并影响果实商品性与运输性。',
    image_url: '/images/encyclopedia/doc/doc-disease-03.png',
    control_tips: ['严格检疫并使用无病苗木', '统一放梢并同步防治潜叶蛾', '初发期喷施噻唑锌、噻菌铜、春雷·王铜等细菌性病害药剂'],
    placement_tips: ['台风暴雨前后加强巡查', '病株与病枝及时清除并无害化处理', '减少机械损伤和修剪伤口暴露'],
    references: ['https://direct.aphis.usda.gov/plant-pests-diseases/citrus-diseases/citrus-canker', 'https://www.fao.org/plant-health/en/', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-phytophthora-parasitica-eggplant',
    type: 'disease',
    name: '茄子绵疫病',
    scientific_name: 'Phytophthora parasitica',
    genus: 'Phytophthora',
    category_code: 'oomycete',
    category_name: '卵菌病害',
    risk_level: 'high',
    season: '盛夏至初秋（7–9月）',
    host_range: '茄子为主，也侵染番茄、辣椒、黄瓜',
    summary: '茄子绵疫病在盛夏高温高湿和田间积水条件下易暴发，果实成熟期最易感病。',
    morphology: '病原为寄生疫霉（Phytophthora parasitica），属卵菌类，病部湿润时常见白色棉絮状菌丝。',
    symptoms: '果实先出现水渍状圆斑并迅速扩展为黄褐至暗褐软腐斑，茎叶亦可出现近圆形水渍状病斑。',
    image_url: '/images/encyclopedia/doc/doc-disease-04.png',
    control_tips: ['采用高垄栽培并严防积水', '与非寄主作物轮作2-3年', '初发期交替使用烯酰吗啉、霜脲氰·锰锌等药剂'],
    placement_tips: ['暴雨后优先排水并降低田间湿度', '及时摘除病果减少再侵染源', '工具与采后周转筐分区消毒'],
    references: ['https://www.vegetables.cornell.edu/crops/eggplant/phytophthora-blight/', 'https://ipm.ucanr.edu/PMG/GARDEN/VEGES/DISEASES/phytophrootpepper.html', 'https://www.fao.org/plant-health/en/', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-puccinia-striiformis-tritici',
    type: 'disease',
    name: '小麦锈病（条锈病）',
    scientific_name: 'Puccinia striiformis f. sp. tritici',
    genus: 'Puccinia',
    category_code: 'rust',
    category_name: '锈病类',
    risk_level: 'high',
    season: '春季（3–5月）温凉多雾露',
    host_range: '小麦、大麦、黑麦及禾本科杂草',
    summary: '小麦条锈病在春季10-15℃和持续露水条件下流行快，可显著降低千粒重和产量。',
    morphology: '病原为条形柄锈菌（Puccinia striiformis f. sp. tritici），叶面形成黄色条状夏孢子堆。',
    symptoms: '病叶出现成排黄橙色孢子条，后期形成黑色冬孢子堆，重病时叶片早衰干枯。',
    image_url: '/images/encyclopedia/doc/doc-disease-05.png',
    control_tips: ['优先种植抗病品种', '加强田间早期监测并清除杂草寄主', '病叶率达阈值后及时喷施三唑酮、戊唑醇、氟环唑等药剂'],
    placement_tips: ['适期晚播降低早期侵染风险', '返青至拔节期重点巡查', '发病田块机具作业后及时清洁'],
    references: ['https://extension.usu.edu/crops/research/wheat-stripe-rust', 'https://digitalcommons.usu.edu/extension_curall/989/', 'https://www.fao.org/plant-health/en/', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-septoria-apiicola-celery',
    type: 'disease',
    name: '芹菜斑枯病（晚疫病）',
    scientific_name: 'Septoria apiicola',
    genus: 'Septoria',
    category_code: 'fungalLeafSpot',
    category_name: '真菌性斑点病',
    risk_level: 'medium',
    season: '秋季露地与保护地（9–11月）',
    host_range: '芹菜、根芹菜等伞形科蔬菜',
    summary: '芹菜斑枯病由 Septoria apiicola 引起，秋季高湿和长时间结露条件下易加重。',
    morphology: '病斑中央灰白、边缘深褐，病斑上散生黑色小点（分生孢子器）是典型识别特征。',
    symptoms: '叶片先现淡褐色油渍状小斑，后扩展为近圆斑，严重时叶片干枯脱落并影响商品质量。',
    image_url: '/images/encyclopedia/doc/doc-disease-06.png',
    control_tips: ['种子温汤浸种消毒', '轮作2年以上并清理病残体', '初发期喷施代森锰锌、苯醚甲环唑、吡唑醚菌酯'],
    placement_tips: ['保护地加强通风降湿', '降低夜间结露时间', '采收与修剪工具分区管理'],
    references: ['https://pnwhandbooks.org/plantdisease/host-disease/celery-apium-graveolens-var-dulce-late-blight-septoria-leaf-blight', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.fao.org/plant-health/en/', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-rhizoctonia-solani-rice-sheath-blight',
    type: 'disease',
    name: '水稻纹枯病',
    scientific_name: 'Rhizoctonia solani',
    genus: 'Rhizoctonia',
    category_code: 'blight',
    category_name: '枯斑与疫病类',
    risk_level: 'high',
    season: '分蘖盛期至孕穗抽穗期（6–8月）',
    host_range: '水稻、玉米、小麦及其他禾本科作物',
    summary: '水稻纹枯病在分蘖至孕穗期高温高湿条件下流行快，严重时造成叶鞘和叶片大片枯死。',
    morphology: '病原为立枯丝核菌（Rhizoctonia solani），病部潮湿时可见白色蛛丝状菌丝，后期形成褐色菌核。',
    symptoms: '近水面叶鞘先现暗绿色水渍状斑，后扩展为云纹状大斑；重病时叶片早衰并影响灌浆。',
    image_url: '/images/encyclopedia/doc-2026/doc-disease-21.jpg',
    control_tips: ['分蘖末期晒田控湿，避免长期深水灌溉', '平衡施肥并控制氮肥用量', '病丛率上升时及时轮换使用井冈霉素A、噻呋酰胺等药剂'],
    placement_tips: ['秧田和本田分区巡查并记录病丛率', '雨后及时排水，降低田间湿度', '收获后清理病残体与菌核，减少来年初侵染源'],
    references: ['https://www.fao.org/plant-health/en/', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-alternaria-solani-potato-early-blight',
    type: 'disease',
    name: '马铃薯早疫病',
    scientific_name: 'Alternaria solani',
    genus: 'Alternaria',
    category_code: 'blight',
    category_name: '枯斑与疫病类',
    risk_level: 'high',
    season: '夏季（7–8月）高温高湿期',
    host_range: '马铃薯、番茄及茄科作物',
    summary: '马铃薯早疫病在夏季高温高湿与植株衰弱条件下发生加重，叶片出现典型同心轮纹病斑。',
    morphology: '病原为茄链格孢（Alternaria solani），属真菌性病害，常见靶心状轮纹病斑。',
    symptoms: '叶片初现黑褐色小斑，扩大后形成圆形至近圆形轮纹斑并伴黄色晕圈；块茎可见暗褐色凹陷干腐斑。',
    image_url: '/images/encyclopedia/doc-2026/doc-disease-22.jpg',
    control_tips: ['与非茄科作物轮作2-3年', '增施钾肥提高植株抗性', '初发期轮换使用代森锰锌、吡唑醚菌酯、苯醚甲环唑'],
    placement_tips: ['雨后优先清除病叶病株，减少田间菌源', '密植地块及时整枝通风', '采后彻底清园并妥善处理病残体'],
    references: ['https://www.fao.org/plant-health/en/', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-colletotrichum-capsici-pepper-anthracnose',
    type: 'disease',
    name: '辣椒炭疽病',
    scientific_name: 'Colletotrichum capsici',
    genus: 'Colletotrichum',
    category_code: 'fungalLeafSpot',
    category_name: '真菌性斑点病',
    risk_level: 'high',
    season: '盛夏至初秋（7–9月）',
    host_range: '辣椒、茄子、番茄等茄科蔬菜',
    summary: '辣椒炭疽病在盛夏到初秋多雨高湿条件下流行迅速，果实近成熟期最易受害。',
    morphology: '病原主要为 Colletotrichum capsici 和 C. gloeosporioides，病斑湿润时常见橙红色黏质孢子团。',
    symptoms: '果面形成圆形至不规则凹陷斑，颜色由褐色逐渐加深；叶片病斑中央灰白、边缘褐色并可能穿孔。',
    image_url: '/images/encyclopedia/doc-2026/doc-disease-23.jpg',
    control_tips: ['种子温水浸种并进行消毒处理', '采用高垄栽培和滴灌降低叶面湿度', '病果病叶及时清除并轮换使用咪鲜胺、苯醚甲环唑、代森锰锌'],
    placement_tips: ['雨季加强果实巡查，及时摘除病果', '减少采收和整枝时机械伤口', '通风差地块优先进行疏枝处理'],
    references: ['https://www.fao.org/plant-health/en/', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-pseudoperonospora-cubensis-cucumber-downy',
    type: 'disease',
    name: '黄瓜霜霉病',
    scientific_name: 'Pseudoperonospora cubensis',
    genus: 'Pseudoperonospora',
    category_code: 'downy',
    category_name: '霜霉病类',
    risk_level: 'high',
    season: '春秋季及露地多雨期',
    host_range: '黄瓜、甜瓜、南瓜及丝瓜等葫芦科作物',
    summary: '黄瓜霜霉病在春秋保护地及露地多雨期高发，叶背霜状霉层是关键识别特征。',
    morphology: '病原为古巴假霜霉（Pseudoperonospora cubensis），属卵菌，低温高湿条件下侵染速度快。',
    symptoms: '叶面先现淡黄色褪绿斑，后形成黄褐色不规则病斑；对应叶背可见紫灰至黑色霜状霉层。',
    image_url: '/images/encyclopedia/doc-2026/doc-disease-24.jpg',
    control_tips: ['优先选用抗病品种并控制种植密度', '温室加强通风降湿，减少夜间结露', '初发期轮换使用烯酰吗啉、霜霉威盐酸盐、氟噻唑吡乙酮'],
    placement_tips: ['持续降雨后增加巡查频次', '病叶及时清除并带出园区', '灌溉优先滴灌，避免长时间叶面潮湿'],
    references: ['https://www.fao.org/plant-health/en/', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-plasmopara-viticola-grape-downy-doc',
    type: 'disease',
    name: '葡萄霜霉病',
    scientific_name: 'Plasmopara viticola',
    genus: 'Plasmopara',
    category_code: 'downy',
    category_name: '霜霉病类',
    risk_level: 'high',
    season: '夏季至初秋（6–8月）连阴雨期',
    host_range: '葡萄（各品种均可感病）',
    summary: '葡萄霜霉病在夏季至初秋连阴雨和高湿条件下扩散快，叶背霜霉层与幼果失水硬化较典型。',
    morphology: '病原为葡萄生单轴霉（Plasmopara viticola），属卵菌病害，主要侵染叶片、新梢与幼果。',
    symptoms: '叶片正面出现淡黄色多角形病斑，背面对应处生白色霜层；幼果感病后易硬化、畸形并脱落。',
    image_url: '/images/encyclopedia/doc-2026/doc-disease-25.jpg',
    control_tips: ['冬季清园并销毁病叶病梢', '生长期及时整枝摘心改善通风透光', '发病前后轮换使用代森锰锌、烯酰吗啉、霜脲氰等药剂'],
    placement_tips: ['低洼园区优先排水并降低空气湿度', '雨后重点巡查新梢与幼果', '病残体集中处理，避免园内堆放'],
    references: ['https://www.fao.org/plant-health/en/', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
  {
    id: 'disease-erwinia-carotovora-cabbage-soft-rot',
    type: 'disease',
    name: '白菜软腐病',
    scientific_name: 'Erwinia carotovora subsp. carotovora',
    genus: 'Erwinia',
    category_code: 'bacterial',
    category_name: '细菌性病害',
    risk_level: 'high',
    season: '秋季结球期（9–10月）',
    host_range: '白菜、甘蓝、萝卜及部分茄科作物',
    summary: '白菜软腐病在结球期高温高湿和伤口较多时发病重，病组织软烂并伴随明显异味。',
    morphology: '病原为 Erwinia carotovora subsp. carotovora（细菌），多从叶柄基部或虫伤口侵入。',
    symptoms: '病部初期呈水渍状半透明，后转灰褐色软腐并有臭味；结球白菜心叶腐烂，外叶萎蔫下垂。',
    image_url: '/images/encyclopedia/doc-2026/doc-disease-26.png',
    control_tips: ['高垄栽培并防止田间积水', '避免连作并同步防治菜青虫、跳甲等害虫', '初发期喷施噻唑锌、噻菌铜、农用链霉素并及时拔除病株'],
    placement_tips: ['雨后先排水再进行病株清理', '病穴撒施生石灰并隔离管理', '采收工具分区使用并定期消毒'],
    references: ['https://www.fao.org/plant-health/en/', 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx', 'https://www.natesc.org.cn/', 'http://www.moa.gov.cn/'],
  },
]

const run = async () => {
  loadDotEnv()

  const client = createRestClient({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  await client.request('encyclopedia_entries', {
    method: 'POST',
    query: {
      on_conflict: 'id',
    },
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: rows,
  })

  // eslint-disable-next-line no-console
  console.log(`Doc disease entries upserted: ${rows.length}`)
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message)
  process.exit(1)
})
