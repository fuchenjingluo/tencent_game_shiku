// ────────────────────────────────────────────────────────────────────────────
// 最终评级报告 v3.0
// 新增：6结局标签系统 + 因果回溯 + 复玩激励
// 评级公式：声誉×0.30 + (100-风险)×0.25 + 证据×0.25 + 预算×0.20
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { GameStats, Grade, EndingType, EndingMeta, CausalTrace, GameFlags, ChallengeMode } from '../../types'
import { playTaskComplete } from '../../audio/audioManager'
import { getSpeedrunGrade, formatSpeedrunTime, getSpeedrunLeaderboard } from '../../data/challengeModes'

interface FinalReportProps {
  stats: GameStats
  flags: GameFlags
  onRestart: () => void
  challengeMode?: ChallengeMode | null
  playTimeMs?: number
}

// ─── 评级计算 ───────────────────────────────────────────────────────────────

function calcGrade(stats: GameStats): { composite: number; grade: Grade } {
  const composite =
    stats.reputation * 0.30 +
    (100 - stats.risk) * 0.25 +
    stats.evidence * 0.25 +
    stats.budget * 0.20

  const grade: Grade =
    composite >= 80 ? 'S' :
    composite >= 65 ? 'A' :
    composite >= 50 ? 'B' :
    composite >= 35 ? 'C' : 'D'

  return { composite: Math.round(composite), grade }
}

// ─── 结局检测 ───────────────────────────────────────────────────────────────

function detectEnding(stats: GameStats, flags: GameFlags): EndingType {
  const { reputation, risk, evidence, budget } = stats

  // 优先级从高到低 —— 先检查特殊条件
  if (risk >= 80) return 'grottos_lament'
  if (reputation >= 80 && risk <= 30) return 'grotto_guardian'
  if (reputation <= 30 && evidence >= 60) return 'whistleblower'
  if (evidence >= 80) return 'archive_expert'
  if (reputation >= 60 && risk <= 20) return 'radical_reformer'
  if (budget <= 2 && risk >= 60) return 'barely_holding'

  // 兜底逻辑：按最高属性方向判定
  const safety = 100 - risk
  if (reputation >= safety && reputation >= evidence) return 'grotto_guardian'
  if (evidence >= reputation && evidence >= safety) return 'archive_expert'
  return 'barely_holding'
}

// ─── 结局元数据 ─────────────────────────────────────────────────────────────

const ENDING_META: Record<EndingType, EndingMeta> = {
  grotto_guardian: {
    type: 'grotto_guardian',
    title: '石窟守护者',
    subtitle: '守护者的平衡之道',
    description: '你在专业判断、资源分配和风险控制之间找到了完美的平衡点。石窟因你的守护而延续千年，这份责任与智慧将成为文保领域的典范。',
    flavorText: '千年的壁画继续诉说着古老的故事，因为你选择成为它们与时间之间的那道屏障。',
    icon: '🛡️',
    color: '#d7bd73',
  },
  radical_reformer: {
    type: 'radical_reformer',
    title: '激进改革者',
    subtitle: '赌徒的胜利',
    description: '你选择了高风险路线——每一次孤注一掷都让你更接近悬崖边缘，但你最终站稳了脚跟。石窟安全了，尽管过程中有些人心存疑虑。',
    flavorText: '有人说你太冒险。但千年石窟需要的不是循规蹈矩的守护者，而是敢于在关键时刻做出非常规决策的人。',
    icon: '⚡',
    color: '#d98f72',
  },
  barely_holding: {
    type: 'barely_holding',
    title: '勉力维持者',
    subtitle: '守护的火种不灭',
    description: '预算紧张，风险高企——你几乎是在废墟中穿梭。但你没有放弃，每一次小的胜利都在为石窟争取更多的时间。文物保护从来不是一蹴而就的事。',
    flavorText: '今天很艰难，明天也不会容易。但只要还有人在石窟前点亮一盏灯，守护就不会结束。',
    icon: '🕯️',
    color: '#bfbfbf',
  },
  archive_expert: {
    type: 'archive_expert',
    title: '档案专家',
    subtitle: '数据即是力量',
    description: '你像一个考古学家般收集了海量数据。每一份扫描、每一次记录、每一页报告——它们或许现在用不上，但它们构成了石窟最完整的数字肖像。未来某一天，这些数据将拯救一座石窟。',
    flavorText: '有时候守护不只是一次紧急处置。它是一页页累积的数据、一排排归档的扫描、一幅幅精确到毫米的图表。',
    icon: '📚',
    color: '#7ab8d9',
  },
  whistleblower: {
    type: 'whistleblower',
    title: '吹哨人',
    subtitle: '真相不需要头衔',
    description: '你的声誉可能受损，你的决策备受争议——但你手中的证据不会撒谎。你用数据讲话，在体制的缝隙中凿开了一条真相之路。石窟因你的坚持而被重视。',
    flavorText: '有时候守护意味着站在所有人的对立面，然后说："这是我看到的事实。"',
    icon: '📢',
    color: '#c97ad9',
  },
  grottos_lament: {
    type: 'grottos_lament',
    title: '石窟之殇',
    subtitle: '失败是守护者的必修课',
    description: '风险已经失控。壁画可能遭受不可逆的损伤，岩体稳定性令人担忧。但每一次失败都会留下教训——下一次，你知道哪些选择不该重蹈覆辙。',
    flavorText: '壁画上的佛陀依然在微笑，仿佛知道守护者们终将归来，带着更聪明的策略和更坚定的决心。',
    icon: '💔',
    color: '#d96666',
  },
}

