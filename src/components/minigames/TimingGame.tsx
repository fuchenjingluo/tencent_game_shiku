// ────────────────────────────────────────────────────────────────────────────
// 小游戏：timing v3.0 — "黄金窗口 + 多轮渐进 + 脉冲反馈"
// 传感器读数震荡——等待越久稳定度越高（窗口越窄），但命中窗口也随之缩小。
// 绿色窗口内有更窄的"黄金窗口"——在黄金窗口内命中视为完美。
// 连续3轮，每轮难度递进：增大指针振幅、加快速度、缩小黄金窗口比例。
// ────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TimingGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

/** 每轮配置 */
interface RoundConfig {
  durationSec: number
  startWidth: number          // 绿窗初始宽度(%)
  endWidth: number            // 绿窗最终宽度(%)
  goldRatio: number           // 黄金窗口占绿窗的比例 (0-1)
  pointerSpeed: number        // 指针基础速度
  amplitude: number           // 指针振幅(%)
}

function getRoundConfigs(diff: number): RoundConfig[] {
  switch (diff) {
    case 1:
      return [
        { durationSec: 3, startWidth: 50, endWidth: 30, goldRatio: 0.4, pointerSpeed: 45, amplitude: 40 },
        { durationSec: 2.5, startWidth: 45, endWidth: 24, goldRatio: 0.35, pointerSpeed: 55, amplitude: 45 },
        { durationSec: 2, startWidth: 40, endWidth: 18, goldRatio: 0.3, pointerSpeed: 65, amplitude: 50 },
      ]
    case 2:
      return [
        { durationSec: 2.5, startWidth: 44, endWidth: 22, goldRatio: 0.35, pointerSpeed: 65, amplitude: 44 },
        { durationSec: 2, startWidth: 38, endWidth: 16, goldRatio: 0.3, pointerSpeed: 78, amplitude: 48 },
        { durationSec: 1.5, startWidth: 32, endWidth: 12, goldRatio: 0.25, pointerSpeed: 92, amplitude: 52 },
      ]
    case 3:
      return [
        { durationSec: 2, startWidth: 38, endWidth: 18, goldRatio: 0.3, pointerSpeed: 80, amplitude: 46 },
        { durationSec: 1.5, startWidth: 30, endWidth: 12, goldRatio: 0.22, pointerSpeed: 98, amplitude: 50 },
        { durationSec: 1.2, startWidth: 24, endWidth: 8, goldRatio: 0.18, pointerSpeed: 115, amplitude: 55 },
      ]
    default:
      return getRoundConfigs(1)
  }
}

type RoundResult = 'pending' | 'perfect' | 'hit' | 'miss'
type GamePhase = 'idle' | 'playing' | 'round-result' | 'done'

