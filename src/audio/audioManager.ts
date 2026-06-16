// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — Web Audio API 程序化音效（对齐参考文件）
// BGM: 55Hz sine drone + 低通滤波白噪声(风) + 随机水滴声
// 脚步: 短促带通滤波噪声 burst
// 交互: 三角波双音 880→1100Hz
// 成功: C5-E5-G5 上行琶音
// 失败: 锯齿波 300→100Hz 下行
// UI点击: 方波 1000Hz
// 任务完成: C5-E5-G5-C6 凡响琶音
// ────────────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let droneOsc: OscillatorNode | null = null
let droneGain: GainNode | null = null
let lfoOsc: OscillatorNode | null = null
let noiseNode: AudioBufferSourceNode | null = null
let waterInterval: ReturnType<typeof setInterval> | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

// ═══════════════════════════════════════════════════════════════════════════
// BGM — 55Hz 低频drone + 低通滤波白噪声(风) + 随机水滴
// ═══════════════════════════════════════════════════════════════════════════

function startBGM() {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()

  masterGain = ac.createGain()
  masterGain.gain.setValueAtTime(0.07, ac.currentTime)
  masterGain.connect(ac.destination)

  // 55Hz 正弦 drone
  droneOsc = ac.createOscillator()
  droneGain = ac.createGain()
  droneOsc.type = 'sine'
  droneOsc.frequency.setValueAtTime(55, ac.currentTime)
  droneGain.gain.setValueAtTime(0.35, ac.currentTime)
  droneOsc.connect(droneGain)
  droneGain.connect(masterGain)
  droneOsc.start()

  // LFO 调制 (0.08Hz)
  lfoOsc = ac.createOscillator()
  const lfoGain = ac.createGain()
  lfoOsc.frequency.setValueAtTime(0.08, ac.currentTime)
  lfoGain.gain.setValueAtTime(4, ac.currentTime)
  lfoOsc.connect(lfoGain)
  lfoGain.connect(droneOsc.frequency)
  lfoOsc.start()

  // 低通滤波白噪声（石窟风环境音）
  const noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = Math.random() * 2 - 1
  }
  noiseNode = ac.createBufferSource()
  noiseNode.buffer = noiseBuffer
  noiseNode.loop = true
  const windFilter = ac.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.setValueAtTime(200, ac.currentTime)
  const windGain = ac.createGain()
  windGain.gain.setValueAtTime(0.15, ac.currentTime)
  noiseNode.connect(windFilter)
  windFilter.connect(windGain)
  windGain.connect(masterGain)
  noiseNode.start()

  // 随机水滴 (3-7秒间隔)
  waterInterval = setInterval(() => {
    if (Math.random() < 0.25) playDroplet()
  }, 2500)
}

function playDroplet() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const g = ac.createGain()
  const freq = 800 + Math.random() * 600
  osc.frequency.setValueAtTime(freq, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ac.currentTime + 0.15)
  g.gain.setValueAtTime(0.1, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.45)
  osc.type = 'sine'
  osc.connect(g)
  g.connect(masterGain!)
  osc.start()
  osc.stop(ac.currentTime + 0.45)
}

function stopBGM() {
  if (waterInterval) { clearInterval(waterInterval); waterInterval = null }
  if (lfoOsc) { try { lfoOsc.stop() } catch { /* */ } lfoOsc = null }
  if (droneOsc) { try { droneOsc.stop() } catch { /* */ } droneOsc = null }
  droneGain = null
  if (noiseNode) { try { noiseNode.stop() } catch { /* */ } noiseNode = null }
  masterGain = null
}

// ═══════════════════════════════════════════════════════════════════════════
// 脚步 — 短促带通滤波噪声 burst
// ═══════════════════════════════════════════════════════════════════════════

export function playStep() {
  const ac = getCtx()
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.08), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.12
  }
  const src = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 220
  filter.Q.value = 1.5
  src.buffer = buffer
  src.connect(filter)
  filter.connect(ac.destination)
  src.start()
}

