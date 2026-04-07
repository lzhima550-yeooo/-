import { useMemo } from 'react'
import type { MouseEvent } from 'react'

export interface AnnotationPoint {
  x: number
  y: number
}

interface ImageAnnotationEditorProps {
  image: string
  points: AnnotationPoint[]
  onChange: (nextPoints: AnnotationPoint[]) => void
  alt?: string
  editable?: boolean
  className?: string
}

export function ImageAnnotationEditor({
  image,
  points,
  onChange,
  alt = '标注图片',
  editable = true,
  className,
}: ImageAnnotationEditorProps) {
  const pointHints = useMemo(() => points.map((point, index) => `${index + 1}: ${point.x.toFixed(1)}%, ${point.y.toFixed(1)}%`), [points])

  const onMark = (event: MouseEvent<HTMLButtonElement>) => {
    if (!editable) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    onChange([...points, { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }].slice(-12))
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`.trim()}>
      <button
        type="button"
        onClick={onMark}
        className="relative block w-full overflow-hidden rounded-xl border border-[var(--line)]"
        aria-label={editable ? '点击图片添加标注' : '病斑标注预览'}
      >
        <img src={image} alt={alt} className="h-full w-full object-cover" />
        {points.map((point, index) => (
          <span
            key={`${point.x}-${point.y}-${index}`}
            className="absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-red-300 bg-red-500/80 text-[10px] font-semibold text-white"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`标注点${index + 1}`}
          >
            {index + 1}
          </span>
        ))}
      </button>

      {editable ? (
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-soft)]">
          <span>已标注 {points.length} 处病斑/虫体</span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded border border-[var(--line)] bg-white px-2 py-1 text-[var(--accent-deep)]"
          >
            清空标注
          </button>
        </div>
      ) : null}

      {pointHints.length > 0 ? (
        <p className="text-[11px] text-[var(--text-soft)]">标注坐标：{pointHints.join(' / ')}</p>
      ) : null}
    </div>
  )
}
