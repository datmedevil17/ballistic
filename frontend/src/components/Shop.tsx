import { lazy, Suspense, useState } from 'react'
import { SHIPS, type Ship } from '../data/ships'
import type { Screen, GameState } from '../App'
import Starfield from './Starfield'
import StatBar from './StatBar'

const ShipViewer = lazy(() => import('./ShipViewer'))

interface Props {
  gameState: GameState
  setScreen: (s: Screen) => void
  buyShip: (id: string, price: number) => void
}

function ShipCard({ ship, isOwned, isDeployed, canAfford, onBuy, onPreview }: {
  ship: Ship
  isOwned: boolean
  isDeployed: boolean
  canAfford: boolean
  onBuy: () => void
  onPreview: () => void
}) {
  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer transition-all duration-300 group"
      style={{
        border: `1px solid ${isOwned ? `${ship.rangerColor}60` : `${ship.rangerColor}25`}`,
        background: `linear-gradient(160deg, ${ship.rangerColor}08, rgba(0,0,0,0.7))`,
      }}
      onClick={onPreview}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid ${ship.rangerColor}80`
        e.currentTarget.style.boxShadow = `0 0 20px ${ship.rangerColor}20`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = `1px solid ${isOwned ? `${ship.rangerColor}60` : `${ship.rangerColor}25`}`
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Top accent bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${ship.rangerColor}, transparent)` }} />

      {/* Owned / deployed badge */}
      {isOwned && (
        <div
          className="absolute top-2 right-2 text-[8px] px-2 py-0.5 rounded tracking-wider z-10"
          style={{
            fontFamily: 'Orbitron',
            color: isDeployed ? '#020408' : ship.rangerColor,
            background: isDeployed ? ship.rangerColor : `${ship.rangerColor}25`,
            border: isDeployed ? 'none' : `1px solid ${ship.rangerColor}50`,
          }}
        >
          {isDeployed ? '▶ DEPLOYED' : '✓ OWNED'}
        </div>
      )}

      <div className="p-3">
        {/* Ship name & class */}
        <div className="mb-2">
          <h3 className="font-bold text-sm tracking-wider" style={{ fontFamily: 'Orbitron', color: ship.rangerColor }}>
            {ship.name.toUpperCase()}
          </h3>
          <p className="text-[9px] tracking-[0.2em] mt-0.5" style={{ fontFamily: 'Orbitron', color: `${ship.rangerColor}70` }}>
            {ship.rangerTitle}
          </p>
        </div>

        {/* Mini stat bars */}
        <div className="flex flex-col gap-1.5 mb-3">
          {(Object.entries(ship.stats) as [string, number][]).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[8px] w-7 text-right" style={{ fontFamily: 'Orbitron', color: `${ship.rangerColor}80` }}>
                {key.slice(0, 3).toUpperCase()}
              </span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${val * 10}%`,
                    background: `linear-gradient(90deg, ${ship.rangerColor}60, ${ship.rangerColor})`,
                  }}
                />
              </div>
              <span className="text-[8px] w-3 tabular-nums" style={{ fontFamily: 'Orbitron', color: `${ship.rangerColor}80` }}>
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Price / action */}
        {isOwned ? (
          <div
            className="text-center py-1.5 rounded text-[9px] tracking-wider"
            style={{ fontFamily: 'Orbitron', color: `${ship.rangerColor}80`, border: `1px solid ${ship.rangerColor}25` }}
          >
            IN FLEET
          </div>
        ) : ship.price === 0 ? (
          <div className="text-center py-1.5 text-[9px]" style={{ fontFamily: 'Orbitron', color: '#22c55e' }}>
            FREE — STARTER
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onBuy() }}
            disabled={!canAfford}
            className="w-full py-1.5 rounded text-[9px] tracking-wider font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              fontFamily: 'Orbitron',
              color: canAfford ? '#020408' : '#f59e0b',
              background: canAfford ? `linear-gradient(135deg, ${ship.rangerColor}, ${ship.rangerAccent})` : 'transparent',
              border: canAfford ? 'none' : '1px solid #f59e0b40',
              boxShadow: canAfford ? `0 0 12px ${ship.rangerColor}50` : 'none',
            }}
          >
            {canAfford ? `◆ ${ship.price} CR` : `◆ ${ship.price} CR`}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Shop({ gameState, setScreen, buyShip }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = previewId ? SHIPS.find(s => s.id === previewId) : null

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
          <h1 className="text-base tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#f59e0b' }}>
            ARMORY
          </h1>
          <p className="text-[9px] tracking-[0.3em] mt-0.5" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
            EXPAND YOUR FLEET
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded" style={{ border: '1px solid #f59e0b30', background: '#f59e0b0a' }}>
          <span style={{ color: '#f59e0b', fontSize: 12, fontFamily: 'Orbitron' }}>◆</span>
          <span className="text-sm font-bold" style={{ fontFamily: 'Orbitron', color: '#f59e0b' }}>
            {gameState.coins.toLocaleString()}
          </span>
          <span className="text-[9px]" style={{ fontFamily: 'Orbitron', color: '#f59e0b60' }}>CR</span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* Ship grid */}
        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff15 transparent' }}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {SHIPS.map(ship => (
              <ShipCard
                key={ship.id}
                ship={ship}
                isOwned={gameState.ownedShipIds.includes(ship.id)}
                isDeployed={gameState.selectedShipId === ship.id}
                canAfford={gameState.coins >= ship.price}
                onBuy={() => buyShip(ship.id, ship.price)}
                onPreview={() => setPreviewId(previewId === ship.id ? null : ship.id)}
              />
            ))}
          </div>
        </div>

        {/* Preview panel */}
        {preview && (
          <div
            className="w-80 shrink-0 flex flex-col"
            style={{
              borderLeft: `1px solid ${preview.rangerColor}20`,
              background: `linear-gradient(180deg, ${preview.rangerColor}06, rgba(0,0,0,0.8))`,
              animation: 'appear 0.3s ease forwards',
            }}
          >
            {/* 3D viewer */}
            <div className="h-56 relative">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[9px] animate-pulse tracking-widest" style={{ fontFamily: 'Orbitron', color: preview.rangerColor }}>
                    LOADING...
                  </span>
                </div>
              }>
                <ShipViewer key={preview.id} modelPath={preview.modelPath} accentColor={preview.rangerColor} />
              </Suspense>
              <button
                onClick={() => setPreviewId(null)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-xs transition-colors"
                style={{ color: '#ffffff50', background: 'rgba(0,0,0,0.6)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#ffffff50' }}
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-black tracking-wider" style={{ fontFamily: 'Orbitron', color: preview.rangerColor }}>
                    {preview.name.toUpperCase()}
                  </h3>
                  <span className="text-[8px] px-2 py-0.5 rounded tracking-wider" style={{
                    fontFamily: 'Orbitron', color: preview.rangerColor,
                    border: `1px solid ${preview.rangerColor}40`, background: `${preview.rangerColor}15`
                  }}>
                    {preview.rangerClass}
                  </span>
                </div>
                <p className="text-[9px] tracking-widest mb-3" style={{ fontFamily: 'Orbitron', color: `${preview.rangerColor}70` }}>
                  {preview.rangerTitle.toUpperCase()}
                </p>
                <p className="text-xs leading-relaxed" style={{ fontFamily: 'Rajdhani', color: '#94a3b8', fontSize: 13 }}>
                  {preview.description}
                </p>
              </div>

              <div>
                <span className="text-[9px] tracking-[0.4em] block mb-2" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>
                  COMBAT STATS
                </span>
                <div className="flex flex-col gap-2">
                  {(Object.entries(preview.stats) as [string, number][]).map(([key, val], i) => (
                    <StatBar
                      key={`${preview.id}-${key}`}
                      label={key.slice(0, 3).toUpperCase()}
                      value={val}
                      max={10}
                      color={preview.rangerColor}
                      delay={i * 60}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2" style={{ borderTop: `1px solid ${preview.rangerColor}20` }}>
                <p className="text-[9px] tracking-[0.2em] mb-1" style={{ fontFamily: 'Orbitron', color: `${preview.rangerColor}60` }}>
                  SPECIAL ABILITY
                </p>
                <p className="text-xs font-bold" style={{ fontFamily: 'Orbitron', color: preview.rangerColor }}>
                  {preview.special.toUpperCase()}
                </p>
              </div>

              {!gameState.ownedShipIds.includes(preview.id) && preview.price > 0 && (
                <button
                  onClick={() => {
                    if (gameState.coins >= preview.price) {
                      buyShip(preview.id, preview.price)
                      setPreviewId(null)
                    }
                  }}
                  disabled={gameState.coins < preview.price}
                  className="w-full py-3 rounded text-xs font-bold tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: 'Orbitron',
                    color: gameState.coins >= preview.price ? '#020408' : '#f59e0b',
                    background: gameState.coins >= preview.price
                      ? `linear-gradient(135deg, ${preview.rangerColor}, ${preview.rangerAccent})`
                      : 'transparent',
                    border: gameState.coins >= preview.price ? 'none' : '1px solid #f59e0b40',
                    boxShadow: gameState.coins >= preview.price ? `0 0 20px ${preview.rangerColor}60` : 'none',
                  }}
                >
                  {gameState.coins >= preview.price
                    ? `ACQUIRE — ◆ ${preview.price} CR`
                    : `INSUFFICIENT CREDITS`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
