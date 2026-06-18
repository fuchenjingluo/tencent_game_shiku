// ────────────────────────────────────────────────────────────────────────────
// HUD v2.0 — 风险等级着色 + 数值变动动画
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { GameStats, Objective } from '../../types'
import { TASKS } from '../../data/gameData'
import { getRiskLevel } from '../../data/riskSystem'
import { bus } from '../../events/bus'

interface HUDProps {
  stats: GameStats
  completedTasks: string[]
  activeTaskId: string | null
}

interface StatBarProps {
  label: string
  value: number
  max?: number
  color: string
  icon: string
  pulseColor?: string
}

function StatBar({ label, value, max = 100, color, icon, pulseColor }: StatBarProps) {
  const [prev, setPrev] = useState(value)
  const [delta, setDelta] = useState<number | null>(null)
  const pct = Math.max(0, Math.min(100, (value / max) * 100))

  useEffect(() => {
    if (value !== prev) {
      setDelta(value - prev)
      setPrev(value)
      const t = setTimeout(() => setDelta(null), 1200)
      return () => clearTimeout(t)
    }
  }, [value, prev])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 130 }}>
      <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: '#8b7355', letterSpacing: '0.05em' }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {delta !== null && (
              <motion.span
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                style={{
                  fontSize: 10,
                  color: delta > 0 ? (label === '风险' ? '#d98f72' : '#8fae78') : '#8fae78',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                }}
              >
                {delta > 0 ? '+' : ''}{delta}
              </motion.span>
            )}
            <span style={{ fontSize: 10, color: '#d7bd73', fontFamily: 'monospace' }}>{value}</span>
          </div>
        </div>
        <div style={{
          height: 6,
          background: '#1e1b15',
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${pulseColor ? pulseColor + '33' : '#3d3322'}`,
          boxShadow: pulseColor ? `0 0 6px ${pulseColor}22` : 'none',
        }}>
          <motion.div
            key={`${label}-${value}`}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 150, damping: 20 }}
            style={{ height: '100%', background: color, borderRadius: 3 }}
          />
        </div>
      </div>
    </div>
  )
}

export function HUD({ stats, completedTasks, activeTaskId }: HUDProps) {
  const activeTask = TASKS.find((t) => t.id === activeTaskId)
  const riskLevel = getRiskLevel(stats.risk)
  const riskColors: Record<string, string> = {
    safe: '#8fae78', warning: '#d7bd73', danger: '#d9a063', crisis: '#d95a54',
  }

  // 监听数值动画事件
  const [animatingStat, setAnimatingStat] = useState<string | null>(null)

  // 监听寻路目标
  const [objective, setObjective] = useState<Objective | null>(null)

  useEffect(() => {
    const unsub = bus.on('stats:animate', ({ stat }) => {
      setAnimatingStat(stat)
      setTimeout(() => setAnimatingStat(null), 800)
    })
    const unsub2 = bus.on('objective:changed', (obj) => {
      setObjective(obj)
    })
    // 挂载时请求当前目标（修复从转化面板返回后目标栏丢失）
    bus.emit('objective:request')
    return () => { unsub(); unsub2() }
  }, [])

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      padding: '8px 16px',
      background: 'linear-gradient(180deg, rgba(18,17,13,0.95) 0%, rgba(18,17,13,0.7) 80%, transparent 100%)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      borderBottom: '1px solid rgba(215,189,115,0.15)',
      pointerEvents: 'none',
    }}>
      {/* Logo */}
      <div style={{ color: '#d7bd73', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.08em', whiteSpace: 'nowrap', paddingTop: 2 }}>
        🏛 石窟守护者
      </div>

      {/* 属性条 */}
      <div style={{ display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' }}>
        <StatBar
          label="声誉" value={stats.reputation}
          color={animatingStat === 'reputation' ? '#f0e0a0' : '#d7bd73'}
          icon="⭐" pulseColor={animatingStat === 'reputation' ? '#d7bd73' : undefined}
        />
        <StatBar
          label="风险" value={stats.risk}
          color={riskColors[riskLevel]}
          icon="⚠️" pulseColor={riskLevel !== 'safe' ? riskColors[riskLevel] : undefined}
        />
        <StatBar
          label="证据" value={stats.evidence}
          color={animatingStat === 'evidence' ? '#a8ce8e' : '#8fae78'}
          icon="📄" pulseColor={animatingStat === 'evidence' ? '#8fae78' : undefined}
        />
        <StatBar
          label="预算" value={stats.budget} max={20}
          color={stats.budget <= 2 ? '#d98f72' : animatingStat === 'budget' ? '#9ab8e9' : '#7ab8d9'}
          icon="💰" pulseColor={stats.budget <= 2 ? '#d98f72' : undefined}
        />
      </div>

      {/* 任务进度 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 170 }}>
        <div style={{ fontSize: 9, color: '#8b7355', letterSpacing: '0.1em', marginBottom: 2 }}>
          任务 {completedTasks.length}/{TASKS.length}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {TASKS.map((task) => {
            const done = completedTasks.includes(task.id)
            const active = task.id === activeTaskId
            return (
              <motion.div
                key={task.id}
                animate={{ scale: active ? [1, 1.08, 1] : 1 }}
                transition={{ duration: 0.8, repeat: active ? Infinity : 0 }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 4,
                  border: `1px solid ${done ? '#d7bd73' : active ? '#8fae78' : '#3d3322'}`,
                  background: done ? 'rgba(215,189,115,0.12)' : active ? 'rgba(143,174,120,0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: done ? '#d7bd73' : active ? '#8fae78' : '#3d3322',
                }}
              >
                {done ? '✓' : active ? '●' : '○'}
              </motion.div>
            )
          })}
        </div>
        {activeTask && (
          <div style={{ fontSize: 9, color: '#8fae78', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
            {activeTask.title}
          </div>
        )}
      </div>

      {/* 风险等级指示器 */}
      {riskLevel !== 'safe' && (
        <motion.div
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: riskLevel === 'crisis' ? 0.4 : 1.5, repeat: Infinity }}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            border: `1px solid ${riskColors[riskLevel]}55`,
            background: `${riskColors[riskLevel]}15`,
            fontSize: 9,
            color: riskColors[riskLevel],
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}
        >
          {riskLevel === 'warning' ? '⚠ 警告' :
           riskLevel === 'danger' ? '⚡ 危险' :
           '🔥 危机'}
        </motion.div>
      )}

      {/* 转化操作按钮 */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => bus.emit('open:conversion')}
        style={{
          pointerEvents: 'all',
          background: 'rgba(215,189,115,0.08)',
          border: '1px solid rgba(215,189,115,0.25)',
          borderRadius: 4,
          padding: '2px 8px',
          color: '#d7bd73',
          cursor: 'pointer',
          fontSize: 10,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
        }}
        title="属性转化"
      >
        🔄 转化
      </motion.button>

      {/* 寻路目标提示 */}
      {objective && (
        <motion.div
          key={objective.targetId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            padding: '6px 16px',
            background: 'rgba(18,17,13,0.88)',
            borderTop: '1px solid rgba(215,189,115,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 14 }}>
            {objective.type === 'npc' ? '👤' : '📍'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontSize: 10,
              color: '#d7bd73',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}>
              目标：{objective.description}
            </span>
            <span style={{
              fontSize: 8,
              color: '#8b7355',
              fontFamily: 'monospace',
              marginTop: 1,
            }}>
              {objective.roomName} · {objective.name}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
