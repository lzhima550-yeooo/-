import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates'
import { LazyImage } from '../components/LazyImage'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { encyclopediaItems } from '../mock/encyclopedia'
import { analytics } from '../services/analytics'
import { fetchEncyclopediaSearchFromServer, isBackendApiConfigured } from '../services/encyclopediaApi'
import { useAppStore } from '../store/useAppStore'
import type { EncyclopediaItem } from '../types/models'

const riskWeight: Record<EncyclopediaItem['risk'], number> = {
  高: 3,
  中: 2,
  低: 1,
}

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const queryExpander: Record<string, string[]> = {
  蚜虫: ['aphid', '刺吸式', '蜜露'],
  瓢虫: ['ladybug', 'coccinella', '天敌'],
  白粉病: ['powdery', '白粉'],
}

const allPreviewPriority = new Map(
  ['小麦锈病（条锈病）', '水稻纹枯病', '马铃薯早疫病', '辣椒炭疽病', '黄瓜霜霉病', '葡萄霜霉病', '白菜软腐病'].map((name, index) => [name, index]),
)

const scoreItem = (item: EncyclopediaItem, tokens: string[]) => {
  if (tokens.length === 0) {
    return 0
  }

  const searchable = {
    name: normalizeText(item.name),
    scientificName: normalizeText(item.scientificName),
    genus: normalizeText(item.genus),
    category: normalizeText(item.category),
    host: normalizeText(item.host),
    summary: normalizeText(item.summary),
    morphology: normalizeText(item.morphology),
    symptoms: normalizeText(item.symptoms),
    controls: normalizeText(item.controlTips.join(' ')),
  }

  let totalScore = 0

  for (const token of tokens) {
    let tokenScore = 0

    if (searchable.name.includes(token)) tokenScore += 8
    if (searchable.scientificName.includes(token)) tokenScore += 7
    if (searchable.genus.includes(token)) tokenScore += 6
    if (searchable.category.includes(token)) tokenScore += 5
    if (searchable.host.includes(token)) tokenScore += 4
    if (searchable.summary.includes(token)) tokenScore += 3
    if (searchable.morphology.includes(token)) tokenScore += 2
    if (searchable.symptoms.includes(token)) tokenScore += 2
    if (searchable.controls.includes(token)) tokenScore += 1

    if (tokenScore === 0) {
      return -1
    }

    totalScore += tokenScore
  }

  return totalScore
}

