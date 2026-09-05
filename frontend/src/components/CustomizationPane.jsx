import { useState, useRef, useEffect } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { colors, space, typography } from '../lib/theme'
import { usePreferences } from '../lib/preferences-context'
import { getPresets, getPreset } from '../lib/apply-theme'
import Icon from './Icon'
import Select from './Select'

const accentSwatches = [
  { label: 'Blue', hex: '#5b9fd4' },
  { label: 'Gold', hex: '#ffb366' },
  { label: 'Rose', hex: '#ff8080' },
  { label: 'Mint', hex: '#66ffcc' },
  { label: 'Violet', hex: '#b08cff' },
  { label: 'Coral', hex: '#ff8855' },
]

const trailModes = [
  { id: 'beam', label: 'Default', desc: 'Smooth morphing blob follows cursor jumps' },
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

const typingStyles = [
  { id: 'drop', label: 'Drop', desc: 'Character drops in from above' },
  { id: 'fade', label: 'Fade', desc: 'Soft fade in at its position' },
  { id: 'pop', label: 'Pop', desc: 'Pops in with a quick scale bounce' },
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
      data-tip={hex}
      style={{ width: 28, height: 28, borderRadius: 14, background: hex,
        border: `2px solid ${active ? colors.text : 'transparent'}`,
        cursor: 'pointer', transition: 'border-color 0.15s ease',
        boxShadow: active ? `0 0 0 2px ${hex}44` : 'none' }} />
  )
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', cursor: 'pointer', fontSize: 13, color: colors.text }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
        {hint && (
          <span data-tip={hint}
            style={{ width: 15, height: 15, borderRadius: 8,
              background: 'rgba(90, 106, 122, 0.25)', color: colors.textMuted,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, cursor: 'help' }}>?</span>
        )}
      </span>
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

function Slider({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: colors.text, fontFamily: 'monospace' }}>{value}{unit}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min} max={max} step={step}
        style={{ position: 'relative', display: 'flex', alignItems: 'center',
          width: '100%', height: 20, cursor: 'pointer',
          touchAction: 'none', userSelect: 'none' }}>
        <SliderPrimitive.Track
          style={{ position: 'relative', flex: 1, height: 4, borderRadius: 2,
            background: 'rgba(90, 106, 122, 0.25)' }}>
          <SliderPrimitive.Range
            style={{ position: 'absolute', height: '100%', borderRadius: 2,
              background: colors.accent }} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          style={{ display: 'block', width: 16, height: 16, borderRadius: 8,
            background: colors.accent, border: '2px solid ' + colors.bgElevated,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'background 150ms ease-out, box-shadow 150ms ease-out',
            outline: 'none' }}
          onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px ' + colors.accent + '44' }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)' }}
        />
      </SliderPrimitive.Root>
    </div>
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

