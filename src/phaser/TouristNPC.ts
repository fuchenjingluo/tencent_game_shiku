// ────────────────────────────────────────────────────────────────────────────
// TouristNPC v3.0 — 游客随机漫步系统
// 游客在全地图随机走动，无固定路线/目标房间/出生点
// 加载完成时游客已随机散布在各窟室中，即刻开始漫游
// P1: 随机事件 — 基于玩家-游客距离的交互事件触发
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'
import { TILE_SIZE, MAP_COLS, MAP_ROWS, ROOMS } from './mapData'
import type { GameFlags } from '../types'

// ─── 障碍物数据（由 GameScene 传入，用于游客避让） ────────────────────────

export interface ObstacleData {
  x: number       // 障碍物中心像素 x
  y: number       // 障碍物中心像素 y
  hw: number      // 半宽（像素）
  hh: number      // 半高（像素）
}

// ─── 状态机 ────────────────────────────────────────────────────────────────

type TouristState = 'roaming' | 'traveling' | 'blocked'
// roaming   = 在区域内自由漫步（每帧选近距离路点，严格限室内）
// traveling = 沿 BFS 路径前往目标区域
// blocked   = 卡在障碍物中，正在脱困

interface Tourist {
  sprite: Phaser.GameObjects.Sprite
  nameLabel: Phaser.GameObjects.Text
  speed: number              // px/s
  pauseUntil: number         // 停留到何时（各状态通用）
  variant: number            // 外观变体 (0-2)

  // 路点导航
  waypoints: { x: number; y: number }[]
  wpIndex: number
  arrived: boolean

  // 避障与排斥
  laneOffset: number
  stuckTimer: number
  lastStuckX: number
  lastStuckY: number

  // 状态机
  state: TouristState
  prevState: TouristState    // blocked 返回时恢复的状态
  currentRoomId: string | null
  targetZoneId: string | null  // traveling 时前往的目标区域
  zoneEnterTime: number        // 进入当前区域的时间（roaming 计时用）
  roamDuration: number         // roaming 在本区域的停留时长

  // debug 倒计时显示
  countdownText: Phaser.GameObjects.Text
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
    failMsg: '你没能及时制止。壁画表面留下了一道浅色指印。文物保护部门即将派人进行紧急评估。',
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
  {
    id: 'trip_hazard',
    title: '游客被绊倒',
    description: '设备间走廊有游客被地面线缆绊倒！设备有损坏风险，游客也可能受伤。',
    durationMs: 7000,
    action: 'timing',
    introLines: [
      { speaker: '⚠️ 警告', text: '设备间传来闷响——一名游客被地上的监测线缆绊倒了！旁边的除湿机被撞歪。' },
      { speaker: '⚠️ 警告', text: '前往设备间扶起游客并检查设备——你只有7秒时间避免事态扩大。' },
    ],
    successDeltas: { risk: -3, reputation: 4, evidence: 2 },
    successMsg: '你快步上前扶起游客，迅速检查了设备状态。游客只是轻微擦伤，对你们的快速反应表示感谢。',
    failDeltas: { risk: 6, budget: -2, reputation: -2 },
    failMsg: '游客自己爬了起来，但除湿机被撞歪导致湿度读数异常。可能需要额外检修——账单会寄到的。',
  },
  {
    id: 'curious_equipment',
    title: '游客误触设备',
    description: '供电区有游客好奇地触碰监测仪器面板——可能误改关键参数！',
    durationMs: 8000,
    action: 'chase',
    introLines: [
      { speaker: '⚠️ 警告', text: '供电区控制面板上出现异常触控信号！有人正在触碰监测仪器的参数设置界面。' },
      { speaker: '⚠️ 警告', text: '关键参数一旦被改动，整个石窟的监测数据链将断联。前往供电区制止游客。' },
    ],
    successDeltas: { risk: -5, evidence: 3, reputation: 3 },
    successMsg: '你赶到时游客正尴尬地抽回手。"抱歉，我以为这是介绍石窟历史的触摸屏。"你恢复了所有设置，面板重新进入锁定模式。',
    failDeltas: { risk: 9, evidence: -4, budget: -2 },
    failMsg: '你赶到时面板上的湿度阈值已被调至异常区间。需要重新校准所有传感器——这个失误至少浪费了两个工作日的数据。',
  },
]

// ─── 主类 ──────────────────────────────────────────────────────────────────

export class TouristManager {
  private scene: Phaser.Scene
  private mapData: Uint8Array
  private tourists: Tourist[] = []
  private maxTourists = 0
  private eventCheckTimer = 0
  private activeEvent: TouristEvent | null = null
  private activeEventTourist: Tourist | null = null
  private eventTimer = 0
  private eventResolved = false
  private eventCooldown = 0
  private obstacles: ObstacleData[] = []
  private debugGfx: Phaser.GameObjects.Graphics | null = null
  private debugVisible = false

  onEventTrigger: ((event: TouristEvent) => void) | null = null
  onEventResolve: ((event: TouristEvent, success: boolean, choiceDeltas?: Partial<Record<string, number>>, choiceId?: string) => void) | null = null

