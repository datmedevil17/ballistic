import { useState, useEffect, useRef } from 'react'
import type { Behavior } from './BehaviorEngine'
import { BEHAVIOR_TTL_MS } from './BehaviorEngine'

const COOLDOWN_SECS = 20

interface Props {
  aiTier: 1 | 2 | 3
  currentBehavior: Behavior
  onSubmit: (prompt: string) => void
  submitting: boolean
  error: string | null
}

const TIER_COLOR: Record<number, string> = {
  1: '#06b6d4',
  2: '#8b5cf6',
  3: '#f59e0b',
}
const TIER_LABEL: Record<number, string> = {
  1: 'TIER I · BASIC',
  2: 'TIER II · TACTICAL',
  3: 'TIER III · FULL INTEL',
}
const TIER_INFO = [
  { tier: 1, label: 'Own position + HP', color: '#06b6d4' },
  { tier: 2, label: 'Nearby enemies (≤35u)', color: '#8b5cf6' },
  { tier: 3, label: 'All enemies + headings', color: '#f59e0b' },
]

const MODE_TIPS: Record<string, string> = {
  idle:       'Idle',
  chase:      'Chasing',
  strafe:     'Orbiting & strafing',
  aggressive: 'Full aggression',
  retreat:    'Retreating',
  snipe:      'Long-range snipe',
  dodge:      'Evading & firing',
  patrol:     'Patrolling',
}

const PRESETS = [
  { label: 'HUNT WEAK',  prompt: 'Hunt the weakest enemy — stay close and finish them off' },
  { label: 'FULL AGGRO', prompt: 'Go fully aggressive on the nearest enemy, attack without mercy' },
  { label: 'ORBIT',      prompt: 'Orbit and strafe the nearest enemy, keep moving to dodge fire' },
  { label: 'SNIPE',      prompt: 'Hold long range and snipe enemies from a safe distance' },
  { label: 'RETREAT',    prompt: 'Retreat and flee from all enemies immediately' },
]

