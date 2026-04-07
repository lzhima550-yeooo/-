interface MaterialSymbolProps {
  name: string
  className?: string
  filled?: boolean
}

export function MaterialSymbol({ name, className = '', filled = false }: MaterialSymbolProps) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined ${filled ? 'material-symbol-filled' : ''} ${className}`.trim()}
    >
      {name}
    </span>
  )
}