  constructor(scene: Phaser.Scene, mapData: Uint8Array) {
    this.scene = scene
    this.mapData = mapData
    this.debugGfx = scene.add.graphics()
    this.debugGfx.setDepth(9999)
    this.debugGfx.setVisible(false)
  }

  /** 接收障碍物位置数据（由 GameScene.placeRoomObstacles 后传入） */
  setObstacles(data: ObstacleData[]): void {
    this.obstacles = data
  }

  /** 开启/关闭路线可视化 */
  setDebug(visible: boolean): void {
    this.debugVisible = visible
    if (this.debugGfx) this.debugGfx.setVisible(visible)
    this.tourists.forEach(t => t.countdownText.setVisible(visible))
  }

  // ═════════════════════════════════════════════════════════════════════
  // 密度控制 — 立即创建/增减游客，不再逐步生成
  // ═════════════════════════════════════════════════════════════════════

  updateDensity(flags: GameFlags): void {
    if (flags['cave_closure']) {
      this.despawnAll()
      this.maxTourists = 0
      return
    }

    let target = 10
    if (flags['free_flow']) target = 14
    else if (flags['batch_flow']) target = 12

    // ★ 首次创建：每个房间至少分配 1 个游客，剩余随机分配
    if (this.tourists.length === 0 && target >= ROOMS.length) {
      const roomOrder = [...ROOMS].sort(() => Math.random() - 0.5)
      for (const room of roomOrder) {
        this.createTouristInRoom(room.id)
      }
      // 剩余的随机分配
      while (this.tourists.length < target) {
        this.createTouristAtRandomPosition()
      }
    } else {
      while (this.tourists.length < target) {
        this.createTouristAtRandomPosition()
      }
    }
    while (this.tourists.length > target) {
      const t = this.tourists.pop()!
      this.removeTourist(t)
    }
    this.maxTourists = target
  }

  /**
   * 在 7 个房间中随机散布一个游客。
   * 调用时机：首次 updateDensity() + 需要增加游客数时。
   */
  private createTouristAtRandomPosition(): void {
    const room = ROOMS[Math.floor(Math.random() * ROOMS.length)]
    this.createTouristInRoom(room.id)
  }

