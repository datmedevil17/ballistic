# ⚡ BALLISTIC

> A real-time multiplayer space-shooter battle arena on Solana — with gasless gameplay powered by MagicBlock Ephemeral Rollups and an AI-controlled co-pilot driven by LLaMA via Groq.

---

## Overview

**Ballistic** is an on-chain PvP and PvE space-shooter game. Players pilot spaceships in real-time combat, earn **BALLISTIC** tokens for every kill, and can command an AI wingman using plain English prompts. All in-game transactions are **gasless** — delegated to a MagicBlock Ephemeral Rollup — while final state settlement happens on Solana Devnet.

```
Player wallet  →  Base layer (Anchor program)  →  Ephemeral Rollup (gasless gameplay)
                                ↑                            ↓
                     Settlement / token mint       Record kills, respawn, end game
```

---

## Architecture

```
ballistic/
├── ballistic/          # Anchor smart contract (Rust)
├── backend/            # Go game server (WebSocket hub + AI prompt API)
└── frontend/           # React + Vite client (Three.js 3D renderer)
```

### On-Chain Program — `ballistic/`

Built with **Anchor 1.0.2** on Solana Devnet.

| Program ID | `FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB` |
|---|---|
| **Runtime** | Solana SBPFv2 |
| **Rollup SDK** | `ephemeral-rollups-sdk 0.14.1` |
| **Token** | BALLISTIC SPL (9 decimals, 1 token per kill) |

**Game modes and instruction flow:**

```
Solo (AI)                          Multiplayer
─────────────────────────         ─────────────────────────────────
startAiGame       (base)          createRoom        (base, creator)
delegateSession   (base)          joinRoom          (base, any player)
  │                               leaveRoom         (base, lobby only)
  ▼ ─── Ephemeral Rollup ───      startGame         (base, creator, ≥2 players)
recordSoloKill    (ER, gasless)   delegateRoom      (base, creator)
soloRespawn       (ER, gasless)     │
endSession        (ER, gasless)     ▼ ─── Ephemeral Rollup ───
  │                               recordKill        (ER, gasless)
  ▼ Back to base ───             respawn            (ER, gasless)
collectSessionRewards (base)      endGame            (ER, gasless)
claimRewards          (base)        │
                                    ▼ Back to base ───
                                  updateRewards     (base)
                                  claimRewards      (base)
```

**Key accounts:**

| Account | Seeds | Description |
|---|---|---|
| `PlayerSession` | `["session", player]` | Solo game state (kills, lives, score) |
| `GameRoom` | `["game_room", room_id_le8]` | Multiplayer room (up to 10 players) |
| `PendingRewards` | `["rewards", player]` | Cross-game kill accumulator |
| `Mint` | `["ballistic_mint"]` | BALLISTIC SPL token mint |
| `MintAuthority` | `["mint_authority"]` | Program PDA — only `claimRewards` signs |

**Error codes** (Anchor `#[error_code]`, offset 6000):

| Code | Name | Meaning |
|---|---|---|
| 6000 | `RoomFull` | Max 10 players per room |
| 6001 | `AlreadyInRoom` | Player already joined |
| 6002 | `GameAlreadyStarted` | Can't join/leave after start |
| 6008 | `NotCreator` | Only creator can start/delegate |
| 6013 | `NoLivesRemaining` | Out of respawns |
| … | … | See `lib.rs` for full list |

---

### Backend — `backend/`

Go server using **Gin** + **Gorilla WebSocket**.

| Port | `8080` |
|---|---|
| **Language** | Go 1.26 |
| **Framework** | Gin 1.12, Gorilla WebSocket 1.5 |
| **AI** | Groq API — `llama-3.1-8b-instant` |

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/ws?name=&ship=&wallet=` | WebSocket — live game state, rankings |
| `POST` | `/api/prompt` | Natural-language → AI behavior JSON |
| `GET` | `/ranking` | Redirect message (live via WS) |

**AI Behavior JSON** (`POST /api/prompt`):
```json
{
  "prompt": "hunt the weakest ship",
  "ai_tier": 2,
  "game_context": { ... }
}
```
Response:
```json
{
  "mode": "chase",
  "target_mode": "weakest",
  "aggression": 0.9,
  "preferred_distance": 8,
  "description": "Hunting the weakest ship relentlessly"
}
```
Falls back to keyword matching if Groq is unavailable.

---

### Frontend — `frontend/`

React 19 + Vite 8 + Three.js 0.184 client.

| RPC | Shyft Devnet (`https://devnet-rpc.shyft.to`) |
|---|---|
| **WebSocket** | `wss://api.devnet.solana.com` |
| **ER Endpoint** | `https://devnet.magicblock.app` |
| **Wallets** | Phantom, Solflare |

