import { NavLink } from 'react-router-dom'
import { MaterialSymbol } from './MaterialSymbol'
import { useAppStore } from '../store/useAppStore'

const sidebarCampusImage = '/images/campus-dashboard.svg'
const sidebarCampusFallback = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#dcebd2"/>
    <stop offset="100%" stop-color="#a7c4a0"/>
  </linearGradient>
  <rect width="1200" height="700" fill="url(#g)"/>
  <path d="M520 700L590 280h20l70 420z" fill="#c7b29a"/>
  <text x="58" y="120" fill="#2f5f49" font-size="56" font-family="'Noto Sans SC', sans-serif">四季夏木</text>
</svg>
`)}`

const navItems = [
  { to: '/home', label: '首页', icon: 'home' },
  { to: '/identify', label: 'AI识别', icon: 'center_focus_strong' },
  { to: '/encyclopedia', label: '图鉴库', icon: 'menu_book' },
  { to: '/spirit', label: '灵化互动', icon: 'auto_awesome' },
  { to: '/community', label: '求助社区', icon: 'groups' },
  { to: '/me', label: '我的成就', icon: 'person' },
  { to: '/analytics', label: '分析面板', icon: 'insights' },
]

export function DesktopSidebar() {
  const profileName = useAppStore((state) => state.profileName)
  const profileAvatar = useAppStore((state) => state.profileAvatar)

  return (
    <aside className="hidden lg:flex lg:flex-col lg:gap-4">
      <article className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-sm">
        <img
          src={sidebarCampusImage}
          alt="校园四季"
          className="h-44 w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = sidebarCampusFallback
          }}
        />
        <div className="p-4">
          <h2 className="text-xl font-bold text-[var(--text-main)]">四季夏木</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-soft)]">二次元清新风校园植保社区</p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card-soft)] p-2.5">
            <img src={profileAvatar} alt="用户头像" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">{profileName || '未设置昵称'}</p>
              <p className="text-xs text-[var(--text-soft)]">可在“我的成就”中编辑资料</p>
            </div>
          </div>
        </div>
      </article>

      <nav className="rounded-[24px] border border-[var(--line)] bg-white p-3 shadow-sm">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-[color:var(--accent)/0.55] text-[var(--text-main)] font-semibold'
                      : 'text-[var(--text-soft)] hover:bg-[var(--card-soft)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <MaterialSymbol name={item.icon} filled={isActive} className="text-[20px]" />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <article className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--text-main)]">今日提示</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
          上传虫叶照片后可快速生成预识别，再去社区发帖会更容易获得准确解答。
        </p>
      </article>
    </aside>
  )
}

