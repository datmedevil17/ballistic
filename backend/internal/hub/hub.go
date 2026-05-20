package hub

import (
	"encoding/json"
	"log"
	"math"
	"time"

	"ballistic-server/internal/game"
	"ballistic-server/internal/ranking"
)

// inMsg is the wire format for messages arriving from clients.
// Using json.RawMessage avoids the double marshal/unmarshal that
// happens when Payload is decoded as `any` (map[string]interface{}).
type inMsg struct {
	Type    game.MsgType    `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type incomingMsg struct {
	player *Player
	data   []byte
}

// stateSnapshot holds the most recent position received from a player.
// Only the latest value per player is kept — stale intermediates are discarded.
type stateSnapshot struct{ x, z, rot float64; hp int }

const (
	spawnRadius = 30.0
	spawnSlots  = 16
	stateHz     = 20 // position batch flush rate
)

// Hub manages all connected players and game state.
type Hub struct {
	players       map[string]*Player
	register      chan *Player
	unregister    chan *Player
	incoming      chan incomingMsg
	board         *ranking.Board
	spawnIdx      int
	pendingStates map[string]stateSnapshot // latest pos per player, flushed every tick
}

func New() *Hub {
	return &Hub{
		players:       make(map[string]*Player),
		register:      make(chan *Player, 8),
		unregister:    make(chan *Player, 8),
		incoming:      make(chan incomingMsg, 512),
		board:         ranking.New(),
		pendingStates: make(map[string]stateSnapshot),
	}
}

// Run is the single-goroutine event loop — no locking needed on h.players.
func (h *Hub) Run() {
	rankTicker  := time.NewTicker(time.Second)
	stateTicker := time.NewTicker(time.Second / stateHz)
	defer rankTicker.Stop()
	defer stateTicker.Stop()

	for {
		select {

		// ── 20 Hz position batch flush ────────────────────────────────────────
		case <-stateTicker.C:
			h.flushStates()

		// ── 1 Hz ranking broadcast ────────────────────────────────────────────
		case <-rankTicker.C:
			if len(h.players) > 0 {
				h.broadcastRanking()
			}

		// ── player join ───────────────────────────────────────────────────────
		case p := <-h.register:
			// evict stale connection with the same wallet ID (reconnect case)
			if existing, ok := h.players[p.ID]; ok {
				delete(h.players, existing.ID)
				delete(h.pendingStates, existing.ID)
				close(existing.send)
				h.board.Remove(existing.ID)
				log.Printf("[hub] evicted stale session for %s", existing.Name)
			}
			angle := float64(h.spawnIdx%spawnSlots) * (2 * math.Pi / spawnSlots)
			p.SpawnX = math.Cos(angle) * spawnRadius
			p.SpawnZ = math.Sin(angle) * spawnRadius
			p.X, p.Z = p.SpawnX, p.SpawnZ
			h.spawnIdx++
			h.players[p.ID] = p
			h.board.Register(p.ID, p.Name, p.Ship)
			log.Printf("[hub] %s joined at (%.1f,%.1f) — total %d", p.Name, p.SpawnX, p.SpawnZ, len(h.players))
			p.Send(game.Envelope{
				Type: game.MsgJoin,
				Payload: map[string]any{
					"id": p.ID, "name": p.Name, "ship": p.Ship,
					"spawn_x": p.SpawnX, "spawn_z": p.SpawnZ, "max_hp": p.MaxHP,
				},
			})
			h.broadcastPlayerList()
			h.broadcastRanking()

		// ── player leave ──────────────────────────────────────────────────────
		case p := <-h.unregister:
			// pointer check: skip stale unregisters from evicted sessions
			if existing, ok := h.players[p.ID]; !ok || existing != p {
				continue
			}
			delete(h.players, p.ID)
			delete(h.pendingStates, p.ID)
			close(p.send)
			h.board.Remove(p.ID)
			log.Printf("[hub] %s left — total %d", p.Name, len(h.players))
			h.broadcastPlayerList()
			h.broadcastRanking()

		// ── incoming client message ───────────────────────────────────────────
		case im := <-h.incoming:
			h.handleMessage(im.player, im.data)
		}
	}
}

func (h *Hub) RegisterPlayer(p *Player) { h.register <- p }

// ── message dispatch ──────────────────────────────────────────────────────────

func (h *Hub) handleMessage(p *Player, raw []byte) {
	var env inMsg
	if err := json.Unmarshal(raw, &env); err != nil {
		return
	}
	switch env.Type {
	case game.MsgState:
		h.handleState(p, env.Payload)
	case game.MsgShoot:
		h.handleShoot(p, env.Payload)
	case game.MsgHit:
		h.handleHit(p, env.Payload)
	}
}

// handleState records the latest position; actual relay happens in flushStates.
func (h *Hub) handleState(p *Player, payload json.RawMessage) {
	var sp game.StatePayload
	if err := json.Unmarshal(payload, &sp); err != nil {
		return
	}
	p.X, p.Z, p.Rot = sp.X, sp.Z, sp.Rot
	h.pendingStates[p.ID] = stateSnapshot{x: p.X, z: p.Z, rot: p.Rot, hp: p.HP}
}

// flushStates builds one batch_state message and sends it to all players.
// Replaces per-update O(n) relays with a single O(n) broadcast per tick.
func (h *Hub) flushStates() {
	if len(h.pendingStates) == 0 {
		return
	}
	snaps := make([]game.StateSnap, 0, len(h.pendingStates))
	for id, s := range h.pendingStates {
		snaps = append(snaps, game.StateSnap{ID: id, X: s.x, Z: s.z, Rot: s.rot, HP: s.hp})
	}
	clear(h.pendingStates)
	h.broadcastBytes(mustMarshal(game.Envelope{Type: game.MsgBatchState, Payload: snaps}))
}

func (h *Hub) handleShoot(p *Player, payload json.RawMessage) {
	var sp game.ShootPayload
	if err := json.Unmarshal(payload, &sp); err != nil {
		return
	}
	b := mustMarshal(game.Envelope{
		Type: game.MsgShoot,
		Payload: map[string]any{
			"shooter_id": p.ID, "x": sp.X, "z": sp.Z, "vx": sp.VX, "vz": sp.VZ,
		},
	})
	h.broadcastBytesExcept(p.ID, b)
}

func (h *Hub) handleHit(p *Player, payload json.RawMessage) {
	var hp game.HitPayload
	if err := json.Unmarshal(payload, &hp); err != nil {
		return
	}
	target, ok := h.players[hp.TargetID]
	if !ok || !target.Alive {
		return
	}

	target.HP -= hp.Damage
	if target.HP < 0 {
		target.HP = 0
	}
	target.Send(game.Envelope{
		Type:    game.MsgHit,
		Payload: map[string]any{"shooter_id": p.ID, "damage": hp.Damage, "hp": target.HP},
	})

	if target.HP <= 0 && target.Alive {
		target.Alive = false
		h.board.RecordKill(p.ID, target.ID)
		log.Printf("[hub] %s killed %s", p.Name, target.Name)
		h.broadcastBytes(mustMarshal(game.Envelope{
			Type: game.MsgDead,
			Payload: game.DeadPayload{
				PlayerID: target.ID, PlayerName: target.Name,
				KillerID: p.ID, KillerName: p.Name,
			},
		}))
		h.broadcastRanking()
	}
}

// ── broadcast helpers ─────────────────────────────────────────────────────────

// broadcastBytes sends pre-marshaled bytes to every player.
// Marshal once, send N times — no per-recipient allocation.
func (h *Hub) broadcastBytes(b []byte) {
	for _, p := range h.players {
		p.SendBytes(b)
	}
}

func (h *Hub) broadcastBytesExcept(skip string, b []byte) {
	for id, p := range h.players {
		if id != skip {
			p.SendBytes(b)
		}
	}
}

func (h *Hub) broadcastPlayerList() {
	list := make([]game.PlayerInfo, 0, len(h.players))
	for _, p := range h.players {
		list = append(list, game.PlayerInfo{
			ID: p.ID, Name: p.Name, Ship: p.Ship,
			X: p.X, Z: p.Z, Rot: p.Rot, HP: p.HP, MaxHP: p.MaxHP, Alive: p.Alive,
		})
	}
	h.broadcastBytes(mustMarshal(game.Envelope{Type: game.MsgPlayerList, Payload: list}))
}

func (h *Hub) broadcastRanking() {
	entries := h.board.Sorted()
	rows := make([]game.RankEntry, len(entries))
	for i, e := range entries {
		rows[i] = game.RankEntry{
			Rank: i + 1, ID: e.ID, Name: e.Name, Ship: e.Ship,
			Kills: e.Kills, Deaths: e.Deaths, Alive: e.Alive,
		}
	}
	h.broadcastBytes(mustMarshal(game.Envelope{Type: game.MsgRanking, Payload: rows}))
}

// mustMarshal panics on error — only called with known-safe types.
func mustMarshal(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
