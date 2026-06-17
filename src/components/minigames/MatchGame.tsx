// ────────────────────────────────────────────────────────────────────────────
// 小游戏：match v2.0 — "combo连击 + 石窟主题 + 动画升级"
// 经典翻牌配对，新增：连续配对combo倍率、石窟文物主题图标、
// 配对成功弹出特效、combo文字浮动、翻转动画优化。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MatchGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

// 石窟文物主题图标
const ITEMS = ['🏺', '📜', '🔮', '🗿', '💎', '🏛', '🎭', '🪨', '⚗️', '🔬', '🖼', '🪔']

export function MatchGame({ difficulty, prompt, onComplete }: MatchGameProps) {
  const pairs = 3 + difficulty  // 4/5/6对
  const timeLimit = difficulty === 1 ? 30 : difficulty === 2 ? 22 : 16
  const stepLimit = difficulty === 1 ? 0 : difficulty === 2 ? 14 : 16  // 0=无限

  const [cards, setCards] = useState<{ id: number; symbol: string; matched: boolean; flipped: boolean }[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [success, setSuccess] = useState(false)
  const [stepsUsed, setStepsUsed] = useState(0)
  const [stepsLeft, setStepsLeft] = useState(stepLimit)

  // Combo 系统
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [comboText, setComboText] = useState<string | null>(null)
  const [comboKey, setComboKey] = useState(0)
  const lastMatchTimeRef = useRef(0)

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
        if (v <= 1) { clearInterval(t); setDone(true); setSuccess(false); setTimeout(() => onComplete(false), 800); return 0 }
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
      if (stepLimit > 0) {
        const remaining = stepLimit - nextSteps
        setStepsLeft(remaining)
        const unmatched = newCards.filter((c) => !c.matched).length
        if (remaining < 0 && unmatched > 2) {
          setDone(true); setSuccess(false); setTimeout(() => onComplete(false), 800); return
        }
      }

      const [a, b] = newSel
      if (newCards[a].symbol === newCards[b].symbol) {
        // ── 配对成功 ──
        const now = Date.now()
        const timeSinceLast = now - lastMatchTimeRef.current
        lastMatchTimeRef.current = now

        // Combo: 3秒内连续配对 = 连击
        const newCombo = timeSinceLast < 3000 ? combo + 1 : 1
        setCombo(newCombo)
        if (newCombo > maxCombo) setMaxCombo(newCombo)

        // Combo 文字
        if (newCombo >= 5) {
          setComboText(`${newCombo}x 完美连击！`)
        } else if (newCombo >= 3) {
          setComboText(`${newCombo}x 连续配对`)
        } else if (newCombo >= 2) {
          setComboText(`连击 x${newCombo}`)
        }
        setComboKey(k => k + 1)

        setTimeout(() => {
          const matched = newCards.map((c) => newSel.includes(c.id) ? { ...c, matched: true } : c)
          setCards(matched)
          setSelected([])
          if (matched.every((c) => c.matched)) {
            setDone(true); setSuccess(true); setTimeout(() => onComplete(true), 1000)
          }
        }, 350)
      } else {
        // 不匹配 — 重置combo
        setCombo(0)
        setTimeout(() => {
          setCards(newCards.map((c) => newSel.includes(c.id) ? { ...c, flipped: false } : c))
          setSelected([])
        }, 700)
      }
    }
  }, [started, done, cards, selected, onComplete, stepsUsed, stepLimit, combo, maxCombo])

  const cols = pairs <= 4 ? 4 : pairs === 5 ? 5 : 6

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {started && !done && (
        <div style={{ display: 'flex', gap: 14, fontSize: 11, fontFamily: 'monospace', alignItems: 'center' }}>
          <span style={{ color: timeLeft <= 5 ? '#d98f72' : '#d7bd73' }}>
            时间 {timeLeft}s
          </span>
          <span style={{ color: '#8fae78' }}>
            已配 {cards.filter((c) => c.matched).length / 2}/{pairs}
          </span>
          {stepLimit > 0 && (
            <span style={{ color: stepsLeft <= 3 ? '#d98f72' : '#8b7355' }}>
              步数 {stepsLeft}/{stepLimit}
            </span>
          )}
          {combo >= 2 && (
            <motion.span
              key={`combo-hud-${combo}`}
              initial={{ scale: 1.5, color: '#f5d669' }}
              animate={{ scale: 1, color: combo >= 4 ? '#f5d669' : '#d7bd73' }}
              style={{ fontWeight: 700 }}
            >
              {combo}x
            </motion.span>
          )}
        </div>
      )}

      {/* Combo弹窗 */}
      <div style={{ position: 'relative' }}>
        <AnimatePresence>
          {comboText && (
            <motion.div
              key={`combo-${comboKey}`}
              initial={{ scale: 0.5, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: -10, opacity: 1 }}
              exit={{ scale: 1.2, y: -30, opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute', top: -8, left: '50%',
                transform: 'translateX(-50%) translateY(-100%)',
                fontSize: 13, fontWeight: 700, color: '#f5d669',
                fontFamily: 'monospace', whiteSpace: 'nowrap',
                pointerEvents: 'none', zIndex: 10,
              }}
            >
              {comboText}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 56px)`,
          gap: 8,
        }}>
          {cards.map((card) => (
            <motion.div
              key={card.id}
              whileHover={started && !done && !card.matched ? { scale: 1.08 } : {}}
              animate={{
                scale: card.matched ? 0.92 : 1,
                opacity: card.matched ? 0.7 : 1,
              }}
              onClick={() => flip(card.id)}
              style={{
                width: 56, height: 56, borderRadius: 8,
                border: card.matched
                  ? '2px solid #8fae78'
                  : card.flipped
                    ? '2px solid #d7bd73'
                    : '2px solid #3d3322',
                background: card.matched
                  ? 'rgba(143,174,120,0.12)'
                  : card.flipped
                    ? 'rgba(215,189,115,0.08)'
                    : 'rgba(18,17,13,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: started && !done && !card.matched ? 'pointer' : 'default',
                fontSize: 26, userSelect: 'none',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
            >
              {card.flipped || card.matched ? card.symbol : '?'}
            </motion.div>
          ))}
        </div>
      </div>

      {!started && !done && (
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
          🃏 开始配对
        </motion.button>
      )}

      {done && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260 }}
          style={{ textAlign: 'center' }}
        >
          {success ? (
            <>
              <div style={{ fontSize: 36 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8fae78' }}>配对完成！</div>
              {maxCombo >= 3 && (
                <div style={{ fontSize: 12, color: '#f5d669', marginTop: 2, fontFamily: 'monospace' }}>
                  最高 {maxCombo}x 连击
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 36 }}>❌</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d98f72' }}>
                {timeLeft <= 0 ? '时间到' : '步数用完'}
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
