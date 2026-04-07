import type { EncyclopediaItem } from '../types/models'

type RiskLevel = EncyclopediaItem['risk']
type InsectCategory =
  | 'sapSucker'
  | 'hopper'
  | 'mite'
  | 'leafChewer'
  | 'fruitPest'
  | 'borer'
  | 'miner'
  | 'soilPest'
  | 'scale'
type DiseaseCategory =
  | 'powdery'
  | 'downy'
  | 'fungalLeafSpot'
  | 'blight'
  | 'wilt'
  | 'rot'
  | 'bacterial'
  | 'viral'
  | 'rust'
  | 'oomycete'
  | 'nematode'

interface InsectSeed {
  name: string
  scientificName: string
  genus: string
  risk: RiskLevel
  season: string
  host: string
  category: InsectCategory
}

interface DiseaseSeed {
  name: string
  scientificName: string
  genus: string
  risk: RiskLevel
  season: string
  host: string
  category: DiseaseCategory
}

const sharedReferences = {
  ipm: 'https://ipm.ucanr.edu/',
  aps: 'https://www.apsnet.org/edcenter/disimpactmngmnt/topc/Pages/default.aspx',
  fao: 'https://www.fao.org/plant-health/en/',
  cabi: 'https://www.cabi.org/cpc/',
  cornell: 'https://cals.cornell.edu/integrated-pest-management',
  natesc: 'https://www.natesc.org.cn/',
  moa: 'http://www.moa.gov.cn/',
}

const commonReferences = [
  sharedReferences.ipm,
  sharedReferences.aps,
  sharedReferences.fao,
  sharedReferences.natesc,
  sharedReferences.moa,
]

const insectCategoryLabels: Record<InsectCategory, string> = {
  sapSucker: '刺吸式害虫',
  hopper: '飞虱叶蝉类',
  mite: '螨类害虫',
  leafChewer: '食叶类害虫',
  fruitPest: '蛀果类害虫',
  borer: '蛀干蛀茎类',
  miner: '潜叶害虫',
  soilPest: '地下害虫',
  scale: '介壳和粉蚧类',
}

const diseaseCategoryLabels: Record<DiseaseCategory, string> = {
  powdery: '白粉病类',
  downy: '霜霉病类',
  fungalLeafSpot: '真菌性斑点病',
  blight: '枯斑与疫病类',
  wilt: '萎蔫病害',
  rot: '腐烂病害',
  bacterial: '细菌性病害',
  viral: '病毒病害',
  rust: '锈病类',
  oomycete: '卵菌病害',
  nematode: '线虫病害',
}

