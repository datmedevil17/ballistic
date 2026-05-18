package main

import (
	"log"
	"net/http"

	"ballistic-server/internal/game"
	"ballistic-server/internal/hub"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins in dev
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func main() {
	h := hub.New()
	go h.Run()

	r := gin.Default()

	// allow CORS for the Vite dev server
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		c.Next()
	})

	// REST: current ranking snapshot
	r.GET("/ranking", func(c *gin.Context) {
		// hub exposes rankings via WS; this endpoint is a convenience for the lobby
		c.JSON(http.StatusOK, gin.H{"message": "connect via WebSocket for live rankings"})
	})

	// WebSocket: /ws?name=<name>&ship=<ship>
	r.GET("/ws", func(c *gin.Context) {
		name := c.Query("name")
		ship := c.Query("ship")
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
			return
		}
		if ship == "" {
			ship = "default"
		}

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("upgrade error: %v", err)
			return
		}

		playerID := uuid.New().String()
		p := hub.NewPlayer(playerID, name, ship, 150, conn, h)

		// Send the player their own ID immediately
		p.Send(game.Envelope{
			Type: game.MsgJoin,
			Payload: map[string]string{
				"id":   playerID,
				"name": name,
				"ship": ship,
			},
		})

		h.RegisterPlayer(p)

		go p.WritePump()
		p.ReadPump()
	})

	log.Println("Ballistic multiplayer server listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
