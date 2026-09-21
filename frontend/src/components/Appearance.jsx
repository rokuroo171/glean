import { colors } from '../lib/theme'
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
  { id: 'beam', label: 'Beam', desc: 'Smooth blob follows the caret' },
  { id: 'sparkle', label: 'Sparkle', desc: 'Star particles fade behind it' },
  { id: 'ink', label: 'Ink', desc: 'Colored line that fades out' },
]

const typingStyles = [
  { id: 'drop', label: 'Drop', desc: 'Character drops in from above' },
  { id: 'fade', label: 'Fade', desc: 'Soft fade in at its position' },
  { id: 'pop', label: 'Pop', desc: 'Pops in with a scale bounce' },
]

const densities = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
  { id: 'dense', label: 'Dense' },
]

const FONT_OPTIONS = [
  { value: 'monospace', label: 'Monospace' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: '"Fira Code", monospace', label: 'Fira Code' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
  { value: 'ui-monospace, monospace', label: 'System Mono' },
]

function Card({ children }) {
  return (
    <div style={{ background: colors.bgCard, border: '1px solid ' + colors.border,
      borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>{children}</div>
  )
}

function RowHead({ label, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ color: colors.text }}>{label}</span>
      {hint && <span style={{ fontSize: 11, color: colors.textMuted }}>{hint}</span>}
    </div>
  )
}


function Row({ label, hint, children, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 16, padding: '10px 14px', borderBottom: last ? 'none' : '1px solid ' + colors.border }}>
      <RowHead label={label} hint={hint} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function CardTitle({ children }) {
  return (
    <div style={{ padding: '10px 14px 8px', fontSize: 11, fontWeight: 500,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted }}>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} role="switch" aria-checked={checked}
      style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
        background: checked ? colors.accent : 'rgba(90, 106, 122, 0.3)',
        transition: 'background 0.2s ease', cursor: 'pointer' }}>
      <div style={{ width: 16, height: 16, borderRadius: 8, background: colors.text,
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        transition: 'left 0.2s ease' }} />
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange, last }) {
  return (
    <Row label={label} hint={hint} last={last}>
      <Toggle checked={checked} onChange={onChange} />
    </Row>
  )
}

function OptionGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => (
        <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12,
            background: value === opt.id ? `${colors.accent}1a` : 'transparent',
            border: `1px solid ${value === opt.id ? colors.accent : colors.border}`,
            color: value === opt.id ? colors.accent : colors.textMuted,
            cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap' }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function ThemeCard({ name, active, onClick }) {
  const preset = getPreset(name)
  return (
    <button type="button" onClick={onClick} data-tip={name}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: 8, background: active ? `${colors.accent}1a` : 'transparent',
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s ease',
        minWidth: 80 }}>
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
    <button type="button" onClick={onClick} aria-label={hex} data-tip={hex}
      style={{ width: 28, height: 28, borderRadius: 14, background: hex, flexShrink: 0,
        border: `2px solid ${active ? colors.text : 'transparent'}`,
        cursor: 'pointer', transition: 'border-color 0.15s ease',
        boxShadow: active ? `0 0 0 2px ${hex}44` : 'none' }} />
  )
}

function ModeCard({ mode, active, onClick }) {
  const icons = { beam: 'zap', sparkle: 'sparkles', ink: 'pencil', drop: 'sparkle', fade: 'eye', pop: 'zap' }
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '10px 12px', borderRadius: 8, textAlign: 'left',
        background: active ? `${colors.accent}1a` : 'transparent',
        border: `1px solid ${active ? colors.accent : colors.border}`,
        cursor: 'pointer', transition: 'all 0.15s ease' }}>
      <div style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0,
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