const insectTable = `
七星瓢虫|Coccinella septempunctata|Coccinella|低|春季至秋季活跃|蚜虫、粉虱、木虱等小型刺吸害虫|sapSucker
桃蚜|Myzus persicae|Myzus|高|春季至初夏，秋季回升|桃、辣椒、茄子、马铃薯|sapSucker
棉蚜|Aphis gossypii|Aphis|高|4-10 月持续发生|棉花、黄瓜、茄果和观赏植物|sapSucker
甘蓝蚜|Brevicoryne brassicae|Brevicoryne|中|春秋高发|甘蓝、菜花、油菜|sapSucker
萝卜蚜|Lipaphis erysimi|Lipaphis|中|春季和秋末|萝卜、白菜、芥菜|sapSucker
烟粉虱|Bemisia tabaci|Bemisia|高|高温季持续高发|番茄、辣椒、黄瓜、棉花|sapSucker
温室白粉虱|Trialeurodes vaporariorum|Trialeurodes|中|温室全年可见|番茄、豆类、花卉|sapSucker
西花蓟马|Frankliniella occidentalis|Frankliniella|高|春末至秋季|草莓、菊花、番茄、辣椒|sapSucker
茶黄蓟马|Scirtothrips dorsalis|Scirtothrips|中|5-9 月高发|茶树、柑橘、辣椒、芒果|sapSucker
褐飞虱|Nilaparvata lugens|Nilaparvata|高|分蘖至灌浆期|水稻|hopper
灰飞虱|Laodelphax striatellus|Laodelphax|中|夏秋高发|水稻、小麦、玉米|hopper
白背飞虱|Sogatella furcifera|Sogatella|中|6-9 月|水稻|hopper
棉盲蝽|Apolygus lucorum|Apolygus|中|5-8 月|棉花、果树、豆类和花卉|sapSucker
茶小绿叶蝉|Empoasca onukii|Empoasca|中|4-10 月多峰|茶树|hopper
柑橘木虱|Diaphorina citri|Diaphorina|高|新梢抽发期|柑橘及芸香科植物|hopper
梨木虱|Cacopsylla chinensis|Cacopsylla|中|春季和夏末|梨树|hopper
二斑叶螨|Tetranychus urticae|Tetranychus|高|高温干燥季|豆类、草莓、花卉、瓜类|mite
朱砂叶螨|Tetranychus cinnabarinus|Tetranychus|中|夏秋|棉花、茄果、观叶植物|mite
全爪螨|Panonychus citri|Panonychus|中|春末和秋季|柑橘、梨、苹果|mite
小菜蛾|Plutella xylostella|Plutella|高|春秋及保护地全年|白菜、甘蓝、菜花|leafChewer
菜青虫|Pieris rapae|Pieris|中|春末至秋季|十字花科蔬菜|leafChewer
甜菜夜蛾|Spodoptera exigua|Spodoptera|高|6-10 月|甜菜、葱蒜、茄果、豆类|leafChewer
斜纹夜蛾|Spodoptera litura|Spodoptera|高|高温季多代重叠|大豆、花生、蔬菜、花卉|leafChewer
草地贪夜蛾|Spodoptera frugiperda|Spodoptera|高|夏秋迁飞扩散期|玉米、高粱、水稻等禾本科|leafChewer
棉铃虫|Helicoverpa armigera|Helicoverpa|高|花果期高发|棉花、番茄、辣椒、玉米|fruitPest
黏虫|Mythimna separata|Mythimna|中|夏季暴发|玉米、小麦、水稻等禾本科|leafChewer
豆荚螟|Maruca vitrata|Maruca|中|开花结荚期|豇豆、菜豆、大豆|fruitPest
玉米螟|Ostrinia furnacalis|Ostrinia|高|拔节至抽雄期|玉米、高粱、粟类|borer
二化螟|Chilo suppressalis|Chilo|高|分蘖和孕穗期|水稻、茭白|borer
稻纵卷叶螟|Cnaphalocrocis medinalis|Cnaphalocrocis|中|7-9 月|水稻|leafChewer
稻苞虫|Parnara guttata|Parnara|中|夏秋|水稻和禾本科杂草|leafChewer
苹果蠹蛾|Cydia pomonella|Cydia|高|果实膨大期|苹果、梨、核果类|fruitPest
梨小食心虫|Grapholita molesta|Grapholita|高|春梢与果实期|桃、梨、苹果|fruitPest
桃小食心虫|Carposina sasakii|Carposina|中|果实成熟前后|桃、苹果、枣|fruitPest
柑橘潜叶蛾|Phyllocnistis citrella|Phyllocnistis|中|夏秋抽梢期|柑橘类嫩叶|miner
美洲斑潜蝇|Liriomyza sativae|Liriomyza|中|春末至秋季|豆类、瓜类、茄科蔬菜|miner
黄曲条跳甲|Phyllotreta striolata|Phyllotreta|中|苗期高发|十字花科幼苗|leafChewer
稻水象甲|Lissorhoptrus oryzophilus|Lissorhoptrus|中|分蘖期|水稻|leafChewer
地老虎|Agrotis ipsilon|Agrotis|高|春季育苗期|蔬菜苗、玉米、花卉苗|soilPest
蝼蛄|Gryllotalpa orientalis|Gryllotalpa|中|春末夏初|苗床作物、草坪和花坛|soilPest
蛴螬|Holotrichia parallela|Holotrichia|中|夏秋土壤高温期|草坪、苗木、花卉|soilPest
金针虫|Agriotes fuscicollis|Agriotes|中|春秋|玉米、马铃薯、幼苗作物|soilPest
桑白蚧|Pseudaulacaspis pentagona|Pseudaulacaspis|中|夏季若虫盛发期|桑树、桃树、茶花|scale
红蜡蚧|Ceroplastes rubens|Ceroplastes|中|5-9 月|柑橘、茶树、观赏灌木|scale
柑橘粉蚧|Planococcus citri|Planococcus|中|温暖季持续发生|柑橘、葡萄、温室花卉|scale
吹绵蚧|Icerya purchasi|Icerya|中|春秋为主|柑橘、相思树、观赏植物|scale
美国白蛾|Hyphantria cunea|Hyphantria|高|夏秋两代高发|杨树、悬铃木、果树|leafChewer
松毛虫|Dendrolimus punctatus|Dendrolimus|高|春末和秋季|马尾松、湿地松|leafChewer
星天牛|Anoplophora glabripennis|Anoplophora|高|5-8 月成虫活动|杨柳、槭树、榆树|borer
松褐天牛|Monochamus alternatus|Monochamus|高|初夏羽化高峰|松属植物|borer
桑天牛|Apriona germari|Apriona|中|夏季|桑树、柑橘、杨树|borer
茶尺蠖|Ectropis obliqua|Ectropis|中|春夏多代发生|茶树|leafChewer
甘蓝夜蛾|Mamestra brassicae|Mamestra|中|春秋|甘蓝、白菜、甜菜|leafChewer
`

