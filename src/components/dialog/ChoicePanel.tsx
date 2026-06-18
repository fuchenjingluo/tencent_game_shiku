// ────────────────────────────────────────────────────────────────────────────
// 选择面板 v2.0 — 三选一（专业/妥协/激进）+ 风格标签 + 叙事预览
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TaskStep, Choice, ChoiceStyle, Stat } from '../../types'
import { bus } from '../../events/bus'

const STAT_LABELS: Record<Stat, string> = {
  reputation: '声誉',
  risk: '风险',
  evidence: '证据',
  budget: '预算',
}

const STYLE_CONFIG: Record<ChoiceStyle, { label: string; color: string; bg: string; icon: string }> = {
  professional: { label: '专业路线', color: '#8fae78', bg: 'rgba(143,174,120,0.08)', icon: '◎' },
  compromise:   { label: '妥协路线', color: '#d7bd73', bg: 'rgba(215,189,115,0.08)', icon: '◐' },
  risky:        { label: '激进路线', color: '#d98f72', bg: 'rgba(217,143,114,0.08)', icon: '⟐' },
}

function DeltaBadge({ stat, val }: { stat: Stat; val: number }) {
  const color = stat === 'risk'
    ? (val > 0 ? '#d98f72' : '#8fae78')
    : (val >= 0 ? '#8fae78' : '#d98f72')
  return (
    <span style={{
      fontSize: 10,
      color,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      borderRadius: 3,
      padding: '1px 5px',
      marginRight: 3,
      fontFamily: 'monospace',
    }}>
      {STAT_LABELS[stat]} {val > 0 ? '+' : ''}{val}
    </span>
  )
}

function ChoiceCard({ choice, onSelect, index, disabled, disabledHint }: {
  choice: Choice; onSelect: () => void; index: number; disabled?: boolean; disabledHint?: string
}) {
  const [hovered, setHovered] = useState(false)
  const cfg = STYLE_CONFIG[choice.style]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: disabled ? 0.4 : 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, type: 'spring', stiffness: 200 }}
      onHoverStart={() => !disabled && setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => !disabled && onSelect()}
      style={{
        flex: 1,
        padding: '14px 12px',
        background: hovered ? cfg.bg : 'rgba(255,255,255,0.015)',
        border: `1px solid ${hovered ? cfg.color + '55' : '#3d3322'}`,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
        position: 'relative',
        overflow: 'hidden',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {/* 风格标签 */}
      <div style={{
        fontSize: 9,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        borderRadius: 3,
        padding: '1px 6px',
        display: 'inline-block',
        marginBottom: 8,
        letterSpacing: '0.05em',
        fontFamily: 'monospace',
      }}>
        {cfg.icon} {cfg.label}
      </div>

      {/* 标题 */}
      <div style={{
        fontSize: 14,
        color: disabled ? '#5a5040' : '#d7bd73',
        fontWeight: 600,
        marginBottom: 6,
        lineHeight: 1.3,
      }}>
        {choice.label}
      </div>

      {/* 描述 */}
      <div style={{
        fontSize: 11,
        color: '#7a6f5f',
        lineHeight: 1.5,
        marginBottom: 10,
      }}>
        {choice.desc}
      </div>

      {disabled && disabledHint && (
        <div style={{
          fontSize: 10,
          color: '#d98f72',
          background: 'rgba(217,143,114,0.08)',
          border: '1px dashed rgba(217,143,114,0.3)',
          borderRadius: 4,
          padding: '6px 8px',
          marginBottom: 8,
        }}>
          🚫 {disabledHint}
        </div>
      )}

      {/* 即时效果 */}
      {!disabled && (
        <>
          <div style={{ fontSize: 10, color: '#5a5040', marginBottom: 4 }}>选择效果：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 8 }}>
            {Object.entries(choice.deltas).map(([s, v]) => (
              <DeltaBadge key={s} stat={s as Stat} val={v} />
            ))}
          </div>

          {/* 小游戏预览 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '8px 10px',
            background: 'rgba(143,174,120,0.06)',
            border: '1px solid rgba(143,174,120,0.15)',
            borderRadius: 5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>🎮</span>
              <span style={{ fontSize: 10, color: '#8fae78' }}>
                {getMiniGameName(choice.miniGame.type)}
                <span style={{ color: '#d7bd73', marginLeft: 4 }}>{'★'.repeat(choice.miniGame.difficulty)}</span>
              </span>
            </div>
            <span style={{ fontSize: 9, color: '#6b8f5a', lineHeight: 1.4, fontStyle: 'italic' }}>
              {choice.miniGame.narrativeBinding.slice(0, 60)}...
            </span>
          </div>
        </>
      )}

      {/* 小游戏成功/失败预览 */}
      {!disabled && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 9 }}>
          <span style={{ color: '#8fae78' }}>✓成功 {formatMiniDeltas(choice.successDeltas)}</span>
          <span style={{ color: '#d98f72' }}>✗失败 {formatMiniDeltas(choice.failDeltas)}</span>
        </div>
      )}
    </motion.div>
  )
}

