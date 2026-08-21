import { useState } from 'react'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import { getPresets, getPreset } from '../lib/apply-theme'
import Icon from './Icon'

const accentSwatches = [
  { label: 'Blue', hex: '#5b9fd4' },
  { label: 'Gold', hex: '#ffb366' },
  { label: 'Rose', hex: '#ff8080' },
  { label: 'Mint', hex: '#66ffcc' },
  { label: 'Violet', hex: '#b08cff' },
  { label: 'Coral', hex: '#ff8855' },
]

const trailModes = [
  { id: 'kitty', label: 'Kitty blob', desc: 'Smooth morphing blob follows cursor jumps' },
  { id: 'sparkle', label: 'Particle sparkle', desc: 'Star particles emit and fade behind cursor' },
  { id: 'ink', label: 'Ink stroke', desc: 'Colored line trail that follows and fades' },
]

const densities = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
  { id: 'dense', label: 'Dense' },
]

const trailIntensities = [
  { id: 'subtle', label: 'Subtle' },
  { id: 'normal', label: 'Normal' },
  { id: 'vivid', label: 'Vivid' },
]

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${colors.border}` }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
          color: colors.text, fontSize: 14, fontWeight: 500, textAlign: 'left' }}>
        <Icon name={icon} size={16} style={{ color: colors.accent }} />
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{ display: 'inline-block', transition: 'transform 0.2s ease',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: colors.textMuted }}>
          <Icon name="chevron-right" size={14} />
        </span>
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  )
}

function ThemeCard({ name, active, onClick }) {
  const preset = getPreset(name)
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: 8, background: active ? 'rgba(91, 159, 212, 0.1)' : 'transparent',
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s ease',
        minWidth: 80 }}>
      {/* Mini palette preview */}
      <div style={{ display: 'flex', gap: 2, borderRadius: 4, overflow: 'hidden', width: '100%' }}>
        <div style={{ flex: 2, height: 24, background: preset.bg }} />
        <div style={{ flex: 1, height: 24, background: preset.bgElevated }} />
        <div style={{ flex: 1, height: 24, background: preset.accentDefault, opacity: 0.8 }} />
      </div>
      <span style={{ fontSize: 11, color: active ? colors.accent : colors.textMuted,
        textTransform: 'capitalize' }}>{name}</span>
    </button>
  )
}

function AccentSwatch({ hex, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      title={hex}
      style={{ width: 28, height: 28, borderRadius: 14, background: hex,
        border: `2px solid ${active ? colors.text : 'transparent'}`,
        cursor: 'pointer', transition: 'border-color 0.15s ease',
        boxShadow: active ? `0 0 0 2px ${hex}44` : 'none' }} />
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', cursor: 'pointer', fontSize: 13, color: colors.text }}>
      <span>{label}</span>
      <div onClick={() => onChange(!checked)}
        style={{ width: 36, height: 20, borderRadius: 10, position: 'relative',
          background: checked ? colors.accent : 'rgba(90, 106, 122, 0.3)',
          transition: 'background 0.2s ease', cursor: 'pointer' }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: colors.text,
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          transition: 'left 0.2s ease' }} />
      </div>
    </label>
  )
}

function OptionGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '6px 0' }}>
      {options.map(opt => (
        <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12,
            background: value === opt.id ? 'rgba(91, 159, 212, 0.15)' : 'transparent',
            border: `1px solid ${value === opt.id ? colors.accent : colors.border}`,
            color: value === opt.id ? colors.accent : colors.textMuted,
            cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'center' }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function TrailCard({ mode, active, onClick }) {
  const icons = { kitty: 'zap', sparkle: 'sparkles', ink: 'pencil' }
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 12px', borderRadius: 8,
        background: active ? 'rgba(91, 159, 212, 0.1)' : 'transparent',
        border: `1px solid ${active ? colors.accent : colors.border}`,
        cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left' }}>
      <div style={{ width: 32, height: 32, borderRadius: 6,
        background: active ? `${colors.accent}22` : 'rgba(90, 106, 122, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icons[mode.id] || 'zap'} size={16}
          style={{ color: active ? colors.accent : colors.textMuted }} />
      </div>
      <div>
        <div style={{ fontSize: 13, color: active ? colors.accent : colors.text, fontWeight: 500 }}>
          {mode.label}
        </div>
        <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{mode.desc}</div>
      </div>
    </button>
  )
}

export default function CustomizationPane() {
  const { prefs, updatePrefs } = usePreferences()
  const [hexInput, setHexInput] = useState(prefs.theme.accent_hex)

  function handlePresetChange(name) {
    const preset = getPreset(name)
    const hex = hexInput || preset.accentDefault
    updatePrefs({ theme: { preset: name, accent_hex: hex } })
  }

  function handleAccentChange(hex) {
    setHexInput(hex)
    updatePrefs({ theme: { accent_hex: hex } })
  }

  function handleHexInput(val) {
    setHexInput(val)
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      updatePrefs({ theme: { accent_hex: val } })
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: space[5], color: colors.text }}>
      <div style={{ ...typography.greeting, marginBottom: space[1] }}>Customization</div>
      <p style={{ fontSize: 13, color: colors.textMuted, marginBottom: space[4], marginTop: 0 }}>
        Make glean yours. Changes apply live.
      </p>

      {/* Theme section */}
      <Section title="Theme" icon="palette">
        <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 8 }}>
          Presets
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {getPresets().map(name => (
            <ThemeCard key={name} name={name}
              active={prefs.theme.preset === name}
              onClick={() => handlePresetChange(name)} />
          ))}
        </div>

        <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 8 }}>
          Accent color
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {accentSwatches.map(s => (
            <AccentSwatch key={s.hex} hex={s.hex}
              active={prefs.theme.accent_hex === s.hex}
              onClick={() => handleAccentChange(s.hex)} />
          ))}
          <input value={hexInput} onChange={(e) => handleHexInput(e.target.value)}
            placeholder="#hex"
            style={{ width: 80, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace',
              background: colors.bg, border: `1px solid ${colors.border}`,
              borderRadius: 4, color: colors.text, outline: 'none' }} />
        </div>
      </Section>

      {/* Layout section */}
      <Section title="Layout & Density" icon="monitor">
        <Toggle label="Show status bar"
          checked={prefs.layout.show_status_bar}
          onChange={(v) => updatePrefs({ layout: { show_status_bar: v } })} />

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Density</div>
          <OptionGroup options={densities} value={prefs.layout.density}
            onChange={(v) => updatePrefs({ layout: { density: v } })} />
        </div>
      </Section>

      {/* Editor section */}
      <Section title="Editor" icon="pencil">
        <Toggle label="Cursor trail"
          checked={prefs.editor.cursor_trail_enabled}
          onChange={(v) => updatePrefs({ editor: { cursor_trail_enabled: v } })} />

        {prefs.editor.cursor_trail_enabled && (
          <>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 8, marginTop: 12 }}>
              Trail style
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {trailModes.map(mode => (
            <TrailCard key={mode.id} mode={mode}
              active={prefs.editor.cursor_trail_mode === mode.id}
              onClick={() => updatePrefs({ editor: { cursor_trail_mode: mode.id } })} />
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Trail intensity</div>
          <OptionGroup options={trailIntensities} value={prefs.editor.cursor_trail_intensity}
            onChange={(v) => updatePrefs({ editor: { cursor_trail_intensity: v } })} />
        </div>

        <div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Trail color</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button"
              onClick={() => updatePrefs({ editor: { cursor_trail_color: 'accent' } })}
              style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12,
                background: prefs.editor.cursor_trail_color === 'accent' ? `${colors.accent}22` : 'transparent',
                border: `1px solid ${prefs.editor.cursor_trail_color === 'accent' ? colors.accent : colors.border}`,
                color: prefs.editor.cursor_trail_color === 'accent' ? colors.accent : colors.textMuted,
                cursor: 'pointer' }}>
              Match accent
            </button>
            {accentSwatches.slice(0, 4).map(s => (
              <button key={s.hex} type="button"
                onClick={() => updatePrefs({ editor: { cursor_trail_color: s.hex } })}
                style={{ width: 24, height: 24, borderRadius: 12, background: s.hex,
                  border: `2px solid ${prefs.editor.cursor_trail_color === s.hex ? colors.text : 'transparent'}`,
                  cursor: 'pointer' }} />
            ))}
          </div>
        </div>
          </>
        )}
      </Section>
    </div>
  )
}
