import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'


const buildAidaUrl = (id) => `https://lh3.googleusercontent.com/aida-public/${id}`

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
  fallback: '/images/community-post-fallback.svg',
}

const insectCategoryImages = {
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

const diseaseCategoryImages = {
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

const namedImageOverrides = {
  桃蚜: '/images/encyclopedia/local/bda672ac61322aebb80e43d262913eb6.jpg',
  棉蚜: '/images/encyclopedia/local/13a61076116cfd3da7c4303b4d75d8b6.jpg',
  七星瓢虫: '/images/914ec19753ff41c467235a1cc8413f5f.jpg',
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

    return response.json()
  }

  return { request }
}

const resolveImageByCategory = (row) => {
  const namedImage = namedImageOverrides[safeText(row.name)]
  if (namedImage) {
    return namedImage
  }

  if (row.type === 'insect') {
    return insectCategoryImages[row.category_code] ?? imageBank.fallback
  }

  return diseaseCategoryImages[row.category_code] ?? imageBank.fallback
}

const run = async () => {
  loadDotEnv()

  const client = createRestClient({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  const rows =
    (await client.request('encyclopedia_entries', {
      query: {
        select: 'id,type,name,category_code,category_name,image_url',
        order: 'created_at.asc',
        limit: 1000,
      },
    })) ?? []

  let deleted = 0
  let updated = 0

  for (const row of rows) {
    const categoryCode = safeText(row.category_code)
    const categoryName = safeText(row.category_name)
    const entryName = safeText(row.name)
    const isBeneficial =
      categoryCode === 'beneficial' ||
      categoryCode === 'beneficialPredator' ||
      categoryName === '天敌益虫' ||
      categoryName === '天敌昆虫'
    const isDeprecatedDuplicate = entryName === '小麦条锈病'

    if (isBeneficial || isDeprecatedDuplicate) {
      await client.request('encyclopedia_entries', {
        method: 'DELETE',
        query: {
          id: `eq.${row.id}`,
        },
      })
      deleted += 1
      continue
    }

    const nextImage = resolveImageByCategory(row)
    if (safeText(row.image_url) === nextImage) {
      continue
    }

    await client.request('encyclopedia_entries', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      query: {
        id: `eq.${row.id}`,
      },
      body: {
        image_url: nextImage,
      },
    })

    updated += 1
  }

  // eslint-disable-next-line no-console
  console.log(`Encyclopedia photo repair completed. updated=${updated}, deleted_beneficial=${deleted}, total=${rows.length}`)
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error.message)
  process.exit(1)
})
