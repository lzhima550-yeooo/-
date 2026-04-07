import { Link } from 'react-router-dom'
import { MaterialSymbol } from '../MaterialSymbol'
import type { CommunityPost } from '../../types/models'
import { renderRichText } from '../../utils/richText'
import { useImageFallback } from '../../utils/imageFallback'

interface CommunityPostHeroCardProps {
  post: CommunityPost
  isPoster: boolean
  onMarkSolved: () => void
  onToggleFavorite: () => void
  isFavorite: boolean
}

const TEXT = {
  floorOne: '\u0031\u697c',
  poster: '\u697c\u4e3b\u4e3b\u5e16',
  solved: '\u5df2\u89e3\u51b3',
  pending: '\u5f85\u786e\u8ba4',
  area: '\u6821\u56ed\u56ed\u827a\u533a',
  favorite: '\u6536\u85cf',
  favored: '\u5df2\u6536\u85cf',
  follow: '\u5173\u6ce8',
  encyclopedia: '\u53bb\u56fe\u9274',
  markSolved: '\u6807\u8bb0\u5df2\u89e3\u51b3',
} as const

export function CommunityPostHeroCard({ post, isPoster, onMarkSolved, onToggleFavorite, isFavorite }: CommunityPostHeroCardProps) {
  return (
    <article className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[linear-gradient(150deg,#ffffff,#f6fbf7)] p-4 shadow-[0_8px_24px_rgba(16,185,129,0.08)]">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[var(--card-soft)] px-2.5 py-1 font-semibold text-[var(--text-main)]">{TEXT.floorOne}</span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">{TEXT.poster}</span>
        <span
          className={`rounded-full px-2.5 py-1 font-semibold ${
            post.status === 'solved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {post.status === 'solved' ? TEXT.solved : TEXT.pending}
        </span>
      </div>

      <h2 className="mt-3 text-lg font-bold leading-7 text-[var(--text-main)]">{post.title}</h2>

      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-soft)]">
        <span className="font-semibold">{post.author}</span>
        <span>\u00b7</span>
        <span>{post.createdAt}</span>
        <span>\u00b7</span>
        <span>{TEXT.area}</span>
      </div>

      <div className="mt-3 space-y-1 text-sm leading-7 text-[var(--text-soft)]">{renderRichText(post.markdown ?? post.content)}</div>

      {post.image ? (
        <img
          src={post.image}
          alt={post.title}
          className="mt-3 h-52 w-full rounded-2xl object-cover"
          onError={(event) => useImageFallback(event)}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-xs">
        <button
          type="button"
          onClick={onToggleFavorite}
          className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full bg-[var(--card-soft)] px-3 text-[var(--text-soft)]"
        >
          <MaterialSymbol
            name={isFavorite ? 'favorite' : 'favorite_border'}
            filled={isFavorite}
            className={`text-[16px] ${isFavorite ? 'text-emerald-600' : 'text-[var(--text-soft)]'}`}
          />
          {isFavorite ? TEXT.favored : TEXT.favorite}
        </button>
        <button
          type="button"
          className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full bg-[var(--card-soft)] px-3 text-[var(--text-soft)]"
        >
          <MaterialSymbol name="person_add" className="text-[16px]" />
          {TEXT.follow}
        </button>
        <Link
          to="/encyclopedia"
          className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full bg-[var(--card-soft)] px-3 text-[var(--accent-deep)]"
        >
          <MaterialSymbol name="menu_book" className="text-[16px]" />
          {TEXT.encyclopedia}
        </Link>
        {isPoster && post.status !== 'solved' ? (
          <button
            type="button"
            onClick={onMarkSolved}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full bg-emerald-100 px-3 font-semibold text-emerald-700"
          >
            <MaterialSymbol name="check_circle" className="text-[16px]" />
            {TEXT.markSolved}
          </button>
        ) : null}
      </div>
    </article>
  )
}
