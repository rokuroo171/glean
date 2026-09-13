package main

import (
	"github.com/glean/glean/internal/store"
)

// GetWorkspaceState returns the persisted tab state
func (a *App) GetWorkspaceState() (store.WorkspaceState, error) {
	return a.svc.GetWorkspaceState()
}

// SaveWorkspaceState persists the tab state
func (a *App) SaveWorkspaceState(st store.WorkspaceState) error {
	return a.svc.SaveWorkspaceState(st)
}
