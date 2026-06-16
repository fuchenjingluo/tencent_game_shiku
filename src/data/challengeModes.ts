// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 挑战模式数据层 v1.0
// 速通 / 铁人 / 每日巡检 / 混沌
// ────────────────────────────────────────────────────────────────────────────
import type { ChallengeConfig, ChallengeMode, DailySeed, SpeedrunLeaderboard, SpeedrunRecord, Stat } from '../types'

// ═══════════════════════════════════════════════════════════════════════════════
// 挑战模式配置
// ═══════════════════════════════════════════════════════════════════════════════

export const CHALLENGE_MODES: ChallengeConfig[] = [
  {
    id: 'speedrun',
    title: '⏱ 速通挑战',
    subtitle: 'SPEEDRUN',
    description: '计时器从开局启动，对话动画自动快进。用最短时间完成全部 5 项巡检任务。',
    rules: [
      '计时器在游戏开始时启动',
      '对话动画自动快进（不可跳过核心选择）',
      '结束时显示通关时间与分级',
      '分级：青铜 >20min / 白银 15-20min / 黄金 12-15min / 钻石 <12min',
    ],
    icon: '⏱️',
    color: '#7ab8d9',
    requiresPlaythrough: false,
  },
  {
    id: 'ironman',
    title: '🛡 铁人模式',
    subtitle: 'IRONMAN',
    description: '无法存档/读档，小游戏失败不可重试。每个选择都是最终决定——没有回头路。',
    rules: [
      '无存档/读档（退出不保留进度）',
      '小游戏失败 → 该步按失败结果结算，无法重来',
      '无 HUD 帮助提示',
      '为"零失误"硬核玩家准备',
    ],
    icon: '🛡️',
    color: '#d9a063',
    requiresPlaythrough: true,
  },
  {
    id: 'daily',
    title: '📅 每日巡检',
    subtitle: 'DAILY RUN',
    description: '每天生成唯一种子，各步骤的某个选项获得随机加成。探索今日最优决策路径。',
    rules: [
      '每日一个唯一随机种子',
      '某些步骤的特定选项获得额外加成',
      '全服玩家同一天面对相同种子',
      '适合反复挑战刷新记录',
    ],
    icon: '📅',
    color: '#8fae78',
    requiresPlaythrough: true,
  },
  {
    id: 'chaos',
    title: '🎲 混沌模式',
    subtitle: 'CHAOS',
    description: '所有选择的效果数值随机浮动（0.8-1.2倍），风险爆炸触发率 +10%。永远不知道下一局会发生什么。',
    rules: [
      '所有选项的效果数值 × 随机系数(0.8~1.2)',
      '风险爆炸触发率 +10%',
      '转化系统成本随机浮动',
      '小游戏随机出现"稀有版"（双倍奖励）',
    ],
    icon: '🎲',
    color: '#d95a54',
    requiresPlaythrough: true,
  },
]

export const CHALLENGE_MODE_MAP: Record<ChallengeMode, ChallengeConfig> = Object.fromEntries(
  CHALLENGE_MODES.map((c) => [c.id, c])
) as Record<ChallengeMode, ChallengeConfig>

// ═══════════════════════════════════════════════════════════════════════════════
// 每日种子生成
// ═══════════════════════════════════════════════════════════════════════════════

/** 简易确定性伪随机数生成器 (mulberry32) */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 从日期字符串生成种子 */
export function generateDailySeed(dateStr?: string): DailySeed {
  const today = dateStr ?? new Date().toISOString().slice(0, 10)
  // 将日期哈希为种子数
  let hash = 0
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash + today.charCodeAt(i)) | 0
  }
  const seed = Math.abs(hash)
  const rng = mulberry32(seed)

  // 为每个步骤生成一个偏好选项和加成
  const stepIds = [
    't1s1', 't1s2', 't2s1', 't2s2', 't3s1', 't3s2',
    't4s1', 't4s2', 't5s1', 't5s2',
  ]
  const stats: Stat[] = ['reputation', 'risk', 'evidence', 'budget']

  const stepBonuses: DailySeed['stepBonuses'] = {}
  for (const sid of stepIds) {
    const choiceIndex = Math.floor(rng() * 3)  // 0, 1, 2
    const statIndex = Math.floor(rng() * 4)
    const bonusValue = rng() > 0.5 ? 2 : 3     // +2 或 +3
    const bonus: Partial<Record<Stat, number>> = {}
    bonus[stats[statIndex]] = bonusValue
    // 10% 概率双加成
    if (rng() > 0.9) {
      const statIndex2 = (statIndex + 1 + Math.floor(rng() * 3)) % 4
      bonus[stats[statIndex2]] = (bonus[stats[statIndex2]] ?? 0) + 1
    }
    stepBonuses[sid] = { choiceIndex, bonus }
  }

  return { date: today, seed, stepBonuses }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 混沌模式随机系数
// ═══════════════════════════════════════════════════════════════════════════════

/** 生成混沌模式随机系数（每局一次） */
export function generateChaosMultiplier(): number {
  return 0.8 + Math.random() * 0.4  // 0.8 ~ 1.2
}

// ═══════════════════════════════════════════════════════════════════════════════
// 速通排行榜本地持久化
// ═══════════════════════════════════════════════════════════════════════════════

const SPEEDRUN_KEY = 'grotto_speedrun_leaderboard'

export function getSpeedrunLeaderboard(): SpeedrunLeaderboard {
  try {
    const raw = localStorage.getItem(SPEEDRUN_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { version: 1, bestTime: null, recentRuns: [] }
}

export function saveSpeedrunRecord(record: SpeedrunRecord): void {
  const lb = getSpeedrunLeaderboard()
  lb.recentRuns.unshift(record)
  // 只保留最近 20 条
  if (lb.recentRuns.length > 20) lb.recentRuns = lb.recentRuns.slice(0, 20)
  // 更新最佳时间
  if (!lb.bestTime || record.timeMs < lb.bestTime.timeMs) {
    lb.bestTime = record
  }
  localStorage.setItem(SPEEDRUN_KEY, JSON.stringify(lb))
}

/** 速通时间分级 */
export function getSpeedrunGrade(timeMs: number): { tier: string; label: string; color: string } {
  const mins = timeMs / 60000
  if (mins < 12) return { tier: 'diamond', label: '💎 钻石', color: '#7ab8d9' }
  if (mins < 15) return { tier: 'gold', label: '🥇 黄金', color: '#d7bd73' }
  if (mins < 20) return { tier: 'silver', label: '🥈 白银', color: '#c0c0c0' }
  return { tier: 'bronze', label: '🥉 青铜', color: '#cd7f32' }
}

/** 格式化毫秒为 mm:ss */
export function formatSpeedrunTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}
