package hub

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
	maxMsgSize = 4096
	sendBuf    = 512 // larger buffer handles burst from batch broadcasts
)

// Player represents one connected client.
type Player struct {
	ID   string
	Name string
	Ship string

	X, Z, Rot      float64
	HP, MaxHP       int
	Alive           bool
	SpawnX, SpawnZ float64

	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

func NewPlayer(id, name, ship string, maxHP int, conn *websocket.Conn, h *Hub) *Player {
	return &Player{
		ID:    id,
		Name:  name,
		Ship:  ship,
		HP:    maxHP,
		MaxHP: maxHP,
		Alive: true,
		hub:   h,
		conn:  conn,
		send:  make(chan []byte, sendBuf),
	}
}

// Send marshals v and enqueues it (non-blocking; drops if channel full).
// Use SendBytes when you already have a pre-marshaled message to avoid
// re-marshaling the same payload for every recipient.
func (p *Player) Send(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	p.SendBytes(b)
}

// SendBytes enqueues an already-marshaled message (non-blocking; drops if full).
func (p *Player) SendBytes(b []byte) {
	select {
	case p.send <- b:
	default: // stale position data is safe to drop
	}
}

// WritePump drains the send channel to the WebSocket.
func (p *Player) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		p.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-p.send:
			p.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				p.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := p.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			p.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := p.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ReadPump reads incoming frames and dispatches to the hub.
func (p *Player) ReadPump() {
	defer func() {
		p.hub.unregister <- p
		p.conn.Close()
	}()
	p.conn.SetReadLimit(maxMsgSize)
	p.conn.SetReadDeadline(time.Now().Add(pongWait))
	p.conn.SetPongHandler(func(string) error {
		p.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, msg, err := p.conn.ReadMessage()
		if err != nil {
			break
		}
		p.hub.incoming <- incomingMsg{player: p, data: msg}
	}
}
