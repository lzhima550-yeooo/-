import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { analytics } from '../services/analytics'
import type { AnalyticsEvent } from '../services/analytics'
import {
  fetchAnalyticsEventSummaryFromServer,
  fetchAnalyticsTaskLogsFromServer,
  type AnalyticsEventSummaryData,
  type AnalyticsTaskLogItem,
  type AnalyticsTaskLogPageMeta,
} from '../services/analyticsApi'

const taskTypeByEventName: Record<string, string> = {
  identify_submit: 'diagnosis_identify',
  spirit_generate_submit: 'spirit_generation',
}

const defaultTaskLogPage = (): AnalyticsTaskLogPageMeta => ({
  limit: 20,
  offset: 0,
  hasMore: false,
  nextOffset: null,
})

export function AnalyticsPage() {
  const [events, setEvents] = useState<AnalyticsEvent[]>(() => analytics.list())
  const [eventSummary, setEventSummary] = useState<AnalyticsEventSummaryData | null>(null)
  const [taskLogs, setTaskLogs] = useState<AnalyticsTaskLogItem[]>([])
  const [taskLogPage, setTaskLogPage] = useState<AnalyticsTaskLogPageMeta>(() => defaultTaskLogPage())

  const [summaryDays, setSummaryDays] = useState(7)
  const [summarySource, setSummarySource] = useState('')
  const [summaryEventName, setSummaryEventName] = useState('')

  const [taskTypeFilter, setTaskTypeFilter] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('')
  const [taskIdFilter, setTaskIdFilter] = useState('')
  const [taskOffset, setTaskOffset] = useState(0)

  const [eventSummaryHint, setEventSummaryHint] = useState('')
  const [taskLogHint, setTaskLogHint] = useState('')

  const grouped = useMemo(() => {
    const counts = new Map<string, number>()
    events.forEach((event) => {
      counts.set(event.name, (counts.get(event.name) ?? 0) + 1)
    })
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [events])

  useEffect(() => {
    let active = true

    void (async () => {
      const result = await fetchAnalyticsEventSummaryFromServer({
        days: summaryDays,
        limit: 200,
        source: summarySource || undefined,
        eventName: summaryEventName || undefined,
      })

      if (!active) {
        return
      }

      if (result.ok) {
        setEventSummary(result.data)
        setEventSummaryHint('')
      } else {
        setEventSummary(null)
        setEventSummaryHint(result.message ?? '服务端事件摘要不可用。')
      }
    })()

    return () => {
      active = false
    }
  }, [summaryDays, summarySource, summaryEventName])

  useEffect(() => {
    let active = true

    void (async () => {
      const result = await fetchAnalyticsTaskLogsFromServer({
        limit: 20,
        offset: taskOffset,
        taskType: taskTypeFilter || undefined,
        status: taskStatusFilter || undefined,
        taskId: taskIdFilter || undefined,
      })

      if (!active) {
        return
      }

      if (result.ok) {
        setTaskLogPage(result.data.page)
        setTaskLogs((previous) => (taskOffset <= 0 ? result.data.items : [...previous, ...result.data.items]))
        setTaskLogHint('')
      } else {
        setTaskLogPage(defaultTaskLogPage())
        if (taskOffset <= 0) {
          setTaskLogs([])
        }
        setTaskLogHint(result.message ?? '服务端任务日志不可用。')
      }
    })()

    return () => {
      active = false
    }
  }, [taskTypeFilter, taskStatusFilter, taskIdFilter, taskOffset])

  useEffect(() => {
    const refresh = () => setEvents(analytics.list())

    window.addEventListener('app:analytics', refresh)
    window.addEventListener('app:analytics:cleared', refresh)

    return () => {
      window.removeEventListener('app:analytics', refresh)
      window.removeEventListener('app:analytics:cleared', refresh)
    }
  }, [])

  const applyTaskFilter = (next: { taskType?: string; status?: string; taskId?: string }) => {
    if (typeof next.taskType === 'string') {
      setTaskTypeFilter(next.taskType)
    }
    if (typeof next.status === 'string') {
      setTaskStatusFilter(next.status)
    }
    if (typeof next.taskId === 'string') {
      setTaskIdFilter(next.taskId)
    }
    setTaskOffset(0)
  }

  const handleSummaryDrilldown = (eventName: string) => {
    const nextEventName = eventName.trim()
    setSummaryEventName(nextEventName)
    const mappedTaskType = taskTypeByEventName[nextEventName] ?? ''
    applyTaskFilter({
      taskType: mappedTaskType,
      status: '',
    })
  }

  return (
    <div>
      <PageHeader
        title="行为分析"
        subtitle="服务端观测 + 本地埋点（开发）"
        action={
          <button
            type="button"
            onClick={() => {
              analytics.clear()
              setEvents([])
            }}
            className="rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--accent-deep)]"
          >
            清空本地埋点
          </button>
        }
      />

      <main className="space-y-3 px-4 py-4 lg:px-6 lg:py-5">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[var(--text-main)]">服务端事件摘要</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--text-soft)] md:grid-cols-3">
            <label className="flex items-center gap-2">
              时间范围
              <select
                value={summaryDays}
                onChange={(event) => setSummaryDays(Number(event.target.value) || 7)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-xs"
              >
                <option value={7}>7天</option>
                <option value={30}>30天</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              来源
              <select
                value={summarySource}
                onChange={(event) => setSummarySource(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-xs"
              >
                <option value="">全部</option>
                <option value="api">api</option>
                <option value="client">client</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              事件名
              <input
                value={summaryEventName}
                onChange={(event) => setSummaryEventName(event.target.value)}
                placeholder="可输入事件名筛选"
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-xs"
              />
            </label>
          </div>
          {eventSummary ? (
            <p className="mt-2 text-xs text-[var(--text-soft)]">
              近{eventSummary.days}天事件总量：{eventSummary.total}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-[var(--text-soft)]">点击事件名可联动筛选任务日志。</p>
          {eventSummaryHint ? <p className="mt-2 text-xs text-[var(--text-soft)]">{eventSummaryHint}</p> : null}
          <ul data-testid="analytics-server-summary" className="mt-2 space-y-1 text-xs text-[var(--text-soft)]">
            {!eventSummary || eventSummary.byName.length === 0 ? (
              <li>暂无服务端摘要</li>
            ) : (
              eventSummary.byName.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => handleSummaryDrilldown(item.name)}
                    className="rounded-lg border border-[var(--line)] px-2 py-1 text-left hover:bg-[var(--card-soft)]"
                  >
                    {item.name}：{item.count}
                  </button>
                </li>
              ))
            )}
          </ul>
          {!eventSummary || eventSummary.bySource.length === 0 ? null : (
            <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-soft)]">
              {eventSummary.bySource.map((item) => (
                <li key={item.source} className="rounded-lg border border-[var(--line)] px-2 py-1">
                  来源 {item.source}：{item.count}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[var(--text-main)]">服务端任务日志（最近）</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--text-soft)] md:grid-cols-3">
            <label className="flex items-center gap-2">
              任务类型
              <select
                value={taskTypeFilter}
                onChange={(event) => applyTaskFilter({ taskType: event.target.value })}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-xs"
              >
                <option value="">全部</option>
                <option value="diagnosis_identify">diagnosis_identify</option>
                <option value="spirit_generation">spirit_generation</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              状态
              <select
                value={taskStatusFilter}
                onChange={(event) => applyTaskFilter({ status: event.target.value })}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-xs"
              >
                <option value="">全部</option>
                <option value="queued">queued</option>
                <option value="running">running</option>
                <option value="succeeded">succeeded</option>
                <option value="failed">failed</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              任务ID
              <input
                value={taskIdFilter}
                onChange={(event) => applyTaskFilter({ taskId: event.target.value })}
                placeholder="可输入 taskId"
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white px-2 text-xs"
              />
            </label>
          </div>
          {taskLogHint ? <p className="mt-2 text-xs text-[var(--text-soft)]">{taskLogHint}</p> : null}
          <ul data-testid="analytics-task-logs" className="mt-2 space-y-2">
            {taskLogs.length === 0 ? (
              <li className="text-xs text-[var(--text-soft)]">暂无任务日志</li>
            ) : (
              taskLogs.map((item) => (
                <li key={`${item.id}-${item.taskId}`} className="rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
                  <p className="text-sm font-semibold text-[var(--text-main)]">
                    {item.taskType || 'unknown'} · {item.status || 'unknown'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    任务ID：{item.taskId || '--'} · 尝试：{item.attempt}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    耗时：{item.durationMs}ms
                    {item.error ? ` · 错误：${item.error}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-soft)]">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '--'}
                  </p>
                </li>
              ))
            )}
          </ul>
          {taskLogPage.hasMore ? (
            <button
              type="button"
              onClick={() => setTaskOffset(taskLogPage.nextOffset ?? taskLogPage.offset + taskLogPage.limit)}
              className="mt-2 rounded-lg border border-[var(--line)] bg-white px-3 py-1 text-xs text-[var(--accent-deep)]"
            >
              加载更多日志
            </button>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[var(--text-main)]">本地事件总览</h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--text-soft)]">
            {grouped.length === 0 ? <li>暂无数据</li> : grouped.map(([name, count]) => <li key={name}>{name}：{count}</li>)}
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[var(--text-main)]">本地事件明细</h3>
          <ul className="mt-2 space-y-2">
            {events.length === 0 ? (
              <li className="text-xs text-[var(--text-soft)]">暂无事件记录。</li>
            ) : (
              events.slice(0, 80).map((event) => (
                <li key={event.id} className="rounded-xl border border-[var(--line)] bg-[var(--card-soft)] p-3">
                  <p className="text-sm font-semibold text-[var(--text-main)]">{event.name}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">页面：{event.page}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-soft)]">{new Date(event.createdAt).toLocaleString()}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  )
}
