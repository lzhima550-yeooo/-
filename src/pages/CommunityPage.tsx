import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates'
import { LazyImage } from '../components/LazyImage'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { fetchCommunityPostsFromServer } from '../services/communityApi'
import { analytics } from '../services/analytics'
import { useAppStore } from '../store/useAppStore'
import type { CommunityPost } from '../types/models'

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const matchPostByTokens = (post: CommunityPost, tokens: string[]) => {
  if (tokens.length === 0) {
    return true
  }

  const searchable = normalizeText(
    [
      post.title,
      post.content,
      post.author,
      post.answers.map((answer) => `${answer.author} ${answer.content}`).join(' '),
    ].join(' '),
  )

  return tokens.every((token) => searchable.includes(token))
}

export function CommunityPage() {
  const posts = useAppStore((state) => state.posts)
  const favoritePostIds = useAppStore((state) => state.favoritePostIds)
  const toggleFavoritePost = useAppStore((state) => state.toggleFavoritePost)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'solved'>('all')
  const [remoteState, setRemoteState] = useState<{ loaded: boolean; items: CommunityPost[] }>({
    loaded: false,
    items: [],
  })
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')

  const deferredQuery = useDeferredValue(query)
  const sourcePosts = remoteState.loaded ? remoteState.items : posts

  const queryTokens = useMemo(() => {
    const normalized = normalizeText(deferredQuery)
    return normalized ? normalized.split(' ') : []
  }, [deferredQuery])

  useEffect(() => {
    if (!deferredQuery.trim()) {
      return
    }
    analytics.track('community_search', '/community', { query: deferredQuery })
  }, [deferredQuery])

  const filteredPosts = useMemo(() => {
    return sourcePosts.filter((post) => {
      const statusPass = statusFilter === 'all' || post.status === statusFilter
      if (!statusPass) {
        return false
      }

      return matchPostByTokens(post, queryTokens)
    })
  }, [queryTokens, sourcePosts, statusFilter])

  const onClearFilters = () => {
    setQuery('')
    setStatusFilter('all')
  }

  const onSyncRemote = async () => {
    setSyncing(true)
    setSyncError('')

    const result = await fetchCommunityPostsFromServer(query)

    if (result.ok) {
      setRemoteState({ loaded: true, items: result.data })
      setSyncMessage(`已同步云端帖子：${result.data.length} 条`)
    } else {
      setSyncError(result.message ?? '云端同步失败，继续使用本地帖子。')
      setSyncMessage('')
    }

    setSyncing(false)
  }

  return (
    <div>
      <PageHeader
        title="求助社区"
        subtitle="贴吧楼层式互助：富文本发帖、追问、图文标注"
        action={
          <Link
            to="/community/new"
            className="cursor-pointer rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--text-main)] transition hover:-translate-y-0.5 lg:text-sm"
          >
            发布求助
          </Link>
        }
      />

      <main className="space-y-3 px-4 py-4 lg:px-6 lg:py-5">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <MaterialSymbol
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--accent-deep)]"
              />
              <input
                data-testid="community-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、正文、作者或回复"
                className="h-10 w-full rounded-xl border border-[var(--line)] bg-white pl-10 pr-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-3 py-1 text-xs ${
                  statusFilter === 'all' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'
                }`}
              >
                全部状态
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('open')}
                className={`rounded-full px-3 py-1 text-xs ${
                  statusFilter === 'open' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'
                }`}
              >
                仅看待解决
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('solved')}
                className={`rounded-full px-3 py-1 text-xs ${
                  statusFilter === 'solved' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'
                }`}
              >
                仅看已解决
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-soft)]">
            <span>{filteredPosts.length} 条匹配结果</span>
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-lg border border-[var(--line)] bg-[var(--card-soft)] px-2 py-1 text-[var(--text-main)]"
            >
              清空筛选
            </button>
            <button
              type="button"
              onClick={onSyncRemote}
              disabled={syncing}
              className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[var(--accent-deep)] disabled:opacity-60"
            >
              {syncing ? '同步中...' : '同步云端帖子'}
            </button>
          </div>

          {syncMessage ? <p className="mt-2 text-xs text-emerald-700">{syncMessage}</p> : null}
          {syncError ? <ErrorState title="同步失败" description={syncError} /> : null}
        </section>

        {syncing ? (
          <LoadingState title="同步社区中" description="正在获取帖子列表..." />
        ) : filteredPosts.length === 0 ? (
          <EmptyState title="没有找到匹配帖子" description="建议缩短关键词或清空筛选后再试。" />
        ) : (
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {filteredPosts.map((post) => {
              const isFavorite = favoritePostIds.includes(post.id)
              const floorCount = post.answers.length + 1
              const latestFloor = post.answers[post.answers.length - 1]

              return (
                <article key={post.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
                  {post.image ? (
                    <LazyImage src={post.image} alt={post.title} className="h-40 w-full lg:h-52" fallbackSrc="/images/community-post-fallback.svg" />
                  ) : null}
                  <div className="p-3 lg:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-[var(--text-soft)] lg:text-sm">
                          {post.author} · {post.createdAt}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-[var(--text-main)] lg:text-base">{post.title}</h3>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${
                          post.status === 'open' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {post.status === 'open' ? '待解决' : '已解决'}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-soft)] lg:text-sm">{post.content}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-soft)] lg:text-xs">
                      <span className="rounded-full bg-[var(--card-soft)] px-2 py-1">{floorCount} 楼讨论</span>
                      {latestFloor ? (
                        <span className="rounded-full bg-[var(--card-soft)] px-2 py-1">
                          最新：{latestFloor.role === 'followup' ? '楼主追问' : '图文解答'}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <Link to={`/community/${post.id}`} className="text-xs font-semibold text-[var(--accent-deep)] lg:text-sm">
                        查看详情 / 回答
                      </Link>

                      <button
                        type="button"
                        className="flex cursor-pointer items-center gap-1 text-xs text-[var(--text-soft)] lg:text-sm"
                        onClick={() => toggleFavoritePost(post.id)}
                      >
                        <MaterialSymbol
                          name={isFavorite ? 'favorite' : 'favorite_border'}
                          filled={isFavorite}
                          className={`text-[17px] ${isFavorite ? 'text-emerald-600' : 'text-[var(--text-soft)]'}`}
                        />
                        <span>{isFavorite ? '已收藏' : '收藏'}</span>
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
