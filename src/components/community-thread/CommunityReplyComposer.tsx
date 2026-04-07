import type { ChangeEvent, FormEvent } from 'react'
import { ImageAnnotationEditor } from '../ImageAnnotationEditor'
import { MaterialSymbol } from '../MaterialSymbol'
import type { AnnotationPoint, CommunityFloorRole } from '../../types/models'

interface CommunityReplyComposerProps {
  text: string
  mode: CommunityFloorRole
  isPoster: boolean
  expanded: boolean
  replyToFloor?: number
  replyImage: string
  replyAnnotations: AnnotationPoint[]
  onTextChange: (value: string) => void
  onModeChange: (mode: CommunityFloorRole) => void
  onExpand: (value: boolean) => void
  onCancelReplyToFloor: () => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
  onReplyAnnotationsChange: (value: AnnotationPoint[]) => void
  onSubmit: (event: FormEvent) => void
}

const TEXT = {
  answer: '\u666e\u901a\u56de\u590d',
  followup: '\u697c\u4e3b\u8ffd\u95ee',
  currentReply: '\u5f53\u524d\u56de\u590d\uff1a',
  cancel: '\u53d6\u6d88',
  followupPlaceholder: '\u8865\u5145\u73b0\u573a\u53d8\u5316\u6216\u65b0\u89c2\u5bdf\u5230\u7684\u75c7\u72b6',
  answerPlaceholder: '\u8865\u5145\u4f60\u7684\u5224\u65ad\uff0c\u652f\u6301 @\u5bf9\u8c61 #\u6807\u7b7e',
  uploadLabel: '\u56de\u7b54\u9644\u56fe\uff08\u53ef\u9009\uff09',
  annotation: '\u6807\u6ce8',
  submit: '\u63d0\u4ea4\u697c\u5c42',
  pendingAlt: '\u5f85\u63d0\u4ea4\u697c\u5c42\u914d\u56fe',
} as const

export function CommunityReplyComposer({
  text,
  mode,
  isPoster,
  expanded,
  replyToFloor,
  replyImage,
  replyAnnotations,
  onTextChange,
  onModeChange,
  onExpand,
  onCancelReplyToFloor,
  onImageChange,
  onReplyAnnotationsChange,
  onSubmit,
}: CommunityReplyComposerProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white/95 p-3 shadow-[0_10px_26px_rgba(6,95,70,0.12)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onModeChange('answer')}
            className={`cursor-pointer rounded-full px-3 py-1 font-semibold ${mode === 'answer' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'}`}
          >
            {TEXT.answer}
          </button>
          {isPoster ? (
            <button
              type="button"
              onClick={() => onModeChange('followup')}
              className={`cursor-pointer rounded-full px-3 py-1 font-semibold ${mode === 'followup' ? 'bg-[var(--accent)] text-[var(--text-main)]' : 'bg-[var(--card-soft)] text-[var(--text-soft)]'}`}
            >
              {TEXT.followup}
            </button>
          ) : null}
        </div>
      </div>

      {replyToFloor ? (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--card-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">
          <span>
            {TEXT.currentReply}
            {replyToFloor}楼
          </span>
          <button type="button" className="cursor-pointer text-[var(--accent-deep)]" onClick={onCancelReplyToFloor}>
            {TEXT.cancel}
          </button>
        </div>
      ) : null}

      <form className="mt-2 space-y-2" onSubmit={onSubmit}>
        <textarea
          id="community-reply"
          data-testid="community-reply-input"
          value={text}
          onFocus={() => onExpand(true)}
          onChange={(event) => onTextChange(event.target.value)}
          rows={expanded ? 4 : 1}
          placeholder={mode === 'followup' ? TEXT.followupPlaceholder : TEXT.answerPlaceholder}
          className="w-full rounded-xl border border-[var(--line)] bg-white p-3 text-sm outline-none ring-[var(--accent)] transition-all focus:ring-2"
        />

        <div className="flex items-center gap-2">
          <label
            htmlFor="community-reply-image"
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full bg-[var(--card-soft)] px-3 text-xs text-[var(--text-soft)]"
          >
            <MaterialSymbol name="image" className="text-[14px]" />
            {TEXT.uploadLabel}
          </label>
          <button
            type="button"
            onClick={() => onTextChange(`${text}${text.endsWith(' ') || text.length === 0 ? '' : ' '}@`)}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-full bg-[var(--card-soft)] px-3 text-xs text-[var(--text-soft)]"
          >
            <MaterialSymbol name="alternate_email" className="text-[14px]" />@
          </button>
          <span className="inline-flex min-h-[34px] items-center gap-1 rounded-full bg-[var(--card-soft)] px-3 text-xs text-[var(--text-soft)]">
            <MaterialSymbol name="edit_location_alt" className="text-[14px]" />
            {TEXT.annotation}
          </span>
        </div>

        <input
          id="community-reply-image"
          data-testid="community-reply-image"
          aria-label={TEXT.uploadLabel}
          type="file"
          accept="image/*"
          onChange={onImageChange}
          className="sr-only"
        />

        {replyImage ? (
          <ImageAnnotationEditor
            image={replyImage}
            points={replyAnnotations}
            onChange={onReplyAnnotationsChange}
            className="mt-2"
            alt={TEXT.pendingAlt}
          />
        ) : null}

        <button
          type="submit"
          className="h-10 w-full cursor-pointer rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--text-main)]"
        >
          {TEXT.submit}
        </button>
      </form>
    </section>
  )
}
