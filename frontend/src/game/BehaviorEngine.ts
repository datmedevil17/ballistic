export type BehaviorMode =
  | 'idle' | 'chase' | 'strafe' | 'aggressive'
  | 'retreat' | 'snipe' | 'dodge' | 'patrol'

export type TargetMode = 'nearest' | 'weakest' | 'strongest' | 'random'

export interface Behavior {
  mode: BehaviorMode
  targetMode: TargetMode
  aggression: number        // 0–1
  preferredDistance: number // 5–30
  description: string
  expiresAt: number         // Date.now() ms — Infinity for idle
}

export const DEFAULT_BEHAVIOR: Behavior = {
  mode: 'idle',
  targetMode: 'nearest',
  aggression: 0.5,
  preferredDistance: 12,
  description: 'Awaiting orders...',
  expiresAt: Infinity,
}

export interface EnemyInfo {
  x: number; z: number
  hp: number; maxHp: number
  alive: boolean
}

export interface BehaviorOutput {
  turnDir: number   // –1 | 0 | +1
  thrusting: boolean
  shouldFire: boolean
  boost: boolean
}

function angleDiff(target: number, current: number): number {
  let d = target - current
  while (d >  Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function selectTarget(
  enemies: EnemyInfo[],
  px: number, pz: number,
  mode: TargetMode,
): EnemyInfo | null {
  const live = enemies.filter(e => e.alive && e.hp > 0)
  if (!live.length) return null

  switch (mode) {
    case 'nearest':
      return live.reduce((b, e) =>
        Math.hypot(e.x - px, e.z - pz) < Math.hypot(b.x - px, b.z - pz) ? e : b)
    case 'weakest':
      return live.reduce((b, e) => (e.hp / e.maxHp) < (b.hp / b.maxHp) ? e : b)
    case 'strongest':
      return live.reduce((b, e) => e.hp > b.hp ? e : b)
    case 'random':
      return live[Math.floor(Math.random() * live.length)]
  }
}

export function applyBehavior(
  behavior: Behavior,
  px: number, pz: number,
  vx: number, vz: number,
  heading: number,
  enemies: EnemyInfo[],
): BehaviorOutput {
  const none: BehaviorOutput = { turnDir: 0, thrusting: false, shouldFire: false, boost: false }
  if (behavior.mode === 'idle') return none

  const t = selectTarget(enemies, px, pz, behavior.targetMode)
  if (!t) return none

  const dx = t.x - px
  const dz = t.z - pz
  const dist = Math.hypot(dx, dz)
  const angle = Math.atan2(dx, -dz)
  const diff  = angleDiff(angle, heading)

  const aligned   = Math.abs(diff) < 0.18
  const tooClose  = dist < behavior.preferredDistance * 0.6
  const fireRange = 28 + behavior.aggression * 22

  let turnDir   = 0
  let thrusting = false
  let shouldFire = false
  let boost     = false

  const turnSign = diff > 0 ? 1 : -1
  const awaySign = angleDiff(angle + Math.PI, heading) > 0 ? 1 : -1

  switch (behavior.mode) {
    case 'chase': {
      turnDir   = turnSign
      thrusting = !tooClose
      shouldFire = aligned && dist < fireRange
      break
    }
    case 'aggressive': {
      turnDir   = turnSign
      thrusting = true
      boost     = dist > behavior.preferredDistance
      shouldFire = Math.abs(diff) < 0.3 && dist < fireRange * 1.3
      break
    }
    case 'strafe': {
      const orbitDiff = angleDiff(angle + Math.PI / 2, heading)
      turnDir   = tooClose ? awaySign : (orbitDiff > 0 ? 1 : -1)
      thrusting = true
      shouldFire = dist < fireRange
      break
    }
    case 'snipe': {
      turnDir = turnSign
      if (tooClose) {
        turnDir   = awaySign
        thrusting = true
      } else if (dist > behavior.preferredDistance) {
        thrusting = aligned
      }
      shouldFire = aligned && dist < behavior.preferredDistance * 1.3
      break
    }
    case 'retreat': {
      turnDir   = awaySign
      thrusting = true
      boost     = dist < 20
      shouldFire = false
      break
    }
    case 'dodge': {
      const perpDiff = angleDiff(angle + Math.PI / 2, heading)
      turnDir   = perpDiff > 0 ? 1 : -1
      thrusting = true
      shouldFire = Math.abs(diff) < 0.35 && dist < 30
      break
    }
    case 'patrol': {
      const wander = (Date.now() / 4000) % (Math.PI * 2)
      const wanderDiff = angleDiff(wander, heading)
      turnDir   = wanderDiff > 0 ? 1 : -1
      thrusting = true
      shouldFire = aligned && dist < 22
      break
    }
  }

  return { turnDir, thrusting, shouldFire, boost }
}

// ── game context builder ───────────────────────────────────────────────────────
export function buildGameContext(
  px: number, pz: number,
  vx: number, vz: number,
  heading: number,
  hp: number,
  maxHp: number,
  aiTier: number,
  remotePos: Map<string, { x: number; z: number; rot: number; hp: number; alive: boolean }>,
): object {
  const self = {
    x: +px.toFixed(1), z: +pz.toFixed(1),
    hp, max_hp: maxHp,
    heading_deg: Math.round(heading * 180 / Math.PI),
    speed: +Math.hypot(vx, vz).toFixed(2),
  }
  if (aiTier < 2) return { self }

  const enemies = [...remotePos.values()]
    .filter(p => p.alive)
    .map(p => ({
      x: +p.x.toFixed(1), z: +p.z.toFixed(1),
      hp: p.hp,
      distance: +Math.hypot(p.x - px, p.z - pz).toFixed(1),
      ...(aiTier >= 3 ? { rot_deg: Math.round(p.rot * 180 / Math.PI) } : {}),
    }))
    .filter(e => aiTier === 2 ? e.distance < 30 : true)
    .sort((a, b) => a.distance - b.distance)

  return { self, enemies }
}

export const BEHAVIOR_TTL_MS = 40_000

// ── client-side fallback (when API is unavailable) ────────────────────────────
export function localFallback(prompt: string): Behavior {
  const s = prompt.toLowerCase()
  const has = (...w: string[]) => w.some(k => s.includes(k))
  const exp = Date.now() + BEHAVIOR_TTL_MS

  if (has('retreat', 'flee', 'escape', 'run', 'hide', 'back'))
    return { mode: 'retreat', targetMode: 'nearest', aggression: 0.2, preferredDistance: 25, description: 'Retreating from all threats [fallback]', expiresAt: exp }
  if (has('strafe', 'orbit', 'circle', 'flank'))
    return { mode: 'strafe', targetMode: 'nearest', aggression: 0.7, preferredDistance: 12, description: 'Orbiting and strafing [fallback]', expiresAt: exp }
  if (has('snipe', 'long range', 'distance', 'far away', 'range'))
    return { mode: 'snipe', targetMode: 'nearest', aggression: 0.6, preferredDistance: 20, description: 'Sniping from distance [fallback]', expiresAt: exp }
  if (has('dodge', 'evade', 'avoid', 'defensive'))
    return { mode: 'dodge', targetMode: 'nearest', aggression: 0.5, preferredDistance: 12, description: 'Dodging and returning fire [fallback]', expiresAt: exp }
  if (has('patrol', 'wander', 'roam', 'guard'))
    return { mode: 'patrol', targetMode: 'nearest', aggression: 0.5, preferredDistance: 12, description: 'Patrolling the arena [fallback]', expiresAt: exp }
  if (has('weak', 'low hp', 'low health', 'wounded', 'finish', 'dying'))
    return { mode: 'chase', targetMode: 'weakest', aggression: 0.9, preferredDistance: 8, description: 'Hunting the weakest target [fallback]', expiresAt: exp }
  if (has('strong', 'biggest', 'heavy', 'boss', 'tank'))
    return { mode: 'chase', targetMode: 'strongest', aggression: 0.8, preferredDistance: 10, description: 'Engaging the strongest target [fallback]', expiresAt: exp }
  return { mode: 'aggressive', targetMode: 'nearest', aggression: 0.85, preferredDistance: 8, description: 'Engaging nearest target aggressively [fallback]', expiresAt: exp }
}
