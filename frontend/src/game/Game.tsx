import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { Screen, GameState } from '../App'
import { SHIPS } from '../data/ships'

interface Props {
  gameState: GameState
  setScreen: (s: Screen) => void
}

// ── constants ──────────────────────────────────────────────────────────────────
const MAX_ENEMIES = 20
const MAX_LASERS = 64
const MAX_PARTICLES = 100
const PLAYER_HP = 150
const L_SPEED = 0.7
const L_LIFE = 120
const FIRE_CD = 16
const MAX_ENGAGERS = 5
const SPAWN_RADIUS = 60
const TURN_SPEED = 0.048
const BASE_THRUST = 0.009
const FRICTION = 0.94
const MAX_SPEED = 0.22
const BOOST_MULT = 1.9

// slot assignment: 10 Striker (0-9), 6 Dispatcher (10-15), 4 Omen (16-19) → 5:3:2
function slotModel(i: number) {
  if (i < 10) return 0 // Striker
  if (i < 16) return 1 // Dispatcher
  return 2              // Omen
}

const ENEMY_DEF = [
  { path: '/Striker.gltf',    type: 'scout',   hp: 24, speed: 0.085, dmg: 8,  fireCd: 52  },
  { path: '/Dispatcher.gltf', type: 'fighter', hp: 40, speed: 0.065, dmg: 13, fireCd: 88  },
  { path: '/Omen.gltf',       type: 'stealth', hp: 32, speed: 0.075, dmg: 10, fireCd: 68  },
]

// ── helpers ────────────────────────────────────────────────────────────────────
function autoScale(obj: THREE.Object3D, target = 1.5) {
  const box = new THREE.Box3().setFromObject(obj)
  const size = new THREE.Vector3(); box.getSize(size)
  const center = new THREE.Vector3(); box.getCenter(center)
  const s = target / Math.max(size.x, size.y, size.z, 0.001)
  obj.scale.setScalar(s)
  obj.position.sub(center.multiplyScalar(s))
}

// ── types ──────────────────────────────────────────────────────────────────────
interface EnemyState {
  active: boolean
  x: number; z: number; vx: number; vz: number
  hp: number; maxHp: number; modelIdx: number
  fireCd: number; engageCd: number
  mode: 'idle' | 'engage'
  orbitAngle: number
}

interface LaserState {
  active: boolean
  x: number; z: number; vx: number; vz: number
  life: number; isEnemy: boolean
}

interface Particle {
  active: boolean
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; maxLife: number
}

// ── EnemySlot ──────────────────────────────────────────────────────────────────
function EnemySlot({ scene, idx, stateRef }: {
  scene: THREE.Object3D
  idx: number
  stateRef: React.MutableRefObject<EnemyState[]>
}) {
  const g = useRef<THREE.Group>(null)
  const cloned = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    const grp = g.current; if (!grp) return
    autoScale(cloned, 1.4)
    grp.add(cloned)
    return () => { grp.remove(cloned) }
  }, [cloned])

  useFrame(() => {
    const grp = g.current; if (!grp) return
    const e = stateRef.current[idx]
    if (!e?.active) { grp.visible = false; return }
    grp.visible = true
    grp.position.set(e.x, 0, e.z)
    const vel = Math.sqrt(e.vx * e.vx + e.vz * e.vz)
    if (vel > 0.002) {
      const target = Math.atan2(e.vx, e.vz)
      let diff = target - grp.rotation.y
      if (diff > Math.PI)  diff -= Math.PI * 2
      if (diff < -Math.PI) diff += Math.PI * 2
      grp.rotation.y += diff * 0.12
    }
  })

  return <group ref={g} />
}

// ── EnemyPool ──────────────────────────────────────────────────────────────────
function EnemyPool({ stateRef }: { stateRef: React.MutableRefObject<EnemyState[]> }) {
  const s0 = useGLTF('/Striker.gltf').scene
  const s1 = useGLTF('/Dispatcher.gltf').scene
  const s2 = useGLTF('/Omen.gltf').scene
  const scenes = [s0, s1, s2]

  return (
    <>
      {Array.from({ length: MAX_ENEMIES }, (_, i) => (
        <EnemySlot key={i} scene={scenes[slotModel(i)]} idx={i} stateRef={stateRef} />
      ))}
    </>
  )
}

