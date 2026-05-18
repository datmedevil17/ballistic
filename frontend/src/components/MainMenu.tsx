import type { Screen } from '../App'
import type { GameState } from '../App'
import { SHIPS } from '../data/ships'
import Starfield from './Starfield'

interface MainMenuProps {
  gameState: GameState
  setScreen: (s: Screen) => void
}

export default function MainMenu({ gameState, setScreen }: MainMenuProps) {
  const deployed = SHIPS.find(s => s.id === gameState.selectedShipId)!

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020408] flex flex-col">
      <Starfield count={400} />

      {/* Scanline overlay */}
      <div className="scanlines fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Top nav */}
      <div className="relative z-10 flex justify-between items-start p-6">
        <button
          onClick={() => setScreen('profile')}
          className="group flex items-center gap-2 px-5 py-2.5 rounded border text-xs tracking-[0.2em] transition-all duration-300"
          style={{
            fontFamily: 'Orbitron',
            borderColor: '#ffffff20',
            color: '#94a3b8',
            background: 'rgba(0,0,0,0.4)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = '#06b6d4'
            el.style.color = '#06b6d4'
            el.style.boxShadow = '0 0 20px #06b6d440'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = '#ffffff20'
            el.style.color = '#94a3b8'
            el.style.boxShadow = 'none'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          PROFILE
        </button>

        {/* Credits display */}
        <div
          className="flex items-center gap-2 px-4 py-2 rounded border text-xs"
          style={{
            fontFamily: 'Orbitron',
            borderColor: '#f59e0b40',
            color: '#f59e0b',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
            <text x="12" y="16" textAnchor="middle" fill="#000" fontSize="10" fontWeight="bold">$</text>
          </svg>
          {gameState.coins.toLocaleString()} CR
        </div>

        <button
          onClick={() => setScreen('shop')}
          className="group flex items-center gap-2 px-5 py-2.5 rounded border text-xs tracking-[0.2em] transition-all duration-300"
          style={{
            fontFamily: 'Orbitron',
            borderColor: '#ffffff20',
            color: '#94a3b8',
            background: 'rgba(0,0,0,0.4)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.borderColor = '#f59e0b'
            el.style.color = '#f59e0b'
            el.style.boxShadow = '0 0 20px #f59e0b40'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.borderColor = '#ffffff20'
            el.style.color = '#94a3b8'
            el.style.boxShadow = 'none'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          ARMORY
        </button>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8">
        {/* Game title */}
        <div className="text-center" style={{ animation: 'appear 1s ease forwards' }}>
          <div className="relative">
            <h1
              className="font-black tracking-[0.15em] select-none"
              style={{
                fontFamily: 'Orbitron',
                fontSize: 'clamp(3rem, 10vw, 7rem)',
                background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 40%, #ec4899 70%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 30px #06b6d480) drop-shadow(0 0 60px #8b5cf640)',
                backgroundSize: '200% 200%',
                animation: 'appear 1s ease forwards',
              }}
            >
              BALLISTIC
            </h1>
            {/* Decorative lines */}
            <div className="flex items-center gap-4 mt-1 justify-center">
              <div className="h-px flex-1 max-w-32" style={{ background: 'linear-gradient(to right, transparent, #06b6d440)' }} />
              <span className="text-[10px] tracking-[0.6em]" style={{ fontFamily: 'Orbitron', color: '#06b6d480' }}>
                SPACE WARFARE · BEYOND
              </span>
              <div className="h-px flex-1 max-w-32" style={{ background: 'linear-gradient(to left, transparent, #06b6d440)' }} />
            </div>
          </div>
        </div>

        {/* Play button */}
        <button
          onClick={() => setScreen('game_mode_select')}
          className="relative group px-16 py-5 rounded text-lg font-bold tracking-[0.3em] transition-all duration-300 overflow-hidden"
          style={{
            fontFamily: 'Orbitron',
            color: '#020408',
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            boxShadow: '0 0 30px #06b6d460, 0 0 60px #06b6d430',
            animation: 'appear 1s 0.3s ease both',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 0 50px #06b6d4, 0 0 100px #06b6d460, 0 0 150px #06b6d430'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 0 30px #06b6d460, 0 0 60px #06b6d430'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <span className="relative z-10 flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            PLAY
          </span>
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
            }}
          />
        </button>

        {/* Deployed ship indicator */}
        <div
          className="flex flex-col items-center gap-1 px-8 py-4 rounded border"
          style={{
            borderColor: `${deployed.rangerColor}40`,
            background: `${deployed.rangerColor}0a`,
            animation: 'appear 1s 0.5s ease both',
          }}
        >
          <span className="text-[9px] tracking-[0.4em]" style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}>
            DEPLOYED SHIP
          </span>
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: deployed.rangerColor,
                boxShadow: `0 0 8px ${deployed.rangerColor}`,
                animation: 'hex-pulse 2s ease-in-out infinite',
              }}
            />
            <span className="text-sm font-bold" style={{ fontFamily: 'Orbitron', color: deployed.rangerColor }}>
              {deployed.name.toUpperCase()}
            </span>
            <span className="text-[10px]" style={{ fontFamily: 'Orbitron', color: '#ffffff40' }}>
              {deployed.rangerTitle.toUpperCase()}
            </span>
          </div>
          <button
            onClick={() => setScreen('selection')}
            className="text-[9px] tracking-[0.3em] mt-1 transition-colors duration-200"
            style={{ fontFamily: 'Orbitron', color: '#ffffff30' }}
            onMouseEnter={e => { e.currentTarget.style.color = deployed.rangerColor }}
            onMouseLeave={e => { e.currentTarget.style.color = '#ffffff30' }}
          >
            CHANGE SHIP →
          </button>
        </div>
      </div>

      {/* Bottom credits */}
      <div className="relative z-10 flex justify-center pb-4">
        <span className="text-[9px] tracking-widest" style={{ fontFamily: 'Orbitron', color: '#ffffff15' }}>
          BALLISTIC © 2025 · ALL SYSTEMS NOMINAL
        </span>
      </div>
    </div>
  )
}
