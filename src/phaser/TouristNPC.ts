// ────────────────────────────────────────────────────────────────────────────
// TouristNPC v2.0 — 游客NPC系统
// 游客在窟室间随机参观，不再是固定路线 A/B/C
// P1: 随机事件 — 基于玩家-游客距离的交互事件触发
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'
import { TILE_SIZE, MAP_COLS, MAP_ROWS, ROOMS, CORRIDORS, getRoomCenter } from './mapData'
import type { GameFlags } from '../types'

// ─── 游客可参观的窟室 ──────────────────────────────────────────────────────
// "连通图" 节点：每个房间 + 连接它的走廊中继点

interface RoomNode {
  roomId: string
  x: number       // 房间中心像素 x
  y: number       // 房间中心像素 y
  neighbors: {    // 从本房间出发可达的相邻房间
    targetRoomId: string
    waypoints: { x: number; y: number }[]  // 沿走廊的中继点（不含起点/终点）
  }[]
}

// ─── 房间出口坐标（房间→走廊的入口点，确保游客从正确方向离开房间） ────
// 定义为"房间边缘内侧 0.5~1 格"，刚好在进入走廊之前
const ROOM_EXIT: Record<string, Record<string, { x: number; y: number }>> = {
  'gate-room': {
    'main-hall':    { x: 50 * TILE_SIZE, y: 51.5 * TILE_SIZE },    // 顶部出口 → corridor 7
    'archive-room': { x: 39.5 * TILE_SIZE, y: 56.5 * TILE_SIZE },  // 左侧出口 → corridor 8
  },
  'main-hall': {
    'gate-room':      { x: 50 * TILE_SIZE, y: 43.5 * TILE_SIZE },   // 底部出口 → corridor 7
    'mural-room':     { x: 42 * TILE_SIZE, y: 27.5 * TILE_SIZE },   // 左上出口 → corridor 2
    'rear-cave':      { x: 72 * TILE_SIZE, y: 27.5 * TILE_SIZE },   // 右上出口 → corridor 3
    'equipment-room': { x: 63 * TILE_SIZE, y: 33.5 * TILE_SIZE },   // 右侧出口 → corridor 5
  },
  'mural-room': {
    'main-hall':    { x: 24.5 * TILE_SIZE, y: 15.5 * TILE_SIZE },   // 右下出口 → corridor 1
    'archive-room': { x: 14.5 * TILE_SIZE, y: 19.5 * TILE_SIZE },   // 左下出口 → corridor 9
  },
  'rear-cave': {
    'main-hall': { x: 70.5 * TILE_SIZE, y: 18.5 * TILE_SIZE },      // 底部出口 → corridor 3
  },
  'equipment-room': {
    'main-hall':  { x: 62 * TILE_SIZE, y: 33.5 * TILE_SIZE },        // 左侧出口 → corridor 5
    'power-room': { x: 75 * TILE_SIZE, y: 41.5 * TILE_SIZE },        // 底部出口 → corridor 6
  },
  'power-room': {
    'equipment-room': { x: 75 * TILE_SIZE, y: 48.5 * TILE_SIZE },    // 顶部出口 → corridor 6
  },
  'archive-room': {
    'gate-room':  { x: 28.5 * TILE_SIZE, y: 56.5 * TILE_SIZE },      // 右上出口 → corridor 8
    'mural-room': { x: 14.5 * TILE_SIZE, y: 45.5 * TILE_SIZE },      // 左上出口 → corridor 9
  },
}