export default function Appearance() {
  const { prefs, updatePrefs } = usePreferences()

  function handlePresetChange(name) {
    const preset = getPreset(name)
    const hex = prefs.theme.accent_hex || preset.accentDefault
    updatePrefs({ theme: { preset: name, accent_hex: hex } })
  }

  return (
    <div>
      <div style={{ padding: '10px 14px', fontSize: 12, color: colors.textMuted }}>
        glean's presence: themes, workspace, editor, and sky.
      </div>

      <Card>
        <CardTitle>Theme</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '0 14px 12px' }}>
          {getPresets().map(name => (
            <ThemeCard key={name} name={name}
              active={prefs.theme.preset === name}
              onClick={() => handlePresetChange(name)} />
          ))}
        </div>
        <Row label="Accent color" hint="Used across the UI; species colors below override it in the sky.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {accentSwatches.map(s => (
              <AccentSwatch key={s.hex} hex={s.hex}
                active={prefs.theme.accent_hex === s.hex}
                onClick={() => updatePrefs({ theme: { accent_hex: s.hex } })} />
            ))}
            <input
              value={prefs.theme.accent_hex}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                  updatePrefs({ theme: { accent_hex: e.target.value } })
                }
              }}
              placeholder="#hex"
              style={{ width: 80, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace',
                background: colors.bg, border: `1px solid ${colors.border}`,
                borderRadius: 4, color: colors.text, outline: 'none' }}
            />
          </div>
        </Row>
      </Card>

      <Card>
        <CardTitle>Interface</CardTitle>
        <Row label="Tab style">
          <OptionGroup
            options={[{ id: 'vertical', label: 'Vertical' }, { id: 'horizontal', label: 'Horizontal' }]}
            value={prefs.layout.tab_mode}
            onChange={(v) => updatePrefs({ layout: { tab_mode: v } })} />
        </Row>
        <Row label="Density" hint="How much breathing room the workspace gets.">
          <OptionGroup options={densities} value={prefs.layout.density}
            onChange={(v) => updatePrefs({ layout: { density: v } })} />
        </Row>
        <Row label="Status bar" hint="Line, column, character and word counts under the editor.">
          <Toggle checked={prefs.layout.show_status_bar}
            onChange={(v) => updatePrefs({ layout: { show_status_bar: v } })} />
        </Row>
        <ToggleRow last label="Outline" hint="Automatic heading list beside long notes."
          checked={prefs.editor.show_outline !== false}
          onChange={(v) => updatePrefs({ editor: { show_outline: v } })} />
      </Card>

      <Card>
        <CardTitle>Editor</CardTitle>
        <Row label="Font" last>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 150 }}>
              <Select
                value={prefs.editor.font_family}
                options={FONT_OPTIONS}
                onChange={(v) => updatePrefs({ editor: { ...prefs.editor, font_family: v } })} />
            </div>
            <div style={{ width: 80 }}>
              <Select
                value={prefs.editor.font_size}
                options={[12, 13, 14, 15, 16, 18, 20].map(s => ({ value: s, label: s + 'px' }))}
                onChange={(v) => updatePrefs({ editor: { ...prefs.editor, font_size: v } })} />
            </div>
            <div style={{ width: 80 }}>
              <Select
                value={prefs.editor.line_height}
                options={['1.2', '1.4', '1.6', '1.8', '2.0'].map(v => ({ value: Number(v), label: v }))}
                onChange={(v) => updatePrefs({ editor: { ...prefs.editor, line_height: v } })} />
            </div>
          </div>
        </Row>
      </Card>

      <Card>
        <CardTitle>Editing</CardTitle>
        <Row label="Word wrap" hint="Long lines wrap instead of scrolling sideways.">
          <Toggle checked={prefs.editor.word_wrap !== false}
            onChange={(v) => updatePrefs({ editor: { ...prefs.editor, word_wrap: v } })} />
        </Row>
        <Row label="Centered width" hint="Keep the column narrow and centered for reading.">
          <Toggle checked={prefs.editor.narrow_width === true}
            onChange={(v) => updatePrefs({ editor: { narrow_width: v } })} />
        </Row>
        <Row label="Tab width">
          <OptionGroup options={[{ id: 2, label: '2' }, { id: 4, label: '4' }]}
            value={prefs.editor.tab_width || 2}
            onChange={(v) => updatePrefs({ editor: { ...prefs.editor, tab_width: v } })} />
        </Row>
        <Row label="Autosave" hint="Save your note after a quiet moment.">
          <OptionGroup
            options={[{ id: 1, label: '1s' }, { id: 3, label: '3s' }, { id: 5, label: '5s' }, { id: 10, label: '10s' }]}
            value={prefs.editor.autosave_interval || 3}
            onChange={(v) => updatePrefs({ editor: { ...prefs.editor, autosave_interval: v } })} />
        </Row>
        <Row label="Spell check">
          <Toggle checked={prefs.editor.spell_check_enabled !== false}
            onChange={(v) => updatePrefs({ editor: { spell_check_enabled: v } })} />
        </Row>
        <ToggleRow last label="Animated typing" hint="Characters animate when typed."
          checked={prefs.editor.animated_text_enabled}
          onChange={(v) => updatePrefs({ editor: { animated_text_enabled: v } })} />
        {prefs.editor.animated_text_enabled && (
          <Row label="Style" last>
            <OptionGroup options={typingStyles.map(t => ({ id: t.id, label: t.label }))}
              value={prefs.editor.animated_text_style}
              onChange={(v) => updatePrefs({ editor: { animated_text_style: v } })} />
          </Row>
        )}
      </Card>

      <Card>
        <CardTitle>Cursor feedback</CardTitle>
        <ToggleRow label="Cursor trail" hint="The caret leaves a trail when it jumps."
          checked={prefs.editor.cursor_trail_enabled}
          onChange={(v) => updatePrefs({ editor: { cursor_trail_enabled: v } })} />
        {prefs.editor.cursor_trail_enabled && (
          <>
            <Row label="Style" last>
              <OptionGroup options={trailModes.map(m => ({ id: m.id, label: m.label }))}
                value={prefs.editor.cursor_trail_mode}
                onChange={(v) => updatePrefs({ editor: { cursor_trail_mode: v } })} />
            </Row>
            <Row label="Intensity">
              <OptionGroup
                options={[{ id: 'subtle', label: 'Subtle' }, { id: 'normal', label: 'Normal' }, { id: 'vivid', label: 'Vivid' }]}
                value={prefs.editor.cursor_trail_intensity}
                onChange={(v) => updatePrefs({ editor: { cursor_trail_intensity: v } })} />
            </Row>
            <Row label="Color">
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => updatePrefs({ editor: { cursor_trail_color: 'accent' } })}
                  style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12,
                    background: prefs.editor.cursor_trail_color === 'accent' ? `${colors.accent}22` : 'transparent',
                    border: `1px solid ${prefs.editor.cursor_trail_color === 'accent' ? colors.accent : colors.border}`,
                    color: prefs.editor.cursor_trail_color === 'accent' ? colors.accent : colors.textMuted,
                    cursor: 'pointer' }}>
                  Match accent
                </button>
                {accentSwatches.slice(0, 4).map(s => (
                  <AccentSwatch key={s.hex} hex={s.hex} active={prefs.editor.cursor_trail_color === s.hex}
                    onClick={() => updatePrefs({ editor: { cursor_trail_color: s.hex } })} />
                ))}
              </div>
            </Row>
          </>
        )}
        <div style={{ padding: '6px 14px 10px', fontSize: 11, color: colors.textDim }}>
          Trail shape lives in the editor pane menu under Cursor trail tuning.
        </div>
      </Card>

      <Card>
        <CardTitle>Constellation</CardTitle>
        <Row label="Star density">
          <OptionGroup
            options={[{ id: 'sparse', label: 'Sparse' }, { id: 'normal', label: 'Normal' }, { id: 'dense', label: 'Dense' }]}
            value={prefs.sky.density}
            onChange={(v) => updatePrefs({ sky: { density: v } })} />
        </Row>
        <Row label="Twinkle speed">
          <OptionGroup
            options={[{ id: 'slow', label: 'Slow' }, { id: 'normal', label: 'Normal' }, { id: 'fast', label: 'Fast' }]}
            value={prefs.sky.twinkle_speed}
            onChange={(v) => updatePrefs({ sky: { twinkle_speed: v } })} />
        </Row>
        <Row label="Star color">
          <OptionGroup
            options={[{ id: 'natural', label: 'Natural' }, { id: 'warm', label: 'Warm' }, { id: 'cool', label: 'Cool' }]}
            value={prefs.sky.star_color}
            onChange={(v) => updatePrefs({ sky: { star_color: v } })} />
        </Row>
        <Row label="Season" hint="Auto follows the real seasons.">
          <OptionGroup
            options={[{ id: '', label: 'Auto' }, { id: 'winter', label: 'Winter' }, { id: 'spring', label: 'Spring' }, { id: 'summer', label: 'Summer' }, { id: 'autumn', label: 'Autumn' }]}
            value={prefs.sky.season || ''}
            onChange={(v) => updatePrefs({ sky: { season: v } })} />
        </Row>
        <ToggleRow last label="Nebula clouds" hint="Faint colored dust in the deep background."
          checked={prefs.sky.nebula_enabled !== false}
          onChange={(v) => updatePrefs({ sky: { nebula_enabled: v } })} />
        <div style={{ padding: '10px 14px 0', fontSize: 11, color: colors.textMuted }}>
          Star species colors: leave empty to follow the theme.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', padding: '6px 14px 12px' }}>
          {[
            { key: 'species_warm', label: 'Warm', def: colors.starWarm },
            { key: 'species_cool', label: 'Cool', def: colors.starCool },
            { key: 'species_hot', label: 'Hot', def: colors.starHot },
            { key: 'species_neutral', label: 'Neutral', def: colors.starNeutral },
          ].map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ width: 56, fontSize: 12, color: colors.textMuted, flexShrink: 0 }}>{s.label}</label>
              <input
                value={prefs.sky[s.key] || ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '' || /^#[0-9a-fA-F]{6}$/.test(val)) {
                    updatePrefs({ sky: { [s.key]: val } })
                  }
                }}
                placeholder={s.def}
                style={{ width: 90, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace',
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  borderRadius: 4, color: colors.text, outline: 'none' }} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
