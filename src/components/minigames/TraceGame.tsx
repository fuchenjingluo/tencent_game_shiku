// ────────────────────────────────────────────────────────────────────────────
// 小游戏：trace v2.0 — "动态路径 + 方向感知 + 收集点 + 评分分级"
// 用鼠标沿随机生成的曲线路径描摹。检测方向（倒退扣分）、沿路收集点奖励、
// 最终根据精度+流畅度+收集给出三级评分（青铜/白银/黄金）。
// ────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TraceGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

interface Vec2 { x: number; y: number }

// ── Perlin-like noise for varied paths ──
function hash2d(seed: number, x: number, y: number) {
  let h = seed + x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return (h ^ (h >> 16)) / 2147483648
}

function smoothNoise(seed: number, x: number, y: number) {
  const ix = Math.floor(x); const fx = x - ix
  const iy = Math.floor(y); const fy = y - iy
  const v00 = hash2d(seed, ix, iy)
  const v10 = hash2d(seed, ix + 1, iy)
  const v01 = hash2d(seed, ix, iy + 1)
  const v11 = hash2d(seed, ix + 1, iy + 1)
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  return v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) + v01 * (1 - sx) * sy + v11 * sx * sy
}

function generatePath(w: number, h: number, diff: number): { path: Vec2[]; collectibles: Vec2[] } {
  const seed = Math.floor(Math.random() * 99999)
  const segments = 12 + diff * 4        // 16 / 20 / 24
  const noiseScale = 0.08 + diff * 0.02  // 噪声频率
  const amplitude = 35 + diff * 18       // 振幅 (越高越曲折)
  const path: Vec2[] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const baseX = 40 + (w - 80) * t
    const baseY = h / 2
    const offsetY = smoothNoise(seed, t * 6, 0) * amplitude * 2 - amplitude
    // 加一些水平波动
    const offsetX = smoothNoise(seed, t * 6, 10) * amplitude * 0.4
    path.push({
      x: Math.min(w - 40, Math.max(40, baseX + offsetX)),
      y: Math.min(h - 30, Math.max(30, baseY + offsetY)),
    })
  }

  // 沿路放置收集点（3-5个）
  const collectCount = 2 + diff
  const collectibles: Vec2[] = []
  for (let ci = 0; ci < collectCount; ci++) {
    const t = 0.15 + (ci / (collectCount - 1)) * 0.7
    const idx = t * segments
    const i0 = Math.floor(idx)
    const i1 = Math.min(i0 + 1, segments)
    const frac = idx - i0
    collectibles.push({
      x: path[i0].x + (path[i1].x - path[i0].x) * frac,
      y: path[i0].y + (path[i1].y - path[i0].y) * frac,
    })
  }

  return { path, collectibles }
}

