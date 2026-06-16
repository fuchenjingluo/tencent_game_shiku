// ────────────────────────────────────────────────────────────────────────────
// NG+ 三选一加成面板
// 在新游戏+时展示，玩家从三个遗产加成中任选其一
// ────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion'
import type { NGPlusBonus, NGPlusBonusConfig, GameStats } from '../../types'

export const NGPLUS_BONUSES: NGPlusBonusConfig[] = [
  {
    id: 'experience',
    title: '前辈的经验',
    subtitle: '开局风险 -10',
    description: '上一次巡检积累的教训转化为经验直觉。你知道哪些区域最容易出问题，也知道如何在危机到来前就采取预防措施。',
    icon: '👁️',
    color: '#8fae78',
    apply: (stats: GameStats) => ({ ...stats, risk: Math.max(0, stats.risk - 10) }),
  },
  {
    id: 'archives',
    title: '遗留的档案',
    subtitle: '开局证据 +15',
    description: '上一轮巡检留下的完整文档成为你的起点。传感器基线数据、壁画状态记录、环境监测报告——新的巡检不用从零开始。',
    icon: '📚',
    color: '#7ab8d9',
    apply: (stats: GameStats) => ({ ...stats, evidence: Math.min(100, stats.evidence + 15) }),
  },
  {
    id: 'funding',
    title: '结转经费',
    subtitle: '开局预算 +3',
    description: '上一轮巡检的余款和新增的研究经费流入新周期的预算池。更多的资金意味着更少的妥协和更快的问题处置。',
    icon: '💰',
    color: '#d9a07a',
    apply: (stats: GameStats) => ({ ...stats, budget: Math.min(20, stats.budget + 3) }),
  },
]

interface NGPlusSelectorProps {
  playthrough: number
  onSelect: (bonus: NGPlusBonus) => void
}

export function NGPlusSelector({ playthrough, onSelect }: NGPlusSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,9,7,0.96)',
        pointerEvents: 'all',
        overflowY: 'auto',
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 120, damping: 20 }}
        style={{
          width: 620,
          maxWidth: '94%',
          background: 'rgba(18,17,13,0.99)',
          border: '1px solid #3d3322',
          borderRadius: 16,
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 背景纹理 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, rgba(215,189,115,0.01) 0px, transparent 1px, transparent 20px)',
          pointerEvents: 'none', borderRadius: 16,
        }} />

        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            fontSize: 10, color: '#8b7355',
            letterSpacing: '0.2em', marginBottom: 4,
            fontFamily: 'monospace',
          }}>
            — 新游戏+ —
          </div>
          <div style={{ fontSize: 18, color: '#d7bd73', fontWeight: 700 }}>
            第 {playthrough} 次巡检：继承遗产
          </div>
          <div style={{
            fontSize: 11, color: '#8b7355',
            marginTop: 6, lineHeight: 1.5,
          }}>
            石窟记得你的上一次守护。选择一件遗产带入新一轮巡检。
          </div>
          <div style={{
            height: 1,
            background: 'rgba(215,189,115,0.15)',
            marginTop: 14,
          }} />
        </div>

        {/* 三个选项 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 16,
        }}>
          {NGPLUS_BONUSES.map((bonus) => (
            <motion.button
              key={bonus.id}
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(215,189,115,0.08)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(bonus.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 18px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${bonus.color}33`,
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
            >
              {/* 图标 */}
              <div style={{
                fontSize: 32,
                flexShrink: 0,
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${bonus.color}11`,
                borderRadius: 8,
              }}>
                {bonus.icon}
              </div>

              {/* 内容 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: bonus.color }}>
                    {bonus.title}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: bonus.color,
                    fontFamily: 'monospace',
                    opacity: 0.7,
                  }}>
                    {bonus.subtitle}
                  </span>
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#8b7355',
                  lineHeight: 1.6,
                }}>
                  {bonus.description}
                </div>
              </div>

              {/* 箭头 */}
              <div style={{
                fontSize: 16,
                color: `${bonus.color}55`,
                flexShrink: 0,
              }}>
                →
              </div>
            </motion.button>
          ))}
        </div>

        {/* 提示 */}
        <div style={{
          textAlign: 'center',
          marginTop: 18,
          fontSize: 9,
          color: '#5a5040',
          fontFamily: 'monospace',
        }}>
          选择一个加成开始新一轮巡检 · 每次 NG+ 都可重新选择
        </div>
      </motion.div>
    </motion.div>
  )
}
