package game

// MsgType tags every WebSocket message.
type MsgType string

const (
	MsgJoin       MsgType = "join"
	MsgLeave      MsgType = "leave"
	MsgState      MsgType = "state"
	MsgBatchState MsgType = "batch_state" // server→client: array of all player positions
	MsgShoot      MsgType = "shoot"
	MsgHit        MsgType = "hit"
	MsgDead       MsgType = "dead"
	MsgRanking    MsgType = "ranking"
	MsgPlayerList MsgType = "player_list"
	MsgError      MsgType = "error"
)

// StateSnap is one player's position snapshot inside a batch_state payload.
type StateSnap struct {
	ID  string  `json:"id"`
	X   float64 `json:"x"`
	Z   float64 `json:"z"`
	Rot float64 `json:"rot"`
	HP  int     `json:"hp"`
}

// Envelope is the top-level wire format for all messages.
type Envelope struct {
	Type    MsgType `json:"type"`
	Payload any     `json:"payload"`
}

// JoinPayload is sent by the client when connecting.
type JoinPayload struct {
	Name string `json:"name"`
	Ship string `json:"ship"`
}

// StatePayload carries a player's position/rotation every tick.
type StatePayload struct {
	X   float64 `json:"x"`
	Z   float64 `json:"z"`
	Rot float64 `json:"rot"` // radians
	HP  int     `json:"hp"`
}

// ShootPayload is fired by the shooter; server relays to all.
type ShootPayload struct {
	X   float64 `json:"x"`
	Z   float64 `json:"z"`
	VX  float64 `json:"vx"`
	VZ  float64 `json:"vz"`
}

// HitPayload is sent by the client claiming they hit a target.
type HitPayload struct {
	TargetID string `json:"target_id"`
	Damage   int    `json:"damage"`
}

// PlayerInfo is included in broadcast messages so clients know who's who.
type PlayerInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Ship string `json:"ship"`
	X    float64 `json:"x"`
	Z    float64 `json:"z"`
	Rot  float64 `json:"rot"`
	HP   int     `json:"hp"`
	MaxHP int    `json:"max_hp"`
	Alive bool   `json:"alive"`
}

// DeadPayload is broadcast when a player dies.
type DeadPayload struct {
	PlayerID   string `json:"player_id"`
	PlayerName string `json:"player_name"`
	KillerID   string `json:"killer_id"`
	KillerName string `json:"killer_name"`
}

// RankEntry is one row in the leaderboard.
type RankEntry struct {
	Rank   int    `json:"rank"`
	ID     string `json:"id"`
	Name   string `json:"name"`
	Ship   string `json:"ship"`
	Kills  int    `json:"kills"`
	Deaths int    `json:"deaths"`
	Alive  bool   `json:"alive"`
}
