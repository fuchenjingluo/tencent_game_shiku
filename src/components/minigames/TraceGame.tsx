// ────────────────────────────────────────────────────────────────────────────
// 小游戏：trace — 路径描摹
// 在规定时间内用鼠标/触摸沿高亮路径描摹，成功率取决于精度
// ────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useCallback } from 'react'

interface TraceGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

export function TraceGame({ difficulty, prompt, onComplete }: TraceGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(difficulty === 1 ? 8 : difficulty === 2 ? 6 : 5)
  const pathRef = useRef<{ x: number; y: number }[]>([])
  const tracedRef = useRef<{ x: number; y: number }[]>([])
  const isDrawing = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const generatePath = useCallback((w: number, h: number, diff: number): { x: number; y: number }[] => {
    const pts: { x: number; y: number }[] = []
    const segments = 6 + diff * 2
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      pts.push({
        x: 40 + (w - 80) * t + (Math.sin(t * Math.PI * 2 * (diff + 1)) * (20 + diff * 10)),
        y: h / 2 + Math.sin(t * Math.PI * (diff + 1)) * (40 + diff * 15),
      })
    }
    return pts
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    pathRef.current = generatePath(canvas.width, canvas.height, difficulty)
    drawPath(ctx, pathRef.current, canvas.width, canvas.height)
  }, [difficulty, generatePath])

  function drawPath(ctx: CanvasRenderingContext2D, path: { x: number; y: number }[], w: number, h: number) {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#12110d'
    ctx.fillRect(0, 0, w, h)

    // 目标路径
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
    ctx.strokeStyle = 'rgba(215,189,115,0.5)'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 核心线
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
    ctx.strokeStyle = '#d7bd73'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // 起终点
    ctx.fillStyle = '#8fae78'
    ctx.beginPath()
    ctx.arc(path[0].x, path[0].y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d98f72'
    ctx.beginPath()
    ctx.arc(path[path.length - 1].x, path[path.length - 1].y, 8, 0, Math.PI * 2)
    ctx.fill()

    // 绘制描摹轨迹
    if (tracedRef.current.length > 1) {
      ctx.beginPath()
      ctx.moveTo(tracedRef.current[0].x, tracedRef.current[0].y)
      for (let i = 1; i < tracedRef.current.length; i++) {
        ctx.lineTo(tracedRef.current[i].x, tracedRef.current[i].y)
      }
      ctx.strokeStyle = '#8fae78'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function calcScore() {
    const path = pathRef.current
    const traced = tracedRef.current
    if (traced.length < 5) return 0

    let hits = 0
    const threshold = 18
    traced.forEach((pt) => {
      // 找路径上最近点
      for (let i = 0; i < path.length - 1; i++) {
        const dx = path[i + 1].x - path[i].x
        const dy = path[i + 1].y - path[i].y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len === 0) continue
        const t = Math.max(0, Math.min(1, ((pt.x - path[i].x) * dx + (pt.y - path[i].y) * dy) / (len * len)))
        const nx = path[i].x + t * dx
        const ny = path[i].y + t * dy
        const dist = Math.sqrt((pt.x - nx) ** 2 + (pt.y - ny) ** 2)
        if (dist < threshold) { hits++; break }
      }
    })
    return hits / traced.length
  }

  function startGame() {
    setPhase('playing')
    tracedRef.current = []
    const total = difficulty === 1 ? 8 : difficulty === 2 ? 6 : 5
    setTimeLeft(total)
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          finishGame()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  function finishGame() {
    setPhase('done')
    const s = calcScore()
    setScore(Math.round(s * 100))
    const threshold = difficulty === 1 ? 0.5 : difficulty === 2 ? 0.6 : 0.7
    setTimeout(() => onComplete(s >= threshold), 1500)
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (phase !== 'playing') return
    isDrawing.current = true
    const pos = getPos(e)
    tracedRef.current = [pos]
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || phase !== 'playing') return
    const pos = getPos(e)
    tracedRef.current.push(pos)
    const canvas = canvasRef.current!
    drawPath(canvas.getContext('2d')!, pathRef.current, canvas.width, canvas.height)
  }
  function onMouseUp() { isDrawing.current = false }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center' }}>{prompt}</div>

      {phase !== 'idle' && (
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <span style={{ color: '#d7bd73' }}>时间：{timeLeft}s</span>
          {phase === 'done' && <span style={{ color: score >= 60 ? '#8fae78' : '#d98f72' }}>精度：{score}%</span>}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={480}
        height={200}
        style={{ border: '1px solid #3d3322', borderRadius: 6, cursor: phase === 'playing' ? 'crosshair' : 'default', maxWidth: '100%' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />

      {phase === 'idle' && (
        <button
          onClick={startGame}
          style={{
            padding: '8px 24px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 6,
            color: '#d7bd73', cursor: 'pointer', fontSize: 13,
          }}
        >
          开始描摹
        </button>
      )}
      {phase === 'done' && (
        <div style={{ color: score >= 60 ? '#8fae78' : '#d98f72', fontSize: 14, fontWeight: 600 }}>
          {score >= 60 ? '✓ 描摹成功！' : '✗ 偏差过大'}
        </div>
      )}
    </div>
  )
}
