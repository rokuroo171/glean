//go:build windows

// Package winapi holds the small Windows-only shell tweaks glean needs on
// top of what Wails exposes, e.g. the Win11 snap layouts flyout on the
// frameless maximize button
package winapi

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                       = windows.NewLazySystemDLL("user32.dll")
	procGetWindowLongW           = user32.NewProc("GetWindowLongW")
	procSetWindowLongW           = user32.NewProc("SetWindowLongW")
	procEnumWindows              = user32.NewProc("EnumWindows")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
)

const (
	GWL_STYLE      = uintptr(0xFFFFFFFFFFFFFFF0) // GWL_STYLE is -16; two's complement keeps Call() happy
	WS_MAXIMIZEBOX = 0x00010000
)

// EnableSnapLayouts adds WS_MAXIMIZEBOX to the window style so
// Windows 11 shows the snap layout popup on maximize hover
func EnableSnapLayouts(hwnd uintptr) {
	style, _, _ := procGetWindowLongW.Call(hwnd, GWL_STYLE)
	if style&WS_MAXIMIZEBOX == 0 {
		procSetWindowLongW.Call(hwnd, GWL_STYLE, style|WS_MAXIMIZEBOX)
	}
}

// FindWindowByPID finds the first top-level window owned by the given process
func FindWindowByPID(pid uint32) uintptr {
	var found uintptr
	cb := windows.NewCallback(func(hwnd, _ uintptr) uintptr {
		var wpid uint32
		procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&wpid)))
		if wpid == pid {
			found = hwnd
			return 0
		}
		return 1
	})
	procEnumWindows.Call(cb, 0)
	return found
}