// ─── 因果回溯数据 — 将 gameFlags 映射到叙事后果 ───────────────────────────

const CAUSAL_MAP: Record<string, CausalTrace> = {
  'mural_detailed_scan': {
    flag: 'mural_detailed_scan',
    choiceLabel: '标记潮湿边界（红外热像仪）',
    consequence: '壁画区建立了精确的湿度基线数据，为后续所有决策提供了科学依据。',
    alternativeLabel: '只拍照留档 / 紧急注浆',
    alternativeConsequence: '缺少精确数据，后续对壁画病害的判断存在盲区。',
  },
  'mural_risky_fix': {
    flag: 'mural_risky_fix',
    choiceLabel: '紧急注浆封堵',
    consequence: '直接在渗漏点注入树脂——见效快，但长期稳定性存疑。',
    alternativeLabel: '精确标记后再处置',
    alternativeConsequence: '虽然耗时较长，但处置方案更有依据。',
  },
  'deployed_barrier': {
    flag: 'deployed_barrier',
    choiceLabel: '部署隔离绳和吸湿盒',
    consequence: '物理防护措施到位，壁画区域在后续任务中保持稳定。',
    alternativeLabel: '仅取补光灯 / 化学加固',
    alternativeConsequence: '缺少物理隔离，壁画持续暴露在环境变化中。',
  },
  'chemical_fix': {
    flag: 'chemical_fix',
    choiceLabel: '使用化学加固剂',
    consequence: '化学加固快速生效，但光泽度变化引起了专家组的关注。',
    alternativeLabel: '物理隔离方案',
    alternativeConsequence: '虽然更慢，但对壁画化学性质无影响。',
  },
  'humidity_calibrated': {
    flag: 'humidity_calibrated',
    choiceLabel: '三点湿度校准',
    consequence: '精确校准后，暗窟湿度定位到了渗漏源——后续除湿方案有的放矢。',
    alternativeLabel: '直接相信读数',
    alternativeConsequence: '未校准的读数可能存在系统性偏差，除湿方案基于不准确的数据。',
  },
  'fast_dehumid': {
    flag: 'fast_dehumid',
    choiceLabel: '启动快速强除湿',
    consequence: '快速除湿见效快，但温差引发了岩壁细微龟裂。',
    alternativeLabel: '低功率连续除湿',
    alternativeConsequence: '虽然见效慢，但对岩体的扰动最小。',
  },
  'batch_flow': {
    flag: 'batch_flow',
    choiceLabel: '开启分批限流',
    consequence: '游客分流有效控制了CO₂浓度，获得了文旅局认可。',
    alternativeLabel: '保持自由进入 / 关闭洞窟',
    alternativeConsequence: '不限制人流导致环境指标持续恶化。',
  },
  'cave_closure': {
    flag: 'cave_closure',
    choiceLabel: '临时关闭部分洞窟',
    consequence: '果断关闭两个洞窟——短期争议巨大，但CO₂数据显著改善。',
    alternativeLabel: '分批限流',
    alternativeConsequence: '温和的限流措施虽然避免了争议，但效果打了折扣。',
  },
  'glass_barrier': {
    flag: 'glass_barrier',
    choiceLabel: '安装玻璃隔离墙',
    consequence: '一劳永逸的物理屏障——安装过程风险虽高，但成功后几十年无忧。',
    alternativeLabel: '调整导览路线',
    alternativeConsequence: '灵活性更高，但没有永久的物理保护。',
  },
  'overclocked': {
    flag: 'overclocked',
    choiceLabel: '超频供电芯片',
    consequence: '超频操作让系统挺过了供电危机，但一个传感器模块已烧毁。',
    alternativeLabel: '切换备用电源',
    alternativeConsequence: '虽然切换过程有短暂延迟，但设备安全性得到了保证。',
  },
  'data_complete': {
    flag: 'data_complete',
    choiceLabel: '完成校验并补传数据',
    consequence: '完整的监控数据链为未来审计提供了不可撼动的基础。',
    alternativeLabel: '只确认在线 / AI补全',
    alternativeConsequence: '数据缺口可能导致审计中被质疑。',
  },
  'ai_fill': {
    flag: 'ai_fill',
    choiceLabel: 'AI自动补全数据',
    consequence: 'AI高效补全了大量数据，但系统标记了几处可疑插值。',
    alternativeLabel: '手动完整校验',
    alternativeConsequence: '虽然耗时，但每一条数据都经得起推敲。',
  },
  'full_archive': {
    flag: 'full_archive',
    choiceLabel: '提交完整档案包',
    consequence: '完整的档案展现了专业水准，为后续巡检建立了高标准的参照。',
    alternativeLabel: '只提交简报',
    alternativeConsequence: '信息不足可能导致后续决策缺乏依据。',
  },
  'multimedia_report': {
    flag: 'multimedia_report',
    choiceLabel: '制作多媒体汇报',
    consequence: '可视化的档案令人印象深刻，但数据安全风险需要后续处理。',
    alternativeLabel: '提交完整档案包',
    alternativeConsequence: '更稳妥的选择，虽然不够炫目。',
  },
  'full_presentation': {
    flag: 'full_presentation',
    choiceLabel: '做完整汇报展示',
    consequence: '全面的汇报赢得了专家组的一致好评。',
    alternativeLabel: '口头简要汇报',
    alternativeConsequence: '简洁高效但缺乏说服力。',
  },
  'written_proposal': {
    flag: 'written_proposal',
    choiceLabel: '提交书面建议书',
    consequence: '大胆的预算申请和人员增编建议——虽然冒犯了一些人，但为明年争取了资源。',
    alternativeLabel: '口头简要汇报',
    alternativeConsequence: '安全但不会带来实质性改变。',
  },
}

