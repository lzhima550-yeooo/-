import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/AsyncStates'
import { LazyImage } from '../components/LazyImage'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { PageHeader } from '../components/PageHeader'
import { encyclopediaItems } from '../mock/encyclopedia'
import {
  fetchEncyclopediaDetailFromServer,
  isBackendApiConfigured,
  type EncyclopediaDetailResult,
} from '../services/encyclopediaApi'
import type { EncyclopediaItem } from '../types/models'
import { useAppStore } from '../store/useAppStore'

const buildLocalDetail = (entry: EncyclopediaItem): EncyclopediaDetailResult => {
  const relatedEntries = encyclopediaItems.filter((item) => item.id !== entry.id && item.type === entry.type).slice(0, 4)
  return {
    id: entry.id,
    entry,
    sourceIndex: entry.references.map((ref, index) => ({
      id: `${entry.id}-source-${index + 1}`,
      sourceType: 'reference',
      title: `参考来源 ${index + 1}`,
      url: ref,
      snippet: ref,
      confidenceScore: 70,
      confidenceLabel: '中',
    })),
    treatmentTemplate: {
      entryId: entry.id,
      immediateActions: entry.controlTips.slice(0, 2),
      environmentAdjustments: entry.placementTips.slice(0, 2),
      followUpSchedule: ['24 小时复查', '48 小时复查'],
      cautionNotes: ['该模板为离线演示模板，建议结合现场情况调整。'],
    },
    relatedEntries,
  }
}

