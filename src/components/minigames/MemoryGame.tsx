// ────────────────────────────────────────────────────────────────────────────
// 小游戏：memory — 序列记忆
// 展示序列后输入，错误次数超限失败
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MemoryGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

const SYMBOLS = ['🔴', '🟡', '🟢', '🔵', '🟣', '🟠', '⚪']
const COLORS = ['#d98f72', '#d7bd73', '#8fae78', '#7ab8d9', '#a07ab8', '#d9a07a', '#aaaaaa']

export function MemoryGame({ difficulty, prompt, onComplete }: MemoryGameProps) {
  const seqLen = 4 + difficulty * 2  // 6/8/10
  const [sequence, setSequence] = useState<number[]>([])
  const [input, setInput] = useState<number[]>([])
  const [showPhase, setShowPhase] = useState<'show' | 'input' | 'done'>('show')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [errors, setErrors] = useState(0)
  const maxErrors = difficulty === 1 ? 3 : difficulty === 2 ? 2 : 1

  const btnCount = 5 + difficulty  // 6/7/8个按钮

  useEffect(() => {
    const seq = Array.from({ length: seqLen }, () => Math.floor(Math.random() * btnCount))
    setSequence(seq)
    // 逐个闪烁
    seq.forEach((idx, i) => {
      setTimeout(() => setHighlightIdx(idx), 600 + i * 700)
      setTimeout(() => setHighlightIdx(-1), 600 + i * 700 + 400)
    })
    setTimeout(() => {
      setShowPhase('input')
      setHighlightIdx(-1)
    }, 600 + seqLen * 700 + 500)
  }, [seqLen, btnCount])

  const handleClick = useCallback((idx: number) => {
    if (showPhase !== 'input') return
    const newInput = [...input, idx]
    const pos = newInput.length - 1

    if (newInput[pos] !== sequence[pos]) {
      const newErrors = errors + 1
      setErrors(newErrors)
      setHighlightIdx(-2)  // 错误闪烁
      setTimeout(() => setHighlightIdx(-1), 300)
      if (newErrors >= maxErrors) {
        setShowPhase('done')
        setTimeout(() => onComplete(false), 800)
      }
      setInput([])  // 重置输入
      return
    }

    setInput(newInput)
    if (newInput.length === sequence.length) {
      setShowPhase('done')
      setTimeout(() => onComplete(true), 800)
    }
  }, [showPhase, input, sequence, errors, maxErrors, onComplete])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center' }}>{prompt}</div>

      {/* 状态 */}
      <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
        <span style={{ color: '#d7bd73' }}>
          {showPhase === 'show' ? '👀 记住序列...' : showPhase === 'input' ? '✏️ 输入序列' : showPhase === 'done' ? '完成' : ''}
        </span>
        <span style={{ color: '#d98f72' }}>错误：{errors}/{maxErrors}</span>
        <span style={{ color: '#8fae78' }}>进度：{input.length}/{sequence.length}</span>
      </div>

      {/* 序列显示（输入阶段不显示） */}
      {showPhase === 'show' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {sequence.map((idx, i) => (
            <motion.div
              key={i}
              animate={{ scale: highlightIdx === idx ? 1.4 : 1, opacity: highlightIdx === idx ? 1 : 0.3 }}
              style={{
                width: 32, height: 32,
                borderRadius: 6,
                background: COLORS[idx] + '44',
                border: `2px solid ${COLORS[idx]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}
            >
              {SYMBOLS[idx]}
            </motion.div>
          ))}
        </div>
      )}

      {/* 已输入预览 */}
      {showPhase === 'input' && (
        <div style={{ display: 'flex', gap: 4, minHeight: 36 }}>
          {Array.from({ length: sequence.length }).map((_, i) => (
            <div key={i} style={{
              width: 28, height: 28,
              borderRadius: 4,
              border: `1px solid ${i < input.length ? COLORS[sequence[i]] : '#3d3322'}`,
              background: i < input.length ? COLORS[sequence[i]] + '33' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>
              {i < input.length ? SYMBOLS[sequence[i]] : ''}
            </div>
          ))}
        </div>
      )}

      {/* 输入按钮 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 320 }}>
        {Array.from({ length: btnCount }).map((_, idx) => (
          <motion.button
            key={idx}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={{
              borderColor: highlightIdx === idx ? COLORS[idx] : COLORS[idx] + '66',
              scale: highlightIdx === -2 ? [1, 1.1, 1] : 1,
            }}
            onClick={() => handleClick(idx)}
            disabled={showPhase !== 'input'}
            style={{
              width: 52, height: 52,
              borderRadius: 8,
              border: `2px solid ${COLORS[idx]}66`,
              background: COLORS[idx] + '22',
              cursor: showPhase === 'input' ? 'pointer' : 'default',
              fontSize: 22,
            }}
          >
            {SYMBOLS[idx]}
          </motion.button>
        ))}
      </div>

      {showPhase === 'done' && (
        <div style={{ color: errors < maxErrors ? '#8fae78' : '#d98f72', fontSize: 14, fontWeight: 600 }}>
          {errors < maxErrors ? '✓ 记忆正确！' : '✗ 错误过多'}
        </div>
      )}
    </div>
  )
}
