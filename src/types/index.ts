// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 全局类型定义 v2.0
// 新增：属性转化、风险爆炸、gameFlags因果链、三选一、叙事绑定
// ────────────────────────────────────────────────────────────────────────────

export type MiniGameType =
  | 'trace'
  | 'memory'
  | 'match'
  | 'timing'
  | 'calibrate'
  | 'wire'
  | 'sequence'
  | 'puzzle'

export interface MiniGameConfig {
  type: MiniGameType
  difficulty: 1 | 2 | 3
  prompt: string
  /** 叙事绑定：小游戏即操作本身的原因（如"你正在用热像仪扫描潮湿边界"） */
  narrativeBinding: string
}

/** 选择风格 — 决定选项的玩法哲学 */
export type ChoiceStyle = 'professional' | 'compromise' | 'risky'

export interface Choice {
  id: string
  label: string
  desc: string
  style: ChoiceStyle
  /** 选择后的属性变化（基础） */
  deltas: Partial<Record<Stat, number>>
  miniGame: MiniGameConfig
  /** 小游戏成功额外奖励 */
  successDeltas: Partial<Record<Stat, number>>
  /** 小游戏失败惩罚 */
  failDeltas: Partial<Record<Stat, number>>
  /** 该选择设置的 gameFlags */
  setFlags?: Record<string, boolean>
  /** 该选择需要满足的 gameFlags 才可用 */
  requireFlags?: Record<string, boolean>
  /** 不满足 requireFlags 时的禁用提示 */
  requireHint?: string
}

export interface TaskStep {
  id: string
  description: string
  locationKey: string
  choices: [Choice, Choice, Choice]
}

export interface Task {
  id: string
  title: string
  npcKey: string
  briefing: string
  steps: [TaskStep, TaskStep]
  completedMessage: string
  midTaskDialog?: string  // NPC 在第一步完成后、第二步开始前的进展反馈
}

export type Stat = 'reputation' | 'risk' | 'evidence' | 'budget'

