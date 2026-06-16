// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 地图唯一真相源（对齐参考文件）
// 100×70 瓦片(16px) = 1600×1120px 世界
// 7个房间 + 9条走廊 + 7个交互点
// ────────────────────────────────────────────────────────────────────────────
import type { RoomConfig, CorridorConfig, InteractPointConfig } from '../types'

export const MAP_COLS = 100
export const MAP_ROWS = 70
export const TILE_SIZE = 16

// ═══════════════════════════════════════════════════════════════════════════
// 房间布局（对齐参考文件坐标）
// ═══════════════════════════════════════════════════════════════════════════

export const ROOMS: RoomConfig[] = [
  { id: 'mural-room',     name: '壁画保护区',   x: 6,  y: 6,  w: 22, h: 16, darkness: 0    },
  { id: 'rear-cave',      name: '后室暗窟',     x: 62, y: 4,  w: 24, h: 15, darkness: 0.45 },
  { id: 'main-hall',      name: '中心窟室',     x: 38, y: 27, w: 24, h: 18, darkness: 0    },
  { id: 'equipment-room', name: '设备间',       x: 66, y: 29, w: 20, h: 14, darkness: 0    },
  { id: 'power-room',     name: '供电区',       x: 72, y: 48, w: 20, h: 14, darkness: 0.15 },
  { id: 'archive-room',   name: '数字档案室',   x: 8,  y: 44, w: 22, h: 16, darkness: 0    },
  { id: 'gate-room',      name: '窟前栈道',     x: 38, y: 50, w: 24, h: 16, darkness: 0    },
]

// ═══════════════════════════════════════════════════════════════════════════
// 走廊连接（对齐参考文件）
// ═══════════════════════════════════════════════════════════════════════════

export const CORRIDORS: CorridorConfig[] = [
  { x: 24, y: 13, w: 18, h: 4,  connects: '壁画区→中心窟室 水平段' },
  { x: 40, y: 13, w: 4,  h: 16, connects: '上接壁画走廊，下接中心窟室' },
  { x: 70, y: 17, w: 4,  h: 12, connects: '后室暗窟→下' },
  { x: 40, y: 23, w: 34, h: 5,  connects: '走廊2→走廊3 水平段（衔接中心窟室北墙）' },
  { x: 60, y: 33, w: 8,  h: 5,  connects: '中心窟室→设备间' },
  { x: 74, y: 41, w: 4,  h: 9,  connects: '设备间→供电区' },
  { x: 48, y: 43, w: 4,  h: 9,  connects: '中心窟室→窟前栈道' },
  { x: 28, y: 55, w: 12, h: 4,  connects: '窟前栈道→档案室' },
  { x: 14, y: 20, w: 4,  h: 26, connects: '壁画区→档案室 左侧纵向通道' },
]

// ═══════════════════════════════════════════════════════════════════════════
// 交互点（对齐参考文件）
// ═══════════════════════════════════════════════════════════════════════════

export const INTERACT_POINTS: InteractPointConfig[] = [
  { id: 'director',         type: 'npc',       name: '文保主任',     roomId: 'main-hall',      offsetX: 0,  offsetY: -2 },
  // ── 任务交互点：offset 故意避开房间中心（NPC站的位置）────
  { id: 'mural-monitor',    type: 'monitor',   name: '壁画监测点',   roomId: 'mural-room',     offsetX: -7, offsetY: -5 },
  { id: 'rear-humidity',    type: 'monitor',   name: '后室湿度点',   roomId: 'rear-cave',      offsetX: -10, offsetY: 4 },
  { id: 'visitor-gate',     type: 'gate',      name: '游客入口闸机',  roomId: 'gate-room',      offsetX: 7,  offsetY: -5 },
  { id: 'equipment-desk',   type: 'equipment', name: '设备间工作台',  roomId: 'equipment-room', offsetX: -6, offsetY: 4 },
  { id: 'power-box',        type: 'power',     name: '供电柜',       roomId: 'power-room',     offsetX: 5,  offsetY: -4 },
  { id: 'archive-terminal', type: 'archive',   name: '数字档案终端',  roomId: 'archive-room',   offsetX: -5, offsetY: 5 },
  // ── P2: 隐藏交互点（不绑定任务，供探索发现）──
  { id: 'hidden_journal',   type: 'hidden',    name: '研究员日志',   roomId: 'rear-cave',      offsetX: -6, offsetY: 4  },
  { id: 'hidden_chamber',   type: 'hidden',    name: '隐秘修复室',   roomId: 'mural-room',     offsetX: 8,  offsetY: -5 },
  { id: 'hidden_station',   type: 'hidden',    name: '废弃监测站',   roomId: 'power-room',     offsetX: -6, offsetY: 4  },
]

