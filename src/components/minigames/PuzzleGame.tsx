// ────────────────────────────────────────────────────────────────────────────
// 小游戏：puzzle — "石窟壁画修复拼图" (v44 — 拖拽+延迟验证)
// 从碎片盒拖拽壁画残片至修复区槽位，全部放置后一次性验证。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PuzzleGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

interface PuzzlePiece {
  id: number
  correctRow: number
  correctCol: number
}

// ── 素材映射 ──
const MURAL_IMAGES = [
  '/assets/puzzles/mural_apsaras.png',
  '/assets/puzzles/mural_buddha.png',
  '/assets/puzzles/mural_deer.png',
]

// ── 不规则碎片边缘 ── 8 种 clip-path 变体 ──
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

export function PuzzleGame({ difficulty, prompt, onComplete }: PuzzleGameProps) {
  const N = difficulty + 2
  const timeLimit = difficulty === 1 ? 90 : difficulty === 2 ? 120 : 180
  const FRAME_TILE = difficulty === 1 ? 85 : difficulty === 2 ? 70 : 56
  const BOX_TILE = difficulty === 1 ? 80 : difficulty === 2 ? 62 : 48

  // 随机选一张壁画（每次进入游戏随机）
  const [muralIdx] = useState(() => Math.floor(Math.random() * MURAL_IMAGES.length))
  const muralSrc = MURAL_IMAGES[muralIdx]

  // ── 碎片（只生成一次） ──
  const [pieces] = useState<PuzzlePiece[]>(() => {
    const arr: PuzzlePiece[] = []
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        arr.push({ id: r * N + c, correctRow: r, correctCol: c })
    return arr
  })

  const pieceById = useMemo(() => {
    const m = new Map<number, PuzzlePiece>()
    pieces.forEach(p => m.set(p.id, p))
    return m
  }, [pieces])

  // ── 盒子显示顺序（随机打乱一次） ──
  const [boxOrder] = useState<number[]>(() => {
    const arr = pieces.map(p => p.id)
    return arr.sort(() => Math.random() - 0.5)
  })

  // ── 状态 ──
  // 还在盒子里的碎片 id
  const [unplacedIds, setUnplacedIds] = useState<Set<number>>(() => new Set(pieces.map(p => p.id)))
  // 修复区槽位: "row-col" → pieceId
  const [placedMap, setPlacedMap] = useState<Map<string, number>>(() => new Map())

  // 拖拽状态
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  // 计时 / 完成状态
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  // 验证结果: slot key → 'correct' | 'wrong'
  const [results, setResults] = useState<Map<string, 'correct' | 'wrong'>>(() => new Map())

  // ref 防闭包过期
  const placedMapRef = useRef(placedMap)
  placedMapRef.current = placedMap
  const doneRef = useRef(done)
  doneRef.current = done
  const evaluatingRef = useRef(evaluating)
  evaluatingRef.current = evaluating

  const placedCount = placedMap.size

  // ── 开始计时 ──
  function ensureStarted() {
    if (!started) setStarted(true)
  }

  // ── 计时器 ──
  useEffect(() => {
    if (!started || doneRef.current) return
    if (timeLeft <= 0) {
      setDone(true)
      return
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(id)
  }, [timeLeft, started])

  // ── 时间耗尽时验证 ──
  useEffect(() => {
    if (done && !evaluatingRef.current) {
      evaluateAll()
    }
  }, [done])

  // ── 所有槽位填满时自动提交 ──
  useEffect(() => {
    if (placedCount === N * N && placedCount > 0 && !doneRef.current && !evaluatingRef.current) {
      const id = setTimeout(() => {
        setDone(true)
      }, 800)
      return () => clearTimeout(id)
    }
  }, [placedCount, N])

  // ── 统一验证 ──
  function evaluateAll() {
    setEvaluating(true)
    const currentPlacedMap = placedMapRef.current
    const res = new Map<string, 'correct' | 'wrong'>()

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const key = `${r}-${c}`
        const pieceId = currentPlacedMap.get(key)
        if (pieceId !== undefined) {
          const piece = pieceById.get(pieceId)
          res.set(key, piece && piece.correctRow === r && piece.correctCol === c ? 'correct' : 'wrong')
        }
      }
    }
    setResults(res)

    const allCorrect = Array.from(res.values()).every(v => v === 'correct')
    setTimeout(() => onComplete(allCorrect), 1800)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 拖拽处理器
  // ══════════════════════════════════════════════════════════════════════════

  // ── 从盒子拖拽碎片 ──
  const handleBoxDragStart = useCallback((e: React.DragEvent, pieceId: number) => {
    ensureStarted()
    if (doneRef.current) { e.preventDefault(); return }
    setDraggedId(pieceId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(pieceId))
  }, [started])

  // ── 从修复区槽位拖拽（退回盒子） ──
  const handleFrameDragStart = useCallback((e: React.DragEvent, row: number, col: number) => {
    ensureStarted()
    if (doneRef.current) { e.preventDefault(); return }
    const key = `${row}-${col}`
    const pieceId = placedMap.get(key)
    if (pieceId === undefined) { e.preventDefault(); return }

    setDraggedId(pieceId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(pieceId))

    // 立刻从修复区移除
    setPlacedMap(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
    setUnplacedIds(prev => {
      const next = new Set(prev)
      next.add(pieceId)
      return next
    })
  }, [placedMap, started])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverKey(null)
  }, [])

  // ── 槽位：允许拖放 ──
  const handleSlotDragOver = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault()
    if (doneRef.current) return
    const key = `${row}-${col}`
    if (dragOverKey !== key) setDragOverKey(key)
    e.dataTransfer.dropEffect = 'move'
  }, [dragOverKey])

  const handleSlotDragLeave = useCallback(() => {
    setDragOverKey(null)
  }, [])

  // ── 槽位：接收拖放的碎片 ──
  const handleSlotDrop = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault()
    if (doneRef.current) return
    const pieceId = Number(e.dataTransfer.getData('text/plain'))
    if (isNaN(pieceId)) return

    const key = `${row}-${col}`
    setPlacedMap(prev => {
      const next = new Map(prev)
      const existingId = next.get(key)
      next.set(key, pieceId)
      // 如果目标槽已有碎片，退回盒子
      if (existingId !== undefined) {
        setUnplacedIds(up => { const s = new Set(up); s.add(existingId); return s })
      }
      return next
    })
    // 从盒子移除该碎片
    setUnplacedIds(prev => {
      const next = new Set(prev)
      next.delete(pieceId)
      return next
    })

    setDraggedId(null)
    setDragOverKey(null)
  }, [])

  // ── 点击已放置碎片退回盒子 ──
  const handleSlotClick = useCallback((row: number, col: number) => {
    if (doneRef.current) return
    const key = `${row}-${col}`
    const pieceId = placedMap.get(key)
    if (pieceId === undefined) return

    setPlacedMap(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
    setUnplacedIds(prev => {
      const next = new Set(prev)
      next.add(pieceId)
      return next
    })
  }, [placedMap])

  // ══════════════════════════════════════════════════════════════════════════
  // 渲染辅助
  // ══════════════════════════════════════════════════════════════════════════

  const getBgStyle = useCallback((correctRow: number, correctCol: number, tileSize: number): React.CSSProperties => ({
    backgroundImage: `url(${muralSrc})`,
    backgroundSize: `${N * tileSize}px ${N * tileSize}px`,
    backgroundPosition: `-${correctCol * tileSize}px -${correctRow * tileSize}px`,
  }), [muralSrc, N])

  const getClipPath = useCallback((id: number) => CLIP_PATHS[id % CLIP_PATHS.length], [])

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── 结果颜色 ──
  const resultBorderColor = (result: 'correct' | 'wrong' | undefined) => {
    if (result === 'correct') return '#8fae78'
    if (result === 'wrong') return '#d98f72'
    return undefined
  }

  // ══════════════════════════════════════════════════════════════════════════
  // JSX
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* 提示文字 */}
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 520, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {/* ════ 主体：碎片盒 + 壁画修复框 ════ */}
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
            碎片盒 {unplacedIds.size > 0 && `(${unplacedIds.size})`}
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
            minHeight: BOX_TILE + 12,
          }}>
            {unplacedIds.size === 0 && (
              <div style={{
                fontSize: 9, color: '#4a4030', fontStyle: 'italic',
                display: 'flex', alignItems: 'center',
                padding: '20px 0',
              }}>
                所有碎片已放置
              </div>
            )}
            {boxOrder.map(id => {
              if (!unplacedIds.has(id)) return null
              const piece = pieces.find(p => p.id === id)
              if (!piece) return null
              const isDragging = draggedId === id

              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => handleBoxDragStart(e, id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    width: BOX_TILE,
                    height: BOX_TILE,
                    cursor: 'grab',
                    opacity: isDragging ? 0.5 : 1,
                    clipPath: getClipPath(id),
                    filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.4))',
                    border: '1.5px solid rgba(215,189,115,0.3)',
                    borderRadius: 4,
                    transition: 'opacity 0.15s, transform 0.15s',
                    ...getBgStyle(piece.correctRow, piece.correctCol, BOX_TILE),
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* ── 右：壁画修复区 ── */}
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
            width: 100, height: 100, margin: '0 auto 10px',
            borderRadius: 4, border: '1px solid #3d3322',
            backgroundImage: `url(${muralSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.75,
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
              const slotKey = `${row}-${col}`
              const placedPieceId = placedMap.get(slotKey)
              const placedPiece = placedPieceId !== undefined ? pieceById.get(placedPieceId) : undefined
              const isDragOver = dragOverKey === slotKey && !done
              const result = results.get(slotKey)

              return (
                <motion.div
                  key={slotKey}
                  onClick={() => handleSlotClick(row, col)}
                  onDragOver={(e) => handleSlotDragOver(e, row, col)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, row, col)}
                  draggable={!!placedPiece && !done}
                  onDragStart={placedPiece && !done ? (e) => handleFrameDragStart(e, row, col) : undefined}
                  onDragEnd={handleDragEnd}
                  style={{
                    width: FRAME_TILE,
                    height: FRAME_TILE,
                    border: result
                      ? `2.5px solid ${resultBorderColor(result)}`
                      : isDragOver
                      ? '2px solid #f5d669'
                      : placedPiece
                      ? '1.5px solid rgba(215,189,115,0.3)'
                      : '1px dashed #3d3322',
                    borderRadius: 2,
                    cursor: placedPiece && !done ? 'pointer' : 'default',
                    background: placedPiece
                      ? undefined
                      : isDragOver
                      ? 'rgba(245,214,105,0.10)'
                      : 'rgba(18,17,13,0.5)',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.25s, background 0.2s',
                    ...(placedPiece ? getBgStyle(placedPiece.correctRow, placedPiece.correctCol, FRAME_TILE) : {}),
                  }}
                >
                  {/* 放置了碎片：直接显示碎片图像（无 ✓ 标记） */}
                  {placedPiece && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      style={{
                        position: 'absolute', inset: 0,
                        clipPath: getClipPath(placedPiece.id),
                        ...getBgStyle(placedPiece.correctRow, placedPiece.correctCol, FRAME_TILE),
                      }}
                    />
                  )}

                  {/* 拖拽悬停空槽位提示 */}
                  {isDragOver && !placedPiece && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, color: 'rgba(245,214,105,0.35)',
                      pointerEvents: 'none',
                    }}>＋</div>
                  )}

                  {/* 验证结果标记（正确/错误图标） */}
                  {evaluating && result && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 * idx, type: 'spring', stiffness: 300 }}
                      style={{
                        position: 'absolute', top: 2, right: 4,
                        fontSize: 16, lineHeight: 1,
                        pointerEvents: 'none',
                        textShadow: '0 0 4px rgba(0,0,0,0.9)',
                        color: result === 'correct' ? '#8fae78' : '#d98f72',
                      }}
                    >
                      {result === 'correct' ? '✓' : '✗'}
                    </motion.div>
                  )}

                  {/* 未放置但被拖过悬浮时，提示该槽还空着 */}
                  {!placedPiece && !done && !isDragOver && placedCount > 0 && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, color: 'rgba(90,80,64,0.2)',
                      pointerEvents: 'none',
                    }}>·</div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ════ 底部状态栏 ════ */}
      <div style={{
        display: 'flex', gap: 20, alignItems: 'center',
        padding: '8px 16px', background: 'rgba(18,17,13,0.85)',
        border: '1px solid #3d3322', borderRadius: 8,
        fontSize: 11, fontFamily: 'monospace',
      }}>
        <span style={{ color: '#8b7355' }}>
          进度 <span style={{ color: '#d7bd73', fontWeight: 600 }}>{placedCount}</span>/{N * N}
        </span>
        <span style={{ color: timeLeft <= 15 ? '#d98f72' : '#8b7355' }}>
          {timeLeft <= 15 && !done ? '⏰ ' : '⏱ '}
          <span style={{
            color: timeLeft <= 15 && !done ? '#d98f72' : '#d7bd73',
            fontWeight: timeLeft <= 15 && !done ? 700 : 500,
          }}>{fmtTime(timeLeft)}</span>
        </span>
        {!started && !done && (
          <span style={{ color: '#8fae78' }}>拖拽碎片到修复区开始</span>
        )}
        {started && !done && draggedId !== null && (
          <span style={{ color: '#f5d669' }}>
            📌 拖拽中 — 松开放置碎片 #{draggedId + 1}
          </span>
        )}
        {started && !done && draggedId === null && placedCount > 0 && placedCount < N * N && (
          <span style={{ color: '#5a5040' }}>从碎片盒拖拽更多碎片</span>
        )}
        {evaluating && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: '#d7bd73', fontWeight: 600 }}
          >
            {Array.from(results.values()).every(v => v === 'correct')
              ? '修复完成！壁画完整如初'
              : '部分碎片位置有误…'}
          </motion.span>
        )}
      </div>
    </div>
  )
}
