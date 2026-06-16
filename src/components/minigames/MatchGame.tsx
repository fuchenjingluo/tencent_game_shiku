// ────────────────────────────────────────────────────────────────────────────
// 小游戏：match — 翻牌配对
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface MatchGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

const ITEMS = ['🏺', '📜', '🔮', '🗿', '💎', '🏛', '🎭', '🪨', '⚗️', '🔬']

export function MatchGame({ difficulty, prompt, onComplete }: MatchGameProps) {
  const pairs = 3 + difficulty  // 4/5/6对
  const timeLimit = difficulty === 1 ? 30 : difficulty === 2 ? 24 : 18
  const stepLimit = difficulty === 1 ? 0 : difficulty === 2 ? 12 : 14  // 0 = 无限制

  const [cards, setCards] = useState<{ id: number; symbol: string; matched: boolean; flipped: boolean }[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [success, setSuccess] = useState(false)
  const [stepsUsed, setStepsUsed] = useState(0)       // 已用步数
  const [stepsLeft, setStepsLeft] = useState(stepLimit) // 剩余步数

  useEffect(() => {
    const symbols = ITEMS.slice(0, pairs)
    const deck = [...symbols, ...symbols]
      .map((s, i) => ({ id: i, symbol: s, matched: false, flipped: false }))
      .sort(() => Math.random() - 0.5)
      .map((c, i) => ({ ...c, id: i }))
    setCards(deck)
  }, [pairs])

  // 定时器
  useEffect(() => {
    if (!started || done) return
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 1) {
          clearInterval(t)
          setDone(true)
          setSuccess(false)
          setTimeout(() => onComplete(false), 800)
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [started, done, onComplete])

  const flip = useCallback((id: number) => {
    if (!started || done) return
    const card = cards[id]
    if (card.matched || card.flipped) return
    if (selected.length >= 2) return

    const newCards = cards.map((c) => c.id === id ? { ...c, flipped: true } : c)
    setCards(newCards)
    const newSel = [...selected, id]
    setSelected(newSel)

    if (newSel.length === 2) {
      const nextSteps = stepsUsed + 1
      setStepsUsed(nextSteps)
      // 步数限制检查
      if (stepLimit > 0) {
        const remaining = stepLimit - nextSteps
        setStepsLeft(remaining)
        // 检查是否还有未配对的卡 — 如果有但步数用完 → 失败
        const unmatched = newCards.filter((c) => !c.matched).length
        if (remaining < 0 && unmatched > 2) {
          setDone(true)
          setSuccess(false)
          setTimeout(() => onComplete(false), 800)
          return
        }
      }

      const [a, b] = newSel
      if (newCards[a].symbol === newCards[b].symbol) {
        // 匹配
        setTimeout(() => {
          const matched = newCards.map((c) => newSel.includes(c.id) ? { ...c, matched: true } : c)
          setCards(matched)
          setSelected([])
          if (matched.every((c) => c.matched)) {
            setDone(true)
            setSuccess(true)
            setTimeout(() => onComplete(true), 800)
          }
        }, 400)
      } else {
        // 不匹配，翻回
        setTimeout(() => {
          setCards(newCards.map((c) => newSel.includes(c.id) ? { ...c, flipped: false } : c))
          setSelected([])
        }, 800)
      }
    }
  }, [started, done, cards, selected, onComplete, stepsUsed, stepLimit])

  const cols = pairs <= 4 ? 4 : pairs === 5 ? 5 : 6

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center' }}>{prompt}</div>

      {started && !done && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <span style={{ color: '#d7bd73' }}>时间：{timeLeft}s</span>
          <span style={{ color: '#8fae78' }}>
            已配对：{cards.filter((c) => c.matched).length / 2}/{pairs}
          </span>
          {stepLimit > 0 && (
            <span style={{ color: stepsLeft <= 3 ? '#d98f72' : '#8b7355' }}>
              步数：{stepsLeft}/{stepLimit}
            </span>
          )}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 52px)`,
        gap: 8,
      }}>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            animate={{
              rotateY: card.flipped || card.matched ? 0 : 180,
              scale: card.matched ? 0.95 : 1,
            }}
            transition={{ duration: 0.3 }}
            onClick={() => flip(card.id)}
            style={{
              width: 52, height: 52,
              borderRadius: 8,
              border: `2px solid ${card.matched ? '#8fae78' : card.flipped ? '#d7bd73' : '#3d3322'}`,
              background: card.matched
                ? 'rgba(143,174,120,0.15)'
                : card.flipped
                  ? 'rgba(215,189,115,0.1)'
                  : 'rgba(18,17,13,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: started && !done && !card.matched ? 'pointer' : 'default',
              fontSize: card.flipped || card.matched ? 24 : 20,
              userSelect: 'none',
            }}
          >
            {card.flipped || card.matched ? card.symbol : '?'}
          </motion.div>
        ))}
      </div>

      {!started && !done && (
        <button
          onClick={() => setStarted(true)}
          style={{
            padding: '8px 24px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 6,
            color: '#d7bd73', cursor: 'pointer', fontSize: 13,
          }}
        >
          开始配对
        </button>
      )}
      {done && (
        <div style={{ color: success ? '#8fae78' : '#d98f72', fontSize: 14, fontWeight: 600 }}>
          {success ? '✓ 配对完成！' : (timeLeft <= 0 ? '✗ 时间到' : '✗ 步数用完')}
        </div>
      )}
    </div>
  )
}
