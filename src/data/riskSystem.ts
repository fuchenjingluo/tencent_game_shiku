// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 风险爆炸系统
// 风险不再是数字，而是随时可能引爆的定时炸弹
// ────────────────────────────────────────────────────────────────────────────
import type { GameStats, RiskLevel, RiskEvent } from '../types'

/** 风险阈值定义 */
export const RISK_THRESHOLDS: Record<RiskLevel, { min: number; max: number; color: string; pulseRate: number }> = {
  safe:    { min: 0,  max: 29, color: '#8fae78', pulseRate: 0 },
  warning: { min: 30, max: 59, color: '#d7bd73', pulseRate: 0.02 },
  danger:  { min: 60, max: 79, color: '#d9a063', pulseRate: 0.05 },
  crisis:  { min: 80, max: 100, color: '#d95a54', pulseRate: 0.10 },
}

/** 获取当前风险等级 */
export function getRiskLevel(risk: number): RiskLevel {
  if (risk < 30) return 'safe'
  if (risk < 60) return 'warning'
  if (risk < 80) return 'danger'
  return 'crisis'
}

/** 获取风险等级对应的触发概率 */
export function getRiskTriggerChance(level: RiskLevel): number {
  switch (level) {
    case 'safe':    return 0      // 从不触发
    case 'warning': return 0.10   // 10%/步
    case 'danger':  return 0.30   // 30%/步
    case 'crisis':  return 1.0    // 必触发
  }
}

// ─── 事故事件表 ─────────────────────────────────────────────────────────────

const MINOR_EVENTS: RiskEvent[] = [
  {
    level: 'warning', title: '传感器漂移',
    message: '湿度传感器读数出现漂移，数据可靠性轻微下降。',
    deltas: { evidence: -2, risk: 3 },
  },
  {
    level: 'warning', title: '档案索引损坏',
    message: '数字档案系统的索引文件损坏，部分记录暂时无法检索。',
    deltas: { evidence: -3, risk: 2 },
  },
  {
    level: 'warning', title: '小型设备故障',
    message: '一台辅助监测设备因积尘短路，需要更换。',
    deltas: { budget: -2, risk: 4 },
  },
]

const MEDIUM_EVENTS: RiskEvent[] = [
  {
    level: 'danger', title: '游客投诉',
    message: '因限流措施不完善，多位游客向文旅局投诉，引发了负面舆情。',
    deltas: { reputation: -5, risk: 5, budget: -1 },
  },
  {
    level: 'danger', title: '数据丢失',
    message: '监控系统突发断电，近2小时的监测数据永久丢失。',
    deltas: { evidence: -7, risk: 6 },
  },
  {
    level: 'danger', title: '墙体微裂缝',
    message: '后室暗窟湿度波动导致岩壁出现细微裂缝，需紧急注浆。',
    deltas: { reputation: -3, risk: 8, budget: -3, evidence: -2 },
  },
]

const MAJOR_EVENTS: RiskEvent[] = [
  {
    level: 'crisis', title: '壁画脱落实录',
    message: '第17窟壁画出现大面积起甲脱落！媒体已到场拍摄，文化遗产局紧急介入。',
    deltas: { reputation: -15, risk: -5, evidence: -10, budget: -5 },
  },
  {
    level: 'crisis', title: '安全事故',
    message: '供电柜短路引发小型火灾，所幸无人伤亡，但所有监控设备已离线。',
    deltas: { reputation: -12, risk: -8, evidence: -8, budget: -6 },
  },
  {
    level: 'crisis', title: '审计风暴',
    message: '国家文物局突击审计，发现多项保护记录缺失，研究院面临停业整顿。',
    deltas: { reputation: -18, risk: -10, evidence: -12, budget: -4 },
  },
]

/** 根据风险等级随机选择一个事件 */
export function rollRiskEvent(level: RiskLevel): RiskEvent | null {
  const chance = getRiskTriggerChance(level)
  if (Math.random() > chance) return null

  let pool: RiskEvent[]
  switch (level) {
    case 'warning': pool = MINOR_EVENTS; break
    case 'danger':  pool = MEDIUM_EVENTS; break
    case 'crisis':  pool = MAJOR_EVENTS; break
    default:        return null
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 应用风险事件的属性变化，并确保不越界 */
export function applyRiskDeltas(stats: GameStats, event: RiskEvent): GameStats {
  const next = { ...stats }
  for (const [key, val] of Object.entries(event.deltas)) {
    const k = key as keyof GameStats
    next[k] = Math.max(0, Math.min(k === 'budget' ? 20 : 100, next[k] + (val as number)))
  }
  return next
}
