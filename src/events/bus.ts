// ────────────────────────────────────────────────────────────────────────────
// TypedEventBus — Phaser ↔ React 双向通信桥
// ────────────────────────────────────────────────────────────────────────────
import type { BusEvents, BusEventKey } from '../types'

type Handler<K extends BusEventKey> = BusEvents[K] extends void
  ? () => void
  : (payload: BusEvents[K]) => void

class TypedEventBus {
  private listeners = new Map<string, Set<Function>>()

  on<K extends BusEventKey>(event: K, handler: Handler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  once<K extends BusEventKey>(event: K, handler: Handler<K>): void {
    const wrapper = (...args: any[]) => {
      ;(handler as any)(...args)
      this.off(event, wrapper as any)
    }
    this.on(event, wrapper as any)
  }

  off<K extends BusEventKey>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit<K extends BusEventKey>(
    event: K,
    ...args: BusEvents[K] extends void ? [] : [payload: BusEvents[K]]
  ): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((h) => h(...(args as any[])))
  }

  clear(event?: BusEventKey): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}

export const bus = new TypedEventBus()
