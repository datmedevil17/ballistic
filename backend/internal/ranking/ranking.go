package ranking

import (
	"sort"
	"sync"
)

// Entry tracks a single player's combat stats.
type Entry struct {
	ID     string
	Name   string
	Ship   string
	Kills  int
	Deaths int
	Alive  bool
}

// Board is a thread-safe kill/death leaderboard.
type Board struct {
	mu      sync.RWMutex
	entries map[string]*Entry
}

func New() *Board {
	return &Board{entries: make(map[string]*Entry)}
}

func (b *Board) Register(id, name, ship string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.entries[id]; !ok {
		b.entries[id] = &Entry{ID: id, Name: name, Ship: ship, Alive: true}
	}
}

func (b *Board) RecordKill(killerID, victimID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if k, ok := b.entries[killerID]; ok {
		k.Kills++
	}
	if v, ok := b.entries[victimID]; ok {
		v.Deaths++
		v.Alive = false
	}
}

func (b *Board) SetAlive(id string, alive bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if e, ok := b.entries[id]; ok {
		e.Alive = alive
	}
}

func (b *Board) Remove(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.entries, id)
}

// Sorted returns a snapshot sorted by kills desc, deaths asc.
func (b *Board) Sorted() []*Entry {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]*Entry, 0, len(b.entries))
	for _, e := range b.entries {
		cp := *e
		out = append(out, &cp)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kills != out[j].Kills {
			return out[i].Kills > out[j].Kills
		}
		return out[i].Deaths < out[j].Deaths
	})
	return out
}
