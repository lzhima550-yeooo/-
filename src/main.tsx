import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useUiStore } from './store/useUiStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        useUiStore.getState().pushToast({ level: 'info', message: '离线缓存已就绪，可安装到桌面。' })
      })
      .catch(() => {
        // ignore registration failure in unsupported environments
      })
  })
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  useUiStore.getState().pushToast({ level: 'info', message: '支持安装应用：可在浏览器菜单中添加到主屏幕。' })
})
