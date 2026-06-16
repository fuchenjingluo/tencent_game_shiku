// ────────────────────────────────────────────────────────────────────────────
// 属性转化面板 — 允许玩家在任务间消耗一种属性换取另一种
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CONVERSIONS, canAffordConversion } from '../data/statConversion'
import type { GameStats } from '../types'
import { bus } from '../events/bus'

interface ConversionPanelProps {
  stats: GameStats
  onStatsChange: (deltas: Partial<Record<string, number>>) => void
  onClose: () => void
}

const STAT_LABELS: Record<string, string> = {
  reputation: '声誉', risk: '风险', evidence: '证据', budget: '预算',
}

const STAT_COLORS: Record<string, string> = {
  reputation: '#d7bd73',
  risk: '#d95a54',
  evidence: '#8fae78',
  budget: '#7ab8d9',
}

export function ConversionPanel({ stats, onStatsChange, onClose }: ConversionPanelProps) {
  const [used, setUsed] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState<string | null>(null)

  const available = CONVERSIONS.filter((c) => !used.has(c.id))

  function handleApply(id: string) {
    const conv = CONVERSIONS.find((c) => c.id === id)
    if (!conv) return
    if (!canAffordConversion(stats, conv)) return

    setUsed((prev) => new Set([...prev, id]))
    setApplied(id)

    // 计算变化
    const deltas: Partial<Record<string, number>> = {}

    // 消耗
    Object.entries(conv.cost).forEach(([k, v]) => {
      deltas[k] = -(v as number)
    })

    // 获得
    Object.entries(conv.gain).forEach(([k, v]) => {
      deltas[k] = (deltas[k] ?? 0) + (v as number)
    })

    onStatsChange(deltas)

    // 发射事件（用于追踪 cover_up 等特殊转化）
    bus.emit('flags:set', { key: `conversion_${id}`, value: true })

    setTimeout(() => setApplied(null), 2000)
  }

  return (
    <AnimatePresence>
      <motion.div
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
          background: 'rgba(12,11,9,0.8)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'all',
          onClick: onClose,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'rgba(18,17,13,0.98)',
            border: '1px solid #3d3322',
            borderRadius: 12,
            padding: '24px 28px',
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 0 60px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
          }}>
            <div>
              <div style={{
                fontSize: 14, color: '#d7bd73', fontFamily: 'monospace',
                letterSpacing: '0.08em',
              }}>
                🔄 属性转化
              </div>
              <div style={{ fontSize: 10, color: '#8b7355', marginTop: 2 }}>
                每个操作仅可使用一次 · 谨慎选择时机
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid #3d3322', borderRadius: 4,
                color: '#8b7355', cursor: 'pointer', fontSize: 14, padding: '4px 10px',
              }}
            >
              ✕
            </button>
          </div>

          {applied && (
            <div style={{
              marginBottom: 12, padding: '6px 12px',
              background: 'rgba(143,174,120,0.1)',
              border: '1px solid rgba(143,174,120,0.3)',
              borderRadius: 6, fontSize: 11, color: '#8fae78',
              fontFamily: 'monospace',
            }}>
              ✓ 转化已完成
            </div>
          )}

          {available.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '20px 0', color: '#8b7355',
              fontSize: 12, fontFamily: 'monospace',
            }}>
              所有转化操作已使用完毕。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {available.map((conv) => {
                const affordable = canAffordConversion(stats, conv)
                return (
                  <div
                    key={conv.id}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${affordable ? '#3d3322' : 'rgba(217,143,114,0.3)'}`,
                      borderRadius: 8,
                      opacity: affordable ? 1 : 0.5,
                    }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 12, color: '#d7bd73', fontWeight: 600 }}>
                        {conv.label}
                      </div>
                      <button
                        disabled={!affordable}
                        onClick={() => handleApply(conv.id)}
                        style={{
                          padding: '4px 12px',
                          background: affordable ? 'rgba(215,189,115,0.1)' : 'transparent',
                          border: `1px solid ${affordable ? '#d7bd73' : '#3d3322'}`,
                          borderRadius: 4,
                          color: affordable ? '#d7bd73' : '#3d3322',
                          cursor: affordable ? 'pointer' : 'default',
                          fontSize: 10, fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        执行
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: '#8b7355', marginBottom: 6 }}>
                      {conv.desc}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                      {/* 消耗 */}
                      {Object.entries(conv.cost).map(([k, v]) => {
                        const has = (stats[k as keyof GameStats] ?? 0) >= (v as number)
                        return (
                          <span key={`cost-${k}`} style={{
                            color: has ? '#d98f72' : '#d95a54',
                            fontFamily: 'monospace',
                          }}>
                            -{v} {STAT_LABELS[k] ?? k}
                          </span>
                        )
                      })}
                      <span style={{ color: '#3d3322' }}>→</span>
                      {/* 获得 */}
                      {Object.entries(conv.gain).map(([k, v]) => (
                        <span key={`gain-${k}`} style={{
                          color: STAT_COLORS[k] ?? '#8fae78',
                          fontFamily: 'monospace',
                        }}>
                          +{v} {STAT_LABELS[k] ?? k}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
