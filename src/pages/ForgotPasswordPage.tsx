import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MobileFrame } from '../components/MobileFrame'
import { analytics } from '../services/analytics'
import { useAppStore } from '../store/useAppStore'
import { useUiStore } from '../store/useUiStore'
import { validators } from '../utils/formValidation'

export function ForgotPasswordPage() {
  const resetPassword = useAppStore((state) => state.resetPassword)
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const passwordTip = useMemo(() => validators.password(password), [password])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()

    const checks = [
      validators.account(account),
      validators.password(password),
      validators.confirmPassword(password, confirm),
    ]

    const firstFailed = checks.find((result) => !result.valid)
    if (firstFailed) {
      setError(firstFailed.message ?? '请检查输入内容')
      return
    }

    const result = resetPassword(account, password)

    if (!result.ok) {
      if (result.reason === 'not_found') {
        setError('账号不存在，请先注册')
        return
      }

      if (result.reason === 'same_as_old') {
        setError('新密码不能与旧密码相同')
        return
      }

      setError('请完整填写重置信息')
      analytics.track('auth_reset_failed', '/forgot-password', { reason: result.reason ?? 'unknown' })
      return
    }

    pushToast({ level: 'success', message: '密码已重置' })
    navigate('/login', {
      replace: true,
      state: {
        notice: '密码已重置，请返回登录',
        prefillAccount: account.trim(),
      },
    })
  }

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[var(--panel)] px-5 pb-10 pt-8">
        <header className="text-center">
          <h1 className="text-3xl font-black text-[var(--text-main)]">忘记密码</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">重设账号密码后重新登录</p>
        </header>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="forgot-account" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              账号
            </label>
            <input
              id="forgot-account"
              data-testid="forgot-account"
              inputMode="email"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="手机号、邮箱或学号"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="forgot-password" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              新密码
            </label>
            <input
              id="forgot-password"
              data-testid="forgot-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位，含字母与数字"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
            <p className={`mt-1 text-xs ${passwordTip.valid ? 'text-emerald-700' : 'text-amber-700'}`}>
              {passwordTip.message ?? '密码格式合规'}
            </p>
          </div>

          <div>
            <label htmlFor="forgot-confirm" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              确认新密码
            </label>
            <input
              id="forgot-confirm"
              data-testid="forgot-confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="再次输入新密码"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <button
            data-testid="forgot-submit"
            type="submit"
            className="h-12 w-full rounded-xl bg-[var(--accent)] text-base font-bold text-[var(--text-main)]"
          >
            重置密码
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--text-soft)]">
          <Link to="/login" className="font-semibold text-[var(--accent-deep)] hover:underline">
            返回登录
          </Link>
        </div>
      </div>
    </MobileFrame>
  )
}
