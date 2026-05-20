import { useState, useEffect } from 'react'
import MainMenu from './components/MainMenu'
import ShipSelection from './components/ShipSelection'
import Shop from './components/Shop'
import Profile from './components/Profile'
import GameModeSelect from './game/GameModeSelect'
import Game from './game/Game'
import MultiplayerGame from './game/MultiplayerGame'
import MintPage from './components/MintPage'
import TestPage from './components/TestPage'
import { TxToastContainer } from './components/TxToast'

export type Screen =
  | 'menu'
  | 'selection'
  | 'shop'
  | 'profile'
  | 'game_mode_select'
  | 'singleplayer'
  | 'multiplayer'
  | 'mint'
  | 'test'

export interface GameState {
  selectedShipId: string
  ownedShipIds: string[]
  coins: number
  aiTier: 1 | 2 | 3
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (window.location.hash === '#mint') return 'mint'
    if (window.location.hash === '#test') return 'test'
    return 'menu'
  })
  const [gameState, setGameState] = useState<GameState>({
    selectedShipId: 'bob',
    ownedShipIds: ['bob'],
    coins: 1000,
    aiTier: 1,
  })

  useEffect(() => {
    const handler = () => {
      if (window.location.hash === '#mint') setScreen('mint')
      else if (window.location.hash === '#test') setScreen('test')
      else setScreen(s => (s === 'mint' || s === 'test') ? 'menu' : s)
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = (s: Screen) => {
    if (s === 'mint') window.location.hash = 'mint'
    else if (s === 'test') window.location.hash = 'test'
    else window.location.hash = ''
    setScreen(s)
  }

  const buyShip = (shipId: string, price: number) => {
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - price,
      ownedShipIds: [...prev.ownedShipIds, shipId],
    }))
  }

  const deployShip = (shipId: string) => {
    setGameState(prev => ({ ...prev, selectedShipId: shipId }))
    navigate('menu')
  }

  const upgradeAiTier = (tier: 2 | 3, cost: number) => {
    setGameState(prev => ({ ...prev, coins: prev.coins - cost, aiTier: tier }))
  }

  const shared = { gameState, setScreen: navigate, buyShip, deployShip }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#020408' }}>
      {screen === 'menu' && <MainMenu gameState={gameState} setScreen={navigate} />}
      {screen === 'selection' && <ShipSelection {...shared} />}
      {screen === 'shop' && <Shop gameState={gameState} setScreen={navigate} buyShip={buyShip} upgradeAiTier={upgradeAiTier} />}
      {screen === 'profile' && <Profile gameState={gameState} setScreen={navigate} />}
      {screen === 'game_mode_select' && <GameModeSelect gameState={gameState} setScreen={navigate} />}
      {screen === 'singleplayer' && (
        <Game key="sp" gameState={gameState} setScreen={navigate} />
      )}
      {screen === 'multiplayer' && (
        <MultiplayerGame key="mp" gameState={gameState} setScreen={navigate} />
      )}
      {screen === 'mint' && <MintPage setScreen={navigate} />}
      {screen === 'test' && <TestPage setScreen={navigate} />}
      <TxToastContainer />
    </div>
  )
}