// ── PlayerShip ─────────────────────────────────────────────────────────────────
interface PlayerRef { x: number; z: number; vx: number; vz: number; heading: number }

function PlayerShip({ modelPath, playerRef, bankRef, boostRef }: {
  modelPath: string
  playerRef: React.MutableRefObject<PlayerRef>
  bankRef: React.MutableRefObject<number>
  boostRef: React.MutableRefObject<boolean>
}) {
  const { scene } = useGLTF(modelPath)
  const g = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    autoScale(c, 2.2)
    return c
  }, [scene])

  useEffect(() => {
    const grp = g.current; if (!grp) return
    grp.add(cloned)
    return () => { grp.remove(cloned) }
  }, [cloned])

  useFrame(({ clock }) => {
    const grp = g.current; if (!grp) return
    const p = playerRef.current
    grp.position.set(p.x, 0, p.z)

    // Rotate ship to face heading direction
    grp.rotation.y = Math.PI - p.heading
    // Roll/bank when turning (around the ship's forward axis)
    grp.rotation.z = bankRef.current * 0.5

    const t = clock.getElapsedTime()
    const boosting = boostRef.current
    const pulse = 0.85 + Math.sin(t * (boosting ? 30 : 18)) * 0.15

    if (coreRef.current) {
      const s = pulse * (boosting ? 1.5 : 1.0)
      coreRef.current.scale.setScalar(s)
    }
    if (haloRef.current) {
      const s = pulse * (boosting ? 2.0 : 1.0)
      haloRef.current.scale.setScalar(s)
      ;(haloRef.current.material as THREE.MeshBasicMaterial).opacity = boosting ? 0.5 : 0.28
    }
    if (lightRef.current) {
      lightRef.current.intensity = (boosting ? 4 : 2.2) + Math.sin(t * 22) * 0.6
      lightRef.current.color.set(boosting ? '#a78bfa' : '#06b6d4')
    }
  })

  return (
    <group ref={g}>
      {/* thruster at rear in model local space (model front is +Z, rear is -Z) */}
      <mesh ref={coreRef} position={[0, -0.1, -1.1]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshBasicMaterial color="#06b6d4" />
      </mesh>
      <mesh ref={haloRef} position={[0, -0.1, -1.1]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.28} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0, -1]} color="#06b6d4" intensity={2.2} distance={8} />
    </group>
  )
}

// ── LaserPool ──────────────────────────────────────────────────────────────────
function LaserPool({ stateRef }: { stateRef: React.MutableRefObject<LaserState[]> }) {
  const coreGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const glowGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.18, 0.18, 2.5, 6)
    g.rotateX(Math.PI / 2)
    return g
  }, [])

  const pCoreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x00ffff }), [])
  const pGlowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x0077ff, transparent: true, opacity: 0.25 }), [])
  const eCoreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xff2200 }), [])
  const eGlowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.25 }), [])

  const grpRefs = useRef<(THREE.Group | null)[]>(Array(MAX_LASERS).fill(null))

  useFrame(() => {
    for (let i = 0; i < MAX_LASERS; i++) {
      const grp = grpRefs.current[i]; if (!grp) continue
      const l = stateRef.current[i]
      if (!l?.active) { grp.visible = false; continue }
      grp.visible = true
      grp.position.set(l.x, 0, l.z)
      grp.rotation.y = Math.atan2(l.vx, l.vz)
    }
  })

  return (
    <>
      {Array.from({ length: MAX_LASERS }, (_, i) => {
        const isP = i < MAX_LASERS / 2
        return (
          <group key={i} ref={el => { grpRefs.current[i] = el }} visible={false}>
            <mesh geometry={coreGeo} material={isP ? pCoreMat : eCoreMat} />
            <mesh geometry={glowGeo} material={isP ? pGlowMat : eGlowMat} />
          </group>
        )
      })}
    </>
  )
}