/** 预计算所有房间的连通图 + 走廊中继坐标 */
function buildRoomGraph(): Map<string, RoomNode> {
  const graph = new Map<string, RoomNode>()

  // ── 7 个房间的像素中心坐标 ──
  const c = (id: string) => getRoomCenter(id)
  const gate    = { id: 'gate-room',      ...c('gate-room') }
  const main    = { id: 'main-hall',       ...c('main-hall') }
  const mural   = { id: 'mural-room',      ...c('mural-room') }
  const rear    = { id: 'rear-cave',       ...c('rear-cave') }
  const equip   = { id: 'equipment-room',  ...c('equipment-room') }
  const power   = { id: 'power-room',      ...c('power-room') }
  const archive = { id: 'archive-room',    ...c('archive-room') }

  // ── 走廊中继点（像素坐标）──
  // corridor 7: 中心窟室→窟前栈道 (x=48,y=43,w=4,h=9) 垂直
  const c7 = { x: 50 * TILE_SIZE, y: 47.5 * TILE_SIZE }
  // corridor 2: 上接壁画走廊，下接中心窟室 (x=40,y=13,w=4,h=16)
  const c2 = { x: 42 * TILE_SIZE, y: 21 * TILE_SIZE }
  // corridor 1: 壁画区→中心窟室 水平段 (x=24,y=13,w=18,h=4)
  const c1 = { x: 33 * TILE_SIZE, y: 15 * TILE_SIZE }
  // corridor 4: 走廊2→走廊3 水平段 (x=40,y=23,w=34,h=5)
  const c4 = { x: 56 * TILE_SIZE, y: 25.5 * TILE_SIZE }
  // corridor 3: 后室暗窟→下 (x=70,y=17,w=4,h=12)
  const c3 = { x: 72 * TILE_SIZE, y: 23 * TILE_SIZE }
  // corridor 5: 中心窟室→设备间 (x=60,y=33,w=8,h=5)
  const c5 = { x: 64 * TILE_SIZE, y: 35.5 * TILE_SIZE }
  // corridor 6: 设备间→供电区 (x=74,y=41,w=4,h=9) 垂直
  const c6 = { x: 76 * TILE_SIZE, y: 45.5 * TILE_SIZE }
  // corridor 8: 窟前栈道→档案室 (x=28,y=55,w=12,h=4) 水平
  const c8 = { x: 34 * TILE_SIZE, y: 57 * TILE_SIZE }
  // corridor 9: 壁画区→档案室 左侧纵向通道 (x=14,y=20,w=4,h=26)
  const c9 = { x: 16 * TILE_SIZE, y: 33 * TILE_SIZE }

  // ── 构建连通关系 ──
  graph.set('gate-room', {
    roomId: 'gate-room', x: gate.x, y: gate.y,
    neighbors: [
      { targetRoomId: 'main-hall',      waypoints: [c7] },
      { targetRoomId: 'archive-room',   waypoints: [c8] },
    ],
  })

  graph.set('main-hall', {
    roomId: 'main-hall', x: main.x, y: main.y,
    neighbors: [
      { targetRoomId: 'gate-room',        waypoints: [c7] },
      { targetRoomId: 'mural-room',       waypoints: [c2, c1] },
      { targetRoomId: 'rear-cave',        waypoints: [c4, c3] },
      { targetRoomId: 'equipment-room',   waypoints: [c5] },
    ],
  })

  graph.set('mural-room', {
    roomId: 'mural-room', x: mural.x, y: mural.y,
    neighbors: [
      { targetRoomId: 'main-hall',    waypoints: [c1, c2] },
      { targetRoomId: 'archive-room', waypoints: [c9] },
    ],
  })

  graph.set('rear-cave', {
    roomId: 'rear-cave', x: rear.x, y: rear.y,
    neighbors: [
      { targetRoomId: 'main-hall', waypoints: [c3, c4] },
    ],
  })

  graph.set('equipment-room', {
    roomId: 'equipment-room', x: equip.x, y: equip.y,
    neighbors: [
      { targetRoomId: 'main-hall',  waypoints: [c5] },
      { targetRoomId: 'power-room', waypoints: [c6] },
    ],
  })

  graph.set('power-room', {
    roomId: 'power-room', x: power.x, y: power.y,
    neighbors: [
      { targetRoomId: 'equipment-room', waypoints: [c6] },
    ],
  })

  graph.set('archive-room', {
    roomId: 'archive-room', x: archive.x, y: archive.y,
    neighbors: [
      { targetRoomId: 'gate-room',  waypoints: [c8] },
      { targetRoomId: 'mural-room', waypoints: [c9] },
    ],
  })

  return graph
}

// ─── 障碍物数据（由 GameScene 传入，用于游客避让） ────────────────────────

export interface ObstacleData {
  x: number       // 障碍物中心像素 x
  y: number       // 障碍物中心像素 y
  hw: number      // 半宽（像素）
  hh: number      // 半高（像素）
}

// ─── 游客实例 ──────────────────────────────────────────────────────────────

interface Tourist {
  sprite: Phaser.GameObjects.Sprite
  nameLabel: Phaser.GameObjects.Text
  speed: number              // px/s
  pauseUntil: number         // 停留到何时
  variant: number            // 外观变体 (0-2)

  // 漫游状态
  currentRoomId: string
  targetRoomId: string
  waypoints: { x: number; y: number }[]  // 从当前位置到目标房间的中继点队列
  wpIndex: number            // 当前去往的 waypoint 索引
  arrived: boolean           // 到达当前 waypoint
  roomsVisited: number       // 已参观的房间数
  maxRooms: number           // 参观上限（到达后返回 gate-room 离场）
  previousRoomId: string     // 上一个房间（避免立即折返）
  headingHome: boolean       // 是否正在返回 gate-room
  visitedRooms: Set<string>  // 已参观过的房间（避免重复）
}

// ─── 随机事件定义 ──────────────────────────────────────────────────────────

export interface TouristEvent {
  id: string
  title: string
  description: string
  durationMs: number
  action: 'timing' | 'dialog' | 'chase'
  successDeltas: Partial<{ reputation: number; risk: number; evidence: number; budget: number }>
  successMsg: string
  failDeltas: Partial<{ reputation: number; risk: number; evidence: number; budget: number }>
  failMsg: string
  introLines: { speaker: string; text: string }[]
}

