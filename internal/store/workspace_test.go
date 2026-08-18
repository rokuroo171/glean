package store

import (
	"testing"
)

func TestWorkspaceStateRoundTrip(t *testing.T) {
	skyDir := t.TempDir()
	ws, err := OpenWorkspace(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	if got := ws.State(); got.ActiveID != "" || len(got.OpenIDs) != 0 {
		t.Fatalf("fresh state = %+v", got)
	}
	st := WorkspaceState{OpenIDs: []string{"a", "b"}, ActiveID: "b"}
	if err := ws.Set(st); err != nil {
		t.Fatal(err)
	}
	ws2, err := OpenWorkspace(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	got := ws2.State()
	if got.ActiveID != "b" || len(got.OpenIDs) != 2 || got.OpenIDs[0] != "a" {
		t.Fatalf("persisted state = %+v", got)
	}
}