// ── Particles ──────────────────────────────────────────────────────────────────
function ParticlePool({ stateRef }: { stateRef: React.MutableRefObject<Particle[]> }) {
  const refs = useRef<(THREE.Mesh | null)[]>(Array(MAX_PARTICLES).fill(null))

  useFrame(() => {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const m = refs.current[i]; const p = stateRef.current[i]
      if (!m) continue
      if (!p?.active) { m.visible = false; continue }
      m.visible = true
      m.position.set(p.x, p.y, p.z)
      m.scale.setScalar((p.life / p.maxLife) * 0.4)
      ;(m.material as THREE.MeshBasicMaterial).opacity = p.life / p.maxLife
    }
  })

  return (
    <>
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }} visible={false}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color="#ff8833" transparent />
        </mesh>
      ))}
    </>
  )
}

// ── Space ──────────────────────────────────────────────────────────────────────
function Space() {
  return (
    <>
      <Stars radius={250} depth={100} count={7000} factor={5} fade speed={0.3} />
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 30, 10]} intensity={0.6} color="#c0d8ff" />
    </>
  )
}

// ── GameLoop ───────────────────────────────────────────────────────────────────
interface GameRefs {
  enemies: React.MutableRefObject<EnemyState[]>
  lasers: React.MutableRefObject<LaserState[]>
  particles: React.MutableRefObject<Particle[]>
  player: React.MutableRefObject<PlayerRef>
  bank: React.MutableRefObject<number>
  boost: React.MutableRefObject<boolean>
  playerHp: React.MutableRefObject<number>
  score: React.MutableRefObject<number>
  kills: React.MutableRefObject<number>
  wave: React.MutableRefObject<number>
  keys: React.MutableRefObject<Set<string>>
  shake: React.MutableRefObject<number>
  camPos: React.MutableRefObject<THREE.Vector3>
  camLookAt: React.MutableRefObject<THREE.Vector3>
  fireCd: React.MutableRefObject<number>
  waveTimer: React.MutableRefObject<number>
  gameOver: React.MutableRefObject<boolean>
  resetSignal: React.MutableRefObject<number>
  lastReset: React.MutableRefObject<number>
  modelPath: string
  shipStats: { speed: number; damage: number; fireRate: number }
  onHudUpdate: (hp: number, score: number, kills: number, wave: number, ec: number, boost: boolean) => void
  onGameOver: (score: number, kills: number) => void
}

function spawnExplosion(parts: Particle[], x: number, z: number) {
  let n = 0
  for (let i = 0; i < MAX_PARTICLES && n < 14; i++) {
    if (!parts[i].active) {
      const a = Math.random() * Math.PI * 2
      const spd = 0.05 + Math.random() * 0.10
      const life = 28 + Math.random() * 20
      parts[i] = { active: true, x, y: 0.2, z, vx: Math.cos(a)*spd, vy: 0.03+Math.random()*0.06, vz: Math.sin(a)*spd, life, maxLife: life }
      n++
    }
  }
}

function spawnWave(enemies: EnemyState[], px: number, pz: number, wave: number) {
  const count = Math.min(4 + wave * 2, MAX_ENEMIES)
  let n = 0
  for (let i = 0; i < MAX_ENEMIES && n < count; i++) {
    if (!enemies[i].active) {
      const a = Math.random() * Math.PI * 2
      const def = ENEMY_DEF[slotModel(i)]
      enemies[i] = {
        active: true,
        x: px + Math.cos(a) * SPAWN_RADIUS,
        z: pz + Math.sin(a) * SPAWN_RADIUS,
        vx: 0, vz: 0,
        hp: def.hp + wave * 5,
        maxHp: def.hp + wave * 5,
        modelIdx: slotModel(i),
        fireCd: def.fireCd + n * 22,
        engageCd: n * 50,
        mode: 'idle',
        orbitAngle: a,
      }
      n++
    }
  }
}

