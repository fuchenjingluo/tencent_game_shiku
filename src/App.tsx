// ────────────────────────────────────────────────────────────────────────────
// App.tsx v2.0 — 整合 Phaser + React UI + gameFlags + 风险事件
// ────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback, Component, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { bus } from './events/bus'
import { createGame, destroyGame, getGameScene } from './phaser/gameFactory'
import { INITIAL_STATS, TASKS, STORY_EVENTS, SIDE_QUESTS } from './data/gameData'
import { writeSave, deleteSave } from './hooks/useSave'
import { initAudio, destroyAudio } from './audio/audioManager'
import { ConversionPanel } from './components/ConversionPanel'
import { HUD } from './components/hud/HUD'
import { DialogController } from './components/dialog/DialogBox'
import { ChoicePanelController } from './components/dialog/ChoicePanel'
import { MiniGameController } from './components/minigames/MiniGameController'
import { FinalReport } from './components/report/FinalReport'
import { NGPlusSelector, NGPLUS_BONUSES } from './components/report/NGPlusSelector'
import { AchievementPanel } from './components/ui/AchievementPanel'
import { TitleScreen } from './components/TitleScreen'
import type { GameStats, Choice, TaskStep, Stat, ActiveTask, GameFlags, GameSave, RiskEvent, NGPlusBonus, EndingType, AchievementRunMeta, Achievement, ChallengeMode } from './types'
import { detectAchievements, incrementPlaythroughs, detectCrossRunAchievement, getAchievementState } from './data/achievements'
import { generateDailySeed, generateChaosMultiplier, saveSpeedrunRecord, getSpeedrunGrade, formatSpeedrunTime } from './data/challengeModes'
import type { DailySeed } from './types'

/** NG+ 加成快速查找表 */
const NGPLUS_BONUS_MAP: Record<NGPlusBonus, (s: GameStats) => GameStats> = {
  experience: NGPLUS_BONUSES[0].apply,
  archives: NGPLUS_BONUSES[1].apply,
  funding: NGPLUS_BONUSES[2].apply,
}

// ─── ErrorBoundary ─────────────────────────────────────────────────────────

interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#12110d',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#d98f72', fontFamily: 'monospace', padding: 32,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>游戏遇到了错误</div>
          <div style={{ fontSize: 11, color: '#8b7355', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 24, padding: '10px 24px', background: 'transparent', border: '1px solid #d7bd73', borderRadius: 6, color: '#d7bd73', cursor: 'pointer', fontSize: 13 }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── 主 App ────────────────────────────────────────────────────────────────

type AppPhase = 'loading' | 'title' | 'playing' | 'gameover' | 'ngplus' | 'achievements' | 'conversion'

// ─── 模块级标志 — 不受 React StrictMode 双 mount 影响 ───
let autoGameCreated = false
let pendingGameStart = false  // ★ 标记"开始游戏"触发的 boot，完成后切到 playing 而非 title

export default function App() {
  const gameContainerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS)
  const [completedTasks, setCompletedTasks] = useState<string[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [finalStats, setFinalStats] = useState<GameStats | null>(null)
  const [finalFlags, setFinalFlags] = useState<GameFlags>({})
  const [gameFlags, setGameFlags] = useState<GameFlags>({})
  const [riskEvent, setRiskEvent] = useState<RiskEvent | null>(null)
  const [playthroughCount, setPlaythroughCount] = useState(0)   // 0 = 首周目
  const [ngPlusBonus, setNgPlusBonus] = useState<NGPlusBonus | null>(null)
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const [showAchievementPopup, setShowAchievementPopup] = useState(false)
  const [challengeMode, setChallengeMode] = useState<ChallengeMode | null>(null)
  const challengeModeRef = useRef<ChallengeMode | null>(null)
  const activeTaskRef = useRef<ActiveTask | null>(null)

  // 运行元数据 — 成就检测用
  const runMetaRef = useRef<Omit<AchievementRunMeta, 'stats' | 'flags' | 'ending'>>({
    minigameSuccesses: 0,
    minigameAttempts: 0,
    riskEventsTriggered: 0,
    conversionsUsed: [],
    hiddenPointsFound: [],
    storyEventsSeen: [],
    completedTaskCount: 0,
    playTimeMs: 0,
    professionalCount: 0,
    compromiseCount: 0,
    riskyCount: 0,
  })
  const runStartTime = useRef(0)
  // 追踪 style 计数
  const styleCountRef = useRef<{ professional: number; compromise: number; risky: number }>({
    professional: 0, compromise: 0, risky: 0,
  })
  // 每日种子 + 混沌系数
  const dailySeedRef = useRef<DailySeed | null>(null)
  const chaosMultRef = useRef<number>(1.0)

  // 同步 stats 到 Phaser
  useEffect(() => {
    if (phase === 'playing') bus.emit('stats:update', stats)
  }, [stats, phase])

  // ★ 页面刷新后自动启动 Phaser 游戏，驱动 #root-loader 进度条
  // ★ 使用模块级变量 autoGameCreated 而非 useRef：
  //    React 18 StrictMode unmount+remount 时会清除 useEffect 的 timeout，
  //    但模块变量不受组件生命周期影响，确保游戏只创建一次。
  useEffect(() => {
    if (autoGameCreated) return
    autoGameCreated = true
    if (gameContainerRef.current) {
      createGame(gameContainerRef.current)
    }
  }, [])

  // ★ 监听 boot:complete — 区分"初始加载"和"开始游戏"
  useEffect(() => {
    const onBootComplete = () => {
      if (pendingGameStart) {
        // ★ "开始游戏"触发的 boot 完成 → 进入游戏
        pendingGameStart = false
        setPhase('playing')
      } else {
        // 初始页面加载完成 → 显示标题画面
        setPhase((prev) => prev === 'loading' ? 'title' : prev)
      }
    }
    window.addEventListener('boot:complete', onBootComplete)
    return () => window.removeEventListener('boot:complete', onBootComplete)
  }, [])

  // 启动游戏
  const startGame = useCallback((save: GameSave | null) => {
    // ★ 防止重复点击"开始游戏"导致竞态
    if (pendingGameStart) return

    initAudio()
    const mode = challengeModeRef.current

    // 铁人模式：不接受存档，删除已有存档
    if (mode === 'ironman') {
      deleteSave()
      save = null
    }

    if (save) {
      setStats(save.stats)
      setCompletedTasks(save.completedTasks)
      setActiveTaskId(save.activeTask?.taskId ?? null)
      setGameFlags(save.gameFlags ?? {})
      activeTaskRef.current = save.activeTask
    } else {
      // 应用 NG+ 加成（如果有）
      const base = ngPlusBonus
        ? NGPLUS_BONUS_MAP[ngPlusBonus](INITIAL_STATS)
        : INITIAL_STATS
      setStats(base)
      setCompletedTasks([])
      setActiveTaskId(null)
      setGameFlags({})
      activeTaskRef.current = null
      // 消耗加成标记（仅首周目后的新游戏生效）
      setNgPlusBonus(null)
      // 重置运行元数据
      runMetaRef.current = {
        minigameSuccesses: 0,
        minigameAttempts: 0,
        riskEventsTriggered: 0,
        conversionsUsed: [],
        hiddenPointsFound: [],
        storyEventsSeen: [],
        completedTaskCount: 0,
        playTimeMs: 0,
        professionalCount: 0,
        compromiseCount: 0,
        riskyCount: 0,
      }
      styleCountRef.current = { professional: 0, compromise: 0, risky: 0 }
      runStartTime.current = Date.now()
      // 每日/混沌模式初始化
      if (mode === 'daily') {
        dailySeedRef.current = generateDailySeed()
      }
      if (mode === 'chaos') {
        chaosMultRef.current = generateChaosMultiplier()
      }
    }

    // ★ 先销毁旧游戏 → 防止旧 GameScene 在 TitleScreen 消失后短暂露出来
    destroyGame()

    // ★ 切到 loading 阶段 → 显示 #root-loader 加载条
    pendingGameStart = true
    setPhase('loading')

    // ★ 立即显示加载条并创建新游戏（不需要 setTimeout）
    window.dispatchEvent(new CustomEvent('boot:reset'))
    if (gameContainerRef.current) {
      createGame(gameContainerRef.current)
      // 传递挑战模式到 GameScene
      if (challengeMode) {
        setTimeout(() => bus.emit('challenge:mode', challengeMode), 200)
      }
    }
  }, [])

  // 监听游戏事件
  useEffect(() => {
    const unsubs = [
      bus.on('game:ready', () => {
        const loader = document.getElementById('root-loader')
        if (loader) loader.style.display = 'none'
        setPhase((prev) => prev === 'loading' ? 'title' : prev)
      }),

      bus.on('task:completed', ({ taskId }) => {
        setCompletedTasks((prev) => [...prev, taskId])
        runMetaRef.current.completedTaskCount++
        setActiveTaskId(null)
        activeTaskRef.current = null
      }),

      bus.on('game:over', ({ stats: finalS, flags }) => {
        setFinalStats(finalS)
        setFinalFlags(flags ?? {})
        const newCount = playthroughCount + 1
        setPlaythroughCount(newCount)
        setPhase('gameover')
        deleteSave()

        // 运行成就检测
        incrementPlaythroughs()
        const ending: EndingType = (() => {
          const r = finalS.reputation; const risk = finalS.risk; const ev = finalS.evidence; const b = finalS.budget
          if (risk >= 80) return 'grottos_lament'
          if (r >= 80 && risk <= 30) return 'grotto_guardian'
          if (r <= 30 && ev >= 60) return 'whistleblower'
          if (ev >= 80) return 'archive_expert'
          if (r >= 60 && risk <= 20) return 'radical_reformer'
          if (b <= 2 && risk >= 60) return 'barely_holding'
          const safety = 100 - risk
          if (r >= safety && r >= ev) return 'grotto_guardian'
          if (ev >= r && ev >= safety) return 'archive_expert'
          return 'barely_holding'
        })()
        const runMeta: AchievementRunMeta = {
          stats: finalS,
          flags: flags ?? {},
          ending,
          playTimeMs: Date.now() - runStartTime.current,
          ...runMetaRef.current,
        }
        const unlocked = detectAchievements(runMeta, newCount)
        if (unlocked.length > 0) {
          setNewAchievements(unlocked)
          setShowAchievementPopup(true)
        }

        // 跨周目成就检测（使用实际触发过的故事事件，而非 gameFlags）
        detectCrossRunAchievement(runMetaRef.current.storyEventsSeen)

        // 速通排行榜记录
        if (challengeMode === 'speedrun') {
          const playTime = Date.now() - runStartTime.current
          saveSpeedrunRecord({
            timeMs: playTime,
            grade: getSpeedrunGrade(playTime).tier,
            ending,
            timestamp: Date.now(),
            playthrough: newCount,
          })
        }
      }),

      bus.on('show:risk_event', (evt) => {
        setRiskEvent(evt)
        runMetaRef.current.riskEventsTriggered++
      }),

      bus.on('flags:set', ({ key, value }) => {
        setGameFlags((prev) => ({ ...prev, [key]: value }))
        // 追踪转化使用（以 conversion_ 前缀标记）
        if (key.startsWith('conversion_') && value) {
          const convId = key.replace('conversion_', '')
          if (!runMetaRef.current.conversionsUsed.includes(convId)) {
            runMetaRef.current.conversionsUsed.push(convId)
          }
        }
      }),

      // 隐藏交互点发现追踪
      bus.on('hidden:found', ({ pointKey }) => {
        runMetaRef.current.hiddenPointsFound.push(pointKey)
      }),

      // 打开转化面板
      bus.on('open:conversion', () => {
        setPhase('conversion')
      }),

      // ═══ P1: 游客事件 ═══
      bus.on('tourist:event', ({ eventId, title, introLines, durationMs, action }) => {
        bus.emit('open:dialog', {
          lines: [
            ...introLines,
            { speaker: '⏱ 倒计时', text: action === 'timing' || action === 'chase'
              ? `你有 ${Math.floor(durationMs / 1000)} 秒的时间前往事发地点并进行紧急干预！`
              : '请前往事发地点处理游客事件。' },
          ],
          // ★ 修复: GameScene.onEventTrigger 已 lock 输入，此处不应 unlock
          // 游客事件期间 input 保持 lock，直到玩家到达现场 interact 或事件超时
        })
      }),

      // ═══ P2: 支线任务事件 ═══
      bus.on('sidequest:offer', ({ questId, title, briefing, npcName }) => {
        bus.emit('open:dialog', {
          lines: [
            { speaker: '🎒 ' + npcName, text: briefing },
            { speaker: '系统', text: '是否接受这个支线任务？支线任务不影响主线流程，但能获得额外奖励。' },
          ],
          onClose: () => {
            // 自动接受支线任务
            bus.emit('ui:lock-input', true)
            bus.emit('open:dialog', {
              lines: [
                { speaker: '系统', text: '支线任务已激活：' + title },
                { speaker: '系统', text: SIDE_QUESTS.find(q => q.id === questId)?.locationHint ?? '请按指引前往目标地点。' },
              ],
            })
            // 设置支线目标
            const sq = SIDE_QUESTS.find(q => q.id === questId)
            if (sq) {
              const locKey = questId === 'sq_lost_phone' ? 'rear-humidity' : 'mural-monitor'
              bus.emit('objective:changed', {
                type: 'point',
                targetId: locKey,
                roomId: questId === 'sq_lost_phone' ? 'rear-cave' : 'mural-room',
                roomName: questId === 'sq_lost_phone' ? '后室暗窟' : '壁画保护区',
                name: '🎒 ' + title,
                description: sq.locationHint,
              })
            }
          },
        })
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [])

  // 自动存档（铁人模式禁用）
  useEffect(() => {
    if (phase !== 'playing') return
    if (challengeMode === 'ironman') return
    writeSave(stats, completedTasks, activeTaskRef.current, gameFlags)
  }, [stats, completedTasks, phase, gameFlags, challengeMode])

  // 处理选择
  const handleChoice = useCallback((choice: Choice, step: TaskStep) => {
    // ═══ P1: 游客事件特殊处理 ═══
    if (step.id === 'tourist_event' || step.id.startsWith('tourist_')) {
      // ★ 修复: 三种选择都是合法响应，不应只有 tourist_resolve 才 success
      // tourist_ignore → 观察获得证据；tourist_harsh → 严厉警告获得更高风险减免
      const isSuccess = true  // 所有响应都是成功的"干预"
      // 传递 choiceId 以便 GameScene 区分不同选择的对话文本
      bus.emit('tourist:event-resolve', {
        eventId: step.id,
        success: isSuccess,
        choiceId: choice.id,
        choiceDeltas: choice.deltas,
      })

      // 设置 flags
      if (choice.setFlags) {
        Object.entries(choice.setFlags).forEach(([k, v]) => {
          setGameFlags((prev) => ({ ...prev, [k]: v }))
          bus.emit('flags:set', { key: k, value: v })
        })
      }
      return
    }

    // ═══ P2: 支线任务特殊处理 ═══
    if (step.id === 'sq_lost_phone' || step.id === 'sq_artifact_talk') {
      styleCountRef.current[choice.style]++
      // 触发小游戏
      const event = new CustomEvent('minigame:start', {
        detail: {
          choice,
          step,
          challengeMode: null as ChallengeMode | null,
          dailyBonus: null,
          chaosMult: 1.0,
          isSideQuest: true,
        },
      })
      window.dispatchEvent(event)
      return
    }

    // 追踪选择风格计数
    styleCountRef.current[choice.style]++
    runMetaRef.current.professionalCount = styleCountRef.current.professional
    runMetaRef.current.compromiseCount = styleCountRef.current.compromise
    runMetaRef.current.riskyCount = styleCountRef.current.risky

    // ═══ 混沌模式: 生成新的随机系数（每次选择都不同） ═══
    if (challengeMode === 'chaos') {
      chaosMultRef.current = generateChaosMultiplier()
    }

    // ═══ 每日巡检: 检查当前步骤是否有种子加成 ═══
    let dailyBonus: Partial<Record<Stat, number>> | null = null
    if (challengeMode === 'daily' && dailySeedRef.current) {
      const stepKey = step.id.slice(0, 4) // e.g. "t1s1"
      const bonusCfg = dailySeedRef.current.stepBonuses[stepKey]
      if (bonusCfg) {
        // 找到对应选择在当前步骤中的索引
        const choiceIdx = step.choices.indexOf(choice)
        if (choiceIdx === bonusCfg.choiceIndex) {
          dailyBonus = bonusCfg.bonus
        }
      }
    }

    // 先设置 flags
    if (choice.setFlags) {
      Object.entries(choice.setFlags).forEach(([k, v]) => {
        setGameFlags((prev) => ({ ...prev, [k]: v }))
        bus.emit('flags:set', { key: k, value: v })
      })
    }
    // 触发小游戏 — 传递模式信息
    const event = new CustomEvent('minigame:start', {
      detail: {
        choice,
        step,
        challengeMode,
        dailyBonus,
        chaosMult: challengeMode === 'chaos' ? chaosMultRef.current : 1.0,
      },
    })
    window.dispatchEvent(event)
  }, [challengeMode])

  // 处理属性变化
  const handleStatsChange = useCallback((deltas: Partial<Record<Stat, number>>) => {
    // ═══ 混沌模式: 所有 delta 乘以随机系数 ═══
    const effectiveDeltas = challengeMode === 'chaos'
      ? Object.fromEntries(
          Object.entries(deltas).map(([k, v]) => [k, Math.round((v as number) * chaosMultRef.current)])
        ) as Partial<Record<Stat, number>>
      : deltas

    setStats((prev) => {
      const next = { ...prev }
      ;(Object.entries(effectiveDeltas) as [Stat, number][]).forEach(([key, val]) => {
        next[key] = Math.max(0, Math.min(key === 'budget' ? 20 : 100, next[key] + val))
      })
      return next
    })

    // 检查是否有故事事件触发
    if (activeTaskRef.current) {
      const stepId = TASKS
        .find((t) => t.id === activeTaskRef.current!.taskId)
        ?.steps[activeTaskRef.current!.stepIndex]
        ?.id
      if (stepId) {
        // 找到当前步骤中与选择ID匹配的故事事件（多周目累积用）
        const matchingEvents = Object.entries(STORY_EVENTS)
          .filter(([k]) => k.startsWith(stepId.slice(0, 5)))
        for (const [eventId] of matchingEvents) {
          if (!runMetaRef.current.storyEventsSeen.includes(eventId)) {
            runMetaRef.current.storyEventsSeen.push(eventId)
          }
        }
      }
    }
  }, [challengeMode])

  // 处理任务推进
  const handleTaskAdvance = useCallback((success: boolean, deltas: Partial<Record<Stat, number>>) => {
    // 追踪小游戏结果
    runMetaRef.current.minigameAttempts++
    if (success) runMetaRef.current.minigameSuccesses++

    const scene = getGameScene()
    if (!scene) return

    // P2: 支线任务 vs 主线任务 — 两者可能同时活跃
    const activeSQ = (scene as any)['activeSideQuest'] as string | null
    const activeMT = scene.activeTask

    if (activeSQ && activeMT) {
      // ★ 两者同时活跃 → 优先主线任务
      // 理由: onInteractPoint 在 activeTask 存在时跳过支线分支（line 1413）
      // 所以此时触发的必然是主线任务交互
      scene.advanceTask(success, deltas as Record<string, number>)
      return
    }

    if (activeSQ) {
      // 仅有支线任务活跃
      scene.completeSideQuest(success)
      return
    }

    scene.advanceTask(success, deltas as Record<string, number>)
  }, [])

  // 重玩
  const handleRestart = useCallback(() => {
    destroyGame()
    destroyAudio()
    deleteSave()

    // NG+: 如果已有至少一次通关记录，显示加成选择
    if (playthroughCount > 0) {
      setPhase('ngplus')
      return
    }

    setPhase('title')
    setStats(INITIAL_STATS)
    setCompletedTasks([])
    setActiveTaskId(null)
    setGameFlags({})
    setFinalFlags({})
    activeTaskRef.current = null
    setFinalStats(null)
    setRiskEvent(null)
    setChallengeMode(null)
    challengeModeRef.current = null
  }, [playthroughCount])

  // NG+ 加成选择
  const handleNGPlusSelect = useCallback((bonus: NGPlusBonus) => {
    setNgPlusBonus(bonus)
    setPhase('title')
    setFinalStats(null)
    setFinalFlags({})
    setRiskEvent(null)
  }, [])

  // 成就面板
  const handleOpenAchievements = useCallback(() => setPhase('achievements'), [])
  const handleCloseAchievements = useCallback(() => setPhase('title'), [])

  // 挑战模式选择 → 直接开始游戏
  const handleChallengeMode = useCallback((mode: ChallengeMode) => {
    setChallengeMode(mode)
    challengeModeRef.current = mode  // ★ 立即同步 ref 供 startGame 读取
    startGame(null)
  }, [startGame])

  // 同步活跃任务
  useEffect(() => {
    if (phase !== 'playing') return
    const interval = setInterval(() => {
      const scene = getGameScene()
      if (scene && (scene as any)['activeTask'] !== undefined) {
        const at: ActiveTask | null = (scene as any)['activeTask']
        if (at?.taskId !== activeTaskId) {
          setActiveTaskId(at?.taskId ?? null)
          activeTaskRef.current = at
        }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [phase, activeTaskId])

  return (
    <ErrorBoundary>
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#12110d' }}>
        {/* Phaser 容器 — 始终在底层 */}
        <div
          ref={gameContainerRef}
          style={{ position: 'absolute', inset: 0, zIndex: 0 }}
        />

        {/* React UI 覆盖层 */}
        {phase === 'playing' && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <HUD stats={stats} completedTasks={completedTasks} activeTaskId={activeTaskId} />
            <DialogController />
            <ChoicePanelController
              onChoose={handleChoice}
              gameFlags={gameFlags}
              stats={stats}
            />
            <MiniGameController onTaskAdvance={handleTaskAdvance} onStatsChange={handleStatsChange} />

            {/* 风险事件弹窗 */}
            {riskEvent && (
              <RiskEventPopup event={riskEvent} onClose={() => {
                setRiskEvent(null)
                bus.emit('ui:risk-event-closed')
              }} />
            )}

            {/* 小地图 */}
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              pointerEvents: 'none',
              borderRadius: 6,
              overflow: 'hidden',
              boxShadow: '0 0 16px rgba(0,0,0,0.6)',
            }}>
              <canvas
                id="minimap-canvas"
                width={140}
                height={98}
                style={{ display: 'block' }}
              />
            </div>

            <div style={{
              position: 'absolute', bottom: 16, left: 16,
              fontSize: 9, color: '#3d3322',
              fontFamily: 'monospace', lineHeight: 1.6,
              pointerEvents: 'none',
            }}>
              WASD 移动 · E 互动 · Space 对话
            </div>
          </div>
        )}

        {/* 标题界面 — 层级高于 #root-loader(z-index:9999) */}
        {phase === 'title' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20000, pointerEvents: 'all' }}>
            <TitleScreen
              onStart={startGame}
              onAchievements={handleOpenAchievements}
              achievementProgress={getAchievementState()}
              onChallengeMode={handleChallengeMode}
              playthroughCount={playthroughCount}
            />
          </div>
        )}

        {/* 成就面板 */}
        {phase === 'achievements' && (
          <AchievementPanel onClose={handleCloseAchievements} />
        )}

        {/* 游戏结束/评级 */}
        {phase === 'gameover' && finalStats && (
          <>
            {/* 成就解锁通知 */}
            {showAchievementPopup && newAchievements.length > 0 && (
              <AchievementUnlockPopup
                achievements={newAchievements}
                onClose={() => setShowAchievementPopup(false)}
              />
            )}
            <FinalReport
              stats={finalStats}
              flags={finalFlags}
              onRestart={handleRestart}
              challengeMode={challengeMode}
              playTimeMs={Date.now() - runStartTime.current}
            />
          </>
        )}

        {/* NG+ 加成选择 */}
        {phase === 'ngplus' && (
          <NGPlusSelector
            playthrough={playthroughCount}
            onSelect={handleNGPlusSelect}
          />
        )}

        {/* 属性转化面板 */}
        {phase === 'conversion' && (
          <ConversionPanel
            stats={stats}
            onStatsChange={(deltas) => {
              setStats((prev) => {
                const next = { ...prev }
                Object.entries(deltas).forEach(([k, v]) => {
                  const key = k as keyof typeof prev
                  next[key] = Math.max(0, Math.min(key === 'budget' ? 20 : 100, next[key] + (v as number)))
                })
                return next
              })
            }}
            onClose={() => setPhase('playing')}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

// ─── 成就解锁弹窗 ──────────────────────────────────────────────────────────

function AchievementUnlockPopup({ achievements, onClose }: { achievements: Achievement[]; onClose: () => void }) {
  const [visible, setVisible] = useState(false)
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDismiss = useCallback(() => {
    setVisible(false)
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
    setTimeout(onClose, 400)
  }, [onClose])

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600)
    autoCloseRef.current = setTimeout(handleDismiss, 6000)
    return () => {
      clearTimeout(t)
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current)
    }
  }, [handleDismiss])

  if (achievements.length === 0) return null

  // ★ 最多展示 3 个，超出显示 "+N"
  const shown = achievements.slice(0, 3)
  const overflow = achievements.length - 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 400,
        pointerEvents: 'all',
        background: 'rgba(18,17,13,0.97)',
        border: '1px solid rgba(215,189,115,0.4)',
        borderRadius: 10,
        padding: '14px 18px',
        minWidth: 240,
        maxWidth: 300,
        boxShadow: '0 0 24px rgba(215,189,115,0.15)',
      }}
    >
      <div style={{ fontSize: 11, color: '#8b7355', fontFamily: 'monospace', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🏆</span>
        <span>成就解锁！</span>
        <span style={{ fontSize: 9, color: '#5a5040', marginLeft: 'auto' }}>
          {achievements.length > 1 ? `×${achievements.length}` : ''}
        </span>
        {/* ★ 手动关闭按钮 */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: '1px solid rgba(215,189,115,0.2)',
            borderRadius: 4,
            color: '#d7bd73',
            cursor: 'pointer',
            fontSize: 11,
            padding: '1px 6px',
            marginLeft: 4,
            lineHeight: '16px',
          }}
        >
          ✕
        </motion.button>
      </div>
      {shown.map((ach) => (
        <motion.div
          key={ach.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            padding: '8px 10px',
            marginBottom: 6,
            background: 'rgba(215,189,115,0.04)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 20 }}>{ach.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d7bd73' }}>{ach.name}</div>
            <div style={{ fontSize: 10, color: '#8b7355' }}>{ach.description}</div>
          </div>
        </motion.div>
      ))}
      {/* ★ 溢出提示 */}
      {overflow > 0 && (
        <div style={{
          fontSize: 10,
          color: '#8b7355',
          textAlign: 'center',
          paddingTop: 2,
          fontFamily: 'monospace',
        }}>
          ... 还有 {overflow} 项成就
        </div>
      )}
    </motion.div>
  )
}