const diseaseTable = `
白粉病|Erysiphe spp.|Erysiphe|中|春末至秋初干湿交替期|月季、黄瓜、葡萄、豆科和花卉|powdery
黄瓜白粉病|Erysiphe cichoracearum|Erysiphe|高|保护地春秋季（4–6月、9–10月）|黄瓜、甜瓜、南瓜及部分茄科作物|powdery
霜霉病|Peronospora spp.|Peronospora|高|低温高湿季节|十字花科、葫芦科、葡萄|downy
灰霉病|Botrytis cinerea|Botrytis|高|阴雨连绵与设施高湿期|番茄、草莓、花卉、葡萄|rot
炭疽病|Colletotrichum gloeosporioides|Colletotrichum|高|高温高湿期|辣椒、芒果、茶树、草莓|fungalLeafSpot
锈病|Puccinia spp.|Puccinia|中|温暖潮湿季|小麦、豆科、观赏花卉|rust
早疫病|Alternaria solani|Alternaria|中|高温高湿并伴露水|番茄、马铃薯、茄子|blight
晚疫病|Phytophthora infestans|Phytophthora|高|凉爽高湿季节|番茄、马铃薯|oomycete
番茄晚疫病|Phytophthora infestans|Phytophthora|高|保护地秋冬、露地秋季（9–11月）|番茄、马铃薯及茄科野生植物|oomycete
茄子绵疫病|Phytophthora parasitica|Phytophthora|高|盛夏至初秋（7–9月）|茄子为主，也侵染番茄、辣椒、黄瓜|oomycete
褐斑病|Alternaria alternata|Alternaria|中|夏秋雨后高湿期|草坪、观叶植物、豆科作物|fungalLeafSpot
叶斑病|Cercospora beticola|Cercospora|中|温暖潮湿期|甜菜、菠菜、观叶植物|fungalLeafSpot
芹菜斑枯病（晚疫病）|Septoria apiicola|Septoria|中|秋季露地与保护地（9–11月）|芹菜、根芹菜等伞形科蔬菜|fungalLeafSpot
黑斑病|Diplocarpon rosae|Diplocarpon|中|梅雨季和秋雨季|月季、蔷薇|fungalLeafSpot
黑星病|Venturia inaequalis|Venturia|中|春季多雨期|苹果、海棠|fungalLeafSpot
立枯病|Rhizoctonia solani|Rhizoctonia|高|苗期高湿高温|蔬菜苗、花卉苗、禾本科作物|blight
猝倒病|Pythium aphanidermatum|Pythium|高|育苗期低温高湿|瓜果蔬菜和花卉苗床|oomycete
枯萎病|Fusarium oxysporum|Fusarium|高|高温期与连作田|西瓜、番茄、香蕉、花卉|wilt
黄萎病|Verticillium dahliae|Verticillium|中|春末至夏初|棉花、茄子和多种木本|wilt
根腐病|Phytophthora capsici|Phytophthora|高|连续降雨后|辣椒、瓜类、苗木|rot
白绢病|Sclerotium rolfsii|Sclerotium|中|高温高湿土壤期|花生、番茄、花卉和草坪|rot
菌核病|Sclerotinia sclerotiorum|Sclerotinia|中|凉爽潮湿花期|油菜、莴苣、豆类、向日葵|rot
软腐病|Pectobacterium carotovorum|Pectobacterium|高|高温多雨季|白菜、马铃薯、胡萝卜|bacterial
青枯病|Ralstonia solanacearum|Ralstonia|高|高温高湿期|番茄、辣椒、茄子、烟草|bacterial
细菌性角斑病|Xanthomonas campestris pv. vesicatoria|Xanthomonas|中|雨季与露水重时|番茄、辣椒|bacterial
细菌性叶斑病|Pseudomonas syringae pv. tomato|Pseudomonas|中|冷凉高湿天气|番茄及茄科作物|bacterial
细菌性溃疡病|Clavibacter michiganensis|Clavibacter|高|育苗至结果期|番茄|bacterial
柑橘溃疡病|Xanthomonas citri subsp. citri|Xanthomonas|高|台风雨季及夏梢期|柑橘类|bacterial
十字花科黑腐病|Xanthomonas campestris pv. campestris|Xanthomonas|中|温暖潮湿季节|白菜、甘蓝、芥蓝|bacterial
水稻白叶枯病|Xanthomonas oryzae pv. oryzae|Xanthomonas|高|台风暴雨后易流行|水稻|bacterial
稻瘟病|Magnaporthe oryzae|Magnaporthe|高|分蘖至抽穗期|水稻|blight
稻纹枯病|Rhizoctonia solani|Rhizoctonia|中|孕穗至灌浆期高温高湿|水稻|blight
稻曲病|Ustilaginoidea virens|Ustilaginoidea|中|抽穗扬花期遇阴雨|水稻|fungalLeafSpot
小麦赤霉病|Fusarium graminearum|Fusarium|高|扬花期阴雨连绵|小麦、大麦|blight
小麦锈病（条锈病）|Puccinia striiformis f. sp. tritici|Puccinia|高|春季（3–5月）温凉多雾露|小麦、大麦、黑麦及禾本科杂草|rust
水稻纹枯病|Rhizoctonia solani|Rhizoctonia|高|分蘖盛期至孕穗抽穗期（6-8月）|水稻、玉米、小麦及其他禾本科作物|blight
马铃薯早疫病|Alternaria solani|Alternaria|高|夏季（7-8月）高温高湿期|马铃薯、番茄及茄科作物|blight
辣椒炭疽病|Colletotrichum capsici|Colletotrichum|高|盛夏至初秋（7-9月）|辣椒、茄子、番茄等茄科蔬菜|fungalLeafSpot
黄瓜霜霉病|Pseudoperonospora cubensis|Pseudoperonospora|高|春秋季及露地多雨期|黄瓜、甜瓜、南瓜及丝瓜等葫芦科作物|downy
葡萄霜霉病|Plasmopara viticola|Plasmopara|高|夏季至初秋（6-8月）连阴雨期|葡萄（各品种均可感病）|downy
白菜软腐病|Erwinia carotovora subsp. carotovora|Erwinia|高|秋季结球期（9-10月）|白菜、甘蓝、萝卜及部分茄科作物|bacterial
小麦白粉病|Blumeria graminis|Blumeria|中|春季郁闭群体|小麦、大麦|powdery
玉米大斑病|Exserohilum turcicum|Exserohilum|中|温暖潮湿季|玉米|fungalLeafSpot
玉米小斑病|Bipolaris maydis|Bipolaris|中|高温多雨季|玉米|fungalLeafSpot
玉米锈病|Puccinia sorghi|Puccinia|中|夏季温湿期|玉米|rust
苹果腐烂病|Valsa mali|Valsa|高|早春与秋季|苹果树|rot
苹果轮纹病|Botryosphaeria dothidea|Botryosphaeria|中|高温高湿果实期|苹果、梨|fungalLeafSpot
苹果褐斑病|Marssonina coronaria|Marssonina|中|雨季中后期|苹果、海棠|fungalLeafSpot
葡萄白腐病|Coniella diplodiella|Coniella|中|高温多雨果实期|葡萄|rot
葡萄炭疽病|Elsinoe ampelina|Elsinoe|中|温暖潮湿季|葡萄嫩梢和果实|fungalLeafSpot
番茄花叶病|Tomato mosaic virus|Tobamovirus|中|全年可见，温室更重|番茄、辣椒等茄科|viral
黄瓜花叶病|Cucumber mosaic virus|Cucumovirus|高|春夏蚜虫高发期|黄瓜、甜瓜、辣椒|viral
番茄黄化曲叶病毒病|Tomato yellow leaf curl virus|Begomovirus|高|高温季与粉虱高峰同步|番茄及部分茄科杂草|viral
马铃薯 Y 病毒病|Potato virus Y|Potyvirus|中|蚜虫迁飞期|马铃薯、烟草、辣椒|viral
烟草花叶病|Tobacco mosaic virus|Tobamovirus|中|全年，干燥环境易机械传播|烟草、番茄、辣椒|viral
甘蓝根肿病|Plasmodiophora brassicae|Plasmodiophora|高|酸性湿土和连作地|甘蓝、白菜、油菜|oomycete
松材线虫病|Bursaphelenchus xylophilus|Bursaphelenchus|高|夏季媒介天牛活动期|松属树种|nematode
根结线虫病|Meloidogyne incognita|Meloidogyne|中|高温季和保护地|番茄、黄瓜、茄子、花卉|nematode
草坪褐斑病|Rhizoctonia solani|Rhizoctonia|中|夏季高温高湿夜间闷热|冷季型草坪草|blight
香蕉枯萎病|Fusarium oxysporum f. sp. cubense|Fusarium|高|高温多雨与连作期|香蕉、芭蕉|wilt
柑橘黄龙病|Candidatus Liberibacter asiaticus|Liberibacter|高|全年，春秋新梢期明显|柑橘类及芸香科|bacterial
`

