import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const routeLabels: Record<string, string> = {
  '/home': '首页',
  '/identify': 'AI识别',
  '/encyclopedia': '图鉴库',
  '/spirit': '灵化互动',
  '/community': '求助社区',
  '/community/new': '发布求助',
  '/me': '我的成就',
}

export function RouteLiveAnnouncer() {
  const location = useLocation()
  const [label, setLabel] = useState('')

  useEffect(() => {
    const key = Object.keys(routeLabels).find((path) => location.pathname.startsWith(path))
    setLabel(key ? `已切换到${routeLabels[key]}` : `已切换页面 ${location.pathname}`)
  }, [location.pathname])

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {label}
    </p>
  )
}
