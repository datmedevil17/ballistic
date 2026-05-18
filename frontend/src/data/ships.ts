export interface ShipStats {
  speed: number
  damage: number
  fireRate: number
  shield: number
  agility: number
}

export interface Ship {
  id: string
  name: string
  modelPath: string
  rangerColor: string
  rangerAccent: string
  rangerTitle: string
  rangerClass: string
  price: number
  stats: ShipStats
  description: string
  special: string
}

// All ships have total stat points = 30 for balanced beginner play
// Each ship specializes differently so advanced players feel the difference
export const SHIPS: Ship[] = [
  {
    id: 'bob',
    name: 'Bob',
    modelPath: '/Bob.gltf',
    rangerColor: '#64748b',
    rangerAccent: '#94a3b8',
    rangerTitle: 'Silver Guardian',
    rangerClass: 'BALANCED',
    price: 0,
    stats: { speed: 6, damage: 6, fireRate: 6, shield: 6, agility: 6 },
    description: 'The reliable starting companion. Perfectly balanced across all systems — the ideal ship for learning the ropes of interstellar combat.',
    special: 'System Boost',
  },
  {
    id: 'striker',
    name: 'Striker',
    modelPath: '/Striker.gltf',
    rangerColor: '#dc2626',
    rangerAccent: '#ef4444',
    rangerTitle: 'Red Vanguard',
    rangerClass: 'SPEEDSTER',
    price: 500,
    stats: { speed: 9, damage: 6, fireRate: 7, shield: 3, agility: 5 },
    description: 'Born for the hunt. The Striker blitzes through enemy formations at blistering velocity — strike fast, strike first.',
    special: 'Afterburner Rush',
  },
  {
    id: 'challenger',
    name: 'Challenger',
    modelPath: '/Challenger.gltf',
    rangerColor: '#2563eb',
    rangerAccent: '#3b82f6',
    rangerTitle: 'Blue Sentinel',
    rangerClass: 'FIGHTER',
    price: 600,
    stats: { speed: 6, damage: 7, fireRate: 6, shield: 5, agility: 6 },
    description: 'The Challenger stands its ground. A seasoned warrior with a decisive edge in direct confrontation.',
    special: 'Combat Matrix',
  },
  {
    id: 'dispatcher',
    name: 'Dispatcher',
    modelPath: '/Dispatcher.gltf',
    rangerColor: '#ca8a04',
    rangerAccent: '#eab308',
    rangerTitle: 'Yellow Tactician',
    rangerClass: 'RAPID FIRE',
    price: 550,
    stats: { speed: 5, damage: 4, fireRate: 9, shield: 5, agility: 7 },
    description: 'Rapid-fire precision. The Dispatcher overwhelms foes with a relentless barrage while dancing through return fire.',
    special: 'Turret Overload',
  },
  {
    id: 'executioner',
    name: 'Executioner',
    modelPath: '/Executioner.gltf',
    rangerColor: '#1f2937',
    rangerAccent: '#6b7280',
    rangerTitle: 'Black Predator',
    rangerClass: 'HEAVY',
    price: 800,
    stats: { speed: 3, damage: 10, fireRate: 3, shield: 9, agility: 5 },
    description: 'One shot. One kill. The Executioner is armored like a fortress and fires with devastating singular power.',
    special: 'Death Charge',
  },
  {
    id: 'imperial',
    name: 'Imperial',
    modelPath: '/Imperial.gltf',
    rangerColor: '#92400e',
    rangerAccent: '#f59e0b',
    rangerTitle: 'Gold Commander',
    rangerClass: 'TANK',
    price: 900,
    stats: { speed: 3, damage: 5, fireRate: 5, shield: 10, agility: 7 },
    description: 'An impenetrable fortress among the stars. The Imperial\'s shield matrix absorbs punishment no other ship can withstand.',
    special: 'Imperial Aegis',
  },
  {
    id: 'insurgent',
    name: 'Insurgent',
    modelPath: '/Insurgent.gltf',
    rangerColor: '#15803d',
    rangerAccent: '#22c55e',
    rangerTitle: 'Green Phantom',
    rangerClass: 'ASSASSIN',
    price: 750,
    stats: { speed: 8, damage: 9, fireRate: 5, shield: 2, agility: 6 },
    description: 'Glass cannon at its finest. The Insurgent hits with devastating force — but one mistake is all it takes.',
    special: 'Ghost Protocol',
  },
  {
    id: 'omen',
    name: 'Omen',
    modelPath: '/Omen.gltf',
    rangerColor: '#6d28d9',
    rangerAccent: '#8b5cf6',
    rangerTitle: 'Purple Wraith',
    rangerClass: 'EVASION',
    price: 700,
    stats: { speed: 8, damage: 6, fireRate: 4, shield: 5, agility: 7 },
    description: 'Swift and elusive. The Omen dances through enemy fire, striking from impossible angles before vanishing.',
    special: 'Shadow Step',
  },
  {
    id: 'pancake',
    name: 'Pancake',
    modelPath: '/Pancake.gltf',
    rangerColor: '#be185d',
    rangerAccent: '#ec4899',
    rangerTitle: 'Pink Devastator',
    rangerClass: 'SUPPRESSOR',
    price: 650,
    stats: { speed: 4, damage: 6, fireRate: 9, shield: 5, agility: 6 },
    description: 'Don\'t let the name fool you. The Pancake\'s wide hull maximizes a devastating multi-cannon spread-fire system.',
    special: 'Scatter Storm',
  },
  {
    id: 'spitfire',
    name: 'Spitfire',
    modelPath: '/Spitfire.gltf',
    rangerColor: '#c2410c',
    rangerAccent: '#f97316',
    rangerTitle: 'Orange Inferno',
    rangerClass: 'RAPID FIRE',
    price: 600,
    stats: { speed: 5, damage: 4, fireRate: 10, shield: 5, agility: 6 },
    description: 'The fastest trigger in the galaxy. The Spitfire\'s unmatched rate of fire turns the void into a wall of plasma.',
    special: 'Inferno Burst',
  },
  {
    id: 'zenith',
    name: 'Zenith',
    modelPath: '/Zenith.gltf',
    rangerColor: '#0e7490',
    rangerAccent: '#06b6d4',
    rangerTitle: 'Cyan Apex',
    rangerClass: 'ELITE',
    price: 1200,
    stats: { speed: 7, damage: 8, fireRate: 6, shield: 4, agility: 5 },
    description: 'The pinnacle of human engineering. The Zenith is the apex predator of space combat — worthy of the finest commanders.',
    special: 'Zenith Protocol',
  },
]

export const STAT_LABELS: Record<keyof ShipStats, string> = {
  speed: 'SPD',
  damage: 'DMG',
  fireRate: 'FIRE',
  shield: 'SHD',
  agility: 'AGI',
}
