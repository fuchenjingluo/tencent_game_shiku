// ────────────────────────────────────────────────────────────────────────────
// 小游戏：wire v2.0 — "时间压力 + 交叉提示 + 视觉优化"
// 左侧端口与右侧端口一对一正确连线。增加倒计时、交叉线红色警告、
// 正确配对计数反馈。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface WireGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

const WIRE_COLORS = ['#d7bd73', '#8fae78', '#d98f72', '#7ab8d9', '#a07ab8', '#d9a07a', '#639922']

export function WireGame({ difficulty, prompt, onComplete }: WireGameProps) {
  const wires = 3 + difficulty  // 4/5/6根
  const timeLimit = difficulty === 1 ? 30 : difficulty === 2 ? 22 : 16

  const [leftPorts] = useState(() =>
    Array.from({ length: wires }, (_, i) => ({ id: i, label: `A${i + 1}` }))
  )
  const [rightPorts] = useState(() =>
    Array.from({ length: wires }, (_, i) => ({ id: i, label: `B${i + 1}` }))
      .sort(() => Math.random() - 0.5)
      .map((p, i) => ({ ...p, displayIdx: i }))
  )
  const [connections, setConnections] = useState<Map<number, number>>(new Map())
  const [dragging, setDragging] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [started, setStarted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef<(HTMLDivElement | null)[]>([])
  const rightRefs = useRef<(HTMLDivElement | null)[]>([])

  // ── 倒计时 ──
  useEffect(() => {
    if (!started || submitted) return
    const t = setInterval(() => {
      setTimeLeft(v => {
        if (v <= 1) { clearInterval(t); autoSubmit(); return 0 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [started, submitted])

  function autoSubmit() {
    if (submitted) return
    const correct = leftPorts.every((lp) => connections.get(lp.id) === lp.id)
    setSuccess(correct)
    setSubmitted(true)
    setTimeout(() => onComplete(correct), 1000)
  }

  function getPortCenter(el: HTMLDivElement | null) {
    if (!el || !containerRef.current) return { x: 0, y: 0 }
    const container = containerRef.current.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    return { x: rect.left + rect.width / 2 - container.left, y: rect.top + rect.height / 2 - container.top }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [dragging])

  function handleLeftDown(id: number) {
    if (submitted) return
    setStarted(true)
    setDragging(id)
  }

  function handleRightUp(rightId: number) {
    if (dragging === null || submitted) return
    const existing = [...connections.entries()].find(([, r]) => r === rightId)
    const newMap = new Map(connections)
    if (existing) newMap.delete(existing[0])
    newMap.set(dragging, rightId)
    setConnections(newMap)
    setDragging(null)
  }

  function submit() {
    const correct = leftPorts.every((lp) => connections.get(lp.id) === lp.id)
    setSuccess(correct)
    setSubmitted(true)
    setTimeout(() => onComplete(correct), 1000)
  }

  // ── 检测交叉线 ──
  function hasCrossing(id1: number, id2: number): boolean {
    const r1 = connections.get(id1)
    const r2 = connections.get(id2)
    if (r1 == null || r2 == null) return false
    // 简化：如果两个左侧端口不是按顺序对应右侧端口则交叉
    // 实际上线是曲线，这里用一个简单启发式
    const r1Y = rightPorts.findIndex(p => p.id === r1)
    const r2Y = rightPorts.findIndex(p => p.id === r2)
    return (id1 < id2 && r1Y > r2Y) || (id1 > id2 && r1Y < r2Y)
  }

  const H = 44 * wires + 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {/* HUD */}
      {started && !submitted && (
        <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: 'monospace' }}>
          <span style={{ color: timeLeft <= 5 ? '#d98f72' : '#d7bd73' }}>时间 {timeLeft}s</span>
          <span style={{ color: '#8fae78' }}>已连 {connections.size}/{wires}</span>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ position: 'relative', width: 340, height: H, cursor: dragging !== null ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
      >
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {[...connections.entries()].map(([leftId, rightId]) => {
            const lEl = leftRefs.current[leftId]
            const rEl = rightRefs.current[rightPorts.findIndex((p) => p.id === rightId)]
            const lc = getPortCenter(lEl)
            const rc = getPortCenter(rEl)
            const correct = leftId === rightId

            // 提交后显示正确/错误
            let color: string
            let opacity: number
            if (submitted) {
              color = correct ? '#8fae78' : '#d98f72'
              opacity = 1
            } else {
              // 交叉检测
              const crosses = [...connections.keys()].some(otherId =>
                otherId !== leftId && hasCrossing(leftId, otherId)
              )
              color = crosses ? '#d98f72' : WIRE_COLORS[leftId % WIRE_COLORS.length]
              opacity = 0.85
            }

            return (
              <path
                key={`${leftId}-${rightId}`}
                d={`M ${lc.x} ${lc.y} C ${lc.x + 70} ${lc.y}, ${rc.x - 70} ${rc.y}, ${rc.x} ${rc.y}`}
                stroke={color}
                strokeWidth={2.5}
                fill="none"
                opacity={opacity}
              />
            )
          })}

          {dragging !== null && (() => {
            const lEl = leftRefs.current[dragging]
            const lc = getPortCenter(lEl)
            return (
              <path
                d={`M ${lc.x} ${lc.y} C ${lc.x + 70} ${lc.y}, ${mousePos.x - 50} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                stroke={WIRE_COLORS[dragging % WIRE_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                opacity={0.6}
              />
            )
          })()}
        </svg>

        {/* 左侧端口 */}
        <div style={{ position: 'absolute', left: 0, top: 10 }}>
          {leftPorts.map((p, i) => (
            <div
              key={p.id}
              ref={(el) => { leftRefs.current[i] = el }}
              onMouseDown={() => handleLeftDown(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: submitted ? 'default' : 'grab' }}
            >
              <div style={{
                width: 36, height: 30, borderRadius: 5,
                background: WIRE_COLORS[p.id % WIRE_COLORS.length] + '28',
                border: `1px solid ${WIRE_COLORS[p.id % WIRE_COLORS.length]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: WIRE_COLORS[p.id % WIRE_COLORS.length],
                fontFamily: 'monospace',
              }}>
                {p.label}
              </div>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: WIRE_COLORS[p.id % WIRE_COLORS.length],
              }} />
            </div>
          ))}
        </div>

        {/* 右侧端口 */}
        <div style={{ position: 'absolute', right: 0, top: 10 }}>
          {rightPorts.map((p, i) => (
            <div
              key={p.id}
              ref={(el) => { rightRefs.current[i] = el }}
              onMouseUp={() => handleRightUp(p.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'flex-end',
                cursor: submitted ? 'default' : 'crosshair' }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#8b7355',
              }} />
              <div style={{
                width: 36, height: 30, borderRadius: 5,
                background: 'rgba(139,115,85,0.15)',
                border: '1px solid #8b7355',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#8b7355', fontFamily: 'monospace',
              }}>
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!started && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setStarted(true)}
          style={{
            padding: '10px 32px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 8,
            color: '#d7bd73', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
          }}
        >
          🔌 开始接线
        </motion.button>
      )}

      {started && !submitted && connections.size === wires && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={submit}
          style={{
            padding: '8px 28px', background: 'rgba(143,174,120,0.1)',
            border: '1px solid rgba(143,174,120,0.3)', borderRadius: 6,
            color: '#8fae78', cursor: 'pointer', fontSize: 13, fontFamily: 'monospace',
          }}
        >
          确认连线
        </motion.button>
      )}

      {started && !submitted && connections.size < wires && (
        <div style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace' }}>
          从左侧彩色端口拖到右侧对应端口
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
              <div style={{ fontSize: 28 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8fae78' }}>接线正确</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d98f72' }}>
                {timeLeft <= 0 ? '时间耗尽' : '连接错误'}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