function getMiniGameName(type: string): string {
  const names: Record<string, string> = {
    trace: '路径描摹', memory: '序列记忆', match: '翻牌配对',
    timing: '时机按键', calibrate: '精密校准', wire: '接线连接', sequence: '顺序排列',
    puzzle: '壁画修复',
  }
  return names[type] ?? type
}

function formatMiniDeltas(d: Partial<Record<Stat, number>>): string {
  return Object.entries(d).map(([s, v]) =>
    `${STAT_LABELS[s as Stat]} ${(v as number) > 0 ? '+' : ''}${v}`
  ).join(' ')
}

// ═══════════════════════════════════════════════════════════════════════════
// 选择面板控制器
// ═══════════════════════════════════════════════════════════════════════════

interface ChoiceState {
  step: TaskStep
  taskTitle: string
}

interface ChoicePanelControllerProps {
  onChoose: (choice: Choice, step: TaskStep) => void
  gameFlags: Record<string, boolean>
  stats: { reputation: number; risk: number; evidence: number; budget: number }
}

export function ChoicePanelController({ onChoose, gameFlags, stats }: ChoicePanelControllerProps) {
  const [state, setState] = useState<ChoiceState | null>(null)

  useEffect(() => {
    const unsub = bus.on('open:choice', ({ step, taskTitle }) => {
      setState({ step, taskTitle })
    })
    return unsub
  }, [])

  const handleChoose = useCallback((choice: Choice) => {
    if (!state) return
    setState(null)
    onChoose(choice, state.step)
  }, [state, onChoose])

  const handleDismiss = useCallback(() => {
    setState(null)
    bus.emit('ui:lock-input', false)
    bus.emit('ui:choice-cancelled')
  }, [])

  if (!state) return null

  // 计算每个选项是否被 flag 禁用
  const getDisabled = (choice: Choice) => {
    if (!choice.requireFlags) return false
    return !Object.entries(choice.requireFlags).every(
      ([k, v]) => gameFlags[k] === v
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        key="choice"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(12,11,9,0.75)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'all',
          overflowY: 'auto',
          padding: '20px',
          cursor: 'default',
        }}
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 820,
            maxWidth: '96%',
            background: 'rgba(18,17,13,0.98)',
            border: '1px solid #3d3322',
            borderRadius: 12,
            padding: '22px',
            boxShadow: '0 0 60px rgba(215,189,115,0.08)',
          }}
        >
          {/* 标题 */}
          <div style={{ marginBottom: 14, position: 'relative' }}>
            <div style={{ fontSize: 10, color: '#8b7355', letterSpacing: '0.12em', marginBottom: 4, fontFamily: 'monospace', paddingRight: 36 }}>
              {state.taskTitle}
            </div>
            <div style={{ fontSize: 16, color: '#d7bd73', fontWeight: 600, paddingRight: 36 }}>
              {state.step.description}
            </div>
            <div style={{ height: 1, background: 'rgba(215,189,115,0.15)', marginTop: 10 }} />

            {/* 关闭按钮 */}
            <motion.button
              whileHover={{ scale: 1.15, background: 'rgba(217,143,114,0.2)', borderColor: '#d98f72' }}
              whileTap={{ scale: 0.9 }}
              onClick={handleDismiss}
              style={{
                position: 'absolute', top: 0, right: 0,
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                color: '#8b7355',
                fontSize: 16,
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
              title="关闭（不选择任何方案）"
            >✕</motion.button>
          </div>

          {/* 三个选项 */}
          <div style={{ display: 'flex', gap: 12 }}>
            {state.step.choices.map((choice, i) => {
              const disabled = getDisabled(choice)
              return (
                <ChoiceCard
                  key={choice.id}
                  choice={choice}
                  index={i}
                  onSelect={() => handleChoose(choice)}
                  disabled={disabled}
                  disabledHint={disabled ? choice.requireHint : undefined}
                />
              )
            })}
          </div>

          <div style={{ fontSize: 10, color: '#5a5040', textAlign: 'center', marginTop: 12 }}>
            选择后将进入对应小游戏 · 小游戏成功可获得额外奖励 · 失败则奖励减半
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