const FONT_OPTIONS = [
  { value: 'monospace', label: 'Monospace' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: '"Fira Code", monospace', label: 'Fira Code' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
  { value: 'ui-monospace, monospace', label: 'System Mono' },
]

function FontSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = FONT_OPTIONS.find(f => f.value === value)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} style={{ marginBottom: 10, position: 'relative' }}>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Font</div>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 12,
          background: colors.bg, border: '1px solid ' + colors.border,
          color: colors.text, cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: value }}>
        <span>{current?.label || value}</span>
        <span style={{ color: colors.textMuted, fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          marginTop: 4, background: colors.bgElevated, border: '1px solid ' + colors.border,
          borderRadius: 6, overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {FONT_OPTIONS.map(f => (
            <button key={f.value} type="button"
              onClick={() => { onChange(f.value); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '8px 10px',
                background: f.value === value ? colors.accent + '22' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 12, color: f.value === value ? colors.accent : colors.text,
                fontFamily: f.value,
                transition: 'background 100ms ease-out' }}
              onMouseEnter={(e) => { if (f.value !== value) e.currentTarget.style.background = 'rgba(90,106,122,0.1)' }}
              onMouseLeave={(e) => { if (f.value !== value) e.currentTarget.style.background = 'transparent' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TrailCard({ mode, active, onClick }) {
  const icons = { beam: 'zap', sparkle: 'sparkles', ink: 'pencil' }
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
        <FontSelect value={prefs.editor.font_family}
          onChange={(v) => updatePrefs({ editor: { ...prefs.editor, font_family: v } })} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Size</div>
            <Select
              value={prefs.editor.font_size}
              options={[12, 13, 14, 15, 16, 18, 20].map(s => ({ value: s, label: s + 'px' }))}
              onChange={(v) => updatePrefs({ editor: { ...prefs.editor, font_size: v } })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Line height</div>
            <Select
              value={prefs.editor.line_height}
              options={['1.2', '1.4', '1.6', '1.8', '2.0'].map(v => ({ value: Number(v), label: v }))}
              onChange={(v) => updatePrefs({ editor: { ...prefs.editor, line_height: v } })}
            />
          </div>
        </div>

        <Toggle label="Spell check"
          hint="Red underlines under misspelled words while typing."
          checked={prefs.editor.spell_check_enabled !== false}
          onChange={(v) => updatePrefs({ editor: { spell_check_enabled: v } })} />

        <Toggle label="Cursor trail"
          hint="The blinking text caret leaves a trail when it jumps between positions."
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

        <div style={{ marginTop: 14 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 10 }}>
            Trail physics
          </div>
          <Slider label="Fast fade" value={prefs.editor.cursor_trail_decay_fast ?? 80}
            min={10} max={500} step={10} unit=" ms"
            onChange={(v) => updatePrefs({ editor: { cursor_trail_decay_fast: v } })} />
          <Slider label="Tail decay" value={prefs.editor.cursor_trail_decay_slow ?? 300}
            min={50} max={2000} step={10} unit=" ms"
            onChange={(v) => updatePrefs({ editor: { cursor_trail_decay_slow: v } })} />
          <Slider label="Trail length" value={prefs.editor.cursor_trail_length ?? 12}
            min={4} max={64} step={1} unit=" pts"
            onChange={(v) => updatePrefs({ editor: { cursor_trail_length: v } })} />
          <Slider label="Trigger distance" value={prefs.editor.cursor_trail_start_threshold ?? 4}
            min={1} max={32} step={1} unit=" px"
            onChange={(v) => updatePrefs({ editor: { cursor_trail_start_threshold: v } })} />
        </div>
          </>
        )}

        <Toggle label="Animated typing"
          hint="Characters animate when typed and sparkle on backspace."
          checked={prefs.editor.animated_text_enabled}
          onChange={(v) => updatePrefs({ editor: { animated_text_enabled: v } })} />

        {prefs.editor.animated_text_enabled && (
          <>
            <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 8, marginTop: 12 }}>
              Typing style
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {typingStyles.map(style => (
                <TrailCard key={style.id} mode={style}
                  active={prefs.editor.animated_text_style === style.id}
                  onClick={() => updatePrefs({ editor: { animated_text_style: style.id } })} />
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 8 }}>
            Editing
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Tab width</div>
              <Select
                value={prefs.editor.tab_width || 2}
                options={[{ value: 2, label: '2 spaces' }, { value: 4, label: '4 spaces' }]}
                onChange={(v) => updatePrefs({ editor: { ...prefs.editor, tab_width: v } })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>Autosave</div>
              <Select
                value={prefs.editor.autosave_interval || 3}
                options={[{ value: 1, label: '1s' }, { value: 3, label: '3s' }, { value: 5, label: '5s' }, { value: 10, label: '10s' }]}
                onChange={(v) => updatePrefs({ editor: { ...prefs.editor, autosave_interval: v } })}
              />
            </div>
          </div>
          <Toggle label="Word wrap"
            checked={prefs.editor.word_wrap !== false}
            onChange={(v) => updatePrefs({ editor: { ...prefs.editor, word_wrap: v } })} />
          <Toggle label="Line numbers"
            checked={prefs.editor.line_numbers === true}
            onChange={(v) => updatePrefs({ editor: { ...prefs.editor, line_numbers: v } })} />
        </div>
      </Section>

      {/* Constellation section: starfield appearance knobs */}
      <Section title="Constellation" icon="moon">
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>Star density</div>
        <OptionGroup
          options={[
            { id: 'sparse', label: 'Sparse' },
            { id: 'normal', label: 'Normal' },
            { id: 'dense', label: 'Dense' },
          ]}
          value={prefs.sky.density}
          onChange={(v) => updatePrefs({ sky: { density: v } })} />

        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 }}>Twinkle speed</div>
        <OptionGroup
          options={[
            { id: 'slow', label: 'Slow' },
            { id: 'normal', label: 'Normal' },
            { id: 'fast', label: 'Fast' },
          ]}
          value={prefs.sky.twinkle_speed}
          onChange={(v) => updatePrefs({ sky: { twinkle_speed: v } })} />

        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6, marginTop: 14 }}>Star color</div>
        <OptionGroup
          options={[
            { id: 'natural', label: 'Natural' },
            { id: 'warm', label: 'Warm' },
            { id: 'cool', label: 'Cool' },
          ]}
          value={prefs.sky.star_color}
          onChange={(v) => updatePrefs({ sky: { star_color: v } })} />

        <div style={{ marginTop: 14 }}>
          <Toggle label="Nebula clouds"
            hint="Faint colored dust clouds in the deep background."
            checked={prefs.sky.nebula_enabled !== false}
            onChange={(v) => updatePrefs({ sky: { nebula_enabled: v } })} />
        </div>

        <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 6, marginTop: 14 }}>
          Season
        </div>
        <OptionGroup
          options={[
            { id: '', label: 'Auto' },
            { id: 'winter', label: 'Winter' },
            { id: 'spring', label: 'Spring' },
            { id: 'summer', label: 'Summer' },
            { id: 'autumn', label: 'Autumn' },
          ]}
          value={prefs.sky.season || ''}
          onChange={(v) => updatePrefs({ sky: { season: v } })} />

        <div style={{ ...typography.sectionLabel, color: colors.textMuted, marginBottom: 8, marginTop: 14 }}>
          Star species colors
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'species_warm', label: 'Warm', def: colors.starWarm },
            { key: 'species_cool', label: 'Cool', def: colors.starCool },
            { key: 'species_hot', label: 'Hot', def: colors.starHot },
            { key: 'species_neutral', label: 'Neutral', def: colors.starNeutral },
          ].map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ width: 64, fontSize: 12, color: colors.textMuted, flexShrink: 0 }}>{s.label}</label>
              {accentSwatches.map(sw => (
                <AccentSwatch key={sw.hex} hex={sw.hex}
                  active={prefs.sky[s.key] === sw.hex}
                  onClick={() => updatePrefs({ sky: { [s.key]: sw.hex } })} />
              ))}
              <input
                value={prefs.sky[s.key] || ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^#[0-9a-fA-F]{6}$/.test(val)) {
                    updatePrefs({ sky: { [s.key]: val } })
                  }
                }}
                placeholder={s.def}
                style={{ width: 84, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace',
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  borderRadius: 4, color: colors.text, outline: 'none' }} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