export default function PromptSidebar({ aiTier, currentBehavior, onSubmit, submitting, error }: Props) {
  const [prompt, setPrompt]     = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [ttlLeft,  setTtlLeft]  = useState(0)   // seconds remaining on current behavior
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canSubmit = !submitting && cooldown <= 0 && prompt.trim().length > 0

  // track TTL of active behavior
  useEffect(() => {
    const iv = setInterval(() => {
      if (currentBehavior.mode === 'idle' || currentBehavior.expiresAt === Infinity) {
        setTtlLeft(0)
        return
      }
      const left = Math.max(0, Math.ceil((currentBehavior.expiresAt - Date.now()) / 1000))
      setTtlLeft(left)
    }, 500)
    return () => clearInterval(iv)
  }, [currentBehavior])

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(prompt.trim())
    setPrompt('')
    setCooldown(COOLDOWN_SECS)
    cdRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cdRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (cdRef.current) clearInterval(cdRef.current) }, [])

  const tc    = TIER_COLOR[aiTier]
  const cdPct = ((COOLDOWN_SECS - cooldown) / COOLDOWN_SECS) * 100
  const ttlPct = currentBehavior.expiresAt === Infinity ? 0
    : Math.max(0, (ttlLeft / (BEHAVIOR_TTL_MS / 1000)) * 100)

  return (
    <div style={{
      width: 288, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      background: 'linear-gradient(180deg,rgba(2,4,8,0.97),rgba(6,12,20,0.95))',
      borderRight: '1px solid rgba(6,182,212,0.1)',
      padding: '20px 16px',
      gap: 14,
      fontFamily: 'Orbitron',
      overflowY: 'auto',
      boxSizing: 'border-box',
    }}>

      {/* ── header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 8, letterSpacing: '0.5em', color: '#ffffff18', margin: 0 }}>
          AI COMMAND CONSOLE
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          fontSize: 8, letterSpacing: '0.3em',
          color: tc, border: `1px solid ${tc}40`, background: `${tc}10`,
          padding: '4px 10px', borderRadius: 4,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: tc, boxShadow: `0 0 6px ${tc}` }} />
          {TIER_LABEL[aiTier]}
        </div>
      </div>

      {/* ── current behavior ── */}
      <div style={{
        background: 'rgba(6,182,212,0.04)',
        border: '1px solid rgba(6,182,212,0.12)',
        borderRadius: 8, padding: '10px 12px', minHeight: 80,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ fontSize: 7, letterSpacing: '0.45em', color: '#ffffff18', margin: 0 }}>EXECUTING</p>
          {ttlLeft > 0 && (
            <span style={{ fontSize: 8, color: ttlLeft < 10 ? '#ef444480' : '#06b6d450', letterSpacing: '0.1em' }}>
              {ttlLeft}s
            </span>
          )}
        </div>
        <p style={{
          fontSize: 12, color: '#06b6d4cc', lineHeight: 1.55,
          fontFamily: 'Rajdhani', margin: '0 0 8px',
        }}>
          {currentBehavior.description}
        </p>

        {/* TTL drain bar */}
        {ttlLeft > 0 && (
          <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${ttlPct}%`,
              background: ttlLeft < 10
                ? 'linear-gradient(90deg,#ef4444,#f59e0b)'
                : 'linear-gradient(90deg,#06b6d4,#8b5cf6)',
              transition: 'width 0.5s linear',
            }} />
          </div>
        )}

        {currentBehavior.mode && currentBehavior.mode !== 'idle' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              MODE_TIPS[currentBehavior.mode] ?? currentBehavior.mode.toUpperCase(),
              currentBehavior.targetMode ? currentBehavior.targetMode.toUpperCase() : null,
              typeof currentBehavior.aggression === 'number'
                ? `AGG ${Math.round(currentBehavior.aggression * 100)}%`
                : null,
              typeof currentBehavior.preferredDistance === 'number'
                ? `DST ${currentBehavior.preferredDistance}u`
                : null,
            ].filter(Boolean).map(tag => (
              <span key={tag as string} style={{
                fontSize: 7, padding: '2px 6px', borderRadius: 3,
                color: 'rgba(6,182,212,0.55)', border: '1px solid rgba(6,182,212,0.18)',
              }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── quick presets ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 7, letterSpacing: '0.4em', color: '#ffffff18', margin: 0 }}>QUICK ORDERS</p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRESETS.map(({ label, prompt: p }) => (
            <button
              key={label}
              onClick={() => setPrompt(p)}
              style={{
                fontSize: 7, padding: '3px 7px', borderRadius: 3,
                color: 'rgba(139,92,246,0.7)', border: '1px solid rgba(139,92,246,0.25)',
                background: 'rgba(139,92,246,0.06)', cursor: 'pointer',
                fontFamily: 'Orbitron', letterSpacing: '0.2em',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'rgba(139,92,246,1)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.6)'
                e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(139,92,246,0.7)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'
                e.currentTarget.style.background = 'rgba(139,92,246,0.06)'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── textarea ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 7, letterSpacing: '0.4em', color: '#ffffff18', margin: 0 }}>NEXT COMMAND</p>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
          placeholder={"Describe ship behaviour...\ne.g. 'orbit the weakest enemy and pick them off'"}
          rows={5}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(6,182,212,0.18)',
            borderRadius: 8, color: '#c8d8e8',
            fontFamily: 'Rajdhani', fontSize: 13, lineHeight: 1.5,
            padding: '10px 12px', resize: 'none', outline: 'none',
            width: '100%', boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.5)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.18)' }}
        />
      </div>

      {/* ── cooldown bar ── */}
      {cooldown > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 2, background: 'rgba(255,255,255,0.06)',
            borderRadius: 1, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${cdPct}%`,
              background: 'linear-gradient(90deg,#06b6d4,#8b5cf6)',
              transition: 'width 1s linear',
            }} />
          </div>
          <span style={{ fontSize: 9, color: '#06b6d470', minWidth: 22, textAlign: 'right' }}>
            {cooldown}s
          </span>
        </div>
      )}

      {/* ── error ── */}
      {error && (
        <p style={{
          fontSize: 8, color: '#ef4444', letterSpacing: '0.2em',
          margin: 0, padding: '6px 8px', background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6,
        }}>
          ⚠ {error}
        </p>
      )}

      {/* ── submit ── */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          background: canSubmit
            ? 'linear-gradient(135deg,#06b6d4,#8b5cf6)'
            : 'rgba(255,255,255,0.04)',
          border: canSubmit ? 'none' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          color: canSubmit ? '#020408' : '#ffffff20',
          fontFamily: 'Orbitron', fontSize: 10,
          letterSpacing: '0.3em', fontWeight: 700,
          padding: '11px 0', cursor: canSubmit ? 'pointer' : 'not-allowed',
          width: '100%',
          boxShadow: canSubmit ? '0 0 20px rgba(6,182,212,0.3)' : 'none',
          transition: 'all 0.2s',
        }}
      >
        {submitting ? 'PROCESSING...' : cooldown > 0 ? `COOLDOWN ${cooldown}s` : 'EXECUTE COMMAND'}
      </button>

      <p style={{ fontSize: 8, color: '#ffffff12', textAlign: 'center', letterSpacing: '0.2em', margin: 0 }}>
        ⌘+ENTER TO SEND
      </p>

      {/* ── intel tier info ── */}
      <div style={{
        marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: 14,
      }}>
        <p style={{ fontSize: 7, letterSpacing: '0.4em', color: '#ffffff15', margin: '0 0 8px' }}>INTEL FEED</p>
        {TIER_INFO.map(({ tier, label, color }) => (
          <div key={tier} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            marginBottom: 6, opacity: aiTier >= tier ? 1 : 0.28,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: aiTier >= tier ? color : '#ffffff25',
              boxShadow: aiTier >= tier ? `0 0 5px ${color}` : 'none',
            }} />
            <span style={{
              fontSize: 9, fontFamily: 'Rajdhani',
              color: aiTier >= tier ? color + 'aa' : '#ffffff20',
            }}>
              Tier {tier}: {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