const TOURIST_EVENT_POOL: TouristEvent[] = [
  {
    id: 'touch_mural',
    title: '游客触摸壁画',
    description: '一名游客伸手触摸壁画表面！颜料层极其脆弱，哪怕一次触碰都会造成不可逆损伤。',
    durationMs: 8000,
    action: 'timing',
    introLines: [
      { speaker: '⚠️ 警告', text: '壁画区有游客正在伸手触摸壁画！颜料层已经因潮气而松动，任何触碰都会留下永久指印。' },
      { speaker: '⚠️ 警告', text: '你有8秒时间赶到现场。按下E键制止游客，保护千年壁画。' },
    ],
    successDeltas: { risk: -5, reputation: 3, evidence: 2 },
    successMsg: '你及时制止了游客！壁画完好无损。游客虽然略有不满，但理解了文物保护的重要性。',
    failDeltas: { risk: 8, reputation: -3, evidence: -2 },
    failMsg: '你没能及时制止。壁画表面留下了一道浅色指痕。文物保护部门即将派人进行紧急评估。',
  },
  {
    id: 'block_corridor',
    title: '游客堵塞走廊',
    description: '一群游客在狭窄的走廊拍照，完全堵死了通道！你需要引导他们疏散。',
    durationMs: 10000,
    action: 'dialog',
    introLines: [
      { speaker: '⚠️ 警告', text: '走廊中有游客聚集拍照，堵塞了通道。如果其他游客无法通过，CO₂浓度将在局部迅速升高。' },
      { speaker: '⚠️ 警告', text: '前往走廊疏散游客——选择一个合适的劝导方式。' },
    ],
    successDeltas: { risk: -3, reputation: 2, evidence: 1 },
    successMsg: '你礼貌但坚定地引导游客分散。通道恢复畅通，大部分游客表示理解。',
    failDeltas: { risk: 4, reputation: -2 },
    failMsg: '游客不太情愿地散开，有人小声抱怨"太官僚了"。通道勉强恢复通行但气氛尴尬。',
  },
  {
    id: 'flash_photo',
    title: '游客使用闪光灯',
    description: '暗窟里有游客使用闪光灯拍摄壁画——强光会加速颜料褪色！',
    durationMs: 6000,
    action: 'timing',
    introLines: [
      { speaker: '⚠️ 警告', text: '后室暗窟检测到强烈闪光！紫外线会加速壁画颜料的光化学反应，一次闪光等于一个月的自然老化。' },
      { speaker: '⚠️ 警告', text: '赶往暗窟制止闪光拍摄。你的反应窗口只有6秒。' },
    ],
    successDeltas: { risk: -4, evidence: 3, reputation: 2 },
    successMsg: '你在游客按下第三次快门前赶到。相机被暂时保管，游客接受了一番文物保护教育。',
    failDeltas: { risk: 6, evidence: -1 },
    failMsg: '又是一道闪光在壁画上闪过。光化学损伤是不可逆的——数字档案室会记录这个遗憾。',
  },
  {
    id: 'loud_noise',
    title: '游客大声喧哗',
    description: '游客在回声效应强烈的洞窟内大声交谈——持续高分贝可能导致壁画微振动和岩层脱落。',
    durationMs: 10000,
    action: 'chase',
    introLines: [
      { speaker: '⚠️ 警告', text: '中心窟室检测到持续高于85分贝的噪音。石窟内部的回声放大效应会把声波反弹到壁画上，引发微振动。' },
      { speaker: '⚠️ 警告', text: '找到声源——用你对石窟的了解，向游客解释安静游览的意义。' },
    ],
    successDeltas: { risk: -3, reputation: 4, evidence: 2 },
    successMsg: '你轻声向游客讲述了壁画的历史——"一千年前，画师们也在这里安静地工作。"游客们不自觉地放低了声音。',
    failDeltas: { risk: 5, reputation: -1 },
    failMsg: '你没能及时安抚游客。声音在石窟中回荡，监测仪捕捉到壁画表面的细微震动。',
  },
]

// ─── 主类 ──────────────────────────────────────────────────────────────────

export class TouristManager {
  private scene: Phaser.Scene
  private mapData: Uint8Array
  private roomGraph!: Map<string, RoomNode>
  private tourists: Tourist[] = []
  private graphReady = false
  private spawnTimer = 0
  private spawnInterval = 4000
  private maxTourists = 0
  private eventCheckTimer = 0
  private activeEvent: TouristEvent | null = null
  private activeEventTourist: Tourist | null = null
  private eventTimer = 0
  private eventResolved = false
  private eventCooldown = 0   // 事件冷却，防止连续触发
  private obstacles: ObstacleData[] = []  // 障碍物数据（用于避让）

  onEventTrigger: ((event: TouristEvent) => void) | null = null
  onEventResolve: ((event: TouristEvent, success: boolean, choiceDeltas?: Partial<Record<string, number>>) => void) | null = null

