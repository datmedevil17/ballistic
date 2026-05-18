import { lazy, Suspense } from 'react'
import { SHIPS } from '../data/ships'
import type { Screen, GameState } from '../App'
import Starfield from './Starfield'
import StatBar from './StatBar'

const ShipViewer = lazy(() => import('./ShipViewer'))

interface Props {
  gameState: GameState
  setScreen: (s: Screen) => void
}

export default function Profile({ gameState, setScreen }: Props) {
  const deployed = SHIPS.find(s => s.id === gameState.selectedShipId)!
  const owned = SHIPS.filter(s => gameState.ownedShipIds.includes(s.id))
  const totalPower = Object.values(deployed.stats).reduce((a, b) => a + b, 0)
  const fleetPower = owned.reduce((acc, s) => acc + Object.values(s.stats).reduce((a, b) => a + b, 0), 0)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020408] flex flex-col">
      <Starfield count={200} />
      <div className="scanlines fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
          <h1 className="text-base tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#8b5cf6' }}>
            COMMANDER
          </h1>
          <p className="text-[9px] tracking-[0.3em] mt-0.5" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
            PILOT PROFILE
          </p>
        </div>

        <div className="w-24" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 flex flex-col gap-5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff15 transparent' }}>

        {/* Commander info */}
        <div
          className="rounded-xl p-5 flex items-center gap-5"
          style={{
            border: '1px solid rgba(139,92,246,0.3)',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(0,0,0,0.6))',
          }}
        >
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
            style={{
              border: '2px solid #8b5cf6',
              background: 'rgba(139,92,246,0.2)',
              boxShadow: '0 0 20px #8b5cf640',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-black tracking-wider mb-1" style={{ fontFamily: 'Orbitron', color: '#e2e8f0' }}>
              COMMANDER
            </h2>
            <div className="flex flex-wrap gap-3">
              <Stat label="CREDITS" value={`◆ ${gameState.coins.toLocaleString()} CR`} color="#f59e0b" />
              <Stat label="FLEET SIZE" value={`${owned.length} SHIP${owned.length !== 1 ? 'S' : ''}`} color="#8b5cf6" />
              <Stat label="FLEET POWER" value={`${fleetPower} PWR`} color="#06b6d4" />
            </div>
          </div>
        </div>

        {/* Deployed ship */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${deployed.rangerColor}40`,
            background: `linear-gradient(135deg, ${deployed.rangerColor}0a, rgba(0,0,0,0.7))`,
          }}
        >
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{ borderBottom: `1px solid ${deployed.rangerColor}20` }}
          >
            <span className="text-[9px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: `${deployed.rangerColor}80` }}>
              ACTIVE DEPLOYMENT
            </span>
            <div
              className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded"
              style={{ fontFamily: 'Orbitron', color: deployed.rangerColor, border: `1px solid ${deployed.rangerColor}40`, background: `${deployed.rangerColor}15` }}
            >
              <span style={{ animation: 'hex-pulse 1.5s ease-in-out infinite' }}>▶</span>
              LIVE
            </div>
          </div>

          <div className="flex gap-0 min-h-0">
            {/* 3D viewer */}
            <div className="h-52 flex-1">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[9px] animate-pulse" style={{ fontFamily: 'Orbitron', color: deployed.rangerColor }}>LOADING...</span>
                </div>
              }>
                <ShipViewer modelPath={deployed.modelPath} accentColor={deployed.rangerColor} />
              </Suspense>
            </div>

            {/* Ship info */}
            <div className="w-56 p-4 flex flex-col gap-3 shrink-0">
              <div>
                <h3 className="text-lg font-black tracking-wider" style={{ fontFamily: 'Orbitron', color: deployed.rangerColor }}>
                  {deployed.name.toUpperCase()}
                </h3>
                <p className="text-[9px] tracking-widest mt-0.5" style={{ fontFamily: 'Orbitron', color: `${deployed.rangerColor}70` }}>
                  {deployed.rangerTitle}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {(Object.entries(deployed.stats) as [string, number][]).map(([key, val], i) => (
                  <StatBar
                    key={key}
                    label={key.slice(0, 3).toUpperCase()}
                    value={val}
                    max={10}
                    color={deployed.rangerColor}
                    delay={i * 80}
                  />
                ))}
              </div>

              <div className="mt-auto pt-2" style={{ borderTop: `1px solid ${deployed.rangerColor}20` }}>
                <p className="text-[8px] tracking-[0.2em] mb-0.5" style={{ fontFamily: 'Orbitron', color: `${deployed.rangerColor}60` }}>
                  SPECIAL
                </p>
                <p className="text-[10px] font-bold" style={{ fontFamily: 'Orbitron', color: deployed.rangerColor }}>
                  {deployed.special.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: `1px solid ${deployed.rangerColor}20` }}>
            <button
              onClick={() => setScreen('selection')}
              className="text-[9px] tracking-wider transition-colors duration-200"
              style={{ fontFamily: 'Orbitron', color: `${deployed.rangerColor}70` }}
              onMouseEnter={e => { e.currentTarget.style.color = deployed.rangerColor }}
              onMouseLeave={e => { e.currentTarget.style.color = `${deployed.rangerColor}70` }}
            >
              CHANGE SHIP →
            </button>
            <span style={{ color: '#ffffff20', fontSize: 12 }}>|</span>
            <span className="text-[9px]" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
              POWER: {totalPower}
            </span>
          </div>
        </div>

        {/* Fleet */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[9px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
              YOUR FLEET
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-[9px]" style={{ fontFamily: 'Orbitron', color: '#ffffff20' }}>
              {owned.length} / {SHIPS.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {SHIPS.map(ship => {
              const hasIt = gameState.ownedShipIds.includes(ship.id)
              return (
                <div
                  key={ship.id}
                  className="flex items-center gap-2 px-3 py-2 rounded transition-all duration-200"
                  style={{
                    border: hasIt ? `1px solid ${ship.rangerColor}50` : '1px solid rgba(255,255,255,0.06)',
                    background: hasIt ? `${ship.rangerColor}10` : 'rgba(0,0,0,0.3)',
                    opacity: hasIt ? 1 : 0.4,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: hasIt ? ship.rangerColor : '#374151',
                      boxShadow: hasIt ? `0 0 6px ${ship.rangerColor}` : 'none',
                    }}
                  />
                  <span
                    className="text-[9px] font-bold tracking-wider"
                    style={{ fontFamily: 'Orbitron', color: hasIt ? ship.rangerColor : '#374151' }}
                  >
                    {ship.name.toUpperCase()}
                  </span>
                  {!hasIt && (
                    <span className="text-[8px]" style={{ fontFamily: 'Orbitron', color: '#374151' }}>
                      ⚡ {ship.price}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {owned.length < SHIPS.length && (
            <button
              onClick={() => setScreen('shop')}
              className="mt-3 text-[9px] tracking-wider transition-colors duration-200 flex items-center gap-2"
              style={{ fontFamily: 'Orbitron', color: '#f59e0b60' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#f59e0b60' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              EXPAND FLEET — VISIT ARMORY
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] tracking-[0.3em]" style={{ fontFamily: 'Orbitron', color: '#ffffff40' }}>{label}</span>
      <span className="text-xs font-bold" style={{ fontFamily: 'Orbitron', color }}>{value}</span>
    </div>
  )
}
