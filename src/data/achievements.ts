// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 成就系统 v1.0
// 18 成就：6结局 + 8挑战 + 4发现
// ────────────────────────────────────────────────────────────────────────────
import type { Achievement, AchievementRunMeta, AchievementState, AchievementSnapshot } from '../types'

// ═══════════════════════════════════════════════════════════════════════════════
// 成就定义
// ═══════════════════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS: Achievement[] = [
  // ── 结局成就 (6) ─────────────────────────────────────────────────────────
  {
    id: 'ach_guardian',
    name: '石窟守护者',
    description: '以平衡之道获得 S 评级并解锁"石窟守护者"结局',
    category: 'ending',
    icon: '🛡️',
    detect: (r) => r.ending === 'grotto_guardian',
  },
  {
    id: 'ach_reformer',
    name: '激进改革者',
    description: '高风险高回报——以"激进改革者"结局完成游戏',
    category: 'ending',
    icon: '⚡',
    detect: (r) => r.ending === 'radical_reformer',
  },
  {
    id: 'ach_survivor',
    name: '勉力维持者',
    description: '预算见底、风险高企——但你撑过来了',
    category: 'ending',
    icon: '🕯️',
    detect: (r) => r.ending === 'barely_holding',
  },
  {
    id: 'ach_archivist',
    name: '档案专家',
    description: '收集 80+ 证据并解锁"档案专家"结局',
    category: 'ending',
    icon: '📚',
    detect: (r) => r.ending === 'archive_expert',
  },
  {
    id: 'ach_whistleblower',
    name: '沉默的守护者',
    description: '低声誉完成所有任务——真相不需要头衔',
    category: 'ending',
    icon: '📢',
    detect: (r) => r.ending === 'whistleblower',
  },
  {
    id: 'ach_lament',
    name: '千年之痕',
    description: '在高风险下勉力完成——失败是守护者的必修课',
    category: 'ending',
    icon: '💔',
    detect: (r) => r.ending === 'grottos_lament',
  },

  // ── 挑战成就 (8) ─────────────────────────────────────────────────────────
  {
    id: 'ach_perfect',
    name: '零失误',
    description: '全部 10 次小游戏一次通过',
    category: 'challenge',
    icon: '🎯',
    detect: (r) => r.minigameAttempts === 10 && r.minigameSuccesses === 10,
  },
  {
    id: 'ach_speed',
    name: '石窟疾风',
    description: '15 分钟内完成全部 5 个任务',
    category: 'challenge',
    icon: '⚡',
    detect: (r) => r.playTimeMs > 0 && r.playTimeMs < 15 * 60 * 1000,
  },
  {
    id: 'ach_bankrupt',
    name: '分文不剩',
    description: '预算归零后仍完成至少 2 个任务',
    category: 'challenge',
    icon: '💸',
    detect: (r) => r.stats.budget <= 0,
  },
  {
    id: 'ach_riskfree',
    name: '滴水不漏',
    description: '全程风险从未超过 50',
    category: 'challenge',
    icon: '🛡️',
    detect: (r) => r.stats.risk <= 50 && r.riskEventsTriggered === 0,
  },
  {
    id: 'ach_disaster',
    name: '与灾难共舞',
    description: '触发 5+ 风险事件但仍完成了所有任务',
    category: 'challenge',
    icon: '🌪️',
    detect: (r) => r.riskEventsTriggered >= 5,
  },
  {
    id: 'ach_noconvert',
    name: '自力更生',
    description: '不使用任何属性转化完成游戏',
    category: 'challenge',
    icon: '💪',
    detect: (r) => r.conversionsUsed.length === 0,
  },
  {
    id: 'ach_allconvert',
    name: '外交大师',
    description: '使用全部 6 种属性转化操作',
    category: 'challenge',
    icon: '🤝',
    detect: (r) => r.conversionsUsed.length >= 6,
  },
  {
    id: 'ach_180',
    name: '180度转变',
    description: '同一局中混合使用专业、妥协、激进三种风格各至少 2 次',
    category: 'challenge',
    icon: '🔄',
    detect: (r) => r.professionalCount >= 2 && r.compromiseCount >= 2 && r.riskyCount >= 2,
  },

  // ── 发现成就 (4) ─────────────────────────────────────────────────────────
  {
    id: 'ach_hidden',
    name: '暗窟秘密',
    description: '找到全部 3 个隐藏交互点',
    category: 'discovery',
    icon: '🔍',
    detect: (r) => r.hiddenPointsFound.length >= 3,
  },
  {
    id: 'ach_causality',
    name: '因果链大师',
    description: '在一个周目中触发 8+ 个因果标志（gameFlags）',
    category: 'discovery',
    icon: '🧬',
    detect: (r) => Object.keys(r.flags).filter((k) => r.flags[k]).length >= 8,
  },
  {
    id: 'ach_story',
    name: '故事猎人',
    description: '触发所有 10 个故事事件（需多周目，不计入单局检测）',
    category: 'discovery',
    icon: '📖',
    secret: true,
    // 此成就跨周目累计，在 AchievementStore 中特殊处理
    detect: () => false,
  },
  {
    id: 'ach_reader',
    name: '不放过任何细节',
    description: '在每个任务中至少选择过一次专业方案',
    category: 'discovery',
    icon: '📝',
    detect: (r) => r.professionalCount >= 5,
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// 成就存储（localStorage）
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'cave_guardian_achievements'
const STATE_VERSION = 1

function loadState(): AchievementState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: STATE_VERSION, unlocked: {}, totalPlaythroughs: 0 }
    const parsed = JSON.parse(raw) as AchievementState
    if (parsed.version !== STATE_VERSION) {
      // 未来版本迁移入口
      return { version: STATE_VERSION, unlocked: {}, totalPlaythroughs: 0 }
    }
    return parsed
  } catch {
    return { version: STATE_VERSION, unlocked: {}, totalPlaythroughs: 0 }
  }
}