  /** 在指定房间内创建一个游客 */
  private createTouristInRoom(roomId: string): void {
    const variant = Math.floor(Math.random() * 3)
    const pos = this.pickRoomSpawnPosition(roomId)
    const sx = pos.x, sy = pos.y

    const spr = this.scene.add.sprite(sx, sy, 'player')
    spr.setDepth(Math.floor(sy / 28)).setScale(0.7)
    const colors = [0x6eb5c0, 0xe8a87c, 0xc4a882]
    spr.setTint(colors[variant % colors.length])

    const label = this.scene.add.text(sx, sy - 16, '🧑 游客', {
      fontSize: '9px', color: '#c8dee8', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
      backgroundColor: '#0d0a05cc',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(Math.floor(sy / 28) + 0.5)

    const spawnedRoom = this.findRoomIdAt(sx, sy)

    // debug 倒计时文本（默认隐藏，按T开启）
    const countdownText = this.scene.add.text(sx, sy - 28, '', {
      fontSize: '8px', color: '#ffdd44', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(9999).setVisible(false)

    const tourist: Tourist = {
      sprite: spr, nameLabel: label,
      speed: 28 + Math.random() * 18,
      pauseUntil: 0, variant,
      waypoints: [],
      wpIndex: 0,
      arrived: false,
      laneOffset: (Math.random() - 0.5) * 1.8,
      stuckTimer: 0,
      lastStuckX: sx,
      lastStuckY: sy,
      state: 'roaming',
      prevState: 'roaming',
      currentRoomId: spawnedRoom,
      targetZoneId: null,
      zoneEnterTime: this.scene.time.now,
      roamDuration: 8000 + Math.random() * 12000,
      countdownText,
    }
    this.tourists.push(tourist)
  }

  /** 从指定房间内返回一个可走行的像素位置 */
  private pickRoomSpawnPosition(preferredRoomId?: string): { x: number; y: number } {
    const room = preferredRoomId
      ? (ROOMS.find(r => r.id === preferredRoomId) ?? ROOMS[Math.floor(Math.random() * ROOMS.length)])
      : ROOMS[Math.floor(Math.random() * ROOMS.length)]
    const roomCX = (room.x + room.w / 2) * TILE_SIZE
    const roomCY = (room.y + room.h / 2) * TILE_SIZE
    const rangeX = (room.w - 2) * TILE_SIZE / 2
    const rangeY = (room.h - 2) * TILE_SIZE / 2

    for (let attempt = 0; attempt < 40; attempt++) {
      const x = roomCX + (Math.random() - 0.5) * rangeX * 2
      const y = roomCY + (Math.random() - 0.5) * rangeY * 2
      if (!this.isWallTile(x, y) && !this.isInsideAnyObstacle(x, y, 28)) {
        return { x, y }
      }
    }
    // fallback：找房间内任意远离障碍物的点
    const escape = this.pickEscapePoint(roomCX, roomCY)
    return escape
  }

  private countTouristsInRoom(roomId: string): number {
    let count = 0
    for (const t of this.tourists) {
      if (this.findRoomIdAt(t.sprite.x, t.sprite.y) === roomId) count++
    }
    return count
  }

  private findPathWaypoints(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
  ): { x: number; y: number }[] {
    const start = this.findNearestWalkableTile(Math.floor(startX / TILE_SIZE), Math.floor(startY / TILE_SIZE))
    const goal = this.findNearestWalkableTile(Math.floor(goalX / TILE_SIZE), Math.floor(goalY / TILE_SIZE))
    if (!start || !goal) return []

    const key = (c: number, r: number) => `${c},${r}`
    const queue: { c: number; r: number }[] = [start]
    const cameFrom = new Map<string, string | null>([[key(start.c, start.r), null]])
    const dirs = [
      { c: 1, r: 0 },
      { c: -1, r: 0 },
      { c: 0, r: 1 },
      { c: 0, r: -1 },
    ]

    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head]
      if (cur.c === goal.c && cur.r === goal.r) break
      for (const d of dirs) {
        const nc = cur.c + d.c
        const nr = cur.r + d.r
        const nk = key(nc, nr)
        if (cameFrom.has(nk) || !this.isWalkableTile(nc, nr)) continue
        cameFrom.set(nk, key(cur.c, cur.r))
        queue.push({ c: nc, r: nr })
      }
    }

    const goalKey = key(goal.c, goal.r)
    if (!cameFrom.has(goalKey)) return []

    const tiles: { c: number; r: number }[] = []
    let curKey: string | null = goalKey
    while (curKey) {
      const [c, r] = curKey.split(',').map(Number)
      tiles.push({ c, r })
      curKey = cameFrom.get(curKey) ?? null
    }
    tiles.reverse()

    const waypoints: { x: number; y: number }[] = []
    let lastDir = ''
    let lastAddedIndex = 0
    const stride = 4

    for (let i = 1; i < tiles.length; i++) {
      const prev = tiles[i - 1]
      const tile = tiles[i]
      const dir = `${Math.sign(tile.c - prev.c)},${Math.sign(tile.r - prev.r)}`
      const directionChanged = dir !== lastDir && i > 1
      const enoughDistance = i - lastAddedIndex >= stride

      if (directionChanged || enoughDistance) {
        const anchor = directionChanged ? prev : tile
        waypoints.push({ x: (anchor.c + 0.5) * TILE_SIZE, y: (anchor.r + 0.5) * TILE_SIZE })
        lastAddedIndex = i
      }
      lastDir = dir
    }
    waypoints.push({ x: goalX, y: goalY })

    return waypoints.filter((wp, index) =>
      index === 0 || Phaser.Math.Distance.Between(waypoints[index - 1].x, waypoints[index - 1].y, wp.x, wp.y) > 10
    )
  }

  private findNearestWalkableTile(col: number, row: number): { c: number; r: number } | null {
    for (let radius = 0; radius <= 8; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue
          const c = col + dc
          const r = row + dr
          if (this.isWalkableTile(c, r)) return { c, r }
        }
      }
    }
    return null
  }

  private isWalkableTile(col: number, row: number): boolean {
    if (col < 1 || col >= MAP_COLS - 1 || row < 1 || row >= MAP_ROWS - 1) return false
    if (this.mapData[row * MAP_COLS + col] === 2) return false
    const x = (col + 0.5) * TILE_SIZE
    const y = (row + 0.5) * TILE_SIZE
    return !this.isInsideAnyObstacle(x, y, 12)
  }

