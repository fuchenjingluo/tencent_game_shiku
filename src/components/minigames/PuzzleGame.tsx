// ────────────────────────────────────────────────────────────────────────────
// 小游戏：puzzle — "石窟壁画修复拼图"
// 从碎片盒选取壁画残片，拖放至壁画修复框中归位。
// 沉浸式文物修复体验：不规则碎片边缘、石窟色系、真实壁画素材。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PuzzleGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  muralIndex?: number       // 0=飞天, 1=佛说法, 2=九色鹿; default 0
  onComplete: (success: boolean) => void
}

interface PuzzlePiece {
  id: number
  correctRow: number
  correctCol: number
  placed: boolean
}

// ── 素材映射 ──
const MURAL_IMAGES = [
  '/assets/puzzles/mural_apsaras.png',
  '/assets/puzzles/mural_buddha.png',
  '/assets/puzzles/mural_deer.png',
]

// ── 不规则碎片边缘 — 8 种 clip-path 变体 ──
const CLIP_PATHS = [
  'polygon(4% 0, 96% 2%, 100% 94%, 3% 98%)',
  'polygon(0 3%, 98% 0, 96% 96%, 2% 100%)',
  'polygon(5% 0, 95% 0, 100% 95%, 0 97%)',
  'polygon(2% 4%, 100% 0, 97% 96%, 0 95%)',
  'polygon(0 0, 94% 3%, 100% 100%, 4% 96%)',
  'polygon(3% 0, 100% 4%, 98% 100%, 0 94%)',
  'polygon(0 0, 96% 0, 100% 92%, 2% 100%)',
  'polygon(6% 2%, 98% 0, 94% 98%, 0 96%)',
]