function saveState(state: AchievementState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage 满了也静默
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════════════════════════════

let _state = loadState()

/** 获取成就状态快照（只读） */
export function getAchievementState(): AchievementState {
  return _state
}

/** 检查某个成就是否已解锁 */
export function isUnlocked(id: string): boolean {
  return id in _state.unlocked
}

/** 对一次通关结果运行成就检测，返回新解锁的成就列表 */
export function detectAchievements(run: AchievementRunMeta, playthrough: number): Achievement[] {
  const newlyUnlocked: Achievement[] = []
  const now = Date.now()

  for (const ach of ACHIEVEMENTS) {
    if (ach.id in _state.unlocked) continue
    try {
      if (ach.detect(run)) {
        _state.unlocked[ach.id] = {
          id: ach.id,
          unlockedAt: now,
          playthrough,
        }
        newlyUnlocked.push(ach)
      }
    } catch {
      // 检测函数出错 = 不授予成就
    }
  }

  if (newlyUnlocked.length > 0) {
    saveState(_state)
  }

  return newlyUnlocked
}

/** 更新总通关次数 */
export function incrementPlaythroughs() {
  _state.totalPlaythroughs++
  saveState(_state)
}

/** 跨周目成就特殊检测 — story hunter 需要多周目累计 */
export function detectCrossRunAchievement(storyFlagsSeen: string[]): Achievement | null {
  if ('ach_story' in _state.unlocked) return null

  // 累积追踪已见过的故事事件
  const seenKey = '_story_flags_seen'
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem('cave_guardian_story_flags') ?? '[]') as string[]
    } catch {
      return []
    }
  })()

  // 合并新见到的flags
  const merged = [...new Set([...stored, ...storyFlagsSeen])]
  localStorage.setItem('cave_guardian_story_flags', JSON.stringify(merged))

  // 总共10个故事事件：检查是否全部触发过
  if (merged.length >= 10) {
    const now = Date.now()
    _state.unlocked['ach_story'] = {
      id: 'ach_story',
      unlockedAt: now,
      playthrough: _state.totalPlaythroughs,
    }
    saveState(_state)
    return ACHIEVEMENTS.find((a) => a.id === 'ach_story') ?? null
  }

  return null
}

/** 获取故事猎人成就的进度 (X/10) */
export function getStoryProgress(): { seen: number; total: number } {
  try {
    const stored = JSON.parse(localStorage.getItem('cave_guardian_story_flags') ?? '[]') as string[]
    return { seen: stored.length, total: 10 }
  } catch {
    return { seen: 0, total: 10 }
  }
}

/** 获取已解锁成就数量 / 总数 */
export function getProgress(): { unlocked: number; total: number } {
  return {
    unlocked: Object.keys(_state.unlocked).length,
    total: ACHIEVEMENTS.length,
  }
}

/** 重置成就（调试用） */
export function resetAchievements() {
  _state = { version: STATE_VERSION, unlocked: {}, totalPlaythroughs: 0 }
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('cave_guardian_story_flags')
}
