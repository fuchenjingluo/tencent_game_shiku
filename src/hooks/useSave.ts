// ────────────────────────────────────────────────────────────────────────────
// 存档系统 v2.0 — 包含 gameFlags + throttle 防抖
// ────────────────────────────────────────────────────────────────────────────
import type { GameSave, GameStats, ActiveTask, GameFlags } from '../types'

const SAVE_KEY = 'shiku_guardian_save'
export const SAVE_VERSION = 2  // 升级版本号（v1→v2：增加了 gameFlags）
const SAVE_THROTTLE_MS = 2000  // 最短写盘间隔
let _lastSaveTime = 0
let _pendingSave: ReturnType<typeof setTimeout> | null = null

export function loadSave(): GameSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as GameSave
    // 兼容旧存档（v1 没有 gameFlags）
    if (data.version < SAVE_VERSION) {
      return {
        ...data,
        version: SAVE_VERSION,
        gameFlags: data.gameFlags ?? {},
      } as GameSave
    }
    return data
  } catch {
    return null
  }
}

export function writeSave(
  stats: GameStats,
  completedTasks: string[],
  activeTask: ActiveTask | null,
  gameFlags: GameFlags = {},
): void {
  const now = Date.now()
  const elapsed = now - _lastSaveTime

  // ★ throttle：距上次写盘 < 2s → 延迟写入（最后一份数据覆盖之前排队的）
  if (elapsed < SAVE_THROTTLE_MS) {
    if (_pendingSave) clearTimeout(_pendingSave)
    _pendingSave = setTimeout(
      () => doWriteSave(stats, completedTasks, activeTask, gameFlags),
      SAVE_THROTTLE_MS - elapsed,
    )
    return
  }

  doWriteSave(stats, completedTasks, activeTask, gameFlags)
}

function doWriteSave(
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
    _lastSaveTime = Date.now()
  } catch {
    // storage full, ignore
  }
  if (_pendingSave) {
    clearTimeout(_pendingSave)
    _pendingSave = null
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