  constructor(scene: Phaser.Scene, mapData: Uint8Array) {
    this.scene = scene
    this.mapData = mapData
  }

  /** 接收障碍物位置数据（由 GameScene.placeRoomObstacles 后传入） */
  setObstacles(data: ObstacleData[]): void {
    this.obstacles = data
  }

  // ═════════════════════════════════════════════════════════════════════
  // 密度控制
  // ═════════════════════════════════════════════════════════════════════

  updateDensity(flags: GameFlags): void {
    this.ensureGraph()

    if (flags['cave_closure']) {
      this.maxTourists = 0
      this.despawnAll()
    } else if (flags['free_flow']) {
      this.maxTourists = 8
      this.spawnInterval = 2500
    } else if (flags['batch_flow']) {
      this.maxTourists = 4
      this.spawnInterval = 6000
    } else {
      this.maxTourists = 3
      this.spawnInterval = 5000
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 每帧更新
  // ═════════════════════════════════════════════════════════════════════

  update(delta: number, playerX: number, playerY: number, inputLocked: boolean): void {
    const dt = delta / 1000

    this.updateTourists(dt)

    if (!inputLocked) {
      this.spawnTimer += delta
      if (this.spawnTimer >= this.spawnInterval && this.tourists.length < this.maxTourists) {
        this.spawnTimer = 0
        this.spawnTourist()
      }
    }

    this.despawnDone()

    if (!inputLocked && !this.activeEvent) {
      this.eventCheckTimer += delta
      if (this.eventCheckTimer >= 8000 && this.tourists.length > 0) {
        this.eventCheckTimer = 0
        this.tryTriggerEvent(playerX, playerY)
      }
    }

    if (this.activeEvent && !this.eventResolved) {
      this.eventTimer += delta
      if (this.activeEvent.action === 'timing' || this.activeEvent.action === 'chase') {
        // 追加 3 秒宽限期（dialog 播放时间），防止尚未到场就超时
        if (this.eventTimer >= this.activeEvent.durationMs + 3000) {
          this.resolveEvent(false)
        }
      }
    }

    // 事件冷却
    if (this.eventCooldown > 0) {
      this.eventCooldown -= delta
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 生成
  // ═════════════════════════════════════════════════════════════════════

  private ensureGraph(): void {
    if (this.graphReady) return
    this.roomGraph = buildRoomGraph()
    this.graphReady = true
  }

  private spawnTourist(): void {
    this.ensureGraph()
    const gateNode = this.roomGraph.get('gate-room')!
    const variant = Math.floor(Math.random() * 3)

    // ★ 出生在 gate-room 顶部安全区（row 52，y≈832~848，在所有障碍物上方）
    // gate-room 障碍物分布在 y=888~944（gate、guardians、pillars），安全区在 y=820~860
    const sx = gateNode.x + (Math.random() - 0.5) * 48   // 776 ~ 824
    const sy = 840 + (Math.random() - 0.5) * 16          // 832 ~ 848

    const spr = this.scene.add.sprite(sx, sy, 'player')
    spr.setDepth(Math.floor(sy / 28)).setScale(0.7).setAlpha(0)
    const colors = [0x6eb5c0, 0xe8a87c, 0xc4a882]
    spr.setTint(colors[variant % colors.length])

    const label = this.scene.add.text(sx, sy - 16, '🧑 游客', {
      fontSize: '7px', color: '#aac4cf', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(Math.floor(sy / 28) + 0.5)

    this.scene.tweens.add({
      targets: spr, alpha: 0.75, duration: 800, ease: 'Sine.easeIn',
    })

    // 随机选第一个参观目标（从全部窟室）
    const visited = new Set<string>(['gate-room'])
    const firstTarget = this.pickNextRoom('gate-room', 'gate-room', visited)

    const tourist: Tourist = {
      sprite: spr, nameLabel: label,
      speed: 28 + Math.random() * 18,
      pauseUntil: 0, variant,
      currentRoomId: 'gate-room',
      targetRoomId: firstTarget,
      waypoints: this.buildPath('gate-room', firstTarget),
      wpIndex: 0,
      arrived: false,
      roomsVisited: 0,
      maxRooms: 3 + Math.floor(Math.random() * 3),  // 参观 3-5 间后离场
      previousRoomId: 'gate-room',
      headingHome: false,
      visitedRooms: visited,
    }
    this.tourists.push(tourist)
  }

  /** 从全部窟室中随机选下一个目标（非邻居，全图 BFS 可达） */
  private pickNextRoom(current: string, previous: string, visited: Set<string>): string {
    // ★ 全部可参观窟室（排除 gate-room 和当前所在）
    const allRooms = [...this.roomGraph.keys()].filter(
      id => id !== current && id !== previous && id !== 'gate-room'
    )

    if (allRooms.length === 0) return 'gate-room'

    // ★ 优先未参观过的房间
    const unvisited = allRooms.filter(id => !visited.has(id))
    const pool = unvisited.length > 0 ? unvisited : allRooms

    return pool[Math.floor(Math.random() * pool.length)]
  }

  /** BFS 搜索房间 A → B 的最短路径（返回房间 ID 序列，含起点和终点） */
  private findRoomPath(fromId: string, toId: string): string[] {
    if (fromId === toId) return [fromId]

    const visited = new Set<string>([fromId])
    const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }]

    while (queue.length > 0) {
      const { id, path } = queue.shift()!
      const node = this.roomGraph.get(id)
      if (!node) continue

      for (const neighbor of node.neighbors) {
        if (visited.has(neighbor.targetRoomId)) continue
        const newPath = [...path, neighbor.targetRoomId]
        if (neighbor.targetRoomId === toId) return newPath
        visited.add(neighbor.targetRoomId)
        queue.push({ id: neighbor.targetRoomId, path: newPath })
      }
    }

    return [fromId, toId] // fallback（不会发生）
  }

  /** 构建从房间 A 到房间 B 的路径（支持跨房间 BFS + 每段走廊中继） */
  private buildPath(fromId: string, toId: string): { x: number; y: number }[] {
    // ★ BFS 找房间序列
    const roomPath = this.findRoomPath(fromId, toId)
    const waypoints: { x: number; y: number }[] = []

    // ★ 逐段拼接：出口路点 → 走廊中继 → … → 最终目标
    for (let i = 0; i < roomPath.length - 1; i++) {
      const a = roomPath[i]
      const b = roomPath[i + 1]

      // 添加房间 A → B 的出口路点
      const exitWp = ROOM_EXIT[a]?.[b]
      if (exitWp) {
        waypoints.push({ x: exitWp.x + (Math.random() - 0.5) * 12, y: exitWp.y + (Math.random() - 0.5) * 8 })
      }

      // 添加走廊中继点
      const edge = this.roomGraph.get(a)?.neighbors.find(n => n.targetRoomId === b)
      if (edge) waypoints.push(...edge.waypoints)
    }

    // ★ 终点：目标房间中心 + 安全偏移
    const dest = getRoomCenter(toId)
    const endWp = toId === 'gate-room'
      ? { x: dest.x + (Math.random() - 0.5) * 48, y: 840 + (Math.random() - 0.5) * 16 }
      : this.findSafeWaypoint(dest.x, dest.y, 48, 32)

    waypoints.push(endWp)
    return waypoints
  }

  // ═════════════════════════════════════════════════════════════════════
  // 离场
  // ═════════════════════════════════════════════════════════════════════

  private despawnAll(): void {
    this.tourists.forEach((t) => {
      this.scene.tweens.add({
        targets: [t.sprite, t.nameLabel],
        alpha: 0, duration: 400,
        onComplete: () => { t.sprite.destroy(); t.nameLabel.destroy() },
      })
    })
    this.tourists = []
  }

  /** 完成参观的游客淡出离场 */
  private despawnDone(): void {
    this.tourists = this.tourists.filter((t) => {
      if (t.headingHome && t.currentRoomId === 'gate-room' && t.arrived && this.scene.time.now > t.pauseUntil) {
        this.scene.tweens.add({
          targets: [t.sprite, t.nameLabel],
          alpha: 0, duration: 600,
          onComplete: () => { t.sprite.destroy(); t.nameLabel.destroy() },
        })
        return false
      }
      return true
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // 移动 + 墙壁排斥 steering
  // ═════════════════════════════════════════════════════════════════════

  private updateTourists(dt: number): void {
    const now = this.scene.time.now
    this.tourists.forEach((t) => {
      if (t.pauseUntil > now) return

      // 动态深度：按 y 坐标排序（top-down 视图约定）
      t.sprite.setDepth(Math.floor(t.sprite.y / 28))
      t.nameLabel.setDepth(Math.floor(t.sprite.y / 28) + 0.5)

      // ★ 脱困：如果卡在障碍物内，强制推出
      this.unstuckFromObstacles(t)

      // 没有路点 → 生成新目标
      if (t.waypoints.length === 0 || t.wpIndex >= t.waypoints.length) {
        this.onTouristReachDestination(t)
        return
      }

      const wp = t.waypoints[t.wpIndex]
      const dx = wp.x - t.sprite.x
      const dy = wp.y - t.sprite.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 6) {
        if (!t.arrived) {
          t.arrived = true
          // 中继路点只短暂停顿，目标房间停留更长
          const isFinalRoom = t.wpIndex >= t.waypoints.length - 1
          t.pauseUntil = now + (isFinalRoom
            ? 2000 + Math.random() * 4000   // 房间内 2-6s
            : 50 + Math.random() * 150)      // 走廊中继 50-200ms
          this.scene.tweens.add({
            targets: t.sprite, y: t.sprite.y - 2, duration: 300, yoyo: true,
          })
        } else if (now > t.pauseUntil) {
          t.arrived = false
          t.wpIndex++
        }
      } else {
        t.arrived = false
        this.steerToward(t, dx, dy, dist, dt)
      }
    })
  }

  /** 脱困：如果游客在障碍物内，沿最近的方向推出 */
  private unstuckFromObstacles(t: Tourist): void {
    const touristR = 8
    for (const obs of this.obstacles) {
      if (!this.collidesWithObstacle(t.sprite.x, t.sprite.y, touristR, obs)) continue

      // 游客在这个障碍物内部 — 找最短推出方向
      const leftDist = (t.sprite.x + touristR) - (obs.x - obs.hw)
      const rightDist = (obs.x + obs.hw) - (t.sprite.x - touristR)
      const topDist = (t.sprite.y + touristR) - (obs.y - obs.hh)
      const bottomDist = (obs.y + obs.hh) - (t.sprite.y - touristR)

      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist)
      if (minDist === leftDist) t.sprite.x = obs.x - obs.hw - touristR - 1
      else if (minDist === rightDist) t.sprite.x = obs.x + obs.hw + touristR + 1
      else if (minDist === topDist) t.sprite.y = obs.y - obs.hh - touristR - 1
      else t.sprite.y = obs.y + obs.hh + touristR + 1

      t.nameLabel.setPosition(t.sprite.x, t.sprite.y - 16)
      // 只处理第一个碰撞的障碍物（避免连续推出太远）
      return
    }
  }

  /** reach 最后一个 waypoint → 进入新房间 */
  private onTouristReachDestination(t: Tourist): void {
    t.currentRoomId = t.targetRoomId
    t.roomsVisited++
    t.visitedRooms.add(t.targetRoomId)   // ★ 标记已参观
    t.arrived = true
    t.pauseUntil = this.scene.time.now + 2000 + Math.random() * 4000

    // 检查是否该回家了
    if (t.roomsVisited >= t.maxRooms && !t.headingHome) {
      t.headingHome = true
      t.previousRoomId = t.currentRoomId
      t.targetRoomId = 'gate-room'
      t.waypoints = this.buildPath(t.currentRoomId, 'gate-room')
      t.wpIndex = 0
      return
    }

    // 已回家 → 会在 despawnDone 中清理
    if (t.headingHome && t.currentRoomId === 'gate-room') return

    // ★ 选下一个随机窟室（全石窟随机，优先未参观）
    const next = this.pickNextRoom(t.currentRoomId, t.previousRoomId, t.visitedRooms)
    t.previousRoomId = t.currentRoomId
    t.targetRoomId = next
    t.waypoints = this.buildPath(t.currentRoomId, next)
    t.wpIndex = 0
  }

  /** steering: 路点引力 + 墙壁排斥 + 障碍物排斥 + 垂直滑动 */
  private steerToward(t: Tourist, dx: number, dy: number, dist: number, dt: number): void {
    const toWpX = dx / dist
    const toWpY = dy / dist
    const tpx = t.sprite.x, tpy = t.sprite.y
    const touristR = 8

    // ── 墙壁排斥力（瓦片级）──
    let repelX = 0, repelY = 0
    const tc = Math.floor(tpx / TILE_SIZE)
    const tr = Math.floor(tpy / TILE_SIZE)
    const scanR = 3

    for (let dr = -scanR; dr <= scanR; dr++) {
      for (let dc = -scanR; dc <= scanR; dc++) {
        if (dr === 0 && dc === 0) continue
        const sc = tc + dc, sr = tr + dr
        if (sc < 0 || sc >= MAP_COLS || sr < 0 || sr >= MAP_ROWS) continue
        if (this.mapData[sr * MAP_COLS + sc] === 2) {
          const d = Math.sqrt(dc * dc + dr * dr)
          if (d < 0.1) continue
          const strength = 1 / (d * d)
          repelX -= (dc / d) * strength
          repelY -= (dr / d) * strength
        }
      }
    }

    // ── 障碍物排斥力 ──
    let closestObsDist = Infinity
    for (const obs of this.obstacles) {
      const d = this.distToObstacle(tpx, tpy, obs)
      if (d < closestObsDist) closestObsDist = d

      const closestX = Math.max(obs.x - obs.hw, Math.min(tpx, obs.x + obs.hw))
      const closestY = Math.max(obs.y - obs.hh, Math.min(tpy, obs.y + obs.hh))
      const ddx = tpx - closestX
      const ddy = tpy - closestY
      const d2 = Math.sqrt(ddx * ddx + ddy * ddy)

      const repelRange = obs.hw + obs.hh + 16
      if (d2 < repelRange) {
        if (d2 < 1) {
          const toCenter = Math.sqrt((tpx - obs.x) ** 2 + (tpy - obs.y) ** 2)
          if (toCenter > 0.1) {
            repelX += (tpx - obs.x) / toCenter * 5
            repelY += (tpy - obs.y) / toCenter * 5
          }
        } else {
          const strength = (repelRange - d2) / repelRange
          repelX += (ddx / d2) * strength * 4
          repelY += (ddy / d2) * strength * 4
        }
      }
    }

    // ── 动态混合权重：越靠近障碍物，排斥力占比越大 ──
    const obsInfluence = closestObsDist < 70 ? Math.max(0, 1 - closestObsDist / 70) : 0
    const repelWeight = 0.2 + obsInfluence * 0.7   // 0.2~0.9
    const wpWeight = 1 - repelWeight                // 0.8~0.1

    const repelMag = Math.sqrt(repelX * repelX + repelY * repelY)
    if (repelMag > 0.001) { repelX /= repelMag; repelY /= repelMag }

    let dirX = toWpX * wpWeight + repelX * repelWeight
    let dirY = toWpY * wpWeight + repelY * repelWeight
    const dirMag = Math.sqrt(dirX * dirX + dirY * dirY)
    if (dirMag > 0.001) { dirX /= dirMag; dirY /= dirMag }

    const moveX = dirX * t.speed * dt
    const moveY = dirY * t.speed * dt
    let nextX = tpx + moveX
    let nextY = tpy + moveY

    // ── 墙壁碰撞 ──
    const ncol = Math.floor(nextX / TILE_SIZE)
    const nrow = Math.floor(nextY / TILE_SIZE)
    let canMoveX = true, canMoveY = true
    if (ncol >= 0 && ncol < MAP_COLS && nrow >= 0 && nrow < MAP_ROWS) {
      if (this.mapData[nrow * MAP_COLS + ncol] === 2) {
        const tileX = this.mapData[Math.floor(tpy / TILE_SIZE) * MAP_COLS + ncol]
        const tileY = this.mapData[nrow * MAP_COLS + Math.floor(tpx / TILE_SIZE)]
        if (tileX === 2) canMoveX = false
        if (tileY === 2) canMoveY = false
      }
    }

    // ── 障碍物碰撞 + 垂直滑动 ──
    const blockedByObstacle = (testX: number, testY: number): boolean => {
      for (const obs of this.obstacles) {
        if (this.collidesWithObstacle(testX, testY, touristR, obs)) return true
      }
      return false
    }

    if (canMoveX && blockedByObstacle(nextX, tpy)) canMoveX = false
    if (canMoveY && blockedByObstacle(tpx, nextY)) canMoveY = false

    // 如果被障碍物双向阻挡，尝试垂直滑动绕过
    if (!canMoveX && !canMoveY) {
      // 尝试4个垂直/对角线方向
      const slides = [
        [dirY, -dirX],           // 右垂直
        [-dirY, dirX],           // 左垂直
        [dirX * 0.7 + dirY * 0.7, dirY * 0.7 - dirX * 0.7],
        [dirX * 0.7 - dirY * 0.7, dirY * 0.7 + dirX * 0.7],
      ]
      let found = false
      for (const [sdX, sdY] of slides) {
        const sm = Math.sqrt(sdX * sdX + sdY * sdY)
        if (sm < 0.001) continue
        const sNX = tpx + (sdX / sm) * t.speed * dt
        const sNY = tpy + (sdY / sm) * t.speed * dt
        if (!blockedByObstacle(sNX, tpy) && !blockedByObstacle(tpx, sNY)) {
          nextX = sNX; nextY = sNY
          canMoveX = true; canMoveY = true
          found = true
          break
        }
      }
      // 如果垂直也不行，尝试反向（直接后退）
      if (!found) {
        const backX = tpx - toWpX * t.speed * dt
        const backY = tpy - toWpY * t.speed * dt
        if (!blockedByObstacle(backX, backY)) {
          nextX = backX; nextY = backY
          canMoveX = true; canMoveY = true
        }
      }
    }

    if (canMoveX) t.sprite.x = nextX
    if (canMoveY) t.sprite.y = nextY

    t.nameLabel.setPosition(t.sprite.x, t.sprite.y - 16)
    if (dirX < -0.1) t.sprite.setFlipX(true)
    else if (dirX > 0.1) t.sprite.setFlipX(false)
  }

  /** 圆（游客） vs 矩形（障碍物）碰撞检测 */
  private collidesWithObstacle(cx: number, cy: number, r: number, obs: ObstacleData): boolean {
    const closestX = Math.max(obs.x - obs.hw, Math.min(cx, obs.x + obs.hw))
    const closestY = Math.max(obs.y - obs.hh, Math.min(cy, obs.y + obs.hh))
    const dx = cx - closestX
    const dy = cy - closestY
    return (dx * dx + dy * dy) < (r * r)
  }

  /** 游客到障碍物的最短距离（用于动态权重计算） */
  private distToObstacle(px: number, py: number, obs: ObstacleData): number {
    const closestX = Math.max(obs.x - obs.hw, Math.min(px, obs.x + obs.hw))
    const closestY = Math.max(obs.y - obs.hh, Math.min(py, obs.y + obs.hh))
    const dx = px - closestX
    const dy = py - closestY
    return Math.sqrt(dx * dx + dy * dy)
  }

  /** 检测一个点是否在障碍物内（用于出生点和路点校验） */
  private isInsideAnyObstacle(x: number, y: number, margin = 8): boolean {
    for (const obs of this.obstacles) {
      if (x > obs.x - obs.hw - margin && x < obs.x + obs.hw + margin &&
          y > obs.y - obs.hh - margin && y < obs.y + obs.hh + margin) {
        return true
      }
    }
    return false
  }

  /** 在中心点附近找一个不与障碍物重叠的安全位置 */
  private findSafePosition(cx: number, cy: number, range: number, isY = false): number {
    const base = isY ? cy : cx
    for (let attempt = 0; attempt < 10; attempt++) {
      const offset = (Math.random() - 0.5) * range * 2
      const testX = isY ? cx : cx + offset
      const testY = isY ? cy + offset : cy
      if (!this.isInsideAnyObstacle(testX, testY, 10)) {
        return isY ? testY : testX
      }
    }
    // 全部失败 — 向下偏移（gate-room 出口在下方）
    return isY ? base + range : base + (Math.random() - 0.5) * range
  }

  /** 在房间中心附近找一个安全路点 */
  private findSafeWaypoint(cx: number, cy: number, rangeX: number, rangeY: number): { x: number; y: number } {
    for (let attempt = 0; attempt < 15; attempt++) {
      const x = cx + (Math.random() - 0.5) * rangeX * 2
      const y = cy + (Math.random() - 0.5) * rangeY * 2
      if (!this.isInsideAnyObstacle(x, y, 10)) {
        return { x, y }
      }
    }
    // 全部失败 — 用房间中心
    return { x: cx, y: cy }
  }

  // ═════════════════════════════════════════════════════════════════════
  // P1: 随机事件
  // ═════════════════════════════════════════════════════════════════════

  private tryTriggerEvent(playerX: number, playerY: number): void {
    if (Math.random() > 0.15) return
    // 事件冷却：一场事件结束后 10 秒内不再触发
    if (this.eventCooldown > 0) return
    const nearbyTourists = this.tourists.filter((t) =>
      t.arrived && Phaser.Math.Distance.Between(playerX, playerY, t.sprite.x, t.sprite.y) < 300
    )
    if (nearbyTourists.length === 0) return

    const availableEvents = TOURIST_EVENT_POOL.filter((e) => e.id !== this.activeEvent?.id)
    if (availableEvents.length === 0) return
    const event = availableEvents[Math.floor(Math.random() * availableEvents.length)]

    this.activeEvent = event
    this.activeEventTourist = nearbyTourists[Math.floor(Math.random() * nearbyTourists.length)]
    this.eventTimer = 0
    this.eventResolved = false

    if (this.activeEventTourist) {
      this.activeEventTourist.nameLabel.setText('⚠️ 游客')
      this.activeEventTourist.nameLabel.setColor('#d95a54')
      this.scene.tweens.add({
        targets: this.activeEventTourist.nameLabel,
        alpha: 0.3, duration: 400, yoyo: true, repeat: -1,
      })
    }
    this.onEventTrigger?.(event)
  }

  getActiveEventPosition(): { x: number; y: number } | null {
    if (!this.activeEventTourist) return null
    return { x: this.activeEventTourist.sprite.x, y: this.activeEventTourist.sprite.y }
  }
  getActiveEvent(): TouristEvent | null { return this.activeEvent }
  isNearActiveEvent(x: number, y: number, radius = 50): boolean {
    if (!this.activeEvent || this.eventResolved || !this.activeEventTourist) return false
    return Phaser.Math.Distance.Between(x, y, this.activeEventTourist.sprite.x, this.activeEventTourist.sprite.y) < radius
  }
  getTouristCount(): number { return this.tourists.length }

  resolveEvent(success: boolean, choiceDeltas?: Partial<Record<string, number>>): void {
    if (!this.activeEvent || this.eventResolved) return
    this.eventResolved = true
    this.eventCooldown = 10000  // 10 秒冷却，防止连续触发
    if (this.activeEventTourist) {
      this.activeEventTourist.nameLabel.setText('🧑 游客')
      this.activeEventTourist.nameLabel.setColor('#aac4cf')
      this.scene.tweens.killTweensOf(this.activeEventTourist.nameLabel)
      this.activeEventTourist.nameLabel.setAlpha(1)
    }
    this.onEventResolve?.(this.activeEvent, success, choiceDeltas)
    this.scene.time.delayedCall(500, () => {
      this.activeEvent = null
      this.activeEventTourist = null
      this.eventResolved = false
    })
  }

  destroy(): void {
    this.tourists.forEach((t) => { t.sprite.destroy(); t.nameLabel.destroy() })
    this.tourists = []
  }
}
