// ────────────────────────────────────────────────────────────────────────────
// 小游戏：timing v2.0 — "稳定窗口缩小"机制
// 传感器读数正在震荡——等待越久，目标区间越窄（读数越精确），但命中越难。
// 按空格/点击锁定读数。
// ────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface TimingGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

/** 根据难度决定缩窗参数 */
function getParams(diff: number) {
  switch (diff) {
    case 1: return { startWidth: 60, endWidth: 40, durationSec: 8, pointerSpeed: 55 }
    case 2: return { startWidth: 55, endWidth: 28, durationSec: 6, pointerSpeed: 72 }
    case 3: return { startWidth: 50, endWidth: 18, durationSec: 4, pointerSpeed: 90 }
    default: return { startWidth: 55, endWidth: 28, durationSec: 6, pointerSpeed: 72 }
  }
}

export function TimingGame({ difficulty, prompt, onComplete }: TimingGameProps) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result'>('idle')
  const [position, setPosition] = useState(50)
  const [zonePct, setZonePct] = useState(60)
  const [elapsed, setElapsed] = useState(0)
  const [outcome, setOutcome] = useState<'none' | 'early-hit' | 'perfect-hit' | 'miss'>('none')

  const rafRef = useRef<ReturnType<typeof requestAnimationFrame>>(0)
  const posRef = useRef(50)
  const dirRef = useRef(1)
  const lastTimeRef = useRef(0)
  const elapsedRef = useRef(0)
  const doneRef = useRef(false)
  const params = getParams(difficulty)

  function startGame() {
    setPhase('playing')
    setOutcome('none')
    setElapsed(0)
    posRef.current = 50
    dirRef.current = 1
    elapsedRef.current = 0
    doneRef.current = false
    lastTimeRef.current = performance.now()
    requestAnimationFrame(loop)
  }

  function loop(t: number) {
    if (doneRef.current) return
    const dt = (t - lastTimeRef.current) / 1000
    lastTimeRef.current = t
    elapsedRef.current += dt

    // 窗口持续缩小
    const progress = Math.min(1, elapsedRef.current / params.durationSec)
    const currentWidth = params.startWidth + (params.endWidth - params.startWidth) * progress
    setZonePct(currentWidth)
    setElapsed(Math.round(elapsedRef.current * 10) / 10)

    // 指针移动
    posRef.current += dirRef.current * params.pointerSpeed * dt
    if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1 }
    if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1 }
    setPosition(posRef.current)

    // 窗口缩到最小 → 自动结束（miss）
    if (progress >= 1 && !doneRef.current) {
      doneRef.current = true
      setOutcome('miss')
      setPhase('result')
      setTimeout(() => onComplete(false), 1200)
      return
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  function press() {
    if (phase !== 'playing' || doneRef.current) return
    doneRef.current = true

    // 判断命中：指针在目标区间内？
    const zoneStart = 50 - zonePct / 2
    const zoneEnd = 50 + zonePct / 2
    const hit = posRef.current >= zoneStart && posRef.current <= zoneEnd

    // 区分 "早按" vs "完美命中"
    // 窗口越窄时命中 = 越精准
    const stabilityBonus = (1 - zonePct / 100) * 100

    if (hit && stabilityBonus > 25) {
      setOutcome('perfect-hit')  // 等待足够久,窗口很窄时命中
    } else if (hit) {
      setOutcome('early-hit')    // 较早锁定,窗口还很宽
    } else {
      setOutcome('miss')
    }

    setPhase('result')
    const success = hit
    setTimeout(() => onComplete(success), 1400)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); press() }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      cancelAnimationFrame(rafRef.current!)
    }
  })

  const zoneStart = 50 - zonePct / 2
  const zoneEnd = 50 + zonePct / 2
  const zoneColor = zonePct > 40 ? '#8fae78' : zonePct > 25 ? '#d7bd73' : '#d9a063'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', lineHeight: 1.5, maxWidth: 360 }}>
        {prompt}
      </div>

      {/* 状态说明 */}
      {phase === 'playing' && (
        <div style={{ fontSize: 10, color: zoneColor, display: 'flex', gap: 16, fontFamily: 'monospace' }}>
          <span>稳定度: {Math.round(100 - zonePct)}%</span>
          <span>{elapsed.toFixed(1)}s / {params.durationSec}s</span>
        </div>
      )}

      {/* 指针条 */}
      {phase === 'playing' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ position: 'relative', width: 380, height: 52, cursor: 'pointer' }}
          onClick={press}
        >
          {/* 背景轨道 */}
          <div style={{
            position: 'absolute', top: '50%', left: 0, right: 0, height: 10,
            transform: 'translateY(-50%)',
            background: '#1e1b15',
            borderRadius: 5,
            border: '1px solid #3d3322',
          }} />

          {/* 收缩中的目标窗口 */}
          <motion.div
            animate={{
              left: `${zoneStart}%`,
              width: `${zonePct}%`,
              borderColor: zoneColor + '88',
              background: zoneColor + '22',
            }}
            transition={{ duration: 0.05 }}
            style={{
              position: 'absolute', top: '50%',
              height: 14,
              transform: 'translateY(-50%)',
              borderRadius: 5,
              border: '1px solid',
            }}
          />

          {/* 窗口中心线 */}
          <div style={{
            position: 'absolute', top: '50%',
            left: '50%',
            width: 2, height: 20,
            transform: 'translate(-50%, -50%)',
            background: zoneColor + '55',
          }} />

          {/* 移动指针 */}
          <motion.div
            animate={{ left: `${position}%` }}
            transition={{ duration: 0 }}
            style={{
              position: 'absolute', top: '50%',
              width: 4, height: 30,
              background: '#d7bd73',
              borderRadius: 2,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 10px rgba(215,189,115,0.9)',
            }}
          />

          {/* 刻度 */}
          {[0, 25, 50, 75, 100].map((p) => (
            <div key={p} style={{
              position: 'absolute', top: '70%',
              left: `${p}%`,
              width: 1, height: 6,
              background: '#3d3322',
              transform: 'translateX(-50%)',
            }} />
          ))}
        </motion.div>
      )}

      {/* 开始按钮 */}
      {phase === 'idle' && (
        <button onClick={startGame} style={{
          padding: '10px 28px', background: 'rgba(215,189,115,0.1)',
          border: '1px solid rgba(215,189,115,0.4)', borderRadius: 6,
          color: '#d7bd73', cursor: 'pointer', fontSize: 14,
          fontFamily: 'monospace',
        }}>
          ⏱ 开始校准
        </button>
      )}

      {/* 操作提示 */}
      {phase === 'playing' && (
        <div style={{ fontSize: 10, color: '#5a5040' }}>
          按 <span style={{ color: '#d7bd73' }}>空格键</span> 或 <span style={{ color: '#d7bd73' }}>点击滑条</span> 锁定读数
        </div>
      )}

      {/* 结果 */}
      {phase === 'result' && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
          style={{ textAlign: 'center' }}
        >
          {outcome === 'perfect-hit' && (
            <div>
              <div style={{ fontSize: 36, marginBottom: 4 }}>🎯</div>
              <div style={{ fontSize: 16, color: '#d7bd73', fontWeight: 700 }}>
                完美读数锁定！
              </div>
              <div style={{ fontSize: 11, color: '#8b7355', marginTop: 4 }}>
                传感器在高度稳定时记录了精确数据
              </div>
            </div>
          )}
          {outcome === 'early-hit' && (
            <div>
              <div style={{ fontSize: 36, marginBottom: 4 }}>✅</div>
              <div style={{ fontSize: 16, color: '#8fae78', fontWeight: 700 }}>
                读数已锁定
              </div>
              <div style={{ fontSize: 11, color: '#8b7355', marginTop: 4 }}>
                提前锁定，数据可用但精度未达到最优
              </div>
            </div>
          )}
          {outcome === 'miss' && (
            <div>
              <div style={{ fontSize: 36, marginBottom: 4 }}>❌</div>
              <div style={{ fontSize: 16, color: '#d98f72', fontWeight: 700 }}>
                读数偏差
              </div>
              <div style={{ fontSize: 11, color: '#8b7355', marginTop: 4 }}>
                指针不在稳定区间内，需要重新校准
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
