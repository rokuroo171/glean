import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { applyTheme } from './apply-theme'

const wails = window.go?.main

const defaultPrefs = {
  theme: { preset: 'midnight', accent_hex: '#5b9fd4' },
  layout: { sidebar_position: 'left', density: 'comfortable', show_status_bar: true },
  editor: {
    spell_check_enabled: true,
    cursor_trail_enabled: true,
    cursor_trail_mode: 'beam',
    cursor_trail_color: 'accent',
    cursor_trail_intensity: 'normal',
    cursor_trail_decay_fast: 80,
    cursor_trail_decay_slow: 300,
    cursor_trail_length: 12,
    cursor_trail_start_threshold: 4,
  },
}

// Merge loaded prefs over the defaults so any field the backend does not
// know about yet (or an old preferences.json lacks) keeps its default.
function mergePrefs(base, loaded) {
  return {
    ...base,
    ...loaded,
    theme: { ...base.theme, ...(loaded.theme || {}) },
    layout: { ...base.layout, ...(loaded.layout || {}) },
    editor: { ...base.editor, ...(loaded.editor || {}) },
  }
}

const PreferencesContext = createContext({
  prefs: defaultPrefs,
  updatePrefs: () => {},
  loading: true,
})

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(defaultPrefs)
  const [loading, setLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    (async () => {
      try {
        if (wails) {
          const p = await wails.App.GetPreferences()
          setPrefs(mergePrefs(defaultPrefs, p))
          applyTheme(p.theme.preset, p.theme.accent_hex)
        } else {
          applyTheme(defaultPrefs.theme.preset, defaultPrefs.theme.accent_hex)
        }
      } catch {
        applyTheme(defaultPrefs.theme.preset, defaultPrefs.theme.accent_hex)
      }
      setLoading(false)
    })()
  }, [])

  const updatePrefs = useCallback(async (partial) => {
    setPrefs(prev => {
      const next = {
        ...prev,
        ...partial,
        theme: { ...prev.theme, ...(partial.theme || {}) },
        layout: { ...prev.layout, ...(partial.layout || {}) },
        editor: { ...prev.editor, ...(partial.editor || {}) },
      }
      // Apply theme immediately
      applyTheme(next.theme.preset, next.theme.accent_hex)
      // Save to backend (fire and forget)
      if (wails) {
        wails.App.SavePreferences(next).catch(() => {})
      }
      return next
    })
  }, [])

  return (
    <PreferencesContext.Provider value={{ prefs, updatePrefs, loading }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  return useContext(PreferencesContext)
}

export default PreferencesContext
