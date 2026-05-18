package hub

import (
	"encoding/json"
	"log"
	"time"

	"ballistic-server/internal/game"
	"ballistic-server/internal/ranking"
)

type incomingMsg struct {
	player *Player
	data   []byte
}

// Hub manages all connected players and game state.
type Hub struct {
	players    map[string]*Player
	register   chan *Player
	unregister chan *Player
	incoming   chan incomingMsg
	board      *ranking.Board
}

func New() *Hub {
	return &Hub{
		players:    make(map[string]*Player),
		register:   make(chan *Player, 8),
		unregister: make(chan *Player, 8),
		incoming:   make(chan incomingMsg, 256),
		board:      ranking.New(),
	}
}

// Run is the single-goroutine event loop — no locking needed on h.players.
func (h *Hub) Run() {
	rankTicker := time.NewTicker(time.Second)
	defer rankTicker.Stop()
	for {
		select {
		case <-rankTicker.C:
			if len(h.players) > 0 {
				h.broadcastRanking()
			}

		case p := <-h.register:
			h.players[p.ID] = p
			h.board.Register(p.ID, p.Name, p.Ship)
			log.Printf("[hub] %s (%s) joined — total %d", p.Name, p.ID, len(h.players))
			h.broadcastPlayerList()
			h.broadcastRanking()

		case p := <-h.unregister:
			if _, ok := h.players[p.ID]; !ok {
				continue
			}
			delete(h.players, p.ID)
			close(p.send)
			h.board.Remove(p.ID)
			log.Printf("[hub] %s left — total %d", p.Name, len(h.players))
			h.broadcastPlayerList()
			h.broadcastRanking()

		case im := <-h.incoming:
			h.handleMessage(im.player, im.data)
		}
	}
}

// RegisterPlayer wires a new websocket connection into the hub.
func (h *Hub) RegisterPlayer(p *Player) {
	h.register <- p
}

// ── message dispatch ──────────────────────────────────────────────────────────

func (h *Hub) handleMessage(p *Player, raw []byte) {
	var env game.Envelope
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

func (h *Hub) handleState(p *Player, raw any) {
	b, _ := json.Marshal(raw)
	var sp game.StatePayload
	if err := json.Unmarshal(b, &sp); err != nil {
		return
	}
	p.X, p.Z, p.Rot = sp.X, sp.Z, sp.Rot
	if sp.HP >= 0 {
		p.HP = sp.HP
	}

	// relay the updated position to all other players
	env := game.Envelope{
		Type: game.MsgState,
		Payload: map[string]any{
			"id":  p.ID,
			"x":   p.X,
			"z":   p.Z,
			"rot": p.Rot,
			"hp":  p.HP,
		},
	}
	h.broadcastExcept(p.ID, env)
}

func (h *Hub) handleShoot(p *Player, raw any) {
	b, _ := json.Marshal(raw)
	var sp game.ShootPayload
	if err := json.Unmarshal(b, &sp); err != nil {
		return
	}
	env := game.Envelope{
		Type: game.MsgShoot,
		Payload: map[string]any{
			"shooter_id": p.ID,
			"x":          sp.X,
			"z":          sp.Z,
			"vx":         sp.VX,
			"vz":         sp.VZ,
		},
	}
	h.broadcastExcept(p.ID, env)
}

func (h *Hub) handleHit(p *Player, raw any) {
	b, _ := json.Marshal(raw)
	var hp game.HitPayload
	if err := json.Unmarshal(b, &hp); err != nil {
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

	// notify target of the damage
	target.Send(game.Envelope{
		Type: game.MsgHit,
		Payload: map[string]any{
			"shooter_id": p.ID,
			"damage":     hp.Damage,
			"hp":         target.HP,
		},
	})

	if target.HP <= 0 && target.Alive {
		target.Alive = false
		h.board.RecordKill(p.ID, target.ID)
		log.Printf("[hub] %s killed %s", p.Name, target.Name)

		dead := game.Envelope{
			Type: game.MsgDead,
			Payload: game.DeadPayload{
				PlayerID:   target.ID,
				PlayerName: target.Name,
				KillerID:   p.ID,
				KillerName: p.Name,
			},
		}
		h.broadcast(dead)
		h.broadcastRanking()
	}
}

// ── broadcast helpers ─────────────────────────────────────────────────────────

func (h *Hub) broadcast(v any) {
	for _, p := range h.players {
		p.Send(v)
	}
}

func (h *Hub) broadcastExcept(skipID string, v any) {
	for id, p := range h.players {
		if id != skipID {
			p.Send(v)
		}
	}
}

func (h *Hub) broadcastPlayerList() {
	list := make([]game.PlayerInfo, 0, len(h.players))
	for _, p := range h.players {
		list = append(list, game.PlayerInfo{
			ID:    p.ID,
			Name:  p.Name,
			Ship:  p.Ship,
			X:     p.X,
			Z:     p.Z,
			Rot:   p.Rot,
			HP:    p.HP,
			MaxHP: p.MaxHP,
			Alive: p.Alive,
		})
	}
	h.broadcast(game.Envelope{Type: game.MsgPlayerList, Payload: list})
}

func (h *Hub) broadcastRanking() {
	entries := h.board.Sorted()
	rows := make([]game.RankEntry, len(entries))
	for i, e := range entries {
		rows[i] = game.RankEntry{
			Rank:   i + 1,
			ID:     e.ID,
			Name:   e.Name,
			Ship:   e.Ship,
			Kills:  e.Kills,
			Deaths: e.Deaths,
			Alive:  e.Alive,
		}
	}
	h.broadcast(game.Envelope{Type: game.MsgRanking, Payload: rows})
}