const parseInsectSeeds = (table: string): InsectSeed[] =>
  table
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, scientificName, genus, risk, season, host, category] = line.split('|')
      return {
        name,
        scientificName,
        genus,
        risk: risk as RiskLevel,
        season,
        host,
        category: category as InsectCategory,
      }
    })

const parseDiseaseSeeds = (table: string): DiseaseSeed[] =>
  table
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, scientificName, genus, risk, season, host, category] = line.split('|')
      return {
        name,
        scientificName,
        genus,
        risk: risk as RiskLevel,
        season,
        host,
        category: category as DiseaseCategory,
      }
    })

const insectSeeds = parseInsectSeeds(insectTable)
const diseaseSeeds = parseDiseaseSeeds(diseaseTable)

const makeId = (type: EncyclopediaItem['type'], scientificName: string, index: number) => {
  const slug = scientificName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${type}-${slug || 'item'}-${index + 1}`
}

const buildAidaUrl = (id: string) => `https://lh3.googleusercontent.com/aida-public/${id}`

const imageBank = {
  aphid: buildAidaUrl(
    'AB6AXuALAIKVw6nsOiMF9k-sS0EkB-6tVCoQbc_PXrLMkbq97AZbk0Mp3ISfwGIlOAscsyW0-s8TTlTd88KHROVDGsZJfzyO62Y7_k0GiU-KeyocAzvQYY5bLoFBWsCJ0qXAr54K12-GZ7_uriFVKEDIJi86i5pfuU62pMT_Gzr2v0_nYOMujO6C-TeRabyh3fYTBjoKdSAGqxntmXcBDH00He4hBrvXgKEnMsRZZArDLgI8BAeZhYpLA9vdSpns3lXJCffWPXc7s38Hsqw',
  ),
  mite: buildAidaUrl(
    'AB6AXuBXjI2euYFMKJ81k8s6Dd2-7-ulsBxsu-Iv77m4y-OXt-x3XtBp6ss9RxpQsJjUwMHPnrBN32qDLPW7eb_IxWIhX1VAnjt9wViWega0Pwj7LM5xHZVdo0U7v2z1WUSuLYJ4nqepHNXEsz8UuDkzxKNw8rT6Ry6VGttXY-ouJuiWNm0ktx-elkWXeA0xgtKeAJXTWacZPyXpa7ejXfMZc_8kTcuAOshEhfNKc7UPVcDCfxXQNTr-wOGRXKJTaGYFXxyrsK0bxwh_aiU',
  ),
  worm: buildAidaUrl(
    'AB6AXuAFpe3KiXbJCnxKDzO3aGr7rhZYRgkzI6PYQA6PV2aWrY8Ng3sRqhdvRhzHfL88sU2YdPjTFEVQs8pymYUziRxNbM6SF_J3gc2a5Oab4Y7VYrZmz9_Fe7odFaGif2PA3fj18JMCuY8yvKOG5mQ7L3qDaJySQezKH8h4uZDExoWwvd7buRlIkJS3or16_EPMYwy-42sKZCRm4LDY1artg-deNqk4Q9jrJhbUQQEYauAtTsuhdeu1WcX8xtt1yhhRjODpxo-Wjgt-TFY',
  ),
  whitefly: buildAidaUrl(
    'AB6AXuAxiE9ptcc3SdmdNFIurhtqW6YoiRsSVAUSr8hq72QEQA8FZyhUGJ5MdEsQ6DORSWq6OsO_GCkNXANigpJIRU_y4uyKsH_c1gvnLrEagKx0tXt6YlQWpm3Ck63rWSM2sCQOUvxv_t7XuRYgcpH73e8YlHrXv87mmwyeFQHJz7WRcQw6GEpliOV0jtw_Erops1h_gGkMN14wOYbbt89RmFdQuUvnezmKbgB9n7SuD1iBW0HdBE9I2RUubZCRMC-Hji0Y4SpR8oJoaCw',
  ),
  scale: buildAidaUrl(
    'AB6AXuBeWf2PMuEECcimbCZpUW2TXAwhuMdvXTuo29y7E92-j9BpW3zJbX0PyDc13FMTqj5ic47_GCpFcMkmyAPF7gxPux6oFfYijT8FQ7InX0Zi-pQoL9D0kr3vWsBfZ4szuF2fV_e_b6a2LUsbz6IGVe3XyPov1-loD-tKw6UI_og1FBzfXDJDjFhba3DvsVRy-uF6oukbYRRRvebAHnI2yPDziICGBJbHJpxHpIA-rwPS6nng7nq_Pc960KpvucdDUruVNRy3DwSsK3Q',
  ),
  thrips: buildAidaUrl(
    'AB6AXuDzQlliYVM_LpxDi2vmBmLfZCjnIbg1yGqhe4xtUD7zfbEHs_YiMW0U3RD2jGWqBiAa8J0VtJeRTM8NtCNNC2-jlOwoGSc-f7nkB3c2HLzw56OIOM5fFaGRBHwGkLyF-g4YCDgpS7YnrlpCT4tCnMbkamFsksMZ0Sc2gIheVJLQ6mItwNo1SrUQ-i1x8Xqps5Hu0B3oiHY0iHehCIO13Za_i5HLDrb4g3ler9VbyUqJdtdG-w23p1LCDuRURQBJIWrmcvkNCvOX-lk',
  ),
  powdery: buildAidaUrl(
    'AB6AXuBzkUS5hEWFRyj4tm63W_UvLJb0yTfLOSmnk0Y7dC9-GY9HSsp6ZHo9rSscdV0JGNwSF22EYIzfCU4t7BEAuT8Vgz_8paJFBjRpZ6oXhcW_26izw_9wfbxXAoxnbo-UJZutbAO_6Hui1WwkQI0NtwvwQ39wmMe3ujQbQF7c6RnX_cD4bAMCluto2GuPFNi3FENPVWoqNPp_X5y3bctCixHTF0MGdnXA1Rhow-uEe58yR9ju5PvjZCy9tAU2p0zG4ovVtAGVMiZ0KsI',
  ),
  leafSpot: buildAidaUrl(
    'AB6AXuD5QtyXp3ML5SPX6NeIQJfMe3vVcS4TFfpGqCDzF2ERRU5cUPf7Su53xVXmjiaC_xrxtT59ED4ZKPzdujrYhEJmKS4w9zvjUBgmH3AZ1Qux9twPo06dyX2WpwsHAakziwnJ0-Ss9ZOmsZOrh5xi6h_CXnY8dd__PaqrVcqydRhdZWsAcUzB5J3T1_TnrZRtLtFyAYLIRAU3XDJZkFtWYJxIKT_e2IbFJE0YH_2AuV3-V9mrRNH6C4mHB5TnL_vRvg_BxVJvHhmEskQ',
  ),
  diseaseField: buildAidaUrl(
    'AB6AXuCC_4mMOqfq5WfBZvuvxoCEv9ckOM0WqXKhdbXjeJrYn99vL9v4QYwxei_YVkVztFX6Uo67RFVRHUzVxTjOtRgj3e5n1KJUym2DSUJrWha1aCI1wZWLUeQn1EjCSq7hmH8gvnm1VEAG2qY5Ytqgo9oq17Plg10yDKahRS9GUGGbHB2ZKxVgIJ4SiI2O-sg7rl8m9iK2ejAco37x5XHPKO-J4t3rhNrjT_mjyF2kyGUsYfiEntIUza8F96x8yfnt5Suhd5VPh6lIArU',
  ),
  diseaseMacro: buildAidaUrl(
    'AB6AXuA8WtCDDxsfu838RPap3jP7rjY6GfAiHmYbtXAUpdNSWKqWufNZqvKev9xgBs-23Yie2TiMFyTIy3qhqouCa_4azyY7uFSas1q1pm4DnNlytEaXlVaZ9eszRNNypdSCReL4jXYIiCIa4ZiZysOnUT8z2vQ0dqV4WA_5qOHChpl_ebrFaeAXwppAO0px4BMfTXXzZZDXQTHQ3lTbK7Iehs5eawl6dga8-Kh_NSrptB3_AIwc6uBG4uh2J0CpF_1WjiIwfpQntj_CNhM',
  ),
  ladybug: '/images/914ec19753ff41c467235a1cc8413f5f.jpg',
  fallback: '/images/community-post-fallback.svg',
} as const

const insectCategoryImages: Record<InsectCategory, string> = {
  sapSucker: imageBank.aphid,
  hopper: imageBank.whitefly,
  mite: imageBank.mite,
  leafChewer: imageBank.worm,
  fruitPest: imageBank.thrips,
  borer: imageBank.worm,
  miner: imageBank.whitefly,
  soilPest: imageBank.mite,
  scale: imageBank.scale,
}

const diseaseCategoryImages: Record<DiseaseCategory, string> = {
  powdery: imageBank.powdery,
  downy: imageBank.leafSpot,
  fungalLeafSpot: imageBank.leafSpot,
  blight: imageBank.diseaseField,
  wilt: imageBank.diseaseField,
  rot: imageBank.diseaseMacro,
  bacterial: imageBank.diseaseMacro,
  viral: imageBank.diseaseField,
  rust: imageBank.leafSpot,
  oomycete: imageBank.diseaseMacro,
  nematode: imageBank.diseaseField,
}

const namedImageOverrides: Record<string, string> = {
  桃蚜: '/images/encyclopedia/local/bda672ac61322aebb80e43d262913eb6.jpg',
  棉蚜: '/images/encyclopedia/local/13a61076116cfd3da7c4303b4d75d8b6.jpg',
  七星瓢虫: imageBank.ladybug,
  番茄晚疫病: '/images/encyclopedia/doc/doc-disease-01.png',
  黄瓜白粉病: '/images/encyclopedia/doc/doc-disease-02.png',
  柑橘溃疡病: '/images/encyclopedia/doc/doc-disease-03.png',
  茄子绵疫病: '/images/encyclopedia/doc/doc-disease-04.png',
  '小麦锈病（条锈病）': '/images/encyclopedia/doc/doc-disease-05.png',
  '芹菜斑枯病（晚疫病）': '/images/encyclopedia/doc/doc-disease-06.png',
  水稻纹枯病: '/images/encyclopedia/doc-2026/doc-disease-21.jpg',
  马铃薯早疫病: '/images/encyclopedia/doc-2026/doc-disease-22.jpg',
  辣椒炭疽病: '/images/encyclopedia/doc-2026/doc-disease-23.jpg',
  黄瓜霜霉病: '/images/encyclopedia/doc-2026/doc-disease-24.jpg',
  葡萄霜霉病: '/images/encyclopedia/doc-2026/doc-disease-25.jpg',
  白菜软腐病: '/images/encyclopedia/doc-2026/doc-disease-26.png',
}

const baseControlTips = ['建立每周巡查制度并记录发病虫位点。', '优先采用生态与栽培调控手段降低风险。', '必要时按规范轮换药剂并进行复查。']
const basePlacementTips = ['保持栽植区通风透光并减少郁闭。', '雨后及时排湿并清理病残体。', '新引入苗木先隔离观察后再入区。']

const docDiseaseOverrides: Record<
  string,
  {
    image: string
    summary: string
    morphology: string
    symptoms: string
    controlTips: string[]
    placementTips: string[]
    references: string[]
  }
> = {
  '番茄晚疫病': {
    image: '/images/encyclopedia/doc/doc-disease-01.png',
    summary: '番茄晚疫病由致病疫霉引起，在18-22℃与持续高湿条件下可快速暴发，叶、茎、果均可受害。',
    morphology: '病原为致病疫霉（Phytophthora infestans），属卵菌病害，常在叶背产生白色霉层。',
    symptoms: '叶片先见暗绿色水渍状不规则病斑，湿度高时叶背生白霉；茎秆褐色凹陷条斑，青果出现油渍状后转黑褐硬斑。',
    controlTips: ['与非茄科轮作3年', '高垄覆膜并采用滴灌控湿', '初发期轮换使用氟啶胺、氰霜唑、精甲霜灵·锰锌等药剂'],
    placementTips: ['保护地加强通风降湿', '雨后及时清除病叶病果', '避免植株郁闭和长时间叶面结露'],
    references: [
      'https://www.vegetables.cornell.edu/crops/tomatoes/late-blight/',
      'https://ipm.ucanr.edu/PMG/GARDEN/VEGES/DISEASES/lateblight.html',
      sharedReferences.fao,
      sharedReferences.natesc,
      sharedReferences.moa,
    ],
  },
  '黄瓜白粉病': {
    image: '/images/encyclopedia/doc/doc-disease-02.png',
    summary: '黄瓜白粉病在保护地春秋季高发，昼夜温差大且夜间结露时流行快，主要危害叶片。',
    morphology: '主要病原为白粉菌（Erysiphe cichoracearum 等），初期可见白色粉点并迅速扩展。',
    symptoms: '叶面与叶背出现白色粉斑，后期灰白并产生黑色小点（闭囊壳），重病叶片枯黄发脆。',
    controlTips: ['优先选用抗病品种', '及时摘除病叶老叶并加强通风', '初发期交替使用醚菌酯、戊唑醇、吡唑醚菌酯等药剂'],
    placementTips: ['控制棚内湿度与结露时长', '避免高温时段喷药', '增施磷钾肥提高抗性'],
    references: [
      'https://extension.usu.edu/vegetableguide/cucurbits/powdery-mildew',
      sharedReferences.aps,
      sharedReferences.fao,
      sharedReferences.natesc,
      sharedReferences.moa,
    ],
  },
  '柑橘溃疡病': {
    image: '/images/encyclopedia/doc/doc-disease-03.png',
    summary: '柑橘溃疡病由黄单胞菌引起，风雨和潜叶蛾造成伤口后更易侵染，属高风险细菌性病害。',
    morphology: '病斑多为隆起木栓化，中央凹陷并可开裂呈火山口状，周围常见黄色晕圈。',
    symptoms: '叶片、枝梢和果实均可受害，重病时引起落叶落果并影响果实商品性与运输性。',
    controlTips: ['严格检疫并使用无病苗木', '统一放梢并同步防治潜叶蛾', '初发期喷施噻唑锌、噻菌铜、春雷·王铜等细菌性病害药剂'],
    placementTips: ['台风暴雨前后加强巡查', '病株与病枝及时清除并无害化处理', '减少机械损伤和修剪伤口暴露'],
    references: [
      'https://direct.aphis.usda.gov/plant-pests-diseases/citrus-diseases/citrus-canker',
      sharedReferences.fao,
      sharedReferences.natesc,
      sharedReferences.moa,
    ],
  },
  '茄子绵疫病': {
    image: '/images/encyclopedia/doc/doc-disease-04.png',
    summary: '茄子绵疫病在盛夏高温高湿和田间积水条件下易暴发，果实成熟期最易感病。',
    morphology: '病原为寄生疫霉（Phytophthora parasitica），属卵菌类，病部湿润时常见白色棉絮状菌丝。',
    symptoms: '果实先出现水渍状圆斑并迅速扩展为黄褐至暗褐软腐斑，茎叶亦可出现近圆形水渍状病斑。',
    controlTips: ['采用高垄栽培并严防积水', '与非寄主作物轮作2-3年', '初发期交替使用烯酰吗啉、霜脲氰·锰锌等药剂'],
    placementTips: ['暴雨后优先排水并降低田间湿度', '及时摘除病果减少再侵染源', '工具与采后周转筐分区消毒'],
    references: [
      'https://www.vegetables.cornell.edu/crops/eggplant/phytophthora-blight/',
      'https://ipm.ucanr.edu/PMG/GARDEN/VEGES/DISEASES/phytophrootpepper.html',
      sharedReferences.fao,
      sharedReferences.natesc,
      sharedReferences.moa,
    ],
  },
  '小麦锈病（条锈病）': {
    image: '/images/encyclopedia/doc/doc-disease-05.png',
    summary: '小麦条锈病在春季10-15℃和持续露水条件下流行快，可显著降低千粒重和产量。',
    morphology: '病原为条形柄锈菌（Puccinia striiformis f. sp. tritici），叶面形成黄色条状夏孢子堆。',
    symptoms: '病叶出现成排黄橙色孢子条，后期形成黑色冬孢子堆，重病时叶片早衰干枯。',
    controlTips: ['优先种植抗病品种', '加强田间早期监测并清除杂草寄主', '病叶率达阈值后及时喷施三唑酮、戊唑醇、氟环唑等药剂'],
    placementTips: ['适期晚播降低早期侵染风险', '返青至拔节期重点巡查', '发病田块机具作业后及时清洁'],
    references: [
      'https://extension.usu.edu/crops/research/wheat-stripe-rust',
      'https://digitalcommons.usu.edu/extension_curall/989/',
      sharedReferences.fao,
      sharedReferences.natesc,
      sharedReferences.moa,
    ],
  },
  '芹菜斑枯病（晚疫病）': {
    image: '/images/encyclopedia/doc/doc-disease-06.png',
    summary: '芹菜斑枯病由 Septoria apiicola 引起，秋季高湿和长时间结露条件下易加重。',
    morphology: '病斑中央灰白、边缘深褐，病斑上散生黑色小点（分生孢子器）是典型识别特征。',
    symptoms: '叶片先现淡褐色油渍状小斑，后扩展为近圆斑，严重时叶片干枯脱落并影响商品质量。',
    controlTips: ['种子温汤浸种消毒', '轮作2年以上并清理病残体', '初发期喷施代森锰锌、苯醚甲环唑、吡唑醚菌酯'],
    placementTips: ['保护地加强通风降湿', '降低夜间结露时间', '采收与修剪工具分区管理'],
    references: [
      'https://pnwhandbooks.org/plantdisease/host-disease/celery-apium-graveolens-var-dulce-late-blight-septoria-leaf-blight',
      sharedReferences.aps,
      sharedReferences.fao,
      sharedReferences.natesc,
      sharedReferences.moa,
    ],
  },
  水稻纹枯病: {
    image: '/images/encyclopedia/doc-2026/doc-disease-21.jpg',
    summary: '水稻纹枯病在分蘖至孕穗期高温高湿条件下流行快，严重时造成叶鞘和叶片大片枯死。',
    morphology: '病原为立枯丝核菌（Rhizoctonia solani），病部潮湿时可见白色蛛丝状菌丝，后期形成褐色菌核。',
    symptoms: '近水面叶鞘先现暗绿色水渍状斑，后扩展为云纹状大斑；重病时叶片早衰并影响灌浆。',
    controlTips: ['分蘖末期晒田控湿，避免长期深水灌溉', '平衡施肥并控制氮肥用量', '病丛率上升时及时轮换使用井冈霉素A、噻呋酰胺等药剂'],
    placementTips: ['秧田和本田分区巡查并记录病丛率', '雨后及时排水，降低田间湿度', '收获后清理病残体与菌核，减少来年初侵染源'],
    references: [sharedReferences.fao, sharedReferences.aps, sharedReferences.natesc, sharedReferences.moa],
  },
  马铃薯早疫病: {
    image: '/images/encyclopedia/doc-2026/doc-disease-22.jpg',
    summary: '马铃薯早疫病在夏季高温高湿与植株衰弱条件下发生加重，叶片出现典型同心轮纹病斑。',
    morphology: '病原为茄链格孢（Alternaria solani），属真菌性病害，常见靶心状轮纹病斑。',
    symptoms: '叶片初现黑褐色小斑，扩大后形成圆形至近圆形轮纹斑并伴黄色晕圈；块茎可见暗褐色凹陷干腐斑。',
    controlTips: ['与非茄科作物轮作2-3年', '增施钾肥提高植株抗性', '初发期轮换使用代森锰锌、吡唑醚菌酯、苯醚甲环唑'],
    placementTips: ['雨后优先清除病叶病株，减少田间菌源', '密植地块及时整枝通风', '采后彻底清园并妥善处理病残体'],
    references: [sharedReferences.fao, sharedReferences.aps, sharedReferences.natesc, sharedReferences.moa],
  },
  辣椒炭疽病: {
    image: '/images/encyclopedia/doc-2026/doc-disease-23.jpg',
    summary: '辣椒炭疽病在盛夏到初秋多雨高湿条件下流行迅速，果实近成熟期最易受害。',
    morphology: '病原主要为 Colletotrichum capsici 和 C. gloeosporioides，病斑湿润时常见橙红色黏质孢子团。',
    symptoms: '果面形成圆形至不规则凹陷斑，颜色由褐色逐渐加深；叶片病斑中央灰白、边缘褐色并可能穿孔。',
    controlTips: ['种子温水浸种并进行消毒处理', '采用高垄栽培和滴灌降低叶面湿度', '病果病叶及时清除并轮换使用咪鲜胺、苯醚甲环唑、代森锰锌'],
    placementTips: ['雨季加强果实巡查，及时摘除病果', '减少采收和整枝时机械伤口', '通风差地块优先进行疏枝处理'],
    references: [sharedReferences.fao, sharedReferences.aps, sharedReferences.natesc, sharedReferences.moa],
  },
  黄瓜霜霉病: {
    image: '/images/encyclopedia/doc-2026/doc-disease-24.jpg',
    summary: '黄瓜霜霉病在春秋保护地及露地多雨期高发，叶背霜状霉层是关键识别特征。',
    morphology: '病原为古巴假霜霉（Pseudoperonospora cubensis），属卵菌，低温高湿条件下侵染速度快。',
    symptoms: '叶面先现淡黄色褪绿斑，后形成黄褐色不规则病斑；对应叶背可见紫灰至黑色霜状霉层。',
    controlTips: ['优先选用抗病品种并控制种植密度', '温室加强通风降湿，减少夜间结露', '初发期轮换使用烯酰吗啉、霜霉威盐酸盐、氟噻唑吡乙酮'],
    placementTips: ['持续降雨后增加巡查频次', '病叶及时清除并带出园区', '灌溉优先滴灌，避免长时间叶面潮湿'],
    references: [sharedReferences.fao, sharedReferences.aps, sharedReferences.natesc, sharedReferences.moa],
  },
  葡萄霜霉病: {
    image: '/images/encyclopedia/doc-2026/doc-disease-25.jpg',
    summary: '葡萄霜霉病在夏季至初秋连阴雨和高湿条件下扩散快，叶背霜霉层与幼果失水硬化较典型。',
    morphology: '病原为葡萄生单轴霉（Plasmopara viticola），属卵菌病害，主要侵染叶片、新梢与幼果。',
    symptoms: '叶片正面出现淡黄色多角形病斑，背面对应处生白色霜层；幼果感病后易硬化、畸形并脱落。',
    controlTips: ['冬季清园并销毁病叶病梢', '生长期及时整枝摘心改善通风透光', '发病前后轮换使用代森锰锌、烯酰吗啉、霜脲氰等药剂'],
    placementTips: ['低洼园区优先排水并降低空气湿度', '雨后重点巡查新梢与幼果', '病残体集中处理，避免园内堆放'],
    references: [sharedReferences.fao, sharedReferences.aps, sharedReferences.natesc, sharedReferences.moa],
  },
  白菜软腐病: {
    image: '/images/encyclopedia/doc-2026/doc-disease-26.png',
    summary: '白菜软腐病在结球期高温高湿和伤口较多时发病重，病组织软烂并伴随明显异味。',
    morphology: '病原为 Erwinia carotovora subsp. carotovora（细菌），多从叶柄基部或虫伤口侵入。',
    symptoms: '病部初期呈水渍状半透明，后转灰褐色软腐并有臭味；结球白菜心叶腐烂，外叶萎蔫下垂。',
    controlTips: ['高垄栽培并防止田间积水', '避免连作并同步防治菜青虫、跳甲等害虫', '初发期喷施噻唑锌、噻菌铜、农用链霉素并及时拔除病株'],
    placementTips: ['雨后先排水再进行病株清理', '病穴撒施生石灰并隔离管理', '采收工具分区使用并定期消毒'],
    references: [sharedReferences.fao, sharedReferences.aps, sharedReferences.natesc, sharedReferences.moa],
  },
}

const buildInsectItem = (seed: InsectSeed, index: number): EncyclopediaItem => {
  const category = insectCategoryLabels[seed.category]

  return {
    id: makeId('insect', seed.scientificName, index),
    type: 'insect',
    name: seed.name,
    scientificName: seed.scientificName,
    genus: seed.genus,
    categoryCode: seed.category,
    category,
    risk: seed.risk,
    season: seed.season,
    host: seed.host,
    summary: `${seed.name}在${seed.season}于${seed.host}上易发生，属${seed.risk}风险虫害。`,
    morphology: `${seed.name}（${seed.scientificName}，${seed.genus}属），典型类别为${category}。`,
    symptoms: `${seed.name}危害后常导致叶片失绿、斑驳或组织受损，寄主范围包括：${seed.host}。`,
    image: namedImageOverrides[seed.name] ?? insectCategoryImages[seed.category] ?? imageBank.fallback,
    controlTips: [...baseControlTips],
    placementTips: [...basePlacementTips],
    references: [...commonReferences],
  }
}

const buildDiseaseItem = (seed: DiseaseSeed, index: number): EncyclopediaItem => {
  const category = diseaseCategoryLabels[seed.category]
  const override = docDiseaseOverrides[seed.name]

  return {
    id: makeId('disease', seed.scientificName, index + insectSeeds.length),
    type: 'disease',
    name: seed.name,
    scientificName: seed.scientificName,
    genus: seed.genus,
    categoryCode: seed.category,
    category,
    risk: seed.risk,
    season: seed.season,
    host: seed.host,
    summary: override?.summary ?? `${seed.name}在${seed.season}于${seed.host}上具有${seed.risk}风险，需重点监测。`,
    morphology: override?.morphology ?? `${seed.name}（病原：${seed.scientificName}，${seed.genus}属），归类为${category}。`,
    symptoms: override?.symptoms ?? `${seed.name}常导致植株组织坏死、失绿或萎蔫，典型寄主包括：${seed.host}。`,
    image: override?.image ?? namedImageOverrides[seed.name] ?? diseaseCategoryImages[seed.category] ?? imageBank.fallback,
    controlTips: override?.controlTips ?? [...baseControlTips],
    placementTips: override?.placementTips ?? [...basePlacementTips],
    references: override?.references ?? [...commonReferences],
  }
}

export const encyclopediaItems: EncyclopediaItem[] = [
  ...insectSeeds.map((seed, index) => buildInsectItem(seed, index)),
  ...diseaseSeeds.map((seed, index) => buildDiseaseItem(seed, index)),
]



