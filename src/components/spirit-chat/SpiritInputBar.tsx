import type { FormEvent } from 'react'

interface SpiritInputBarProps {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

export function SpiritInputBar({ value, disabled = false, onChange, onSubmit }: SpiritInputBarProps) {
  return (
    <form className="relative z-[1] border-t border-emerald-100/90 bg-white/84 px-3 pb-3 pt-2 backdrop-blur-md" onSubmit={onSubmit}>
      <label htmlFor="spirit-chat" className="mb-1 block text-[11px] text-emerald-700/90">
        和夏木继续对话
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="spirit-chat"
          data-testid="spirit-chat-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={1}
          placeholder="输入你的观察或问题..."
          className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-emerald-200/90 bg-[linear-gradient(145deg,#ffffff,#f4fcf7)] px-3 py-2 text-sm text-emerald-950 outline-none ring-emerald-300/70 transition focus:ring-2 disabled:opacity-70"
        />
        <button
          data-testid="spirit-chat-send"
          type="submit"
          disabled={disabled}
          className="h-[42px] rounded-2xl bg-[linear-gradient(145deg,#6fd39f,#55c48c)] px-4 text-sm font-semibold text-emerald-950 shadow-[0_10px_18px_rgba(16,185,129,0.24)] transition duration-200 hover:brightness-105 disabled:opacity-65"
        >
          {disabled ? '发送中...' : '发送'}
        </button>
      </div>
    </form>
  )
}
