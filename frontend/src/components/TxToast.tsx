import { useEffect, useRef, useState, useCallback } from 'react'

// ── event bus ───────────────────────────────────────────────────────────────────
// useBallistic calls dispatchTxToast after every confirmed tx.
// TxToastContainer picks it up without any prop-drilling.

export interface TxToastDetail {
  label: string      // human-readable instruction name, e.g. "SOLO KILL"
  sig: string        // transaction signature
  ephemeral: boolean // true = Ephemeral Rollup (purple), false = base layer (green)
}

export function dispatchTxToast(detail: TxToastDetail) {
  window.dispatchEvent(new CustomEvent<TxToastDetail>('tx-toast', { detail }))
}

// ── single toast ────────────────────────────────────────────────────────────────
const DURATION_MS = 3200
const FADEOUT_MS  = 350

interface ToastEntry extends TxToastDetail { id: number }

function Toast({ label, sig, ephemeral, onRemove }: ToastEntry & { onRemove: () => void }) {
  const ref    = useRef<HTMLDivElement>(null)
  const color  = ephemeral ? '#a78bfa' : '#22c55e'
  const tag    = ephemeral ? 'ER' : 'BASE'
  const shortSig = `${sig.slice(0, 6)}…${sig.slice(-4)}`
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sig).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [sig])

  // Start fade-out just before the entry is removed from state.
  useEffect(() => {
    const fadeTimer   = setTimeout(() => {
      if (ref.current) ref.current.style.animation = `tx-fade-out ${FADEOUT_MS}ms ease forwards`
    }, DURATION_MS - FADEOUT_MS)
    const removeTimer = setTimeout(onRemove, DURATION_MS)
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 13px',
        borderRadius: 8,
        background: 'rgba(2,4,8,0.94)',
        border: `1px solid ${color}35`,
        boxShadow: `0 0 18px ${color}18, inset 0 0 12px ${color}06`,
        animation: `tx-slide-in 0.22s ease forwards`,
        fontFamily: 'Orbitron, sans-serif',
        minWidth: 220,
        pointerEvents: 'auto',
      }}
    >
      {/* status dot */}
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 7px ${color}`,
        flexShrink: 0,
        animation: 'hex-pulse 1.2s ease-in-out infinite',
      }} />

      {/* text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.35em', color: '#ffffffcc' }}>
            {label}
          </span>
          {/* ER / BASE badge */}
          <span style={{
            fontSize: 7,
            letterSpacing: '0.2em',
            color,
            padding: '1px 5px',
            border: `1px solid ${color}50`,
            borderRadius: 3,
            flexShrink: 0,
          }}>
            {tag}
          </span>
        </div>
        <span style={{ fontSize: 8, letterSpacing: '0.08em', color: '#ffffff35', fontFamily: 'monospace' }}>
          {shortSig}
        </span>
      </div>

      {/* copy button */}
      <button
        onClick={handleCopy}
        title="Copy tx hash"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 3,
          borderRadius: 4,
          color: copied ? color : '#ffffff40',
          transition: 'color 0.2s',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ── container — render once in App.tsx ────────────────────────────────────────
let nextId = 0

export function TxToastContainer() {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TxToastDetail>).detail
      const id = nextId++
      setToasts(prev => [...prev, { id, ...detail }])
    }
    window.addEventListener('tx-toast', handler)
    return () => window.removeEventListener('tx-toast', handler)
  }, [])

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed',
      right: 16,
      bottom: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 6,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <Toast key={t.id} {...t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  )
}
