// ────────────────────────────────────────────────────────────────────────────
// Phaser 游戏实例工厂
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'

let gameInstance: Phaser.Game | null = null

export function createGame(parent: HTMLElement): Phaser.Game {
  if (gameInstance) {
    gameInstance.destroy(true)
    gameInstance = null
  }

  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    width: 960,
    height: 608,
    parent,
    backgroundColor: '#12110d',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, GameScene],
    render: {
      pixelArt: true,
      antialias: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })

  return gameInstance
}

export function destroyGame() {
  if (gameInstance) {
    gameInstance.destroy(true)
    gameInstance = null
  }
}

export function getGameScene(): GameScene | null {
  if (!gameInstance) return null
  return gameInstance.scene.getScene('GameScene') as GameScene
}
