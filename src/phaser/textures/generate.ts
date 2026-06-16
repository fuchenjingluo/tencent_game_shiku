// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 程序化纹理生成
// 25种瓦片类型 + 角色纹理，使用参考文件敦煌暖褐色调色板
// 所有素材Canvas 2D运行时生成，零外部依赖
// ────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser'

const T = 16 // 瓦片大小

// ═══════════════════════════════════════════════════════════════════════════
// 调色板（对齐参考文件）
// ═══════════════════════════════════════════════════════════════════════════
const PAL = {
  // 地面
  floorBase: '#5c4a30',
  floorLight: '#6b573a',
  floorDark: '#4a3a24',
  floorSpeck: '#7a6342',
  // 墙体
  wallBase: '#3a2f1f',
  wallLight: '#4a3c26',
  wallHi: '#6a5638',
  wallLo: '#241c12',
  wallEdge: '#7d6536',
  // 装饰
  moss: '#6f8a4f',
  water: '#3f5a55',
  rubble: '#574a30',
  glyph: '#caa85f',
  crack: '#221a10',
}

// PRNG
let prngSeed = 42
function rand(): number {
  prngSeed = (prngSeed * 16807 + 0) % 2147483647
  return (prngSeed - 1) / 2147483646
}

function resetSeed(s: number) { prngSeed = s }

// ─── 工具 ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a = 1): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ═══════════════════════════════════════════════════════════════════════════
// 地面变体 ×6
// ═══════════════════════════════════════════════════════════════════════════

