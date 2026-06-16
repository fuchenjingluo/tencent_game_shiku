// ────────────────────────────────────────────────────────────────────────────
// 挑战模式选择器 — 速通 / 铁人 / 每日巡检 / 混沌
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CHALLENGE_MODES, getSpeedrunLeaderboard, formatSpeedrunTime, getSpeedrunGrade } from '../../data/challengeModes'
import type { ChallengeMode, ChallengeConfig } from '../../types'

interface ChallengeSelectorProps {
  onSelect: (mode: ChallengeMode) => void
  onBack: () => void
  playthroughCount: number
}

export function ChallengeSelector({ onSelect, onBack, playthroughCount }: ChallengeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<ChallengeMode | null>(null)
  const [confirming, setConfirming] = useState(false)

  // 速通排行榜预览
  const lb = getSpeedrunLeaderboard()

  useEffect(() => {
    if (selectedMode) {
      setConfirming(true)
      const t = setTimeout(() => setConfirming(false), 3000)
      return () => clearTimeout(t)
    }
  }, [selectedMode])

  const handleConfirm = () => {
    if (selectedMode) onSelect(selectedMode)
  }

  const handleSelect = (mode: ChallengeMode) => {
    const config = CHALLENGE_MODES.find((c) => c.id === mode)!
    if (config.requiresPlaythrough && playthroughCount === 0) return
    setSelectedMode(mode === selectedMode ? null : mode)
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 510,
      background: 'rgba(12,11,9,0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'all',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: 540, maxWidth: '94vw', textAlign: 'center' }}
      >
        {/* 标题 */}
        <div style={{ fontSize: 22, color: '#d7bd73', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>
          挑战模式
        </div>
        <div style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace', marginBottom: 24 }}>
          选择一种规则变化，测试你的石窟守护能力
        </div>

        {/* 模式卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {CHALLENGE_MODES.map((mode, i) => {
            const locked = mode.requiresPlaythrough && playthroughCount === 0
            const isSelected = selectedMode === mode.id

            return (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: locked ? 0.4 : 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                whileHover={locked ? {} : { scale: 1.03, borderColor: mode.color + '88' }}
                whileTap={locked ? {} : { scale: 0.97 }}
                onClick={() => !locked && handleSelect(mode.id)}
                disabled={locked}
                style={{
                  padding: '14px 12px',
                  background: isSelected ? `${mode.color}10` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isSelected ? mode.color + '66' : 'rgba(61,51,34,0.6)'}`,
                  borderRadius: 10,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.2s',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: mode.color }}>{mode.title}</span>
                  {locked && (
                    <span style={{ fontSize: 8, color: '#5a5040', fontFamily: 'monospace' }}>
                      🔒 通关后解锁
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 9, color: '#5a5040', fontFamily: 'monospace', marginBottom: 6 }}>
                  {mode.subtitle}
                </div>
                <div style={{ fontSize: 11, color: '#8b7355', lineHeight: 1.5 }}>
                  {mode.description}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* 速通记录 */}
        {lb.bestTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: 14, padding: '8px 14px',
              background: 'rgba(122,184,217,0.04)',
              border: '1px solid rgba(122,184,217,0.15)',
              borderRadius: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace' }}>
              ⏱ 速通最佳记录
            </span>
            <span style={{ fontSize: 11, color: '#7ab8d9', fontFamily: 'monospace', fontWeight: 600 }}>
              {formatSpeedrunTime(lb.bestTime.timeMs)}
            </span>
            <span style={{ fontSize: 10, color: getSpeedrunGrade(lb.bestTime.timeMs).color }}>
              {getSpeedrunGrade(lb.bestTime.timeMs).label}
            </span>
          </motion.div>
        )}

        {/* 确认/返回按钮 */}
        <AnimatePresence>
          {confirming && selectedMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginTop: 16, overflow: 'hidden' }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirm}
                style={{
                  padding: '12px 36px',
                  background: `${CHALLENGE_MODE_MAP[selectedMode]?.color ?? '#d7bd73'}15`,
                  border: `1px solid ${CHALLENGE_MODE_MAP[selectedMode]?.color ?? '#d7bd73'}55`,
                  borderRadius: 8,
                  color: CHALLENGE_MODE_MAP[selectedMode]?.color ?? '#d7bd73',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                }}
              >
                开始{CHALLENGE_MODE_MAP[selectedMode]?.title.slice(2) ?? ''}
              </motion.button>
              <div style={{ fontSize: 9, color: '#3d3322', marginTop: 6, fontFamily: 'monospace' }}>
                再次点击取消选择
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 返回 */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={onBack}
          style={{
            marginTop: 18,
            padding: '8px 24px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            color: '#5a5040',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          返回标题
        </motion.button>
      </motion.div>
    </div>
  )
}

// 本地查找表
const CHALLENGE_MODE_MAP = Object.fromEntries(
  CHALLENGE_MODES.map((c) => [c.id, c])
) as Record<ChallengeMode, ChallengeConfig>
