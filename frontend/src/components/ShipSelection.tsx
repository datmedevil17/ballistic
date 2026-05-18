import { useState, useEffect, lazy, Suspense } from 'react'
import { SHIPS, STAT_LABELS, type Ship } from '../data/ships'
import type { Screen, GameState } from '../App'
import Starfield from './Starfield'
import StatBar from './StatBar'

const ShipViewer = lazy(() => import('./ShipViewer'))

interface Props {
  gameState: GameState
  setScreen: (s: Screen) => void
  deployShip: (id: string) => void
  buyShip: (id: string, price: number) => void
}

function HexCell({ ship, isSelected, isOwned, onClick }: {
  ship: Ship
  isSelected: boolean
  isOwned: boolean
  onClick: () => void
}) {
  const W = 90
  const H = 104
  const pts = (scale: number) => {
    const cx = W / 2, cy = H / 2
    const rx = (W / 2) * scale, ry = (H / 2) * scale
    return [
      [cx, cy - ry],
      [cx + rx, cy - ry * 0.5],
      [cx + rx, cy + ry * 0.5],
      [cx, cy + ry],
      [cx - rx, cy + ry * 0.5],
      [cx - rx, cy - ry * 0.5],
    ].map(p => p.join(',')).join(' ')
  }

  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 transition-all duration-300 cursor-pointer"
      style={{
        width: W,
        height: H,
        filter: isSelected ? `drop-shadow(0 0 16px ${ship.rangerColor}) drop-shadow(0 0 32px ${ship.rangerColor}80)` : 'none',
        transform: isSelected ? 'scale(1.12) translateY(-6px)' : 'scale(1)',
        transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Outer fill */}
        <polygon
          points={pts(0.92)}
          fill={isSelected ? `${ship.rangerColor}55` : `${ship.rangerColor}18`}
          stroke={ship.rangerColor}
          strokeWidth={isSelected ? 2.5 : 1.5}
        />
        {/* Inner glow polygon when selected */}
        {isSelected && (
          <polygon
            points={pts(0.72)}
            fill="none"
            stroke={ship.rangerColor}
            strokeWidth={1}
            opacity={0.4}
          />
        )}
        {/* Lock icon */}
        {!isOwned && (
          <>
            <text x={W / 2} y={H / 2 - 4} textAnchor="middle" fontSize={16} fill={`${ship.rangerColor}80`}>⚡</text>
            <text x={W / 2} y={H / 2 + 14} textAnchor="middle" fontSize={7} fill={`${ship.rangerColor}aa`}
              fontFamily="Orbitron" fontWeight="bold" letterSpacing={1}>
              {ship.price} CR
            </text>
          </>
        )}
        {/* Ship name */}
        <text
          x={W / 2}
          y={isOwned ? H / 2 + 5 : H / 2 + 28}
          textAnchor="middle"
          fontSize={7.5}
          fill={isSelected ? '#fff' : `${ship.rangerColor}cc`}
          fontFamily="Orbitron"
          fontWeight="bold"
          letterSpacing={1}
        >
          {ship.name.toUpperCase()}
        </text>
      </svg>
    </button>
  )
}

function RangerClassBadge({ cls, color }: { cls: string; color: string }) {
  return (
    <span
      className="text-[9px] font-bold px-2.5 py-1 rounded tracking-[0.2em]"
      style={{
        fontFamily: 'Orbitron',
        color,
        border: `1px solid ${color}60`,
        background: `${color}18`,
      }}
    >
      {cls}
    </span>
  )
}

