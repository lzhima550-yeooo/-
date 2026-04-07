import { NavLink } from 'react-router-dom'
import { MaterialSymbol } from './MaterialSymbol'

const tabs = [
  { to: '/home', label: '首页', icon: 'home' },
  { to: '/encyclopedia', label: '图鉴', icon: 'menu_book' },
  { to: '/spirit', label: '灵化', icon: 'auto_awesome' },
  { to: '/community', label: '社区', icon: 'groups' },
  { to: '/me', label: '我的', icon: 'person' },
]

export function BottomTabBar() {
  return (
    <nav className="safe-bottom fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-[var(--line)] bg-[color:var(--panel)/0.96] px-2 pb-2 pt-2 backdrop-blur md:max-w-[960px] lg:hidden">
      <ul className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] transition-colors ${
                  isActive ? 'text-[var(--accent-deep)] font-semibold' : 'text-[var(--text-soft)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <MaterialSymbol name={tab.icon} filled={isActive} className="text-[20px]" />
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
