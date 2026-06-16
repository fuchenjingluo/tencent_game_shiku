// ────────────────────────────────────────────────────────────────────────────
// 小游戏：wire — 接线连接
// 左侧端口与右侧端口一一对应连线
// ────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

interface WireGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

const WIRE_COLORS = ['#d7bd73', '#8fae78', '#d98f72', '#7ab8d9', '#a07ab8', '#d9a07a']

export function WireGame({ difficulty, prompt, onComplete }: WireGameProps) {
  const wires = 3 + difficulty  // 4/5/6根
  const [leftPorts] = useState(() =>
    Array.from({ length: wires }, (_, i) => ({ id: i, label: `A${i + 1}` }))
  )
  const [rightPorts] = useState(() =>
    Array.from({ length: wires }, (_, i) => ({ id: i, label: `B${i + 1}` }))
      .sort(() => Math.random() - 0.5)
      .map((p, i) => ({ ...p, shuffledIdx: i }))
  )
  const [connections, setConnections] = useState<Map<number, number>>(new Map()) // leftId → rightId
  const [dragging, setDragging] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef<(HTMLDivElement | null)[]>([])
  const rightRefs = useRef<(HTMLDivElement | null)[]>([])

  function getPortCenter(el: HTMLDivElement | null) {
    if (!el || !containerRef.current) return { x: 0, y: 0 }
    const container = containerRef.current.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2 - container.left,
      y: rect.top + rect.height / 2 - container.top,
    }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [dragging])

  function handleLeftDown(id: number) {
    if (submitted) return
    setDragging(id)
  }

  function handleRightUp(rightId: number) {
    if (dragging === null || submitted) return
    // 检查右侧端口是否已被占用
    const existing = [...connections.entries()].find(([, r]) => r === rightId)
    const newMap = new Map(connections)
    if (existing) newMap.delete(existing[0])
    newMap.set(dragging, rightId)
    setConnections(newMap)
    setDragging(null)
  }

  function submit() {
    // 正确连接：leftId === rightId（右侧port的实际id）
    const allCorrect = leftPorts.every((lp) => connections.get(lp.id) === lp.id)
    setSuccess(allCorrect)
    setSubmitted(true)
    setTimeout(() => onComplete(allCorrect), 1000)
  }

  const H = 40 * wires + 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center' }}>{prompt}</div>

      <div
        ref={containerRef}
        style={{ position: 'relative', width: 320, height: H, cursor: dragging !== null ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
      >
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          {/* 已连接的线 */}
          {[...connections.entries()].map(([leftId, rightId]) => {
            const lEl = leftRefs.current[leftId]
            const rEl = rightRefs.current[rightPorts.findIndex((p) => p.id === rightId)]
            const lc = getPortCenter(lEl)
            const rc = getPortCenter(rEl)
            const correct = leftId === rightId
            const color = submitted
              ? (correct ? '#8fae78' : '#d98f72')
              : WIRE_COLORS[leftId % WIRE_COLORS.length]
            return (
              <path
                key={`${leftId}-${rightId}`}
                d={`M ${lc.x} ${lc.y} C ${lc.x + 60} ${lc.y}, ${rc.x - 60} ${rc.y}, ${rc.x} ${rc.y}`}
                stroke={color}
                strokeWidth={2.5}
                fill="none"
                opacity={0.9}
              />
            )
          })}

          {/* 拖拽中的线 */}
          {dragging !== null && (() => {
            const lEl = leftRefs.current[dragging]
            const lc = getPortCenter(lEl)
            return (
              <path
                d={`M ${lc.x} ${lc.y} C ${lc.x + 60} ${lc.y}, ${mousePos.x - 40} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                stroke={WIRE_COLORS[dragging % WIRE_COLORS.length]}
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                opacity={0.7}
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
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 8,
                cursor: submitted ? 'default' : 'grab',
              }}
            >
              <div style={{
                width: 32, height: 28,
                borderRadius: 4,
                background: WIRE_COLORS[p.id % WIRE_COLORS.length] + '33',
                border: `1px solid ${WIRE_COLORS[p.id % WIRE_COLORS.length]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: WIRE_COLORS[p.id % WIRE_COLORS.length],
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
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 8,
                justifyContent: 'flex-end',
                cursor: submitted ? 'default' : 'crosshair',
              }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#8b7355',
              }} />
              <div style={{
                width: 32, height: 28,
                borderRadius: 4,
                background: 'rgba(139,115,85,0.2)',
                border: '1px solid #8b7355',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#8b7355',
                fontFamily: 'monospace',
              }}>
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!submitted && connections.size === wires && (
        <button
          onClick={submit}
          style={{
            padding: '8px 24px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 6,
            color: '#d7bd73', cursor: 'pointer', fontSize: 13,
          }}
        >
          确认连线
        </button>
      )}

      {!submitted && connections.size < wires && (
        <div style={{ fontSize: 11, color: '#5a5040' }}>从左侧端口拖动到右侧对应端口</div>
      )}

      {submitted && (
        <div style={{ color: success ? '#8fae78' : '#d98f72', fontSize: 14, fontWeight: 600 }}>
          {success ? '✓ 接线正确！' : '✗ 连接错误'}
        </div>
      )}
    </div>
  )
}
