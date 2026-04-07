import type { CommunityPost } from '../types/models'

export const communityPostsSeed: CommunityPost[] = [
  {
    id: 'p-cabbageworm',
    title: '\u6708\u5b63\u4e0a\u5bc6\u5bc6\u9ebb\u9ebb\u5c0f\u7eff\u866b\uff0c\u662f\u86dc\u866b\u5417\uff1f',
    content:
      '\u6708\u5b63\u65b0\u68a2\u4e0a\u5168\u662f\u8fd9\u79cd\u5bc6\u5bc6\u9ebb\u9ebb\u7684\u5c0f\u7eff\u866b\uff0c\u635f\u4e00\u4e0b\u4f1a\u51fa\u6c41\uff0c\u722c\u5f97\u5f88\u5feb\uff0c\u5df2\u7ecf\u6709\u51e0\u7247\u5ae9\u53f6\u53d1\u5377\uff0c\u62c5\u5fc3\u6269\u6563\u5230\u65c1\u8fb9\u82b1\u575b\u3002',
    image: 'https://rdsufmjaifdhhgztpcts.supabase.co/storage/v1/object/public/community-images/community-doc/post-01.png',
    status: 'solved',
    author: '\u8336\u9053\u8d5b\u9ad8',
    createdAt: '5\u5c0f\u65f6\u524d',
    likes: 58,
    answers: [
      {
        id: 'a-cabbageworm-2',
        author: '\u6821\u56ed\u690d\u4fdd\u793e-\u6797\u540c\u5b66',
        content:
          '\u770b\u63cf\u8ff0\u57fa\u672c\u5c31\u662f\u86dc\u866b\uff0c\u5148\u6e05\u6c34\u51b2\u6d17\u866b\u7fa4\uff0c\u518d\u4f4e\u6d53\u5ea6\u80a5\u7682\u6c34\u5904\u7406\uff0c\u8fde\u7eed3\u5929\u89c2\u5bdf\u866b\u53e3\u53d8\u5316\u3002',
        createdAt: '4\u5c0f\u65f6\u524d',
        role: 'answer',
        floor: 2,
      },
    ],
  },
  {
    id: 'p-mealybug',
    title: '\u591a\u8089\u53f6\u7247\u767d\u8272\u7d6e\u72b6\u7269\u662f\u7c89\u8681\u5417\uff1f',
    content:
      '\u591a\u8089\u53f6\u817a\u91cc\u6709\u767d\u8272\u68c9\u7d6e\u6837\u7269\u8d28\uff0c\u6478\u8d77\u6765\u9ecf\u9ecf\u7684\uff0c\u53f6\u7247\u6709\u70b9\u53d1\u8f6f\u53d1\u76b1\uff0c\u60f3\u786e\u8ba4\u662f\u5426\u7c89\u8681\u5e76\u627e\u5904\u7406\u65b9\u6848\u3002',
    image: 'https://rdsufmjaifdhhgztpcts.supabase.co/storage/v1/object/public/community-images/community-doc/post-02.png',
    status: 'open',
    author: '\u519c\u5b66\u9662\u5e03\u5e03\u5b50',
    createdAt: '\u521a\u521a',
    likes: 17,
    answers: [
      {
        id: 'a-mealybug-2',
        author: '\u591a\u8089\u5c0f\u7ec4-\u9752\u79be',
        content:
          '\u5f88\u50cf\u7c89\u8681\uff0c\u53ef\u5148\u68c9\u7b7e\u9152\u7cbe\u70b9\u6740\uff0c\u6e05\u7406\u53f6\u817a\uff0c\u5206\u76c6\u9694\u79bb\u4e00\u5468\u89c2\u5bdf\u3002',
        createdAt: '3\u5206\u949f\u524d',
        role: 'answer',
        floor: 2,
      },
    ],
  },
  {
    id: 'p-monstera',
    title: '\u9f9f\u80cc\u7af9\u53f6\u7247\u51fa\u73b0\u8910\u8272\u6591\u70b9\uff0c\u600e\u4e48\u5904\u7406\uff1f',
    content:
      '\u6700\u8fd1\u4e24\u5468\u9f9f\u80cc\u7af9\u53f6\u7247\u8fb9\u7f18\u51fa\u73b0\u8910\u6591\uff0c\u5e76\u5728\u6269\u5927\uff0c\u6709\u7684\u6591\u70b9\u4e2d\u95f4\u5df2\u53d1\u9ed1\uff0c\u60f3\u8bf7\u6559\u662f\u75c5\u5bb3\u8fd8\u662f\u6d47\u6c34\u95ee\u9898\u3002',
    image: 'https://rdsufmjaifdhhgztpcts.supabase.co/storage/v1/object/public/community-images/community-doc/post-03.png',
    status: 'open',
    author: '\u542c\u96e8\u7684\u58f0\u97f3',
    createdAt: '2\u5c0f\u65f6\u524d',
    likes: 41,
    answers: [
      {
        id: 'a-monstera-2',
        author: '\u690d\u4fdd\u793e\u56e2-\u5c0f\u6797',
        content:
          '\u5148\u526a\u6389\u91cd\u75c5\u53f6\uff0c\u68c0\u67e5\u662f\u5426\u79ef\u6c34\uff0c\u6682\u505c\u53f6\u9762\u55b7\u6c34\u5e76\u52a0\u5f3a\u901a\u98ce\uff0c\u89c2\u5bdf\u65b0\u53f6\u662f\u5426\u7ee7\u7eed\u6269\u6591\u3002',
        createdAt: '1\u5c0f\u65f6\u524d',
        role: 'answer',
        floor: 2,
      },
    ],
  },
  {
    id: 'p-gardenia',
    title: '\u6800\u5b50\u82b1\u53f6\u7247\u5927\u9762\u79ef\u53d1\u9ec4\uff0c\u53f6\u8109\u8fd8\u7eff\u7740\uff0c\u662f\u7f3a\u80a5\u5417\uff1f',
    content:
      '\u517b\u4e86\u5927\u534a\u5e74\u7684\u6800\u5b50\u82b1\uff0c\u6700\u8fd1\u4e00\u4e2a\u6708\u53f6\u7247\u5927\u9762\u79ef\u53d1\u9ec4\uff0c\u4f46\u53f6\u8109\u4ecd\u7eff\uff0c\u82b1\u82de\u4e5f\u6389\u4e86\u4e0d\u5c11\uff0c\u60f3\u786e\u8ba4\u662f\u5426\u7f3a\u94c1\u6216\u6839\u7cfb\u95ee\u9898\u3002',
    image: 'https://rdsufmjaifdhhgztpcts.supabase.co/storage/v1/object/public/community-images/community-doc/post-04.png',
    status: 'open',
    author: '\u5411\u5357',
    createdAt: '3\u5c0f\u65f6\u524d',
    likes: 63,
    answers: [
      {
        id: 'a-gardenia-2',
        author: '\u82b1\u5320\u963f\u51ef',
        content:
          '\u8fd9\u662f\u5178\u578b\u7f3a\u94c1\u6027\u9ec4\u53f6\uff0c\u6800\u5b50\u82b1\u559c\u9178\uff0c\u53ef\u7528\u786b\u9178\u4e9a\u94c1\u6eb6\u6db2\u707c\u6839+\u55b7\u53f6\uff0c10\u5929\u4e00\u6b21\uff0c\u8fde\u7eed2-3\u6b21\u89c2\u5bdf\u8f6c\u7eff\u3002',
        createdAt: '2\u5c0f\u65f6\u524d',
        role: 'answer',
        floor: 2,
      },
    ],
  },
  {
    id: 'p-pothos',
    title: '\u7eff\u841d\u53f6\u7247\u957f\u9ed1\u8910\u8272\u6591\u70b9\uff0c\u8d8a\u6765\u8d8a\u591a\uff0c\u662f\u9ed1\u6591\u75c5\u5417\uff1f',
    content:
      '\u529e\u516c\u5ba4\u7eff\u841d\u53f6\u7247\u4e0a\u6709\u5f88\u591a\u9ed1\u8910\u8272\u5c0f\u6591\u70b9\uff0c\u8fb9\u7f18\u6709\u9ec4\u6655\uff0c\u5e76\u4e14\u8d8a\u6765\u8d8a\u591a\uff0c\u901a\u98ce\u4e0d\u592a\u597d\uff0c\u6000\u7591\u9ed1\u6591\u75c5\u3002',
    image: 'https://rdsufmjaifdhhgztpcts.supabase.co/storage/v1/object/public/community-images/community-doc/post-05.png',
    status: 'open',
    author: '\u4e0d\u60f3\u8003\u516c',
    createdAt: '1\u5c0f\u65f6\u524d',
    likes: 36,
    answers: [
      {
        id: 'a-pothos-2',
        author: '\u7eff\u690d\u517b\u62a4\u5e08',
        content:
          '\u503e\u5411\u70ad\u75bd\u75c5\uff08\u9ed1\u6591\u75c5\uff09\uff0c\u5148\u526a\u6389\u75c5\u53f6\u5e76\u9500\u6bc1\uff0c\u518d\u7528\u6740\u83cc\u5242\u5168\u682a\u55b7\u65bd+\u707c\u6839\uff0c5\u5929\u4e00\u6b21\u8fde\u505a3\u6b21\uff0c\u5e76\u63d0\u5347\u901a\u98ce\u3002',
        createdAt: '35\u5206\u949f\u524d',
        role: 'answer',
        floor: 2,
      },
    ],
  },
]
