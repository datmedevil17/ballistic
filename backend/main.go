package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"ballistic-server/internal/hub"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// ── prompt / behavior types ────────────────────────────────────────────────────

type PromptRequest struct {
	Prompt      string          `json:"prompt"`
	AITier      int             `json:"ai_tier"`
	GameContext json.RawMessage `json:"game_context"`
}

type BehaviorResponse struct {
	Mode              string  `json:"mode"`
	TargetMode        string  `json:"target_mode"`
	Aggression        float64 `json:"aggression"`
	PreferredDistance float64 `json:"preferred_distance"`
	Description       string  `json:"description"`
}

// ── groq api ──────────────────────────────────────────────────────────────────

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model          string        `json:"model"`
	Messages       []groqMessage `json:"messages"`
	ResponseFormat struct {
		Type string `json:"type"`
	} `json:"response_format"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

const systemPrompt = `You are a spaceship AI pilot controller in a real-time multiplayer battle arena.
Translate the player's natural-language order into a JSON behavior object.

REQUIRED FIELDS (output ONLY this JSON, no markdown, no extra text):
{"mode":"...","target_mode":"...","aggression":0.0,"preferred_distance":0,"description":"..."}

FIELD RULES:
- mode: one of exactly: idle | chase | strafe | aggressive | retreat | snipe | dodge | patrol
- target_mode: one of exactly: nearest | weakest | strongest | random
- aggression: float 0.0–1.0 (0=passive, 1=berserker)
- preferred_distance: integer 5–30 (units; chase/aggressive≈8, strafe≈12, snipe≈22, retreat≈28)
- description: ≤60 chars, plain English, describes what ship will do

EXAMPLES:
"hunt the weakest ship" → {"mode":"chase","target_mode":"weakest","aggression":0.9,"preferred_distance":8,"description":"Hunting the weakest ship relentlessly"}
"orbit and strafe" → {"mode":"strafe","target_mode":"nearest","aggression":0.7,"preferred_distance":12,"description":"Orbiting and strafing the nearest target"}
"snipe from far away" → {"mode":"snipe","target_mode":"nearest","aggression":0.55,"preferred_distance":22,"description":"Sniping from long range"}
"full aggro on the biggest target" → {"mode":"aggressive","target_mode":"strongest","aggression":1.0,"preferred_distance":7,"description":"Full aggression on strongest enemy"}
"dodge and return fire" → {"mode":"dodge","target_mode":"nearest","aggression":0.5,"preferred_distance":12,"description":"Evading fire while returning shots"}
"fall back and retreat" → {"mode":"retreat","target_mode":"nearest","aggression":0.15,"preferred_distance":28,"description":"Retreating from all threats"}
"patrol the arena" → {"mode":"patrol","target_mode":"nearest","aggression":0.4,"preferred_distance":14,"description":"Patrolling and engaging opportunistically"}
"chase down a random target" → {"mode":"chase","target_mode":"random","aggression":0.75,"preferred_distance":9,"description":"Chasing a random target"}