function drawFloorVariant(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  // 基色随机微偏移
  const r = 88 + Math.floor(rand() * 16) - 8
  const g = 70 + Math.floor(rand() * 14) - 7
  const b = 44 + Math.floor(rand() * 12) - 6
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.fillRect(0, 0, T, T)

  // 磨损噪点
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 8; i++) {
    const sx = Math.floor(rand() * T)
    const sy = Math.floor(rand() * T)
    ctx.fillStyle = rand() > 0.5 ? PAL.floorLight : PAL.floorDark
    ctx.fillRect(sx, sy, 1 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2))
  }

  // 偶发裂纹
  if (rand() < 0.3) {
    ctx.globalAlpha = 0.4
    ctx.strokeStyle = PAL.crack
    ctx.lineWidth = 0.5
    ctx.beginPath()
    const cx = 3 + rand() * 10
    const cy = 3 + rand() * 4
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + rand() * 8 - 4, cy + rand() * 8 - 4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 边缝
  ctx.strokeStyle = hexToRgba(PAL.wallLo, 0.35)
  ctx.lineWidth = 0.5
  ctx.strokeRect(0.5, 0.5, T - 1, T - 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// 墙体 ×10：fill/top/bottom/left/right/corner-tl/tr/bl/br/pillar
// ═══════════════════════════════════════════════════════════════════════════

function drawWallFill(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = PAL.wallBase
  ctx.fillRect(0, 0, T, T)
  // 砖块纹理
  ctx.fillStyle = PAL.wallLo
  ctx.fillRect(0, 0, T, 7)
  ctx.fillStyle = PAL.wallLight
  ctx.fillRect(0, 8, T, 8)
  // 边缘高光/暗
  ctx.fillStyle = PAL.wallHi
  ctx.fillRect(0, 0, T, 1)
  ctx.fillRect(0, 0, 1, T)
  ctx.fillStyle = PAL.wallLo
  ctx.fillRect(T - 1, 0, 1, T)
  ctx.fillRect(0, T - 1, T, 1)
}

function drawWallEdge(ctx: CanvasRenderingContext2D, side: string) {
  ctx.fillStyle = PAL.wallEdge
  ctx.fillRect(0, 0, T, T)
  ctx.fillStyle = PAL.wallLo
  switch (side) {
    case 'top': ctx.fillRect(0, T - 2, T, 2); break
    case 'bottom': ctx.fillRect(0, 0, T, 2); break
    case 'left': ctx.fillRect(T - 2, 0, 2, T); break
    case 'right': ctx.fillRect(0, 0, 2, T); break
  }
}

function drawPillar(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = PAL.wallBase
  ctx.fillRect(0, 0, T, T)
  ctx.fillStyle = PAL.wallHi
  ctx.fillRect(4, 4, 8, 8)
  ctx.fillStyle = PAL.wallEdge
  ctx.fillRect(5, 5, 6, 6)
}

function drawCorner(ctx: CanvasRenderingContext2D, type: string) {
  ctx.fillStyle = PAL.wallBase
  ctx.fillRect(0, 0, T, T)
  ctx.fillStyle = PAL.wallEdge
  switch (type) {
    case 'tl': ctx.fillRect(0, 0, 8, 2); ctx.fillRect(0, 0, 2, 8); break
    case 'tr': ctx.fillRect(8, 0, 8, 2); ctx.fillRect(T - 2, 0, 2, 8); break
    case 'bl': ctx.fillRect(0, T - 2, 8, 2); ctx.fillRect(0, 8, 2, 8); break
    case 'br': ctx.fillRect(8, T - 2, 8, 2); ctx.fillRect(T - 2, 8, 2, 8); break
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 方向阴影 ×4
// ═══════════════════════════════════════════════════════════════════════════

function drawShadow(ctx: CanvasRenderingContext2D, dir: string) {
  const grad = ctx.createLinearGradient(
    dir === 'left' ? 0 : dir === 'right' ? T : 0,
    dir === 'top' ? 0 : dir === 'bottom' ? T : 0,
    dir === 'left' ? T : dir === 'right' ? 0 : 0,
    dir === 'top' ? T : dir === 'bottom' ? 0 : 0,
  )
  grad.addColorStop(0, 'rgba(0,0,0,0.45)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, T, T)
}

// ═══════════════════════════════════════════════════════════════════════════
// 装饰 ×5
// ═══════════════════════════════════════════════════════════════════════════

function drawMoss(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  ctx.fillStyle = hexToRgba(PAL.moss, 0.5)
  for (let i = 0; i < 5; i++) {
    const mx = 2 + rand() * 12
    const my = 2 + rand() * 12
    ctx.beginPath()
    ctx.arc(mx, my, 1 + rand() * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawRubble(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  ctx.fillStyle = hexToRgba(PAL.rubble, 0.6)
  for (let i = 0; i < 4; i++) {
    const rx = 3 + rand() * 10
    const ry = 3 + rand() * 10
    ctx.fillRect(rx, ry, 2 + Math.floor(rand() * 3), 2 + Math.floor(rand() * 3))
  }
}

function drawCrack(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  ctx.strokeStyle = hexToRgba(PAL.crack, 0.7)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  const sx = rand() * T
  const sy = rand() * T
  ctx.moveTo(sx, sy)
  for (let i = 0; i < 3; i++) {
    ctx.lineTo(sx + (rand() - 0.5) * T, sy + (rand() - 0.5) * T)
  }
  ctx.stroke()
}

function drawWaterStain(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  for (let i = 0; i < 3; i++) {
    const grad = ctx.createRadialGradient(
      4 + rand() * 8, 4 + rand() * 8, 0,
      4 + rand() * 8, 4 + rand() * 8, 3 + rand() * 4,
    )
    grad.addColorStop(0, hexToRgba(PAL.water, 0.4))
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, T, T)
  }
}

function drawGlyph(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  ctx.fillStyle = hexToRgba(PAL.glyph, 0.5 + rand() * 0.3)
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const glyphs = ['卍', '云', '山', '水', '火', '木', '金', '土']
  ctx.fillText(glyphs[Math.floor(rand() * glyphs.length)], T / 2, T / 2)
}

// ═══════════════════════════════════════════════════════════════════════════
// 石窟寺主题装饰 ×8（新增）
// ═══════════════════════════════════════════════════════════════════════════

function drawMuralFragment(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 壁画基底 — 暖褐色底
  ctx.fillStyle = hexToRgba('#6b4e3a', 0.85)
  ctx.fillRect(0, 0, T, T)
  // 矿物颜料斑块 — 敦煌壁画特色：石青、石绿、朱砂、金
  const pigments = ['#3c6b8c', '#5a8a6a', '#c44b3c', '#d7bd73', '#8b5a4a']
  for (let i = 0; i < 6; i++) {
    const px = 1 + rand() * 13
    const py = 1 + rand() * 13
    ctx.fillStyle = hexToRgba(pigments[Math.floor(rand() * pigments.length)], 0.35 + rand() * 0.35)
    ctx.fillRect(px, py, 2 + Math.floor(rand() * 5), 2 + Math.floor(rand() * 4))
  }
  // 金线勾边
  ctx.strokeStyle = hexToRgba('#d7bd73', 0.5)
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(2 + rand() * 12, 2)
  ctx.lineTo(2 + rand() * 12, 14)
  ctx.stroke()
  // 岁月剥落
  ctx.fillStyle = hexToRgba(PAL.wallBase, 0.5)
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(rand() * 14, rand() * 14, 1 + rand() * 3, 1 + rand() * 2)
  }
}

function drawBuddhaStatue(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 石质基底
  ctx.fillStyle = '#7a6b55'
  ctx.fillRect(0, 0, T, T)
  // 佛像轮廓（简化几何）
  // 背光
  ctx.fillStyle = hexToRgba('#d7bd73', 0.4)
  ctx.beginPath()
  ctx.ellipse(8, 6, 5, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  // 身体（袈裟）
  ctx.fillStyle = '#8b6b4a'
  ctx.fillRect(5, 8, 6, 6)
  // 头部
  ctx.fillStyle = '#9b8b6a'
  ctx.fillRect(5, 2, 6, 5)
  // 发髻
  ctx.fillStyle = '#3a4a5a'
  ctx.fillRect(6, 0, 4, 2)
  // 面部特征
  ctx.fillStyle = '#5a4a30'
  ctx.fillRect(6, 4, 1, 1)  // 左眼
  ctx.fillRect(9, 4, 1, 1)  // 右眼
  // 莲花座
  ctx.fillStyle = '#9b8b6a'
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(3 + i * 4, 13, 3, 3)
  }
}

function drawStoneLantern(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 底座
  ctx.fillStyle = '#6b5a45'
  ctx.fillRect(4, 12, 8, 4)
  // 柱身
  ctx.fillStyle = '#7a6b55'
  ctx.fillRect(6, 6, 4, 7)
  // 灯罩
  ctx.fillStyle = '#8b7355'
  ctx.fillRect(4, 2, 8, 5)
  // 火光
  const flicker = 0.5 + rand() * 0.4
  ctx.fillStyle = hexToRgba('#d7a040', flicker)
  ctx.fillRect(6, 3, 4, 3)
  ctx.fillStyle = hexToRgba('#fff8e0', flicker * 0.6)
  ctx.fillRect(7, 4, 2, 1)
}

function drawStoneTablet(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 石碑主体
  ctx.fillStyle = '#6b5a45'
  ctx.fillRect(3, 0, 10, 13)
  // 高光边缘
  ctx.fillStyle = '#8b7355'
  ctx.fillRect(3, 0, 10, 1)
  ctx.fillRect(3, 0, 1, 13)
  // 碑文（竖线）
  ctx.fillStyle = hexToRgba('#4a3a24', 0.6)
  for (let i = 0; i < 3; i++) {
    const lx = 5 + i * 3
    ctx.fillRect(lx, 2, 1, 10)
  }
  // 碑额弧形
  ctx.fillStyle = '#7a6b55'
  ctx.beginPath()
  ctx.arc(8, 1, 5, Math.PI, 0)
  ctx.fill()
  // 底座
  ctx.fillStyle = '#5a4a35'
  ctx.fillRect(1, 13, 14, 3)
}

function drawCaveFormation(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 钟乳石/岩壁凸起
  ctx.fillStyle = '#4a3a28'
  // 主体从顶部垂下
  const dropLen = 5 + rand() * 8
  ctx.beginPath()
  ctx.moveTo(2, 0)
  ctx.lineTo(3 + rand() * 2, dropLen)
  ctx.lineTo(10 + rand() * 4, dropLen + rand() * 3)
  ctx.lineTo(14, 0)
  ctx.closePath()
  ctx.fill()
  // 高光
  ctx.fillStyle = hexToRgba('#6b5a45', 0.4)
  ctx.fillRect(6, 1, 3, Math.floor(dropLen * 0.5))
  // 水珠
  ctx.fillStyle = hexToRgba('#5a8a8a', 0.5)
  ctx.fillRect(7, dropLen, 2, 2)
}

function drawEquipmentShelf(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 架子框架
  ctx.fillStyle = '#5a4a30'
  ctx.fillRect(1, 0, 14, 16)
  // 横隔板
  ctx.fillStyle = '#6b5a3a'
  ctx.fillRect(1, 5, 14, 2)
  ctx.fillRect(1, 11, 14, 2)
  // 设备/工具
  const gearColors = ['#7a6b5a', '#8b7355', '#6b7a3a', '#3a6b7a', '#5a5a5a']
  for (let shelf = 0; shelf < 2; shelf++) {
    const sy = shelf === 0 ? 1 : 7
    for (let i = 0; i < 2; i++) {
      const gx = 3 + i * 5 + rand() * 2
      ctx.fillStyle = gearColors[Math.floor(rand() * gearColors.length)]
      ctx.fillRect(gx, sy + rand(), 3 + Math.floor(rand() * 2), 2 + Math.floor(rand() * 2))
    }
  }
  // 底部
  ctx.fillStyle = '#4a3a24'
  ctx.fillRect(1, 14, 14, 2)
}

function drawIncenseBurner(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 三足底座
  ctx.fillStyle = '#8b6b3a'
  ctx.fillRect(5, 11, 2, 5)  // 左足
  ctx.fillRect(9, 11, 2, 5)  // 右足
  ctx.fillRect(7, 11, 2, 5)  // 中足
  // 炉身
  ctx.fillStyle = '#9b7b4a'
  ctx.beginPath()
  ctx.ellipse(8, 8, 5, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // 炉口
  ctx.fillStyle = '#6b4a20'
  ctx.beginPath()
  ctx.ellipse(8, 6, 3, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // 烟气
  ctx.fillStyle = hexToRgba('#c8c0a8', 0.3 + rand() * 0.2)
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(6 + i, 2 - i, 2, 3)
  }
}

function drawWoodenRailing(ctx: CanvasRenderingContext2D, seed: number) {
  resetSeed(seed)
  ctx.clearRect(0, 0, T, T)
  // 横梁
  ctx.fillStyle = '#6b4a2a'
  ctx.fillRect(2, 4, 12, 2)
  ctx.fillRect(2, 10, 12, 2)
  // 竖柱
  ctx.fillStyle = '#5a3a1a'
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(3 + i * 4, 2, 2, 12)
  }
  // 木纹
  ctx.fillStyle = hexToRgba('#8b6b3a', 0.3)
  ctx.fillRect(3, 5, 10, 1)
  ctx.fillRect(3, 11, 10, 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// 伪3D实体障碍物 ×7（顶光照，左亮右暗，底边阴影）
// 尺寸大于 16×16，玩家不可穿过
// ═══════════════════════════════════════════════════════════════════════════

// 大佛立像 — 28×36
function drawBuddhaStatue3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 28, H = 36
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 地面投影
  ctx.fillStyle = 'rgba(8,6,4,0.45)'
  ctx.beginPath()
  ctx.ellipse(14, 34, 11, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // 底座（莲花座）
  ctx.fillStyle = '#8b7355'
  ctx.fillRect(5, 28, 18, 6)
  ctx.fillStyle = '#9b8365'  // 亮面
  ctx.fillRect(5, 28, 18, 2)
  ctx.fillStyle = '#6b5345'  // 暗面
  ctx.fillRect(5, 32, 18, 2)
  // 莲瓣
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#9b8365' : '#7b6345'
    ctx.fillRect(5 + i * 4, 29, 3, 3)
  }
  // 身体（袈裟 — 梯形）
  ctx.fillStyle = '#8b6340'
  ctx.fillRect(8, 14, 12, 15)
  // 袈裟褶皱
  ctx.fillStyle = '#a07350'  // 亮面（左上光）
  ctx.fillRect(8, 14, 4, 15)
  ctx.fillStyle = '#6b4320'  // 暗面（右下阴影）
  ctx.fillRect(18, 14, 2, 15)
  // 袈裟纹理线
  ctx.fillStyle = 'rgba(215,189,115,0.25)'
  ctx.fillRect(9, 18, 10, 1)
  ctx.fillRect(9, 22, 10, 1)
  ctx.fillRect(9, 26, 10, 1)
  // 右手施无畏印
  ctx.fillStyle = '#c8a880'
  ctx.fillRect(7, 13, 4, 8)
  ctx.fillStyle = '#d8b890'
  ctx.fillRect(7, 13, 2, 8)
  // 头部
  ctx.fillStyle = '#c8a880'
  ctx.fillRect(10, 4, 8, 10)
  // 面部亮面
  ctx.fillStyle = '#d8b890'
  ctx.fillRect(10, 4, 3, 10)
  // 发髻
  ctx.fillStyle = '#2a3a4a'
  ctx.fillRect(11, 0, 6, 4)
  ctx.fillStyle = '#3a4a5a'  // 亮面
  ctx.fillRect(11, 0, 2, 4)
  // 五官
  ctx.fillStyle = '#4a2a14'
  ctx.fillRect(12, 7, 1, 1)
  ctx.fillRect(16, 7, 1, 1)
  ctx.fillRect(13, 10, 2, 1)
  // 背光晕
  ctx.fillStyle = 'rgba(215,189,115,0.25)'
  ctx.beginPath()
  ctx.ellipse(14, 12, 9, 16, 0, 0, Math.PI * 2)
  ctx.fill()
}

// 武士/天王像 — 24×34
function drawGuardianStatue3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 24, H = 34
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 投影
  ctx.fillStyle = 'rgba(8,6,4,0.4)'
  ctx.beginPath()
  ctx.ellipse(12, 32, 10, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // 底座（石台）
  ctx.fillStyle = '#5a4530'
  ctx.fillRect(4, 28, 16, 6)
  ctx.fillStyle = '#6a5540'
  ctx.fillRect(4, 28, 16, 2)
  // 腿（铠甲）
  ctx.fillStyle = '#5a4030'
  ctx.fillRect(6, 22, 5, 7)
  ctx.fillRect(13, 22, 5, 7)
  ctx.fillStyle = '#6a5040'
  ctx.fillRect(6, 22, 2, 7)
  ctx.fillRect(13, 22, 2, 7)
  // 身躯（铠甲 + 飘带）
  ctx.fillStyle = '#7a5040'
  ctx.fillRect(5, 10, 14, 13)
  ctx.fillStyle = '#8a6050'  // 亮面
  ctx.fillRect(5, 10, 5, 13)
  ctx.fillStyle = '#5a3020'  // 暗面
  ctx.fillRect(16, 10, 3, 13)
  // 护心镜
  ctx.fillStyle = '#9b8365'
  ctx.fillRect(9, 13, 6, 6)
  ctx.fillStyle = '#ab9375'
  ctx.fillRect(9, 13, 2, 6)
  // 头部 + 头盔
  ctx.fillStyle = '#c8a880'
  ctx.fillRect(7, 2, 10, 9)
  ctx.fillStyle = '#5a3020'  // 头盔暗
  ctx.fillRect(7, 1, 10, 3)
  ctx.fillStyle = '#3a2a1a'
  // 怒目
  ctx.fillStyle = '#f8f0e0'
  ctx.fillRect(9, 5, 2, 2)
  ctx.fillRect(13, 5, 2, 2)
  ctx.fillStyle = '#1a0a04'
  ctx.fillRect(9, 5, 1, 1)
  ctx.fillRect(13, 5, 1, 1)
  // 嘴
  ctx.fillStyle = '#3a1a0a'
  ctx.fillRect(10, 9, 4, 1)
  // 武器（长戟 — 竖立右侧）
  ctx.fillStyle = '#4a3a2a'
  ctx.fillRect(18, 4, 2, 26)
  ctx.fillStyle = '#5a4a3a'
  ctx.fillRect(18, 4, 1, 26)
  // 戟头
  ctx.fillStyle = '#6a5a4a'
  ctx.fillRect(17, 2, 4, 5)
  ctx.fillStyle = '#d7bd73'
  ctx.fillRect(18, 1, 2, 2)
}

// 监测仪器 — 24×22
function drawMonitorDevice3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 24, H = 22
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 投影
  ctx.fillStyle = 'rgba(6,4,2,0.4)'
  ctx.fillRect(2, 18, 21, 4)
  // 机身（金属箱体）
  ctx.fillStyle = '#3a4035'
  ctx.fillRect(3, 4, 18, 16)
  ctx.fillStyle = '#4a5045'  // 亮面
  ctx.fillRect(3, 4, 6, 16)
  ctx.fillStyle = '#2a3025'  // 暗面
  ctx.fillRect(18, 4, 3, 16)
  // 顶部面板
  ctx.fillStyle = '#3a352a'
  ctx.fillRect(2, 2, 20, 3)
  ctx.fillStyle = '#4a453a'
  ctx.fillRect(2, 2, 8, 3)
  // 显示屏
  ctx.fillStyle = '#0a1a0a'
  ctx.fillRect(5, 6, 14, 7)
  // 屏幕内容
  ctx.fillStyle = '#1a3a1a'
  ctx.fillRect(6, 7, 12, 5)
  // 波形图
  ctx.fillStyle = '#3a8a3a'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(7 + i * 3, 8 + Math.floor(rand() * 3), 2, 2)
  }
  // LED指示灯
  const ledColors = ['#4ae04a', '#4ae04a', '#e0a04a', '#e04a4a']
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ledColors[i]
    ctx.fillRect(7 + i * 4, 15, 2, 2)
  }
  // 底座脚
  ctx.fillStyle = '#2a3025'
  ctx.fillRect(4, 19, 4, 3)
  ctx.fillRect(16, 19, 4, 3)
  // 天线/传感器
  ctx.fillStyle = '#5a5a4a'
  ctx.fillRect(10, 0, 2, 4)
  ctx.fillStyle = '#e04a4a'
  ctx.fillRect(9, 0, 4, 1)
}

// 石柱 — 14×36
function drawStonePillar3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 14, H = 36
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 投影
  ctx.fillStyle = 'rgba(6,4,2,0.35)'
  ctx.beginPath()
  ctx.ellipse(7, 34, 6, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // 柱础
  ctx.fillStyle = '#3a2a18'
  ctx.fillRect(3, 29, 8, 7)
  ctx.fillStyle = '#4a3a28'
  ctx.fillRect(3, 29, 8, 2)
  // 柱身（略细）
  ctx.fillStyle = '#5a4530'
  ctx.fillRect(4, 8, 6, 22)
  ctx.fillStyle = '#6a5540'  // 亮面（左光）
  ctx.fillRect(4, 8, 2, 22)
  ctx.fillStyle = '#4a3520'  // 暗面（右影）
  ctx.fillRect(9, 8, 2, 22)
  // 柱身纹理
  ctx.fillStyle = 'rgba(139,115,85,0.3)'
  ctx.fillRect(5, 10, 3, 1)
  ctx.fillRect(5, 14, 3, 1)
  ctx.fillRect(5, 18, 3, 1)
  ctx.fillRect(5, 22, 3, 1)
  ctx.fillRect(5, 26, 3, 1)
  // 柱头（斗拱）
  ctx.fillStyle = '#6a4a30'
  ctx.fillRect(2, 4, 10, 5)
  ctx.fillStyle = '#7a5a40'
  ctx.fillRect(2, 4, 4, 5)
  ctx.fillStyle = '#5a3a20'
  ctx.fillRect(10, 4, 2, 5)
  // 柱头顶部装饰
  ctx.fillStyle = '#8b6b4a'
  ctx.fillRect(1, 1, 12, 4)
  ctx.fillStyle = '#9b7b5a'
  ctx.fillRect(1, 1, 5, 4)
}

// 大门/入口 — 36×26
function drawGate3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 36, H = 26
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 地面门槛投影
  ctx.fillStyle = 'rgba(6,4,2,0.45)'
  ctx.fillRect(6, 18, 24, 8)
  // 门框立柱
  ctx.fillStyle = '#4a3020'
  ctx.fillRect(4, 4, 4, 22)
  ctx.fillRect(28, 4, 4, 22)
  // 门框亮面
  ctx.fillStyle = '#5a4030'
  ctx.fillRect(4, 4, 1, 22)
  ctx.fillRect(28, 4, 1, 22)
  // 门框暗面
  ctx.fillStyle = '#3a2010'
  ctx.fillRect(7, 4, 1, 22)
  ctx.fillRect(31, 4, 1, 22)
  // 门楣（顶部横梁）
  ctx.fillStyle = '#5a3a20'
  ctx.fillRect(2, 2, 32, 5)
  ctx.fillStyle = '#6a4a30'  // 亮面
  ctx.fillRect(2, 2, 14, 5)
  ctx.fillStyle = '#4a2a10'  // 暗面
  ctx.fillRect(30, 2, 4, 5)
  // 门楣装饰
  ctx.fillStyle = 'rgba(215,189,115,0.3)'
  ctx.fillRect(8, 3, 20, 1)
  // 门板（双扇，半开）
  ctx.fillStyle = '#3a2a18'
  ctx.fillRect(9, 7, 7, 17)
  ctx.fillRect(20, 7, 7, 17)
  // 门板亮面
  ctx.fillStyle = '#4a3a28'
  ctx.fillRect(9, 7, 2, 17)
  ctx.fillRect(20, 7, 2, 17)
  // 门板暗面
  ctx.fillStyle = '#2a1a08'
  ctx.fillRect(15, 7, 2, 17)
  ctx.fillRect(26, 7, 2, 17)
  // 门环
  ctx.fillStyle = '#d7bd73'
  ctx.fillRect(13, 14, 2, 3)
  ctx.fillRect(22, 14, 2, 3)
  // 中间缝隙（门微开）
  ctx.fillStyle = '#0a0604'
  ctx.fillRect(16, 8, 4, 15)
  // 门槛
  ctx.fillStyle = '#3a2a18'
  ctx.fillRect(4, 24, 28, 2)
  ctx.fillStyle = '#5a4a38'
  ctx.fillRect(4, 24, 12, 2)
}

// 石供桌/祭坛 — 30×22
function drawAltarTable3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 30, H = 22
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 投影
  ctx.fillStyle = 'rgba(6,4,2,0.35)'
  ctx.fillRect(2, 18, 28, 4)
  // 桌面
  ctx.fillStyle = '#7a6342'
  ctx.fillRect(2, 4, 26, 0)
  ctx.fillStyle = '#6a5332'
  ctx.fillRect(1, 2, 28, 5)
  ctx.fillStyle = '#8a7352'  // 亮面
  ctx.fillRect(1, 2, 12, 5)
  ctx.fillStyle = '#5a4322'  // 暗面
  ctx.fillRect(26, 2, 3, 5)
  // 桌身
  ctx.fillStyle = '#5a4020'
  ctx.fillRect(3, 6, 24, 12)
  ctx.fillStyle = '#6a5030'  // 亮面
  ctx.fillRect(3, 6, 8, 12)
  ctx.fillStyle = '#4a3010'  // 暗面
  ctx.fillRect(22, 6, 5, 12)
  // 前面板雕花
  ctx.fillStyle = 'rgba(215,189,115,0.2)'
  ctx.fillRect(8, 8, 14, 8)
  ctx.fillStyle = 'rgba(215,189,115,0.35)'
  ctx.fillRect(10, 9, 10, 6)
  // 桌腿 ×4
  ctx.fillStyle = '#4a3520'
  ctx.fillRect(3, 18, 4, 4); ctx.fillRect(23, 18, 4, 4)
  ctx.fillRect(10, 18, 3, 4); ctx.fillRect(17, 18, 3, 4)
  ctx.fillStyle = '#5a4530'
  ctx.fillRect(3, 18, 2, 4); ctx.fillRect(10, 18, 1, 4)
}

// 石笋/钟乳石柱 — 16×28
function drawStalagmite3D(ctx: CanvasRenderingContext2D, seed: number) {
  const W = 16, H = 28
  resetSeed(seed)
  ctx.clearRect(0, 0, W, H)
  // 投影
  ctx.fillStyle = 'rgba(6,4,2,0.3)'
  ctx.beginPath()
  ctx.ellipse(8, 27, 7, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  // 主体（从粗到细）
  ctx.fillStyle = '#4a3a2a'
  ctx.beginPath()
  ctx.moveTo(4, 26)
  ctx.lineTo(3, 14)
  ctx.lineTo(4, 8)
  ctx.lineTo(6, 3)
  ctx.lineTo(7, 1)
  ctx.lineTo(9, 1)
  ctx.lineTo(10, 3)
  ctx.lineTo(12, 8)
  ctx.lineTo(13, 14)
  ctx.lineTo(12, 26)
  ctx.closePath()
  ctx.fill()
  // 亮面（左光）
  ctx.fillStyle = '#5a4a3a'
  ctx.beginPath()
  ctx.moveTo(4, 26)
  ctx.lineTo(3, 14)
  ctx.lineTo(4, 8)
  ctx.lineTo(6, 3)
  ctx.lineTo(7, 1)
  ctx.lineTo(8, 1)
  ctx.lineTo(8, 26)
  ctx.closePath()
  ctx.fill()
  // 矿物纹路
  ctx.fillStyle = 'rgba(139,115,85,0.3)'
  ctx.fillRect(5, 20, 2, 1)
  ctx.fillRect(6, 16, 3, 1)
  ctx.fillRect(5, 12, 2, 1)
  // 水珠
  ctx.fillStyle = 'rgba(90,138,138,0.4)'
  ctx.fillRect(5, 6, 2, 2)
}

// ═══════════════════════════════════════════════════════════════════════════
// 角色纹理（32×32，参考文件配色）
// ═══════════════════════════════════════════════════════════════════════════

function drawPlayerSprite(canvas: HTMLCanvasElement) {
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  // 袍服 #335b56
  ctx.fillStyle = '#335b56'
  ctx.fillRect(8, 16, 16, 12)
  // 头部
  ctx.fillStyle = '#d5b98a'
  ctx.fillRect(10, 4, 12, 12)
  // 腰带 #d7bd73
  ctx.fillStyle = '#d7bd73'
  ctx.fillRect(10, 26, 12, 2)
  // 腿
  ctx.fillStyle = '#2a4a44'
  ctx.fillRect(10, 28, 5, 4)
  ctx.fillRect(17, 28, 5, 4)
  // 眼睛
  ctx.fillStyle = '#1a1008'
  ctx.fillRect(12, 8, 2, 2)
  ctx.fillRect(18, 8, 2, 2)
  // 帽子
  ctx.fillStyle = '#8b7355'
  ctx.fillRect(8, 2, 16, 3)
}

function drawNPC(canvas: HTMLCanvasElement, robeColor: string) {
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  const r = parseInt(robeColor.slice(1, 3), 16)
  const g = parseInt(robeColor.slice(3, 5), 16)
  const b = parseInt(robeColor.slice(5, 7), 16)
  // 袍服
  ctx.fillStyle = robeColor
  ctx.fillRect(8, 16, 16, 12)
  // 头部
  ctx.fillStyle = '#d5b98a'
  ctx.fillRect(10, 4, 12, 12)
  // 腰带 #d7bd73
  ctx.fillStyle = '#d7bd73'
  ctx.fillRect(10, 26, 12, 2)
  // 暗色领口
  ctx.fillStyle = `rgb(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)})`
  ctx.fillRect(12, 14, 8, 3)
  // 腿
  const dr = Math.max(0, r - 40)
  const dg = Math.max(0, g - 40)
  const db = Math.max(0, b - 40)
  ctx.fillStyle = `rgb(${dr},${dg},${db})`
  ctx.fillRect(10, 28, 5, 4)
  ctx.fillRect(17, 28, 5, 4)
  // 眼睛
  ctx.fillStyle = '#1a1008'
  ctx.fillRect(12, 8, 2, 2)
  ctx.fillRect(18, 8, 2, 2)
}

function drawInteractPoint(canvas: HTMLCanvasElement) {
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')!
  const cx = 16, cy = 16
  // 光晕
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14)
  grad.addColorStop(0, 'rgba(215,189,115,0.85)')
  grad.addColorStop(0.5, 'rgba(215,189,115,0.3)')
  grad.addColorStop(1, 'rgba(215,189,115,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 32)
  // 核心
  ctx.fillStyle = '#d7bd73'
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff8e0'
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawParticle(canvas: HTMLCanvasElement) {
  canvas.width = 6
  canvas.height = 6
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(3, 3, 0, 3, 3, 3)
  grad.addColorStop(0, 'rgba(139,115,85,0.8)')
  grad.addColorStop(1, 'rgba(139,115,85,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 6, 6)
}

// ═══════════════════════════════════════════════════════════════════════════
// 纹理注册
// ═══════════════════════════════════════════════════════════════════════════

export function generateTextures(scene: Phaser.Scene) {
  // 地面 ×6
  for (let v = 0; v < 6; v++) {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawFloorVariant(c.getContext('2d')!, v * 137 + 1)
    scene.textures.addCanvas(`floor_${v}`, c)
  }

  // 墙体 fill
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawWallFill(c.getContext('2d')!)
    scene.textures.addCanvas('wall', c)
  }
  // 墙体各边
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawWallEdge(c.getContext('2d')!, side)
    scene.textures.addCanvas(`wall_${side}`, c)
  }
  // 墙角
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawCorner(c.getContext('2d')!, corner)
    scene.textures.addCanvas(`corner_${corner}`, c)
  }
  // 柱子
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawPillar(c.getContext('2d')!)
    scene.textures.addCanvas('pillar', c)
  }

  // 阴影 ×4
  for (const dir of ['top', 'bottom', 'left', 'right']) {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawShadow(c.getContext('2d')!, dir)
    scene.textures.addCanvas(`shadow_${dir}`, c)
  }

  // 装饰 ×5
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawMoss(c.getContext('2d')!, 99)
    scene.textures.addCanvas('decor_moss', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawRubble(c.getContext('2d')!, 55)
    scene.textures.addCanvas('decor_rubble', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawCrack(c.getContext('2d')!, 77)
    scene.textures.addCanvas('decor_crack', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawWaterStain(c.getContext('2d')!, 33)
    scene.textures.addCanvas('decor_water', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawGlyph(c.getContext('2d')!, 44)
    scene.textures.addCanvas('decor_glyph', c)
  }

  // 玩家
  {
    const c = document.createElement('canvas')
    drawPlayerSprite(c)
    scene.textures.addCanvas('player', c)
  }

  // NPC
  const npcColors: Record<string, string> = {
    task1_npc: '#7a5c3a',
    task2_npc: '#3a6b7a',
    task3_npc: '#7a3a3a',
    task4_npc: '#6b7a3a',
    task5_npc: '#5c3a7a',
  }
  Object.entries(npcColors).forEach(([key, color]) => {
    const c = document.createElement('canvas')
    drawNPC(c, color)
    scene.textures.addCanvas(key, c)
  })

  // 交互点
  {
    const c = document.createElement('canvas')
    drawInteractPoint(c)
    scene.textures.addCanvas('interact_point', c)
  }

  // 石窟寺主题装饰 ×8
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawMuralFragment(c.getContext('2d')!, 201)
    scene.textures.addCanvas('decor_mural', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawBuddhaStatue(c.getContext('2d')!, 202)
    scene.textures.addCanvas('decor_statue', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawStoneLantern(c.getContext('2d')!, 203)
    scene.textures.addCanvas('decor_lantern', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawStoneTablet(c.getContext('2d')!, 204)
    scene.textures.addCanvas('decor_stele', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawCaveFormation(c.getContext('2d')!, 205)
    scene.textures.addCanvas('decor_cave_form', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawEquipmentShelf(c.getContext('2d')!, 206)
    scene.textures.addCanvas('decor_shelf', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawIncenseBurner(c.getContext('2d')!, 207)
    scene.textures.addCanvas('decor_censer', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = T; c.height = T
    drawWoodenRailing(c.getContext('2d')!, 208)
    scene.textures.addCanvas('decor_railing', c)
  }

  // 伪3D实体障碍物 ×7
  {
    const c = document.createElement('canvas')
    c.width = 28; c.height = 36
    drawBuddhaStatue3D(c.getContext('2d')!, 301)
    scene.textures.addCanvas('obj_buddha', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = 24; c.height = 34
    drawGuardianStatue3D(c.getContext('2d')!, 302)
    scene.textures.addCanvas('obj_guardian', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = 24; c.height = 22
    drawMonitorDevice3D(c.getContext('2d')!, 303)
    scene.textures.addCanvas('obj_monitor', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = 14; c.height = 36
    drawStonePillar3D(c.getContext('2d')!, 304)
    scene.textures.addCanvas('obj_pillar', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = 36; c.height = 26
    drawGate3D(c.getContext('2d')!, 305)
    scene.textures.addCanvas('obj_gate', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = 30; c.height = 22
    drawAltarTable3D(c.getContext('2d')!, 306)
    scene.textures.addCanvas('obj_altar', c)
  }
  {
    const c = document.createElement('canvas')
    c.width = 16; c.height = 28
    drawStalagmite3D(c.getContext('2d')!, 307)
    scene.textures.addCanvas('obj_stalagmite', c)
  }

  // 粒子
  {
    const c = document.createElement('canvas')
    drawParticle(c)
    scene.textures.addCanvas('particle', c)
  }
}