function GameLoop(refs: GameRefs) {
  const { camera } = useThree()
  const hudCd = useRef(0)

  useFrame(() => {
    // ── reset ──────────────────────────────────────────────────────────────────
    if (refs.lastReset.current !== refs.resetSignal.current) {
      refs.lastReset.current = refs.resetSignal.current
      refs.player.current = { x: 0, z: 0, vx: 0, vz: 0, heading: 0 }
      refs.playerHp.current = PLAYER_HP
      refs.score.current = 0; refs.kills.current = 0
      refs.wave.current = 1; refs.waveTimer.current = 0
      refs.fireCd.current = 0; refs.gameOver.current = false; refs.shake.current = 0
      refs.enemies.current.forEach(e => { e.active = false })
      refs.lasers.current.forEach(l => { l.active = false })
      refs.particles.current.forEach(p => { p.active = false })
      refs.camPos.current.set(0, 13, 12)
      refs.camLookAt.current.set(0, 0, -3)
      spawnWave(refs.enemies.current, 0, 0, 1)
    }

    if (refs.gameOver.current) return

    const keys = refs.keys.current
    const p = refs.player.current
    const boosting = keys.has('ShiftLeft') || keys.has('ShiftRight')
    refs.boost.current = boosting

    // ── turning (A/D) ──────────────────────────────────────────────────────────
    let turnDir = 0
    if (keys.has('KeyA') || keys.has('ArrowLeft'))  { p.heading -= TURN_SPEED; turnDir = -1 }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { p.heading += TURN_SPEED; turnDir =  1 }
    // Rolling bank follows turn direction
    refs.bank.current = refs.bank.current * 0.84 + turnDir * 0.16

    // ── thrust (W/S along heading) ─────────────────────────────────────────────
    // heading=0 → forward is -Z; forward vector: (sin(heading), -cos(heading))
    const fwdX = Math.sin(p.heading)
    const fwdZ = -Math.cos(p.heading)
    const thrust = BASE_THRUST * (1 + refs.shipStats.speed * 0.1) * (boosting ? BOOST_MULT : 1)

    if (keys.has('KeyW') || keys.has('ArrowUp')) {
      p.vx += fwdX * thrust
      p.vz += fwdZ * thrust
    }
    if (keys.has('KeyS') || keys.has('ArrowDown')) {
      p.vx -= fwdX * thrust * 0.55
      p.vz -= fwdZ * thrust * 0.55
    }

    // Space friction + speed cap
    p.vx *= FRICTION; p.vz *= FRICTION
    const spd = Math.sqrt(p.vx * p.vx + p.vz * p.vz)
    const cap = MAX_SPEED * (boosting ? BOOST_MULT : 1)
    if (spd > cap) { p.vx = p.vx / spd * cap; p.vz = p.vz / spd * cap }

    p.x += p.vx; p.z += p.vz

    // ── player fire (ENTER) ────────────────────────────────────────────────────
    refs.fireCd.current = Math.max(0, refs.fireCd.current - 1)
    const cd = Math.max(6, Math.floor(FIRE_CD * (1 - refs.shipStats.fireRate * 0.055)))
    if (keys.has('Enter') && refs.fireCd.current <= 0) {
      refs.fireCd.current = cd
      for (let i = 0; i < MAX_LASERS / 2; i++) {
        if (!refs.lasers.current[i].active) {
          refs.lasers.current[i] = {
            active: true,
            x: p.x + fwdX * 1.5,
            z: p.z + fwdZ * 1.5,
            vx: fwdX * L_SPEED + p.vx,
            vz: fwdZ * L_SPEED + p.vz,
            life: L_LIFE, isEnemy: false,
          }
          break
        }
      }
    }

    // ── lasers ─────────────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_LASERS; i++) {
      const l = refs.lasers.current[i]
      if (!l.active) continue
      l.x += l.vx; l.z += l.vz; l.life--
      if (l.life <= 0) { l.active = false; continue }

      if (!l.isEnemy) {
        for (let j = 0; j < MAX_ENEMIES; j++) {
          const e = refs.enemies.current[j]; if (!e.active) continue
          const dx = l.x - e.x, dz = l.z - e.z
          if (dx*dx + dz*dz < 2.5) {
            e.hp -= 10 + refs.shipStats.damage * 1.3
            l.active = false
            if (e.hp <= 0) {
              e.active = false
              spawnExplosion(refs.particles.current, e.x, e.z)
              refs.kills.current++
              refs.score.current += e.modelIdx === 1 ? 200 : e.modelIdx === 2 ? 150 : 100
            }
            break
          }
        }
      } else {
        const dx = l.x - p.x, dz = l.z - p.z
        if (dx*dx + dz*dz < 2.0) {
          const def = ENEMY_DEF[0]
          refs.playerHp.current -= def.dmg
          refs.shake.current = 9
          l.active = false
          if (refs.playerHp.current <= 0) {
            refs.playerHp.current = 0
            refs.gameOver.current = true
            refs.onGameOver(refs.score.current, refs.kills.current)
          }
        }
      }
    }

    // ── enemy AI ───────────────────────────────────────────────────────────────
    let engagers = 0
    for (let j = 0; j < MAX_ENEMIES; j++) {
      if (refs.enemies.current[j].active && refs.enemies.current[j].mode === 'engage') engagers++
    }

    for (let j = 0; j < MAX_ENEMIES; j++) {
      const e = refs.enemies.current[j]; if (!e.active) continue
      const def = ENEMY_DEF[e.modelIdx]
      const dx = p.x - e.x, dz = p.z - e.z
      const dist = Math.sqrt(dx*dx + dz*dz)
      const nx = dx / Math.max(dist, 0.001)
      const nz = dz / Math.max(dist, 0.001)

      if (e.engageCd > 0) {
        e.engageCd--
        // idle: slow orbit at range
        e.orbitAngle += 0.007
        const tx = p.x + Math.cos(e.orbitAngle) * 32
        const tz = p.z + Math.sin(e.orbitAngle) * 32
        e.vx += (tx - e.x) * 0.003; e.vz += (tz - e.z) * 0.003
        e.vx *= 0.91; e.vz *= 0.91
        e.x += e.vx; e.z += e.vz
        continue
      }

      if (e.mode === 'idle') {
        if (engagers < MAX_ENGAGERS) { e.mode = 'engage'; engagers++ }
        else {
          e.orbitAngle += 0.005
          const r = 24 + (j % 5) * 4
          const tx = p.x + Math.cos(e.orbitAngle) * r
          const tz = p.z + Math.sin(e.orbitAngle) * r
          e.vx += (tx - e.x) * 0.004; e.vz += (tz - e.z) * 0.004
          e.vx *= 0.90; e.vz *= 0.90
          e.x += e.vx; e.z += e.vz
          continue
        }
      }

      // engage
      if (def.type === 'scout') {
        // Striker: orbit and strafe
        if (dist > 13) { e.vx = nx * def.speed; e.vz = nz * def.speed }
        else {
          e.orbitAngle += 0.028
          const tx = p.x + Math.cos(e.orbitAngle) * 9
          const tz = p.z + Math.sin(e.orbitAngle) * 9
          e.vx = (tx - e.x) * 0.07; e.vz = (tz - e.z) * 0.07
        }
      } else if (def.type === 'fighter') {
        // Dispatcher: approach then strafe sideways
        if (dist > 15) { e.vx = nx * def.speed; e.vz = nz * def.speed }
        else if (dist > 6) {
          const side = (j % 2 === 0 ? 1 : -1)
          e.vx = (-nz * side + nx * 0.4) * def.speed
          e.vz = ( nx * side + nz * 0.4) * def.speed
        } else { e.vx = -nx * def.speed; e.vz = -nz * def.speed }
      } else {
        // Omen: fast approach, retreat after closing
        if (dist > 8) { e.vx = nx * def.speed; e.vz = nz * def.speed }
        else { e.vx = -nx * def.speed * 0.9; e.vz = -nz * def.speed * 0.9 }
      }

      e.x += e.vx; e.z += e.vz

      // ram
      if (dist < 2.4) {
        refs.playerHp.current -= 0.5; refs.shake.current = Math.max(refs.shake.current, 5)
        if (refs.playerHp.current <= 0) {
          refs.playerHp.current = 0; refs.gameOver.current = true
          refs.onGameOver(refs.score.current, refs.kills.current)
        }
      }

      // fire — only when facing player within ~48° and within range
      e.fireCd--
      if (e.fireCd <= 0 && dist > 4 && dist < 30) {
        const vel = Math.sqrt(e.vx*e.vx + e.vz*e.vz)
        const canFire = vel < 0.002 || (e.vx/vel)*nx + (e.vz/vel)*nz > 0.60
        if (canFire) {
          e.fireCd = def.fireCd
          for (let i = MAX_LASERS / 2; i < MAX_LASERS; i++) {
            if (!refs.lasers.current[i].active) {
              refs.lasers.current[i] = {
                active: true,
                x: e.x + nx * 1.5, z: e.z + nz * 1.5,
                vx: nx * L_SPEED * 0.82, vz: nz * L_SPEED * 0.82,
                life: L_LIFE, isEnemy: true,
              }
              break
            }
          }
        } else { e.fireCd = 12 }
      }
    }

    // ── enemy–enemy separation (prevent overlapping) ───────────────────────────
    const SEP_RADIUS = 3.2
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const a = refs.enemies.current[i]; if (!a.active) continue
      for (let j = i + 1; j < MAX_ENEMIES; j++) {
        const b = refs.enemies.current[j]; if (!b.active) continue
        const dx = a.x - b.x, dz = a.z - b.z
        const dist2 = dx * dx + dz * dz
        if (dist2 < SEP_RADIUS * SEP_RADIUS && dist2 > 0.0001) {
          const dist = Math.sqrt(dist2)
          const overlap = (SEP_RADIUS - dist) / dist  // normalized push magnitude
          const fx = dx * overlap * 0.04
          const fz = dz * overlap * 0.04
          a.vx += fx; a.vz += fz
          b.vx -= fx; b.vz -= fz
          // also directly separate positions to avoid tunneling
          const half = (SEP_RADIUS - dist) * 0.5
          a.x += (dx / dist) * half * 0.3
          a.z += (dz / dist) * half * 0.3
          b.x -= (dx / dist) * half * 0.3
          b.z -= (dz / dist) * half * 0.3
        }
      }
    }

    // ── particles ──────────────────────────────────────────────────────────────
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const pt = refs.particles.current[i]; if (!pt.active) continue
      pt.x += pt.vx; pt.y += pt.vy; pt.z += pt.vz
      pt.vy -= 0.001; pt.life--
      if (pt.life <= 0) pt.active = false
    }

    // ── wave ───────────────────────────────────────────────────────────────────
    const alive = refs.enemies.current.filter(e => e.active).length
    refs.waveTimer.current++
    if (alive === 0 && refs.waveTimer.current > 90) {
      refs.wave.current++; refs.waveTimer.current = 0
      spawnWave(refs.enemies.current, p.x, p.z, refs.wave.current)
    }

    // ── camera: chase behind ship based on heading ─────────────────────────────
    refs.shake.current *= 0.87
    const sx = (Math.random() - 0.5) * refs.shake.current * 0.05
    const sz = (Math.random() - 0.5) * refs.shake.current * 0.05

    // Behind direction = opposite of forward
    const behindX = -fwdX * 13
    const behindZ = -fwdZ * 13

    const targetCam = new THREE.Vector3(
      p.x + behindX + p.vx * 2 + sx,
      12,
      p.z + behindZ + p.vz * 2 + sz
    )
    refs.camPos.current.lerp(targetCam, 0.08)
    camera.position.copy(refs.camPos.current)

    // Look slightly ahead of ship
    const targetLook = new THREE.Vector3(
      p.x + fwdX * 4 + p.vx * 3,
      0,
      p.z + fwdZ * 4 + p.vz * 3
    )
    refs.camLookAt.current.lerp(targetLook, 0.1)
    camera.lookAt(refs.camLookAt.current)

    // ── HUD ────────────────────────────────────────────────────────────────────
    hudCd.current++
    if (hudCd.current >= 5) {
      hudCd.current = 0
      refs.onHudUpdate(refs.playerHp.current, refs.score.current, refs.kills.current, refs.wave.current, alive, boosting)
    }
  })

  return null
}