export function PuzzleGame({ difficulty, prompt, muralIndex = 0, onComplete }: PuzzleGameProps) {
  const N = difficulty + 2                  // 3 / 4 / 5
  const timeLimit = difficulty === 1 ? 90 : difficulty === 2 ? 120 : 180
  const FRAME_TILE = difficulty === 1 ? 85 : difficulty === 2 ? 70 : 56
  const BOX_TILE = difficulty === 1 ? 80 : difficulty === 2 ? 62 : 48
  const FRAME_SIZE = N * FRAME_TILE

  const muralSrc = MURAL_IMAGES[muralIndex % MURAL_IMAGES.length]

  // ── 碎片生成 ──
  const [pieces, setPieces] = useState<PuzzlePiece[]>([])
  const [boxOrder, setBoxOrder] = useState<number[]>([]) // display order in box

  useEffect(() => {
    const arr: PuzzlePiece[] = []
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        arr.push({ id: r * N + c, correctRow: r, correctCol: c, placed: false })
      }
    }
    // 随机搅乱盒子显示顺序
    const order = arr.map(p => p.id).sort(() => Math.random() - 0.5)
    setPieces(arr)
    setBoxOrder(order)
  }, [N])

  // ── 交互状态 ──
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // ── 计时器 ──
  useEffect(() => {
    if (!started || done) return
    if (timeLeft <= 0) {
      setDone(true)
      onComplete(false)
      return
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [timeLeft, started, done, onComplete])

  // ── 完成检测 ──
  useEffect(() => {
    if (correctCount === N * N && correctCount > 0) {
      setDone(true)
      onComplete(true)
    }
  }, [correctCount, N, onComplete])

  // ── 初次点击开始计时 ──
  function ensureStarted() {
    if (!started) setStarted(true)
  }

  // ── 选中碎片 ──
  const handleSelectPiece = useCallback((id: number) => {
    ensureStarted()
    const piece = pieces.find(p => p.id === id)
    if (!piece || piece.placed) return
    setSelectedId(prev => prev === id ? null : id)
  }, [pieces, started])

  // ── 点击框内槽位 ──
  const handleSlotClick = useCallback((row: number, col: number) => {
    ensureStarted()
    if (selectedId === null) return

    const piece = pieces.find(p => p.id === selectedId)
    if (!piece) return

    // 检查该槽位是否已被占据
    const alreadyPlaced = pieces.find(p => p.placed && p.correctRow === row && p.correctCol === col)
    if (alreadyPlaced) return

    if (piece.correctRow === row && piece.correctCol === col) {
      // 正确！
      setPieces(prev => prev.map(p => p.id === selectedId ? { ...p, placed: true } : p))
      setCorrectCount(c => c + 1)
      setSelectedId(null)
    } else {
      // 错误 — 抖动反馈
      setShakeId(selectedId)
      setTimeout(() => setShakeId(null), 500)
    }
  }, [selectedId, pieces, started])

  // ── 计算背景图偏移 ──
  const getBgStyle = useCallback((correctRow: number, correctCol: number, tileSize: number) => ({
    backgroundImage: `url(${muralSrc})`,
    backgroundSize: `${N * tileSize}px ${N * tileSize}px`,
    backgroundPosition: `-${correctCol * tileSize}px -${correctRow * tileSize}px`,
  }), [muralSrc, N])

  // ── 获取碎片 clip-path ──
  const getClipPath = useCallback((id: number) => CLIP_PATHS[id % CLIP_PATHS.length], [])

  // ── 槽位是否已归位 ──
  const slotFilled = useCallback((row: number, col: number) => {
    return pieces.find(p => p.placed && p.correctRow === row && p.correctCol === col) ?? null
  }, [pieces])

  // ── 格式化时间 ──
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* 提示文字 */}
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 520, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {/* ════ 主体：碎片盒 + 壁画框 ════ */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* ── 左：碎片盒 ── */}
        <div style={{
          background: 'rgba(26,22,16,0.9)',
          border: '2px solid #3d3322',
          borderRadius: 10,
          padding: 12,
          minWidth: (BOX_TILE + 8) * Math.min(N, 3),
          maxWidth: (BOX_TILE + 8) * Math.ceil(Math.sqrt(N * N)),
        }}>
          <div style={{
            fontSize: 9, color: '#5a5040', fontFamily: 'monospace',
            marginBottom: 8, textAlign: 'center',
          }}>
            碎片盒
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
          }}>
            {boxOrder.map(id => {
              const piece = pieces.find(p => p.id === id)
              if (!piece) return null
              const isSelected = selectedId === id
              const isShaking = shakeId === id

              return (
                <motion.div
                  key={id}
                  animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : isSelected ? { scale: 1.12, y: -4 } : { scale: 1, y: 0 }}
                  transition={isShaking ? { duration: 0.4 } : { duration: 0.15 }}
                  onClick={() => handleSelectPiece(id)}
                  style={{
                    width: BOX_TILE,
                    height: BOX_TILE,
                    cursor: piece.placed ? 'default' : 'pointer',
                    opacity: piece.placed ? 0.35 : 1,
                    clipPath: getClipPath(id),
                    filter: isSelected ? 'drop-shadow(0 0 8px rgba(245,214,105,0.6))' : 'drop-shadow(2px 2px 3px rgba(0,0,0,0.4))',
                    border: isSelected ? '2px solid #f5d669' : '1.5px solid rgba(215,189,115,0.3)',
                    borderRadius: 4,
                    position: 'relative',
                    transition: 'opacity 0.3s',
                    ...getBgStyle(piece.correctRow, piece.correctCol, BOX_TILE),
                  }}
                >
                  {piece.placed && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.5)', borderRadius: 4,
                      fontSize: 18, color: '#8fae78',
                    }}>✓</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* ── 右：壁画修复框 ── */}
        <div style={{
          background: 'rgba(26,22,16,0.9)',
          border: '2px solid #3d3322',
          borderRadius: 10,
          padding: 12,
        }}>
          <div style={{
            fontSize: 9, color: '#5a5040', fontFamily: 'monospace',
            marginBottom: 8, textAlign: 'center',
          }}>
            壁画修复区
          </div>
          {/* 参考缩略图 */}
          <div style={{
            width: 120, height: 120, margin: '0 auto 10px',
            borderRadius: 4, border: '1px solid #3d3322',
            backgroundImage: `url(${muralSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.8,
          }} />
          {/* 槽位网格 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${N}, ${FRAME_TILE}px)`,
            gridTemplateRows: `repeat(${N}, ${FRAME_TILE}px)`,
            gap: 2,
            background: '#1a1610',
            border: '2px solid #5a5040',
            borderRadius: 4,
            padding: 2,
          }}>
            {Array.from({ length: N * N }).map((_, idx) => {
              const row = Math.floor(idx / N)
              const col = idx % N
              const filled = slotFilled(row, col)

              return (
                <motion.div
                  key={`${row}-${col}`}
                  onClick={() => handleSlotClick(row, col)}
                  whileHover={selectedId !== null && !filled ? { background: 'rgba(245,214,105,0.08)' } : {}}
                  style={{
                    width: FRAME_TILE,
                    height: FRAME_TILE,
                    border: filled ? '2px solid #8fae78' : '1px dashed #3d3322',
                    borderRadius: 2,
                    cursor: selectedId !== null && !filled ? 'pointer' : 'default',
                    background: filled ? undefined : 'rgba(18,17,13,0.5)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.3s',
                    ...(filled ? getBgStyle(row, col, FRAME_TILE) : {}),
                  }}
                >
                  {filled && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                      style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <div style={{
                        fontSize: 12, color: '#8fae78',
                        textShadow: '0 0 4px rgba(0,0,0,0.8)',
                        fontWeight: 700,
                      }}>✓</div>
                    </motion.div>
                  )}
                  {selectedId !== null && !filled && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, color: 'rgba(245,214,105,0.3)',
                    }}>+</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ════ 底部状态栏 ════ */}
      <div style={{
        display: 'flex', gap: 24, alignItems: 'center',
        padding: '8px 16px', background: 'rgba(18,17,13,0.8)',
        border: '1px solid #3d3322', borderRadius: 8,
        fontSize: 11, fontFamily: 'monospace',
      }}>
        <span style={{ color: '#8b7355' }}>
          进度 <span style={{ color: '#d7bd73', fontWeight: 600 }}>{correctCount}</span>/{N * N}
        </span>
        <span style={{ color: timeLeft <= 15 ? '#d98f72' : '#8b7355' }}>
          {timeLeft <= 15 ? '⏰ ' : '⏱ '}
          <span style={{
            color: timeLeft <= 15 ? '#d98f72' : '#d7bd73',
            fontWeight: timeLeft <= 15 ? 700 : 500,
          }}>{fmtTime(timeLeft)}</span>
        </span>
        {selectedId !== null && (
          <span style={{ color: '#f5d669' }}>
            📌 已选中碎片 #{selectedId + 1} — 点击壁画空位放置
          </span>
        )}
        {selectedId === null && correctCount < N * N && started && (
          <span style={{ color: '#5a5040' }}>从碎片盒中选择一块碎片</span>
        )}
        {!started && (
          <span style={{ color: '#8fae78' }}>点击碎片开始修复</span>
        )}
      </div>
    </div>
  )
}
