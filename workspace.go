package main

import "github.com/glean/glean/internal/store"

// GetWorkspaceState returns the persisted tab state.
func (a *App) GetWorkspaceState() (store.WorkspaceState, error) {
	if a.workspace == nil {
		return store.WorkspaceState{}, nil
	}
	return a.workspace.State(), nil
}

// SaveWorkspaceState persists the tab state.
func (a *App) SaveWorkspaceState(st store.WorkspaceState) error {
	if a.workspace == nil {
		return nil
	}
	return a.workspace.Set(st)
}
