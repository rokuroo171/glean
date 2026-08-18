; glean Windows installer
; Built by CI: makensis /DVERSION=x.y.z packaging/windows/installer.nsi

!include "MUI2.nsh"
!include "x64.nsh"

!ifndef VERSION
  !define VERSION "1.0.0"
!endif

Name "glean ${VERSION}"
OutFile "../../build/bin/glean-setup.exe"
InstallDir "$PROGRAMFILES64\glean"
InstallDirRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "InstallLocation"
RequestExecutionLevel admin
Unicode true

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; WebView2 runtime check. Windows 10 and 11 ship it, but warn when missing.
Function .onInit
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
    MessageBox MB_ICONINFORMATION|MB_YESNO "glean needs the Microsoft Edge WebView2 runtime, which was not found. Open the download page?" IDYES +2
    Goto done
    ExecShell "open" "https://developer.microsoft.com/microsoft-edge/webview2/"
  ${EndIf}
  done:
FunctionEnd

Section "glean" SecMain
  SetOutPath "$INSTDIR"
  File "../../build/bin/glean.exe"

  WriteUninstaller "$INSTDIR\uninstall.exe"

  CreateDirectory "$SMPROGRAMS\glean"
  CreateShortcut "$SMPROGRAMS\glean\glean.lnk" "$INSTDIR\glean.exe"

  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "DisplayName" "glean"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "Publisher" "glean"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\glean.exe"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\glean\glean.lnk"
  RMDir "$SMPROGRAMS\glean"

  SetRegView 64
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean"
  SetRegView 32
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\glean"
SectionEnd