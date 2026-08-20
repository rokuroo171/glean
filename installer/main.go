// Package main provides the Glean GUI installer.
// It presents a branded wizard to install glean to the user's system.
package main

import (
	"context"
	"embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed frontend/dist/*
var frontendAssets embed.FS

// Installer holds state for the current installation.
type Installer struct {
	ctx        context.Context
	installDir string
}

// InstallInfo returns the default install path.
func (i *Installer) InstallInfo() map[string]string {
	return map[string]string{
		"defaultDir": i.installDir,
		"version":    "1.0.0",
		"platform":   runtime.GOOS,
	}
}

// SetInstallDir updates the install directory from the user
func (i *Installer) SetInstallDir(dir string) {
	if dir != "" {
		i.installDir = dir
	}
}

// GetInstallDir returns the current install directory
func (i *Installer) GetInstallDir() string {
	return i.installDir
}

// Install copies glean.exe and creates shortcuts. Returns success/error
func (i *Installer) Install(srcDir string) map[string]string {
	result := map[string]string{"success": "true", "error": ""}

	// Create install directory
	if err := os.MkdirAll(i.installDir, 0o755); err != nil {
		result["success"] = "false"
		result["error"] = fmt.Sprintf("Could not create directory: %v", err)
		return result
	}

	// Copy glean.exe
	gleanSrc := filepath.Join(srcDir, "glean.exe")
	gleanDst := filepath.Join(i.installDir, "glean.exe")
	if err := copyFile(gleanSrc, gleanDst); err != nil {
		result["success"] = "false"
		result["error"] = fmt.Sprintf("Could not copy glean.exe: %v. Make sure it is in the same folder as the installer.", err)
		return result
	}

	// Copy uninstall.exe if present
	uninstallSrc := filepath.Join(srcDir, "uninstall.exe")
	uninstallDst := filepath.Join(i.installDir, "uninstall.exe")
	if _, err := os.Stat(uninstallSrc); err == nil {
		_ = copyFile(uninstallSrc, uninstallDst)
	}

	// Create Start Menu shortcut
	if err := createStartMenuShortcut(gleanDst); err != nil {
		_ = err // non-fatal
	}

	// Register in Windows Settings
	if err := writeRegistry(i.installDir, filepath.Join(i.installDir, "uninstall.exe")); err != nil {
		_ = err // non-fatal
	}

	return result
}

// LaunchGlean starts the installed glean executable
func (i *Installer) LaunchGlean() {
	gleanExe := filepath.Join(i.installDir, "glean.exe")
	if _, err := os.Stat(gleanExe); err == nil {
		cmd := exec.Command(gleanExe)
		cmd.Start()
	}
}

func main() {
	// Default install path
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, _ := os.UserHomeDir()
		localAppData = filepath.Join(home, "AppData", "Local")
	}
	defaultDir := filepath.Join(localAppData, "glean")

	inst := &Installer{installDir: defaultDir}

	// Determine source directory (where the installer exe lives)
	exePath, _ := os.Executable()
	srcDir := filepath.Dir(exePath)

	err := wails.Run(&options.App{
		Title:  "Glean Installer",
		Width:  580,
		Height: 420,
		AssetServer: &assetserver.Options{
			Assets: frontendAssets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 15, B: 20, A: 1},
		OnStartup: func(ctx context.Context) {
			inst.ctx = ctx
			// Store source dir for install
			inst.installDir = defaultDir
			// Pass srcDir to JS via a method
		},
		Bind: []interface{}{
			inst,
			&SourceDir{dir: srcDir},
		},
	})
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}

// SourceDir provides the directory where the installer exe is located
type SourceDir struct {
	dir string
}

// Get returns the source directory.
func (s *SourceDir) Get() string {
	return s.dir
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0o755)
}

func createStartMenuShortcut(target string) error {
	psDir := filepath.Join(os.Getenv("APPDATA"), `Microsoft\Windows\Start Menu\Programs`)
	if err := os.MkdirAll(psDir, 0o755); err != nil {
		return err
	}
	shortcutPath := filepath.Join(psDir, "Glean.lnk")
	ps := fmt.Sprintf(
		`$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%s'); $s.TargetPath = '%s'; $s.Description = 'Glean - A place for your thoughts to grow'; $s.Save()`,
		shortcutPath, target,
	)
	cmd := exec.Command("powershell", "-NoProfile", "-Command", ps)
	return cmd.Run()
}

func writeRegistry(installDir, uninstallPath string) error {
	ps := fmt.Sprintf(
		`New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Glean' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Glean' -Name 'DisplayName' -Value 'Glean'; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Glean' -Name 'InstallLocation' -Value '%s'; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Glean' -Name 'UninstallString' -Value '%s'; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Glean' -Name 'DisplayVersion' -Value '1.0.0'; Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Glean' -Name 'Publisher' -Value 'glean'`,
		strings.ReplaceAll(installDir, `\`, `\\`),
		strings.ReplaceAll(uninstallPath, `\`, `\\`),
	)
	cmd := exec.Command("powershell", "-NoProfile", "-Command", ps)
	return cmd.Run()
}
