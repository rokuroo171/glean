package main

import (
	"path/filepath"
	"testing"

	"github.com/glean/glean/internal/store"
)

func TestWorkspaceStateMethods(t *testing.T) {
	skyDir := filepath.Join(t.TempDir(), "Sky")
	if err := store.CreateSky(skyDir, "Sky"); err != nil {
		t.Fatal(err)
	}
	ws, err := store.OpenWorkspace(skyDir)
	if err != nil {
		t.Fatal(err)
	}
	a := &App{workspace: ws}

	st, err := a.GetWorkspaceState()
	if err != nil {
		t.Fatal(err)
	}
	if st.ActiveID != "" || len(st.OpenIDs) != 0 {
		t.Fatalf("fresh state = %+v", st)
	}

	want := store.WorkspaceState{OpenIDs: []string{"n1", "n2"}, ActiveID: "n2"}
	if err := a.SaveWorkspaceState(want); err != nil {
		t.Fatal(err)
	}
	got, err := a.GetWorkspaceState()
	if err != nil {
		t.Fatal(err)
	}
	if got.ActiveID != "n2" || len(got.OpenIDs) != 2 || got.OpenIDs[0] != "n1" {
		t.Fatalf("round trip = %+v", got)
	}
}
