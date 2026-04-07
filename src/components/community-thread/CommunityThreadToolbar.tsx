type ReplyFilter = 'all' | 'poster_only'
type ReplySort = 'asc' | 'desc'

interface CommunityThreadToolbarProps {
  floorCount: number
  replyFilter: ReplyFilter
  onReplyFilterChange: (value: ReplyFilter) => void
  replySort: ReplySort
  onReplySortChange: (value: ReplySort) => void
}

const TEXT = {
  titlePrefix: '\u697c\u5c42\u8ba8\u8bba',
  all: '\u5168\u90e8\u56de\u590d',
  posterOnly: '\u53ea\u770b\u697c\u4e3b',
  asc: '\u6b63\u5e8f',
  desc: '\u5012\u5e8f',
} as const

export function CommunityThreadToolbar({
  floorCount,
  replyFilter,
  onReplyFilterChange,
  replySort,
  onReplySortChange,
}: CommunityThreadToolbarProps) {
  return (
    <section className="sticky top-0 z-20 rounded-2xl border border-[var(--line)] bg-white/90 p-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text-main)]">
          {TEXT.titlePrefix}（{floorCount}）
        </p>
        <div className="flex items-center gap-1 text-[11px] text-[var(--text-soft)]">
          <button
            type="button"
            onClick={() => onReplyFilterChange('all')}
            className={`rounded-full px-2.5 py-1 ${replyFilter === 'all' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)]'}`}
          >
            {TEXT.all}
          </button>
          <button
            type="button"
            onClick={() => onReplyFilterChange('poster_only')}
            className={`rounded-full px-2.5 py-1 ${replyFilter === 'poster_only' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)]'}`}
          >
            {TEXT.posterOnly}
          </button>
          <button
            type="button"
            onClick={() => onReplySortChange(replySort === 'asc' ? 'desc' : 'asc')}
            className="rounded-full bg-[var(--card-soft)] px-2.5 py-1"
          >
            {replySort === 'asc' ? TEXT.asc : TEXT.desc}
          </button>
        </div>
      </div>
    </section>
  )
}

export type { ReplyFilter, ReplySort }
