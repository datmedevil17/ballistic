import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import Starfield from './Starfield'
import WalletButton from '../game/WalletButton'
import type { Screen } from '../App'
import IDL from '../idl/ballistic.json'
import type { Ballistic } from '../idl/ballistic'

const PROGRAM_ID = new PublicKey('HKzxdYAWje6tALFwBn1ccDau2yCYymp2N6xB6NpRx1gM')

const [MINT_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('ballistic_mint')],
  PROGRAM_ID
)

interface Props {
  setScreen: (s: Screen) => void
}

type TxStatus = 'idle' | 'sending' | 'success' | 'error'

export default function MintPage({ setScreen }: Props) {
  const { connection } = useConnection()
  const { connected } = useWallet()
  const anchorWallet = useAnchorWallet()

  const [mintInitialized, setMintInitialized] = useState<boolean | null>(null)
  const [txStatus, setTxStatus] = useState<TxStatus>('idle')
  const [txSig, setTxSig] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const checkMint = useCallback(async () => {
    setMintInitialized(null)
    const info = await connection.getAccountInfo(MINT_PDA)
    setMintInitialized(info !== null)
  }, [connection])

  useEffect(() => {
    checkMint()
  }, [checkMint])

  const initMint = useCallback(async () => {
    if (!anchorWallet) return
    setTxStatus('sending')
    setTxSig(null)
    setErrorMsg(null)
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program = new Program<Ballistic>(IDL as Ballistic, provider)
      const sig = await program.methods.initializeMint().rpc()
      setTxSig(sig)
      setTxStatus('success')
      setMintInitialized(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(msg)
      setTxStatus('error')
    }
  }, [anchorWallet, connection])

  const copyAddress = () => {
    navigator.clipboard.writeText(MINT_PDA.toBase58())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const canInit = connected && anchorWallet && mintInitialized === false && txStatus !== 'sending'

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020408] flex flex-col">
      <Starfield count={200} />
      <div className="scanlines fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Header */}
      <div
        className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={() => setScreen('menu')}
          className="flex items-center gap-2 text-xs tracking-widest transition-colors duration-200"
          style={{ fontFamily: 'Orbitron', color: '#ffffff50' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#06b6d4' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#ffffff50' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          BACK
        </button>

        <div className="text-center">
          <h1 className="text-base tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#06b6d4' }}>
            MINT CONTROL
          </h1>
          <p className="text-[9px] tracking-[0.3em] mt-0.5" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
            BALLISTIC TOKEN
          </p>
        </div>

        <div className="w-24" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 flex flex-col gap-5 max-w-lg mx-auto w-full">

        {/* Wallet */}
        <div>
          <p className="text-[8px] tracking-[0.4em] mb-2" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
            WALLET
          </p>
          <WalletButton />
        </div>

        {/* Mint status */}
        <div
          className="rounded-xl p-5"
          style={{
            border: '1px solid rgba(6,182,212,0.25)',
            background: 'linear-gradient(135deg, rgba(6,182,212,0.07), rgba(0,0,0,0.6))',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#ffffff40' }}>
              MINT STATUS
            </span>
            {mintInitialized === null && (
              <span className="text-[9px] tracking-widest animate-pulse" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
                CHECKING...
              </span>
            )}
            {mintInitialized === true && (
              <div
                className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded"
                style={{ fontFamily: 'Orbitron', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 6px #22c55e' }} />
                INITIALIZED
              </div>
            )}
            {mintInitialized === false && (
              <div
                className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded"
                style={{ fontFamily: 'Orbitron', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 6px #f59e0b' }} />
                NOT INITIALIZED
              </div>
            )}
          </div>

          {/* Mint address */}
          <div>
            <p className="text-[8px] tracking-[0.3em] mb-1.5" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>
              MINT ADDRESS
            </p>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span
                className="flex-1 text-[10px] tracking-wider break-all"
                style={{ fontFamily: 'monospace', color: '#06b6d480' }}
              >
                {MINT_PDA.toBase58()}
              </span>
              <button
                onClick={copyAddress}
                className="shrink-0 text-[8px] tracking-widest px-2 py-1 rounded transition-all duration-150"
                style={{
                  fontFamily: 'Orbitron',
                  color: copied ? '#22c55e' : '#ffffff40',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>
          </div>
        </div>

        {/* Action */}
        <div
          className="rounded-xl p-5"
          style={{
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <p className="text-[8px] tracking-[0.4em] mb-1" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
            INITIALIZE BALLISTIC MINT
          </p>
          <p className="text-[10px] mb-4" style={{ fontFamily: 'Rajdhani', color: '#ffffff40', lineHeight: 1.6 }}>
            One-time setup that creates the BALLISTIC SPL token mint on devnet.
            Only needs to be called once — subsequent calls will fail.
          </p>

          <button
            onClick={initMint}
            disabled={!canInit}
            className="w-full py-3 rounded-lg transition-all duration-200 text-[10px] tracking-[0.4em]"
            style={{
              fontFamily: 'Orbitron',
              cursor: canInit ? 'pointer' : 'not-allowed',
              color: canInit ? '#06b6d4' : '#ffffff20',
              border: `1px solid ${canInit ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}`,
              background: canInit ? 'rgba(6,182,212,0.08)' : 'rgba(0,0,0,0.3)',
              boxShadow: canInit ? '0 0 20px rgba(6,182,212,0.1)' : 'none',
            }}
            onMouseEnter={e => { if (canInit) e.currentTarget.style.background = 'rgba(6,182,212,0.15)' }}
            onMouseLeave={e => { if (canInit) e.currentTarget.style.background = 'rgba(6,182,212,0.08)' }}
          >
            {txStatus === 'sending' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                BROADCASTING...
              </span>
            ) : mintInitialized === true ? 'ALREADY INITIALIZED' : !connected ? 'CONNECT WALLET TO CONTINUE' : 'INITIALIZE MINT'}
          </button>

          {/* Feedback */}
          {txStatus === 'success' && txSig && (
            <div
              className="mt-3 p-3 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <p className="text-[8px] tracking-[0.3em] mb-1" style={{ fontFamily: 'Orbitron', color: '#22c55e80' }}>
                TRANSACTION CONFIRMED
              </p>
              <p className="text-[10px] break-all" style={{ fontFamily: 'monospace', color: '#22c55e' }}>
                {txSig}
              </p>
            </div>
          )}

          {txStatus === 'error' && errorMsg && (
            <div
              className="mt-3 p-3 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <p className="text-[8px] tracking-[0.3em] mb-1" style={{ fontFamily: 'Orbitron', color: '#ef444480' }}>
                TRANSACTION FAILED
              </p>
              <p className="text-[10px]" style={{ fontFamily: 'Rajdhani', color: '#ef4444', lineHeight: 1.5 }}>
                {errorMsg}
              </p>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div
          className="rounded-xl p-4"
          style={{
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <p className="text-[8px] tracking-[0.4em] mb-3" style={{ fontFamily: 'Orbitron', color: '#ffffff20' }}>
            TOKEN ECONOMICS
          </p>
          <div className="flex flex-col gap-2">
            {[
              ['SYMBOL', 'BALLISTIC'],
              ['DECIMALS', '9'],
              ['RATE', '1 kill = 1 token'],
              ['MINT AUTHORITY', 'Program PDA (non-upgradeable)'],
              ['NETWORK', 'Devnet'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-[8px] tracking-widest" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>{label}</span>
                <span className="text-[9px]" style={{ fontFamily: 'Rajdhani', color: '#ffffff50' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
