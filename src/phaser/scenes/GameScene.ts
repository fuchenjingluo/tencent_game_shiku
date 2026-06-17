// ────────────────────────────────────────────────────────────────────────────
// CaveScene — 唯一游戏场景（对齐参考文件）
// 地图渲染、角色移动、Arcade物理碰撞、摄像机跟随、灯光系统、
// 粒子特效、小地图、NPC/交互点管理
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'
import { bus } from '../../events/bus'
import {
  buildMapData, MAP_COLS, MAP_ROWS, TILE_SIZE,
  ROOMS, CORRIDORS, INTERACT_POINTS, PLAYER_SPAWN,
  getRoomCenter, getInteractPosition, getRoomDarkness,
} from '../mapData'
import { TASKS, NPC_CONFIGS, POINT_TASK_MAP, SIDE_QUESTS, type SideQuest } from '../../data/gameData'
import { getRiskLevel, rollRiskEvent, applyRiskDeltas } from '../../data/riskSystem'
import type { GameStats, ActiveTask, GameFlags, RiskEvent, InteractPointConfig, Objective } from '../../types'
import { playStep, playAmbientDrip, playRiskAlert } from '../../audio/audioManager'
import { TouristManager, ObstacleData } from '../TouristNPC'

const INTERACT_RADIUS = 40
const VIEW_W = 960
const VIEW_H = 608
const PLAYER_SPEED = 96
const STEP_INTERVAL = 380