// 出生点：gate-room 偏移 (0,+4)
const spawnRoom = ROOMS.find((r) => r.id === 'gate-room')!
export const PLAYER_SPAWN = {
  x: (spawnRoom.x + spawnRoom.w / 2) * TILE_SIZE,
  y: (spawnRoom.y + spawnRoom.h - 2) * TILE_SIZE,
}

// ─── 辅助函数：根据房间ID获取中心像素坐标 ──────────────────────────────────

export function getRoomCenter(roomId: string): { x: number; y: number } {
  const room = ROOMS.find((r) => r.id === roomId)
  if (!room) return PLAYER_SPAWN
  return {
    x: (room.x + room.w / 2) * TILE_SIZE,
    y: (room.y + room.h / 2) * TILE_SIZE,
  }
}

// ─── 根据交互点ID获取像素坐标 ─────────────────────────────────────────────

export function getInteractPosition(pointId: string): { x: number; y: number } {
  const pt = INTERACT_POINTS.find((p) => p.id === pointId)
  if (!pt) return PLAYER_SPAWN
  const room = ROOMS.find((r) => r.id === pt.roomId)
  if (!room) return PLAYER_SPAWN
  return {
    x: (room.x + room.w / 2 + pt.offsetX) * TILE_SIZE,
    y: (room.y + room.h / 2 + pt.offsetY) * TILE_SIZE,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 生成地图瓦片：0=空, 1=地板, 2=墙体
// ═══════════════════════════════════════════════════════════════════════════

export function buildMapData(): Uint8Array {
  const data = new Uint8Array(MAP_COLS * MAP_ROWS)

  function fill(x: number, y: number, w: number, h: number, val: number) {
    for (let row = y; row < y + h && row < MAP_ROWS; row++) {
      if (row < 0) continue
      for (let col = x; col < x + w && col < MAP_COLS; col++) {
        if (col >= 0) data[row * MAP_COLS + col] = val
      }
    }
  }

  // 1. 整张地图初始化为墙体 — 所有未"挖掘"的区域自动成为不可通行墙
  data.fill(2)

  // 2. 挖出房间内部（地板）— 房间边界保留为墙
  ROOMS.forEach((r) => {
    fill(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1)
  })

  // 3. 挖出走廊（地板）— 打通房间之间的连接
  CORRIDORS.forEach((c) => {
    fill(c.x, c.y, c.w, c.h, 1)
  })

  return data
}

// ═══════════════════════════════════════════════════════════════════════════
// 获取房间暗度
// ═══════════════════════════════════════════════════════════════════════════

export function getRoomDarkness(x: number, y: number): number {
  const col = Math.floor(x / TILE_SIZE)
  const row = Math.floor(y / TILE_SIZE)
  for (const r of ROOMS) {
    if (col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h) {
      return r.darkness
    }
  }
  // 在走廊中
  for (const c of CORRIDORS) {
    if (col >= c.x && col < c.x + c.w && row >= c.y && row < c.y + c.h) {
      return 0.1
    }
  }
  return 0.3 // 室外/未定义区域
}

// ═══════════════════════════════════════════════════════════════════════════
// 程序化随机数（mulberry32，确定性PRNG，不用 Math.random）
// ═══════════════════════════════════════════════════════════════════════════

export function createPRNG(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
