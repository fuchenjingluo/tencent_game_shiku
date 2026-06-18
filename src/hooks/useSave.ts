// ────────────────────────────────────────────────────────────────────────────
// 存档系统 v3.0 — 多存档位 + gameFlags + throttle 防抖
// ────────────────────────────────────────────────────────────────────────────
import type { GameSave, GameStats, ActiveTask, GameFlags } from '../types'

const SLOT_COUNT = 3
export const SAVE_VERSION = 2
const SAVE_THROTTLE_MS = 2000

function key(index: number) {
  return `shiku_guardian_save_${index}`
}

// ─── throttle 管理 — 每个槽位独立 ──────────────────────────────────────────
const _lastSaveTime: Record<number, number> = {}
const _pendingSave: Record<number, ReturnType<typeof setTimeout> | null> = {}

export interface SaveSlotMeta {
  index: number
  save: GameSave
}

/** 列出所有有数据的存档槽位 */
export function listSaves(): SaveSlotMeta[] {
  const result: SaveSlotMeta[] = []
  for (let i = 0; i < SLOT_COUNT; i++) {
    const raw = localStorage.getItem(key(i))
    if (!raw) continue
    try {
      const data = JSON.parse(raw) as GameSave
      result.push({ index: i, save: upgrade(data) })
    } catch { /* skip corrupt */ }
  }
  return result.sort((a, b) => b.save.timestamp - a.save.timestamp)
}

/** 加载指定槽位的存档 */
export function loadSave(slotIndex: number): GameSave | null {
  try {
    const raw = localStorage.getItem(key(slotIndex))
    if (!raw) return null
    return upgrade(JSON.parse(raw) as GameSave)
  } catch {
    return null
  }
}

/** 升级旧存档格式 */
function upgrade(data: GameSave): GameSave {
  if (data.version < SAVE_VERSION) {
    return { ...data, version: SAVE_VERSION, gameFlags: data.gameFlags ?? {} }
  }
  return data
}

/** 写入存档到指定槽位 */
export function writeSave(
  slotIndex: number,
  stats: GameStats,
  completedTasks: string[],
  activeTask: ActiveTask | null,
  gameFlags: GameFlags = {},
): void {
  const now = Date.now()
  const elapsed = now - (_lastSaveTime[slotIndex] ?? 0)

  if (elapsed < SAVE_THROTTLE_MS) {
    if (_pendingSave[slotIndex]) clearTimeout(_pendingSave[slotIndex]!)
    _pendingSave[slotIndex] = setTimeout(
      () => doWriteSave(slotIndex, stats, completedTasks, activeTask, gameFlags),
      SAVE_THROTTLE_MS - elapsed,
    )
    return
  }
  doWriteSave(slotIndex, stats, completedTasks, activeTask, gameFlags)
}

function doWriteSave(
  slotIndex: number,
  stats: GameStats,
  completedTasks: string[],
  activeTask: ActiveTask | null,
  gameFlags: GameFlags,
): void {
  const save: GameSave = {
    version: SAVE_VERSION,
    stats,
    completedTasks,
    activeTask,
    gameFlags,
    timestamp: Date.now(),
  }
  try {
    localStorage.setItem(key(slotIndex), JSON.stringify(save))
    _lastSaveTime[slotIndex] = Date.now()
  } catch { /* storage full, ignore */ }
  if (_pendingSave[slotIndex]) {
    clearTimeout(_pendingSave[slotIndex]!)
    _pendingSave[slotIndex] = null
  }
}

/** 删除指定槽位的存档 */
export function deleteSaveSlot(slotIndex: number): void {
  localStorage.removeItem(key(slotIndex))
}
