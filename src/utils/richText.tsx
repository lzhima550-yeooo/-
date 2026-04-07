import { Fragment } from 'react'
import type { ReactNode } from 'react'

const tokenizeLine = (line: string): ReactNode[] => {
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|@[\w\u4e00-\u9fa5_-]+|#[\w\u4e00-\u9fa5_-]+)/g
  const parts = line.split(regex)

  return parts.map((part, index) => {
    if (!part) {
      return null
    }

    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`b-${index}`} className="font-semibold text-[var(--text-main)]">
          {part.slice(2, -2)}
        </strong>
      )
    }

    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={`c-${index}`} className="rounded bg-[var(--card-soft)] px-1 py-0.5 text-[11px]">
          {part.slice(1, -1)}
        </code>
      )
    }

    if (/^@/.test(part)) {
      return (
        <span key={`m-${index}`} className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">
          {part}
        </span>
      )
    }

    if (/^#/.test(part)) {
      return (
        <span key={`t-${index}`} className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
          {part}
        </span>
      )
    }

    return <Fragment key={`t-${index}`}>{part}</Fragment>
  })
}

export const renderRichText = (text: string) => {
  const lines = text.split(/\r?\n/)

  return lines.map((line, lineIndex) => (
    <p key={`line-${lineIndex}`} className="leading-6">
      {tokenizeLine(line)}
    </p>
  ))
}
