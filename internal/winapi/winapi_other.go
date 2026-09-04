//go:build !windows

package winapi

func EnableSnapLayouts(hwnd uintptr) {}
func FindWindowByPID(pid uint32) uintptr { return 0 }
