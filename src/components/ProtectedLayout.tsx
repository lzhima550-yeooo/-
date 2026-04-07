import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { BottomTabBar } from './BottomTabBar'
import { DesktopSidebar } from './DesktopSidebar'
import { MobileFrame } from './MobileFrame'
import { NotificationCenter } from './NotificationCenter'
import { RouteLiveAnnouncer } from './RouteLiveAnnouncer'
import { ToastViewport } from './ToastViewport'

const isTestEnv = import.meta.env.MODE === 'test'

export function ProtectedLayout() {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn)
  const location = useLocation()

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const hideMobileTabs = location.pathname === '/community/new'
  const hideNotificationFab = /^\/community\/[^/]+$/.test(location.pathname)

  return (
    <MobileFrame withTabs={!hideMobileTabs}>
      <a href="#page-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[140] focus:rounded focus:bg-white focus:px-3 focus:py-2">
        跳到主内容
      </a>
      {isTestEnv ? null : <RouteLiveAnnouncer />}
      {isTestEnv || hideNotificationFab ? null : <NotificationCenter />}
      {isTestEnv ? null : <ToastViewport />}

      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5 lg:px-5 lg:py-5">
        <DesktopSidebar />
        <main id="page-main" className="min-w-0 lg:overflow-hidden lg:rounded-[24px] lg:border lg:border-[var(--line)] lg:bg-[var(--panel)]" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      {hideMobileTabs ? null : <BottomTabBar />}
    </MobileFrame>
  )
}

