import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LazyImage } from '../components/LazyImage'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { encyclopediaItems } from '../mock/encyclopedia'
import {
  fetchHomeFeedFromServer,
  type HomeFeedAlert,
  type HomeFeedPick,
  type HomeFeedReminder,
} from '../services/homeApi'
import { useAppStore } from '../store/useAppStore'
import { useImageFallback } from '../utils/imageFallback'

const homeCampusImage = '/images/f81d2a14153a123eeb3bb9ff05474dc1.jpg'
const homeCampusFallback = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480">
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#d8ead2"/>
    <stop offset="100%" stop-color="#a0c4a4"/>
  </linearGradient>
  <rect width="1200" height="480" fill="url(#g)"/>
  <text x="52" y="410" fill="#2f5f49" font-size="52" font-family="'Noto Sans SC', sans-serif">探索校园四季</text>
</svg>
`)}`

const quickActions = [
  {
    key: 'identify',
    label: 'AI识别',
    icon: 'center_focus_strong',
    path: '/identify',
    tone: 'bg-[color:var(--accent-deep)/0.14] text-[var(--accent-deep)]',
  },
  {
    key: 'encyclopedia',
    label: '百科',
    icon: 'menu_book',
    path: '/encyclopedia',
    tone: 'bg-[color:var(--accent)/0.32] text-[var(--text-main)]',
  },
  {
    key: 'community',
    label: '社区',
    icon: 'groups',
    path: '/community',
    tone: 'bg-[var(--card-soft)] text-[var(--accent-deep)]',
  },
  {
    key: 'spirit',
    label: '灵化',
    icon: 'auto_awesome',
    path: '/spirit',
    tone: 'bg-[color:var(--accent)/0.2] text-[var(--accent-deep)]',
  },
]

