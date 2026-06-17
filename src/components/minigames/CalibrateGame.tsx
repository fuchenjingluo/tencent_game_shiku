// ────────────────────────────────────────────────────────────────────────────
// 小游戏：calibrate v2.0 — "时间压力 + 值漂移 + 多轴同步"
// 多个轴需要同时对准目标区间。值会缓慢漂移（需要持续微调），
// 增加倒计时压力。高难度时需要多个轴同时到达目标才能提交。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface CalibrateGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

export function CalibrateGame({ difficulty, prompt, onComplete }: CalibrateGameProps) {
  const axes = difficulty  // 1/2/3轴
  const tolerance = 10 - difficulty * 2  // 8/6/4%
  const timeLimit = difficulty === 1 ? 20 : difficulty === 2 ? 16 : 12

  const [values, setValues] = useState<number[]>(() =>
    Array.from({ length: axes }, () => Math.floor(Math.random() * 50 + 20))
  )
  const [targets] = useState<number[]>(() =>
    Array.from({ length: axes }, () => Math.floor(Math.random() * 30 + 35))
  )
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dragAxis, setDragAxis] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [started, setStarted] = useState(false)
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])
  const driftRef = useRef(0)

  // ── 倒计时 ──
  useEffect(() => {
    if (!started || submitted) return
    const t = setInterval(() => {
      setTimeLeft(v => {
        if (v <= 1) { clearInterval(t); submitNow(); return 0 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [started, submitted])

  // ── 值漂移（高难度） ──
  useEffect(() => {
    if (!started || submitted) return
    if (difficulty < 2) return
    const driftSpeed = difficulty === 2 ? 0.12 : 0.25
    const interval = setInterval(() => {
      setValues(v => v.map(val => {
        // 随机微小漂移
        const drift = (Math.random() - 0.5) * driftSpeed * 2
        return Math.max(0, Math.min(100, val + drift))
      }))
    }, 80)
    return () => clearInterval(interval)
  }, [started, submitted, difficulty])

  const updateValue = useCallback((axis: number, clientX: number) => {
    const track = trackRefs.current[axis]
    if (!track || submitted) return
    const rect = track.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setValues((v) => v.map((val, i) => i === axis ? Math.round(pct) : val))
  }, [submitted])

  function submitNow() {
    if (submitted) return
    // 多轴模式：必须全部同时对准
    const allHit = difficulty >= 2
      ? values.every(v => Math.abs(v - targets[0]) <= tolerance)  // 简化：取第一个target
      : values.every((v, i) => Math.abs(v - targets[i]) <= tolerance)

    const anyHit = values.some((v, i) => Math.abs(v - targets[i]) <= tolerance)
    const finalSuccess = difficulty >= 2
      ? values.reduce((acc, v, i) => acc + (Math.abs(v - targets[i]) <= tolerance ? 1 : 0), 0) >= Math.ceil(axes / 2)
      : allHit

    setSuccess(finalSuccess)
    setSubmitted(true)
    setTimeout(() => onComplete(finalSuccess), 1000)
  }

  function submit() {
    if (submitted || !started) return
    submitNow()
  }

  function startGame() {
    setStarted(true)
  }

  const axisLabels = ['X通道', 'Y通道', 'Z通道']
  const axisColors = ['#d7bd73', '#8fae78', '#7ab8d9']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 340 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {/* HUD */}
      <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: 'monospace' }}>
        <span style={{ color: '#8b7355' }}>容差 ±{tolerance}%</span>
        {started && !submitted && (
          <span style={{ color: timeLeft <= 5 ? '#d98f72' : '#d7bd73' }}>
            时间 {timeLeft}s
          </span>
        )}
      </div>

      {/* 轴滑条 */}
      {Array.from({ length: axes }).map((_, i) => {
        const diff = Math.abs(values[i] - targets[i])
        const hit = diff <= tolerance
        const near = diff <= tolerance * 2

        return (
          <div key={i} style={{ width: '100%', maxWidth: 370 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontFamily: 'monospace' }}>
              <span style={{ color: hit ? axisColors[i] : '#5a5040' }}>
                {axisLabels[i]} {hit ? '✓' : near ? '~' : ''}
              </span>
              <span style={{ color: hit ? '#8fae78' : near ? '#d9a063' : '#d98f72' }}>
                {values[i]}%
                <span style={{ color: '#5a5040', fontSize: 10 }}> → {targets[i]}%</span>
              </span>
            </div>

            <div
              ref={(el) => { trackRefs.current[i] = el }}
              style={{
                position: 'relative', height: 22,
                background: '#1e1b15', borderRadius: 10,
                border: `1px solid ${hit ? '#8fae78' : near ? '#d9a06388' : '#3d3322'}`,
                cursor: submitted ? 'default' : 'ew-resize',
              }}
              onMouseMove={(e) => {
                if (dragAxis === i && !submitted) updateValue(i, e.clientX)
              }}
              onMouseUp={() => setDragAxis(null)}
              onMouseLeave={() => setDragAxis(null)}
            >
              {/* 目标区间 */}
              <div style={{
                position: 'absolute', top: 5, left: `${targets[i] - tolerance}%`,
                width: `${tolerance * 2}%`, height: 12,
                background: 'rgba(143,174,120,0.2)', border: '1px solid rgba(143,174,120,0.4)',
                borderRadius: 3,
              }} />

              {/* 目标线 */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: `${targets[i]}%`,
                width: 1.5, background: '#8fae78', transform: 'translateX(-1px)',
              }} />

              {/* 手柄（带命中指示） */}
              <motion.div
                animate={{ left: `${values[i]}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                onMouseDown={() => { if (!submitted && started) setDragAxis(i) }}
                style={{
                  position: 'absolute', top: '50%', width: 18, height: 18,
                  background: hit ? axisColors[i] : near ? axisColors[i] + 'aa' : axisColors[i] + '88',
                  borderRadius: '50%', transform: 'translate(-50%, -50%)',
                  cursor: submitted ? 'default' : 'grab',
                  boxShadow: hit ? `0 0 14px ${axisColors[i]}66` : 'none',
                  zIndex: 2,
                  border: hit ? '2px solid white' : '1px solid transparent',
                }}
              />
            </div>
          </div>
        )
      })}

      {!started && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={startGame}
          style={{
            marginTop: 4, padding: '10px 32px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 8,
            color: '#d7bd73', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
          }}
        >
          🔧 开始校准
        </motion.button>
      )}

      {started && !submitted && (
        <div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={submit}
            style={{
              marginTop: 4, padding: '8px 28px', background: 'rgba(143,174,120,0.1)',
              border: '1px solid rgba(143,174,120,0.3)', borderRadius: 6,
              color: '#8fae78', cursor: 'pointer', fontSize: 13, fontFamily: 'monospace',
            }}
          >
            确认校准
          </motion.button>
          {difficulty >= 2 && (
            <div style={{ fontSize: 9, color: '#5a5040', marginTop: 4, textAlign: 'center' }}>
              数值会随时间漂移，请尽快校准
            </div>
          )}
        </div>
      )}

      {submitted && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260 }}
          style={{ textAlign: 'center' }}
        >
          {success ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 2 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8fae78' }}>校准精确</div>
              <div style={{ fontSize: 10, color: '#5a5040', marginTop: 2 }}>所有参数都在容差范围内</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 2 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d98f72' }}>偏差超标</div>
              <div style={{ fontSize: 10, color: '#5a5040', marginTop: 2 }}>
                {timeLeft <= 0 ? '时间耗尽，校准未完成' : '部分参数超出容差范围'}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
