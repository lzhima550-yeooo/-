import { MaterialSymbol } from '../MaterialSymbol'

interface SpiritQuickAction {
  key: string
  label: string
}

interface SpiritQuickActionsProps {
  actions: SpiritQuickAction[]
  disabled?: boolean
  onQuickAsk: (actionKey: string, label: string) => void
}

export function SpiritQuickActions({ actions, disabled = false, onQuickAsk }: SpiritQuickActionsProps) {
  return (
    <div className="relative z-[1] flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={() => onQuickAsk(action.key, action.label)}
          disabled={disabled}
          className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/90 bg-[linear-gradient(145deg,#f2fbf4,#e6f5ea)] px-3 text-xs font-medium text-emerald-800 shadow-[0_4px_12px_rgba(6,95,70,0.08)] transition duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_18px_rgba(16,185,129,0.16)] disabled:opacity-60"
        >
          <MaterialSymbol name="local_florist" className="text-[14px] text-emerald-600" />
          {action.label}
        </button>
      ))}
    </div>
  )
}
