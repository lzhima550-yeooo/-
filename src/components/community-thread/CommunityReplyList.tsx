import type { CommunityAnswer } from '../../types/models'
import { CommunityReplyItem } from './CommunityReplyItem'

interface CommunityReplyListProps {
  answers: CommunityAnswer[]
  onReplyFloor: (floor: number, author: string) => void
}

const EMPTY_TEXT = '\u8fd8\u6ca1\u6709\u56de\u590d\uff0c\u6b22\u8fce\u8865\u5145\u56fe\u6587\u5224\u65ad\u3002'

export function CommunityReplyList({ answers, onReplyFloor }: CommunityReplyListProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm">
      {answers.length > 0 ? (
        <ul className="space-y-3">
          {answers.map((answer, index) => {
            const floor = answer.floor ?? index + 2
            return <CommunityReplyItem key={answer.id} answer={answer} floor={floor} onReplyFloor={onReplyFloor} />
          })}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-[var(--text-soft)]">{EMPTY_TEXT}</p>
      )}
    </section>
  )
}