// ═══════════════════════════════════════════════════════════════════════════
// 交互 — 三角波双音 880→1100Hz
// ═══════════════════════════════════════════════════════════════════════════

export function playInteract() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.frequency.setValueAtTime(880, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1100, ac.currentTime + 0.12)
  g.gain.setValueAtTime(0.18, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
  osc.type = 'triangle'
  osc.connect(g)
  g.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.3)
}

// ═══════════════════════════════════════════════════════════════════════════
// 成功 — C5-E5-G5 上行琶音
// ═══════════════════════════════════════════════════════════════════════════

export function playSuccess() {
  const ac = getCtx()
  const notes = [523, 659, 784] // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    const t = ac.currentTime + i * 0.1
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.14, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.type = 'triangle'
    osc.connect(g)
    g.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.35)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 失败 — 锯齿波 300→100Hz 下行
// ═══════════════════════════════════════════════════════════════════════════

export function playFail() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.frequency.setValueAtTime(300, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.55)
  g.gain.setValueAtTime(0.18, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.55)
  osc.type = 'sawtooth'
  osc.connect(g)
  g.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.55)
}

// ═══════════════════════════════════════════════════════════════════════════
// UI 点击 — 方波 1000Hz 极短
// ═══════════════════════════════════════════════════════════════════════════

export function playClick() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.frequency.setValueAtTime(1000, ac.currentTime)
  g.gain.setValueAtTime(0.1, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06)
  osc.type = 'square'
  osc.connect(g)
  g.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.06)
}

// ═══════════════════════════════════════════════════════════════════════════
// 任务完成 — C5-E5-G5-C6 凡响琶音
// ═══════════════════════════════════════════════════════════════════════════

export function playTaskComplete() {
  const ac = getCtx()
  const chord = [523, 659, 784, 1047] // C5, E5, G5, C6
  chord.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    const t = ac.currentTime + i * 0.12
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.1, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
    osc.type = 'triangle'
    osc.connect(g)
    g.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 1.4)
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 风险预警 — 低频脉冲 alarm（risk ≥ 75 时触发）
// ═══════════════════════════════════════════════════════════════════════════

export function playRiskAlert() {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.frequency.setValueAtTime(120, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.25)
  g.gain.setValueAtTime(0, ac.currentTime)
  g.gain.linearRampToValueAtTime(0.08, ac.currentTime + 0.05)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6)
  osc.type = 'sawtooth'
  osc.connect(g)
  g.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.6)
}

// ═══════════════════════════════════════════════════════════════════════════
// 环境氛围音 — 石窟深处滴水回响
// ═══════════════════════════════════════════════════════════════════════════

export function playAmbientDrip() {
  const ac = getCtx()
  // 水滴主音
  const osc = ac.createOscillator()
  const g = ac.createGain()
  const freq = 1000 + Math.random() * 800
  osc.frequency.setValueAtTime(freq, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ac.currentTime + 0.2)
  g.gain.setValueAtTime(0.06, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5)
  osc.type = 'sine'
  osc.connect(g)
  g.connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.5)

  // 回响（延迟 0.25s，低频、低音量）
  const osc2 = ac.createOscillator()
  const g2 = ac.createGain()
  osc2.frequency.setValueAtTime(freq * 0.2, ac.currentTime + 0.25)
  g2.gain.setValueAtTime(0.02, ac.currentTime + 0.25)
  g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.9)
  osc2.type = 'sine'
  osc2.connect(g2)
  g2.connect(ac.destination)
  osc2.start(ac.currentTime + 0.25)
  osc2.stop(ac.currentTime + 0.9)
}

// ═══════════════════════════════════════════════════════════════════════════
// 音量控制
// ═══════════════════════════════════════════════════════════════════════════

export function setVolume(vol: number) {
  if (masterGain) {
    masterGain.gain.setValueAtTime(vol * 0.07, getCtx().currentTime)
  }
}

export function initAudio() {
  startBGM()
}

export function destroyAudio() {
  stopBGM()
  ctx?.close().catch(() => {})
  ctx = null
}
