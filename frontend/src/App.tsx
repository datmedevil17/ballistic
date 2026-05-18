import { useState } from 'react'
import MainMenu from './components/MainMenu'
import ShipSelection from './components/ShipSelection'
import Shop from './components/Shop'
import Profile from './components/Profile'
import GameModeSelect from './game/GameModeSelect'
import Game from './game/Game'

export type Screen =
  | 'menu'
  | 'selection'
  | 'shop'
  | 'profile'
  | 'game_mode_select'
  | 'singleplayer'

export interface GameState {
  selectedShipId: string
  ownedShipIds: string[]
  coins: number
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [gameState, setGameState] = useState<GameState>({
    selectedShipId: 'bob',
    ownedShipIds: ['bob'],
    coins: 1000,
  })

  const buyShip = (shipId: string, price: number) => {
    setGameState(prev => ({
      ...prev,
      coins: prev.coins - price,
      ownedShipIds: [...prev.ownedShipIds, shipId],
    }))
  }

  const deployShip = (shipId: string) => {
    setGameState(prev => ({ ...prev, selectedShipId: shipId }))
    setScreen('menu')
  }

  const shared = { gameState, setScreen, buyShip, deployShip }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#020408' }}>
      {screen === 'menu' && <MainMenu gameState={gameState} setScreen={setScreen} />}
      {screen === 'selection' && <ShipSelection {...shared} />}
      {screen === 'shop' && <Shop gameState={gameState} setScreen={setScreen} buyShip={buyShip} />}
      {screen === 'profile' && <Profile gameState={gameState} setScreen={setScreen} />}
      {screen === 'game_mode_select' && <GameModeSelect gameState={gameState} setScreen={setScreen} />}
      {screen === 'singleplayer' && (
        <Game key="sp" gameState={gameState} setScreen={setScreen} />
      )}
    </div>
  )
}