export function EncyclopediaPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const favoriteIds = useAppStore((state) => state.favoriteEncyclopediaIds)
  const recentIds = useAppStore((state) => state.recentEncyclopediaIds)
  const toggleFavorite = useAppStore((state) => state.toggleFavoriteEncyclopedia)

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [activeType, setActiveType] = useState<'all' | 'insect' | 'disease'>(
    (searchParams.get('t') as 'all' | 'insect' | 'disease') ?? 'all',
  )
  const [activeCategory, setActiveCategory] = useState(searchParams.get('c') ?? 'all')
  const [activeRisk, setActiveRisk] = useState<'all' | EncyclopediaItem['risk']>('all')
  const [sortMode, setSortMode] = useState<'smart' | 'risk' | 'name'>('smart')
  const [expertSearch, setExpertSearch] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])

  const [remoteState, setRemoteState] = useState<{ loaded: boolean; items: EncyclopediaItem[] }>({
    loaded: false,
    items: [],
  })
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')

  const deferredQuery = useDeferredValue(query)
  const sourceItems = remoteState.loaded ? remoteState.items : encyclopediaItems

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '')
  }, [searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams()
    const normalizedQuery = query.trim()

    if (normalizedQuery) nextParams.set('q', normalizedQuery)
    if (activeType !== 'all') nextParams.set('t', activeType)
    if (activeCategory !== 'all') nextParams.set('c', activeCategory)

    const current = searchParams.toString()
    const next = nextParams.toString()

    if (current !== next) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [activeCategory, activeType, query, searchParams, setSearchParams])

  const categoryOptions = useMemo(() => {
    const scoped = sourceItems.filter((item) => activeType === 'all' || item.type === activeType)
    const unique = Array.from(new Set(scoped.map((item) => item.category)))
    return ['all', ...unique]
  }, [activeType, sourceItems])

  useEffect(() => {
    if (!categoryOptions.includes(activeCategory)) {
      setActiveCategory('all')
    }
  }, [activeCategory, categoryOptions])

  const normalizedTokens = useMemo(() => {
    const normalized = normalizeText(deferredQuery)
    if (!normalized) {
      return []
    }

    const baseTokens = normalized.split(' ')
    const expanded = baseTokens.flatMap((token) => queryExpander[token] ?? [])
    return Array.from(new Set([...baseTokens, ...expanded]))
  }, [deferredQuery])

  const allFilteredItems = useMemo(() => {
    const filtered = sourceItems.filter((item) => {
      const typePass = activeType === 'all' || item.type === activeType
      const categoryPass = activeCategory === 'all' || item.category === activeCategory
      const riskPass = activeRisk === 'all' || item.risk === activeRisk
      if (!typePass || !categoryPass || !riskPass) {
        return false
      }

      return scoreItem(item, normalizedTokens) >= 0
    })

    const sorted = [...filtered].sort((left, right) => {
      if (sortMode === 'name') {
        return left.name.localeCompare(right.name, 'zh-CN')
      }

      if (sortMode === 'risk') {
        return riskWeight[right.risk] - riskWeight[left.risk]
      }

      const leftScore = scoreItem(left, normalizedTokens)
      const rightScore = scoreItem(right, normalizedTokens)
      if (rightScore !== leftScore) {
        return rightScore - leftScore
      }

      const riskDiff = riskWeight[right.risk] - riskWeight[left.risk]
      if (riskDiff !== 0) {
        return riskDiff
      }

      const leftPriority = allPreviewPriority.get(left.name) ?? Number.POSITIVE_INFINITY
      const rightPriority = allPreviewPriority.get(right.name) ?? Number.POSITIVE_INFINITY
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.name.localeCompare(right.name, 'zh-CN')
    })

    return sorted
  }, [activeCategory, activeRisk, activeType, normalizedTokens, sortMode, sourceItems])

  const favoriteItems = useMemo(
    () => sourceItems.filter((item) => favoriteIds.includes(item.id)).slice(0, 8),
    [favoriteIds, sourceItems],
  )
  const recentItems = useMemo(
    () => recentIds.map((id) => sourceItems.find((item) => item.id === id)).filter((item): item is EncyclopediaItem => Boolean(item)).slice(0, 8),
    [recentIds, sourceItems],
  )

  const items = allFilteredItems
  const hasFilters = Boolean(query.trim()) || activeType !== 'all' || activeCategory !== 'all' || activeRisk !== 'all'

  const onResetFilters = () => {
    setQuery('')
    setActiveType('all')
    setActiveCategory('all')
    setActiveRisk('all')
    setSortMode('smart')
  }

  const onSyncRemote = async () => {
    setSyncing(true)
    setSyncError('')
    analytics.track('encyclopedia_sync_click', '/encyclopedia', { expertSearch })

    const result = await fetchEncyclopediaSearchFromServer({
      q: query,
      type: activeType,
      risk: activeRisk,
      category: activeCategory,
      limit: 200,
    })

    if (result.ok) {
      setRemoteState({ loaded: true, items: result.data })
      setSyncMessage(`已同步云端图鉴：${result.data.length} 条`)
    } else {
      setSyncError(result.message ?? '云端同步失败，使用本地数据。')
      setSyncMessage('')
    }

    setSyncing(false)
  }

  const onToggleCompare = (entryId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(entryId)) {
        return prev.filter((id) => id !== entryId)
      }
      if (prev.length >= 2) {
        return [prev[1], entryId]
      }
      return [...prev, entryId]
    })
  }

  const comparedItems = compareIds
    .map((id) => sourceItems.find((item) => item.id === id))
    .filter((item): item is EncyclopediaItem => Boolean(item))

  return (
    <div>
      <PageHeader title="图鉴库" subtitle="联网专业检索 + 排序对比 + 收藏回看" />

      <main className="space-y-4 px-4 py-4 lg:px-6 lg:py-5">
        <div className="lg:flex lg:items-center lg:gap-3">
          <div className="relative flex-1">
            <MaterialSymbol
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--accent-deep)]"
            />
            <input
              data-testid="encyclopedia-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索虫害/病害/寄主/学名"
              className="h-11 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-12 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[var(--card-soft)] p-1 text-[var(--text-soft)]"
                aria-label="清空搜索"
              >
                <MaterialSymbol name="close" className="text-[16px]" />
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex gap-2 lg:mt-0 lg:flex-shrink-0">
            {[
              { key: 'all', label: '全部' },
              { key: 'insect', label: '虫害' },
              { key: 'disease', label: '病害' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-full px-4 py-2 text-xs transition ${
                  activeType === tab.key
                    ? 'bg-[var(--accent)] text-[var(--text-main)]'
                    : 'bg-white text-[var(--text-soft)] hover:bg-[var(--card-soft)]'
                }`}
                onClick={() => {
                  setActiveType(tab.key as 'all' | 'insect' | 'disease')
                  setActiveCategory('all')
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--text-soft)]">专业筛选</p>
            <p data-testid="encyclopedia-result-count" className="text-xs text-[var(--text-soft)]">
              {items.length} 条结果
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryOptions.map((category) => {
              const label = category === 'all' ? '全部分类' : category
              return (
                <button
                  key={category}
                  type="button"
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
                    activeCategory === category
                      ? 'bg-[var(--accent-deep)] text-white'
                      : 'bg-[var(--card-soft)] text-[var(--text-soft)] hover:bg-[color:var(--accent)/0.35]'
                  }`}
                  onClick={() => setActiveCategory(category)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {(['all', '高', '中', '低'] as const).map((risk) => (
              <button
                key={risk}
                type="button"
                onClick={() => setActiveRisk(risk)}
                className={`rounded-full px-3 py-1 text-xs ${
                  activeRisk === risk ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'
                }`}
              >
                {risk === 'all' ? '全部风险' : `${risk}风险`}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--text-soft)]">
              <input type="checkbox" checked={expertSearch} onChange={(event) => setExpertSearch(event.target.checked)} />
              联网专业检索
            </label>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as 'smart' | 'risk' | 'name')}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--text-soft)]"
            >
              <option value="smart">智能排序</option>
              <option value="risk">按风险排序</option>
              <option value="name">按名称排序</option>
            </select>
            <button
              type="button"
              onClick={onResetFilters}
              className="rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-3 py-1.5 text-xs text-[var(--text-main)]"
            >
              重置筛选条件
            </button>
            <button
              type="button"
              onClick={onSyncRemote}
              disabled={!expertSearch || syncing}
              className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--accent-deep)] disabled:opacity-60"
            >
              {syncing ? '检索中...' : '联网检索'}
            </button>
            {!isBackendApiConfigured ? <span className="text-xs text-[var(--text-soft)]">未配置后端地址</span> : null}
          </div>

          {syncMessage ? <p className="mt-2 text-xs text-emerald-700">{syncMessage}</p> : null}
          {syncError ? <ErrorState title="检索失败" description={syncError} /> : null}
        </section>

        {comparedItems.length === 2 ? (
          <section className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:grid-cols-2">
            {comparedItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
                <h3 className="text-sm font-bold text-[var(--text-main)]">{item.name}</h3>
                <p className="mt-1 text-xs text-[var(--text-soft)]">{item.scientificName}</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">风险：{item.risk}</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">高发：{item.season}</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">寄主：{item.host}</p>
              </article>
            ))}
          </section>
        ) : null}

        {favoriteItems.length > 0 || recentItems.length > 0 ? (
          <section className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--text-main)]">图鉴收藏夹</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {favoriteItems.length === 0 ? <span className="text-xs text-[var(--text-soft)]">暂无收藏</span> : null}
                {favoriteItems.map((item) => (
                  <Link key={item.id} to={`/encyclopedia/${item.id}`} className="rounded-full bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-soft)]">
                    {item.name}
                  </Link>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--text-main)]">最近浏览</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {recentItems.length === 0 ? <span className="text-xs text-[var(--text-soft)]">暂无最近浏览</span> : null}
                {recentItems.map((item) => (
                  <Link key={item.id} to={`/encyclopedia/${item.id}`} className="rounded-full bg-[var(--card-soft)] px-3 py-1 text-xs text-[var(--text-soft)]">
                    {item.name}
                  </Link>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {syncing ? (
          <LoadingState title="检索中" description="正在获取图鉴数据..." />
        ) : items.length === 0 ? (
          <div data-testid="encyclopedia-empty-state">
            <EmptyState
              title="没有找到匹配结果"
              description="建议更换关键词，或清除筛选重新浏览。"
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--text-main)]"
                  >
                    清除搜索与筛选
                  </button>
                ) : undefined
              }
              className=""
            />
          </div>
        ) : (
          <section data-testid="encyclopedia-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 lg:gap-4">
            {items.map((item) => {
              const hostTag = item.host.split(/[、，,]/)[0]
              const isFavorite = favoriteIds.includes(item.id)
              const inCompare = compareIds.includes(item.id)

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Link to={`/encyclopedia/${item.id}`} className="block" onClick={() => analytics.track('encyclopedia_open_item', '/encyclopedia', { id: item.id })}>
                    <LazyImage
                      src={item.image}
                      alt={item.name}
                      className="h-28 w-full md:h-32"
                      fallbackSrc="/images/community-post-fallback.svg"
                    />
                  </Link>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-[var(--text-main)] lg:text-base">{item.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-soft)] lg:text-sm">{item.summary}</p>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded-full bg-[var(--card-soft)] px-2 py-1 text-[var(--text-soft)]">{item.season}</span>
                      <span className="rounded-full bg-[color:var(--accent)/0.35] px-2 py-1 text-[var(--text-main)]">{item.risk}风险</span>
                      <span className="rounded-full bg-[var(--card-soft)] px-2 py-1 text-[var(--text-soft)]">{hostTag}</span>
                      <span className="rounded-full bg-[var(--card-soft)] px-2 py-1 text-[var(--text-soft)]">{item.category}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--text-soft)]"
                      >
                        <MaterialSymbol name={isFavorite ? 'favorite' : 'favorite_border'} filled={isFavorite} className={`text-[14px] ${isFavorite ? 'text-rose-500' : ''}`} />
                        {isFavorite ? '已收藏' : '收藏'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleCompare(item.id)}
                        className={`rounded-full px-2 py-1 text-[11px] ${inCompare ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'}`}
                      >
                        {inCompare ? '已对比' : '加入对比'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}




