import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Screen, GameState } from '../App'
import { SHIPS } from '../data/ships'
import {
  MAX_LASERS, MAX_PARTICLES, PLAYER_HP, L_SPEED, L_LIFE,
  TURN_SPEED, BASE_THRUST, FRICTION, MAX_SPEED, BOOST_MULT,
  autoScale, PlayerShip, LaserPool, ParticlePool, Space, spawnExplosion,
} from './Game'
import type { PlayerRef, LaserState, Particle } from './Game'
import { playLaser, playExplosion, playHit, startEngine, updateEngine, stopEngine } from './audio'
import {
  DEFAULT_BEHAVIOR, applyBehavior, buildGameContext, localFallback, BEHAVIOR_TTL_MS,
  makeBehaviorState,
} from './BehaviorEngine'
import type { Behavior, EnemyInfo, BehaviorState } from './BehaviorEngine'
import PromptSidebar from './PromptSidebar'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
const FIRE_CD = 16
const SEND_EVERY = 3

interface RemoteInfo { name: string; modelPath: string }
interface RemotePos  { x: number; z: number; rot: number; hp: number; alive: boolean }
interface RankEntry  { rank: number; id: string; name: string; kills: number; deaths: number; alive: boolean }
interface KillEntry  { id: number; killer: string; victim: string }