export function TraceGame({ difficulty, prompt, onComplete }: TraceGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result'>('idle')
  const [timeLeft, setTimeLeft] = useState(0)
  const [score, setScore] = useState<{ accuracy: number; smoothness: number; collected: number; total: number; rating: string } | null>(null)

  const pathRef = useRef<Vec2[]>([])
  const collectiblesRef = useRef<{ pos: Vec2; collected: boolean }[]>([])
  const tracedRef = useRef<Vec2[]>([])
  const isDrawing = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)
  const totalTime = difficulty === 1 ? 10 : difficulty === 2 ? 8 : 6

  // 初始化画布
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { path, collectibles } = generatePath(canvas.width, canvas.height, difficulty)
    pathRef.current = path
    collectiblesRef.current = collectibles.map(p => ({ pos: p, collected: false }))
    drawAll(ctx)
  }, [difficulty])

  function drawAll(ctx: CanvasRenderingContext2D) {
    const w = ctx.canvas.width; const h = ctx.canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#12110d'
    ctx.fillRect(0, 0, w, h)

    const path = pathRef.current

    // 引导带（宽半透明带）
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
    ctx.strokeStyle = 'rgba(215,189,115,0.25)'
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 虚线中心线
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
    ctx.strokeStyle = 'rgba(215,189,115,0.55)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.stroke()
    ctx.setLineDash([])

    // 收集点
    collectiblesRef.current.forEach(c => {
      if (c.collected) {
        ctx.fillStyle = 'rgba(143,174,120,0.6)'
        ctx.strokeStyle = '#8fae78'
      } else {
        ctx.fillStyle = 'rgba(245,214,105,0.35)'
        ctx.strokeStyle = 'rgba(245,214,105,0.7)'
      }
      ctx.beginPath()
      ctx.arc(c.pos.x, c.pos.y, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // 脉冲环
      if (!c.collected) {
        ctx.strokeStyle = 'rgba(245,214,105,0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(c.pos.x, c.pos.y, 10, 0, Math.PI * 2)
        ctx.stroke()
      }
    })

    // 起终点标记
    ctx.fillStyle = '#8fae78'; ctx.beginPath(); ctx.arc(path[0].x, path[0].y, 7, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#d98f72'; ctx.beginPath(); ctx.arc(path[path.length - 1].x, path[path.length - 1].y, 7, 0, Math.PI * 2); ctx.fill()

    // 玩家描摹轨迹
    const traced = tracedRef.current
    if (traced.length > 1) {
      ctx.beginPath()
      ctx.moveTo(traced[0].x, traced[0].y)
      for (let i = 1; i < traced.length; i++) ctx.lineTo(traced[i].x, traced[i].y)
      ctx.strokeStyle = '#8fae78'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
  }

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Vec2 {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  // ── 计算分数 ──
  function calcScores() {
    const path = pathRef.current
    const traced = tracedRef.current
    if (traced.length < 3) return { accuracy: 0, smoothness: 0, collected: 0, total: collectiblesRef.current.length, rating: 'fail' as const }

    // 1. 精度：每个描摹点与路径的最短距离
    let totalDist = 0
    traced.forEach(pt => {
      let minD = Infinity
      for (let i = 0; i < path.length - 1; i++) {
        const dx = path[i + 1].x - path[i].x
        const dy = path[i + 1].y - path[i].y
        const len = dx * dx + dy * dy
        if (len === 0) continue
        const t = Math.max(0, Math.min(1, ((pt.x - path[i].x) * dx + (pt.y - path[i].y) * dy) / len))
        const nx = path[i].x + t * dx; const ny = path[i].y + t * dy
        const d = (pt.x - nx) ** 2 + (pt.y - ny) ** 2
        if (d < minD) minD = d
      }
      totalDist += Math.sqrt(minD)
    })
    const avgDist = totalDist / traced.length
    // 阈值: 10px内=高分, 20px=合格, >25px=偏差
    const accuracy = Math.max(0, 1 - avgDist / 25)

    // 2. 流畅度：相邻描摹点的角度变化
    let totalAngle = 0
    for (let i = 1; i < traced.length - 1; i++) {
      const dx1 = traced[i].x - traced[i - 1].x; const dy1 = traced[i].y - traced[i - 1].y
      const dx2 = traced[i + 1].x - traced[i].x; const dy2 = traced[i + 1].y - traced[i].y
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
      if (len1 > 0 && len2 > 0) {
        const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2)
        totalAngle += Math.acos(Math.max(-1, Math.min(1, dot)))
      }
    }
    const avgAngle = traced.length > 2 ? totalAngle / (traced.length - 2) : 0
    const smoothness = Math.max(0, 1 - avgAngle / Math.PI)

    // 3. 收集点
    const collected = collectiblesRef.current.filter(c => c.collected).length

    // 4. 评级
    const composite = accuracy * 0.5 + smoothness * 0.3 + (collected / collectiblesRef.current.length) * 0.2
    let rating: string
    if (composite >= 0.75) rating = 'gold'
    else if (composite >= 0.55) rating = 'silver'
    else if (composite >= 0.35) rating = 'bronze'
    else rating = 'fail'

    return { accuracy, smoothness, collected, total: collectiblesRef.current.length, rating }
  }

  // ── 收集点检测 ──
  function checkCollectibles(pos: Vec2) {
    let changed = false
    collectiblesRef.current.forEach(c => {
      if (!c.collected && Math.hypot(pos.x - c.pos.x, pos.y - c.pos.y) < 14) {
        c.collected = true
        changed = true
      }
    })
    return changed
  }

  // ── 输入 ──
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (phase !== 'playing') return
    isDrawing.current = true
    const pos = getPos(e)
    tracedRef.current = [pos]
    checkCollectibles(pos)
    const canvas = canvasRef.current!
    drawAll(canvas.getContext('2d')!)
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || phase !== 'playing') return
    const pos = getPos(e)
    tracedRef.current.push(pos)
    if (checkCollectibles(pos)) {
      // 收集特效 — 不需要额外绘制，下一帧 drawAll 会更新
    }
    const canvas = canvasRef.current!
    drawAll(canvas.getContext('2d')!)
  }

  function onMouseUp() { isDrawing.current = false }

  function startGame() {
    setPhase('playing')
    setTimeLeft(totalTime)
    tracedRef.current = []
    collectiblesRef.current.forEach(c => c.collected = false)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); finishGame(); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function finishGame() {
    setPhase('result')
    const s = calcScores()
    setScore(s)
    const success = s.rating !== 'fail'
    setTimeout(() => onComplete(success), 1800)
  }

  function getRatingStyle(rating: string) {
    switch (rating) {
      case 'gold': return { emoji: '🥇', label: '黄金精度', color: '#f5d669', bgRgba: 'rgba(245,214,105,0.12)' }
      case 'silver': return { emoji: '🥈', label: '白银精度', color: '#b4b2a9', bgRgba: 'rgba(180,178,169,0.12)' }
      case 'bronze': return { emoji: '🥉', label: '青铜精度', color: '#d9a063', bgRgba: 'rgba(217,160,99,0.12)' }
      default: return { emoji: '❌', label: '描摹失败', color: '#d98f72', bgRgba: 'rgba(217,143,114,0.12)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {/* HUD */}
      {phase !== 'idle' && (
        <div style={{ display: 'flex', gap: 18, fontSize: 12, fontFamily: 'monospace' }}>
          <span style={{ color: timeLeft <= 3 ? '#d98f72' : '#d7bd73' }}>时间 {timeLeft}s</span>
          {phase === 'playing' && (
            <span style={{ color: '#f5d669' }}>
              收集 {collectiblesRef.current.filter(c => c.collected).length}/{collectiblesRef.current.length}
            </span>
          )}
        </div>
      )}

      {/* 画布 */}
      <canvas
        ref={canvasRef}
        width={480}
        height={220}
        style={{
          border: '1px solid #3d3322', borderRadius: 6,
          cursor: phase === 'playing' ? 'crosshair' : 'default',
          maxWidth: '100%',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />

      {/* 开始按钮 */}
      {phase === 'idle' && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={startGame}
          style={{
            padding: '10px 28px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 8,
            color: '#d7bd73', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
          }}
        >
          ✏️ 开始描摹
        </motion.button>
      )}

      {/* 操作提示 */}
      {phase === 'playing' && (
        <div style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace' }}>
          按住鼠标沿虚线描摹 · 收集 <span style={{ color: '#f5d669' }}>金色光点</span> · 保持流畅稳定
        </div>
      )}

      {/* 结果 */}
      <AnimatePresence>
        {phase === 'result' && score && (() => {
          const rs = getRatingStyle(score.rating)
          return (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              style={{
                textAlign: 'center', padding: '16px 24px',
                background: rs.bgRgba, borderRadius: 10,
                border: `1px solid ${rs.color}44`,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 4 }}>{rs.emoji}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: rs.color, marginBottom: 8 }}>
                {rs.label}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: 'monospace', justifyContent: 'center' }}>
                <div>
                  <div style={{ color: '#5a5040' }}>精度</div>
                  <div style={{ color: '#d7bd73' }}>{Math.round(score.accuracy * 100)}%</div>
                </div>
                <div>
                  <div style={{ color: '#5a5040' }}>流畅</div>
                  <div style={{ color: '#8fae78' }}>{Math.round(score.smoothness * 100)}%</div>
                </div>
                <div>
                  <div style={{ color: '#5a5040' }}>收集</div>
                  <div style={{ color: '#f5d669' }}>{score.collected}/{score.total}</div>
                </div>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
