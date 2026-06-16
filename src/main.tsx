import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

// 加载进度动画
const loaderBar = document.getElementById('loader-bar')
const loaderTip = document.getElementById('loader-tip')
if (loaderBar && loaderTip) {
  let progress = 0
  const steps = [
    { p: 25, t: '加载纹理资源…' },
    { p: 50, t: '生成石窟地图…' },
    { p: 75, t: '校准传感器…' },
    { p: 90, t: '准备巡检记录…' },
    { p: 100, t: '加载完成' },
  ]
  let si = 0
  const interval = setInterval(() => {
    if (si < steps.length) {
      loaderBar.style.width = steps[si].p + '%'
      loaderTip.textContent = steps[si].t
      si++
    }
    if (progress >= 100) {
      clearInterval(interval)
      const rootLoader = document.getElementById('root-loader')
      if (rootLoader) {
        rootLoader.style.opacity = '0'
        setTimeout(() => { rootLoader.style.display = 'none' }, 600)
      }
    }
    progress = steps[Math.min(si, steps.length - 1)].p
  }, 600)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
