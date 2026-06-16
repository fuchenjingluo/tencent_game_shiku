// ────────────────────────────────────────────────────────────────────────────
// 加载/标题画面
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameSave, AchievementState, ChallengeMode } from '../types'
import { loadSave } from '../hooks/useSave'
import { ChallengeSelector } from './ui/ChallengeSelector'

interface TitleScreenProps {
  onStart: (save: GameSave | null) => void
  onAchievements?: () => void
  achievementProgress?: AchievementState
  onChallengeMode?: (mode: ChallengeMode) => void
  playthroughCount?: number
}

export function TitleScreen({ onStart, onAchievements, achievementProgress, onChallengeMode, playthroughCount = 0 }: TitleScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'title' | 'challenge'>('logo')
  const [existingSave, setExistingSave] = useState<GameSave | null>(null)

  useEffect(() => {
    setExistingSave(loadSave())
    setTimeout(() => setPhase('title'), 2000)
  }, [])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 500,
      background: '#12110d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'all',
    }}>
      <AnimatePresence mode="wait">
        {phase === 'logo' && (
          <motion.div
            key="logo"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: 'center' }}
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: 1 }}
              style={{ fontSize: 64, marginBottom: 16 }}
            >
              🏛
            </motion.div>
            <div style={{
              fontSize: 11, color: '#8b7355',
              letterSpacing: '0.3em', fontFamily: 'monospace',
            }}>
              DIGITAL HERITAGE PROTECTION SIMULATION
            </div>
          </motion.div>
        )}

        {phase === 'title' && (
          <motion.div
            key="title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ textAlign: 'center', maxWidth: 480 }}
          >
            {/* 标题 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ marginBottom: 32 }}
            >
              <div style={{ fontSize: 40, color: '#d7bd73', fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1 }}>
                石窟守护者
              </div>
              <div style={{ fontSize: 13, color: '#8b7355', letterSpacing: '0.2em', marginTop: 8, fontFamily: 'monospace' }}>
                CAVE GUARDIAN
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(215,189,115,0.4), transparent)', marginTop: 12 }} />
            </motion.div>

            {/* 描述 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ fontSize: 13, color: '#8b7355', lineHeight: 1.7, marginBottom: 32 }}
            >
              以数字文物保护管理员身份<br />
              巡检石窟、记录数据、处置风险<br />
              完成5项任务，守护千年遗产
            </motion.div>

            {/* 按钮 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(215,189,115,0.2)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onStart(null)}
                style={{
                  padding: '14px 40px',
                  background: 'rgba(215,189,115,0.1)',
                  border: '1px solid rgba(215,189,115,0.5)',
                  borderRadius: 8,
                  color: '#d7bd73',
                  cursor: 'pointer',
                  fontSize: 15,
                  letterSpacing: '0.08em',
                  fontFamily: 'monospace',
                  width: 220,
                }}
              >
                🏛 开始游戏
              </motion.button>

              {existingSave && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onStart(existingSave)}
                  style={{
                    padding: '10px 32px',
                    background: 'rgba(143,174,120,0.08)',
                    border: '1px solid rgba(143,174,120,0.3)',
                    borderRadius: 6,
                    color: '#8fae78',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    width: 220,
                  }}
                >
                  📂 继续游戏
                </motion.button>
              )}

              {onAchievements && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onAchievements}
                  style={{
                    padding: '10px 32px',
                    background: 'rgba(122,184,217,0.06)',
                    border: '1px solid rgba(122,184,217,0.25)',
                    borderRadius: 6,
                    color: '#7ab8d9',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    width: 220,
                  }}
                >
                  🏆 成就 ({
                    achievementProgress
                      ? Object.keys(achievementProgress.unlocked).length
                      : 0
                  }/18)
                </motion.button>
              )}

              {onChallengeMode && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setPhase('challenge')}
                  style={{
                    padding: '10px 32px',
                    background: 'rgba(217,163,99,0.06)',
                    border: '1px solid rgba(217,163,99,0.25)',
                    borderRadius: 6,
                    color: '#d9a063',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    width: 220,
                  }}
                >
                  ⚔️ 挑战模式
                </motion.button>
              )}
            </motion.div>

            {/* 通关信息 */}
            {achievementProgress && achievementProgress.totalPlaythroughs > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                style={{
                  marginTop: 18,
                  fontSize: 10,
                  color: '#5a5040',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                }}
              >
                第 {achievementProgress.totalPlaythroughs} 次巡检
              </motion.div>
            )}

            {/* 操控说明 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              style={{
                marginTop: 32, fontSize: 10,
                color: '#3d3322',
                fontFamily: 'monospace', letterSpacing: '0.05em',
              }}
            >
              WASD / 方向键 移动 · E 互动 · 空格 对话/时机
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 挑战模式选择器 */}
      {phase === 'challenge' && onChallengeMode && (
        <ChallengeSelector
          onSelect={(mode) => onChallengeMode(mode)}
          onBack={() => setPhase('title')}
          playthroughCount={playthroughCount}
        />
      )}
    </div>
  )
}
