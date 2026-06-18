// ────────────────────────────────────────────────────────────────────────────
// BootScene — 预加载/生成所有素材（含分帧进度报告）
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'
import { generateTexturesAsync } from '../textures/generate'

let sceneBootGen = 0

function reportBootProgress(pct: number, tip: string) {
  window.dispatchEvent(new CustomEvent('boot:progress', {
    detail: { progress: Math.round(pct), tip, gen: sceneBootGen },
  }))
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // ★ 捕获当期代际（在 scene 创建时就锁定，防止中途切换）
    sceneBootGen = (window as any).getBootGeneration?.() ?? 0
    console.log('[BootScene] preload gen=', sceneBootGen)
    reportBootProgress(5, '初始化 Phaser 引擎…')

    // 仅加载一个占位像素以触发 preload 完整流程（不放 visible progress bar）
    this.load.image('__boot_pixel', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

    this.load.on('complete', () => {
      console.log('[BootScene] preload complete gen=', sceneBootGen)
      reportBootProgress(12, '准备生成纹理…')
    })
  }

  async create() {
    // ★ 确保 gen 在 create 时也同步（以防 preload 被跳过）
    sceneBootGen = (window as any).getBootGeneration?.() ?? 0
    console.log('[BootScene] create gen=', sceneBootGen, 'bootGeneration=', (window as any).getBootGeneration?.())
    reportBootProgress(15, '开始生成石窟纹理…')

    try {
      await generateTexturesAsync(this, reportBootProgress, sceneBootGen)
    } catch (err) {
      console.error('[BootScene] 纹理生成失败:', err)
      const currentGen = (window as any).getBootGeneration?.()
      if (sceneBootGen === (currentGen ?? 0)) {
        reportBootProgress(100, '纹理生成出错，使用回退模式…')
      }
    }

    // ★ 关键：在报告100%之前清除画布，防止 Phaser 残留画面透过半透明 HTML loader 可见
    const bg = this.add.graphics()
    bg.fillStyle(0x12110d)
    bg.fillRect(0, 0, 960, 608)
    bg.setDepth(-1)

    console.log('[BootScene] 报告100%, gen=', sceneBootGen)
    reportBootProgress(100, '加载完成')
    this.time.delayedCall(300, () => {
      console.log('[BootScene] 切换到 GameScene')
      this.scene.start('GameScene')
    })
  }
}
