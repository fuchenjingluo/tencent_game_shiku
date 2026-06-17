import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

const loaderBar = document.getElementById('loader-bar')
const loaderTip = document.getElementById('loader-tip')
const rootLoader = document.getElementById('root-loader')

let bootDone = false
let loaderDismissed = false
let loaderLocked = false  // ★ 加载器锁定 — 一旦 dismiss 后不允许再次显示（除非 boot:reset）
let bootGeneration = 0  // ★ 代际计数器 — 防止 stale 异步事件污染新 boot 周期

// ★ 全局 getter — BootScene 在 create() 中调用以获取当期代际
;(window as any).getBootGeneration = () => bootGeneration

window.addEventListener('boot:progress', ((e: CustomEvent) => {
  if (loaderDismissed || loaderLocked) return

  const detail = e.detail
  if (!detail || typeof detail.progress !== 'number') return

  // ★ 代际过滤：只接受当前 boot 周期的事件
  const eventGen: number = detail.gen ?? 0
  if (eventGen !== bootGeneration) {
    console.log('[main] boot:progress 代际不匹配, eventGen=', eventGen, 'bootGeneration=', bootGeneration, 'detail=', detail)
    return
  }

  const { progress, tip } = detail as { progress: number; tip: string }

  if (loaderBar) loaderBar.style.width = progress + '%'
  if (loaderTip && tip) loaderTip.textContent = tip

  if (progress >= 100 && rootLoader && !bootDone) {
    console.log('[main] 收到100%, gen=', eventGen, '锁定加载器')
    bootDone = true
    loaderDismissed = true
    loaderLocked = true
    rootLoader.style.opacity = '0'
    const hideTimer = setTimeout(() => {
      if (rootLoader && bootDone && loaderDismissed) {
        rootLoader.style.display = 'none'
      }
    }, 600)
    // ★ 保存 hide timer ID，如果新一轮 boot 中断则清除
    ;(window as any).__loaderHideTimer = hideTimer
    window.dispatchEvent(new CustomEvent('boot:complete'))
  }
}) as EventListener)

// 12 秒兜底
setTimeout(() => {
  if (rootLoader && !bootDone) {
    bootDone = true
    loaderDismissed = true
    rootLoader.style.opacity = '0'
    setTimeout(() => { if (rootLoader) rootLoader.style.display = 'none' }, 600)
  }
}, 12000)

// ★ 重置 loader 状态（点击"开始游戏"时调用）
window.addEventListener('boot:reset', () => {
  console.log('[main] boot:reset, 新代际=', bootGeneration + 1)
  // 先清理上一次可能残留的 hide timer
  const prevTimer = (window as any).__loaderHideTimer
  if (prevTimer) { clearTimeout(prevTimer); (window as any).__loaderHideTimer = null }

  // ★ 递增代际，使所有旧周期的 stale 事件被自动忽略
  bootGeneration++

  bootDone = false
  loaderDismissed = false
  loaderLocked = false  // ★ 解锁加载器
  if (rootLoader) {
    rootLoader.style.display = 'flex'
    rootLoader.style.opacity = '1'
  }
  if (loaderBar) loaderBar.style.width = '0%'
  if (loaderTip) loaderTip.textContent = '加载纹理资源…'
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
