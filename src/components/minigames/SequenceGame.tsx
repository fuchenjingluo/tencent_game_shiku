// ────────────────────────────────────────────────────────────────────────────
// 小游戏：sequence v2.0 — "多主题 + 部分正确评分 + 移动按钮"
// 将乱序步骤拖拽到正确顺序。新增：不同主题（壁画修复、设备维护、
// 游客管理、数据归档）、部分正确评分、上/下微调按钮辅助。
// ────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import { motion, Reorder } from 'framer-motion'

interface SequenceGameProps {
  difficulty: 1 | 2 | 3
  prompt: string
  onComplete: (success: boolean) => void
}

// 多个主题的步骤组
const STEP_POOLS: Record<string, string[]> = {
  restoration: [
    '穿戴防护手套和口罩',
    '清洁壁画表面浮尘',
    '检查颜料层起甲边界',
    '调配渗透加固试剂',
    '逐点注射加固材料',
    '压贴保护覆盖层',
    '记录操作日志并拍照存档',
  ],
  equipment: [
    '关闭待检设备电源',
    '拆除保护外壳螺丝',
    '检查内部接线端子状态',
    '使用万用表测量电路参数',
    '更换老化密封垫圈',
    '重新安装外壳并紧固',
    '通电测试运行状态',
  ],
  visitor: [
    '在入口处检查预约信息',
    '发放参观证并宣读注意事项',
    '引导游客进入展厅',
    '沿途讲解重点展品',
    '在参观结束后回收证件',
    '记录参观人次和反馈',
    '提交参观统计报告',
  ],
  data: [
    '提取监测仪器原始数据',
    '剔除异常传感器读数',
    '将时间戳与壁画区对应',
    '对异常数据点插值补全',
    '生成趋势曲线和统计摘要',
    '交叉验证多传感器一致性',
    '归档数据到档案管理系统',
  ],
}

const POOL_KEYS = Object.keys(STEP_POOLS)

export function SequenceGame({ difficulty, prompt, onComplete }: SequenceGameProps) {
  const count = 3 + difficulty  // 4/5/6个步骤

  // 随机选主题
  const [poolKey] = useState(() => POOL_KEYS[Math.floor(Math.random() * POOL_KEYS.length)])

  const [items, setItems] = useState(() => {
    const pool = STEP_POOLS[poolKey]
    return pool.slice(0, count)
      .map((s, i) => ({ id: i, text: s }))
      .sort(() => Math.random() - 0.5)
  })
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  // 单步移动（上/下箭头）
  function moveUp(idx: number) {
    if (idx <= 0 || submitted) return
    const newItems = [...items]
    ;[newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]]
    setItems(newItems)
  }

  function moveDown(idx: number) {
    if (idx >= items.length - 1 || submitted) return
    const newItems = [...items]
    ;[newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]]
    setItems(newItems)
  }

  function submit() {
    const correct = items.every((item, i) => item.id === i)
    const ct = items.filter((item, i) => item.id === i).length
    setCorrectCount(ct)
    setSuccess(correct)
    setSubmitted(true)
    // 至少对一半算成功
    setTimeout(() => onComplete(ct >= Math.ceil(count / 2)), 800)
  }

  const themeNames: Record<string, string> = {
    restoration: '壁画修复流程',
    equipment: '设备维护流程',
    visitor: '游客管理流程',
    data: '数据归档流程',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 330 }}>
      <div style={{ fontSize: 12, color: '#8b7355', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
        {prompt}
      </div>

      {!submitted && (
        <div style={{ fontSize: 10, color: '#d7bd73', fontFamily: 'monospace' }}>
          主题：{themeNames[poolKey]} · 拖拽排列为正确顺序
        </div>
      )}

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%', maxWidth: 340 }}
      >
        {items.map((item, i) => (
          <Reorder.Item key={item.id} value={item} style={{ marginBottom: 6 }}>
            <motion.div
              whileDrag={{ scale: 1.03, boxShadow: '0 4px 20px rgba(215,189,115,0.15)' }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px',
                background: submitted
                  ? (item.id === i ? 'rgba(143,174,120,0.08)' : 'rgba(217,143,114,0.06)')
                  : 'rgba(255,255,255,0.025)',
                border: submitted
                  ? `1px solid ${item.id === i ? '#8fae78' : '#d98f72'}44`
                  : '1px solid #3d3322',
                borderRadius: 6,
                cursor: submitted ? 'default' : 'grab',
              }}
            >
              {/* 序号 */}
              <div style={{
                width: 22, height: 22, borderRadius: 4,
                background: submitted
                  ? (item.id === i ? 'rgba(143,174,120,0.15)' : 'rgba(217,143,114,0.1)')
                  : 'rgba(215,189,115,0.08)',
                border: '1px solid #3d3322',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: submitted ? (item.id === i ? '#8fae78' : '#d98f72') : '#8b7355',
                fontFamily: 'monospace', flexShrink: 0,
              }}>
                {submitted ? (item.id === i ? '✓' : '✗') : i + 1}
              </div>

              <span style={{ fontSize: 12, color: '#d4c89a', flex: 1, lineHeight: 1.4 }}>
                {item.text}
              </span>

              {/* 微调按钮 */}
              {!submitted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); moveUp(i) }}
                    disabled={i === 0}
                    style={{
                      width: 18, height: 16, border: 'none', borderRadius: 3,
                      background: i === 0 ? 'transparent' : 'rgba(215,189,115,0.1)',
                      color: i === 0 ? '#2d2a22' : '#d7bd73',
                      cursor: i === 0 ? 'default' : 'pointer',
                      fontSize: 10, lineHeight: 1, padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >▲</motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); moveDown(i) }}
                    disabled={i === items.length - 1}
                    style={{
                      width: 18, height: 16, border: 'none', borderRadius: 3,
                      background: i === items.length - 1 ? 'transparent' : 'rgba(215,189,115,0.1)',
                      color: i === items.length - 1 ? '#2d2a22' : '#d7bd73',
                      cursor: i === items.length - 1 ? 'default' : 'pointer',
                      fontSize: 10, lineHeight: 1, padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >▼</motion.button>
                </div>
              )}
            </motion.div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {!submitted && (
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={submit}
            style={{
              padding: '8px 28px', background: 'rgba(215,189,115,0.1)',
              border: '1px solid rgba(215,189,115,0.4)', borderRadius: 8,
              color: '#d7bd73', cursor: 'pointer', fontSize: 13, fontFamily: 'monospace',
            }}
          >
            确认顺序
          </motion.button>
        </div>
      )}

      {submitted && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260 }}
          style={{ textAlign: 'center' }}
        >
          {success ? (
            <>
              <div style={{ fontSize: 28 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#8fae78' }}>顺序完全正确</div>
            </>
          ) : correctCount >= Math.ceil(count / 2) ? (
            <>
              <div style={{ fontSize: 28 }}>👍</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d7bd73' }}>基本正确</div>
              <div style={{ fontSize: 11, color: '#5a5040', marginTop: 2 }}>
                正确 {correctCount}/{count} 个步骤
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28 }}>❌</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#d98f72' }}>顺序有误</div>
              <div style={{ fontSize: 11, color: '#5a5040', marginTop: 2 }}>
                仅 {correctCount}/{count} 个步骤位置正确
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
