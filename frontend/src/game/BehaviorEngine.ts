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
  turnDir: number   // –1…+1 (proportional, not binary)
  thrusting: boolean
  shouldFire: boolean
  boost: boolean
}

// Persistent per-frame state owned by the caller (MPGameLoop)
export interface BehaviorState {
  lockX:       number   // locked target position
  lockZ:       number
  lockAge:     number   // frames remaining on lock (0 = needs re-select)
  orbitDir:    1 | -1   // strafe orbit direction (flips when too close)
  patrolAngle: number   // current patrol heading target (radians)
}

export function makeBehaviorState(): BehaviorState {
  return { lockX: 0, lockZ: 0, lockAge: 0, orbitDir: 1, patrolAngle: 0 }
}

// ── helpers ────────────────────────────────────────────────────────────────────

function angleDiff(target: number, current: number): number {
  let d = target - current
  while (d >  Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

// Proportional turn: full speed for large angles, eases for small corrections
function proportionalTurn(diff: number, deadzone = 0.04, fullAt = 0.4): number {
  if (Math.abs(diff) < deadzone) return 0
  return Math.sign(diff) * Math.min(1, Math.abs(diff) / fullAt)
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

// ── main behavior function ─────────────────────────────────────────────────────
// state is a mutable object owned by the caller — updated each frame

export function applyBehavior(
  behavior: Behavior,
  px: number, pz: number,
  vx: number, vz: number,
  heading: number,
  enemies: EnemyInfo[],
  state: BehaviorState,
): BehaviorOutput {
  const none: BehaviorOutput = { turnDir: 0, thrusting: false, shouldFire: false, boost: false }
  if (!behavior?.mode || behavior.mode === 'idle') return none

  // ── target locking: hold target for 90 frames (~1.5 s), re-select on expire ──
  const LOCK_FRAMES = 90
  let target: EnemyInfo | null = null
  if (state.lockAge > 0) {
    // find the live enemy closest to the locked coords
    const candidate = enemies
      .filter(e => e.alive && e.hp > 0)
      .sort((a, b) =>
        Math.hypot(a.x - state.lockX, a.z - state.lockZ) -
        Math.hypot(b.x - state.lockX, b.z - state.lockZ)
      )[0] ?? null
    // accept lock if the enemy is still near the last-known position
    if (candidate && Math.hypot(candidate.x - state.lockX, candidate.z - state.lockZ) < 8) {
      target = candidate
      state.lockAge--
    } else {
      state.lockAge = 0  // lock broken, force re-select below
    }
  }
  if (!target) {
    target = selectTarget(enemies, px, pz, behavior.targetMode)
    if (!target) return none
    state.lockX   = target.x
    state.lockZ   = target.z
    state.lockAge = LOCK_FRAMES
  }
  // keep lock coords fresh so it follows a moving target
  state.lockX = target.x
  state.lockZ = target.z

  const dx   = target.x - px
  const dz   = target.z - pz
  const dist = Math.hypot(dx, dz)
  const angleToTarget = Math.atan2(dx, -dz)
  const diff = angleDiff(angleToTarget, heading)

  const tooClose  = dist < behavior.preferredDistance * 0.6
  const tooFar    = dist > behavior.preferredDistance * 1.5
  // adaptive fire cone: wider at close range, tighter at long range
  const fireCone  = Math.min(0.35, 0.12 + (behavior.aggression * 0.15) + (8 / Math.max(dist, 1)) * 0.08)
  const aligned   = Math.abs(diff) < fireCone
  const fireRange = 28 + behavior.aggression * 22

  let turnDir   = 0
  let thrusting = false
  let shouldFire = false
  let boost     = false

  const towardTurn = proportionalTurn(diff)
  const awayDiff   = angleDiff(angleToTarget + Math.PI, heading)
  const awayTurn   = proportionalTurn(awayDiff)

  switch (behavior.mode) {
    case 'chase': {
      turnDir    = towardTurn
      thrusting  = tooFar || !tooClose
      boost      = dist > behavior.preferredDistance * 2
      shouldFire = aligned && dist < fireRange
      break
    }

    case 'aggressive': {
      turnDir    = towardTurn
      thrusting  = true
      boost      = dist > behavior.preferredDistance
      shouldFire = Math.abs(diff) < fireCone * 1.5 && dist < fireRange * 1.3
      break
    }

    case 'strafe': {
      // orbit target; flip orbit direction when too close
      if (tooClose) state.orbitDir = (state.orbitDir === 1 ? -1 : 1) as 1 | -1
      const orbitAngle = angleToTarget + (Math.PI / 2) * state.orbitDir
      const orbitDiff  = angleDiff(orbitAngle, heading)
      turnDir    = tooClose ? awayTurn : proportionalTurn(orbitDiff, 0.04, 0.5)
      thrusting  = true
      shouldFire = dist < fireRange && Math.abs(diff) < 0.5
      break
    }

    case 'snipe': {
      turnDir = towardTurn
      if (tooClose) {
        // back away first
        turnDir   = awayTurn
        thrusting = true
        boost     = true
      } else if (tooFar) {
        thrusting = aligned
      }
      // only fire when truly aligned and within snipe range
      shouldFire = aligned && dist < behavior.preferredDistance * 1.2
      break
    }

    case 'retreat': {
      turnDir   = awayTurn
      thrusting = true
      boost     = dist < 25
      shouldFire = false
      break
    }

    case 'dodge': {
      // strafe perpendicular while keeping facing toward enemy to return fire
      const perpAngle = angleToTarget + (Math.PI / 2) * state.orbitDir
      const perpDiff  = angleDiff(perpAngle, heading)
      // blend: mostly perpendicular, slightly toward target
      const blended = perpDiff * 0.7 + diff * 0.3
      turnDir    = proportionalTurn(blended, 0.04, 0.5)
      thrusting  = true
      shouldFire = Math.abs(diff) < 0.4 && dist < 32
      break
    }

    case 'patrol': {
      // slow figure-eight patrol — attack opportunistically
      if (Math.abs(angleDiff(state.patrolAngle, heading)) < 0.05) {
        // reached waypoint, pick next angle offset by ~120°
        state.patrolAngle += (Math.PI * 2 / 3) + (Math.random() - 0.5) * 0.8
      }
      const patrolDiff = angleDiff(state.patrolAngle, heading)
      turnDir    = proportionalTurn(patrolDiff, 0.05, 0.6)
      thrusting  = true
      // attack if an enemy wanders close
      shouldFire = aligned && dist < 20 + behavior.aggression * 12
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
  // natural-language self description
  const speed      = Math.hypot(vx, vz)
  const headingDeg = Math.round(((heading * 180 / Math.PI) + 360) % 360)
  const hpPct      = Math.round((hp / maxHp) * 100)
  const speedLabel = speed < 0.05 ? 'stationary' : speed < 0.12 ? 'slow' : speed < 0.18 ? 'moderate' : 'fast'

  const self = {
    hp: `${hp}/${maxHp} (${hpPct}%)`,
    heading_deg: headingDeg,
    speed: speedLabel,
    position: `(${+px.toFixed(1)}, ${+pz.toFixed(1)})`,
  }

  if (aiTier < 2) return { self }

  const liveEnemies = [...remotePos.values()]
    .filter(p => p.alive)
    .map(p => {
      const d      = Math.hypot(p.x - px, p.z - pz)
      const hPct   = Math.round((p.hp / 150) * 100)
      const threat = d < 10 ? 'very close' : d < 20 ? 'nearby' : d < 35 ? 'medium range' : 'far'
      return {
        distance:  +d.toFixed(1),
        hp_pct:    hPct,
        hp_label:  hPct < 30 ? 'critically wounded' : hPct < 60 ? 'damaged' : 'healthy',
        range:     threat,
        ...(aiTier >= 3 ? { heading_deg: Math.round(((p.rot * 180 / Math.PI) + 360) % 360) } : {}),
      }
    })
    .filter(e => aiTier === 2 ? e.distance < 35 : true)
    .sort((a, b) => a.distance - b.distance)

  return { self, enemies: liveEnemies, enemy_count: liveEnemies.length }
}

export const BEHAVIOR_TTL_MS = 40_000

// ── client-side fallback ───────────────────────────────────────────────────────
export function localFallback(prompt: string): Behavior {
  const s   = prompt.toLowerCase()
  const has = (...w: string[]) => w.some(k => s.includes(k))
  const exp = Date.now() + BEHAVIOR_TTL_MS

  if (has('retreat', 'flee', 'escape', 'run', 'hide', 'back', 'away'))
    return { mode: 'retreat', targetMode: 'nearest', aggression: 0.2, preferredDistance: 28, description: 'Retreating from all threats [fallback]', expiresAt: exp }
  if (has('strafe', 'orbit', 'circle', 'flank', 'around'))
    return { mode: 'strafe', targetMode: 'nearest', aggression: 0.7, preferredDistance: 12, description: 'Orbiting and strafing [fallback]', expiresAt: exp }
  if (has('snipe', 'long range', 'distance', 'far', 'range', 'afar'))
    return { mode: 'snipe', targetMode: 'nearest', aggression: 0.6, preferredDistance: 22, description: 'Sniping from distance [fallback]', expiresAt: exp }
  if (has('dodge', 'evade', 'avoid', 'defensive', 'weave'))
    return { mode: 'dodge', targetMode: 'nearest', aggression: 0.5, preferredDistance: 12, description: 'Dodging and returning fire [fallback]', expiresAt: exp }
  if (has('patrol', 'wander', 'roam', 'guard', 'cruise'))
    return { mode: 'patrol', targetMode: 'nearest', aggression: 0.5, preferredDistance: 14, description: 'Patrolling the arena [fallback]', expiresAt: exp }
  if (has('weak', 'low hp', 'low health', 'wounded', 'finish', 'dying', 'almost dead'))
    return { mode: 'chase', targetMode: 'weakest', aggression: 0.9, preferredDistance: 8, description: 'Hunting the weakest target [fallback]', expiresAt: exp }
  if (has('strong', 'biggest', 'heavy', 'boss', 'tank', 'full hp', 'full health'))
    return { mode: 'chase', targetMode: 'strongest', aggression: 0.8, preferredDistance: 10, description: 'Engaging the strongest target [fallback]', expiresAt: exp }
  if (has('chase', 'hunt', 'follow', 'pursue', 'track'))
    return { mode: 'chase', targetMode: 'nearest', aggression: 0.8, preferredDistance: 8, description: 'Chasing the nearest target [fallback]', expiresAt: exp }
  return { mode: 'aggressive', targetMode: 'nearest', aggression: 0.85, preferredDistance: 8, description: 'Engaging nearest target aggressively [fallback]', expiresAt: exp }
}