  /** 卡住时找到一个安全点（远离障碍物） */
  private pickEscapePoint(fromX: number, fromY: number): { x: number; y: number } {
    // 尝试 8 个方向，找最近的可行走点
    const step = TILE_SIZE * 1.5
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      for (let mult = 1; mult <= 5; mult++) {
        const d = step * mult
        const x = fromX + Math.cos(angle) * d
        const y = fromY + Math.sin(angle) * d
        const col = Math.floor(x / TILE_SIZE)
        const row = Math.floor(y / TILE_SIZE)
        if (col < 2 || col >= MAP_COLS - 2 || row < 2 || row >= MAP_ROWS - 2) continue
        if (this.isWallTile(x, y)) continue
        if (this.isInsideAnyObstacle(x, y, 24)) continue
        // ★ 视线检查（近距离时放宽 margin）
        if (!this.hasLineOfSight(fromX, fromY, x, y)) continue
        return { x: Math.round(x), y: Math.round(y) }
      }
    }
    // 终极 fallback：回到房间中心
    const room = ROOMS[Math.floor(Math.random() * ROOMS.length)]
    return {
      x: Math.round((room.x + room.w / 2) * TILE_SIZE),
      y: Math.round((room.y + room.h / 2) * TILE_SIZE),
    }
  }

  private removeTourist(t: Tourist): void {
    this.scene.tweens.killTweensOf(t.sprite)
    this.scene.tweens.killTweensOf(t.nameLabel)
    if (t.sprite.active) t.sprite.destroy()
    if (t.nameLabel.active) t.nameLabel.destroy()
    if (t.countdownText?.active) t.countdownText.destroy()
  }

  private despawnAll(): void {
    this.tourists.forEach(t => this.removeTourist(t))
    this.tourists = []
  }

  // ═════════════════════════════════════════════════════════════════════
  // 每帧更新
  // ═════════════════════════════════════════════════════════════════════

  update(delta: number, playerX: number, playerY: number, inputLocked: boolean): void {
    const dt = delta / 1000

    this.updateTourists(dt)

    if (this.debugVisible) this.renderDebug()

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
        if (this.eventTimer >= this.activeEvent.durationMs + 3000) {
          this.resolveEvent(false)
        }
      }
    }

    if (this.eventCooldown > 0) {
      this.eventCooldown -= delta
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 路线可视化 debug
  // ═════════════════════════════════════════════════════════════════════

  private renderDebug(): void {
    const gfx = this.debugGfx!
    gfx.clear()
    const colors = [0x00ff88, 0xff8844, 0x44aaff, 0xffdd44, 0xff66aa, 0x66ffcc, 0xcc88ff]
    const stateAlpha: Record<string, number> = { roaming: 0.9, traveling: 0.8, blocked: 0.5 }

    this.tourists.forEach((t, i) => {
      const color = colors[i % colors.length]
      const alpha = stateAlpha[t.state] ?? 0.7

      // 1) 绘制路点连线
      if (t.waypoints.length > 0) {
        gfx.lineStyle(2, color, alpha * 0.6)
        // 从当前位置开始
        let prevX = t.sprite.x
        let prevY = t.sprite.y
        for (let wi = t.wpIndex; wi < t.waypoints.length; wi++) {
          const wp = t.waypoints[wi]
          gfx.beginPath()
          gfx.moveTo(prevX, prevY)
          gfx.lineTo(wp.x, wp.y)
          gfx.strokePath()
          prevX = wp.x
          prevY = wp.y
        }
      }

      // 2) 路点圆圈 + 编号
      for (let wi = t.wpIndex; wi < t.waypoints.length; wi++) {
        const wp = t.waypoints[wi]
        const isTarget = wi === t.wpIndex
        const r = isTarget ? 6 : 3
        gfx.fillStyle(isTarget ? 0xffffff : color, alpha * (isTarget ? 1 : 0.5))
        gfx.fillCircle(wp.x, wp.y, r)
      }

      // 3) 游客头顶状态标签
      const labelX = t.sprite.x
      const labelY = t.sprite.y - 28
      const stateSymbol: Record<string, string> = { roaming: '🏠', traveling: '🚶', blocked: '⚠' }
      const text = `${stateSymbol[t.state] ?? '?'} #${i}`
      gfx.fillStyle(0x000000, 0.6)
      gfx.fillRoundedRect(labelX - 28, labelY - 8, 56, 16, 4)
      // 状态文字用游客名字标签的颜色
    })
  }

  /** 更新 debug 倒计时标签 */
  private updateCountdownLabel(t: Tourist, now: number): void {
    if (!this.debugVisible) return
    const label = t.countdownText
    label.setPosition(t.sprite.x, t.sprite.y - 38)

    if (t.state === 'roaming') {
      const remaining = Math.max(0, t.roamDuration - (now - t.zoneEnterTime))
      const sec = Math.ceil(remaining / 1000)
      if (sec > 0) {
        label.setText(`⏱ ${sec}s`)
        label.setColor('#ffdd44')
      } else {
        label.setText('→')
        label.setColor('#ff8844')
      }
    } else if (t.state === 'traveling') {
      const targetRoom = ROOMS.find(r => r.id === t.targetZoneId)
      label.setText(`→ ${targetRoom?.name ?? '??'}`)
      label.setColor('#44aaff')
    } else if (t.state === 'blocked') {
      label.setText('⚠')
      label.setColor('#ff4444')
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 状态机
  // ═════════════════════════════════════════════════════════════════════

  /** 统一的状态切换 — 重置所有相关 flag，保证一致性 */
  private transitionTo(t: Tourist, newState: TouristState): void {
    if (t.state === newState) return

    if (newState === 'roaming') {
      // ★ 从 blocked 恢复时保留原始计时器 + 路点，继续朝原目标走
      const recovering = t.state === 'blocked'
      if (!recovering) {
        t.zoneEnterTime = this.scene.time.now
        t.roamDuration = 8000 + Math.random() * 12000
        t.waypoints = []
        t.wpIndex = 0
      }
      t.arrived = false
      t.pauseUntil = 0
      t.stuckTimer = 0
      t.targetZoneId = null
    }

    if (newState === 'traveling') {
      t.waypoints = []
      t.wpIndex = 0
      t.arrived = false
      t.pauseUntil = 0
      t.stuckTimer = 0
    }

    if (newState === 'blocked') {
      t.prevState = t.state
      t.arrived = false
      t.pauseUntil = 0
      t.stuckTimer = 0
    }

    t.state = newState
  }

  // ═════════════════════════════════════════════════════════════════════
  // 每帧更新：通用检测 + 按状态分发
  // ═════════════════════════════════════════════════════════════════════

  private updateTourists(dt: number): void {
    const now = this.scene.time.now
    const mainHallLoad = this.countTouristsInRoom('main-hall')

    this.tourists.forEach((t) => {
      // ★ 活跃事件游客冻结在原地
      if (t === this.activeEventTourist && !this.eventResolved) {
        t.sprite.setDepth(Math.floor(t.sprite.y / 28))
        t.nameLabel.setDepth(Math.floor(t.sprite.y / 28) + 0.5)
        return
      }

      // 动态深度
      t.sprite.setDepth(Math.floor(t.sprite.y / 28))
      t.nameLabel.setDepth(Math.floor(t.sprite.y / 28) + 0.5)

      // ── 通用检测（所有状态） ──

      // 房间变更检测
      const detectedRoom = this.findRoomIdAt(t.sprite.x, t.sprite.y)
      if (detectedRoom !== t.currentRoomId) {
        t.currentRoomId = detectedRoom
        // traveling 中到达目标区域 → 切回 roaming
        if (t.state === 'traveling' && detectedRoom === t.targetZoneId) {
          this.transitionTo(t, 'roaming')
        }
      }

      // main-hall 拥挤检测（仅 roaming 触发，强制离开）
      if (detectedRoom === 'main-hall' && mainHallLoad > 2 && t.state === 'roaming') {
        const zones = ROOMS.filter(r => r.id !== 'main-hall')
        t.targetZoneId = zones[Math.floor(Math.random() * zones.length)].id
        this.transitionTo(t, 'traveling')
        return
      }

      // 脱困检测
      if (this.isInsideAnyObstacle(t.sprite.x, t.sprite.y, 0)) {
        this.unstuckFromObstacles(t)
        if (this.isInsideAnyObstacle(t.sprite.x, t.sprite.y, 0)) {
          // 推出失败，进入 blocked 状态等待下一帧重试
          this.transitionTo(t, 'blocked')
          return
        }
      }

      // 卡死检测
      const movedThisFrame = Math.abs(t.sprite.x - t.lastStuckX) + Math.abs(t.sprite.y - t.lastStuckY)
      if (movedThisFrame < 2 && !t.arrived) {
        t.stuckTimer += dt
      } else {
        t.stuckTimer = 0
      }
      t.lastStuckX = t.sprite.x
      t.lastStuckY = t.sprite.y

      if (t.stuckTimer > 1.5) {
        t.stuckTimer = 0
        this.transitionTo(t, 'blocked')
        return
      }

      // ── 状态分发 ──
      switch (t.state) {
        case 'roaming':   this.updateRoaming(t, dt, now);   break
        case 'traveling': this.updateTraveling(t, dt, now);  break
        case 'blocked':   this.updateBlocked(t, dt);         break
      }

      // ★ debug 倒计时更新
      this.updateCountdownLabel(t, now)
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // roamING：区域内自由漫游
  // ═════════════════════════════════════════════════════════════════════

  private updateRoaming(t: Tourist, dt: number, now: number): void {
    // 在区域内待够了 → 切换 traveling，随机选一个其他区域作为目标
    if (now - t.zoneEnterTime > t.roamDuration) {
      const zones = ROOMS.filter(r => r.id !== t.currentRoomId)
      if (zones.length > 0) {
        t.targetZoneId = zones[Math.floor(Math.random() * zones.length)].id
        this.transitionTo(t, 'traveling')
        return
      }
    }

    if (t.pauseUntil > now) return

    // 没有路点 → 在当前区域内随机选
    if (t.waypoints.length === 0 || t.wpIndex >= t.waypoints.length) {
      t.arrived = true
      t.pauseUntil = now + 500 + Math.random() * 1500
      t.waypoints = [this.pickRoamingWaypoint(t.sprite.x, t.sprite.y, t.currentRoomId)]
      t.wpIndex = 0
    }

    const wp = t.waypoints[t.wpIndex]
    const dx = wp.x - t.sprite.x
    const dy = wp.y - t.sprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 12) {
      t.arrived = true
      t.pauseUntil = now + 500 + Math.random() * 1500
      t.waypoints = []
      t.wpIndex = 0
    } else {
      t.arrived = false
      this.steerToward(t, dx, dy, dist, dt)
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // traVELING：沿 BFS 路径前往目标区域
  // ═════════════════════════════════════════════════════════════════════

  private updateTraveling(t: Tourist, dt: number, now: number): void {
    if (t.pauseUntil > now) return

    // 没有路点 → 规划 BFS 路径到目标区域
    if (t.waypoints.length === 0 || t.wpIndex >= t.waypoints.length) {
      const dest = this.pickPointInRoom(t.targetZoneId!)
      if (!dest) {
        this.transitionTo(t, 'roaming')
        return
      }
      const route = this.findPathWaypoints(t.sprite.x, t.sprite.y, dest.x, dest.y)
      if (route.length === 0) {
        this.transitionTo(t, 'roaming')
        return
      }
      t.waypoints = route
      t.wpIndex = 0
      t.arrived = false
      return
    }

    const wp = t.waypoints[t.wpIndex]
    const dx = wp.x - t.sprite.x
    const dy = wp.y - t.sprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 12) {
      if (t.wpIndex < t.waypoints.length - 1) {
        t.wpIndex++
      } else {
        // 到达最后一个路点 → 检查是否已进入目标区域
        const arrivedRoom = this.findRoomIdAt(t.sprite.x, t.sprite.y)
        if (arrivedRoom === t.targetZoneId) {
          t.currentRoomId = arrivedRoom
          this.transitionTo(t, 'roaming')
        } else {
          // 还没到目标区域 → 重新规划剩余路径
          t.waypoints = []
          t.wpIndex = 0
        }
      }
    } else {
      t.arrived = false
      this.steerToward(t, dx, dy, dist, dt)
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // blocked：卡在障碍物里，每帧尝试脱困
  // ═════════════════════════════════════════════════════════════════════

  private updateBlocked(t: Tourist, _dt: number): void {
    if (this.isInsideAnyObstacle(t.sprite.x, t.sprite.y, 0)) {
      this.unstuckFromObstacles(t)
      return
    }
    // 脱困成功 → 恢复之前的状态
    this.transitionTo(t, t.prevState)
  }

  /** 在指定区域内选一个可行走的漫游路点（严格限制在室内） */
  private pickRoamingWaypoint(nearX: number, nearY: number, roomId: string | null): { x: number; y: number } {
    const room = roomId ? ROOMS.find(r => r.id === roomId) : null
    const roomCX = room ? (room.x + room.w / 2) * TILE_SIZE : nearX
    const roomCY = room ? (room.y + room.h / 2) * TILE_SIZE : nearY

    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * 300
      const x = nearX + Math.cos(angle) * dist
      const y = nearY + Math.sin(angle) * dist

      if (this.findRoomIdAt(x, y) !== roomId) continue
      if (this.isWallTile(x, y)) continue
      if (this.isInsideAnyObstacle(x, y, 28)) continue
      if (!this.hasLineOfSight(nearX, nearY, x, y)) continue
      return { x: Math.round(x), y: Math.round(y) }
    }

    // fallback: 房间中心附近的安全点
    return { x: Math.round(roomCX), y: Math.round(roomCY) }
  }

  /** 脱困：如果游客在障碍物内，沿最近的方向推出（处理所有可能重叠的障碍物）
  private unstuckFromObstacles(t: Tourist): void {
    const touristR = 8
    // 循环处理，直到游客不再与任何障碍物碰撞
    for (let iter = 0; iter < 8; iter++) {
      let pushed = false
      for (const obs of this.obstacles) {
        if (!this.collidesWithObstacle(t.sprite.x, t.sprite.y, touristR, obs)) continue

        const leftDist = (t.sprite.x + touristR) - (obs.x - obs.hw)
        const rightDist = (obs.x + obs.hw) - (t.sprite.x - touristR)
        const topDist = (t.sprite.y + touristR) - (obs.y - obs.hh)
        const bottomDist = (obs.y + obs.hh) - (t.sprite.y - touristR)

        const minDist = Math.min(leftDist, rightDist, topDist, bottomDist)
        const oldX = t.sprite.x, oldY = t.sprite.y
        if (minDist === leftDist) t.sprite.x = obs.x - obs.hw - touristR - 2
        else if (minDist === rightDist) t.sprite.x = obs.x + obs.hw + touristR + 2
        else if (minDist === topDist) t.sprite.y = obs.y - obs.hh - touristR - 2
        else t.sprite.y = obs.y + obs.hh + touristR + 2

        // ★ 推出后如果撞墙 → 回滚（宁可卡在障碍物边缘也不要穿墙）
        if (this.isWallTile(t.sprite.x, t.sprite.y) ||
            this.isWallTile(t.sprite.x + touristR, t.sprite.y) ||
            this.isWallTile(t.sprite.x - touristR, t.sprite.y) ||
            this.isWallTile(t.sprite.x, t.sprite.y + touristR) ||
            this.isWallTile(t.sprite.x, t.sprite.y - touristR)) {
          t.sprite.x = oldX
          t.sprite.y = oldY
          // 不再尝试这个方向，跳出循环
          break
        }

        pushed = true
      }
      if (!pushed) break
    }
    t.nameLabel.setPosition(t.sprite.x, t.sprite.y - 16)
  }

  /** steering: 路点引力 + 墙壁排斥 + 障碍物排斥 + 游客间排斥 + 垂直滑动 */
  private steerToward(t: Tourist, dx: number, dy: number, dist: number, dt: number): void {
    const toWpX = dx / dist
    const toWpY = dy / dist
    const tpx = t.sprite.x, tpy = t.sprite.y
    const touristR = 8
    const routeMode = t.waypoints.length > 1

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

      const repelRange = obs.hw + obs.hh + 28
      if (d2 < repelRange) {
        if (d2 < 1) {
          const toCenter = Math.sqrt((tpx - obs.x) ** 2 + (tpy - obs.y) ** 2)
          if (toCenter > 0.1) {
            repelX += (tpx - obs.x) / toCenter * 8
            repelY += (tpy - obs.y) / toCenter * 8
          }
        } else {
          const strength = (repelRange - d2) / repelRange
          repelX += (ddx / d2) * strength * 7
          repelY += (ddy / d2) * strength * 7
        }
      }
    }

    // ★ 游客间排斥力 — 防止拥挤，但不造成通道死锁
    let closestTouristDist = Infinity
    for (const other of this.tourists) {
      if (other === t) continue
      const odx = tpx - other.sprite.x
      const ody = tpy - other.sprite.y
      const od = Math.sqrt(odx * odx + ody * ody)
      if (od < closestTouristDist) closestTouristDist = od
      if (od < 1) continue

      // 自适应排斥半径：同向放宽，对向收紧
      let avoidRange = 28
      const otherToWp = other.waypoints.length > 0 && other.wpIndex < other.waypoints.length
        ? other.waypoints[other.wpIndex] : null
      if (otherToWp) {
        const otherDx = otherToWp.x - other.sprite.x
        const otherDy = otherToWp.y - other.sprite.y
        const otherMag = Math.sqrt(otherDx * otherDx + otherDy * otherDy)
        if (otherMag > 1) {
          const dot = (dx * otherDx + dy * otherDy) / (dist * otherMag)
          if (dot > 0.3) avoidRange = 16
          else if (dot < -0.3) avoidRange = 32
        }
      }

      if (od < avoidRange) {
        const strength = (avoidRange - od) / avoidRange
        const bias = t.laneOffset > 0 ? -0.3 : 0.3
        const nx = odx / od + bias * 0.4
        const ny = ody / od + bias * 0.4
        const nm = Math.sqrt(nx * nx + ny * ny)
        repelX += (nm > 0.001 ? nx / nm : nx) * strength * 3
        repelY += (nm > 0.001 ? ny / nm : ny) * strength * 3
      }
    }

    // ── 卡死状态：由 updateTourists 维护 stuckTimer，此处只读取 ──
    const isStuck = t.stuckTimer > 0.8

    // ── 动态混合权重：越靠近障碍物/其他游客，排斥力占比越大 ──
    const obsInfluence = closestObsDist < 100 ? Math.max(0, 1 - closestObsDist / 100) : 0
    const touristInfluence = isStuck || routeMode
      ? 0
      : closestTouristDist < 32 ? Math.max(0, 1 - closestTouristDist / 32) : 0
    const baseRepelWeight = routeMode ? 0.05 : 0.15
    const repelWeight = baseRepelWeight + Math.max(obsInfluence, touristInfluence) * (routeMode ? 0.25 : 0.50)
    const wpWeight = 1 - repelWeight

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

    // ── 墙壁碰撞（分轴独立检测 + 半径多点采样）──
    // 游客半径 touristR，检测覆盖碰撞圆的 5 个点：中心 + 4 方向边缘
    const hitsWall = (cx: number, cy: number): boolean => {
      if (this.isWallTile(cx, cy)) return true
      if (this.isWallTile(cx + touristR, cy)) return true
      if (this.isWallTile(cx - touristR, cy)) return true
      if (this.isWallTile(cx, cy + touristR)) return true
      if (this.isWallTile(cx, cy - touristR)) return true
      return false
    }

    let canMoveX = !hitsWall(nextX, tpy)
    let canMoveY = !hitsWall(tpx, nextY)

    // ── 障碍物碰撞 ──
    const blockedByObstacle = (testX: number, testY: number): boolean => {
      for (const obs of this.obstacles) {
        if (this.collidesWithObstacle(testX, testY, touristR, obs)) return true
      }
      return false
    }

    if (canMoveX && blockedByObstacle(nextX, tpy)) canMoveX = false
    if (canMoveY && blockedByObstacle(tpx, nextY)) canMoveY = false

    if (!canMoveX && !canMoveY) {
      // 尝试更多滑动方向：垂直 → 45° → 纯轴向
      const slides = [
        [dirY, -dirX],
        [-dirY, dirX],
        [dirX * 0.7 + dirY * 0.7, dirY * 0.7 - dirX * 0.7],
        [dirX * 0.7 - dirY * 0.7, dirY * 0.7 + dirX * 0.7],
        [1, 0], [-1, 0], [0, 1], [0, -1],
      ]
      let found = false
      for (const [sdX, sdY] of slides) {
        const sm = Math.sqrt(sdX * sdX + sdY * sdY)
        if (sm < 0.001) continue
        const sNX = tpx + (sdX / sm) * t.speed * dt
        const sNY = tpy + (sdY / sm) * t.speed * dt
        // 优先尝试双轴同时移动
        if (!blockedByObstacle(sNX, tpy) && !hitsWall(sNX, tpy) &&
            !blockedByObstacle(tpx, sNY) && !hitsWall(tpx, sNY)) {
          nextX = sNX; nextY = sNY
          canMoveX = true; canMoveY = true
          found = true
          break
        }
        // 单轴滑动 — 至少能走一个方向
        if (!blockedByObstacle(sNX, tpy) && !hitsWall(sNX, tpy)) {
          nextX = sNX; canMoveX = true
          found = true
          break
        }
        if (!blockedByObstacle(tpx, sNY) && !hitsWall(tpx, sNY)) {
          nextY = sNY; canMoveY = true
          found = true
          break
        }
      }
      if (!found) {
        // 全部失败 → 后退
        const backX = tpx - toWpX * t.speed * dt
        const backY = tpy - toWpY * t.speed * dt
        if (!blockedByObstacle(backX, backY) && !hitsWall(backX, backY)) {
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

  /** 游客到障碍物的最短距离 */
  private distToObstacle(px: number, py: number, obs: ObstacleData): number {
    const closestX = Math.max(obs.x - obs.hw, Math.min(px, obs.x + obs.hw))
    const closestY = Math.max(obs.y - obs.hh, Math.min(py, obs.y + obs.hh))
    const dx = px - closestX
    const dy = py - closestY
    return Math.sqrt(dx * dx + dy * dy)
  }

  /** 检测一个点是否在障碍物内 */
  private isInsideAnyObstacle(x: number, y: number, margin = 8): boolean {
    for (const obs of this.obstacles) {
      if (x > obs.x - obs.hw - margin && x < obs.x + obs.hw + margin &&
          y > obs.y - obs.hh - margin && y < obs.y + obs.hh + margin) {
        return true
      }
    }
    return false
  }

  /** 检查某点是否在墙体瓦片上 */
  private isWallTile(x: number, y: number): boolean {
    const col = Math.floor(x / TILE_SIZE)
    const row = Math.floor(y / TILE_SIZE)
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
    return this.mapData[row * MAP_COLS + col] === 2
  }

  /** ★ 返回某像素坐标所在的房间 id（不在任何房间内返回 null） */
  private findRoomIdAt(x: number, y: number): string | null {
    const col = x / TILE_SIZE
    const row = y / TILE_SIZE
    for (const r of ROOMS) {
      if (col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h) {
        return r.id
      }
    }
    return null
  }

  /** ★ 在指定房间内找一个可走行的安全点（用于跨房间目标） */
  private pickPointInRoom(roomId: string): { x: number; y: number } | null {
    const room = ROOMS.find(r => r.id === roomId)
    if (!room) return null
    const roomCX = (room.x + room.w / 2) * TILE_SIZE
    const roomCY = (room.y + room.h / 2) * TILE_SIZE
    const rangeX = (room.w - 2) * TILE_SIZE / 2
    const rangeY = (room.h - 2) * TILE_SIZE / 2

    for (let attempt = 0; attempt < 20; attempt++) {
      const x = roomCX + (Math.random() - 0.5) * rangeX * 2
      const y = roomCY + (Math.random() - 0.5) * rangeY * 2
      if (!this.isWallTile(x, y) && !this.isInsideAnyObstacle(x, y, 28)) {
        return { x: Math.round(x), y: Math.round(y) }
      }
    }
    return null
  }

  /** ★ 视线检查：从 (x1,y1) 到 (x2,y2) 之间是否有墙壁/障碍物阻挡 */
  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return true
    const stepSize = 14
    const steps = Math.ceil(dist / stepSize)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = x1 + dx * t
      const y = y1 + dy * t
      if (this.isWallTile(x, y)) return false
      if (this.isInsideAnyObstacle(x, y, 10)) return false
    }
    return true
  }

  // ═════════════════════════════════════════════════════════════════════
  // P1: 随机事件
  // ═════════════════════════════════════════════════════════════════════

  private tryTriggerEvent(playerX: number, playerY: number): void {
    if (Math.random() > 0.15) return
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

  getRoomDistribution(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const room of ROOMS) result[room.id] = 0
    result.corridor = 0
    for (const t of this.tourists) {
      const roomId = this.findRoomIdAt(t.sprite.x, t.sprite.y)
      result[roomId ?? 'corridor'] = (result[roomId ?? 'corridor'] ?? 0) + 1
    }
    return result
  }

  getAllPositions(): { x: number; y: number; r: number }[] {
    return this.tourists.map(t => ({ x: t.sprite.x, y: t.sprite.y, r: 7 }))
  }

  resolveEvent(success: boolean, choiceDeltas?: Partial<Record<string, number>>, choiceId?: string): void {
    if (!this.activeEvent || this.eventResolved) return
    this.eventResolved = true
    this.eventCooldown = 10000
    if (this.activeEventTourist) {
      this.activeEventTourist.nameLabel.setText('🧑 游客')
      this.activeEventTourist.nameLabel.setColor('#aac4cf')
      this.scene.tweens.killTweensOf(this.activeEventTourist.nameLabel)
      this.activeEventTourist.nameLabel.setAlpha(1)
    }
    this.onEventResolve?.(this.activeEvent, success, choiceDeltas, choiceId)
    this.scene.time.delayedCall(500, () => {
      this.activeEvent = null
      this.activeEventTourist = null
      this.eventResolved = false
    })
  }

  destroy(): void {
    this.despawnAll()
  }
}
