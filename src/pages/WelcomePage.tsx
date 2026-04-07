import { Link } from 'react-router-dom'
import { MobileFrame } from '../components/MobileFrame'
import { useAppStore } from '../store/useAppStore'

const welcomeBackgroundImage = '/images/welcome-campus.svg'
const programLogoImage = '/images/711d717f9bc3af89d56a4b69ad7579d4.png'

const welcomeBackgroundFallback = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c8d8be"/>
      <stop offset="100%" stop-color="#a8c3a6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <circle cx="170" cy="180" r="120" fill="#dbe8cf" opacity="0.7"/>
  <circle cx="980" cy="110" r="100" fill="#d3e2c7" opacity="0.68"/>
  <text x="70" y="820" fill="#35544a" font-size="52" font-family="'Noto Sans SC', sans-serif">四季夏木 · 探索校园四季</text>
</svg>
`)}`

export function WelcomePage() {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn)

  return (
    <MobileFrame>
      <div className="relative min-h-screen overflow-hidden">
        <img
          src={welcomeBackgroundImage}
          alt="校园背景"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          onError={(event) => {
            event.currentTarget.src = welcomeBackgroundFallback
          }}
        />
        <div className="absolute inset-0 bg-[color:var(--panel)/0.7]" />

        <main className="relative flex min-h-screen flex-col items-center px-6 pb-10 pt-14 text-center">
          <div className="w-full overflow-hidden rounded-3xl border border-white/45 bg-white/45 p-5 shadow-[0_14px_38px_rgba(18,25,38,0.2)] backdrop-blur-sm">
            <div className="rounded-2xl bg-[radial-gradient(circle_at_22%_18%,#e7f0dc,transparent_42%),radial-gradient(circle_at_88%_24%,#dcebd2,transparent_45%),linear-gradient(135deg,#f2f7ed,#d8e6d0)] p-6">
              <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/70 bg-white/75 shadow-[0_8px_20px_rgba(25,35,35,0.12)]">
                <img
                  src={programLogoImage}
                  alt="四季夏木程序Logo"
                  className="h-40 w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = '/images/campus-dashboard.svg'
                  }}
                />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">灵化角色与校园病虫一体探索</p>
              <p className="text-xs text-[var(--text-soft)]">欢迎进入四季夏木</p>
            </div>
          </div>

          <h1 className="mt-10 text-5xl font-black tracking-tight text-[var(--text-main)]">四季夏木</h1>
          <p className="mt-3 text-base font-medium text-[var(--text-soft)]">探索校园四季，守护绿色生命</p>

          <Link
            to={isLoggedIn ? '/home' : '/login'}
            className="mt-14 flex h-14 w-full max-w-[300px] items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-lg font-bold text-[var(--text-main)] shadow-[0_12px_28px_rgba(204,203,147,0.35)] transition hover:-translate-y-0.5"
          >
            进入探索
            <span aria-hidden>→</span>
          </Link>

          <p className="mt-9 text-sm text-[var(--text-soft)]">校园植物志 · 智能识别</p>
        </main>
      </div>
    </MobileFrame>
  )
}