// ── RemoteShip ─────────────────────────────────────────────────────────────────
function RemoteShip({ playerId, modelPath, posRef }: {
  playerId: string
  modelPath: string
  posRef: React.MutableRefObject<Map<string, RemotePos>>
}) {
  const { scene } = useGLTF(modelPath)
  const g = useRef<THREE.Group>(null)
  const cloned = useMemo(() => { const c = scene.clone(true); autoScale(c, 5.0); return c }, [scene])

  useEffect(() => {
    const grp = g.current; if (!grp) return
    grp.add(cloned)
    return () => { grp.remove(cloned) }
  }, [cloned])

  useFrame(() => {
    const grp = g.current; if (!grp) return
    const p = posRef.current.get(playerId)
    if (!p) { grp.visible = false; return }
    grp.visible = p.alive
    grp.position.set(p.x, 0, p.z)
    grp.rotation.y = Math.PI - p.rot
  })

  return (
    <group ref={g}>
      <mesh position={[0, -0.1, -1.1]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial color="#ff4444" />
      </mesh>
    </group>
  )
}

// ── MPGameLoop ─────────────────────────────────────────────────────────────────
interface LoopProps {
  wsRef:                 React.MutableRefObject<WebSocket | null>
  playerRef:             React.MutableRefObject<PlayerRef>
  playerHpRef:           React.MutableRefObject<number>
  lasersRef:             React.MutableRefObject<LaserState[]>
  particlesRef:          React.MutableRefObject<Particle[]>
  bankRef:               React.MutableRefObject<number>
  boostRef:              React.MutableRefObject<boolean>
  shakeRef:              React.MutableRefObject<number>
  fireCdRef:             React.MutableRefObject<number>
  deadRef:               React.MutableRefObject<boolean>
  remotePos:             React.MutableRefObject<Map<string, RemotePos>>
  behaviorRef:           React.MutableRefObject<Behavior>
  spawnProtectedUntilRef: React.MutableRefObject<number>
  shipStats:             { speed: number; damage: number; fireRate: number }
  onHud:                 (hp: number, boosting: boolean) => void
}

function MPGameLoop(p: LoopProps) {
  const { camera } = useThree()
  const hudCd           = useRef(0)
  const sendCd          = useRef(0)
  const behaviorStateRef = useRef<BehaviorState>(makeBehaviorState())
  const camPos  = useRef(new THREE.Vector3(0, 13, 12))
  const camLook = useRef(new THREE.Vector3(0, 0, -3))
  const tCam   = useRef(new THREE.Vector3())
  const tLook  = useRef(new THREE.Vector3())

  useEffect(() => {
    startEngine()
    return () => stopEngine()
  }, [])

  useFrame(() => {
    if (p.deadRef.current) return

    const pl = p.playerRef.current

    // build enemy list from remote players
    const enemies: EnemyInfo[] = [...p.remotePos.current.values()].map(r => ({
      x: r.x, z: r.z, hp: r.hp, maxHp: PLAYER_HP, alive: r.alive,
    }))

    // behavior engine drives all inputs
    const { turnDir, thrusting, shouldFire, boost } = applyBehavior(
      p.behaviorRef.current,
      pl.x, pl.z, pl.vx, pl.vz, pl.heading,
      enemies,
      behaviorStateRef.current,
    )
    p.boostRef.current = boost
    updateEngine(thrusting, boost)

    // turning
    pl.heading += turnDir * TURN_SPEED
    p.bankRef.current = p.bankRef.current * 0.84 + turnDir * 0.16

    // thrust
    const fwdX = Math.sin(pl.heading)
    const fwdZ = -Math.cos(pl.heading)
    const thrust = BASE_THRUST * (1 + p.shipStats.speed * 0.1) * (boost ? BOOST_MULT : 1)
    if (thrusting) { pl.vx += fwdX * thrust; pl.vz += fwdZ * thrust }

    pl.vx *= FRICTION; pl.vz *= FRICTION
    const spd = Math.sqrt(pl.vx * pl.vx + pl.vz * pl.vz)
    const cap = MAX_SPEED * (boost ? BOOST_MULT : 1)
    if (spd > cap) { pl.vx = pl.vx / spd * cap; pl.vz = pl.vz / spd * cap }
    pl.x += pl.vx; pl.z += pl.vz

    // fire
    p.fireCdRef.current = Math.max(0, p.fireCdRef.current - 1)
    const cd = Math.max(6, Math.floor(FIRE_CD * (1 - p.shipStats.fireRate * 0.055)))
    if (shouldFire && p.fireCdRef.current <= 0) {
      p.fireCdRef.current = cd
      for (let i = 0; i < MAX_LASERS / 2; i++) {
        if (!p.lasersRef.current[i].active) {
          const lx = pl.x + fwdX * 1.5, lz = pl.z + fwdZ * 1.5
          const lvx = fwdX * L_SPEED + pl.vx, lvz = fwdZ * L_SPEED + pl.vz
          p.lasersRef.current[i] = { active: true, x: lx, z: lz, vx: lvx, vz: lvz, life: L_LIFE, isEnemy: false }
          p.wsRef.current?.send(JSON.stringify({ type: 'shoot', payload: { x: lx, z: lz, vx: lvx, vz: lvz } }))
          playLaser()
          break
        }
      }
    }

    // move lasers + hit detection
    const dmg = Math.floor(10 + p.shipStats.damage * 1.3)
    for (let i = 0; i < MAX_LASERS; i++) {
      const l = p.lasersRef.current[i]; if (!l.active) continue
      l.x += l.vx; l.z += l.vz; l.life--
      if (l.life <= 0) { l.active = false; continue }

      if (!l.isEnemy) {
        for (const [id, pos] of p.remotePos.current) {
          if (!pos.alive) continue
          const dx = l.x - pos.x, dz = l.z - pos.z
          if (dx * dx + dz * dz < 2.5) {
            l.active = false
            spawnExplosion(p.particlesRef.current, l.x, l.z)
            playExplosion()
            p.wsRef.current?.send(JSON.stringify({ type: 'hit', payload: { target_id: id, damage: dmg } }))
            break
          }
        }
      } else {
        const dx = l.x - pl.x, dz = l.z - pl.z
        if (dx * dx + dz * dz < 2.0) {
          l.active = false
          if (Date.now() > p.spawnProtectedUntilRef.current) {
            p.shakeRef.current = 9
          }
        }
      }
    }

    // particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const pt = p.particlesRef.current[i]; if (!pt.active) continue
      pt.x += pt.vx; pt.y += pt.vy; pt.z += pt.vz
      pt.vy -= 0.001; pt.life--
      if (pt.life <= 0) pt.active = false
    }

    // send position to server
    sendCd.current++
    if (sendCd.current >= SEND_EVERY) {
      sendCd.current = 0
      p.wsRef.current?.send(JSON.stringify({
        type: 'state',
        payload: { x: pl.x, z: pl.z, rot: pl.heading, hp: p.playerHpRef.current },
      }))
    }

    // camera chase
    p.shakeRef.current *= 0.87
    const sx = (Math.random() - 0.5) * p.shakeRef.current * 0.05
    const sz = (Math.random() - 0.5) * p.shakeRef.current * 0.05
    tCam.current.set(pl.x - fwdX * 13 + pl.vx * 2 + sx, 12, pl.z - fwdZ * 13 + pl.vz * 2 + sz)
    camPos.current.lerp(tCam.current, 0.08)
    camera.position.copy(camPos.current)
    tLook.current.set(pl.x + fwdX * 4 + pl.vx * 3, 0, pl.z + fwdZ * 4 + pl.vz * 3)
    camLook.current.lerp(tLook.current, 0.1)
    camera.lookAt(camLook.current)

    // HUD update
    hudCd.current++
    if (hudCd.current >= 5) { hudCd.current = 0; p.onHud(p.playerHpRef.current, boost) }
  })

  return null
}

