import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { useBallistic } from '../hooks/useBallistic'
import WalletButton from '../game/WalletButton'
import type { Screen } from '../App'

interface LogEntry {
  id: number
  ts: string
  level: 'info' | 'success' | 'error' | 'warn'
  msg: string
}

let logId = 0

export default function TestPage({ setScreen }: { setScreen: (s: Screen) => void }) {
  const { publicKey } = useWallet()
  const b = useBallistic()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [roomId, setRoomId] = useState('1')
  const [victimPubkey, setVictimPubkey] = useState('')
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const push = (msg: string, level: LogEntry['level'] = 'info') => {
    const now = new Date()
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
    setLogs(prev => [...prev, { id: logId++, ts, level, msg }])
  }

  // Intercept console.error from Anchor/Solana during calls
  useEffect(() => {
    const orig = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      orig(...args)
      push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '), 'error')
    }
    return () => { console.error = orig }
  }, [])

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const run = async (label: string, fn: () => Promise<string | null | { unclaimedKills: number; totalKillsEver: number } | undefined>) => {
    push(`→ ${label}...`, 'info')
    try {
      const result = await fn()
      if (result === null || result === undefined) {
        push(`✗ ${label} — null result (wallet/program not ready?)`, 'error')
      } else if (typeof result === 'string') {
        push(`✓ ${label}`, 'success')
        push(`  sig: ${result}`, 'success')
      } else {
        push(`✓ ${label}`, 'success')
        push(`  unclaimedKills: ${result.unclaimedKills}`, 'info')
        push(`  totalKillsEver: ${result.totalKillsEver}`, 'info')
      }
    } catch (e: unknown) {
      push(`✗ ${label} — ${e instanceof Error ? e.message : String(e)}`, 'error')
    }
  }

  const rid = () => parseInt(roomId) || 1

  interface Section {
    title: string
    tag: string
    buttons: { label: string; description: string; action: () => void }[]
  }

  const sections: Section[] = [
    {
      title: 'SOLO',
      tag: 'base layer',
      buttons: [
        {
          label: 'startAiGame',
          description: 'Create PlayerSession PDA on base layer',
          action: () => run('startAiGame', b.startAiGame),
        },
        {
          label: 'delegateSession',
          description: 'Delegate session PDA to Ephemeral Rollup',
          action: () => run('delegateSession', b.delegateSession),
        },
        {
          label: 'recordSoloKill',
          description: 'Record AI kill on ER (gasless)',
          action: () => run('recordSoloKill', b.recordSoloKill),
        },
        {
          label: 'soloRespawn',
          description: 'Respawn on ER + checkpoint commit',
          action: () => run('soloRespawn', b.soloRespawn),
        },
        {
          label: 'endSession',
          description: 'Commit kills + undelegate from ER',
          action: () => run('endSession', b.endSession),
        },
        {
          label: 'collectSessionRewards',
          description: 'Move session kills → PendingRewards',
          action: () => run('collectSessionRewards', b.collectSessionRewards),
        },
      ],
    },
    {
      title: 'MULTIPLAYER',
      tag: 'base + ER',
      buttons: [
        {
          label: 'createRoom',
          description: 'Create GameRoom PDA (status: Lobby)',
          action: () => run(`createRoom(${rid()})`, () => b.createRoom(rid())),
        },
        {
          label: 'joinRoom',
          description: 'Join room in lobby phase',
          action: () => run(`joinRoom(${rid()})`, () => b.joinRoom(rid())),
        },
        {
          label: 'leaveRoom',
          description: 'Leave room before game starts',
          action: () => run(`leaveRoom(${rid()})`, () => b.leaveRoom(rid())),
        },
        {
          label: 'startGame',
          description: 'Lock room + set Active (creator, ≥2 players)',
          action: () => run(`startGame(${rid()})`, () => b.startGame(rid())),
        },
        {
          label: 'delegateRoom',
          description: 'Delegate GameRoom PDA to ER',
          action: () => run(`delegateRoom(${rid()})`, () => b.delegateRoom(rid())),
        },
        {
          label: 'recordKill',
          description: 'Record kill on ER (gasless)',
          action: () => {
            let victim: PublicKey
            try { victim = new PublicKey(victimPubkey) }
            catch { push('✗ recordKill — invalid victim pubkey', 'error'); return }
            run(`recordKill(${rid()}, ${victimPubkey.slice(0, 8)}…)`, () => b.recordKill(rid(), victim))
          },
        },
        {
          label: 'respawn',
          description: 'Respawn in room on ER',
          action: () => run(`respawn(${rid()})`, () => b.respawn(rid())),
        },
        {
          label: 'endGame',
          description: 'Close room on ER when ≤1 player alive',
          action: () => run(`endGame(${rid()})`, () => b.endGame(rid())),
        },
        {
          label: 'updateRewards',
          description: 'Credit room kills → PendingRewards',
          action: () => run(`updateRewards(${rid()})`, () => b.updateRewards(rid())),
        },
      ],
    },
    {
      title: 'REWARDS',
      tag: 'base layer',
      buttons: [
        {
          label: 'fetchPendingRewards',
          description: 'Read unclaimed kills from chain',
          action: () => run('fetchPendingRewards', b.fetchPendingRewards),
        },
        {
          label: 'claimRewards',
          description: 'Mint BALLISTIC tokens (1 kill = 1 token)',
          action: () => run('claimRewards', b.claimRewards),
        },
      ],
    },
  ]

  const levelColor: Record<LogEntry['level'], string> = {
    info:    '#8899bb',
    success: '#44dd88',
    error:   '#ff4455',
    warn:    '#ffaa33',
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh',
      background: '#050a10', color: '#c8d8f0',
      fontFamily: "'Courier New', monospace",
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 20px', borderBottom: '1px solid #1a2a3a',
        background: '#060d16', flexShrink: 0,
      }}>
        <button
          onClick={() => setScreen('menu')}
          style={{
            background: 'none', border: '1px solid #2a3a4a',
            color: '#6688aa', padding: '4px 12px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, letterSpacing: 1,
          }}
        >
          ← BACK
        </button>
        <span style={{ fontSize: 13, letterSpacing: 3, color: '#aabbcc', fontWeight: 700 }}>
          BALLISTIC / TEST HARNESS
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {publicKey && (
            <span style={{ fontSize: 11, color: '#4a6a8a' }}>
              {publicKey.toBase58().slice(0, 8)}…{publicKey.toBase58().slice(-6)}
              {b.progReady
                ? <span style={{ color: '#44dd88', marginLeft: 8 }}>● READY</span>
                : <span style={{ color: '#ffaa33', marginLeft: 8 }}>● LOADING</span>}
            </span>
          )}
          <div style={{ width: 180 }}><WalletButton /></div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel — buttons */}
        <div style={{
          width: 320, flexShrink: 0,
          overflowY: 'auto', borderRight: '1px solid #1a2a3a',
          padding: '12px 0',
        }}>
          {/* Shared inputs */}
          <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #1a2a3a' }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: '#4a6a8a', marginBottom: 8 }}>PARAMS</div>
            <label style={{ fontSize: 11, color: '#6688aa', display: 'block', marginBottom: 4 }}>Room ID</label>
            <input
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              style={{
                width: '100%', background: '#0a1520', border: '1px solid #1a2a3a',
                color: '#aabbcc', padding: '4px 8px', fontFamily: 'inherit', fontSize: 12,
                boxSizing: 'border-box', marginBottom: 8,
              }}
              placeholder="1"
            />
            <label style={{ fontSize: 11, color: '#6688aa', display: 'block', marginBottom: 4 }}>Victim Pubkey (recordKill)</label>
            <input
              value={victimPubkey}
              onChange={e => setVictimPubkey(e.target.value)}
              style={{
                width: '100%', background: '#0a1520', border: '1px solid #1a2a3a',
                color: '#aabbcc', padding: '4px 8px', fontFamily: 'inherit', fontSize: 11,
                boxSizing: 'border-box',
              }}
              placeholder="Base58 pubkey…"
            />
          </div>

          {sections.map(sec => (
            <div key={sec.title} style={{ padding: '10px 16px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #0f1e2a',
              }}>
                <span style={{ fontSize: 11, letterSpacing: 3, color: '#7799bb', fontWeight: 700 }}>{sec.title}</span>
                <span style={{ fontSize: 9, color: '#3a5a7a', letterSpacing: 1 }}>{sec.tag}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sec.buttons.map(btn => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    disabled={!b.progReady}
                    title={btn.description}
                    style={{
                      background: '#0a1824',
                      border: '1px solid #1e3248',
                      color: b.progReady ? '#99ccee' : '#2a4a6a',
                      padding: '7px 10px',
                      cursor: b.progReady ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit', fontSize: 12,
                      textAlign: 'left', letterSpacing: 0.5,
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!b.progReady) return
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#0f2235'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#3a6a9a'
                    }}
                    onMouseLeave={e => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#0a1824'
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#1e3248'
                    }}
                  >
                    <div>{btn.label}</div>
                    <div style={{ fontSize: 9, color: '#3a5a7a', marginTop: 2 }}>{btn.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — console */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', borderBottom: '1px solid #1a2a3a',
            background: '#060d16', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, letterSpacing: 3, color: '#4a6a8a' }}>CONSOLE</span>
            <button
              onClick={() => setLogs([])}
              style={{
                background: 'none', border: '1px solid #1a2a3a',
                color: '#3a5a7a', padding: '2px 10px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 10, letterSpacing: 1,
              }}
            >
              CLEAR
            </button>
          </div>
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '10px 16px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {logs.length === 0 && (
              <div style={{ color: '#2a4a6a', fontSize: 12, marginTop: 8 }}>
                Connect wallet and click a function to begin.
              </div>
            )}
            {logs.map(entry => (
              <div key={entry.id} style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: '#2a4a6a', flexShrink: 0, userSelect: 'none' }}>{entry.ts}</span>
                <span style={{ color: levelColor[entry.level], wordBreak: 'break-all' }}>{entry.msg}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
