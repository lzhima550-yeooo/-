import type { SpiritProfile } from '../types/models'

export const spiritProfiles: SpiritProfile[] = [
  {
    id: 'ladybug',
    name: '瓢虫精灵',
    englishName: 'Ladybug Spirit',
    scientificName: 'Coccinella septempunctata',
    genus: 'Coccinella',
    keywords: ['瓢虫', '益虫', '蚜虫天敌', 'coccinella'],
    expertTags: ['鞘翅目', '瓢虫科', 'Coccinella属', '捕食性天敌', '综合防治友好'],
    avatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80',
    image: '/images/914ec19753ff41c467235a1cc8413f5f.jpg',
    realPhoto:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Coccinella_septempunctata_01.jpg/1280px-Coccinella_septempunctata_01.jpg',
    habits: ['昼行性，喜温暖光照环境', '以蚜虫、木虱和粉虱若虫为主要食物', '对农药残留敏感，适合生态校园场景'],
    chatLines: ['我是瓢虫精灵，最擅长帮你压制蚜虫种群。', '你给我保留花带和低药压环境，我会长期驻场。'],
    quickReplies: {
      prevention:
        '防治建议：优先保护天敌和生境，先用清水冲洗虫源，再配合低风险药剂轮换，避免广谱药一次性清场。',
      habit:
        '生活习性：我在晴朗白天活动更频繁，喜欢在嫩梢和叶背巡查，虫口上升期会快速聚集捕食。',
      appearance:
        '外貌特征：成虫半球形、鞘翅红底黑斑，前胸背板常见浅色斑；幼虫细长、体表具刺突。',
    },
  },
  {
    id: 'aphid',
    name: '蚜虫娘',
    englishName: 'Aphid Sprite',
    scientificName: 'Aphis gossypii',
    genus: 'Aphis',
    keywords: ['蚜虫', '卷叶', '蜜露'],
    expertTags: ['半翅目', '蚜科', 'Aphis属', '刺吸式口器', '高繁殖率'],
    avatar:
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
    image:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
    realPhoto:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Aphid_on_leaf_05.jpg/1280px-Aphid_on_leaf_05.jpg',
    habits: ['群居繁殖速度快', '偏好嫩叶和嫩梢', '分泌蜜露易诱发煤污病'],
    chatLines: ['别误会，我出现往往是植物太嫩太密。', '改善通风和控氮管理，会明显压低我的数量。'],
    quickReplies: {
      prevention: '防治建议：加强修剪与通风，控氮稳长，优先使用黄板和生物防治，再考虑选择性药剂。',
      habit: '生活习性：我常在嫩梢、叶背密集群聚，温暖干燥时扩繁很快，并可通过有翅型迁飞扩散。',
      appearance: '外貌特征：体形小而柔软，多为黄绿或黑色，腹管明显，常伴随卷叶和粘性蜜露。',
    },
  },
  {
    id: 'powdery',
    name: '白粉灵',
    englishName: 'Powdery Fairy',
    scientificName: 'Erysiphe cichoracearum',
    genus: 'Erysiphe',
    keywords: ['白粉病', '粉状', '病害'],
    expertTags: ['子囊菌门', '白粉病菌复合群', '气传孢子', '叶面病斑'],
    avatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
    image:
      'https://images.unsplash.com/photo-1468327768560-75b778cbb551?auto=format&fit=crop&w=1000&q=80',
    realPhoto:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Powdery_Mildew_on_Pumpkin_Leaf.jpg/1280px-Powdery_Mildew_on_Pumpkin_Leaf.jpg',
    habits: ['潮湿郁闭环境活跃', '先侵染叶面后扩展', '温差大且通风差时易爆发'],
    chatLines: ['我喜欢闷湿、拥挤和叶面长期带露。', '通风、修剪和预防性管理是克制我的关键。'],
    quickReplies: {
      prevention: '防治建议：降低叶面湿度，及时摘除病叶，控制郁闭度，并进行保护性喷施和轮换用药。',
      habit: '生活习性：孢子可随气流传播，先在叶面形成白粉状菌落，再向叶柄和嫩梢扩展。',
      appearance: '外貌特征：叶面出现白色粉状斑，后期可融合成片并导致叶片黄化、卷曲和早衰。',
    },
  },
]