// ── HUD ────────────────────────────────────────────────────────────────────────
function HUD({ hp, score, kills, wave, enemyCount, boosting, onBack }: {
  hp: number; score: number; kills: number; wave: number; enemyCount: number; boosting: boolean; onBack: () => void
}) {
  const hpPct = Math.max(0, (hp / PLAYER_HP) * 100)
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {hpPct < 25 && (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(220,38,38,0.4) 100%)', animation: 'hex-pulse 0.9s ease-in-out infinite' }} />
      )}

      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4">
        <button className="pointer-events-auto text-[10px] tracking-widest flex items-center gap-1.5 transition-colors"
          style={{ fontFamily: 'Orbitron', color: '#ffffff35' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#06b6d4' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#ffffff35' }}
          onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          RETREAT
        </button>

        <div className="flex gap-5 text-[10px] tracking-widest items-center" style={{ fontFamily: 'Orbitron' }}>
          <span style={{ color: '#f59e0b' }}>WAVE {wave}</span>
          <span style={{ color: '#ffffff45' }}>BOGEYS {enemyCount}</span>
          <span style={{ color: '#06b6d4' }}>KILLS {kills}</span>
          {boosting && <span style={{ color: '#a78bfa', animation: 'hex-pulse 0.4s ease-in-out infinite' }}>⚡ BOOST</span>}
        </div>

        <div className="text-right">
          <div className="text-[9px] tracking-widest" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>SCORE</div>
          <div className="text-xl font-black" style={{ fontFamily: 'Orbitron', color: '#8b5cf6' }}>{score.toLocaleString()}</div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="text-[8px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#ffffff22' }}>HULL INTEGRITY</div>
        <div className="w-56 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all duration-150"
            style={{ width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 8px ${hpColor}` }} />
        </div>
        <div className="text-[9px]" style={{ fontFamily: 'Orbitron', color: hpColor }}>{Math.ceil(hp)} / {PLAYER_HP}</div>
      </div>

      <div className="absolute bottom-6 right-5 text-right text-[8px] tracking-wider leading-relaxed"
        style={{ fontFamily: 'Orbitron', color: '#ffffff15' }}>
        A/D · TURN &nbsp; W/S · THRUST<br />
        SHIFT · BOOST &nbsp; ENTER · FIRE
      </div>
    </div>
  )
}

// ── GameOver ───────────────────────────────────────────────────────────────────
function GameOverScreen({ score, kills, onRetry, onMenu }: {
  score: number; kills: number; onRetry: () => void; onMenu: () => void
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20, background: 'rgba(2,4,8,0.88)' }}>
      <div className="flex flex-col items-center gap-7" style={{ animation: 'appear 0.5s ease forwards' }}>
        <div className="text-[10px] tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#ef4444' }}>MISSION FAILED</div>
        <h1 className="text-5xl font-black tracking-[0.2em]"
          style={{ fontFamily: 'Orbitron', background: 'linear-gradient(135deg, #ef4444, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          DESTROYED
        </h1>
        <div className="flex gap-10 text-center">
          <div>
            <div className="text-[9px] tracking-widest mb-1" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>FINAL SCORE</div>
            <div className="text-2xl font-black" style={{ fontFamily: 'Orbitron', color: '#8b5cf6' }}>{score.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] tracking-widest mb-1" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>KILLS</div>
            <div className="text-2xl font-black" style={{ fontFamily: 'Orbitron', color: '#06b6d4' }}>{kills}</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={onRetry} className="px-8 py-3 rounded text-sm tracking-widest font-bold"
            style={{ fontFamily: 'Orbitron', background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', color: '#020408' }}>RETRY</button>
          <button onClick={onMenu} className="px-8 py-3 rounded text-sm tracking-widest"
            style={{ fontFamily: 'Orbitron', color: '#ffffff50', border: '1px solid rgba(255,255,255,0.15)' }}>MAIN MENU</button>
        </div>
      </div>
    </div>
  )
}

// ── Scene ──────────────────────────────────────────────────────────────────────
function Scene(props: GameRefs) {
  return (
    <>
      <Space />
      <PlayerShip modelPath={props.modelPath} playerRef={props.player} bankRef={props.bank} boostRef={props.boost} />
      <EnemyPool stateRef={props.enemies} />
      <LaserPool stateRef={props.lasers} />
      <ParticlePool stateRef={props.particles} />
      <GameLoop {...props} />
    </>
  )
}

// ── Game ───────────────────────────────────────────────────────────────────────
export default function Game({ gameState, setScreen }: Props) {
  const ship = SHIPS.find(s => s.id === gameState.selectedShipId) ?? SHIPS[0]

  const [hud, setHud] = useState({ hp: PLAYER_HP, score: 0, kills: 0, wave: 1, enemyCount: 0, boosting: false })
  const [gameOver, setGameOver] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalKills, setFinalKills] = useState(0)

  const keys   = useRef<Set<string>>(new Set())
  const resetSignal = useRef(0)
  const lastReset   = useRef(-1)

  const enemies   = useRef<EnemyState[]>(Array.from({ length: MAX_ENEMIES }, () => ({ active: false, x:0,z:0,vx:0,vz:0,hp:0,maxHp:0,modelIdx:0,fireCd:0,engageCd:0,mode:'idle' as const,orbitAngle:0 })))
  const lasers    = useRef<LaserState[]>(Array.from({ length: MAX_LASERS }, () => ({ active:false,x:0,z:0,vx:0,vz:0,life:0,isEnemy:false })))
  const particles = useRef<Particle[]>(Array.from({ length: MAX_PARTICLES }, () => ({ active:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,maxLife:1 })))
  const player    = useRef<PlayerRef>({ x:0, z:0, vx:0, vz:0, heading:0 })
  const bank      = useRef(0)
  const boost     = useRef(false)
  const playerHp  = useRef(PLAYER_HP)
  const score     = useRef(0)
  const kills     = useRef(0)
  const wave      = useRef(1)
  const shake     = useRef(0)
  const camPos    = useRef(new THREE.Vector3(0, 12, 13))
  const camLookAt = useRef(new THREE.Vector3(0, 0, -3))
  const fireCd    = useRef(0)
  const waveTimer = useRef(0)
  const gameOverRef = useRef(false)

  const onHudUpdate = useCallback((hp: number, sc: number, kl: number, wv: number, ec: number, boosting: boolean) => {
    setHud({ hp, score: sc, kills: kl, wave: wv, enemyCount: ec, boosting })
  }, [])

  const onGameOver = useCallback((sc: number, kl: number) => {
    setFinalScore(sc); setFinalKills(kl); setGameOver(true)
  }, [])

  const handleRetry = () => { setGameOver(false); resetSignal.current++ }

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])

  const gameRefs: GameRefs = {
    enemies, lasers, particles, player, bank, boost, playerHp, score, kills, wave,
    keys, shake, camPos, camLookAt, fireCd, waveTimer, gameOver: gameOverRef,
    resetSignal, lastReset,
    modelPath: ship.modelPath,
    shipStats: { speed: ship.stats.speed, damage: ship.stats.damage, fireRate: ship.stats.fireRate },
    onHudUpdate, onGameOver,
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020408]">
      <Canvas camera={{ position: [0, 12, 13], fov: 65 }} gl={{ antialias: true }}>
        <Scene {...gameRefs} />
      </Canvas>
      <HUD {...hud} onBack={() => setScreen('game_mode_select')} />
      {gameOver && <GameOverScreen score={finalScore} kills={finalKills} onRetry={handleRetry} onMenu={() => setScreen('menu')} />}
    </div>
  )
}
