// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 属性转化系统
// 四个属性可以相互转化，创造策略深度：
//   证据 → 掩盖风险   预算 → 购买声誉
//   声誉 → 换取预算   预算 → 降低风险
// ────────────────────────────────────────────────────────────────────────────
import type { StatConversion } from '../types'

/**
 * 全局转化操作列表
 * 每个转化用 oneTime=true 标记为一次性操作
 * 用 used 标记是否已被消耗
 */
export const CONVERSIONS: StatConversion[] = [
  // ── 证据 → 掩盖风险 ──
  {
    id: 'cover_up',
    label: '消耗证据掩盖风险',
    desc: '利用已收集的监测数据，向审计方证明风险已在控制之中。',
    cost: { evidence: 8 },
    gain: { risk: -12 },
    oneTime: true,
  },
  // ── 预算 → 购买声誉 ──
  {
    id: 'bribe_media',
    label: '邀请权威媒体专访',
    desc: '花费预算安排央视文保专题节目，正面宣传研究成果，大幅提升公众声誉。',
    cost: { budget: 6 },
    gain: { reputation: 10 },
    oneTime: true,
  },
  // ── 声誉 → 换取预算 ──
  {
    id: 'apply_funding',
    label: '申请紧急经费',
    desc: '利用良好声誉向文化遗产局申请紧急保护经费，但过度申请会透支信任。',
    cost: { reputation: 5 },
    gain: { budget: 8 },
    oneTime: true,
  },
  // ── 预算 → 降低风险 ──
  {
    id: 'emergency_repair',
    label: '紧急设备维修',
    desc: '花费预算紧急购买高精度设备，替换老旧传感器，有效降低系统风险。',
    cost: { budget: 5 },
    gain: { risk: -8 },   // 2.0→1.6 转化率，与同级转化持平
    oneTime: true,
  },
  // ── 声誉 → 降低风险（特殊） ──
  {
    id: 'call_favors',
    label: '动用专家人脉',
    desc: '利用个人声誉邀请业内顶尖修复专家飞抵现场，紧急指导风险处置。',
    cost: { reputation: 4 },
    gain: { risk: -8, evidence: 3 },
    oneTime: true,
  },
  // ── 证据 → 换取预算 ──
  {
    id: 'sell_data',
    label: '变卖非核心数据',
    desc: '将部分历史监测数据授权给大学研究机构，换取研究经费。性价比与"申请紧急经费"持平。',
    cost: { evidence: 5 },
    gain: { budget: 8 },   // 0.8→1.6 转化率，不再是严格劣势
    oneTime: true,
  },
]

/** 获取所有可用的转化操作（已使用的排除） */
export function getAvailableConversions(): StatConversion[] {
  return CONVERSIONS.filter((c) => !c.used)
}

/** 检查转化是否可执行（是否有足够的属性消耗） */
export function canAffordConversion(
  stats: { reputation: number; risk: number; evidence: number; budget: number },
  conversion: StatConversion,
): boolean {
  for (const [key, val] of Object.entries(conversion.cost)) {
    const k = key as keyof typeof stats
    if ((stats[k] ?? 0) < (val as number)) return false
  }
  return true
}
