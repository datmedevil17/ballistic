import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletReadyState } from '@solana/wallet-adapter-base'
import type { WalletName } from '@solana/wallet-adapter-base'

const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`

export default function WalletButton() {
  const { wallets, select, connect, disconnect, connected, connecting, publicKey } = useWallet()
  const [showPicker, setShowPicker] = useState(false)

  if (connected && publicKey) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 14px', borderRadius: 7,
          background: 'rgba(34,197,94,0.07)',
          border: '1px solid rgba(34,197,94,0.3)',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: '#22c55e', boxShadow: '0 0 8px #22c55e',
          }} />
          <span style={{
            fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.25em', color: '#22c55e',
          }}>
            {short(publicKey.toBase58())}
          </span>
          <span style={{ fontFamily: 'Rajdhani', fontSize: 10, color: '#22c55e60', marginLeft: 4 }}>
            VERIFIED
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          style={{
            fontFamily: 'Orbitron', fontSize: 8, letterSpacing: '0.2em',
            color: '#ffffff30', border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'transparent',
          }}
        >
          ✕
        </button>
      </div>
    )
  }

  const readyWallets = wallets.filter(
    w => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable
  )

  const handleSelect = (name: WalletName) => {
    select(name)
    setShowPicker(false)
    setTimeout(() => connect().catch(() => {}), 60)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => {
          if (readyWallets.length === 1) {
            handleSelect(readyWallets[0].adapter.name as WalletName)
          } else {
            setShowPicker(v => !v)
          }
        }}
        disabled={connecting}
        style={{
          fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.35em',
          color: connecting ? 'rgba(139,92,246,0.4)' : '#8b5cf6',
          border: '1px solid rgba(139,92,246,0.4)',
          background: 'rgba(139,92,246,0.08)',
          padding: '9px 0', borderRadius: 7, cursor: connecting ? 'wait' : 'pointer',
          transition: 'all 0.2s', width: '100%',
          boxShadow: connecting ? 'none' : '0 0 16px rgba(139,92,246,0.15)',
        }}
      >
        {connecting ? 'CONNECTING...' : '⬡ CONNECT WALLET'}
      </button>

      {showPicker && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: 'rgba(4,8,16,0.98)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 9, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <p style={{
            fontFamily: 'Orbitron', fontSize: 7, letterSpacing: '0.4em',
            color: '#ffffff20', margin: 0, padding: '8px 14px 6px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            SELECT WALLET
          </p>
          {readyWallets.length === 0 ? (
            <p style={{
              fontFamily: 'Rajdhani', fontSize: 12, color: '#ffffff40',
              padding: '14px', margin: 0, textAlign: 'center', lineHeight: 1.5,
            }}>
              No wallets detected.<br />Install Phantom or Solflare.
            </p>
          ) : (
            readyWallets.map(w => (
              <button
                key={w.adapter.name}
                onClick={() => handleSelect(w.adapter.name as WalletName)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px',
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {w.adapter.icon && (
                  <img src={w.adapter.icon} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />
                )}
                <span style={{ fontFamily: 'Orbitron', fontSize: 9, letterSpacing: '0.2em', color: '#c8d8e8' }}>
                  {w.adapter.name.toUpperCase()}
                </span>
                <span style={{
                  marginLeft: 'auto', fontFamily: 'Rajdhani', fontSize: 9,
                  color: w.readyState === WalletReadyState.Installed ? '#22c55e90' : '#ffffff30',
                }}>
                  {w.readyState === WalletReadyState.Installed ? 'INSTALLED' : 'LOADABLE'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
