import type { Screen, GameState } from '../App'
import { SHIPS } from '../data/ships'
import Starfield from '../components/Starfield'

interface Props {
  gameState: GameState
  setScreen: (s: Screen) => void
}

export default function GameModeSelect({ gameState, setScreen }: Props) {
  const deployed = SHIPS.find(s => s.id === gameState.selectedShipId)!

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020408] flex flex-col items-center justify-center">
      <Starfield count={280} />
      <div className="scanlines fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      <button
        onClick={() => setScreen('menu')}
        className="absolute top-6 left-6 z-10 flex items-center gap-2 text-xs tracking-widest transition-colors duration-200"
        style={{ fontFamily: 'Orbitron', color: '#ffffff50' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#06b6d4' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#ffffff50' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        BACK
      </button>

      <div className="relative z-10 flex flex-col items-center gap-10" style={{ animation: 'appear 0.5s ease forwards' }}>
        <div className="text-center flex flex-col gap-3">
          <p className="text-[10px] tracking-[0.6em]" style={{ fontFamily: 'Orbitron', color: '#06b6d450' }}>MISSION BRIEFING</p>
          <h1 className="text-3xl font-black tracking-[0.2em]"
            style={{
              fontFamily: 'Orbitron',
              background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
            SELECT GAME MODE
          </h1>
          <div className="self-center flex items-center gap-2 text-[10px] px-5 py-2 rounded"
            style={{
              fontFamily: 'Orbitron', color: deployed.rangerColor,
              border: `1px solid ${deployed.rangerColor}40`, background: `${deployed.rangerColor}0d`,
            }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: deployed.rangerColor, boxShadow: `0 0 6px ${deployed.rangerColor}` }} />
            {deployed.name.toUpperCase()} · {deployed.rangerTitle.toUpperCase()} · READY
          </div>
        </div>

        <div className="flex gap-6">
          {/* Solo — active */}
          <button
            onClick={() => setScreen('singleplayer')}
            className="w-72 p-6 rounded-xl text-left cursor-pointer transition-all duration-300"
            style={{ border: '1px solid rgba(6,182,212,0.3)', background: 'linear-gradient(160deg, rgba(6,182,212,0.08), rgba(0,0,0,0.75))' }}
            onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(6,182,212,0.9)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(6,182,212,0.2)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
            onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(6,182,212,0.3)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            <div className="h-0.5 mb-5 rounded" style={{ background: 'linear-gradient(90deg, #06b6d4, transparent)' }} />
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="1.5">
                  <polygon points="12,2 22,20 2,20" />
                  <line x1="12" y1="9" x2="12" y2="14" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black tracking-wider" style={{ fontFamily: 'Orbitron', color: '#06b6d4' }}>SOLO COMMAND</h3>
                <p className="text-[9px] tracking-[0.3em] mt-0.5" style={{ fontFamily: 'Orbitron', color: 'rgba(6,182,212,0.6)' }}>SINGLE PLAYER</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ fontFamily: 'Rajdhani', color: '#8fa3b8', fontSize: 13 }}>
              Face relentless enemy squadrons alone. Three enemy classes — scouts, fighters, heavies — each wave deadlier than the last.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['WASD MOVE', 'ENTER FIRE', 'WAVE SURVIVAL', 'GLTF ENEMIES'].map(t => (
                <span key={t} className="text-[8px] px-2 py-0.5 rounded tracking-wider"
                  style={{ fontFamily: 'Orbitron', color: 'rgba(6,182,212,0.7)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[9px] tracking-widest" style={{ fontFamily: 'Orbitron', color: 'rgba(6,182,212,0.6)' }}>
              LAUNCH MISSION →
            </div>
          </button>

          {/* Multiplayer — live */}
          <button
            onClick={() => setScreen('multiplayer')}
            className="w-72 p-6 rounded-xl text-left cursor-pointer transition-all duration-300"
            style={{ border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(160deg, rgba(139,92,246,0.08), rgba(0,0,0,0.75))' }}
            onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(139,92,246,0.9)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(139,92,246,0.2)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
            onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(139,92,246,0.3)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            <div className="h-0.5 mb-5 rounded" style={{ background: 'linear-gradient(90deg, #8b5cf6, transparent)' }} />
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
                  <circle cx="8" cy="10" r="3" /><circle cx="16" cy="10" r="3" />
                  <path d="M8 7V4m8 3V4" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black tracking-wider" style={{ fontFamily: 'Orbitron', color: '#8b5cf6' }}>BATTLE ROYALE</h3>
                <p className="text-[9px] tracking-[0.3em] mt-0.5" style={{ fontFamily: 'Orbitron', color: 'rgba(139,92,246,0.6)' }}>ONLINE MULTIPLAYER</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ fontFamily: 'Rajdhani', color: '#8fa3b8', fontSize: 13 }}>
              Every commander for themselves. Join a live arena, hunt down rivals, and claim the top of the leaderboard.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['REAL-TIME', 'PVP', 'LIVE RANKING', 'WEBSOCKET'].map(t => (
                <span key={t} className="text-[8px] px-2 py-0.5 rounded tracking-wider"
                  style={{ fontFamily: 'Orbitron', color: 'rgba(139,92,246,0.7)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[9px] tracking-widest" style={{ fontFamily: 'Orbitron', color: 'rgba(139,92,246,0.6)' }}>
              JOIN BATTLE →
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