// ── SpawnShield HUD indicator ──────────────────────────────────────────────────
function SpawnShield({ protectedUntilRef }: { protectedUntilRef: React.MutableRefObject<number> }) {
  const [secsLeft, setSecsLeft] = useState(0)

  useEffect(() => {
    const iv = setInterval(() => {
      const left = Math.ceil((protectedUntilRef.current - Date.now()) / 1000)
      setSecsLeft(Math.max(0, left))
    }, 250)
    return () => clearInterval(iv)
  }, [protectedUntilRef])

  if (secsLeft <= 0) return null

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded"
      style={{
        fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.35em',
        color: '#06b6d4', border: '1px solid rgba(6,182,212,0.4)',
        background: 'rgba(6,182,212,0.08)',
        animation: 'hex-pulse 1s ease-in-out infinite',
      }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 8px #06b6d4' }} />
      SPAWN SHIELD · {secsLeft}s
    </div>
  )
}

// ── MultiplayerGame ────────────────────────────────────────────────────────────
type Phase = 'name_input' | 'connecting' | 'playing' | 'dead' | 'error'
interface Props { gameState: GameState; setScreen: (s: Screen) => void }

export default function MultiplayerGame({ gameState, setScreen }: Props) {
  const ship    = SHIPS.find(s => s.id === gameState.selectedShipId) ?? SHIPS[0]
  const aiTier  = gameState.aiTier

  const [phase,          setPhase]          = useState<Phase>('name_input')
  const [nameInput,      setNameInput]       = useState('Commander')
  const [initialPrompt,  setInitialPrompt]   = useState('')
  const [hudState,       setHudState]        = useState({ hp: PLAYER_HP, boosting: false })
  const [remotePlayers,  setRemotePlayers]   = useState<Map<string, RemoteInfo>>(new Map())
  const [ranking,        setRanking]         = useState<RankEntry[]>([])
  const [killFeed,       setKillFeed]        = useState<KillEntry[]>([])
  const [currentBehavior, setCurrentBehavior] = useState<Behavior>(DEFAULT_BEHAVIOR)
  const [submitting,     setSubmitting]      = useState(false)
  const [promptError,    setPromptError]     = useState<string | null>(null)
  const killId = useRef(0)

  // game state refs
  const wsRef       = useRef<WebSocket | null>(null)
  const myIdRef     = useRef('')
  const deadRef     = useRef(false)
  const remotePos   = useRef<Map<string, RemotePos>>(new Map())
  const playerRef   = useRef<PlayerRef>({ x: 0, z: 0, vx: 0, vz: 0, heading: 0 })
  const playerHpRef = useRef(PLAYER_HP)
  const lasersRef   = useRef<LaserState[]>(
    Array.from({ length: MAX_LASERS }, () => ({ active: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, isEnemy: false }))
  )
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: MAX_PARTICLES }, () => ({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 }))
  )
  const bankRef               = useRef(0)
  const boostRef              = useRef(false)
  const shakeRef              = useRef(0)
  const fireCdRef             = useRef(0)
  const behaviorRef           = useRef<Behavior>(DEFAULT_BEHAVIOR)
  const spawnProtectedUntilRef = useRef(0)
  const initialPromptRef      = useRef('')

  // ── behavior expiry watcher (resets to idle after 40 s) ─────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const b = behaviorRef.current
      if (b.mode !== 'idle' && Date.now() > b.expiresAt) {
        behaviorRef.current = DEFAULT_BEHAVIOR
        setCurrentBehavior(DEFAULT_BEHAVIOR)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // ── prompt handler ───────────────────────────────────────────────────────────
  const handlePrompt = useCallback(async (prompt: string) => {
    setSubmitting(true)
    setPromptError(null)
    try {
      const pl = playerRef.current
      const ctx = buildGameContext(
        pl.x, pl.z, pl.vx, pl.vz, pl.heading,
        playerHpRef.current, PLAYER_HP,
        aiTier,
        remotePos.current,
      )
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ai_tier: aiTier, game_context: ctx }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json()
      const behavior: Behavior = {
        mode:              raw.mode              ?? 'chase',
        targetMode:        raw.target_mode       ?? 'nearest',
        aggression:        raw.aggression        ?? 0.7,
        preferredDistance: raw.preferred_distance ?? 12,
        description:       raw.description       ?? 'Executing order...',
        expiresAt:         Date.now() + BEHAVIOR_TTL_MS,
      }
      behaviorRef.current = behavior
      setCurrentBehavior(behavior)
    } catch {
      const fallback = localFallback(prompt) // already sets expiresAt
      behaviorRef.current = fallback
      setCurrentBehavior(fallback)
      setPromptError('SIGNAL LOST — fallback active')
    } finally {
      setSubmitting(false)
    }
  }, [aiTier])

  // ── fire initial prompt the moment the game starts ───────────────────────────
  useEffect(() => {
    if (phase === 'playing' && initialPromptRef.current) {
      handlePrompt(initialPromptRef.current)
      initialPromptRef.current = ''
    }
  }, [phase, handlePrompt])

  // ── WS message handler ───────────────────────────────────────────────────────
  const handleMsg = useCallback((env: { type: string; payload: any }) => {
    switch (env.type) {
      case 'join': {
        myIdRef.current   = env.payload.id
        playerRef.current = { x: env.payload.spawn_x ?? 0, z: env.payload.spawn_z ?? 0, vx: 0, vz: 0, heading: 0 }
        playerHpRef.current = env.payload.max_hp ?? PLAYER_HP
        spawnProtectedUntilRef.current = Date.now() + 10_000
        setPhase('playing')
        break
      }
      case 'player_list': {
        const myId = myIdRef.current
        const next = new Map<string, RemoteInfo>()
        for (const p of (env.payload as any[])) {
          if (p.id === myId) continue
          next.set(p.id, { name: p.name, modelPath: SHIPS.find(s => s.id === p.ship)?.modelPath ?? '/Bob.gltf' })
          if (!remotePos.current.has(p.id))
            remotePos.current.set(p.id, { x: p.x ?? 0, z: p.z ?? 0, rot: p.rot ?? 0, hp: p.hp ?? 100, alive: p.alive ?? true })
        }
        for (const id of remotePos.current.keys()) { if (!next.has(id)) remotePos.current.delete(id) }
        setRemotePlayers(next)
        break
      }
      case 'state': {
        const { id, x, z, rot, hp } = env.payload
        if (id === myIdRef.current) return
        const pos = remotePos.current.get(id)
        if (pos) { pos.x = x; pos.z = z; pos.rot = rot; pos.hp = hp }
        else remotePos.current.set(id, { x, z, rot, hp, alive: true })
        break
      }
      case 'shoot': {
        const { x, z, vx, vz } = env.payload
        for (let i = MAX_LASERS / 2; i < MAX_LASERS; i++) {
          if (!lasersRef.current[i].active) {
            lasersRef.current[i] = { active: true, x, z, vx, vz, life: L_LIFE, isEnemy: true }
            break
          }
        }
        break
      }
      case 'hit': {
        playerHpRef.current = env.payload.hp
        shakeRef.current    = 9
        playHit()
        break
      }
      case 'dead': {
        const { player_id, player_name, killer_name } = env.payload
        if (player_id === myIdRef.current) {
          deadRef.current = true
          setPhase('dead')
        } else {
          const pos = remotePos.current.get(player_id)
          if (pos) pos.alive = false
        }
        setKillFeed(prev => [...prev.slice(-3), { id: killId.current++, killer: killer_name, victim: player_name }])
        break
      }
      case 'ranking': {
        setRanking(env.payload as RankEntry[])
        break
      }
    }
  }, [])

  // ── connect ──────────────────────────────────────────────────────────────────
  const connect = useCallback((name: string) => {
    initialPromptRef.current = initialPrompt.trim()
    setPhase('connecting')
    const url = `${WS_URL}?name=${encodeURIComponent(name)}&ship=${encodeURIComponent(ship.id)}`
    const ws  = new WebSocket(url)
    wsRef.current = ws
    ws.onerror  = () => setPhase('error')
    ws.onclose  = () => { if (!deadRef.current) setPhase('error') }
    ws.onmessage = (ev) => handleMsg(JSON.parse(ev.data))
  }, [ship.id, handleMsg])

  useEffect(() => () => { wsRef.current?.close() }, [])

  const onHud = useCallback((hp: number, boosting: boolean) => setHudState({ hp, boosting }), [])

  const loopProps: LoopProps = {
    wsRef, playerRef, playerHpRef, lasersRef, particlesRef,
    bankRef, boostRef, shakeRef, fireCdRef, deadRef,
    remotePos, behaviorRef, spawnProtectedUntilRef,
    shipStats: { speed: ship.stats.speed, damage: ship.stats.damage, fireRate: ship.stats.fireRate },
    onHud,
  }

  // ── name input ───────────────────────────────────────────────────────────────
  if (phase === 'name_input') {
    const canLaunch = nameInput.trim().length > 0
    return (
      <div className="w-screen h-screen bg-[#020408] flex items-center justify-center">
        <div style={{ animation: 'appear 0.4s ease forwards' }}
          className="flex flex-col items-center gap-7 w-full max-w-md px-6">

          {/* header */}
          <div className="text-center">
            <p className="text-[9px] tracking-[0.6em] mb-2" style={{ fontFamily: 'Orbitron', color: '#8b5cf650' }}>
              BATTLE ROYALE
            </p>
            <h2 className="text-2xl font-black tracking-[0.2em]"
              style={{ fontFamily: 'Orbitron', background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              PRE-FLIGHT BRIEFING
            </h2>
          </div>

          {/* ship badge */}
          <div className="text-[9px] tracking-widest px-4 py-1.5 rounded flex items-center gap-2"
            style={{ fontFamily: 'Orbitron', color: ship.rangerColor, border: `1px solid ${ship.rangerColor}40`, background: `${ship.rangerColor}0d` }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: ship.rangerColor, boxShadow: `0 0 6px ${ship.rangerColor}` }} />
            {ship.name.toUpperCase()} · {ship.rangerTitle.toUpperCase()}
          </div>

          {/* callsign */}
          <div className="w-full flex flex-col gap-2">
            <label className="text-[8px] tracking-[0.45em]" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>
              CALLSIGN
            </label>
            <input
              className="bg-transparent border rounded px-4 py-2.5 text-center text-sm tracking-widest outline-none w-full"
              style={{ borderColor: '#06b6d430', color: '#06b6d4', fontFamily: 'Orbitron',
                background: 'rgba(6,182,212,0.04)', transition: 'border-color 0.2s' }}
              value={nameInput} maxLength={20}
              onChange={e => setNameInput(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.6)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)' }}
              autoFocus
            />
          </div>

          {/* initial command */}
          <div className="w-full flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[8px] tracking-[0.45em]" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>
                OPENING ORDER <span style={{ color: '#ffffff18' }}>— OPTIONAL</span>
              </label>
              <span className="text-[7px] tracking-wider px-1.5 py-0.5 rounded"
                style={{ fontFamily: 'Orbitron', color: aiTier === 3 ? '#f59e0b' : aiTier === 2 ? '#8b5cf6' : '#06b6d4',
                  border: `1px solid currentColor`, opacity: 0.6 }}>
                TIER {aiTier}
              </span>
            </div>
            <textarea
              rows={3}
              placeholder={'e.g. "hunt the weakest enemy and orbit them"\nYour AI pilot executes this the moment you spawn.'}
              value={initialPrompt}
              onChange={e => setInitialPrompt(e.target.value)}
              style={{
                background: 'rgba(139,92,246,0.04)',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: 8, color: '#c8d8e8',
                fontFamily: 'Rajdhani', fontSize: 13, lineHeight: 1.5,
                padding: '10px 14px', resize: 'none', outline: 'none',
                width: '100%', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.55)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)' }}
            />
            {initialPrompt.trim() && (
              <p className="text-[8px] tracking-wider" style={{ fontFamily: 'Orbitron', color: '#8b5cf670' }}>
                ✓ Ship will execute this command on spawn
              </p>
            )}
          </div>

          {/* buttons */}
          <div className="flex gap-4 w-full">
            <button onClick={() => setScreen('game_mode_select')}
              className="px-5 py-2.5 rounded text-xs tracking-widest"
              style={{ fontFamily: 'Orbitron', color: '#ffffff35', border: '1px solid rgba(255,255,255,0.08)' }}>
              BACK
            </button>
            <button
              disabled={!canLaunch}
              onClick={() => connect(nameInput.trim())}
              className="flex-1 py-2.5 rounded text-xs tracking-widest font-bold disabled:opacity-40 transition-all duration-200"
              style={{ fontFamily: 'Orbitron', background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)', color: '#020408',
                boxShadow: canLaunch ? '0 0 24px rgba(139,92,246,0.35)' : 'none' }}>
              LAUNCH INTO BATTLE
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'connecting') return (
    <div className="w-screen h-screen bg-[#020408] flex items-center justify-center">
      <p className="text-[10px] tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#06b6d470' }}>
        CONNECTING TO BATTLE...
      </p>
    </div>
  )

  if (phase === 'error') return (
    <div className="w-screen h-screen bg-[#020408] flex flex-col items-center justify-center gap-6">
      <p className="text-sm tracking-widest" style={{ fontFamily: 'Orbitron', color: '#ef4444' }}>CONNECTION LOST</p>
      <button onClick={() => setScreen('game_mode_select')}
        className="px-6 py-2 rounded text-xs tracking-widest"
        style={{ fontFamily: 'Orbitron', color: '#ffffff60', border: '1px solid rgba(255,255,255,0.15)' }}>
        RETURN TO MENU
      </button>
    </div>
  )

  // ── playing / dead ───────────────────────────────────────────────────────────
  const hpPct   = Math.max(0, (hudState.hp / PLAYER_HP) * 100)
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: '#020408' }}>

      {/* ── AI prompt sidebar ── */}
      {phase === 'playing' && (
        <PromptSidebar
          aiTier={aiTier as 1 | 2 | 3}
          currentBehavior={currentBehavior}
          onSubmit={handlePrompt}
          submitting={submitting}
          error={promptError}
        />
      )}

      {/* ── canvas + HUD ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Canvas camera={{ position: [0, 12, 13], fov: 65 }} gl={{ antialias: true }}>
          <Space />
          <PlayerShip modelPath={ship.modelPath} playerRef={playerRef} bankRef={bankRef} boostRef={boostRef} />
          {Array.from(remotePlayers.entries()).map(([id, info]) => (
            <RemoteShip key={id} playerId={id} modelPath={info.modelPath} posRef={remotePos} />
          ))}
          <LaserPool stateRef={lasersRef} />
          <ParticlePool stateRef={particlesRef} />
          {phase === 'playing' && <MPGameLoop {...loopProps} />}
        </Canvas>

        {/* HUD overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

          {hpPct < 25 && phase === 'playing' && (
            <div className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at center,transparent 50%,rgba(220,38,38,0.4) 100%)', animation: 'hex-pulse 0.9s ease-in-out infinite' }} />
          )}

          {/* top bar */}
          <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 gap-4">
            <button className="pointer-events-auto text-[10px] tracking-widest flex items-center gap-1.5 transition-colors"
              style={{ fontFamily: 'Orbitron', color: '#ffffff35' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#06b6d4' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#ffffff35' }}
              onClick={() => { wsRef.current?.close(); setScreen('game_mode_select') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              RETREAT
            </button>

            <div className="flex flex-col gap-1 items-center flex-1">
              {killFeed.map(k => (
                <div key={k.id} className="text-[9px] tracking-wider px-2 py-0.5 rounded"
                  style={{ fontFamily: 'Orbitron', background: 'rgba(0,0,0,0.6)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                  {k.killer} → {k.victim}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-0.5 min-w-[190px]">
              <div className="text-[8px] tracking-[0.4em] text-right mb-1" style={{ fontFamily: 'Orbitron', color: '#ffffff20' }}>RANKING</div>
              {ranking.slice(0, 8).map(r => (
                <div key={r.id}
                  className="flex items-center gap-2 text-[9px] tracking-wider px-2 py-0.5 rounded"
                  style={{
                    fontFamily: 'Orbitron',
                    background: r.id === myIdRef.current ? 'rgba(6,182,212,0.12)' : 'rgba(0,0,0,0.35)',
                    border:     r.id === myIdRef.current ? '1px solid rgba(6,182,212,0.35)' : '1px solid transparent',
                    color:      r.alive ? '#ffffffa0' : '#ffffff30',
                  }}>
                  <span style={{ color: r.rank <= 3 ? '#f59e0b' : '#ffffff40', minWidth: 18 }}>#{r.rank}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span style={{ color: '#06b6d4' }}>{r.kills}K</span>
                </div>
              ))}
            </div>
          </div>

          {/* HP bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <div className="text-[8px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#ffffff22' }}>HULL INTEGRITY</div>
            <div className="w-56 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full transition-all duration-150"
                style={{ width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 8px ${hpColor}` }} />
            </div>
            <div className="text-[9px]" style={{ fontFamily: 'Orbitron', color: hpColor }}>
              {Math.ceil(hudState.hp)} / {PLAYER_HP}
            </div>
          </div>

          {hudState.boosting && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[9px] tracking-widest"
              style={{ fontFamily: 'Orbitron', color: '#a78bfa', animation: 'hex-pulse 0.4s ease-in-out infinite' }}>
              ⚡ BOOST
            </div>
          )}

          <SpawnShield protectedUntilRef={spawnProtectedUntilRef} />
        </div>

        {/* death overlay */}
        {phase === 'dead' && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20, background: 'rgba(2,4,8,0.88)' }}>
            <div className="flex flex-col items-center gap-7" style={{ animation: 'appear 0.5s ease forwards' }}>
              <p className="text-[10px] tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#ef4444' }}>ELIMINATED</p>
              <h1 className="text-5xl font-black tracking-[0.2em]"
                style={{ fontFamily: 'Orbitron', background: 'linear-gradient(135deg,#ef4444,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                DESTROYED
              </h1>
              <div className="flex flex-col gap-1 w-64">
                <p className="text-[8px] tracking-[0.4em] text-center mb-1" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>FINAL RANKING</p>
                {ranking.slice(0, 6).map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-[9px] px-3 py-1 rounded"
                    style={{
                      fontFamily: 'Orbitron',
                      background: r.id === myIdRef.current ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.04)',
                      color:      r.alive ? '#ffffffa0' : '#ffffff30',
                    }}>
                    <span style={{ color: '#f59e0b', minWidth: 20 }}>#{r.rank}</span>
                    <span className="flex-1 truncate">{r.name}</span>
                    <span style={{ color: '#06b6d4' }}>{r.kills}K</span>
                    <span style={{ color: '#ef4444' }}>{r.deaths}D</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { wsRef.current?.close(); setScreen('game_mode_select') }}
                className="px-8 py-3 rounded text-sm tracking-widest"
                style={{ fontFamily: 'Orbitron', color: '#ffffff60', border: '1px solid rgba(255,255,255,0.15)' }}>
                RETURN TO MENU
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
