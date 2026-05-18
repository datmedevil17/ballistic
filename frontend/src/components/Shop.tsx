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
  upgradeAiTier: (tier: 2 | 3, cost: number) => void
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

const AI_TIERS = [
  {
    tier: 2 as const,
    cost: 500,
    name: 'TACTICAL CORE',
    color: '#8b5cf6',
    accent: '#a78bfa',
    badge: 'TIER II',
    desc: 'Grants your AI pilot awareness of nearby enemy positions and health within 30 units. Enables targeted behavior like hunting wounded ships.',
    features: ['Nearby enemy positions', 'Enemy HP readout', 'Range-filtered intel (30u)'],
  },
  {
    tier: 3 as const,
    cost: 1500,
    name: 'SUPREME INTEL',
    color: '#f59e0b',
    accent: '#fbbf24',
    badge: 'TIER III',
    desc: 'Full battlefield awareness. All enemies on the map including velocity vectors and heading. Your AI sees everything.',
    features: ['All enemies on map', 'Velocity + heading data', 'Predictive intercept info'],
    requires: 2,
  },
]

export default function Shop({ gameState, setScreen, buyShip, upgradeAiTier }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [tab, setTab]             = useState<'ships' | 'ai'>('ships')
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

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-base tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#f59e0b' }}>
            ARMORY
          </h1>
          <div className="flex gap-1">
            {(['ships', 'ai'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setPreviewId(null) }}
                className="text-[8px] px-3 py-1 rounded tracking-widest transition-all duration-200"
                style={{
                  fontFamily: 'Orbitron',
                  color:      tab === t ? '#020408' : '#ffffff40',
                  background: tab === t ? (t === 'ai' ? 'linear-gradient(135deg,#8b5cf6,#f59e0b)' : '#f59e0b') : 'transparent',
                  border:     tab === t ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>
                {t === 'ships' ? 'SHIPS' : 'AI SYSTEMS'}
              </button>
            ))}
          </div>
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
        {tab === 'ships' && (
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
        )}

        {/* AI Systems tab */}
        {tab === 'ai' && (
        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff15 transparent' }}>
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            <div className="text-center mb-2">
              <p className="text-[9px] tracking-[0.5em]" style={{ fontFamily: 'Orbitron', color: '#ffffff25' }}>
                UPGRADE YOUR AI PILOT WITH BETTER BATTLEFIELD INTELLIGENCE
              </p>
            </div>

            {/* Current tier badge */}
            <div className="flex items-center justify-center gap-3 py-3 rounded-lg"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: gameState.aiTier === 3 ? '#f59e0b' : gameState.aiTier === 2 ? '#8b5cf6' : '#06b6d4', boxShadow: `0 0 8px currentColor` }} />
              <span className="text-[10px] tracking-widest" style={{ fontFamily: 'Orbitron', color: '#ffffff60' }}>
                CURRENT: {gameState.aiTier === 3 ? 'TIER III · SUPREME INTEL' : gameState.aiTier === 2 ? 'TIER II · TACTICAL CORE' : 'TIER I · BASIC'}
              </span>
            </div>

            {AI_TIERS.map(({ tier, cost, name, color, accent, badge, desc, features, requires }) => {
              const owned    = gameState.aiTier >= tier
              const locked   = requires !== undefined && gameState.aiTier < requires
              const canAfford = gameState.coins >= cost && !locked && !owned
              return (
                <div key={tier} className="rounded-xl overflow-hidden"
                  style={{
                    border: `1px solid ${owned ? color + '60' : color + '25'}`,
                    background: `linear-gradient(160deg, ${color}08, rgba(0,0,0,0.7))`,
                    opacity: locked ? 0.45 : 1,
                  }}>
                  <div className="h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] px-2 py-0.5 rounded tracking-widest"
                            style={{ fontFamily: 'Orbitron', color, border: `1px solid ${color}40`, background: `${color}15` }}>
                            {badge}
                          </span>
                          {owned && <span className="text-[8px] tracking-widest" style={{ fontFamily: 'Orbitron', color: '#22c55e' }}>✓ INSTALLED</span>}
                          {locked && <span className="text-[8px] tracking-widest" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>🔒 REQUIRES TIER II</span>}
                        </div>
                        <h3 className="text-lg font-black tracking-wider" style={{ fontFamily: 'Orbitron', color }}>{name}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] tracking-wider" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>COST</p>
                        <p className="text-base font-bold" style={{ fontFamily: 'Orbitron', color: '#f59e0b' }}>◆ {cost.toLocaleString()}</p>
                      </div>
                    </div>

                    <p className="text-sm mb-4 leading-relaxed" style={{ fontFamily: 'Rajdhani', color: '#8fa3b8', fontSize: 13 }}>{desc}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {features.map(f => (
                        <span key={f} className="text-[8px] px-2 py-0.5 rounded tracking-wider"
                          style={{ fontFamily: 'Orbitron', color: color + 'aa', border: `1px solid ${color}25` }}>
                          {f}
                        </span>
                      ))}
                    </div>

                    {!owned && (
                      <button
                        disabled={!canAfford}
                        onClick={() => { if (canAfford) upgradeAiTier(tier, cost) }}
                        className="w-full py-2.5 rounded text-[10px] font-bold tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          fontFamily: 'Orbitron',
                          color:      canAfford ? '#020408' : accent,
                          background: canAfford ? `linear-gradient(135deg, ${color}, ${accent})` : 'transparent',
                          border:     canAfford ? 'none' : `1px solid ${color}40`,
                          boxShadow:  canAfford ? `0 0 20px ${color}50` : 'none',
                        }}>
                        {locked ? 'LOCKED' : !canAfford && gameState.coins < cost ? 'INSUFFICIENT CREDITS' : `INSTALL — ◆ ${cost.toLocaleString()} CR`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}

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