export class GameScene extends Phaser.Scene {
  // ── 玩家 ──
  private player!: Phaser.Physics.Arcade.Sprite
  // ── 输入 ──
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }
  private interactKey!: Phaser.Input.Keyboard.Key
  // ── 物理 ──
  private walls!: Phaser.Physics.Arcade.StaticGroup
  // ── 实体 ──
  private npcs: Map<string, Phaser.GameObjects.Sprite> = new Map()
  private npcLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private points: Map<string, Phaser.GameObjects.Sprite> = new Map()
  // ── 视觉 ──
  private lightLayer!: Phaser.GameObjects.Graphics
  private arrowGfx!: Phaser.GameObjects.Graphics  // 方向箭头
  private interactHint!: Phaser.GameObjects.Text
  private roomLabels: Phaser.GameObjects.Text[] = []
  private corridorHint: Phaser.GameObjects.Text | null = null  // 走廊中前方房间名称提示
  // ── 状态 ──
  private inputLocked = false
  private nearNpc: string | null = null
  private nearPoint: string | null = null
  private stepTimer = 0
  private particleTimer = 0
  private stats: GameStats = { reputation: 40, risk: 55, evidence: 10, budget: 8 }
  private completedTasks: Set<string> = new Set()
  private gameFlags: GameFlags = {}
  private challengeMode: string | null = null // 速通/铁人/每日/混沌
  private speedrunTimerText: Phaser.GameObjects.Text | null = null
  private speedrunStartTime = 0
  activeTask: ActiveTask | null = null
  private lightFlicker = 0
  // ── 动画 ──
  private bounceTween: Phaser.Tweens.Tween | null = null
  private bobOffset = 0
  // ── 寻路引导
  private currentObjective: Objective | null = null
  private arrowPulse = 0
  private objectiveMarker!: Phaser.GameObjects.Text    // 目标点上方的浮动标记
  private objectiveRing!: Phaser.GameObjects.Arc        // 目标点底部的光环
  // ── 风险预警
  private riskOverlay!: Phaser.GameObjects.Graphics     // 屏幕边缘红色脉冲
  private riskPulseTimer = 0
  // ── 环境粒子
  private ambianceTimer = 0
  private ambianceParticles: Phaser.GameObjects.Arc[] = []
  // ── 风格追踪（P2#10）
  private lastChoiceStyle: string | null = null
  private styleStreak = 0
  // ── 游客系统 ──
  private touristManager!: TouristManager
  private obstacleDataList: ObstacleData[] = []
  private debugRoute = false  // 按 T 切换游客路线可视化
  // ── P2: 支线任务 ──
  private completedSideQuests: Set<string> = new Set()
  private activeSideQuest: string | null = null
  private touristNPCInteract: Phaser.GameObjects.Sprite | null = null
  private touristNPCLabel: Phaser.GameObjects.Text | null = null
  private busUnsubs: (() => void)[] = []  // ★ bus.on() 返回的取消订阅函数，shutdown 时清理

  constructor() {
    super({ key: 'GameScene' })
  }

  // ═════════════════════════════════════════════════════════════════════
  // 生命周期
  // ═════════════════════════════════════════════════════════════════════

  // 地图数据缓存 — 游客系统需要读tile
  mapData!: Uint8Array

  create() {
    const mapData = buildMapData()
    this.mapData = mapData
    this.buildTileMap(mapData)
    this.setupPlayer()
    this.setupNPCs()
    this.setupPoints()
    this.setupLight()
    this.setupInput()
    this.setupCamera()
    this.setupRoomLabels()
    this.setupBusListeners()
    this.setupTouristSystem()
    // 在所有障碍物放置完毕后，将障碍物位置传给游客系统避让
    this.touristManager.setObstacles(this.obstacleDataList)
    // ★ 障碍物就绪后才创建游客（避免生成在障碍物内部）
    this.touristManager.updateDensity(this.gameFlags)
    this.startPlayerBounce()

    // 方向箭头图层（屏幕空间，不跟随摄像机）
    this.arrowGfx = this.add.graphics()
    this.arrowGfx.setDepth(80)
    this.arrowGfx.setScrollFactor(0)

    // 风险预警叠加层（屏幕空间）
    this.riskOverlay = this.add.graphics()
    this.riskOverlay.setDepth(81)
    this.riskOverlay.setScrollFactor(0)

    // 清理回调
    this.events.once('shutdown', () => {
      this.bounceTween?.destroy()
      // ★ 清理所有事件总线监听器 — 防止 stale handler 访问已销毁的 scene
      this.busUnsubs.forEach(fn => fn())
      this.busUnsubs = []
    })

    bus.emit('game:ready')

    // 初始寻路目标计算 + 新手指引
    this.time.delayedCall(400, () => {
      this.updateObjective()

      // 首次进入：弹出入门指引
      if (this.completedTasks.size === 0 && !this.activeTask) {
        this.time.delayedCall(1200, () => {
          bus.emit('open:dialog', {
            lines: [
              { speaker: '📋 巡检简报', text: '欢迎来到石窟数字文物保护中心。今日巡检任务共5项，请按顺序逐一完成。' },
              { speaker: '📋 巡检简报', text: `当前目标：前往${this.currentObjective?.roomName ?? '壁画保护区'}，与${this.currentObjective?.name ?? '张主任'}汇合。` },
              { speaker: '💡 提示', text: '屏幕边缘的金色箭头会指引方向。小地图上的脉冲标记就是你的目的地。' },
            ],
          })
        })
      }
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // 地图构建（autotile墙体+阴影+装饰）
  // ═════════════════════════════════════════════════════════════════════

  private buildTileMap(mapData: Uint8Array) {
    this.walls = this.physics.add.staticGroup()

    // 预计算走廊地板标记：用于区分房间与走廊的地板tile
    const isCorridorFloor = this.buildCorridorMask(mapData)

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = mapData[row * MAP_COLS + col]
        const x = col * TILE_SIZE + TILE_SIZE / 2
        const y = row * TILE_SIZE + TILE_SIZE / 2

        if (tile === 1) {
          if (isCorridorFloor[row * MAP_COLS + col]) {
            // 走廊专用地板变体（更暗更磨损）
            const v = ((col * 3 + row * 7) % 3)
            this.add.image(x, y, `corridor_floor_${v}`)
          } else {
            // 房间地板
            const v = ((col * 3 + row * 7) % 6)
            this.add.image(x, y, `floor_${v}`)
          }
        } else if (tile === 2) {
          // autotile 墙体
          this.placeAutoTile(col, row, mapData, x, y)
        }
      }
    }

    // ★ 拱门入口标记：房间-走廊边界放置
    this.placeArchways(mapData)

    // 装饰层（随机散布在房间地板上）
    this.placeDecorations(mapData)
  }

  /** 构建"该地板tile在走廊中且不在任何房间内"的标记数组 */
  private buildCorridorMask(mapData: Uint8Array): boolean[] {
    const mask = new Array<boolean>(MAP_COLS * MAP_ROWS).fill(false)
    // 走廊区域标记
    for (const c of CORRIDORS) {
      for (let row = c.y; row < c.y + c.h && row < MAP_ROWS; row++) {
        for (let col = c.x; col < c.x + c.w && col < MAP_COLS; col++) {
          mask[row * MAP_COLS + col] = true
        }
      }
    }
    // ★ 排除房间内部（走廊可能与房间边界重叠）
    for (const r of ROOMS) {
      for (let row = r.y + 1; row < r.y + r.h - 1 && row < MAP_ROWS; row++) {
        for (let col = r.x + 1; col < r.x + r.w - 1 && col < MAP_COLS; col++) {
          mask[row * MAP_COLS + col] = false
        }
      }
    }
    return mask
  }

  /** 在房间-走廊边界放置拱门入口标记 */
  private placeArchways(mapData: Uint8Array) {
    for (const r of ROOMS) {
      const innerLX = r.x + 1
      const innerRX = r.x + r.w - 2
      const innerTY = r.y + 1
      const innerBY = r.y + r.h - 2

      // 四边扫描：房间内部地板tile如果紧邻走廊tile → 放置拱门
      for (let col = innerLX; col <= innerRX; col++) {
        this.tryPlaceArchway(col, innerTY, col, innerTY - 1, mapData, 'top')
        this.tryPlaceArchway(col, innerBY, col, innerBY + 1, mapData, 'bottom')
      }
      for (let row = innerTY; row <= innerBY; row++) {
        this.tryPlaceArchway(innerLX, row, innerLX - 1, row, mapData, 'left')
        this.tryPlaceArchway(innerRX, row, innerRX + 1, row, mapData, 'right')
      }
    }
  }

  private tryPlaceArchway(floorCol: number, floorRow: number, neighborCol: number, neighborRow: number, mapData: Uint8Array, dir: string) {
    if (neighborCol < 0 || neighborCol >= MAP_COLS || neighborRow < 0 || neighborRow >= MAP_ROWS) return
    // 仅在房间地板邻接走廊地板处放置
    if (mapData[floorRow * MAP_COLS + floorCol] !== 1) return
    if (mapData[neighborRow * MAP_COLS + neighborCol] !== 1) return
    // 确认邻居在走廊且不在房间内部
    if (this.getRoomAt(neighborCol, neighborRow)) return
    const x = floorCol * TILE_SIZE + TILE_SIZE / 2
    const y = floorRow * TILE_SIZE + TILE_SIZE / 2
    const arch = this.add.image(x, y, `archway_${dir}`)
    arch.setDepth(2).setAlpha(0.75)
  }

  private neighbor(mapData: Uint8Array, col: number, row: number, val: number): boolean {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false
    return mapData[row * MAP_COLS + col] === val
  }

  private placeAutoTile(col: number, row: number, mapData: Uint8Array, x: number, y: number) {
    // 只在墙体与地板邻接时才需要视觉墙体和物理碰撞
    const hasFloorNeighbor =
      this.neighbor(mapData, col - 1, row, 1) ||
      this.neighbor(mapData, col + 1, row, 1) ||
      this.neighbor(mapData, col, row - 1, 1) ||
      this.neighbor(mapData, col, row + 1, 1)

    if (!hasFloorNeighbor) {
      // 纯填充墙 — 玩家永远到不了这里，不渲染也不加碰撞（节省性能）
      return
    }

    // 判断哪个方向有地板，放置对应边缘类型
    const n = this.neighbor(mapData, col, row - 1, 1)
    const s = this.neighbor(mapData, col, row + 1, 1)
    const w = this.neighbor(mapData, col - 1, row, 1)
    const e = this.neighbor(mapData, col + 1, row, 1)

    if (n && !s && !w && !e) this.add.image(x, y, 'wall_bottom')
    else if (s && !n && !w && !e) this.add.image(x, y, 'wall_top')
    else if (w && !n && !s && !e) this.add.image(x, y, 'wall_right')
    else if (e && !n && !s && !w) this.add.image(x, y, 'wall_left')
    else if (n && w && !s && !e) this.add.image(x, y, 'corner_br')
    else if (n && e && !s && !w) this.add.image(x, y, 'corner_bl')
    else if (s && w && !n && !e) this.add.image(x, y, 'corner_tr')
    else if (s && e && !n && !w) this.add.image(x, y, 'corner_tl')
    else this.add.image(x, y, 'wall')

    // 物理碰撞体 — 只在与地板相邻的墙体上创建
    const body = this.walls.create(x, y, 'wall') as Phaser.Physics.Arcade.Sprite
    body.setVisible(false)
    body.refreshBody()
  }

  // ─── 房间装饰配置 ──────────────────────────────────────────────────────
  // 仅用于地板/墙壁纯视觉装饰（青苔、裂缝、水渍、符文等），不包括实体障碍物
  private static readonly ROOM_DECO_PROFILES: Record<string, {
    decos: string[]; density: number; wallDensity: number; wallDeco: string
  }> = {
    'mural-room':     { decos: ['decor_mural', 'decor_glyph'],             density: 0.10, wallDensity: 0.40, wallDeco: 'decor_mural' },
    'rear-cave':      { decos: ['decor_water', 'decor_moss'],              density: 0.08, wallDensity: 0.25, wallDeco: 'decor_crack' },
    'main-hall':      { decos: ['decor_glyph', 'decor_mural'],             density: 0.06, wallDensity: 0.40, wallDeco: 'decor_mural' },
    'equipment-room': { decos: ['decor_crack', 'decor_moss'],              density: 0.07, wallDensity: 0.10, wallDeco: 'decor_crack' },
    'power-room':     { decos: ['decor_crack', 'decor_rubble'],            density: 0.05, wallDensity: 0.08, wallDeco: 'decor_crack' },
    'archive-room':   { decos: ['decor_glyph', 'decor_moss'],              density: 0.08, wallDensity: 0.18, wallDeco: 'decor_stele' },
    'gate-room':      { decos: ['decor_rubble', 'decor_moss'],             density: 0.06, wallDensity: 0.15, wallDeco: 'decor_lantern' },
  }

  /** 查找某个 tile 坐标所属的房间（按地板区域判断） */
  private getRoomAt(col: number, row: number): string | null {
    for (const r of ROOMS) {
      if (col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h) return r.id
    }
    return null
  }

  /** 判断某个 tile 是否在走廊中（且不在任何房间内） */
  private isCorridorTile(col: number, row: number): boolean {
    for (const c of CORRIDORS) {
      if (col >= c.x && col < c.x + c.w && row >= c.y && row < c.y + c.h) {
        // 确保不在任何房间内（走廊可能与房间边界重叠）
        if (!this.getRoomAt(col, row)) return true
      }
    }
    return false
  }

  private placeDecorations(mapData: Uint8Array) {
    // 1. 实体障碍物（有碰撞体积，伪3D）
    this.placeRoomObstacles()
    // 2. 地板纯视觉装饰（青苔、裂缝等）
    this.placeFloorDeco(mapData)
  }

  /** 放置地板纯视觉装饰 — 仅青苔/裂缝/水渍/符文，无碰撞 */
  private placeFloorDeco(mapData: Uint8Array) {
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (mapData[row * MAP_COLS + col] !== 1) continue
        const roomId = this.getRoomAt(col, row)
        if (!roomId) continue
        const profile = GameScene.ROOM_DECO_PROFILES[roomId]
        if (!profile) continue

        const hash = (col * 7 + row * 13) % 100
        if (hash >= Math.floor(profile.density * 100)) continue

        const pickIdx = (col * 3 + row * 7) % profile.decos.length
        const decorKey = profile.decos[pickIdx]

        const x = col * TILE_SIZE + TILE_SIZE / 2
        const y = row * TILE_SIZE + TILE_SIZE / 2
        const decor = this.add.image(x, y, decorKey)
        decor.setDepth(3).setAlpha(0.35 + ((col * 3 + row) % 5) * 0.08)
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 伪3D实体障碍物放置（有碰撞，玩家不可穿过）
  // ═════════════════════════════════════════════════════════════════════

  /** 创建一个实体障碍物：visual image + invisible physics body in walls group */
  private spawnObstacle(x: number, y: number, key: string, scale = 1): void {
    // 视觉层：直接创建 image（无物理）
    const img = this.add.image(x, y, key)
    img.setScale(scale)
    img.setDepth(Math.floor(y / 28))

    // 碰撞体：在 walls 物理组创建不可见 sprite
    const body = this.walls.create(x, y, 'wall') as Phaser.Physics.Arcade.Sprite
    body.setVisible(false)
    body.setDisplaySize(img.width * scale, img.height * scale)
    body.refreshBody()

    // 记录障碍物位置供游客NPC避让
    this.obstacleDataList.push({
      x, y,
      hw: (img.width * scale) / 2,
      hh: (img.height * scale) / 2,
    })
  }

  private placeRoomObstacles() {
    // ── 中心窟室：大佛群像 + 供桌 + 石柱列 ──
    this.placeMainHallObstacles()

    // ── 壁画保护区：佛像 + 石碑 + 石柱 ──
    this.placeMuralRoomObstacles()

    // ── 后室暗窟：石笋阵 ──
    this.placeRearCaveObstacles()

    // ── 窟前栈道：大门 + 天王像 + 石柱 ──
    this.placeGateRoomObstacles()

    // ── 设备间 / 供电区：监测仪器 ──
    this.placeEquipmentRoomObstacles()
    this.placePowerRoomObstacles()

    // ── 数字档案室：供桌 + 石柱 + 监测仪 ──
    this.placeArchiveRoomObstacles()
  }

  private placeMainHallObstacles() {
    const r = ROOMS.find((r) => r.id === 'main-hall')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 中央大佛（靠后墙）
    this.spawnObstacle(cx, cy - 32, 'obj_buddha', 1.1)

    // 两侧胁侍天王像
    this.spawnObstacle(cx - 40, cy - 20, 'obj_guardian', 0.85)
    this.spawnObstacle(cx + 40, cy - 20, 'obj_guardian', 0.85)

    // 前方供桌
    this.spawnObstacle(cx, cy + 8, 'obj_altar', 0.9)

    // 两侧石柱列（形成"朝圣通道"）
    const pillarOffsets = [
      [-50, -38], [50, -38],
      [-50, -14], [50, -14],
      [-50, 28],  [50, 28],
    ]
    pillarOffsets.forEach(([ox, oy]) => {
      this.spawnObstacle(cx + ox, cy + oy, 'obj_pillar', 0.8)
    })
  }

  private placeMuralRoomObstacles() {
    const r = ROOMS.find((r) => r.id === 'mural-room')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 后墙佛像
    this.spawnObstacle(cx, cy - 36, 'obj_buddha', 0.9)

    // 中央石碑
    this.spawnObstacle(cx - 20, cy + 4, 'obj_altar', 0.75)
    this.spawnObstacle(cx + 20, cy + 4, 'obj_altar', 0.75)

    // 角落石柱
    this.spawnObstacle(cx - 44, cy - 16, 'obj_pillar', 0.75)
    this.spawnObstacle(cx + 44, cy - 16, 'obj_pillar', 0.75)
  }

  private placeRearCaveObstacles() {
    const r = ROOMS.find((r) => r.id === 'rear-cave')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 石笋阵 — 均匀散布，形成迷宫感（左右上下平衡分布）
    const stalagOffsets: [number, number][] = [
      [-40, -36], [20, -44], [44, -20],   // 上排：左中右
      [-50, 4],   [0, 8],    [36, -8],     // 中排：左中右
      [-32, 32],  [24, 36],  [48, 20],     // 下排：左中右
    ]
    stalagOffsets.forEach(([ox, oy]) => {
      this.spawnObstacle(cx + ox, cy + oy, 'obj_stalagmite', 0.9)
    })
  }

  private placeGateRoomObstacles() {
    const r = ROOMS.find((r) => r.id === 'gate-room')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 大门（靠上方墙壁 — 模拟入口）
    this.spawnObstacle(cx, cy - 40, 'obj_gate', 0.9)

    // 两侧天王像守卫
    this.spawnObstacle(cx - 48, cy - 20, 'obj_guardian', 0.8)
    this.spawnObstacle(cx + 48, cy - 20, 'obj_guardian', 0.8)

    // 入口石柱
    this.spawnObstacle(cx - 32, cy - 20, 'obj_pillar', 0.75)
    this.spawnObstacle(cx + 32, cy - 20, 'obj_pillar', 0.75)

    // 栈道两侧石柱
    this.spawnObstacle(cx - 40, cy + 16, 'obj_pillar', 0.7)
    this.spawnObstacle(cx + 40, cy + 16, 'obj_pillar', 0.7)
  }

  private placeEquipmentRoomObstacles() {
    const r = ROOMS.find((r) => r.id === 'equipment-room')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 后墙：3台监测仪器（中央大、两侧小，视觉差异化）
    this.spawnObstacle(cx - 20, cy - 24, 'obj_monitor', 0.75)
    this.spawnObstacle(cx, cy - 26, 'obj_monitor', 1.0)
    this.spawnObstacle(cx + 20, cy - 24, 'obj_monitor', 0.75)

    // 侧面：工作台（用供桌模拟操作台）
    this.spawnObstacle(cx - 44, cy + 6, 'obj_altar', 0.7)
    this.spawnObstacle(cx + 44, cy + 6, 'obj_altar', 0.7)

    // 角落石柱
    this.spawnObstacle(cx - 56, cy - 20, 'obj_pillar', 0.6)
    this.spawnObstacle(cx + 56, cy - 20, 'obj_pillar', 0.6)
  }

  private placePowerRoomObstacles() {
    const r = ROOMS.find((r) => r.id === 'power-room')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 后墙：大型监测/配电仪器 ×3（模拟配电柜排列）
    this.spawnObstacle(cx - 28, cy - 28, 'obj_monitor', 1.0)
    this.spawnObstacle(cx, cy - 30, 'obj_monitor', 1.0)
    this.spawnObstacle(cx + 28, cy - 28, 'obj_monitor', 1.0)

    // 中部：2台副仪器（模拟变压器/配电箱）
    this.spawnObstacle(cx - 40, cy + 2, 'obj_monitor', 0.8)
    this.spawnObstacle(cx + 40, cy + 2, 'obj_monitor', 0.8)

    // 角落石柱（支撑结构）
    this.spawnObstacle(cx - 52, cy - 24, 'obj_pillar', 0.7)
    this.spawnObstacle(cx + 52, cy - 24, 'obj_pillar', 0.7)

    // 底部石柱
    this.spawnObstacle(cx, cy + 32, 'obj_pillar', 0.7)
  }

  private placeArchiveRoomObstacles() {
    const r = ROOMS.find((r) => r.id === 'archive-room')!
    const cx = (r.x + r.w / 2) * TILE_SIZE
    const cy = (r.y + r.h / 2) * TILE_SIZE

    // 中央数字终端/工作台（替代供桌 — 档案室应以科技设备为主）
    this.spawnObstacle(cx, cy - 4, 'obj_monitor', 1.0)

    // 侧方数据终端 ×2
    this.spawnObstacle(cx - 32, cy - 4, 'obj_monitor', 0.8)
    this.spawnObstacle(cx + 32, cy - 4, 'obj_monitor', 0.8)

    // 四角石柱（建筑结构支撑）
    const corners: [number, number][] = [[-48, -28], [48, -28], [-48, 28], [48, 28]]
    corners.forEach(([ox, oy]) => {
      this.spawnObstacle(cx + ox, cy + oy, 'obj_pillar', 0.7)
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // 玩家
  // ═════════════════════════════════════════════════════════════════════

  private setupPlayer() {
    this.player = this.physics.add.sprite(PLAYER_SPAWN.x, PLAYER_SPAWN.y, 'player')
    // depth 由 updateDepthSorting 动态管理（基于 y 坐标）
    this.player.setBodySize(14, 18)
    this.player.setOffset(9, 10)
    this.physics.add.collider(this.player, this.walls)
    this.physics.world.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
    this.player.setCollideWorldBounds(true)
  }

  private startPlayerBounce() {
    // 行走弹跳动画
    this.bounceTween = this.tweens.add({
      targets: this,
      bobOffset: 1,
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        // 由update中的缩放逻辑处理
      },
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // NPC 与交互点
  // ═════════════════════════════════════════════════════════════════════

  private setupNPCs() {
    // 每个任务一个 NPC，分散到不同房间
    const npcRoomMap: Record<string, string> = {
      task1_npc: 'mural-room',     // 张主任 @ 壁画区
      task2_npc: 'rear-cave',     // 李工   @ 后室暗窟
      task3_npc: 'gate-room',      // 王巡察 @ 窟前栈道
      task4_npc: 'power-room',     // 陈工   @ 供电区
      task5_npc: 'main-hall',     // 林院长 @ 中心窟室（汇报）
    }

    // 每个房间内的偏移量（避开障碍物）
    const offsets: Record<string, [number, number]> = {
      task1_npc: [-36, 24],      // 张主任 @ 壁画区 — 左下区（远离后墙佛像+石碑+石柱）
      task2_npc: [-28, 18],      // 李工   @ 后室暗窟 — 左下角（避开石笋阵）
      task3_npc: [0, 28],        // 王巡察 @ 窟前栈道 — 下部中央（远离大门+天王+石柱）
      task4_npc: [28, 28],       // 陈工   @ 供电区 — 右下角（远离配电柜+仪器）
      task5_npc: [0, 48],        // 林院长 @ 中心窟室 — 房间底部（远离大佛+供桌+石柱）
    }

    Object.entries(npcRoomMap).forEach(([key, roomId]) => {
      const center = getRoomCenter(roomId)
      const [ox, oy] = offsets[key] ?? [0, 0]
      const px = center.x + ox
      const py = center.y + oy

      const spr = this.add.sprite(px, py, key)
      spr.setDepth(Math.floor(py / 28))

      // NPC名字标签
      const cfg = NPC_CONFIGS[key]
      if (cfg) {
        const label = this.add.text(px, py - 22, cfg.name, {
          fontSize: '10px',
          color: '#f0d68a',
          fontFamily: 'monospace',
          stroke: '#0d0a05',
          strokeThickness: 2,
          backgroundColor: '#0d0a05bb',
          padding: { x: 5, y: 2 },
        }).setOrigin(0.5).setDepth(Math.floor(py / 28) + 0.5)
        this.npcLabels.set(key, label)
      }

      this.npcs.set(key, spr)
    })
  }

  private setupPoints() {
    // 交互点（7个任务点 + 3个隐藏点）
    INTERACT_POINTS.forEach((pt) => {
      const pos = getInteractPosition(pt.id)
      const isHidden = pt.type === 'hidden'
      const spr = this.add.sprite(pos.x, pos.y, isHidden ? 'particle' : 'interact_point')
      spr.setDepth(Math.floor(pos.y / 28))
      spr.setData('type', pt.type)
      spr.setData('name', pt.name)
      // 隐藏点用闪烁效果替代浮动
      if (isHidden) {
        spr.setAlpha(0.5)
        spr.setTint(0x7ab8d9)
        this.tweens.add({
          targets: spr,
          alpha: 0.8,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else {
        // 浮动动画
        this.tweens.add({
          targets: spr,
          y: pos.y - 3,
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
      this.points.set(pt.id, spr)
    })

    // ── 目标点浮动标记 ──
    this.objectiveMarker = this.add.text(0, 0, '', {
      fontSize: '13px',
      color: '#f0d68a',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#0d0a05dd',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(15).setVisible(false)

    this.objectiveRing = this.add.arc(0, 0, 18, 0, 360, false, 0xd7bd73, 0)
    this.objectiveRing.setStrokeStyle(1.5, 0xd7bd73, 0).setDepth(7).setVisible(false)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 灯光
  // ═════════════════════════════════════════════════════════════════════

  private setupLight() {
    this.lightLayer = this.add.graphics()
    this.lightLayer.setDepth(50)
    this.lightLayer.setBlendMode(Phaser.BlendModes.MULTIPLY)
  }

  private updateLight() {
    this.lightLayer.clear()
    const roomDarkness = getRoomDarkness(this.player.x, this.player.y)
    const flicker = 1 + Math.sin(this.lightFlicker * 3) * 0.03 * roomDarkness

    // 暗色遮罩（暗度越高的房间遮罩越浓）
    const baseAlpha = 0.30 + roomDarkness * 0.25
    this.lightLayer.fillStyle(0x060504, baseAlpha * flicker)
    this.lightLayer.fillRect(
      this.cameras.main.scrollX - 4,
      this.cameras.main.scrollY - 4,
      VIEW_W + 8,
      VIEW_H + 8,
    )

    // 玩家周围光照（暗度越高光圈越小）
    const lightRadius = 140 - roomDarkness * 30
    this.lightLayer.fillStyle(0xffffff, 1.0)
    this.lightLayer.fillCircle(this.player.x, this.player.y, lightRadius)

    this.lightFlicker += 0.016
  }

  // ═════════════════════════════════════════════════════════════════════
  // 摄像机
  // ═════════════════════════════════════════════════════════════════════

  private setupCamera() {
    const cam = this.cameras.main
    cam.setViewport(0, 0, VIEW_W, VIEW_H)
    cam.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE)
    cam.startFollow(this.player, true, 0.09, 0.09)

    // 根据所在房间调整 zoom（小房间放大）
    // 初始状态不放大，在update中动态调整
    cam.setZoom(1)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 输入
  // ═════════════════════════════════════════════════════════════════════

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    // debug: 按 T 切换游客路线可视化
    const debugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T)
    debugKey.on('down', () => {
      this.debugRoute = !this.debugRoute
      this.touristManager?.setDebug(this.debugRoute)
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // 小地图
  // ═════════════════════════════════════════════════════════════════════

  private drawMiniMap() {
    // 每次动态查询 DOM — 避免 React 重新挂载 canvas 后引用失效
    const canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const scale = 1.4
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0e0c09'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制房间
    ctx.fillStyle = '#2a2318'
    ROOMS.forEach((r) => {
      ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    })
    // 绘制走廊（略浅）
    ctx.fillStyle = '#252015'
    CORRIDORS.forEach((c) => {
      ctx.fillRect(c.x * scale, c.y * scale, c.w * scale, c.h * scale)
    })

    // 玩家位置
    const mx = (this.player.x / TILE_SIZE) * scale
    const my = (this.player.y / TILE_SIZE) * scale
    ctx.fillStyle = '#d7bd73'
    ctx.fillRect(mx - 2, my - 2, 4, 4)

    // ── 目标高亮脉冲 ──
    if (this.currentObjective) {
      let objX = 0, objY = 0
      if (this.currentObjective.type === 'npc') {
        const spr = this.npcs.get(this.currentObjective.targetId)
        if (spr) { objX = spr.x; objY = spr.y }
      } else {
        const pos = getInteractPosition(this.currentObjective.targetId)
        objX = pos.x; objY = pos.y
      }
      if (objX > 0 || objY > 0) {
        const ox = (objX / TILE_SIZE) * scale
        const oy = (objY / TILE_SIZE) * scale
        const pulse = Math.sin(this.arrowPulse * 1.2) * 0.4 + 0.6
        // 外层脉冲光环（更大更亮）
        ctx.strokeStyle = `rgba(215,189,115,${pulse * 0.9})`
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.arc(ox, oy, 7, 0, Math.PI * 2)
        ctx.stroke()
        // 内层实心标记
        ctx.fillStyle = `rgba(215,189,115,${pulse})`
        ctx.beginPath()
        ctx.arc(ox, oy, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 交互点
    ctx.fillStyle = '#8fae78'
    INTERACT_POINTS.forEach((pt) => {
      if (this.isPointVisible(pt.id)) {
        const pos = getInteractPosition(pt.id)
        ctx.fillRect((pos.x / TILE_SIZE) * scale - 1, (pos.y / TILE_SIZE) * scale - 1, 3, 3)
      }
    })

    // NPC
    ctx.fillStyle = '#d98f72'
    this.npcs.forEach((spr) => {
      ctx.fillRect((spr.x / TILE_SIZE) * scale - 1, (spr.y / TILE_SIZE) * scale - 1, 3, 3)
    })

    // ★ 障碍物（浅灰色小点，帮助玩家了解房间内行走空间）
    ctx.fillStyle = 'rgba(90,80,65,0.4)'
    this.obstacleDataList.forEach((ob) => {
      ctx.fillRect((ob.x / TILE_SIZE) * scale - 1, (ob.y / TILE_SIZE) * scale - 1, 2, 2)
    })

    // 边框
    ctx.strokeStyle = '#8b7355'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }

  private isPointVisible(pointKey: string): boolean {
    // P2: 支线任务目标点始终可见
    if (this.activeSideQuest === 'sq_lost_phone' && pointKey === 'rear-humidity') return true
    if ((this.activeSideQuest === 'sq_artifact_talk' || this.activeSideQuest === 'sq_mural_restore') && pointKey === 'mural-monitor') return true

    const mappings = POINT_TASK_MAP[pointKey]
    if (!mappings) {
      // 非任务交互点始终可见
      return true
    }
    if (!this.activeTask) return false
    return mappings.some(
      (m) => m.taskId === this.activeTask!.taskId && m.stepIndex === this.activeTask!.stepIndex,
    )
  }

  private getActivePointMapping(pointKey: string): { taskId: string; stepIndex: 0 | 1 } | null {
    if (!this.activeTask) return null
    const mappings = POINT_TASK_MAP[pointKey]
    if (!mappings) return null
    return mappings.find(
      (m) => m.taskId === this.activeTask!.taskId && m.stepIndex === this.activeTask!.stepIndex,
    ) ?? null
  }

  // ═════════════════════════════════════════════════════════════════════
  // 房间标签
  // ═════════════════════════════════════════════════════════════════════

  private setupRoomLabels() {
    ROOMS.forEach((r) => {
      const cx = (r.x + r.w / 2) * TILE_SIZE
      const cy = (r.y + 1) * TILE_SIZE
      const t = this.add.text(cx, cy, r.name, {
        fontSize: '16px',
        color: '#f0d68a',
        fontFamily: 'monospace',
        stroke: '#0d0a05',
        strokeThickness: 3,
        backgroundColor: '#0d0a05bb',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5, 0).setDepth(7).setAlpha(0.92)
      this.roomLabels.push(t)
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // Event Bus
  // ═════════════════════════════════════════════════════════════════════

  private setupBusListeners() {
    const un = this.busUnsubs
    un.push(bus.on('ui:lock-input', (locked) => { this.inputLocked = locked }))
    un.push(bus.on('game:resume', () => { this.inputLocked = false }))
    un.push(bus.on('ui:dialog-closed', () => { this.inputLocked = false }))
    un.push(bus.on('ui:result-closed', () => { this.inputLocked = false }))
    un.push(bus.on('ui:choice-made', ({ style }) => {
      // ── P2#10: 风格追踪 — 连续同风格3+次触发协同奖励 ──
      if (style === this.lastChoiceStyle) {
        this.styleStreak++
        if (this.styleStreak === 3) {
          // 风格协同：小幅属性加成
          const bonus = style === 'professional' ? { reputation: 3, evidence: 2 }
            : style === 'risky' ? { risk: -3, reputation: 2 }
            : { budget: 2, evidence: 2 }
          this.stats.reputation = Math.min(100, this.stats.reputation + (bonus.reputation ?? 0))
          this.stats.risk = Math.max(0, this.stats.risk + (bonus.risk ?? 0))
          this.stats.evidence = Math.min(100, this.stats.evidence + (bonus.evidence ?? 0))
          this.stats.budget = Math.min(100, this.stats.budget + (bonus.budget ?? 0))
          bus.emit('stats:update', { ...this.stats })
          bus.emit('stats:animate', { stat: 'reputation', delta: bonus.reputation ?? 0 })
        }
      } else {
        this.lastChoiceStyle = style
        this.styleStreak = 1
      }
    }))
    un.push(bus.on('stats:update', (s) => { this.stats = s }))

    // HUD 挂载时请求当前目标（修复从转化面板等返回后目标栏丢失）
    un.push(bus.on('objective:request', () => {
      bus.emit('objective:changed', this.currentObjective)
    }))

    // 接收 React 层设置的 flags
    un.push(bus.on('flags:set', ({ key, value }) => {
      this.gameFlags[key] = value
      // P0: 游客密度随 flag 变化
      if (key === 'free_flow' || key === 'batch_flow' || key === 'cave_closure') {
        this.syncTouristDensity()
      }
    }))

    un.push(bus.on('ui:risk-event-closed', () => {
      this.inputLocked = false
    }))

    un.push(bus.on('task:completed', ({ taskId }) => {
      this.completedTasks.add(taskId)
      this.activeTask = null
      // 完成特效
      this.spawnCompletionBurst()
      // 刷新寻路目标 → 指向下一个 NPC
      this.time.delayedCall(600, () => this.updateObjective())

      // P0+P2: 游客密度同步 & 支线NPC解锁（task_2完成后）
      if (taskId === 'task_2' || taskId === 'task_3') {
        this.time.delayedCall(800, () => this.syncTouristDensity())
      }

      // ── P1#5: 转化系统时机提示 ──
      // Task 1 或 Task 3 完成后，介绍属性转化系统
      const hintTasks = ['task_1', 'task_3']
      if (hintTasks.includes(taskId) && this.completedTasks.size < TASKS.length) {
        const isFirst = taskId === 'task_1'
        this.time.delayedCall(2000, () => {
          bus.emit('open:dialog', {
            lines: [
              { speaker: '📋 系统提示', text: isFirst
                ? '属性转化系统已激活。你可以消耗一种属性换取另一种：例如消耗证据掩盖风险、动用预算购买声誉。每个转化操作仅可使用一次，请谨慎选择时机。'
                : '属性转化系统提示：别忘了你还有未使用的转化操作。在风险过高、预算不足或声誉告急时，转化系统是扭转局面的关键。' },
              { speaker: '💡 提示', text: isFirst
                ? '在HUD面板中可以查看当前可用的转化操作。建议在属性偏高时进行兑换，最大化收益。'
                : '别忘了检查转化面板——你可能有新的操作策略可用了。' },
            ],
          })
        })
      }

      if (this.completedTasks.size >= TASKS.length) {
        this.time.delayedCall(this.challengeMode === 'speedrun' ? 600 : 2000, () => {
          bus.emit('game:over', { stats: this.stats, flags: { ...this.gameFlags } })
        })
      }
    }))

    // 加载存档时恢复 flags
    un.push(bus.on('game:load-save', (save) => {
      if (save.gameFlags) {
        this.gameFlags = { ...save.gameFlags }
      }
      this.time.delayedCall(300, () => this.updateObjective())
    }))

    // 挑战模式设置
    un.push(bus.on('challenge:mode', (mode: string) => {
      this.challengeMode = mode
      if (mode === 'speedrun') {
        this.speedrunStartTime = this.time.now
        this.setupSpeedrunTimer()
      }
    }))

    // ── 游客事件监听 ──
    un.push(bus.on('tourist:event-resolve', ({ eventId, success, choiceId, choiceDeltas }) => {
      if (this.touristManager) {
        this.touristManager.resolveEvent(success, choiceDeltas, choiceId)
      }
    }))
  }

  // ═════════════════════════════════════════════════════════════════════
  // 游客系统 (P0+P1+P2)
  // ═════════════════════════════════════════════════════════════════════

  private setupTouristSystem() {
    this.touristManager = new TouristManager(this, this.mapData)

    this.touristManager.onEventTrigger = (event) => {
      if (this.inputLocked) return
      bus.emit('ui:lock-input', true)
      playRiskAlert()
      const pos = this.touristManager.getActiveEventPosition()
      const eventObj: Objective = {
        type: 'point',
        targetId: '__tourist_event__',
        roomId: 'main-hall',
        roomName: this.getCurrentRoomName(pos?.x ?? 0, pos?.y ?? 0),
        name: '⚠️ ' + event.title,
        description: event.description,
      }
      this.currentObjective = eventObj
      bus.emit('objective:changed', eventObj)
      bus.emit('tourist:event', {
        eventId: event.id,
        title: event.title,
        introLines: event.introLines,
        durationMs: event.durationMs,
        action: event.action,
      })
    }

    this.touristManager.onEventResolve = (event, success, choiceDeltas, choiceId) => {
      // choiceDeltas 来自 ChoicePanel 的选择，优先使用；否则用事件默认值
      const deltas = choiceDeltas ?? (success ? event.successDeltas : event.failDeltas)
      Object.entries(deltas).forEach(([k, v]) => {
        const key = k as keyof GameStats
        this.stats[key] = Math.max(0, Math.min(key === 'budget' ? 20 : 100, this.stats[key] + (v as number)))
      })
      bus.emit('stats:update', { ...this.stats })
      this.time.delayedCall(300, () => this.updateObjective())
      // ★ 修复: 根据 choiceId 决定对话文本，不再仅靠 success boolean
      const msg = choiceId === 'tourist_ignore'
        ? '你选择在暗处观察游客的一举一动。这是文物保护中重要的"被动干预"——有时候，等待比干涉更有力量。你记录了关键行为数据。'
        : choiceId === 'tourist_harsh'
          ? '你走上前，语气严厉但有理有据。游客被你的专业态度震慑住了——虽然他们面色不悦，但文物保护条例就是最高准则。'
          : event.successMsg
      const speaker = choiceId === 'tourist_ignore' ? '👁 观察记录'
        : choiceId === 'tourist_harsh' ? '⚠️ 严厉干预'
        : '✅ 事件解决'
      this.time.delayedCall(400, () => {
        bus.emit('open:dialog', {
          lines: [{ speaker, text: msg }],
        })
      })
    }

    // ★ 游客数量控制推迟到 setObstacles 之后执行（创建时需障碍物数据校验生成位置）
  }

  private getCurrentRoomName(x: number, y: number): string {
    const col = Math.floor(x / TILE_SIZE)
    const row = Math.floor(y / TILE_SIZE)
    for (const r of ROOMS) {
      if (col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h) return r.name
    }
    return '走廊'
  }

  // ═════════════════════════════════════════════════════════════════════
  // P2: 支线任务 NPC
  // ═════════════════════════════════════════════════════════════════════

  private setupSideQuestNPC() {
    if (this.touristNPCInteract) return
    const center = getRoomCenter('main-hall')
    const px = center.x + 30
    const py = center.y - 15
    this.touristNPCInteract = this.add.sprite(px, py, 'interact_point')
    this.touristNPCInteract.setDepth(Math.floor(py / 28)).setScale(1).setTint(0x6eb5c0)
    this.touristNPCInteract.setData('type', 'sidequest')
    this.touristNPCInteract.setData('name', '游客咨询台')
    this.touristNPCLabel = this.add.text(px, py - 18, '🎒 游客', {
      fontSize: '8px', color: '#6eb5c0', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(Math.floor(py / 28) + 0.5)
    this.tweens.add({
      targets: [this.touristNPCInteract],
      y: py - 3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  private checkSideQuestAvailable(): boolean {
    if (this.completedSideQuests.size >= SIDE_QUESTS.length) return false
    if (!this.completedTasks.has('task_2')) return false
    if (this.completedTasks.has('task_5')) return false
    if (this.activeSideQuest) return false
    return true
  }

  private spawnCompletionBurst() {
    // 金光爆发粒子
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2
      const dist = 20 + Math.random() * 30
      const tx = this.player.x + Math.cos(angle) * dist
      const ty = this.player.y + Math.sin(angle) * dist
      const p = this.add.image(tx, ty, 'particle').setDepth(60).setAlpha(0.9).setTint(0xd7bd73)
      this.tweens.add({
        targets: p,
        x: this.player.x + Math.cos(angle) * (dist + 20),
        y: this.player.y + Math.sin(angle) * (dist + 20),
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      })
    }
  }

  /** 速通计时器 HUD */
  private setupSpeedrunTimer() {
    if (this.speedrunTimerText) return
    this.speedrunTimerText = this.add.text(VIEW_W - 10, 44, '0:00', {
      fontSize: '14px',
      color: '#7ab8d9',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    })
      .setOrigin(1, 0)
      .setDepth(100)
      .setScrollFactor(0)

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.speedrunTimerText && this.challengeMode === 'speedrun') {
          const elapsed = this.time.now - this.speedrunStartTime
          const totalSec = Math.floor(elapsed / 1000)
          const min = Math.floor(totalSec / 60)
          const sec = totalSec % 60
          this.speedrunTimerText.setText(`${min}:${sec.toString().padStart(2, '0')}`)
        }
      },
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // Update 循环
  // ═════════════════════════════════════════════════════════════════════

  update(_time: number, delta: number) {
    this.handleMovement(delta)
    this.resolveTouristCollision()
    this.updateDepthSorting()
    this.checkProximity()
    this.handleInteract()
    this.updateLight()
    this.updateDirectionArrow()
    this.drawMiniMap()
    this.updatePointVisibility()
    this.updateCameraZoom()
    this.updatePlayerBounce(delta)
    this.updateRoomLabelHighlights()
    this.updateCorridorHint()
    this.updateObjectiveMarker()
    this.updateRiskOverlay(delta)
    this.updateAmbiance(delta)
    this.updateTourists(delta)
    this.updateSideQuestNPC()
  }

  private handleMovement(delta: number) {
    if (this.inputLocked) {
      this.player.setVelocity(0, 0)
      return
    }

    let vx = 0, vy = 0
    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -PLAYER_SPEED
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = PLAYER_SPEED
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -PLAYER_SPEED
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = PLAYER_SPEED

    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707 }
    this.player.setVelocity(vx, vy)

    // 左右翻转
    if (vx < 0) this.player.setFlipX(true)
    else if (vx > 0) this.player.setFlipX(false)

    // 移动特效
    const isMoving = Math.abs(vx) + Math.abs(vy) > 1
    if (isMoving) {
      this.stepTimer += delta
      this.particleTimer += delta
      if (this.stepTimer > STEP_INTERVAL) {
        playStep()
        this.stepTimer = 0
      }
      if (this.particleTimer > 200) {
        this.spawnStepParticle()
        this.particleTimer = 0
      }
    }
  }

  /** 基于 y 坐标的深度排序 — 顶部物品在下，底部物品在上（标准 top-down 约定） */
  private updateDepthSorting() {
    // 玩家：始终按 y 排序
    this.player.setDepth(Math.floor(this.player.y / 28))

    // NPC 与标签
    this.npcs.forEach((spr, key) => {
      const d = Math.floor(spr.y / 28)
      spr.setDepth(d)
      const label = this.npcLabels.get(key)
      if (label) label.setDepth(d + 0.5)
    })

    // 交互点
    this.points.forEach((spr) => {
      spr.setDepth(Math.floor(spr.y / 28))
    })
  }

  private updatePlayerBounce(delta: number) {
    if (this.inputLocked) return
    const vx = this.player.body?.velocity.x ?? 0
    const vy = this.player.body?.velocity.y ?? 0
    const speed = Math.sqrt(vx * vx + vy * vy)
    if (speed > 5) {
      this.bobOffset = Math.sin(this.time.now * 0.01) * 1.5
    } else {
      this.bobOffset *= 0.9
    }
    this.player.setScale(1, 1 + this.bobOffset * 0.04)
  }

  private spawnStepParticle() {
    const px = this.player.x + Phaser.Math.Between(-6, 6)
    const py = this.player.y + 14
    const p = this.add.image(px, py, 'particle').setDepth(Math.floor(py / 28)).setAlpha(0.6)
    this.tweens.add({
      targets: p,
      y: py + 8,
      x: px + Phaser.Math.Between(-4, 4),
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 500,
      onComplete: () => p.destroy(),
    })
  }

  private updateCameraZoom() {
    // 小房间时稍微放大
    const darkness = getRoomDarkness(this.player.x, this.player.y)
    const targetZoom = darkness > 0.3 ? 1.08 : 1.0
    const currentZoom = this.cameras.main.zoom
    this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * 0.05)
  }

  private checkProximity() {
    const px = this.player.x
    const py = this.player.y

    // NPC
    let newNearNpc: string | null = null
    this.npcs.forEach((spr, key) => {
      if (Phaser.Math.Distance.Between(px, py, spr.x, spr.y) < INTERACT_RADIUS) {
        newNearNpc = key
      }
    })
    if (newNearNpc !== this.nearNpc) {
      if (newNearNpc) bus.emit('player:near-npc', { npcKey: newNearNpc })
      else if (this.nearNpc) bus.emit('player:left-npc', { npcKey: this.nearNpc })
      this.nearNpc = newNearNpc
    }

    // 交互点
    let newNearPoint: string | null = null
    this.points.forEach((spr, key) => {
      if (!this.isPointVisible(key)) return
      if (Phaser.Math.Distance.Between(px, py, spr.x, spr.y) < INTERACT_RADIUS) {
        newNearPoint = key
      }
    })
    if (newNearPoint !== this.nearPoint) {
      if (newNearPoint) bus.emit('player:near-point', { pointKey: newNearPoint })
      else if (this.nearPoint) bus.emit('player:left-point', { pointKey: this.nearPoint })
      this.nearPoint = newNearPoint
    }

    // 互动提示（反映实际 E 键触发逻辑）
    if (!this.interactHint) {
      this.interactHint = this.add.text(0, 0, '', {
        fontSize: '10px',
        color: '#f0d68a',
        fontFamily: 'monospace',
        backgroundColor: '#0d0a05dd',
        padding: { x: 6, y: 4 },
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(100)
    }

    // P1: 活跃事件游客优先提示
    if (this.touristManager?.isNearActiveEvent(this.player.x, this.player.y)) {
      const event = this.touristManager.getActiveEvent()
      this.interactHint.setText(`[E] ⚠️ ${event?.title ?? '紧急干预'}`)
      this.interactHint.setPosition(this.player.x - this.interactHint.width / 2, this.player.y - 32)
      this.interactHint.setVisible(true)
      // 高亮颜色
      this.interactHint.setColor('#d95a54')
      return
    }

    // P2: 支线任务NPC提示
    if (this.touristNPCInteract?.visible) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y,
        this.touristNPCInteract.x, this.touristNPCInteract.y)
      if (dist < INTERACT_RADIUS) {
        this.interactHint.setText('[E] 🎒 游客咨询')
        this.interactHint.setPosition(this.player.x - this.interactHint.width / 2, this.player.y - 32)
        this.interactHint.setVisible(true)
        this.interactHint.setColor('#6eb5c0')
        return
      }
    }

    if (this.nearNpc || this.nearPoint) {
      // 当目标点是当前任务目标时，优先显示点信息
      const pointIsObjective =
        this.nearPoint &&
        this.currentObjective?.type === 'point' &&
        this.currentObjective.targetId === this.nearPoint
      const primaryTarget = pointIsObjective
        ? INTERACT_POINTS.find((p) => p.id === this.nearPoint)?.name ?? this.nearPoint
        : this.nearNpc
          ? NPC_CONFIGS[this.nearNpc]?.name ?? this.nearNpc
          : INTERACT_POINTS.find((p) => p.id === this.nearPoint)?.name ?? this.nearPoint
      const prefix = pointIsObjective ? '📍' : (this.nearNpc ? '👤' : '📌')
      this.interactHint.setText(`[E] ${prefix} ${primaryTarget}`)
      this.interactHint.setPosition(this.player.x - this.interactHint.width / 2, this.player.y - 32)
      this.interactHint.setVisible(true)
    } else {
      this.interactHint.setVisible(false)
    }
  }

  private handleInteract() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return

    // P1: 活跃游客事件 — 最高优先级
    if (this.touristManager?.isNearActiveEvent(this.player.x, this.player.y)) {
      this.onInteractTouristEvent()
      return
    }

    // P2: 支线任务 NPC
    if (this.touristNPCInteract?.visible) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y,
        this.touristNPCInteract.x, this.touristNPCInteract.y)
      if (dist < INTERACT_RADIUS) {
        this.onInteractSideQuest()
        return
      }
    }

    // 优先级：当前任务目标点 > NPC > 普通交互点
    if (this.nearPoint && this.currentObjective?.type === 'point' && this.currentObjective.targetId === this.nearPoint) {
      this.onInteractPoint(this.nearPoint)
    } else if (this.nearNpc && !(this.nearPoint && this.currentObjective?.type === 'point')) {
      this.onInteractNPC(this.nearNpc)
    } else if (this.nearPoint) {
      this.onInteractPoint(this.nearPoint)
    }
  }

  private onInteractNPC(npcKey: string) {
    const cfg = NPC_CONFIGS[npcKey]
    if (!cfg) return
    const task = TASKS.find((t) => t.npcKey === npcKey)
    if (!task) return

    if (this.completedTasks.has(task.id)) {
      bus.emit('open:dialog', {
        lines: [{ speaker: cfg.name, text: '这个任务已经完成了，继续加油！' }],
      })
      return
    }

    const isActive = this.activeTask?.taskId === task.id
    if (isActive) {
      const step = task.steps[this.activeTask!.stepIndex]
      bus.emit('open:dialog', {
        lines: [
          { speaker: cfg.name, text: '任务正在执行中，请前往标记点位进行操作。' },
          { speaker: cfg.name, text: `当前目标：${step.description}` },
        ],
      })
    } else {
      const taskIndex = TASKS.indexOf(task)
      const prevTask = taskIndex > 0 ? TASKS[taskIndex - 1] : null
      if (prevTask && !this.completedTasks.has(prevTask.id)) {
        bus.emit('open:dialog', {
          lines: [{ speaker: cfg.name, text: '请先完成上一项任务再来找我。' }],
        })
        return
      }

      // 激活任务
      this.activeTask = { taskId: task.id, stepIndex: 0 }
      // 更新寻路目标 → 第一步的交互点（三重保险：立即 + 100ms + 对话关闭时）
      this.updateObjective()
      this.time.delayedCall(100, () => this.updateObjective())
      bus.emit('ui:lock-input', true)
      bus.emit('open:dialog', {
        lines: [
          { speaker: cfg.name, text: task.briefing },
          { speaker: cfg.name, text: `第一步：${task.steps[0].description}` },
          { speaker: '系统', text: '任务已激活，前往地图上标记的点位执行任务。' },
        ],
        onClose: () => {
          this.inputLocked = false
          this.updateObjective()
        },
      })
    }
  }

  private onInteractPoint(pointKey: string) {
    // ── 隐藏交互点特殊处理 ──
    const ptConfig = INTERACT_POINTS.find((p) => p.id === pointKey)
    if (ptConfig?.type === 'hidden') {
      this.onInteractHidden(pointKey, ptConfig)
      return
    }

    // ── P2: 支线任务交互 ──（仅在无活跃主线任务时触发）
    if (this.activeSideQuest && !this.activeTask) {
      const sq = SIDE_QUESTS.find((q) => q.id === this.activeSideQuest)
      if (sq) {
        const targetPoint = sq.id === 'sq_lost_phone' ? 'rear-humidity' : 'mural-monitor'
        if (pointKey === targetPoint) {
          this.onInteractSideQuestPoint(sq)
          return
        }
      }
    }

    const ptask = this.getActivePointMapping(pointKey)
    if (!ptask || !this.activeTask) return

    const task = TASKS.find((t) => t.id === ptask.taskId)
    if (!task) return
    const step = task.steps[ptask.stepIndex]
    bus.emit('ui:lock-input', true)
    bus.emit('open:choice', { step, taskTitle: task.title })
  }

  /** P2: 支线任务目标点交互 — 触发放置/讲解小游戏 */
  private onInteractSideQuestPoint(sq: SideQuest) {
    bus.emit('ui:lock-input', true)

    // 构建临时 TaskStep 用于 ChoicePanel
    const step: any = {
      id: sq.id,
      description: sq.locationHint,
      locationKey: sq.id === 'sq_lost_phone' ? 'rear-humidity' : 'mural-monitor',
      choices: [
        {
          id: sq.id + '_try',
          label: sq.id === 'sq_lost_phone' ? '仔细搜索通风井' : sq.id === 'sq_mural_restore' ? '开始壁画拼接' : '开始专业讲解',
          desc: sq.id === 'sq_lost_phone' ? '用手电筒逐寸搜索暗窟通风井，找到手机。' : sq.id === 'sq_mural_restore' ? '戴上手套，从碎片盒中选取壁画残片拼回修复框。' : '从壁画的矿物颜料开始，讲述千年前的故事。',
          style: 'professional' as const,
          deltas: sq.rewards,
          miniGame: sq.miniGame,
          successDeltas: {},
          failDeltas: {},
          setFlags: { ['sq_done_' + sq.id]: true },
        },
        {
          id: sq.id + '_quick',
          label: sq.id === 'sq_lost_phone' ? '用强光手电快速扫视' : sq.id === 'sq_mural_restore' ? '快速试拼主要碎片' : '简要介绍要点',
          desc: '快速完成，效率优先——但可能漏掉关键细节。',
          style: 'compromise' as const,
          deltas: {},
          miniGame: { ...sq.miniGame, difficulty: 1 as 1 | 2 },
          successDeltas: Object.fromEntries(
            Object.entries(sq.rewards).map(([k, v]) => [k, Math.floor((v as number) / 2)])
          ),
          failDeltas: {},
          setFlags: { ['sq_quick_' + sq.id]: true },
        },
        {
          id: sq.id + '_intense',
          label: sq.id === 'sq_lost_phone' ? '进入暗窟深处搜寻' : sq.id === 'sq_mural_restore' ? '盲拼难度挑战' : '深度学术级讲解',
          desc: '用最专业的方式完成任务——但可能付出额外代价。',
          style: 'risky' as const,
          deltas: { ...sq.rewards, risk: sq.id === 'sq_lost_phone' ? 3 : 1 },
          miniGame: { ...sq.miniGame, difficulty: 2 as 1 | 2 },
          successDeltas: { evidence: 2, reputation: 2 },
          failDeltas: sq.id === 'sq_lost_phone' ? { risk: 4, reputation: -1 } : { reputation: -2 },
          setFlags: { ['sq_intense_' + sq.id]: true },
        },
      ],
    }

    bus.emit('open:choice', { step, taskTitle: sq.title })
  }

  /** P1: 与活跃事件游客互动 */
  private onInteractTouristEvent() {
    const event = this.touristManager?.getActiveEvent()
    if (!event) return

    bus.emit('ui:lock-input', true)

    if (event.action === 'timing') {
      // timing 事件：弹出简要 dialog 确认制止
      bus.emit('open:dialog', {
        lines: [
          { speaker: '⚠️ 紧急干预', text: event.description },
          { speaker: '系统', text: '你已到达现场。即将进行紧急干预操作...' },
        ],
        onClose: () => {
          this.inputLocked = false
          // 触发一个简单的 timing 型 minigame
          bus.emit('open:choice', {
            step: this.buildTouristEventChoices(event),
            taskTitle: event.title,
          })
        },
      })
    } else if (event.action === 'dialog') {
      bus.emit('open:dialog', {
        lines: [
          { speaker: '⚠️ 紧急干预', text: event.description },
          { speaker: '系统', text: '请选择处理方式：' },
        ],
        onClose: () => {
          this.inputLocked = false
          bus.emit('open:choice', {
            step: this.buildTouristEventChoices(event),
            taskTitle: event.title,
          })
        },
      })
    } else if (event.action === 'chase') {
      bus.emit('open:dialog', {
        lines: [
          { speaker: '⚠️ 紧急干预', text: event.description },
          { speaker: '系统', text: '你已找到声源。用知识打动游客，让他们理解石窟的脆弱。' },
        ],
        onClose: () => {
          this.inputLocked = false
          bus.emit('open:choice', {
            step: this.buildTouristEventChoices(event),
            taskTitle: event.title,
          })
        },
      })
    }
  }

  /** 为游客事件构造临时选择界面 */
  private buildTouristEventChoices(event: any): any {
    return {
      id: 'tourist_event',
      description: event.description,
      locationKey: '__tourist_event__',
      choices: [
        {
          id: 'tourist_resolve',
          label: event.action === 'timing' ? '立即制止' : event.action === 'dialog' ? '礼貌劝导' : '轻声讲解',
          desc: event.action === 'timing' ? '果断出手制止，保护文物优先。' :
               event.action === 'dialog' ? '以礼相待，温和但坚定地引导游客。' :
               '用专业的知识和石窟的历史打动游客。',
          style: 'professional' as const,
          deltas: event.successDeltas,
          miniGame: { type: 'timing' as const, difficulty: 1, prompt: '在最佳时机按下确认键',
            narrativeBinding: event.description },
          successDeltas: {},
          failDeltas: event.failDeltas,
          setFlags: { ['tourist_' + event.id]: true },
        },
        {
          id: 'tourist_ignore',
          label: '暂时观察',
          desc: '先观察情况再决定——有时等待是最好的干预。',
          style: 'compromise' as const,
          deltas: {},
          miniGame: { type: 'memory' as const, difficulty: 1, prompt: '记住游客行为的特征',
            narrativeBinding: '你在暗处观察着游客的一举一动。下一次，你会更了解他们的行为模式。' },
          successDeltas: { evidence: 1, risk: -1 },
          failDeltas: {},
          setFlags: { ['tourist_observe_' + event.id]: true },
        },
        {
          id: 'tourist_harsh',
          label: '严厉警告',
          desc: '直接严厉警告——在文物安全面前，游客情绪是次要的。',
          style: 'risky' as const,
          deltas: Object.fromEntries(
            Object.entries(event.successDeltas).map(([k, v]) => [k, k === 'reputation' ? (v as number) - 2 : v])
          ),
          miniGame: { type: 'timing' as const, difficulty: 2, prompt: '在游客反应前完成警告程序',
            narrativeBinding: '你大步上前，面色严峻。游客愕然——但你手中的文物保护手册给了你权威。' },
          successDeltas: { risk: -6, reputation: -1 },
          failDeltas: { risk: 3, reputation: -4 },
          setFlags: { ['tourist_harsh_' + event.id]: true },
        },
      ],
    }
  }

  /** P2: 与支线任务游客 NPC 互动 */
  private onInteractSideQuest() {
    if (!this.checkSideQuestAvailable()) {
      bus.emit('open:dialog', {
        lines: [{ speaker: '系统', text: '游客咨询台暂时没有新的求助。' }],
      })
      return
    }

    // 找到第一个未完成的支线任务
    const availableQuests = SIDE_QUESTS.filter((q) => !this.completedSideQuests.has(q.id))
    if (availableQuests.length === 0) return

    const quest = availableQuests[0]
    bus.emit('ui:lock-input', true)
    bus.emit('sidequest:offer', {
      questId: quest.id,
      title: quest.title,
      briefing: quest.briefing,
      npcName: quest.npcName,
    })
    this.activeSideQuest = quest.id
    // ★ 立即更新小地图目标标记和寻路提示
    this.time.delayedCall(400, () => this.updateObjective())
  }

  /** P2: 完成支线任务 */
  completeSideQuest(success: boolean) {
    if (!this.activeSideQuest) return
    const quest = SIDE_QUESTS.find((q) => q.id === this.activeSideQuest)
    if (!quest) return

    const msg = success ? quest.completedMessage : quest.failedMessage

    if (success) {
      Object.entries(quest.rewards).forEach(([k, v]) => {
        const key = k as keyof GameStats
        this.stats[key] = Math.max(0, Math.min(key === 'budget' ? 20 : 100, this.stats[key] + (v as number)))
      })
      bus.emit('stats:update', { ...this.stats })
      bus.emit('stats:animate', { stat: 'reputation', delta: quest.rewards.reputation ?? 0 })
    }

    this.completedSideQuests.add(this.activeSideQuest)
    this.activeSideQuest = null
    bus.emit('sidequest:complete', { questId: quest.id })

    // 恢复主线寻路目标
    this.time.delayedCall(300, () => this.updateObjective())

    // 显示完成消息
    this.time.delayedCall(500, () => {
      bus.emit('open:dialog', {
        lines: [{ speaker: success ? '✅ 支线完成' : '⚠️ 支线未完成', text: msg }],
      })
    })
  }
  private onInteractHidden(pointKey: string, config: InteractPointConfig) {
    const hiddenNarratives: Record<string, { lines: { speaker: string; text: string }[]; foundFlag: string }> = {
      hidden_journal: {
        lines: [
          { speaker: '📓 研究员日志', text: '这是一本泛黄的野外勘探日志。1992年的记录显示，这个石窟曾被一位退休地质教授独自守护了12年。' },
          { speaker: '📓 研究员日志', text: '最后一页写道："石窟不需要英雄，只需要每一个路过的人，都愿意多停留一分钟。"' },
        ],
        foundFlag: 'found_journal',
      },
      hidden_chamber: {
        lines: [
          { speaker: '🔧 隐秘修复室', text: '壁画后面隐藏着一间狭小的修复工具室。墙上的工具排列整齐，有些已经生了锈，但保养得很好。' },
          { speaker: '🔧 隐秘修复室', text: '一张工作台上摊着半幅未完成的壁画临摹，旁边放着一张字条："修复的最高境界，是让人看不出被修复过。"' },
        ],
        foundFlag: 'found_chamber',
      },
      hidden_station: {
        lines: [
          { speaker: '📡 废弃监测站', text: '供电区角落里藏着一台1987年的湿度监测仪。它的屏幕早已熄灭，但外壳上的标签还依稀可辨。' },
          { speaker: '📡 废弃监测站', text: '标签上写着："精度不重要。重要的是——你愿不愿意每天来看一眼读数，风雨无阻。"' },
        ],
        foundFlag: 'found_station',
      },
    }

    const narrative = hiddenNarratives[pointKey]
    if (!narrative) return

    // 检查是否已经发现过
    if (this.gameFlags[narrative.foundFlag]) {
      bus.emit('open:dialog', {
        lines: [{ speaker: '系统', text: '你已经探索过这里了。' }],
      })
      return
    }

    bus.emit('ui:lock-input', true)
    this.gameFlags[narrative.foundFlag] = true
    bus.emit('flags:set', { key: narrative.foundFlag, value: true })
    bus.emit('hidden:found', { pointKey })

    bus.emit('open:dialog', {
      lines: narrative.lines,
      onClose: () => { this.inputLocked = false },
    })
  }

  private updatePointVisibility() {
    this.points.forEach((spr, key) => {
      spr.setVisible(this.isPointVisible(key))
    })
  }

  // ═════════════════════════════════════════════════════════════════════
  // 供 React 层调用的任务推进
  // ═════════════════════════════════════════════════════════════════════

  advanceTask(success: boolean, _deltas: Record<string, number>) {
    if (!this.activeTask) return
    const task = TASKS.find((t) => t.id === this.activeTask!.taskId)
    if (!task) return

    // ═══ P1: 风险自然衰减 — 每完成一步 risk+1，模拟环境持续恶化 ═══
    this.stats.risk = Math.min(100, this.stats.risk + 1)
    bus.emit('stats:update', { ...this.stats })

    // ═══ 风险爆炸检查 ═══
    // 混沌模式：风险等级 +1（触发率 ~+10%）
    const effectiveRisk = this.challengeMode === 'chaos'
      ? Math.min(100, this.stats.risk + 10)
      : this.stats.risk

    // ── P1#6: 证据溢出转化为档案库加分 ──
    if (this.stats.evidence > 60) {
      const overflow = this.stats.evidence - 60
      this.stats.evidence = 60
      this.stats.reputation = Math.min(100, this.stats.reputation + Math.floor(overflow / 2))
      this.gameFlags['archive_bonus'] = true
    }

    const riskLevel = getRiskLevel(effectiveRisk)
    const riskEvent = rollRiskEvent(riskLevel)
    const shouldShowRisk = riskEvent !== null

    // ── P1#9: cover_up 特殊叙事 — 若曾使用 cover_up，风险爆发改为审计发现数据篡改 ──
    if (shouldShowRisk && riskEvent && this.gameFlags['conversion_cover_up']) {
      riskEvent.message = '审计方在交叉对比数据时发现异常——监测记录存在被篡改的痕迹！"数据掩盖"行为的后果已浮出水面。'
      riskEvent.title = '数据篡改暴露'
    }

    if (this.activeTask.stepIndex === 0) {
      // 推进到第二步
      this.activeTask = { taskId: task.id, stepIndex: 1 }
      // 刷新寻路目标
      this.time.delayedCall(800, () => this.updateObjective())

      const lines = [
        { speaker: '系统', text: success ? '✅ 第一步完成！请前往下一个标记点位。' : '⚠️ 操作出现失误，继续执行后续步骤。' },
        { speaker: '系统', text: `第二步：${task.steps[1].description}` },
      ]

      if (shouldShowRisk && riskEvent) {
        lines.splice(1, 0, { speaker: '⚠️ 风险警报', text: riskEvent.message })
      }

      this.time.delayedCall(this.challengeMode === 'speedrun' ? 100 : 500, () => {
        // 先处理风险事件
        if (shouldShowRisk && riskEvent) {
          this.stats = applyRiskDeltas(this.stats, riskEvent)
          bus.emit('stats:update', { ...this.stats })
          bus.emit('show:risk_event', riskEvent)
        }

        bus.emit('open:dialog', {
          lines,
          onClose: () => { this.inputLocked = false },
        })
      })
    } else {
      // 任务完成：先炸风险再完成
      this.time.delayedCall(this.challengeMode === 'speedrun' ? 100 : 500, () => {
        if (shouldShowRisk && riskEvent) {
          this.stats = applyRiskDeltas(this.stats, riskEvent)
          bus.emit('stats:update', { ...this.stats })
          bus.emit('show:risk_event', riskEvent)

          // 风险事件后再显示完成消息
          bus.once('ui:risk-event-closed', () => {
            bus.emit('open:dialog', {
              lines: [{ speaker: '系统', text: task.completedMessage }],
              onClose: () => {
                this.inputLocked = false
                bus.emit('task:completed', { taskId: task.id })
              },
            })
          })
        } else {
          bus.emit('open:dialog', {
            lines: [{ speaker: '系统', text: task.completedMessage }],
            onClose: () => {
              this.inputLocked = false
              bus.emit('task:completed', { taskId: task.id })
            },
          })
        }
      })
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // 寻路引导系统 — 目标计算
  // ═════════════════════════════════════════════════════════════════════

  /** 计算并广播当前目标 */
  private updateObjective() {
    let newObj: Objective | null = null

    // ── P2: 支线任务优先 — 覆盖主线目标 ──
    if (this.activeSideQuest) {
      const sq = SIDE_QUESTS.find((q) => q.id === this.activeSideQuest)
      if (sq) {
        const locKey = this.activeSideQuest === 'sq_lost_phone' ? 'rear-humidity' : 'mural-monitor'
        const roomId = this.activeSideQuest === 'sq_lost_phone' ? 'rear-cave' : 'mural-room'
        const room = ROOMS.find((r) => r.id === roomId)
        newObj = {
          type: 'point',
          targetId: locKey,
          roomId,
          roomName: room?.name ?? '',
          name: '🎒 ' + sq.title,
          description: sq.locationHint,
        }
      }
    } else if (this.activeTask) {
      // 有活跃任务 → 指向当前步骤的交互点
      const task = TASKS.find((t) => t.id === this.activeTask!.taskId)
      if (task) {
        const step = task.steps[this.activeTask!.stepIndex]
        const pt = INTERACT_POINTS.find((p) => p.id === step.locationKey)
        const room = ROOMS.find((r) => r.id === pt?.roomId)
        if (pt && room) {
          newObj = {
            type: 'point',
            targetId: pt.id,
            roomId: room.id,
            roomName: room.name,
            name: pt.name,
            description: step.description,
          }
        }
      }
    } else {
      // 无活跃任务 → 找到第一个未完成的 NPC
      for (const task of TASKS) {
        if (this.completedTasks.has(task.id)) continue
        const cfg = NPC_CONFIGS[task.npcKey]
        if (!cfg) continue
        // 找到该 NPC 所在的房间
        const npcRoomEntry = Object.entries({
          task1_npc: 'mural-room',
          task2_npc: 'rear-cave',
          task3_npc: 'gate-room',
          task4_npc: 'power-room',
          task5_npc: 'main-hall',
        } as Record<string, string>).find(([k]) => k === task.npcKey)
        const roomId = npcRoomEntry?.[1] ?? ''
        const room = ROOMS.find((r) => r.id === roomId)
        if (room) {
          newObj = {
            type: 'npc',
            targetId: task.npcKey,
            roomId: room.id,
            roomName: room.name,
            name: cfg.name,
            description: `前往${room.name}与${cfg.name}对话`,
          }
        }
        break
      }
    }

    this.currentObjective = newObj
    bus.emit('objective:changed', newObj)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 屏幕边缘方向箭头
  // ═════════════════════════════════════════════════════════════════════

  private updateDirectionArrow() {
    this.arrowGfx.clear()
    if (!this.currentObjective) return

    // 脉冲计时器 — 必须在 inView 检查之前更新，否则目标在屏幕内时脉冲会冻结
    this.arrowPulse += 0.04

    // 获取目标世界坐标
    let targetWorldX: number, targetWorldY: number
    if (this.currentObjective.type === 'npc') {
      const spr = this.npcs.get(this.currentObjective.targetId)
      if (!spr) return
      targetWorldX = spr.x
      targetWorldY = spr.y
    } else {
      const pos = getInteractPosition(this.currentObjective.targetId)
      targetWorldX = pos.x
      targetWorldY = pos.y
    }

    // 玩家屏幕坐标
    const cam = this.cameras.main
    const playerScreenX = this.player.x - cam.scrollX
    const playerScreenY = this.player.y - cam.scrollY

    // 目标屏幕坐标
    const targetScreenX = (targetWorldX - cam.scrollX) * cam.zoom
    const targetScreenY = (targetWorldY - cam.scrollY) * cam.zoom

    // 检查目标是否在屏幕内
    const margin = 60
    const inView =
      targetScreenX > margin &&
      targetScreenX < (VIEW_W - margin) &&
      targetScreenY > margin + 40 &&
      targetScreenY < (VIEW_H - margin)

    if (inView) return  // 目标在屏幕内，不需要箭头

    // 计算从屏幕中心到目标的方向
    const cx = VIEW_W / 2
    const cy = VIEW_H / 2
    const dx = targetScreenX - cx
    const dy = targetScreenY - cy
    const angle = Math.atan2(dy, dx)
    const dist = Math.sqrt(dx * dx + dy * dy)

    // 计算箭头在屏幕边缘的位置
    // 使用矩形裁剪：从屏幕中心沿角度方向与屏幕边界求交
    const edgeX = this.clipToEdge(cx, cy, angle, VIEW_W - 24, VIEW_H - 24)
    const ex = edgeX.x
    const ey = edgeX.y

    // 脉冲透明度
    this.arrowPulse += 0.04
    const alpha = 0.55 + Math.sin(this.arrowPulse) * 0.25

    // 绘制箭头
    const arrowSize = 12
    const gfx = this.arrowGfx
    gfx.fillStyle(0xd7bd73, alpha)
    gfx.beginPath()
    // 三角形箭头，尖端指向目标方向
    const tipX = ex + Math.cos(angle) * arrowSize
    const tipY = ey + Math.sin(angle) * arrowSize
    const leftX = ex + Math.cos(angle + 2.5) * arrowSize * 0.7
    const leftY = ey + Math.sin(angle + 2.5) * arrowSize * 0.7
    const rightX = ex + Math.cos(angle - 2.5) * arrowSize * 0.7
    const rightY = ey + Math.sin(angle - 2.5) * arrowSize * 0.7
    gfx.moveTo(tipX, tipY)
    gfx.lineTo(leftX, leftY)
    gfx.lineTo(rightX, rightY)
    gfx.closePath()
    gfx.fillPath()

    // 距离标记（小圆点）
    gfx.fillStyle(0xd7bd73, alpha * 0.5)
    gfx.fillCircle(ex, ey, 3)
  }

  /** 从点 (cx,cy) 沿角度 angle 与矩形边界求交 */
  private clipToEdge(cx: number, cy: number, angle: number, w: number, h: number) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    // 计算到达四条边的 t 值
    const tRight = cos > 0 ? (w - cx) / cos : Infinity
    const tLeft = cos < 0 ? (-cx) / cos : Infinity
    const tBottom = sin > 0 ? (h - cy) / sin : Infinity
    const tTop = sin < 0 ? (-cy) / sin : Infinity

    const t = Math.min(tRight, tLeft, tBottom, tTop)

    return { x: cx + cos * t, y: cy + sin * t }
  }

  /** 高亮目标房间标签 */
  private updateRoomLabelHighlights() {
    const targetRoomId = this.currentObjective?.roomId ?? null
    const pulse = Math.sin(this.arrowPulse * 1.5) * 0.25 + 0.75

    this.roomLabels.forEach((label) => {
      const room = ROOMS.find((r) => {
        const cx = (r.x + r.w / 2) * TILE_SIZE
        const cy = (r.y + 1) * TILE_SIZE
        return label.x === cx && label.y === cy
      })
      if (room?.id === targetRoomId) {
        label.setAlpha(0.55 + pulse * 0.4)
        label.setColor('#d7bd73')
        label.setFontSize(10)
      } else {
        label.setAlpha(0.5)
        label.setColor('#8b7355')
        label.setFontSize(9)
      }
    })
  }

  /** 走廊中显示前方房间名称提示 */
  private updateCorridorHint() {
    const col = Math.floor(this.player.x / TILE_SIZE)
    const row = Math.floor(this.player.y / TILE_SIZE)
    const roomId = this.getRoomAt(col, row)
    // 在房间内不显示走廊提示
    if (roomId) {
      this.corridorHint?.setVisible(false)
      return
    }

    // 查找最近的房间
    let nearest: { id: string; name: string; x: number; y: number } | null = null
    let nearestDist = Infinity
    for (const r of ROOMS) {
      const cx = (r.x + r.w / 2) * TILE_SIZE
      const cy = (r.y + r.h / 2) * TILE_SIZE
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy)
      if (d < nearestDist) {
        nearestDist = d
        nearest = { id: r.id, name: r.name, x: cx, y: cy }
      }
    }
    if (!nearest) return

    // 显示提示文本（"→ 房间名"），跟随玩家位置偏移
    const hintX = this.player.x + (this.player.body?.velocity.x ?? 0) * 0.6
    const hintY = this.player.y - 28
    // 用 objectiveMarker 复用或新建一个Text
    if (!this.corridorHint) {
      this.corridorHint = this.add.text(hintX, hintY, '', {
        fontSize: '10px',
        color: '#aacf8e',
        fontFamily: 'monospace',
        stroke: '#0d0a05',
        strokeThickness: 3,
        backgroundColor: '#0d0a05bb',
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setDepth(16).setAlpha(0.85)
    }
    this.corridorHint.setPosition(hintX, hintY)
    this.corridorHint.setText(`${nearest.name}`)
    this.corridorHint.setVisible(true)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 目标点浮动标记（主地图上的可视化指引）
  // ═════════════════════════════════════════════════════════════════════

  /** 每帧更新目标交互点的主地图标记 */
  private updateObjectiveMarker() {
    if (!this.currentObjective || this.currentObjective.type !== 'point') {
      this.objectiveMarker.setVisible(false)
      this.objectiveRing.setVisible(false)
      return
    }

    // 获取目标点世界坐标
    const pos = getInteractPosition(this.currentObjective.targetId)
    if (!pos || (pos.x === 0 && pos.y === 0)) {
      this.objectiveMarker.setVisible(false)
      this.objectiveRing.setVisible(false)
      return
    }

    const baseY = pos.y
    const pulse = Math.sin(this.arrowPulse * 1.8) * 0.3 + 0.7

    // ── 底部脉冲光环 ──
    this.objectiveRing.setPosition(pos.x, baseY - 12)
    this.objectiveRing.setVisible(true)
    const ringAlpha = 0.25 + Math.sin(this.arrowPulse * 1.3) * 0.2
    const ringScale = 0.85 + Math.sin(this.arrowPulse * 1.1) * 0.25
    this.objectiveRing.setAlpha(ringAlpha).setScale(ringScale)

    // ── 浮动文字标记（"!" 或图标）──
    const floatY = baseY - 32 + Math.sin(this.arrowPulse * 1.4) * 4
    this.objectiveMarker.setPosition(pos.x, floatY)
    this.objectiveMarker.setText('📍 ' + this.currentObjective.name)
    this.objectiveMarker.setVisible(true)
    this.objectiveMarker.setAlpha(0.7 + pulse * 0.3)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 风险预警 — 屏幕边缘红色脉冲叠加层（risk ≥ 75）
  // ═════════════════════════════════════════════════════════════════════

  private updateRiskOverlay(delta: number) {
    this.riskOverlay.clear()
    const riskLevel = getRiskLevel(this.stats.risk)

    // 仅在 danger (≥60) 和 crisis (≥80) 等级显示
    if (riskLevel !== 'danger' && riskLevel !== 'crisis') return

    this.riskPulseTimer += delta * 0.001
    const intensity = riskLevel === 'crisis'
      ? 0.35 + Math.sin(this.riskPulseTimer * 3) * 0.2
      : 0.15 + Math.sin(this.riskPulseTimer * 2) * 0.1

    const color = riskLevel === 'crisis' ? 0xd95a54 : 0xd9a063
    const alpha = intensity

    const gfx = this.riskOverlay
    const w = VIEW_W
    const h = VIEW_H
    const band = 16  // 边缘带宽度

    // 四条边缘带
    gfx.fillStyle(color, alpha)
    gfx.fillRect(0, 0, w, band)           // 上
    gfx.fillRect(0, h - band, w, band)    // 下
    gfx.fillRect(0, band, band, h - band * 2)      // 左
    gfx.fillRect(w - band, band, band, h - band * 2) // 右

    // 四角强化（对角线渐变）
    const corner = 40
    const cornerAlpha = alpha * 1.3
    // 左上
    gfx.fillStyle(color, cornerAlpha * 0.7)
    gfx.fillTriangle(0, 0, corner, 0, 0, corner)
    // 右上
    gfx.fillTriangle(w, 0, w - corner, 0, w, corner)
    // 左下
    gfx.fillTriangle(0, h, corner, h, 0, h - corner)
    // 右下
    gfx.fillTriangle(w, h, w - corner, h, w, h - corner)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 环境氛围粒子 — 房间专属氛围效果
  // ═════════════════════════════════════════════════════════════════════

  private updateAmbiance(delta: number) {
    this.ambianceTimer += delta

    // 每 3 秒尝试生成氛围粒子
    if (this.ambianceTimer < 3000) {
      // 更新已有粒子（淡出 + 上浮）
      this.ambianceParticles = this.ambianceParticles.filter((p) => {
        p.y -= 0.15
        p.alpha -= 0.003
        if (p.alpha <= 0) { p.destroy(); return false }
        return true
      })
      return
    }
    this.ambianceTimer = 0

    // 根据玩家所在房间决定氛围类型
    const px = this.player.x / TILE_SIZE
    const py = this.player.y / TILE_SIZE
    const room = ROOMS.find((r) =>
      px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h
    )
    if (!room) return

    const cx = (room.x + room.w / 2) * TILE_SIZE
    const cy = (room.y + room.h / 2) * TILE_SIZE

    // 暗窟（rear-cave）: 随机滴水声 + 微弱光粒子
    if (room.id === 'rear-cave') {
      if (Math.random() < 0.6) playAmbientDrip()
      this.spawnAmbianceParticle(cx, cy, room, 0x5a7a8a, 0.15)
    }
    // 壁画区（mural-room）: 金色粉尘
    else if (room.id === 'mural-room') {
      this.spawnAmbianceParticle(cx, cy, room, 0xd7bd73, 0.12)
    }
    // 供电室（power-room）: 蓝色电路火花
    else if (room.id === 'power-room') {
      this.spawnAmbianceParticle(cx, cy, room, 0x7ab8d9, 0.1)
    }
    // 大厅（main-hall）: 微弱暖光粒子
    else if (room.id === 'main-hall') {
      this.spawnAmbianceParticle(cx, cy, room, 0xc8b878, 0.08)
    }
    // 档案室（archive-room）: 绿色数据流光
    else if (room.id === 'archive-room') {
      this.spawnAmbianceParticle(cx, cy, room, 0x8fae78, 0.1)
    }
  }

  private spawnAmbianceParticle(cx: number, cy: number, room: { x: number; y: number; w: number; h: number }, color: number, baseAlpha: number) {
    const rx = cx + (Math.random() - 0.5) * room.w * TILE_SIZE * 0.8
    const ry = cy + (Math.random() - 0.5) * room.h * TILE_SIZE * 0.8
    const p = this.add.arc(rx, ry, 2, 0, 360, false, color, baseAlpha)
    p.setDepth(9)
    this.ambianceParticles.push(p)
  }

  // ═════════════════════════════════════════════════════════════════════
  // 游客系统更新
  // ═════════════════════════════════════════════════════════════════════

  /** 玩家-游客软碰撞：玩家不能穿过游客 */
  private resolveTouristCollision(): void {
    const positions = this.touristManager?.getAllPositions()
    if (!positions || positions.length === 0) return

    const playerR = 6
    const px = this.player.x
    const py = this.player.y

    for (const tp of positions) {
      const dx = px - tp.x
      const dy = py - tp.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const minDist = playerR + tp.r

      if (dist < minDist && dist > 0.01) {
        // 推出到安全距离
        const pushX = (dx / dist) * (minDist - dist)
        const pushY = (dy / dist) * (minDist - dist)
        this.player.x += pushX
        this.player.y += pushY
      }
    }
  }

  private updateTourists(delta: number) {
    if (this.touristManager) {
      this.touristManager.update(delta, this.player.x, this.player.y, this.inputLocked)
    }
  }

  /** 根据 flag 变化同步游客密度并显示/隐藏支线NPC */
  private syncTouristDensity() {
    if (!this.touristManager) return
    this.touristManager.updateDensity(this.gameFlags)

    // 检查 Task 3 的 flag 变化
    const hasFlowFlag = this.gameFlags['free_flow'] || this.gameFlags['batch_flow'] || this.gameFlags['cave_closure']
    if (hasFlowFlag) {
      // Task3 已选择 → 密度已生效
    }

    // P2: 支线NPC — 完成 task_2 后显示
    if (this.completedTasks.has('task_2') && !this.completedTasks.has('task_5')) {
      this.setupSideQuestNPC()
    }
  }

  /** 支线任务 NPC 可见性 */
  private updateSideQuestNPC() {
    if (!this.touristNPCInteract) return
    const available = this.checkSideQuestAvailable()
    this.touristNPCInteract.setVisible(available)
    this.touristNPCLabel?.setVisible(available)
    // 动态深度（tween 会改变 y）
    if (available) {
      const y = this.touristNPCInteract.y
      this.touristNPCInteract.setDepth(Math.floor(y / 28))
      this.touristNPCLabel?.setDepth(Math.floor(y / 28) + 0.5)
    }
  }
}
