//go:build !windows

// Package winapi holds the small Windows-only shell tweaks glean needs on
// top of what Wails exposes. This file is the no-op stub for other platforms
package winapi

func EnableSnapLayouts(hwnd uintptr)     {}
func FindWindowByPID(pid uint32) uintptr { return 0 }
