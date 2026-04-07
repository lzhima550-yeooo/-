import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MobileFrame } from '../components/MobileFrame'
import { analytics } from '../services/analytics'
import { useAppStore } from '../store/useAppStore'
import { useUiStore } from '../store/useUiStore'
import { validators } from '../utils/formValidation'

export function RegisterPage() {
  const register = useAppStore((state) => state.register)
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)

  const [nickname, setNickname] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const passwordTip = useMemo(() => validators.password(password), [password])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()

    const checks = [
      validators.required(nickname, '昵称'),
      validators.account(account),
      validators.password(password),
      validators.confirmPassword(password, confirm),
    ]

    const firstFailed = checks.find((result) => !result.valid)
    if (firstFailed) {
      setError(firstFailed.message ?? '请检查输入内容')
      return
    }

    const result = register({
      nickname,
      account,
      password,
    })

    if (!result.ok) {
      const message = result.reason === 'exists' ? '账号已存在，请直接登录' : '请完整填写注册信息'
      setError(message)
      analytics.track('auth_register_failed', '/register', { reason: result.reason ?? 'unknown' })
      return
    }

    pushToast({ level: 'success', message: '注册成功，请登录' })
    navigate('/login', {
      replace: true,
      state: {
        notice: '注册成功，请使用新账号登录',
        prefillAccount: account.trim(),
      },
    })
  }

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[var(--panel)] px-5 pb-10 pt-8">
        <header className="text-center">
          <h1 className="text-3xl font-black text-[var(--text-main)]">注册账号</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">创建你的校园植保身份</p>
        </header>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="register-nickname" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              昵称
            </label>
            <input
              id="register-nickname"
              data-testid="register-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="请输入昵称"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="register-account" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              账号
            </label>
            <input
              id="register-account"
              data-testid="register-account"
              inputMode="email"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="手机号、邮箱或学号"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              密码
            </label>
            <input
              id="register-password"
              data-testid="register-password"
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
            <label htmlFor="register-confirm" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
              确认密码
            </label>
            <input
              id="register-confirm"
              data-testid="register-confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="再次输入密码"
              className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          ) : null}

          <button
            data-testid="register-submit"
            type="submit"
            className="h-12 w-full rounded-xl bg-[var(--accent)] text-base font-bold text-[var(--text-main)]"
          >
            完成注册
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--text-soft)]">
          已有账号？
          <Link to="/login" className="ml-1 font-semibold text-[var(--accent-deep)] hover:underline">
            返回登录
          </Link>
        </div>
      </div>
    </MobileFrame>
  )
}
