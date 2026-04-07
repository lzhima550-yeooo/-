import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MaterialSymbol } from '../components/MaterialSymbol'
import { MobileFrame } from '../components/MobileFrame'
import { analytics } from '../services/analytics'
import { useAppStore } from '../store/useAppStore'
import { useUiStore } from '../store/useUiStore'
import { validators } from '../utils/formValidation'

const loginHeroImage = '/images/campus-dashboard.svg'

const loginHeroFallback = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dfe8d5"/>
      <stop offset="100%" stop-color="#bed3bc"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="520" fill="url(#bg)"/>
  <circle cx="190" cy="120" r="72" fill="#c8d9b1" opacity="0.7"/>
  <circle cx="920" cy="86" r="60" fill="#b7cfa7" opacity="0.6"/>
  <text x="52" y="460" fill="#39564a" font-size="44" font-family="'Noto Sans SC', sans-serif">校园四季 · 欢迎登录</text>
</svg>
`)}`

interface LoginLocationState {
  notice?: string
  prefillAccount?: string
}

export function LoginPage() {
  const login = useAppStore((state) => state.login)
  const navigate = useNavigate()
  const location = useLocation()
  const pushToast = useUiStore((state) => state.pushToast)

  const state = useMemo(() => (location.state ?? {}) as LoginLocationState, [location.state])

  const [account, setAccount] = useState(state.prefillAccount ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const accountValidation = useMemo(() => validators.account(account), [account])

  useEffect(() => {
    if (state.prefillAccount) {
      setAccount(state.prefillAccount)
    }
  }, [state.prefillAccount])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!accountValidation.valid) {
      setError(accountValidation.message ?? '请输入账号')
      return
    }

    const passwordValidation = validators.required(password, '密码')
    if (!passwordValidation.valid) {
      setError(passwordValidation.message ?? '请输入密码')
      return
    }

    const result = login(account, password)

    if (!result.ok) {
      const message = result.reason === 'empty' ? '账号和密码不能为空' : '账号或密码错误'
      setError(message)
      analytics.track('auth_login_failed', '/login', { reason: result.reason ?? 'unknown' })
      return
    }

    setError('')
    pushToast({ level: 'success', message: '登录成功' })
    navigate('/home', { replace: true })
  }

  return (
    <MobileFrame>
      <div className="min-h-screen bg-[var(--panel)]">
        <header className="safe-top px-4 pb-2 text-center text-xl font-black text-[var(--text-main)]">四季夏木</header>

        <div className="h-[250px] overflow-hidden">
          <img
            src={loginHeroImage}
            alt="校园森林"
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = loginHeroFallback
            }}
          />
        </div>

        <main className="px-5 pb-10 pt-6">
          <h1 className="text-center text-5xl font-black text-[var(--text-main)]">欢迎回来</h1>
          <p className="mt-2 text-center text-sm text-[var(--text-soft)]">守护每一寸校园绿意</p>

          {state.notice ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700">
              {state.notice}
            </p>
          ) : null}

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="account" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
                手机号/邮箱
              </label>
              <input
                id="account"
                data-testid="login-account"
                name="account"
                type="text"
                inputMode="email"
                value={account}
                aria-invalid={!accountValidation.valid && Boolean(account)}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="请输入您的手机号或邮箱"
                className="h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-sm outline-none ring-[var(--accent)] transition focus:ring-2"
              />
              {!accountValidation.valid && account ? <p className="mt-1 text-xs text-amber-700">{accountValidation.message}</p> : null}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[var(--text-main)]">
                密码
              </label>
              <div className="flex h-12 items-center rounded-xl border border-[var(--line)] bg-white pr-3 ring-[var(--accent)] focus-within:ring-2">
                <input
                  id="password"
                  data-testid="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入您的密码"
                  className="h-full flex-1 rounded-xl bg-transparent px-4 text-sm outline-none"
                />
                <button
                  type="button"
                  className="text-[var(--text-soft)]"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  <MaterialSymbol name={showPassword ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-xs">
              <Link to="/forgot-password" className="text-[var(--text-soft)] hover:text-[var(--accent-deep)]">
                忘记密码？
              </Link>
              <span className="text-[var(--text-soft)]">
                还没有账号？
                <Link to="/register" className="ml-1 font-semibold text-[var(--accent-deep)] hover:underline">
                  立即注册
                </Link>
              </span>
            </div>

            {error ? (
              <p data-testid="login-error" role="alert" className="text-sm text-red-500">
                {error}
              </p>
            ) : null}

            <button
              data-testid="login-submit"
              type="submit"
              className="mt-2 h-12 w-full rounded-xl bg-[var(--accent)] text-base font-bold text-[var(--text-main)] shadow-[0_8px_18px_rgba(204,203,147,0.35)]"
            >
              登录
            </button>
          </form>

          <button
            type="button"
            className="mt-3 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--card-soft)] text-sm font-semibold text-[var(--accent-deep)]"
          >
            校园师生认证登录
          </button>

          <div className="mt-9 flex items-center gap-4 text-xs text-[var(--text-soft)]">
            <span className="h-px flex-1 bg-[var(--line)]" />
            <span>第三方登录</span>
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <div className="mt-4 flex justify-center gap-5">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[#07C160]"
            >
              <MaterialSymbol name="chat" className="text-[20px]" />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[#12B7F5]"
            >
              <MaterialSymbol name="token" className="text-[20px]" />
            </button>
          </div>

          <p className="mt-8 text-center text-[11px] leading-5 text-[var(--text-soft)]">
            示例账号：student01 / 123456，teacher01 / teacher123
            <br />
            登录即代表您同意用户协议和隐私政策
          </p>

          <div className="mt-4 text-center">
            <Link to="/welcome" className="text-xs text-[var(--text-soft)] hover:text-[var(--accent-deep)]">
              返回欢迎页
            </Link>
          </div>
        </main>
      </div>
    </MobileFrame>
  )
}