**Key files:**

```
src/
├── game/
│   ├── Game.tsx              # Solo AI game (Three.js 3D scene)
│   ├── MultiplayerGame.tsx   # Multiplayer game (Three.js 3D scene)
│   ├── BehaviorEngine.ts     # AI pilot behavior state machine
│   ├── PromptSidebar.tsx     # Natural-language AI command UI
│   └── GameModeSelect.tsx    # Mode selection screen
├── hooks/
│   └── useBallistic.ts       # All on-chain interactions
├── components/
│   ├── TestPage.tsx          # Developer test harness (all instructions)
│   ├── MintPage.tsx          # Token claim UI
│   └── Profile.tsx           # Player stats + rewards
└── idl/
    └── ballistic.json        # Auto-generated Anchor IDL
```

**`useBallistic` hook** — derives a **temp keypair** from the connected wallet seed so all in-game transactions are signed locally (gasless). The real wallet only signs at session start and reward claim.

---

## Getting Started

### Prerequisites

- [Rust + Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (`solana-cli 3.x`)
- [Anchor CLI 1.0.2](https://www.anchor-lang.com/docs/installation)
- [Go 1.22+](https://go.dev/dl/)
- [Bun](https://bun.sh/) or Node 20+
- Phantom or Solflare wallet (set to **Devnet**)
- Devnet SOL (airdrop via `solana airdrop 2`)

---

### 1. Smart Contract

```bash
cd ballistic

# Build
PATH="$HOME/.cargo/bin:$PATH" \
  ~/.local/share/solana/install/active_release/bin/cargo-build-sbf

# Deploy (requires upgrade authority keypair with SOL)
anchor deploy --provider.cluster devnet
```

> **Note:** The program is already deployed at `FeM2fDoHX1wTppwwxSsg1xkXzAwei9WCk3C6tsgozobB`. Only redeploy if you modify `lib.rs`.

---

### 2. Backend

```bash
cd backend
cp .env.example .env   # add your GROQ_API_KEY
go run .
# Server starts on :8080
```

**`.env`**:
```
GROQ_API_KEY=your_groq_key_here
```

---

### 3. Frontend

```bash
cd frontend
bun install
bun dev
# Open http://localhost:5173
```

---

## Gameplay Flow

### Solo (AI mode)

1. Connect wallet → click **Play vs AI**
2. Type a command in the sidebar: *"snipe from long range"*, *"full aggro"*, *"retreat and dodge"*
3. Your AI co-pilot updates behavior in real time via Groq
4. Kills accumulate → end session → claim BALLISTIC tokens

### Multiplayer

1. **Creator:** Click `createRoom` → share the 4-digit code
2. **Creator must also** click `joinRoom` with their own code to participate
3. **All players:** Enter code → click `joinRoom`
4. **Creator:** Click `startGame` (requires ≥ 2 players) → `delegateRoom`
5. All gameplay is gasless on the Ephemeral Rollup
6. Last ship standing calls `endGame` → each player calls `updateRewards` → `claimRewards`

---

## Token Economics

| Event | Reward |
|---|---|
| 1 kill (any mode) | 1 BALLISTIC token |
| Kills accumulate in | `PendingRewards` PDA |
| Claim | `claimRewards` mints tokens to your ATA |

Token mint: derived from `["ballistic_mint"]` seed — fixed supply controlled entirely by the program.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Rust · Anchor 1.0.2 · anchor-spl |
| Rollup | MagicBlock Ephemeral Rollups SDK 0.14.1 |
| Chain | Solana Devnet |
| Backend | Go · Gin · Gorilla WebSocket |
| AI | Groq API · LLaMA 3.1 8B |
| Frontend | React 19 · Vite 8 · TypeScript |
| 3D graphics | Three.js 0.184 · React Three Fiber |
| Wallet | @solana/wallet-adapter (Phantom, Solflare) |
| RPC | Shyft Devnet |

---

## License

MIT
