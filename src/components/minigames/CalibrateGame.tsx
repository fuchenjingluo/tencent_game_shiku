// ────────────────────────────────────────────────────────────────────────────
// 小游戏：calibrate — 精密校准
// 拖动滑块使读数精确对准目标值
// ────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'

interface CalibrateGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

export function CalibrateGame({ difficulty, prompt, onComplete }: CalibrateGameProps) {
  const axes = difficulty  // 1/2/3个轴
  const tolerance = 10 - difficulty * 2  // 8/6/4% 容差
  const [values, setValues] = useState<number[]>(() =>
    Array.from({ length: axes }, () => Math.floor(Math.random() * 60 + 20))
  )
  const [targets] = useState<number[]>(() =>
    Array.from({ length: axes }, () => Math.floor(Math.random() * 40 + 30))
  )
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dragAxis, setDragAxis] = useState<number | null>(null)
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])

  const updateValue = useCallback((axis: number, clientX: number) => {
    const track = trackRefs.current[axis]
    if (!track) return
    const rect = track.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setValues((v) => v.map((val, i) => i === axis ? Math.round(pct) : val))
  }, [])

  function submit() {
    const allHit = values.every((v, i) => Math.abs(v - targets[i]) <= tolerance)
    setSuccess(allHit)
    setSubmitted(true)
    setTimeout(() => onComplete(allHit), 1000)
  }

  const axisLabels = ['X轴', 'Y轴', 'Z轴']
  const axisColors = ['#d7bd73', '#8fae78', '#7ab8d9']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minWidth: 340 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center' }}>{prompt}</div>
      <div style={{ fontSize: 11, color: '#5a5040' }}>容差：±{tolerance}%</div>

      {Array.from({ length: axes }).map((_, i) => {
        const diff = Math.abs(values[i] - targets[i])
        const hit = diff <= tolerance

        return (
          <div key={i} style={{ width: '100%', maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
              <span style={{ color: axisColors[i] }}>{axisLabels[i]}</span>
              <span style={{ color: hit ? '#8fae78' : '#d98f72', fontFamily: 'monospace' }}>
                {values[i]}% → 目标 {targets[i]}%
              </span>
            </div>

            {/* 轨道 */}
            <div
              ref={(el) => { trackRefs.current[i] = el }}
              style={{
                position: 'relative', height: 20,
                background: '#1e1b15',
                borderRadius: 10,
                border: `1px solid ${hit ? '#8fae78' : '#3d3322'}`,
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
                position: 'absolute', top: 4,
                left: `${targets[i] - tolerance}%`,
                width: `${tolerance * 2}%`,
                height: 12,
                background: 'rgba(143,174,120,0.25)',
                border: '1px solid rgba(143,174,120,0.5)',
                borderRadius: 4,
              }} />

              {/* 目标线 */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${targets[i]}%`,
                width: 2,
                background: '#8fae78',
                transform: 'translateX(-1px)',
              }} />

              {/* 当前值手柄 */}
              <motion.div
                animate={{ left: `${values[i]}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onMouseDown={() => { if (!submitted) setDragAxis(i) }}
                style={{
                  position: 'absolute', top: '50%',
                  width: 16, height: 16,
                  background: axisColors[i],
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  cursor: submitted ? 'default' : 'grab',
                  boxShadow: `0 0 8px ${axisColors[i]}66`,
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        )
      })}

      {!submitted && (
        <button
          onClick={submit}
          style={{
            marginTop: 4,
            padding: '8px 28px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 6,
            color: '#d7bd73', cursor: 'pointer', fontSize: 13,
          }}
        >
          确认校准
        </button>
      )}

      {submitted && (
        <div style={{ color: success ? '#8fae78' : '#d98f72', fontSize: 14, fontWeight: 600 }}>
          {success ? '✓ 校准精确！' : '✗ 偏差超标'}
        </div>
      )}
    </div>
  )
}