export default function ShipSelection({ gameState, setScreen, deployShip, buyShip }: Props) {
  const [activeId, setActiveId] = useState(gameState.selectedShipId)
  const [animKey, setAnimKey] = useState(0)

  const active = SHIPS.find(s => s.id === activeId)!
  const isOwned = gameState.ownedShipIds.includes(activeId)
  const isDeployed = gameState.selectedShipId === activeId
  const canAfford = gameState.coins >= active.price

  useEffect(() => {
    setAnimKey(k => k + 1)
  }, [activeId])

  const handleSelect = (id: string) => {
    setActiveId(id)
  }

  const handleAction = () => {
    if (isOwned) {
      deployShip(activeId)
    } else if (canAfford) {
      buyShip(activeId, active.price)
    } else {
      // not enough coins - flash effect handled by button state
    }
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020408] flex flex-col">
      <Starfield count={300} />
      <div className="scanlines fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
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
          <h2 className="text-sm tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#06b6d480' }}>
            CHOOSE YOUR ZORD
          </h2>
        </div>

        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ fontFamily: 'Orbitron', color: '#f59e0b' }}
        >
          <span style={{ fontSize: 10, opacity: 0.7 }}>◆</span>
          {gameState.coins.toLocaleString()} CR
        </div>
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex gap-0 min-h-0 px-4 pb-2">
        {/* 3D Viewer panel */}
        <div className="flex-1 relative min-w-0 rounded-lg overflow-hidden" style={{ border: `1px solid ${active.rangerColor}25` }}>
          {/* Ranger color corner accent */}
          <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none" style={{ zIndex: 2 }}>
            <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '48px 48px 0 0', borderColor: `${active.rangerColor}30 transparent transparent transparent` }} />
          </div>
          <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none" style={{ zIndex: 2 }}>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 0 48px 48px', borderColor: `transparent transparent ${active.rangerColor}30 transparent` }} />
          </div>

          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-xs tracking-widest animate-pulse" style={{ fontFamily: 'Orbitron', color: active.rangerColor }}>
                LOADING ZORD...
              </div>
            </div>
          }>
            <ShipViewer key={activeId} modelPath={active.modelPath} accentColor={active.rangerColor} />
          </Suspense>
        </div>

        {/* Info panel */}
        <div
          key={animKey}
          className="w-72 shrink-0 flex flex-col gap-3 pl-4"
          style={{ animation: 'appear 0.4s ease forwards' }}
        >
          {/* Ship identity */}
          <div
            className="rounded-lg p-4"
            style={{
              border: `1px solid ${active.rangerColor}30`,
              background: `linear-gradient(135deg, ${active.rangerColor}0a, rgba(0,0,0,0.6))`,
            }}
          >
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3
                  className="text-2xl font-black tracking-wider"
                  style={{ fontFamily: 'Orbitron', color: active.rangerColor }}
                >
                  {active.name.toUpperCase()}
                </h3>
                <p className="text-xs tracking-widest mt-0.5" style={{ fontFamily: 'Rajdhani', color: `${active.rangerColor}99` }}>
                  {active.rangerTitle.toUpperCase()}
                </p>
              </div>
              <RangerClassBadge cls={active.rangerClass} color={active.rangerColor} />
            </div>

            <p className="text-xs leading-relaxed mt-3" style={{ fontFamily: 'Rajdhani', color: '#94a3b8', fontSize: '13px' }}>
              {active.description}
            </p>

            <div
              className="mt-3 pt-3 flex items-center gap-2"
              style={{ borderTop: `1px solid ${active.rangerColor}20` }}
            >
              <span className="text-[9px] tracking-[0.3em]" style={{ fontFamily: 'Orbitron', color: `${active.rangerColor}70` }}>
                SPECIAL:
              </span>
              <span className="text-xs font-bold" style={{ fontFamily: 'Orbitron', color: active.rangerColor }}>
                {active.special.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div
            className="rounded-lg p-4 flex flex-col gap-3"
            style={{
              border: `1px solid ${active.rangerColor}20`,
              background: 'rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
                COMBAT STATISTICS
              </span>
              <span className="text-[9px]" style={{ fontFamily: 'Orbitron', color: `${active.rangerColor}60` }}>
                POWER: {Object.values(active.stats).reduce((a, b) => a + b, 0)}
              </span>
            </div>
            {(Object.entries(active.stats) as [keyof typeof active.stats, number][]).map(([key, val], i) => (
              <StatBar
                key={`${activeId}-${key}`}
                label={STAT_LABELS[key]}
                value={val}
                max={10}
                color={active.rangerColor}
                delay={i * 80}
              />
            ))}
          </div>

          {/* Action button */}
          <div className="mt-auto">
            {isDeployed ? (
              <div
                className="w-full py-3 rounded text-center text-xs tracking-[0.3em] font-bold"
                style={{
                  fontFamily: 'Orbitron',
                  color: active.rangerColor,
                  border: `1px solid ${active.rangerColor}50`,
                  background: `${active.rangerColor}15`,
                }}
              >
                ✓ CURRENTLY DEPLOYED
              </div>
            ) : isOwned ? (
              <button
                onClick={handleAction}
                className="w-full py-3 rounded text-xs tracking-[0.3em] font-bold transition-all duration-300"
                style={{
                  fontFamily: 'Orbitron',
                  color: '#020408',
                  background: `linear-gradient(135deg, ${active.rangerColor}, ${active.rangerAccent})`,
                  boxShadow: `0 0 20px ${active.rangerColor}60`,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 40px ${active.rangerColor}, 0 0 80px ${active.rangerColor}60` }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 20px ${active.rangerColor}60` }}
              >
                DEPLOY {active.name.toUpperCase()} ▶
              </button>
            ) : (
              <button
                onClick={handleAction}
                disabled={!canAfford}
                className="w-full py-3 rounded text-xs tracking-[0.3em] font-bold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  fontFamily: 'Orbitron',
                  color: canAfford ? '#020408' : '#f59e0b',
                  background: canAfford ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'transparent',
                  border: canAfford ? 'none' : '1px solid #f59e0b40',
                  boxShadow: canAfford ? '0 0 20px #f59e0b60' : 'none',
                }}
              >
                {canAfford ? `BUY & DEPLOY — ${active.price} CR` : `NEED ${active.price - gameState.coins} MORE CR`}
              </button>
            )}

            {!isOwned && (
              <button
                onClick={() => setScreen('shop')}
                className="w-full mt-2 py-2 text-[9px] tracking-widest transition-colors duration-200"
                style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#ffffff30' }}
              >
                VIEW IN ARMORY →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hex carousel */}
      <div
        className="relative z-10 shrink-0 pt-3 pb-4 px-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-end justify-start gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}>
          {SHIPS.map(ship => (
            <HexCell
              key={ship.id}
              ship={ship}
              isSelected={ship.id === activeId}
              isOwned={gameState.ownedShipIds.includes(ship.id)}
              onClick={() => handleSelect(ship.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
