package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// WorkspaceState is the persisted state of the workspace.
type WorkspaceState struct {
	OpenIDs      []string `json:"open_ids"`
	ActiveID     string   `json:"active_id"`
	SkyCollapsed bool     `json:"sky_collapsed"`
}

// WorkspaceStore persists WorkspaceState as .glean/workspace.json.
type WorkspaceStore struct {
	mu   sync.Mutex
	path string
	data WorkspaceState
}

// OpenWorkspace loads the workspace state, defaulting to empty.
func OpenWorkspace(skyDir string) (*WorkspaceStore, error) {
	path := filepath.Join(SidecarDir(skyDir), "workspace.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create sidecar dir: %w", err)
	}
	s := &WorkspaceStore{path: path, data: WorkspaceState{OpenIDs: []string{}}}
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read workspace: %w", err)
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &s.data); err != nil {
			return nil, fmt.Errorf("parse workspace: %w", err)
		}
	}
	if s.data.OpenIDs == nil {
		s.data.OpenIDs = []string{}
	}
	return s, nil
}

// State returns a copy of the persisted state.
func (s *WorkspaceStore) State() WorkspaceState {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := WorkspaceState{OpenIDs: append([]string{}, s.data.OpenIDs...), ActiveID: s.data.ActiveID, SkyCollapsed: s.data.SkyCollapsed}
	return out
}

// Set persists a new tab state.
func (s *WorkspaceStore) Set(st WorkspaceState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if st.OpenIDs == nil {
		st.OpenIDs = []string{}
	}
	s.data = st
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal workspace: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return fmt.Errorf("write workspace: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return fmt.Errorf("rename workspace: %w", err)
	}
	return nil
}
