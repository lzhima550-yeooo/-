import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedLayout } from '../components/ProtectedLayout'
import { RouteLoadingFallback } from '../components/RouteLoadingFallback'
import { AchievementsPage } from '../pages/AchievementsPage'
import { CommunityDetailPage } from '../pages/CommunityDetailPage'
import { CommunityPage } from '../pages/CommunityPage'
import { CommunityPublishPage } from '../pages/CommunityPublishPage'
import { EncyclopediaDetailPage } from '../pages/EncyclopediaDetailPage'
import { EncyclopediaPage } from '../pages/EncyclopediaPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { HomePage } from '../pages/HomePage'
import { IdentifyPage } from '../pages/IdentifyPage'
import { LoginPage } from '../pages/LoginPage'
import { RegisterPage } from '../pages/RegisterPage'
import { SpiritPage } from '../pages/SpiritPage'
import { WelcomePage } from '../pages/WelcomePage'
import { analytics } from '../services/analytics'
import { useAppStore } from '../store/useAppStore'

const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))

function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    analytics.track('page_view', location.pathname)
  }, [location.pathname])

  return null
}

export function AppRouter() {
  const isLoggedIn = useAppStore((state) => state.isLoggedIn)

  return (
    <BrowserRouter>
      <AnalyticsTracker />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={isLoggedIn ? <Navigate to="/home" replace /> : <WelcomePage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/identify" element={<IdentifyPage />} />
            <Route path="/encyclopedia" element={<EncyclopediaPage />} />
            <Route path="/encyclopedia/:id" element={<EncyclopediaDetailPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/community/new" element={<CommunityPublishPage />} />
            <Route path="/community/:id" element={<CommunityDetailPage />} />
            <Route path="/spirit" element={<SpiritPage />} />
            <Route path="/me" element={<AchievementsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>

          <Route path="*" element={<Navigate to={isLoggedIn ? '/home' : '/welcome'} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