// ─── 常量和样式 ─────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<Grade, string> = {
  S: '#d7bd73',
  A: '#8fae78',
  B: '#7ab8d9',
  C: '#d9a07a',
  D: '#d98f72',
}

const GRADE_EMOJI: Record<Grade, string> = {
  S: '👑', A: '🌟', B: '👍', C: '📚', D: '💔',
}

// ─── 子组件 ──────────────────────────────────────────────────────────────────

function StatRow({ label, value, max = 100, color, weight }: {
  label: string; value: number; max?: number; color: string; weight: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: '#8b7355' }}>{label} <span style={{ fontSize: 9, opacity: 0.5 }}>{weight}</span></span>
        <span style={{ color, fontFamily: 'monospace' }}>{Math.round(value)}</span>
      </div>
      <div style={{ height: 6, background: '#1e1b15', borderRadius: 3, overflow: 'hidden', border: '1px solid #2a2318' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.4, duration: 0.9, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: 3 }}
        />
      </div>
    </div>
  )
}

/** 结局标签卡片 */
function EndingCard({ ending }: { ending: EndingMeta }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.0, type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        marginTop: 24,
        padding: '18px 20px',
        background: `rgba(${ending.type === 'grottos_lament' ? '217,102,102' : '215,189,115'}, 0.06)`,
        border: `1px solid ${ending.color}44`,
        borderRadius: 10,
        position: 'relative',
      }}
    >
      {/* 结局标题行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 28 }}>{ending.icon}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ending.color }}>
            {ending.title}
          </div>
          <div style={{ fontSize: 11, color: '#8b7355', fontFamily: 'monospace' }}>
            {ending.subtitle}
          </div>
        </div>
      </div>

      {/* 结局描述 */}
      <div style={{
        fontSize: 12,
        color: '#9e8b6e',
        lineHeight: 1.8,
        marginBottom: 10,
      }}>
        {ending.description}
      </div>

      {/* 意境文本 */}
      <div style={{
        fontSize: 12,
        color: `${ending.color}99`,
        fontStyle: 'italic',
        lineHeight: 1.7,
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 6,
        borderLeft: `3px solid ${ending.color}44`,
      }}>
        "{ending.flavorText}"
      </div>
    </motion.div>
  )
}

