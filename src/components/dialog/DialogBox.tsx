// ────────────────────────────────────────────────────────────────────────────
// 对话框组件
// ────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DialogLine } from '../../types'
import { bus } from '../../events/bus'
import { playInteract } from '../../audio/audioManager'

interface DialogBoxProps {
  lines: DialogLine[]
  onClose: () => void
}

function DialogBox({ lines, onClose, onDismiss }: DialogBoxProps & { onDismiss?: () => void }) {
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const currentLine = lines[lineIdx] ?? { speaker: '', text: '' }

  useEffect(() => {
    setCharIdx(0)
    setDisplayed('')
  }, [lineIdx])

  useEffect(() => {
    if (charIdx >= currentLine.text.length) return
    const timer = setTimeout(() => {
      setDisplayed(currentLine.text.slice(0, charIdx + 1))
      setCharIdx((c) => c + 1)
    }, 28)
    return () => clearTimeout(timer)
  }, [charIdx, currentLine.text])

  const handleAdvance = useCallback(() => {
    if (charIdx < currentLine.text.length) {
      // 快进
      setDisplayed(currentLine.text)
      setCharIdx(currentLine.text.length)
      return
    }
    if (lineIdx < lines.length - 1) {
      playInteract()
      setLineIdx((i) => i + 1)
    } else {
      onClose()
    }
  }, [charIdx, currentLine.text, lineIdx, lines.length, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault()
        handleAdvance()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleAdvance])

  const isNPC = currentLine.portrait === 'npc' || !currentLine.portrait

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 680,
        maxWidth: '90%',
        zIndex: 200,
        pointerEvents: 'all',
      }}
    >
      <div style={{
        background: 'rgba(18,17,13,0.97)',
        border: '1px solid #3d3322',
        borderRadius: 8,
        padding: '16px 20px',
        boxShadow: '0 0 30px rgba(215,189,115,0.1), inset 0 1px 0 rgba(215,189,115,0.05)',
        position: 'relative',
      }}>
        {/* 像素边框装饰 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(215,189,115,0.4), transparent)',
        }} />

        {/* 关闭按钮 — 始终可见，直接关闭不触发 onClose */}
        {onDismiss && (
          <motion.button
            whileHover={{ scale: 1.15, background: 'rgba(217,143,114,0.25)' }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            style={{
              position: 'absolute', top: 8, right: 10,
              width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              color: '#8b7355',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'monospace',
              zIndex: 2,
            }}
            title="关闭弹窗（不接取任务）"
          >✕</motion.button>
        )}

        {/* 说话人 */}
        <div style={{
          fontSize: 11,
          color: isNPC ? '#d98f72' : '#8fae78',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isNPC ? '#d98f72' : '#8fae78',
            display: 'inline-block',
          }} />
          {currentLine.speaker}
        </div>

        {/* 对话文本 */}
        <div style={{
          fontSize: 14,
          color: '#d4c89a',
          lineHeight: 1.6,
          fontFamily: '"Noto Serif SC", "Source Han Serif", serif',
          minHeight: 44,
        }}>
          {displayed}
          {charIdx < currentLine.text.length && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{ color: '#d7bd73' }}
            >▋</motion.span>
          )}
        </div>

        {/* 进度 + 提示 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {lines.map((_, i) => (
              <div key={i} style={{
                width: 16, height: 3, borderRadius: 2,
                background: i <= lineIdx ? '#d7bd73' : '#3d3322',
              }} />
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAdvance}
            style={{
              fontSize: 11,
              color: '#d7bd73',
              background: 'rgba(215,189,115,0.1)',
              border: '1px solid rgba(215,189,115,0.3)',
              borderRadius: 4,
              padding: '3px 10px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            {lineIdx < lines.length - 1 ? '下一句 ▶' : '关闭 ✕'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── 对话框控制器 ──────────────────────────────────────────────────────────

interface DialogState {
  lines: DialogLine[]
  onClose?: () => void
}

export function DialogController() {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  useEffect(() => {
    const unsub = bus.on('open:dialog', ({ lines, onClose }) => {
      setDialog({ lines, onClose })
    })
    return unsub
  }, [])

  const handleClose = useCallback(() => {
    const cb = dialog?.onClose
    setDialog(null)
    bus.emit('ui:dialog-closed')
    cb?.()
  }, [dialog])

  const handleDismiss = useCallback(() => {
    setDialog(null)
    bus.emit('ui:dialog-closed')
  }, [])

  return (
    <AnimatePresence>
      {dialog && <DialogBox key="dialog" lines={dialog.lines} onClose={handleClose} onDismiss={handleDismiss} />}
    </AnimatePresence>
  )
}
