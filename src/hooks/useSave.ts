// ────────────────────────────────────────────────────────────────────────────
// 存档系统 v2.0 — 包含 gameFlags
// ────────────────────────────────────────────────────────────────────────────
import type { GameSave, GameStats, ActiveTask, GameFlags } from '../types'

const SAVE_KEY = 'shiku_guardian_save'
export const SAVE_VERSION = 2  // 升级版本号（v1→v2：增加了 gameFlags）

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
  } catch {
    // storage full, ignore
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
