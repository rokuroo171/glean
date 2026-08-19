import { colors } from '../lib/theme'

const runtime = window.runtime

function Control({ label, onClick, danger }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      style={{ '--wails-draggable': 'no-drag', background: 'none', border: 'none', width: 42, height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textMuted, cursor: 'pointer', padding: 0 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#c04040' : 'rgba(90,106,122,0.2)'
        e.currentTarget.style.color = danger ? '#fff' : colors.text
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = colors.textMuted
      }}
    >
      {label === 'minimize' ? (
        <svg width={12} height={12} viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" strokeWidth={1} /></svg>
      ) : label === 'maximize' ? (
        <svg width={11} height={11} viewBox="0 0 12 12"><rect x={1.5} y={1.5} width={9} height={9} fill="none" stroke="currentColor" strokeWidth={1} /></svg>
      ) : (
        <svg width={12} height={12} viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth={1} /></svg>
      )}
    </button>
  )
}

// The native title bar is gone (frameless), so the app draws its own
// window controls. Hidden in the browser mock, window.runtime is absent.
export default function WindowControls() {
  if (!runtime) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0 }}>
      <Control label="minimize" onClick={() => runtime.WindowMinimise()} />
      <Control label="maximize" onClick={() => runtime.WindowToggleMaximise()} />
      <Control label="close" onClick={() => runtime.Quit()} danger />
    </div>
  )
}