Use the battlefield context (if provided) to refine aggression and distance based on HP and enemy count.
Output ONLY the JSON object. No explanation.`

func callGroq(prompt string, aiTier int, contextJSON json.RawMessage) (*BehaviorResponse, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GROQ_API_KEY not set")
	}

	userMsg := "Instruction: " + prompt
	if aiTier >= 2 && len(contextJSON) > 0 {
		userMsg += "\n\nCurrent battlefield state:\n" + string(contextJSON)
	}

	req := groqRequest{
		Model: "llama-3.1-8b-instant",
		Messages: []groqMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMsg},
		},
		MaxTokens:   160,
		Temperature: 0.2,
	}
	req.ResponseFormat.Type = "json_object"

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("groq HTTP %d", resp.StatusCode)
	}

	var gr groqResponse
	if err := json.NewDecoder(resp.Body).Decode(&gr); err != nil {
		return nil, err
	}
	if len(gr.Choices) == 0 {
		return nil, fmt.Errorf("empty groq response")
	}

	var b BehaviorResponse
	if err := json.Unmarshal([]byte(gr.Choices[0].Message.Content), &b); err != nil {
		return nil, fmt.Errorf("parse behavior JSON: %w", err)
	}

	// sanitize
	validModes := map[string]bool{
		"idle": true, "chase": true, "strafe": true, "aggressive": true,
		"retreat": true, "snipe": true, "dodge": true, "patrol": true,
	}
	if !validModes[b.Mode] {
		b.Mode = "chase"
	}
	validTargets := map[string]bool{"nearest": true, "weakest": true, "strongest": true, "random": true}
	if !validTargets[b.TargetMode] {
		b.TargetMode = "nearest"
	}
	if b.Aggression < 0 {
		b.Aggression = 0
	}
	if b.Aggression > 1 {
		b.Aggression = 1
	}
	if b.PreferredDistance < 5 {
		b.PreferredDistance = 5
	}
	if b.PreferredDistance > 30 {
		b.PreferredDistance = 30
	}
	if b.Description == "" {
		b.Description = b.Mode + " — " + b.TargetMode + " target"
	}

	return &b, nil
}

// ── local fallback (keyword matching) ─────────────────────────────────────────

func fallbackBehavior(prompt string) BehaviorResponse {
	s := strings.ToLower(prompt)
	has := func(words ...string) bool {
		for _, w := range words {
			if strings.Contains(s, w) {
				return true
			}
		}
		return false
	}
	switch {
	case has("retreat", "flee", "escape", "run", "hide", "back"):
		return BehaviorResponse{"retreat", "nearest", 0.2, 25, "Retreating from all threats [fallback]"}
	case has("strafe", "orbit", "circle", "flank"):
		return BehaviorResponse{"strafe", "nearest", 0.7, 12, "Orbiting and strafing [fallback]"}
	case has("snipe", "long range", "distance", "far", "range"):
		return BehaviorResponse{"snipe", "nearest", 0.6, 20, "Sniping from distance [fallback]"}
	case has("dodge", "evade", "avoid", "defensive"):
		return BehaviorResponse{"dodge", "nearest", 0.5, 12, "Dodging and returning fire [fallback]"}
	case has("patrol", "wander", "roam", "guard"):
		return BehaviorResponse{"patrol", "nearest", 0.5, 12, "Patrolling the arena [fallback]"}
	case has("weak", "low hp", "wounded", "finish", "dying"):
		return BehaviorResponse{"chase", "weakest", 0.9, 8, "Hunting the weakest target [fallback]"}
	case has("strong", "biggest", "heavy", "boss", "tank"):
		return BehaviorResponse{"chase", "strongest", 0.8, 10, "Engaging the strongest target [fallback]"}
	default:
		return BehaviorResponse{"aggressive", "nearest", 0.85, 8, "Engaging nearest target aggressively [fallback]"}
	}
}

// ── main ──────────────────────────────────────────────────────────────────────

func loadEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if k, v, ok := strings.Cut(line, "="); ok {
			if os.Getenv(strings.TrimSpace(k)) == "" {
				os.Setenv(strings.TrimSpace(k), strings.TrimSpace(v))
			}
		}
	}
}

func main() {
	loadEnv(".env")

	h := hub.New()
	go h.Run()

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/ranking", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "connect via WebSocket for live rankings"})
	})

	// AI prompt → behavior
	r.POST("/api/prompt", func(c *gin.Context) {
		var req PromptRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if strings.TrimSpace(req.Prompt) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "prompt required"})
			return
		}

		behavior, err := callGroq(req.Prompt, req.AITier, req.GameContext)
		if err != nil {
			log.Printf("groq error: %v — using fallback", err)
			fb := fallbackBehavior(req.Prompt)
			c.JSON(http.StatusOK, fb)
			return
		}

		c.JSON(http.StatusOK, behavior)
	})

	// WebSocket
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
		h.RegisterPlayer(p)
		go p.WritePump()
		p.ReadPump()
	})

	log.Println("Ballistic server listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
