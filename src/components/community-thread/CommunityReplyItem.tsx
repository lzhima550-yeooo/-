import { ImageAnnotationEditor } from '../ImageAnnotationEditor'
import { MaterialSymbol } from '../MaterialSymbol'
import type { CommunityAnswer } from '../../types/models'
import { renderRichText } from '../../utils/richText'
import { useImageFallback } from '../../utils/imageFallback'

interface CommunityReplyItemProps {
  answer: CommunityAnswer
  floor: number
  onReplyFloor: (floor: number, author: string) => void
}

const TEXT = {
  followup: '\u697c\u4e3b\u8ffd\u95ee',
  answer: '\u56fe\u6587\u89e3\u7b54',
  mineRegion: '\u6211\u6240\u5728\u6821\u533a',
  region: '\u5e7f\u897f\u5357\u5b81',
  replyTo: '\u56de\u590d',
  replyThis: '\u56de\u590d\u8fd9\u5c42',
  imageAlt: '\u697c\u5c42\u914d\u56fe',
} as const

export function CommunityReplyItem({ answer, floor, onReplyFloor }: CommunityReplyItemProps) {
  const roleLabel = answer.role === 'followup' ? TEXT.followup : TEXT.answer
  const region = answer.fromMe ? TEXT.mineRegion : TEXT.region

  return (
    <li className="border-b border-[var(--line)] pb-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 shrink-0 rounded-full border border-emerald-100 bg-[linear-gradient(145deg,#f7fcf8,#e8f4ea)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-soft)]">
            <span className="font-semibold text-[var(--text-main)]">{answer.author}</span>
            <span>\u00b7</span>
            <span>{answer.createdAt}</span>
            <span>\u00b7</span>
            <span>{region}</span>
            <span className="rounded-full bg-[var(--card-soft)] px-2 py-0.5">{floor}楼</span>
            <span className={`rounded-full px-2 py-0.5 ${answer.role === 'followup' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {roleLabel}
            </span>
            {answer.replyToFloor ? (
              <span className="rounded-full bg-[var(--card-soft)] px-2 py-0.5">
                {TEXT.replyTo} {answer.replyToFloor}楼
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 text-sm leading-6 text-[var(--text-main)]">{renderRichText(answer.markdown ?? answer.content)}</div>
          {answer.image ? (
            answer.annotations && answer.annotations.length > 0 ? (
              <ImageAnnotationEditor
                image={answer.image}
                points={answer.annotations}
                onChange={() => undefined}
                editable={false}
                className="mt-2"
                alt={TEXT.imageAlt}
              />
            ) : (
              <img
                src={answer.image}
                alt={TEXT.imageAlt}
                className="mt-2 h-40 w-full rounded-xl object-cover"
                onError={(event) => useImageFallback(event)}
              />
            )
          ) : null}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onReplyFloor(floor, answer.author)}
              className="inline-flex min-h-[30px] cursor-pointer items-center gap-1 rounded-full bg-[var(--card-soft)] px-2.5 text-xs text-[var(--accent-deep)]"
            >
              <MaterialSymbol name="reply" className="text-[14px]" />
              {TEXT.replyThis}
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
