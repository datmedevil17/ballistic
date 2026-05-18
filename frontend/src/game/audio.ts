// Sound manager — laser.mp3 via HTML Audio pool, everything else Web Audio API.
// All functions wrapped in try/catch so audio errors never crash the game.

// ── laser pool (supports rapid overlapping shots) ──────────────────────────────
const LASER_POOL_SIZE = 8
const laserPool: HTMLAudioElement[] = Array.from({ length: LASER_POOL_SIZE }, () => {
  const a = new Audio('/laser.mp3')
  a.volume = 0.45
  return a
})
let laserPoolIdx = 0

// ── Web Audio context (for all other sounds) ────────────────────────────────────
let ctx: AudioContext | null = null
let engOsc: OscillatorNode | null = null
let engGain: GainNode | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext()
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    return ctx
  } catch {
    return null
  }
}

export function playLaser(): void {
  try {
    const el = laserPool[laserPoolIdx % LASER_POOL_SIZE]
    laserPoolIdx = (laserPoolIdx + 1) % LASER_POOL_SIZE
    el.currentTime = 0
    el.play().catch(() => {})
  } catch {}
}

export function playExplosion(): void {
  try {
    const c = getCtx(); if (!c) return
    const duration = 0.6
    const sampleRate = c.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = c.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = c.createBufferSource()
    source.buffer = buffer
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    const gain = c.createGain()
    source.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)
    const now = c.currentTime
    filter.frequency.setValueAtTime(1400, now)
    filter.frequency.linearRampToValueAtTime(70, now + duration)
    gain.gain.setValueAtTime(0.4, now)
    gain.gain.linearRampToValueAtTime(0, now + duration)
    source.start(now)
    source.stop(now + duration)
  } catch {}
}

export function playHit(): void {
  try {
    const c = getCtx(); if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sawtooth'
    const now = c.currentTime
    osc.frequency.setValueAtTime(240, now)
    osc.frequency.linearRampToValueAtTime(45, now + 0.18)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.18)
    osc.start(now)
    osc.stop(now + 0.18)
  } catch {}
}

export function playEnemyFire(): void {
  try {
    const c = getCtx(); if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.connect(gain)
    gain.connect(c.destination)
    osc.type = 'sawtooth'
    const now = c.currentTime
    osc.frequency.setValueAtTime(380, now)
    osc.frequency.linearRampToValueAtTime(120, now + 0.07)
    gain.gain.setValueAtTime(0.09, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.07)
    osc.start(now)
    osc.stop(now + 0.07)
  } catch {}
}

export function startEngine(): void {
  try {
    const c = getCtx(); if (!c) return
    if (engOsc) return // already running
    engOsc = c.createOscillator()
    engGain = c.createGain()
    engOsc.connect(engGain)
    engGain.connect(c.destination)
    engOsc.type = 'sawtooth'
    engOsc.frequency.setValueAtTime(50, c.currentTime)
    engGain.gain.setValueAtTime(0.01, c.currentTime)
    engOsc.start()
  } catch {}
}

export function updateEngine(thrusting: boolean, boosting: boolean): void {
  try {
    const c = getCtx(); if (!c || !engOsc || !engGain) return
    const now = c.currentTime
    const ramp = 0.07
    let targetGain: number
    let targetFreq: number
    if (boosting) {
      targetGain = 0.14
      targetFreq = 105
    } else if (thrusting) {
      targetGain = 0.07
      targetFreq = 62
    } else {
      targetGain = 0.018
      targetFreq = 48
    }
    engGain.gain.cancelScheduledValues(now)
    engGain.gain.setValueAtTime(engGain.gain.value, now)
    engGain.gain.linearRampToValueAtTime(targetGain, now + ramp)
    engOsc.frequency.cancelScheduledValues(now)
    engOsc.frequency.setValueAtTime(engOsc.frequency.value, now)
    engOsc.frequency.linearRampToValueAtTime(targetFreq, now + ramp)
  } catch {}
}

export function stopEngine(): void {
  try {
    const c = getCtx(); if (!c || !engGain || !engOsc) return
    const now = c.currentTime
    engGain.gain.cancelScheduledValues(now)
    engGain.gain.setValueAtTime(engGain.gain.value, now)
    engGain.gain.linearRampToValueAtTime(0, now + 0.15)
    const oscToStop = engOsc
    engOsc = null
    engGain = null
    setTimeout(() => {
      try { oscToStop.stop() } catch {}
    }, 200)
  } catch {}
}