export function TimingGame({ difficulty, prompt, onComplete }: TimingGameProps) {
  const roundConfigs = getRoundConfigs(difficulty)
  const totalRounds = roundConfigs.length

  const [phase, setPhase] = useState<GamePhase>('idle')
  const [round, setRound] = useState(0)
  const [results, setResults] = useState<RoundResult[]>(Array(totalRounds).fill('pending'))
  const [position, setPosition] = useState(50)
  const [zonePct, setZonePct] = useState(50)
  const [elapsed, setElapsed] = useState(0)
  const [justResult, setJustResult] = useState<RoundResult | null>(null)
  const [pulseKey, setPulseKey] = useState(0)

  const rafRef = useRef<ReturnType<typeof requestAnimationFrame>>(0)
  const posRef = useRef(50)
  const dirRef = useRef(1)
  const lastTimeRef = useRef(0)
  const elapsedRef = useRef(0)
  const doneRef = useRef(false)
  const startTimeRef = useRef(0)
  const configRef = useRef(roundConfigs[0])
  const resultsRef = useRef<RoundResult[]>(Array(totalRounds).fill('pending'))
  const roundRef = useRef(0)

  // ── 获取当前轮配置 ──
  const cfg = roundConfigs[round]
  const goldStart = 50 - (zonePct * cfg.goldRatio) / 2
  const goldEnd = 50 + (zonePct * cfg.goldRatio) / 2
  const zoneStart = 50 - zonePct / 2
  const zoneEnd = 50 + zonePct / 2

  // 计算稳定度(0-100) 和难度指示色
  const stability = Math.round(100 - zonePct)
  const zoneColor = zonePct > 35 ? '#8fae78' : zonePct > 20 ? '#d7bd73' : '#d9a063'
  const goldColor = '#f5d669'

  // ── 动画循环 ──
  const loop = useCallback((t: number) => {
    if (doneRef.current) return
    const dt = (t - lastTimeRef.current) / 1000
    lastTimeRef.current = t
    elapsedRef.current += dt

    const cfg = configRef.current
    const progress = Math.min(1, elapsedRef.current / cfg.durationSec)
    const currentWidth = cfg.startWidth + (cfg.endWidth - cfg.startWidth) * progress
    setZonePct(currentWidth)
    setElapsed(Math.round(elapsedRef.current * 10) / 10)

    // 指针移动：带加速度(越靠近边界速度越快，制造紧迫感)
    const edgeBoost = 1 + Math.abs(posRef.current - 50) / 50 * 0.5
    const speed = cfg.pointerSpeed * edgeBoost
    posRef.current += dirRef.current * speed * dt
    if (posRef.current >= 50 + cfg.amplitude / 2) { posRef.current = 50 + cfg.amplitude / 2; dirRef.current = -1 }
    if (posRef.current <= 50 - cfg.amplitude / 2) { posRef.current = 50 - cfg.amplitude / 2; dirRef.current = 1 }
    setPosition(posRef.current)

    // 窗口缩到最小 → 该轮 miss
    if (progress >= 1 && !doneRef.current) {
      doneRef.current = true
      handleRoundMiss()
      return
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // ── 一轮结束处理 ──
  function handleRoundMiss() {
    const r = roundRef.current
    const newResults = [...resultsRef.current]
    newResults[r] = 'miss'
    resultsRef.current = newResults
    setResults(newResults)
    setJustResult('miss')

    setPhase('round-result')
    setTimeout(() => advanceRound(), 1200)
  }

  function handleRoundHit(isPerfect: boolean) {
    const r = roundRef.current
    const newResults = [...resultsRef.current]
    newResults[r] = isPerfect ? 'perfect' : 'hit'
    resultsRef.current = newResults
    setResults(newResults)
    setJustResult(isPerfect ? 'perfect' : 'hit')
    setPulseKey(k => k + 1)

    setPhase('round-result')
    setTimeout(() => advanceRound(), isPerfect ? 1000 : 800)
  }

  function advanceRound() {
    const nextRound = roundRef.current + 1
    if (nextRound >= totalRounds) {
      finishGame()
      return
    }
    roundRef.current = nextRound
    setRound(nextRound)
    setJustResult(null)
    setPhase('playing')
    startRound(nextRound)
  }

  function finishGame() {
    setPhase('done')
    // 评分：全 perfect = 完美, ≥1 perfect + 其余 hit = 优秀, 全部 hit = 通过, 有 miss = 失败
    const res = resultsRef.current
    const perfects = res.filter(r => r === 'perfect').length
    const hits = res.filter(r => r === 'hit').length
    const misses = res.filter(r => r === 'miss').length

    let success: boolean
    if (misses === 0) {
      success = true
    } else if (misses === 1 && totalRounds === 3) {
      success = true  // 1个miss仍算通过
    } else {
      success = false
    }

    // 如果全perfect额外奖励
    setTimeout(() => onComplete(success), 1500)
  }

  // ── 输入 ──
  function press() {
    if (phase !== 'playing' || doneRef.current) return
    doneRef.current = true

    const pos = posRef.current
    const inGreen = pos >= zoneStart && pos <= zoneEnd
    const inGold = pos >= goldStart && pos <= goldEnd

    if (inGold) {
      handleRoundHit(true)
    } else if (inGreen) {
      handleRoundHit(false)
    } else {
      handleRoundMiss()
    }
  }

  // ── 开始 ──
  function startGame() {
    roundRef.current = 0
    setRound(0)
    resultsRef.current = Array(totalRounds).fill('pending')
    setResults(Array(totalRounds).fill('pending'))
    setPhase('playing')
    startRound(0)
  }

  function startRound(r: number) {
    const cfg = roundConfigs[r]
    configRef.current = cfg
    posRef.current = 50
    dirRef.current = Math.random() > 0.5 ? 1 : -1
    elapsedRef.current = 0
    doneRef.current = false
    setPosition(50)
    setZonePct(cfg.startWidth)
    setElapsed(0)
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // 键盘监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); press() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // ── 总体评级 ──
  function getFinalRating() {
    const perfects = results.filter(r => r === 'perfect').length
    const misses = results.filter(r => r === 'miss').length
    if (perfects === totalRounds) return { label: '完美校准', emoji: '🎯', color: '#f5d669' }
    if (misses === 0 && perfects >= 1) return { label: '优秀操作', emoji: '⭐', color: '#8fae78' }
    if (misses <= 1) return { label: '校准完成', emoji: '✅', color: '#d7bd73' }
    return { label: '校准失败', emoji: '❌', color: '#d98f72' }
  }

  // ── 轮次指示器 ──
  function RoundDots() {
    return (
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {results.map((r, i) => {
          const isActive = i === round && phase === 'playing'
          const isPast = r !== 'pending'
          let dotColor = '#3d3322'
          let bgColor = 'transparent'
          let symbol = ''
          if (r === 'perfect') { dotColor = '#f5d669'; bgColor = 'rgba(245,214,105,0.15)'; symbol = '★' }
          else if (r === 'hit') { dotColor = '#8fae78'; bgColor = 'rgba(143,174,120,0.1)'; symbol = '●' }
          else if (r === 'miss') { dotColor = '#d98f72'; bgColor = 'rgba(217,143,114,0.1)'; symbol = '✕' }
          else if (isActive) { dotColor = '#d7bd73'; bgColor = 'rgba(215,189,115,0.1)' }

          return (
            <motion.div
              key={i}
              animate={{
                scale: isActive ? [1, 1.15, 1] : 1,
                borderColor: isActive ? '#d7bd73' : dotColor + '66',
              }}
              transition={isActive ? { repeat: Infinity, duration: 1.2 } : {}}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `2px solid ${dotColor}66`,
                background: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: dotColor,
                fontFamily: 'monospace',
              }}
            >
              {isPast ? symbol : isActive ? '▶' : i + 1}
            </motion.div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', lineHeight: 1.5, maxWidth: 380 }}>
        {prompt}
      </div>

      {/* 轮次指示 */}
      {phase !== 'idle' && <RoundDots />}

      {/* 状态条 */}
      {phase === 'playing' && (
        <div style={{ display: 'flex', gap: 16, fontSize: 10, fontFamily: 'monospace', color: zoneColor }}>
          <span>稳定度 {stability}%</span>
          <span style={{ color: goldColor }}>黄金窗 {Math.round(zonePct * cfg.goldRatio)}%</span>
          <span>{elapsed.toFixed(1)}s / {cfg.durationSec}s</span>
        </div>
      )}

      {/* 指针滑条 */}
      {phase === 'playing' && (
        <motion.div
          key={`round-${round}-${pulseKey}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ position: 'relative', width: 400, height: 56, cursor: 'pointer', flexShrink: 0 }}
          onClick={press}
        >
          {/* 轨道背景 */}
          <div style={{
            position: 'absolute', top: '50%', left: 0, right: 0, height: 8,
            transform: 'translateY(-50%)', background: '#1e1b15', borderRadius: 4,
            border: '1px solid #3d3322',
          }} />

          {/* 绿色目标窗口 */}
          <motion.div
            animate={{ left: `${zoneStart}%`, width: `${zonePct}%` }}
            transition={{ duration: 0.05 }}
            style={{
              position: 'absolute', top: '50%', height: 12,
              transform: 'translateY(-50%)', borderRadius: 4,
              background: zoneColor + '22',
              border: `1px solid ${zoneColor}88`,
            }}
          />

          {/* 黄金窗口（绿窗内更窄的区间） */}
          <motion.div
            animate={{ left: `${goldStart}%`, width: `${zonePct * cfg.goldRatio}%` }}
            transition={{ duration: 0.05 }}
            style={{
              position: 'absolute', top: '50%', height: 16,
              transform: 'translateY(-50%)', borderRadius: 4,
              background: 'rgba(245,214,105,0.18)',
              border: '1px solid rgba(245,214,105,0.6)',
              boxShadow: '0 0 6px rgba(245,214,105,0.2)',
            }}
          />

          {/* 中心标记线 */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 1, height: 18,
            transform: 'translate(-50%, -50%)', background: zoneColor + '44' }} />

          {/* 移动指针 */}
          <motion.div
            animate={{ left: `${position}%` }}
            transition={{ duration: 0 }}
            style={{
              position: 'absolute', top: '50%', width: 4, height: 28,
              background: '#d7bd73', borderRadius: 2,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 12px rgba(215,189,115,0.9)',
            }}
          />

          {/* 刻度 */}
          {[0, 25, 50, 75, 100].map(p => (
            <div key={p} style={{ position: 'absolute', top: '72%', left: `${p}%`,
              width: 1, height: 5, background: '#3d3322', transform: 'translateX(-50%)' }} />
          ))}
        </motion.div>
      )}

      {/* 操作提示 */}
      {phase === 'playing' && (
        <div style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace' }}>
          按 <span style={{ color: '#d7bd73', fontWeight: 500 }}>空格</span> 或
          <span style={{ color: '#f5d669', fontWeight: 500 }}> 点击 </span>
          锁定读数 · 第 {round + 1}/{totalRounds} 轮
        </div>
      )}

      {/* 单轮结果 */}
      <AnimatePresence>
        {phase === 'round-result' && justResult && (
          <motion.div
            key="round-result"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            style={{ textAlign: 'center' }}
          >
            {justResult === 'perfect' && (
              <div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.4 }}
                  style={{ fontSize: 40, marginBottom: 2 }}
                >🎯</motion.div>
                <div style={{ fontSize: 15, color: '#f5d669', fontWeight: 700 }}>黄金命中！</div>
                <div style={{ fontSize: 10, color: '#8b7355', marginTop: 2 }}>在黄金窗口内锁定 — 数据精度达到最优</div>
              </div>
            )}
            {justResult === 'hit' && (
              <div>
                <div style={{ fontSize: 36, marginBottom: 2 }}>✅</div>
                <div style={{ fontSize: 15, color: '#8fae78', fontWeight: 700 }}>读数已锁定</div>
                <div style={{ fontSize: 10, color: '#8b7355', marginTop: 2 }}>命中目标窗口，数据可用</div>
              </div>
            )}
            {justResult === 'miss' && (
              <div>
                <div style={{ fontSize: 36, marginBottom: 2 }}>💨</div>
                <div style={{ fontSize: 15, color: '#d98f72', fontWeight: 700 }}>窗口错过</div>
                <div style={{ fontSize: 10, color: '#8b7355', marginTop: 2 }}>指针偏离目标区间</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 开始按钮 */}
      {phase === 'idle' && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={startGame}
          style={{
            padding: '10px 32px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 8,
            color: '#d7bd73', cursor: 'pointer', fontSize: 14,
            fontFamily: 'monospace',
          }}
        >
          ⏱ 开始校准 ({totalRounds}轮)
        </motion.button>
      )}

      {/* 最终结果 */}
      {phase === 'done' && (() => {
        const rating = getFinalRating()
        return (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontSize: 44, marginBottom: 4 }}>{rating.emoji}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: rating.color, marginBottom: 6 }}>
              {rating.label}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>
              {results.map((r, i) => (
                <span key={i} style={{
                  fontSize: 16,
                  color: r === 'perfect' ? '#f5d669' : r === 'hit' ? '#8fae78' : '#d98f72',
                  opacity: r === 'pending' ? 0.3 : 1,
                }}>
                  {r === 'perfect' ? '★' : r === 'hit' ? '●' : '✕'}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#5a5040', marginTop: 6, fontFamily: 'monospace' }}>
              {results.filter(r => r === 'perfect').length}完美 {results.filter(r => r === 'hit').length}命中 {results.filter(r => r === 'miss').length}失误
            </div>
          </motion.div>
        )
      })()}
    </div>
  )
}
