// ────────────────────────────────────────────────────────────────────────────
// BootScene — 预加载/生成所有素材
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'
import { generateTextures } from '../textures/generate'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // 进度条（纯 Graphics）
    const bar = this.add.graphics()
    this.load.on('progress', (v: number) => {
      bar.clear()
      bar.fillStyle(0x3d3322)
      bar.fillRect(0, 0, 960, 608)
      bar.fillStyle(0xd7bd73)
      bar.fillRect(280, 290, 400 * v, 18)
      bar.lineStyle(1, 0x8b7355)
      bar.strokeRect(278, 288, 404, 22)
      // 文字由 DOM 处理
    })
  }

  create() {
    // 程序化生成所有纹理
    generateTextures(this)
    this.scene.start('GameScene')
  }
}
