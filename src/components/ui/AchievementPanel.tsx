// ────────────────────────────────────────────────────────────────────────────
// 成就面板 v1.0
// 展示 18 个成就的解锁状态，按分类筛选
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ACHIEVEMENTS, getAchievementState, getStoryProgress, getProgress } from '../../data/achievements'
import type { AchievementCategory, AchievementState } from '../../types'

interface Props {
  onClose: () => void
}

const CATEGORY_NAMES: Record<AchievementCategory, string> = {
  ending: '结局',
  challenge: '挑战',
  discovery: '发现',
}

const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  ending: '👑',
  challenge: '🎯',
  discovery: '🔍',
}

export function AchievementPanel({ onClose }: Props) {
  const [filter, setFilter] = useState<AchievementCategory | 'all'>('all')
  const state = getAchievementState()
  const { unlocked, total } = getProgress()
  const storyProgress = getStoryProgress()

  const filtered = ACHIEVEMENTS.filter((a) => filter === 'all' || a.category === filter)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10,9,7,0.95)',
        pointerEvents: 'all',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        style={{
          width: 600,
          maxWidth: '96%',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'rgba(18,17,13,0.99)',
          border: '1px solid #3d3322',
          borderRadius: 16,
          padding: '28px 32px',
          position: 'relative',
        }}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#d7bd73' }}>🏆 成就</div>
            <div style={{ fontSize: 11, color: '#8b7355', fontFamily: 'monospace', marginTop: 2 }}>
              {unlocked} / {total} 已解锁
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              padding: '6px 14px',
              background: 'rgba(215,189,115,0.08)',
              border: '1px solid rgba(215,189,115,0.3)',
              borderRadius: 6,
              color: '#d7bd73',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            ✕ 关闭
          </motion.button>
        </div>

        {/* 进度条 */}
        <div style={{
          height: 4,
          background: '#1e1b15',
          borderRadius: 2,
          marginBottom: 20,
          overflow: 'hidden',
          border: '1px solid #2a2318',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlocked / total) * 100}%` }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #d7bd73, #b8973e)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* 分类筛选 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['all', 'ending', 'challenge', 'discovery'] as const).map((cat) => (
            <motion.button
              key={cat}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setFilter(cat)}
              style={{
                padding: '6px 14px',
                background: filter === cat ? 'rgba(215,189,115,0.12)' : 'transparent',
                border: `1px solid ${filter === cat ? 'rgba(215,189,115,0.4)' : 'rgba(61,51,34,0.4)'}`,
                borderRadius: 6,
                color: filter === cat ? '#d7bd73' : '#8b7355',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              {cat === 'all' ? '🏆' : CATEGORY_ICONS[cat]} {cat === 'all' ? '全部' : CATEGORY_NAMES[cat]}
            </motion.button>
          ))}
        </div>

        {/* 成就列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((ach, i) => {
              const unlocked = ach.id in state.unlocked
              const snap = state.unlocked[ach.id]
              return (
                <motion.div
                  key={ach.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    padding: '12px 14px',
                    background: unlocked ? 'rgba(215,189,115,0.04)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${unlocked ? 'rgba(215,189,115,0.2)' : 'rgba(61,51,34,0.2)'}`,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    opacity: !unlocked && ach.secret ? 0.3 : 1,
                  }}
                >
                  {/* 图标 */}
                  <span style={{
                    fontSize: 24,
                    filter: unlocked ? 'none' : 'grayscale(1)',
                    opacity: unlocked ? 1 : 0.4,
                  }}>
                    {unlocked ? ach.icon : '🔒'}
                  </span>

                  {/* 信息 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: unlocked ? '#d7bd73' : '#5a5040' }}>
                      {!unlocked && ach.secret ? '???' : ach.name}
                    </div>
                    <div style={{ fontSize: 10, color: unlocked ? '#8b7355' : '#4a4030', lineHeight: 1.4 }}>
                      {!unlocked && ach.secret ? '隐藏成就 — 继续探索吧' : ach.description}
                    </div>
                  </div>

                  {/* 解锁时间 */}
                  {unlocked && snap && (
                    <div style={{
                      fontSize: 9,
                      color: '#5a5040',
                      fontFamily: 'monospace',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      marginLeft: 'auto',
                    }}>
                      <div>第 {snap.playthrough} 周目</div>
                      <div>{new Date(snap.unlockedAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                  )}

                  {/* 故事猎人进度 */}
                  {ach.id === 'ach_story' && !unlocked && (
                    <div style={{
                      fontSize: 9,
                      color: '#7ab8d9',
                      fontFamily: 'monospace',
                      marginLeft: 'auto',
                    }}>
                      {storyProgress.seen}/{storyProgress.total}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* 空状态 */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 12, color: '#8b7355' }}>
              切换分类查看其他成就
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