/** 因果回溯条目 */
function CausalTraceItem({ trace, active }: { trace: CausalTrace; active: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      style={{
        padding: '10px 14px',
        marginBottom: 6,
        background: active ? 'rgba(215,189,115,0.06)' : 'rgba(255,255,255,0.01)',
        border: `1px solid ${active ? 'rgba(215,189,115,0.2)' : 'rgba(255,255,255,0.03)'}`,
        borderRadius: 6,
        opacity: active ? 1 : 0.4,
        fontSize: 11,
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{
          fontSize: 10,
          color: active ? '#d7bd73' : '#5a5040',
          fontFamily: 'monospace',
          fontWeight: 600,
        }}>
          {active ? '▶' : '—'}
        </span>
        <span style={{
          color: active ? '#d7bd73' : '#5a5040',
          fontWeight: 600,
        }}>
          {trace.choiceLabel}
        </span>
      </div>
      <div style={{ color: active ? '#9e8b6e' : '#5a5040', paddingLeft: 18 }}>
        {active ? trace.consequence : `（未选择）${trace.alternativeConsequence || ''}`}
      </div>
    </motion.div>
  )
}

/** 从 flags 中提取已触发的因果回溯 */
function getCausalTraces(flags: GameFlags): { active: CausalTrace[]; inactive: CausalTrace[] } {
  const active: CausalTrace[] = []
  const inactive: CausalTrace[] = []

  for (const [flagKey, trace] of Object.entries(CAUSAL_MAP)) {
    if (flags[flagKey]) {
      active.push(trace)
    } else {
      inactive.push(trace)
    }
  }

  // 只取最有叙事价值的几条
  return {
    active: active.slice(0, 5),
    inactive: inactive.slice(0, 3),
  }
}

/** 生成复玩提示 */
function getReplayHint(ending: EndingType, flags: GameFlags): string {
  const hints: Record<EndingType, string[]> = {
    grotto_guardian: [
      '试试激进路线——每一次高风险操作都会让你心跳加速。',
      '或者走证据路线，看看不同的数据积累会带来什么发现。',
    ],
    radical_reformer: [
      '试试更保守的策略——有时候慢就是快。',
      '如果每次都选专业方案，结局会不会更稳健？',
    ],
    barely_holding: [
      '在任务早期多做几次"属性转化"——它们能帮你渡过预算危机。',
      '混合使用专业和妥协选项，找到属于你的平衡点。',
    ],
    archive_expert: [
      '如果你不那么在意数据，而是把资源用于风险控制呢？',
      '试试混合冒险策略——高风险选项往往能带来惊人的风险降幅。',
    ],
    whistleblower: [
      '修复一下声誉试试——有时候关系和人脉也是一道防线。',
      '如果证据足够多，或许不需要牺牲声誉也能达到目的。',
    ],
    grottos_lament: [
      '下一次，在 Task 1-2 就锁定关键数据——缺少信息比缺少预算更致命。',
      '试试专业路线：红外扫描+传感器校准一步到位。',
    ],
  }

  const pool = hints[ending]
  return pool[Math.floor(Math.random() * pool.length)]
}

/** 探索度统计组件 */
function ExplorationStats({ flags }: { flags: GameFlags }) {
  const totalFlags = Object.keys(CAUSAL_MAP).length
  const triggeredCount = Object.entries(flags).filter(([k, v]) => v && CAUSAL_MAP[k]).length
  const pct = Math.round((triggeredCount / totalFlags) * 100)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      style={{
        marginTop: 16,
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(61,51,34,0.3)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#8b7355', fontFamily: 'monospace' }}>
          📊 因果链探索度
        </span>
        <span style={{ fontSize: 11, color: '#7ab8d9', fontFamily: 'monospace', fontWeight: 600 }}>
          {triggeredCount} / {totalFlags}
        </span>
      </div>

      {/* 进度条 */}
      <div style={{
        height: 4,
        background: '#1e1b15',
        borderRadius: 2,
        marginBottom: 8,
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: pct >= 50
              ? 'linear-gradient(90deg, #7ab8d9, #4fa3c4)'
              : 'linear-gradient(90deg, #5a5040, #8b7355)',
            borderRadius: 2,
          }}
        />
      </div>

      {/* 成就提示 */}
      <div style={{ fontSize: 9, color: '#5a5040', fontFamily: 'monospace', lineHeight: 1.5 }}>
        {triggeredCount >= 8 ? (
          <span style={{ color: '#d7bd73' }}>🏆 已满足"因果链大师"成就条件！</span>
        ) : (
          <span>触发 8+ 个因果标志可解锁 <span style={{ color: '#7ab8d9' }}>"因果链大师"</span> 成就</span>
        )}
      </div>
    </motion.div>
  )
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function FinalReport({ stats, flags, onRestart, challengeMode, playTimeMs }: FinalReportProps) {
  const { composite, grade } = calcGrade(stats)
  const ending = detectEnding(stats, flags)
  const endingMeta = ENDING_META[ending]
  const { active, inactive } = getCausalTraces(flags)
  const replayHint = getReplayHint(ending, flags)

  // 速通信息
  const speedrunGrade = challengeMode === 'speedrun' && playTimeMs
    ? getSpeedrunGrade(playTimeMs)
    : null
  const bestTime = challengeMode === 'speedrun'
    ? getSpeedrunLeaderboard().bestTime
    : null

  const [phase, setPhase] = useState<'grade' | 'ending' | 'causal' | 'replay'>( 'grade')

  useEffect(() => {
    playTaskComplete()
    const t1 = setTimeout(() => setPhase('grade'), 800)
    const t2 = setTimeout(() => setPhase('ending'), 3000)
    const t3 = setTimeout(() => setPhase('causal'), 5500)
    const t4 = setTimeout(() => setPhase('replay'), 8000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10,9,7,0.95)',
        pointerEvents: 'all',
        overflowY: 'auto',
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 20 }}
        style={{
          width: 580,
          maxWidth: '94%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'rgba(18,17,13,0.99)',
          border: '1px solid #3d3322',
          borderRadius: 16,
          padding: '28px 36px',
          position: 'relative',
        }}
      >
        {/* 背景纹理 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, rgba(215,189,115,0.015) 0px, transparent 1px, transparent 20px)',
          pointerEvents: 'none', borderRadius: 16,
        }} />

        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: '#8b7355', letterSpacing: '0.2em', marginBottom: 4, fontFamily: 'monospace' }}>
            — 巡检报告 —
          </div>
          <div style={{ fontSize: 18, color: '#d7bd73', fontWeight: 700 }}>石窟守护者评定结果</div>
          <div style={{ height: 1, background: 'rgba(215,189,115,0.15)', marginTop: 10 }} />
        </div>

        {/* 评级：Phase 1 */}
        <AnimatePresence>
          {phase !== 'grade' ? null : (
            <motion.div
              key="grade-section"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ textAlign: 'center', marginBottom: 20 }}
            >
              <div style={{ fontSize: 12, color: '#8b7355', marginBottom: 8 }}>
                综合评级计算中...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 评级结果 */}
        <AnimatePresence>
          {(phase === 'grade' || phase === 'ending' || phase === 'causal' || phase === 'replay') && (
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              style={{ textAlign: 'center', marginBottom: 20 }}
            >
              <div style={{ fontSize: 40, marginBottom: 4 }}>{GRADE_EMOJI[grade]}</div>
              <div style={{
                fontSize: 72,
                fontWeight: 900,
                color: GRADE_COLORS[grade],
                textShadow: `0 0 40px ${GRADE_COLORS[grade]}66`,
                lineHeight: 1,
              }}>
                {grade}
              </div>
              <div style={{ fontSize: 18, color: GRADE_COLORS[grade], marginTop: 6, fontFamily: 'monospace' }}>
                {composite} / 100
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 属性明细 */}
        <AnimatePresence>
          {(phase === 'grade' || phase === 'ending' || phase === 'causal' || phase === 'replay') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{ marginBottom: 16 }}
            >
              {/* ═══ 速通时间展示 ═══ */}
              {speedrunGrade && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    marginBottom: 12,
                    background: `${speedrunGrade.color}10`,
                    border: `1px solid ${speedrunGrade.color}33`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>⏱️</span>
                    <div>
                      <div style={{ fontSize: 10, color: '#5a5040', fontFamily: 'monospace' }}>
                        通关时间
                      </div>
                      <div style={{ fontSize: 18, color: speedrunGrade.color, fontFamily: 'monospace', fontWeight: 700 }}>
                        {formatSpeedrunTime(playTimeMs!)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, color: speedrunGrade.color, fontWeight: 700 }}>
                      {speedrunGrade.label}
                    </div>
                    {bestTime && bestTime.timeMs <= (playTimeMs ?? 0) && (
                      <div style={{ fontSize: 9, color: '#5a5040', fontFamily: 'monospace' }}>
                        最佳 {formatSpeedrunTime(bestTime.timeMs)}
                      </div>
                    )}
                    {bestTime && bestTime.timeMs > (playTimeMs ?? 0) && (
                      <div style={{ fontSize: 9, color: '#d7bd73', fontFamily: 'monospace' }}>
                        🏆 新纪录！
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              <StatRow label="声誉" value={stats.reputation} color="#d7bd73" weight="×0.30" />
              <StatRow label="安全指数 (100-风险)" value={100 - stats.risk} color="#8fae78" weight="×0.25" />
              <StatRow label="证据" value={stats.evidence} color="#7ab8d9" weight="×0.25" />
              <StatRow label="预算" value={stats.budget} max={20} color="#d9a07a" weight="×0.20" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 综合计算 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(215,189,115,0.05)',
          border: '1px solid rgba(215,189,115,0.2)',
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 13,
        }}>
          <span style={{ color: '#8b7355' }}>综合评分</span>
          <span style={{ color: '#d7bd73', fontFamily: 'monospace', fontWeight: 600 }}>
            {composite} / 100
          </span>
        </div>

        {/* ─── 结局标签：Phase 2 ─── */}
        <AnimatePresence>
          {(phase === 'ending' || phase === 'causal' || phase === 'replay') && (
            <EndingCard ending={endingMeta} />
          )}
        </AnimatePresence>

        {/* ─── 因果回溯：Phase 3 ─── */}
        <AnimatePresence>
          {(phase === 'causal' || phase === 'replay') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ marginTop: 24 }}
            >
              <div style={{
                fontSize: 13,
                color: '#8b7355',
                fontWeight: 600,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>🧬</span>
                你的选择如何塑造了结局
              </div>

              <div style={{ fontSize: 10, color: '#5a5040', marginBottom: 10, fontFamily: 'monospace' }}>
                已触发的关键决策
              </div>
              {active.map((trace, i) => (
                <CausalTraceItem key={trace.flag} trace={trace} active />
              ))}

              {inactive.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10, color: '#5a5040',
                    marginTop: 16, marginBottom: 10,
                    fontFamily: 'monospace',
                  }}>
                    未选择的路径
                  </div>
                  {inactive.map((trace, i) => (
                    <CausalTraceItem key={trace.flag} trace={trace} active={false} />
                  ))}
                </>
              )}

              {/* 探索度统计 */}
              <ExplorationStats flags={flags} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── 复玩激励：Phase 4 ─── */}
        <AnimatePresence>
          {phase === 'replay' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 22 }}
              style={{
                marginTop: 24,
                padding: '14px 18px',
                background: 'rgba(122,184,217,0.06)',
                border: '1px solid rgba(122,184,217,0.25)',
                borderRadius: 10,
              }}
            >
              <div style={{
                fontSize: 13,
                color: '#7ab8d9',
                fontWeight: 600,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>🔄</span>
                换个策略试试？
              </div>
              <div style={{
                fontSize: 11,
                color: '#9e8b6e',
                lineHeight: 1.7,
                marginBottom: 8,
              }}>
                {replayHint}
              </div>
              <div style={{
                fontSize: 10,
                color: '#5a5040',
                lineHeight: 1.5,
              }}>
                共有 <span style={{ color: '#d7bd73', fontWeight: 600 }}>6 种结局</span> 等待发现。
                不同的选择组合将导向完全不同的巡检故事。
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 阈值说明 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 10,
          marginTop: 24, marginBottom: 20,
          fontSize: 9, color: '#5a5040', fontFamily: 'monospace',
        }}>
          <span>S≥80</span><span style={{ color: '#3d3322' }}>|</span>
          <span>A≥65</span><span style={{ color: '#3d3322' }}>|</span>
          <span>B≥50</span><span style={{ color: '#3d3322' }}>|</span>
          <span>C≥35</span><span style={{ color: '#3d3322' }}>|</span>
          <span>D&lt;35</span>
        </div>

        {/* 重玩按钮 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onRestart}
            style={{
              padding: '12px 32px',
              background: 'rgba(215,189,115,0.1)',
              border: '1px solid rgba(215,189,115,0.4)',
              borderRadius: 8,
              color: '#d7bd73',
              cursor: 'pointer',
              fontSize: 14,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            🔄 再次挑战
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}