function RiskEventPopup({ event, onClose }: { event: RiskEvent; onClose: () => void }) {
  const colors: Record<string, string> = {
    warning: '#d7bd73', danger: '#d9a063', crisis: '#d95a54',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 170,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(12,11,9,0.7)',
      pointerEvents: 'all',
    }}>
      <div style={{
        background: 'rgba(18,17,13,0.98)',
        border: `1px solid ${colors[event.level]}66`,
        borderRadius: 12,
        padding: '28px 32px',
        maxWidth: 420,
        width: '88%',
        textAlign: 'center',
        boxShadow: `0 0 40px ${colors[event.level]}15`,
      }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>
          {event.level === 'crisis' ? '🔥' : event.level === 'danger' ? '⚡' : '⚠️'}
        </div>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: colors[event.level],
          marginBottom: 8,
        }}>
          {event.title}
        </div>
        <div style={{
          fontSize: 12, color: '#8b7355',
          lineHeight: 1.6, marginBottom: 16,
        }}>
          {event.message}
        </div>
        <div style={{ fontSize: 10, color: '#d98f72', marginBottom: 16 }}>
          {Object.entries(event.deltas).map(([k, v]) => {
            const labels: Record<string, string> = {
              reputation: '声誉', risk: '风险', evidence: '证据', budget: '预算',
            }
            return `${labels[k] ?? k} ${(v as number) > 0 ? '+' : ''}${v}  `
          }).join('')}
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 24px',
            background: `${colors[event.level]}15`,
            border: `1px solid ${colors[event.level]}44`,
            borderRadius: 6,
            color: colors[event.level],
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'monospace',
          }}
        >
          {event.level === 'crisis' ? '接受现实...' : '我知道了'}
        </button>
      </div>
    </div>
  )
}