export interface GameStats {
  reputation: number
  risk: number      // 0-100，越高越危险
  evidence: number
  budget: number
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

/** 结局标签 — 6 种结局判定 */
export type EndingType =
  | 'grotto_guardian'   // 石窟守护者 — 平衡大师
  | 'radical_reformer'  // 激进改革者 — 高风险高回报
  | 'barely_holding'    // 勉力维持者 — 资源匮乏但坚持
  | 'archive_expert'    // 档案专家 — 数据驱动型
  | 'whistleblower'     // 吹哨人 — 不惧权威
  | 'grottos_lament'    // 石窟之殇 — 失败结局

/** 结局元数据 */
export interface EndingMeta {
  type: EndingType
  title: string
  subtitle: string
  description: string
  flavorText: string
  icon: string
  color: string
}

/** 因果回溯条目 */
export interface CausalTrace {
  flag: string
  choiceLabel: string
  consequence: string
  alternativeLabel?: string
  alternativeConsequence?: string
}

/** NG+ 加成类型 */
export type NGPlusBonus = 'experience' | 'archives' | 'funding'

// ─── 成就系统 ──────────────────────────────────────────────────────────────

export type AchievementCategory = 'ending' | 'challenge' | 'discovery'

export interface Achievement {
  id: string
  name: string
  description: string
  category: AchievementCategory
  icon: string
  secret?: boolean        // 隐藏成就 — 解锁前不显示名称和描述
  detect: (run: AchievementRunMeta) => boolean
}

/** 单次游戏的运行元数据 — 用于成就检测 */
export interface AchievementRunMeta {
  stats: GameStats
  flags: GameFlags
  minigameSuccesses: number
  minigameAttempts: number
  riskEventsTriggered: number
  conversionsUsed: string[]
  hiddenPointsFound: string[]
  storyEventsSeen: string[]
  completedTaskCount: number
  playTimeMs: number
  ending: EndingType
  professionalCount: number
  compromiseCount: number
  riskyCount: number
}

/** 已解锁成就快照 */
export interface AchievementSnapshot {
  id: string
  unlockedAt: number      // timestamp
  playthrough: number     // 第几周目解锁
}

/** 持久化的成就状态 */
export interface AchievementState {
  version: number
  unlocked: Record<string, AchievementSnapshot>
  totalPlaythroughs: number
}

/** NG+ 加成配置 */
export interface NGPlusBonusConfig {
  id: NGPlusBonus
  title: string
  subtitle: string
  description: string
  icon: string
  color: string
  apply: (stats: GameStats) => GameStats
}

/** 风险等级 */
export type RiskLevel = 'safe' | 'warning' | 'danger' | 'crisis'

/** 风险爆炸事件 */
export interface RiskEvent {
  level: RiskLevel
  title: string
  message: string
  deltas: Partial<Record<Stat, number>>
}

export type GamePhase =
  | 'loading'
  | 'title'
  | 'explore'
  | 'dialog'
  | 'choice'
  | 'minigame'
  | 'result'
  | 'risk_event'
  | 'report'

export interface DialogLine {
  speaker: string
  text: string
  portrait?: string
}

export interface ActiveTask {
  taskId: string
  stepIndex: 0 | 1
  choiceId?: string
  miniGameResult?: boolean
}

/** 全局因果标志 — 玩家选择影响后续任务 */
export type GameFlags = Record<string, boolean>

export interface GameSave {
  version: number
  stats: GameStats
  completedTasks: string[]
  activeTask: ActiveTask | null
  gameFlags: GameFlags
  timestamp: number
}

// ─── 地图配置类型 ──────────────────────────────────────────────────────────

export interface RoomConfig {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  darkness: number  // 0-1，暗度
}

export interface CorridorConfig {
  x: number
  y: number
  w: number
  h: number
  connects: string
}

export type InteractType = 'npc' | 'monitor' | 'gate' | 'equipment' | 'power' | 'archive' | 'hidden'

export interface InteractPointConfig {
  id: string
  type: InteractType
  name: string
  roomId: string
  offsetX: number
  offsetY: number
}

// ─── 属性转化操作 ──────────────────────────────────────────────────────────

export interface StatConversion {
  id: string
  label: string
  desc: string
  cost: Partial<Record<Stat, number>>
  gain: Partial<Record<Stat, number>>
  oneTime?: boolean
  used?: boolean
}

// ─── Event Bus ──────────────────────────────────────────────────────────────

/** 寻路目标 */
export interface Objective {
  type: 'npc' | 'point'
  targetId: string     // npcKey or pointId
  roomId: string
  roomName: string
  name: string
  description: string
}

export interface BusEvents {
  'game:ready': void
  'player:near-npc': { npcKey: string }
  'player:left-npc': { npcKey: string }
  'player:near-point': { pointKey: string }
  'player:left-point': { pointKey: string }
  'open:dialog': { lines: DialogLine[]; onClose?: () => void }
  'open:choice': { step: TaskStep; taskTitle: string }
  'show:result': { success: boolean; deltas: Partial<Record<Stat, number>> }
  'show:risk_event': RiskEvent
  'stats:update': GameStats
  'stats:animate': { stat: Stat; delta: number }
  'task:completed': { taskId: string }
  'game:over': { stats: GameStats; flags: GameFlags }
  'ui:lock-input': boolean
  'ui:choice-made': { choiceId: string; stepId: string; style: string }
  'ui:minigame-done': { success: boolean }
  'ui:dialog-closed': void
  'ui:result-closed': void
  'ui:risk-event-closed': void
  'game:resume': void
  'game:load-save': GameSave
  'flags:set': { key: string; value: boolean }
  'hidden:found': { pointKey: string }
  'challenge:mode': string
  'objective:changed': Objective | null
  'objective:request': void
  'open:conversion': void
  'tourist:event': { eventId: string; title: string; introLines: { speaker: string; text: string }[]; durationMs: number; action: string }
  'tourist:event-resolve': { eventId: string; success: boolean; choiceId?: string; choiceDeltas?: Partial<Record<string, number>> }
  'tourist:density-changed': number
  'sidequest:offer': { questId: string; title: string; briefing: string; npcName: string }
  'sidequest:complete': { questId: string }
}

export type BusEventKey = keyof BusEvents

// ─── 挑战模式 ──────────────────────────────────────────────────────────────

/** 挑战模式类型 */
export type ChallengeMode = 'speedrun' | 'ironman' | 'daily' | 'chaos'

/** 挑战模式配置 */
export interface ChallengeConfig {
  id: ChallengeMode
  title: string
  subtitle: string
  description: string
  rules: string[]
  icon: string
  color: string
  /** 是否需要至少一次通关才解锁 */
  requiresPlaythrough: boolean
}

/** 速通记录 */
export interface SpeedrunRecord {
  timeMs: number
  grade: string
  ending: EndingType
  timestamp: number
  playthrough: number
}

/** 速通排行榜（本地持久化） */
export interface SpeedrunLeaderboard {
  version: number
  bestTime: SpeedrunRecord | null
  recentRuns: SpeedrunRecord[]
}

/** 每日种子数据 */
export interface DailySeed {
  date: string          // YYYY-MM-DD
  seed: number
  /** 每个步骤的额外加成（key: stepId, value: 偏好的choice index） */
  stepBonuses: Record<string, { choiceIndex: number; bonus: Partial<Record<Stat, number>> }>
}