export function EncyclopediaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const localEntry = useMemo(() => encyclopediaItems.find((entry) => entry.id === id), [id])
  const canRequestRemote = Boolean(id && isBackendApiConfigured)

  const addRecent = useAppStore((state) => state.addRecentEncyclopedia)
  const favoriteIds = useAppStore((state) => state.favoriteEncyclopediaIds)
  const toggleFavorite = useAppStore((state) => state.toggleFavoriteEncyclopedia)

  const [remoteDetail, setRemoteDetail] = useState<EncyclopediaDetailResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remoteAttempted, setRemoteAttempted] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadDetail = async () => {
      setRemoteAttempted(false)
      setRemoteDetail(null)
      setError('')
      setLoading(false)

      if (!canRequestRemote || !id) {
        setRemoteAttempted(true)
        return
      }

      setLoading(true)
      const result = await fetchEncyclopediaDetailFromServer(id)

      if (cancelled) {
        return
      }

      if (result.ok && result.data) {
        setRemoteDetail(result.data)
      } else {
        setError(result.message ?? '图鉴详情加载失败，已使用本地内容。')
      }

      setLoading(false)
      setRemoteAttempted(true)
    }

    void loadDetail()

    return () => {
      cancelled = true
    }
  }, [canRequestRemote, id])

  const detail = remoteDetail ?? (localEntry ? buildLocalDetail(localEntry) : null)
  const waitingForRemoteDetail = !detail && canRequestRemote && !remoteAttempted

  useEffect(() => {
    if (detail?.entry.id) {
      addRecent(detail.entry.id)
    }
  }, [addRecent, detail?.entry.id])

  if (waitingForRemoteDetail) {
    return (
      <div>
        <PageHeader title="图鉴详情" subtitle="正在加载证据化详情" />
        <main className="px-4 py-4 lg:px-6 lg:py-5">
          <LoadingState title="图鉴详情加载中" description="正在拉取证据化详情..." />
        </main>
      </div>
    )
  }

  if (!detail) {
    return <Navigate to="/encyclopedia" replace />
  }

  const item = detail.entry
  const isFavorite = favoriteIds.includes(item.id)

  return (
    <div>
      <PageHeader
        title={item.name}
        subtitle={item.scientificName}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--text-soft)]"
              onClick={() => toggleFavorite(item.id)}
            >
              <MaterialSymbol name={isFavorite ? 'favorite' : 'favorite_border'} filled={isFavorite} className="text-[16px]" />
              {isFavorite ? '已收藏' : '收藏'}
            </button>
            <Link to="/encyclopedia" className="text-xs text-[var(--accent-deep)] lg:text-sm">
              返回
            </Link>
          </div>
        }
      />

      <main className="space-y-4 px-4 py-4 lg:grid lg:grid-cols-5 lg:gap-4 lg:space-y-0 lg:px-6 lg:py-5">
        <section className="space-y-4 lg:col-span-3">
          <LazyImage src={item.image} alt={item.name} className="h-52 w-full rounded-2xl lg:h-[320px]" fallbackSrc="/images/community-post-fallback.svg" />

          {loading ? <LoadingState title="图鉴详情加载中" description="正在拉取证据化详情..." /> : null}
          {error ? <ErrorState title="详情同步失败" description={error} /> : null}

          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--text-main)] lg:text-base">形态特征</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{item.morphology}</p>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--text-main)] lg:text-base">症状与危害</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{item.symptoms}</p>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--text-main)] lg:text-base">来源索引</h2>
            <ul className="mt-2 space-y-2">
              {detail.sourceIndex.length === 0 ? (
                <li className="text-xs text-[var(--text-soft)]">暂无来源索引，建议补充资料来源。</li>
              ) : null}
              {detail.sourceIndex.map((source) => (
                <li key={source.id} className="rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
                  <p className="text-sm font-semibold text-[var(--text-main)]">{source.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">{source.snippet || '暂无摘要'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-soft)]">
                    <span className="rounded-full bg-white px-2 py-0.5">类型：{source.sourceType}</span>
                    <span className="rounded-full bg-white px-2 py-0.5">可信度：{source.confidenceLabel}</span>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2 py-0.5 text-[var(--accent-deep)]">
                        打开来源
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--text-main)] lg:text-base">治理模板</h2>
            <div className="mt-2 space-y-3 text-sm text-[var(--text-soft)]">
              <div>
                <p className="text-xs font-semibold text-[var(--text-main)]">立即处理</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {detail.treatmentTemplate.immediateActions.length === 0 ? <li>暂无模板</li> : null}
                  {detail.treatmentTemplate.immediateActions.map((itemText) => (
                    <li key={`immediate-${itemText}`}>{itemText}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--text-main)]">环境调整</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {detail.treatmentTemplate.environmentAdjustments.length === 0 ? <li>暂无模板</li> : null}
                  {detail.treatmentTemplate.environmentAdjustments.map((itemText) => (
                    <li key={`env-${itemText}`}>{itemText}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--text-main)]">复查节奏</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {detail.treatmentTemplate.followUpSchedule.length === 0 ? <li>暂无模板</li> : null}
                  {detail.treatmentTemplate.followUpSchedule.map((itemText) => (
                    <li key={`schedule-${itemText}`}>{itemText}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-[var(--text-main)]">注意事项</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {detail.treatmentTemplate.cautionNotes.length === 0 ? <li>暂无模板</li> : null}
                  {detail.treatmentTemplate.cautionNotes.map((itemText) => (
                    <li key={`note-${itemText}`}>{itemText}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--text-main)] lg:text-base">防治建议</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--text-soft)]">
              {item.controlTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        </section>

        <section className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm lg:h-fit">
            <dl className="grid grid-cols-2 gap-3 text-center lg:grid-cols-1 lg:text-left">
              <div className="rounded-xl bg-[var(--card-soft)] p-3">
                <dt className="text-[11px] text-[var(--text-soft)]">风险等级</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-main)]">{item.risk}</dd>
              </div>
              <div className="rounded-xl bg-[var(--card-soft)] p-3">
                <dt className="text-[11px] text-[var(--text-soft)]">高发季节</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-main)]">{item.season}</dd>
              </div>
              <div className="rounded-xl bg-[var(--card-soft)] p-3">
                <dt className="text-[11px] text-[var(--text-soft)]">寄主范围</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-main)]">{item.host}</dd>
              </div>
              <div className="rounded-xl bg-[var(--card-soft)] p-3">
                <dt className="text-[11px] text-[var(--text-soft)]">属名</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-main)]">{item.genus}</dd>
              </div>
              <div className="rounded-xl bg-[var(--card-soft)] p-3">
                <dt className="text-[11px] text-[var(--text-soft)]">专业分类</dt>
                <dd className="mt-1 text-sm font-bold text-[var(--text-main)]">{item.category}</dd>
              </div>
            </dl>

            <section className="mt-4 rounded-xl bg-[color:var(--accent)/0.22] p-3">
              <h3 className="text-xs font-semibold text-[var(--text-main)]">诊断摘要</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--text-soft)]">{item.summary}</p>
            </section>
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--text-main)]">相关推荐</h3>
            <div className="mt-2 space-y-2">
              {detail.relatedEntries.length === 0 ? (
                <p className="text-xs text-[var(--text-soft)]">暂无相关推荐</p>
              ) : null}
              {detail.relatedEntries.map((related) => (
                <Link
                  key={related.id}
                  to={`/encyclopedia/${related.id}`}
                  className="block rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--text-main)]">{related.name}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    风险：{related.risk} · 高发：{related.season}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}
