//go:build windows

package winapi

import (
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                = windows.NewLazySystemDLL("user32.dll")
	dwmapi                = windows.NewLazySystemDLL("dwmapi.dll")
	procGetWindowLongW    = user32.NewProc("GetWindowLongW")
	procSetWindowLongW    = user32.NewProc("SetWindowLongW")
	procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
	procEnumWindows       = user32.NewProc("EnumWindows")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
)

const (
	GWL_STYLE                       = -16
	WS_MAXIMIZEBOX                  = 0x00010000
	DWMWA_USE_IMMERSIVE_DARK_MODE   = 20
	DWMWA_WINDOW_CORNER_PREFERENCE  = 33
)

// EnableSnapLayouts adds WS_MAXIMIZEBOX to the window style so
// Windows 11 shows the snap layout popup on maximize hover.
func EnableSnapLayouts(hwnd uintptr) {
	style, _, _ := procGetWindowLongW.Call(hwnd, GWL_STYLE)
	if style&WS_MAXIMIZEBOX == 0 {
		procSetWindowLongW.Call(hwnd, GWL_STYLE, style|WS_MAXIMIZEBOX)
	}
}

// FindWindowByPID finds the first top-level window owned by the given process.
func FindWindowByPID(pid uint32) uintptr {
	var found uintptr
	procEnumWindows.Call(windows.NewCallback(func(hwnd uintptr, _ uintptr) bool {
		var wpid uint32
		procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&wpid)))
		if wpid == pid {
			found = hwnd
			return false
		}
		return true
	}), 0)
	return found
}