export function HomePage() {
  const navigate = useNavigate()
  const posts = useAppStore((state) => state.posts)
  const [searchText, setSearchText] = useState('')
  const [feedAlerts, setFeedAlerts] = useState<HomeFeedAlert[]>([])
  const [feedPicks, setFeedPicks] = useState<HomeFeedPick[]>([])
  const [feedReminders, setFeedReminders] = useState<HomeFeedReminder[]>([])
  const [feedError, setFeedError] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      const result = await fetchHomeFeedFromServer()
      if (!active) {
        return
      }

      if (result.ok) {
        setFeedAlerts(result.data.alerts)
        setFeedPicks(result.data.picks)
        setFeedReminders(result.data.reminders)
        setFeedError('')
        return
      }

      setFeedError(result.message ?? '首页聚合数据加载失败，已切换本地兜底。')
    })()

    return () => {
      active = false
    }
  }, [])

  const topAlerts = useMemo<HomeFeedAlert[]>(
    () =>
      encyclopediaItems.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        risk: item.risk,
        summary: item.summary,
        image: item.image,
        season: item.season,
      })),
    [],
  )

  const localPicks = useMemo<HomeFeedPick[]>(
    () =>
      posts.slice(0, 4).map((post) => ({
        id: post.id,
        title: post.title,
        author: post.author,
        image: post.image ?? '',
        likes: post.likes,
        status: post.status,
        createdAt: post.createdAt,
      })),
    [posts],
  )

  const alerts = feedAlerts.length > 0 ? feedAlerts : topAlerts
  const picks = feedPicks.length > 0 ? feedPicks : localPicks

  const onSearch = (event: FormEvent) => {
    event.preventDefault()
    const query = searchText.trim()

    if (!query) {
      navigate('/encyclopedia')
      return
    }

    navigate(`/encyclopedia?q=${encodeURIComponent(query)}`)
  }

  return (
    <div className="pb-5">
      <PageHeader title="四季夏木" subtitle="校园植保知识社区" />

      <main className="space-y-6 px-4 pt-4 lg:space-y-7 lg:px-6 lg:pt-5">
        <form className="flex items-center gap-2" onSubmit={onSearch}>
          <label htmlFor="home-search" className="sr-only">
            首页搜索
          </label>
          <div className="relative min-w-0 flex-1">
            <MaterialSymbol name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--accent-deep)]" />
            <input
              id="home-search"
              data-testid="home-search-input"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索病虫害、植物症状"
              className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>
          <button
            data-testid="home-search-submit"
            type="submit"
            className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--text-main)]"
          >
            <MaterialSymbol name="travel_explore" className="text-[18px]" />
            搜索图鉴
          </button>
        </form>

        <section className="relative overflow-hidden rounded-2xl lg:rounded-[24px]">
          <img
            src={homeCampusImage}
            alt="校园四季"
            className="h-44 w-full object-cover md:h-52 lg:h-64"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = homeCampusFallback
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white lg:bottom-5 lg:left-5 lg:right-5">
            <p className="text-xs lg:text-sm">今日推荐</p>
            <h2 className="text-2xl font-bold lg:text-3xl">探索校园四季</h2>
            <p className="mt-1 text-sm text-white/90 lg:text-base">发现植物与昆虫的秘密，轻松学植保</p>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-3 lg:gap-4">
          {quickActions.map((action) => (
            <button
              key={action.key}
              type="button"
              className="cursor-pointer rounded-2xl border border-[var(--line)] bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md lg:p-4"
              onClick={() => navigate(action.path)}
            >
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-2xl ${action.tone} lg:h-12 lg:w-12`}>
                <MaterialSymbol name={action.icon} className="text-[22px]" />
              </div>
              <div className="mt-2 text-xs text-[var(--text-main)] lg:text-sm">{action.label}</div>
            </button>
          ))}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold text-[var(--text-main)] lg:text-xl">本月高警报</h3>
            <button
              type="button"
              className="text-xs text-[var(--accent-deep)] lg:text-sm"
              onClick={() => navigate('/encyclopedia')}
            >
              查看更多
            </button>
          </div>

          {feedError ? <p className="mb-2 text-xs text-[var(--text-soft)]">{feedError}</p> : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {alerts.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-white p-3 shadow-sm lg:p-4">
                <div className="flex gap-3">
                  <LazyImage
                    src={item.image}
                    alt={item.name}
                    className="h-16 w-16 rounded-lg lg:h-20 lg:w-20"
                    fallbackSrc="/images/community-post-fallback.svg"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-[var(--text-main)] lg:text-base">{item.name}</h4>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-soft)] lg:text-sm">{item.summary}</p>
                    <p className="mt-1 text-[11px] text-red-500 lg:text-xs">{item.risk}风险</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-lg font-bold text-[var(--text-main)] lg:text-xl">社区精选</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
            {picks.map((post) => (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
                {post.image ? (
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-36 w-full object-cover lg:h-44"
                    onError={(event) => useImageFallback(event)}
                  />
                ) : null}
                <div className="p-3 lg:p-4">
                  <h4 className="text-sm font-semibold text-[var(--text-main)] lg:text-base">{post.title}</h4>
                  <p className="mt-1 text-xs text-[var(--text-soft)] lg:text-sm">{post.author}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section data-testid="home-reminders-section" className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-main)] lg:text-base">任务提醒</h3>
            <button type="button" className="text-xs text-[var(--accent-deep)]" onClick={() => navigate('/spirit')}>
              去灵化
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {feedReminders.length === 0 ? (
              <li className="text-xs text-[var(--text-soft)]">暂无待处理提醒</li>
            ) : (
              feedReminders.map((item) => (
                <li key={item.id} className="rounded-xl border border-[var(--line)] bg-[var(--card-soft)] px-3 py-2 text-xs">
                  <p className="font-semibold text-[var(--text-main)]">{item.title}</p>
                  <p className="mt-1 text-[var(--text-soft)]">
                    状态：{item.status || 'draft'} · 更新时间：{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '--'}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  )
}
