// ────────────────────────────────────────────────────────────────────────────
// 小游戏：memory v2.0 — "多轮渐进 + 生命值 + 节奏动画"
// 观看颜色序列闪烁 → 按键重现。3轮递进难度（每轮+2长度）。
// 3条命（心形），每轮通过后获得combo奖励展示。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MemoryGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

const SYMBOLS = ['🔴', '🟡', '🟢', '🔵', '🟣', '🟠', '⚪', '🟤']
const COLORS = ['#d98f72', '#d7bd73', '#8fae78', '#7ab8d9', '#a07ab8', '#d9a07a', '#aaaaaa', '#a08060']

function getRoundLengths(diff: number): number[] {
  // 每个难度3轮，起始长度+递增
  switch (diff) {
    case 1: return [4, 6, 8]
    case 2: return [6, 8, 10]
    case 3: return [7, 9, 11]
    default: return [4, 6, 8]
  }
}

type GamePhase = 'idle' | 'show' | 'input' | 'round-clear' | 'done'
type RoundState = 'pending' | 'perfect' | 'clear' | 'retried'

export function MemoryGame({ difficulty, prompt, onComplete }: MemoryGameProps) {
  const roundLengths = getRoundLengths(difficulty)
  const maxBtnCount = 5 + difficulty  // 6/7/8 按钮
  const livesTotal = 3

  const [phase, setPhase] = useState<GamePhase>('idle')
  const [round, setRound] = useState(0)
  const [lives, setLives] = useState(livesTotal)
  const [sequence, setSequence] = useState<number[]>([])
  const [input, setInput] = useState<number[]>([])
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [roundStates, setRoundStates] = useState<RoundState[]>([])
  const [shake, setShake] = useState(false)
  const [showCombo, setShowCombo] = useState(false)
  const [comboText, setComboText] = useState('')

  const showTimerRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const roundRef = useRef(0)
  const livesRef = useRef(livesTotal)
  const inputRef = useRef<number[]>([])

  // ── 开始新游戏 ──
  function startGame() {
    roundRef.current = 0
    livesRef.current = livesTotal
    setRound(0)
    setLives(livesTotal)
    setRoundStates([])
    setShowCombo(false)
    startShowPhase(0)
  }

  // ── 开始一轮的展示阶段 ──
  function startShowPhase(r: number) {
    const len = roundLengths[r]
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * maxBtnCount))
    setSequence(seq)
    setInput([])
    inputRef.current = []
    setPhase('show')
    setHighlightIdx(-1)

    // 逐个闪烁
    const timers: ReturnType<typeof setTimeout>[] = []
    seq.forEach((idx, i) => {
      const showTime = 500 + i * 650
      timers.push(setTimeout(() => setHighlightIdx(idx), showTime))
      timers.push(setTimeout(() => setHighlightIdx(-1), showTime + 350))
    })
    timers.push(setTimeout(() => {
      setPhase('input')
      setHighlightIdx(-1)
    }, 500 + seq.length * 650 + 400))

    showTimerRef.current = timers
  }

  // ── 处理点击 ──
  const handleClick = useCallback((idx: number) => {
    if (phase !== 'input') return

    const currentInput = [...inputRef.current, idx]
    const pos = currentInput.length - 1

    // 错误
    if (currentInput[pos] !== sequence[pos]) {
      const newLives = livesRef.current - 1
      livesRef.current = newLives
      setLives(newLives)
      setShake(true)
      setTimeout(() => setShake(false), 400)

      if (newLives <= 0) {
        // 没命了
        setPhase('done')
        setTimeout(() => onComplete(false), 1200)
        return
      }

      // 重试：重置输入
      inputRef.current = []
      setInput([])
      return
    }

    // 正确
    inputRef.current = currentInput
    setInput(currentInput)

    // 全部正确
    if (currentInput.length === sequence.length) {
      const r = roundRef.current
      const newStates = [...roundStates]
      newStates[r] = livesRef.current === livesTotal ? 'perfect' : 'clear'
      setRoundStates(newStates)

      // Combo 动画
      setComboText(newStates[r] === 'perfect' ? '完美记忆！' : '记忆正确！')
      setShowCombo(true)
      setTimeout(() => setShowCombo(false), 1500)

      if (r + 1 >= roundLengths.length) {
        // 全部完成
        setPhase('done')
        setTimeout(() => onComplete(true), 1500)
        return
      }

      setPhase('round-clear')
      setTimeout(() => {
        roundRef.current = r + 1
        setRound(r + 1)
        startShowPhase(r + 1)
      }, 1200)
    }
  }, [phase, sequence, input, roundStates, onComplete, livesTotal])

  // 键盘输入
  useEffect(() => {
    if (phase !== 'input') return
    const handler = (e: KeyboardEvent) => {
      const num = parseInt(e.key)
      if (!isNaN(num) && num >= 1 && num <= maxBtnCount) {
        handleClick(num - 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, handleClick, maxBtnCount])

  useEffect(() => {
    return () => showTimerRef.current.forEach(clearTimeout)
  }, [])

  // ── 进度指示 ──
  function ProgressBar() {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {roundLengths.map((_, i) => {
          const state = roundStates[i]
          const isCurrent = i === round && phase !== 'done'
          let bg = 'transparent'; let border = '#3d3322'; let text = `${i + 1}`
          if (state === 'perfect') { bg = 'rgba(245,214,105,0.1)'; border = '#f5d669' }
          else if (state === 'clear') { bg = 'rgba(143,174,120,0.1)'; border = '#8fae78' }
          else if (isCurrent) { bg = 'rgba(215,189,115,0.08)'; border = '#d7bd73' }

          return (
            <div key={i} style={{
              width: 26, height: 26, borderRadius: '50%',
              border: `2px solid ${border}`, background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: border === '#3d3322' ? '#5a5040' : border,
              fontFamily: 'monospace',
            }}>
              {state ? (state === 'perfect' ? '★' : '●') : text}
            </div>
          )
        })}
      </div>
    )
  }

  function LifeBar() {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: livesTotal }).map((_, i) => (
          <span key={i} style={{ fontSize: 14, opacity: i < lives ? 1 : 0.2, transition: 'opacity 0.3s' }}>
            ❤️
          </span>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {/* HUD */}
      {phase !== 'idle' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <ProgressBar />
          <LifeBar />
        </div>
      )}

      {/* 状态文本 */}
      {phase !== 'idle' && phase !== 'done' && (
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#d7bd73' }}>
          {phase === 'show' ? '👀 记住闪烁序列...' :
           phase === 'input' ? `✏️ 输入序列 (${input.length}/${sequence.length})` :
           phase === 'round-clear' ? '✅ 准备下一轮...' : ''}
        </div>
      )}

      {/* Combo弹窗 */}
      <AnimatePresence>
        {showCombo && (
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            style={{
              position: 'absolute', top: -40,
              fontSize: 14, fontWeight: 700, color: '#f5d669',
              textShadow: '0 0 8px rgba(245,214,105,0.5)',
              fontFamily: 'monospace',
            }}
          >
            {comboText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 序列展示区（show阶段） */}
      {phase === 'show' && (
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ display: 'flex', gap: 6, minHeight: 42, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {sequence.map((idx, i) => (
            <motion.div
              key={i}
              animate={{
                scale: highlightIdx === idx ? 1.35 : 1,
                borderColor: highlightIdx === idx ? COLORS[idx] : COLORS[idx] + '44',
              }}
              transition={{ duration: 0.15 }}
              style={{
                width: 34, height: 34, borderRadius: 6,
                background: COLORS[idx] + '33',
                border: `2px solid ${COLORS[idx]}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}
            >
              {SYMBOLS[idx]}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* 输入预览条（input阶段） */}
      {phase === 'input' && (
        <motion.div
          animate={shake ? { x: [0, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', gap: 4, minHeight: 36 }}
        >
          {Array.from({ length: sequence.length }).map((_, i) => (
            <div key={i} style={{
              width: 26, height: 26, borderRadius: 4,
              border: i < input.length
                ? `1px solid ${COLORS[sequence[i]]}`
                : `1px solid #3d3322`,
              background: i < input.length ? COLORS[sequence[i]] + '22' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              {i < input.length ? SYMBOLS[sequence[i]] : ''}
            </div>
          ))}
        </motion.div>
      )}

      {/* 输入按钮 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 360, position: 'relative' }}>
        {Array.from({ length: maxBtnCount }).map((_, idx) => (
          <motion.button
            key={idx}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            animate={{
              borderColor: highlightIdx === idx ? COLORS[idx] : COLORS[idx] + '55',
            }}
            onClick={() => handleClick(idx)}
            disabled={phase !== 'input'}
            style={{
              width: 48, height: 48, borderRadius: 8,
              border: `2px solid ${COLORS[idx]}55`,
              background: COLORS[idx] + '18',
              cursor: phase === 'input' ? 'pointer' : 'default',
              fontSize: 20,
              opacity: phase === 'input' ? 1 : 0.5,
            }}
          >
            {SYMBOLS[idx]}
          </motion.button>
        ))}
      </div>

      {/* 键盘提示 */}
      {phase === 'input' && (
        <div style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace' }}>
          按 <span style={{ color: '#d7bd73' }}>1-{maxBtnCount}</span> 数字键 或 点击按钮
        </div>
      )}

      {/* 开始 */}
      {phase === 'idle' && (
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={startGame}
          style={{
            padding: '10px 32px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 8,
            color: '#d7bd73', cursor: 'pointer', fontSize: 14, fontFamily: 'monospace',
          }}
        >
          🧠 开始记忆 ({roundLengths.length}轮)
        </motion.button>
      )}

      {/* 完成 */}
      {phase === 'done' && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260 }}
          style={{ textAlign: 'center' }}
        >
          {lives > 0 ? (
            <>
              <div style={{ fontSize: 36 }}>🧠</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8fae78' }}>记忆挑战完成！</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                {roundStates.map((s, i) => (
                  <span key={i} style={{ color: s === 'perfect' ? '#f5d669' : '#8fae78', fontSize: 14 }}>
                    {s === 'perfect' ? '★' : '●'}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 36 }}>💔</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d98f72' }}>记忆耗尽</div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
