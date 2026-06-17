// ────────────────────────────────────────────────────────────────────────────
// 小游戏容器 — 统一入口 v3.0
// 新增：Catch-Up 安全网（连续失败→难度衰减/自动跳过）
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MiniGameConfig, Choice, TaskStep, Stat } from '../../types'
import { bus } from '../../events/bus'
import { playSuccess, playFail } from '../../audio/audioManager'
import { TraceGame } from './TraceGame'
import { MemoryGame } from './MemoryGame'
import { MatchGame } from './MatchGame'
import { TimingGame } from './TimingGame'
import { CalibrateGame } from './CalibrateGame'
import { WireGame } from './WireGame'
import { SequenceGame } from './SequenceGame'

interface MiniGameControllerProps {
  onTaskAdvance: (success: boolean, deltas: Partial<Record<Stat, number>>) => void
  onStatsChange: (deltas: Partial<Record<Stat, number>>) => void
}

interface MiniGameState {
  config: MiniGameConfig
  choice: Choice
  step: TaskStep
  /** 是否为 Catch-Up 自动跳过（3+连续失败后） */
  catchUpSkip?: boolean
}

export function MiniGameController({ onTaskAdvance, onStatsChange }: MiniGameControllerProps) {
  const [state, setState] = useState<MiniGameState | null>(null)
  const [phase, setPhase] = useState<'game' | 'result'>('game')
  const [lastSuccess, setLastSuccess] = useState(false)
  const [resultDeltas, setResultDeltas] = useState<Partial<Record<Stat, number>>>({})
  const [catchUpMessage, setCatchUpMessage] = useState<string | null>(null)

  // ── Catch-Up 安全网 ──
  const consecutiveFailsRef = useRef(0)

  // 监听选择事件（从 ChoicePanelController 传来）
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { choice, step } = e.detail as { choice: Choice; step: TaskStep }
      let config = { ...choice.miniGame }

      // Catch-Up: 连续 2 败 → 难度 -1
      if (consecutiveFailsRef.current >= 2 && config.difficulty > 1) {
        config.difficulty = (config.difficulty - 1) as 1 | 2 | 3
        setCatchUpMessage(`连续受挫，难度已从 ${choice.miniGame.difficulty} 降至 ${config.difficulty}`)
      } else {
        setCatchUpMessage(null)
      }

      // Catch-Up: 连续 3 败 → 自动跳过（NPC 接手，奖励减半）
      if (consecutiveFailsRef.current >= 3) {
        bus.emit('ui:choice-made', { choiceId: choice.id, stepId: step.id, style: choice.style })
        setState({
          config: choice.miniGame,
          choice,
          step,
          catchUpSkip: true,
        })
        // 直接进入结果阶段：视为成功但奖励减半
        const baseDeltas = { ...choice.deltas }
        const halvedSuccess: Partial<Record<Stat, number>> = {}
        Object.entries(choice.successDeltas).forEach(([k, v]) => {
          halvedSuccess[k as Stat] = Math.floor((v as number) / 2)
        })
        const merged: Partial<Record<Stat, number>> = { ...baseDeltas }
        Object.entries(halvedSuccess).forEach(([k, v]) => {
          const stat = k as Stat
          merged[stat] = (merged[stat] ?? 0) + v
        })
        setResultDeltas(merged)
        setPhase('result')
        setLastSuccess(true) // 跳过视为"成功"
        setCatchUpMessage('连续 3 次失败，NPC 接手完成本步骤（奖励减半）')
        onStatsChange(merged)
        consecutiveFailsRef.current = 0
        return
      }

      setState({ config, choice, step })
      setPhase('game')
    }
    window.addEventListener('minigame:start', handler as EventListener)
    return () => window.removeEventListener('minigame:start', handler as EventListener)
  }, [])

  function handleComplete(success: boolean) {
    if (!state) return
    setLastSuccess(success)

    // Catch-Up 追踪
    if (success) consecutiveFailsRef.current = 0
    else consecutiveFailsRef.current++

    // 计算效果：选择固定效果 + 成功/失败额外效果
    const baseDeltas = { ...state.choice.deltas }
    const bonusDeltas = success ? state.choice.successDeltas : state.choice.failDeltas

    // 合并
    const merged: Partial<Record<Stat, number>> = { ...baseDeltas }
    Object.entries(bonusDeltas).forEach(([k, v]) => {
      const stat = k as Stat
      merged[stat] = (merged[stat] ?? 0) + v
    })

    setResultDeltas(merged)
    setPhase('result')

    if (success) playSuccess()
    else playFail()

    // 应用到stats
    onStatsChange(merged)
  }

  function handleResultClose() {
    if (!state) return
    const success = lastSuccess
    bus.emit('ui:choice-made', { choiceId: state.choice.id, stepId: state.step.id, style: state.choice.style })
    onTaskAdvance(success, resultDeltas)
    setState(null)
    bus.emit('ui:minigame-done', { success })
  }

  if (!state) return null

  return (
    <AnimatePresence>
      <motion.div
        key="minigame-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(12,11,9,0.85)',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'all',
        }}
      >
        {phase === 'game' && !state.catchUpSkip ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              background: 'rgba(18,17,13,0.98)',
              border: '1px solid #3d3322',
              borderRadius: 12,
              padding: '28px 32px',
              maxWidth: 620,
              width: '90%',
              minWidth: 500,
              boxShadow: '0 0 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* 标题 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10, color: '#8b7355', letterSpacing: '0.15em',
                fontFamily: 'monospace', marginBottom: 4,
              }}>
                小游戏 — {getGameName(state.config.type)}
                {catchUpMessage && (
                  <span style={{ color: '#d9a063', marginLeft: 8 }}>（Catch-Up: 难度已降低）</span>
                )}
              </div>
              <div style={{ height: 1, background: 'rgba(215,189,115,0.1)' }} />
            </div>

            {/* Catch-Up 提示 */}
            {catchUpMessage && (
              <div style={{
                marginBottom: 16, padding: '8px 12px',
                background: 'rgba(217,160,99,0.1)',
                border: '1px solid rgba(217,160,99,0.3)',
                borderRadius: 6,
                fontSize: 11, color: '#d9a063',
                fontFamily: 'monospace',
              }}>
                💡 {catchUpMessage}
              </div>
            )}

            {/* 游戏内容 */}
            {state.config.type === 'trace' && (
              <TraceGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
            {state.config.type === 'memory' && (
              <MemoryGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
            {state.config.type === 'match' && (
              <MatchGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
            {state.config.type === 'timing' && (
              <TimingGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
            {state.config.type === 'calibrate' && (
              <CalibrateGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
            {state.config.type === 'wire' && (
              <WireGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
            {state.config.type === 'sequence' && (
              <SequenceGame difficulty={state.config.difficulty} prompt={state.config.prompt} onComplete={handleComplete} />
            )}
          </motion.div>
        ) : (
          <ResultCard
            success={lastSuccess}
            deltas={resultDeltas}
            onClose={handleResultClose}
            catchUpMessage={catchUpMessage}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function getGameName(type: string) {
  const map: Record<string, string> = {
    trace: '路径描摹', memory: '序列记忆', match: '翻牌配对',
    timing: '时机按键', calibrate: '精密校准', wire: '接线连接',
    sequence: '顺序排列',
  }
  return map[type] ?? type
}

function ResultCard({ success, deltas, onClose, catchUpMessage }: {
  success: boolean
  deltas: Partial<Record<Stat, number>>
  onClose: () => void
  catchUpMessage?: string | null
}) {
  const STAT_LABELS: Record<Stat, string> = {
    reputation: '声誉', risk: '风险', evidence: '证据', budget: '预算',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        background: 'rgba(18,17,13,0.98)',
        border: `1px solid ${success ? '#8fae78' : '#d98f72'}`,
        borderRadius: 12,
        padding: '32px 40px',
        textAlign: 'center',
        minWidth: 280,
        boxShadow: `0 0 40px ${success ? 'rgba(143,174,120,0.1)' : 'rgba(217,143,114,0.1)'}`,
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
        style={{ fontSize: 48, marginBottom: 12 }}
      >
        {success ? '✅' : '❌'}
      </motion.div>
      <div style={{
        fontSize: 18, fontWeight: 700,
        color: success ? '#8fae78' : '#d98f72',
        marginBottom: 8,
      }}>
        {success ? '操作成功！' : '操作失败'}
      </div>
      <div style={{ fontSize: 12, color: '#8b7355', marginBottom: 20 }}>
        {catchUpMessage
          ? `🎗️ ${catchUpMessage}`
          : success ? '获得全部奖励' : '部分效果减半'}
      </div>

      {/* 属性变化 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {(Object.entries(deltas) as [Stat, number][]).map(([stat, val]) => {
          const isGood = stat === 'risk' ? val <= 0 : val >= 0
          return (
            <div key={stat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#8b7355' }}>{STAT_LABELS[stat]}</span>
              <span style={{ color: isGood ? '#8fae78' : '#d98f72', fontFamily: 'monospace' }}>
                {val >= 0 ? '+' : ''}{val}
              </span>
            </div>
          )
        })}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        style={{
          padding: '10px 28px',
          background: success ? 'rgba(143,174,120,0.15)' : 'rgba(217,143,114,0.1)',
          border: `1px solid ${success ? '#8fae78' : '#d98f72'}`,
          borderRadius: 6,
          color: success ? '#8fae78' : '#d98f72',
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        继续 →
      </motion.button>
    </motion.div>
  )
}
