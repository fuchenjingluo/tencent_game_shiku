// ────────────────────────────────────────────────────────────────────────────
// 小游戏：sequence — 顺序排列
// 将乱序卡片拖拽到正确顺序
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { motion, Reorder } from 'framer-motion'

interface SequenceGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

export function SequenceGame({ difficulty, prompt, onComplete }: SequenceGameProps) {
  const count = 3 + difficulty  // 4/5/6个步骤

  const STEPS = [
    '准备防护装备', '清洁操作区域', '检查材料状态',
    '校准仪器参数', '实施修复操作', '记录工作数据', '封存操作记录',
  ].slice(0, count)

  const [items, setItems] = useState(() =>
    STEPS.map((s, i) => ({ id: i, text: s })).sort(() => Math.random() - 0.5)
  )
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)

  function submit() {
    const correct = items.every((item, i) => item.id === i)
    setSuccess(correct)
    setSubmitted(true)
    setTimeout(() => onComplete(correct), 800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 320 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center' }}>{prompt}</div>
      <div style={{ fontSize: 11, color: '#5a5040' }}>拖拽排列为正确操作顺序</div>

      <Reorder.Group axis="y" values={items} onReorder={setItems} style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%', maxWidth: 320 }}>
        {items.map((item, i) => (
          <Reorder.Item key={item.id} value={item} style={{ marginBottom: 6 }}>
            <motion.div
              whileDrag={{ scale: 1.04, boxShadow: '0 4px 20px rgba(215,189,115,0.2)' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: submitted
                  ? (item.id === i ? 'rgba(143,174,120,0.1)' : 'rgba(217,143,114,0.1)')
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${submitted ? (item.id === i ? '#8fae78' : '#d98f72') : '#3d3322'}`,
                borderRadius: 6,
                cursor: submitted ? 'default' : 'grab',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: 'rgba(215,189,115,0.1)',
                border: '1px solid #3d3322',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#8b7355', fontFamily: 'monospace', flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <span style={{ fontSize: 13, color: '#d4c89a', flex: 1 }}>{item.text}</span>
              {submitted && (
                <span style={{ fontSize: 14 }}>{item.id === i ? '✓' : '✗'}</span>
              )}
            </motion.div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {!submitted && (
        <button
          onClick={submit}
          style={{
            padding: '8px 24px', background: 'rgba(215,189,115,0.1)',
            border: '1px solid rgba(215,189,115,0.4)', borderRadius: 6,
            color: '#d7bd73', cursor: 'pointer', fontSize: 13,
          }}
        >
          确认顺序
        </button>
      )}

      {submitted && (
        <div style={{ color: success ? '#8fae78' : '#d98f72', fontSize: 14, fontWeight: 600 }}>
          {success ? '✓ 顺序正确！' : '✗ 顺序有误'}
        </div>
      )}
    </div>
  )
}
