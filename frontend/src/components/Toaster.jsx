import { useSyncExternalStore } from 'react'
import { colors } from '../lib/theme'
import { subscribe, getToasts, dismiss, pause, resume, TOAST_VARIANTS } from '../lib/toast'

const ITEM_H = 64
const GAP = 8

const icon = (d) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const VARIANT_ICONS = {
  info: icon('M12 8v.01M12 12v4'),
  success: icon('M20 6 9 17l-5-5'),
  error: icon('M18 6 6 18M6 6l12 12'),
}

function ToastRow({ t }) {
  const variant = TOAST_VARIANTS[t.variant] || TOAST_VARIANTS.info
  return (
    <div
      role="status"
      onMouseEnter={() => pause(t.id)}
      onMouseLeave={() => resume(t.id)}
      style={{
        height: ITEM_H, marginBottom: GAP,
        opacity: t.leaving ? 0 : 1,
        pointerEvents: t.leaving ? 'none' : 'auto',
        transition: 'opacity 160ms ease-out',
        display: 'flex', alignItems: 'stretch',
        background: colors.bgElevated, border: `1px solid ${colors.borderStrong}`,
        borderRadius: 10, boxShadow: colors.shadow, overflow: 'hidden',
        minWidth: 300, maxWidth: 380,
      }}
    >
      <div style={{ width: 3, background: variant.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: variant.dot, display: 'inline-flex', flexShrink: 0 }}>{VARIANT_ICONS[t.variant] || VARIANT_ICONS.info}</span>
          <span style={{ color: colors.text, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
        </div>
        {t.description && (
          <div style={{ color: colors.textMuted, fontSize: 12, paddingLeft: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 0', flexShrink: 0 }}>
        {t.action && (
          <button type="button" onClick={() => { t.action.onClick?.(); dismiss(t.id) }}
            style={{ background: colors.accent, border: 'none', color: colors.bg, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.action.label}
          </button>
        )}
        {t.cancel && (
          <button type="button" onClick={() => { t.cancel.onClick?.(); dismiss(t.id) }}
            style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>
            {t.cancel.label}
          </button>
        )}
        <button type="button" onClick={() => dismiss(t.id)} aria-label="dismiss"
          style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4, display: 'inline-flex' }}>
          {VARIANT_ICONS.error}
        </button>
      </div>
    </div>
  )
}

export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts)
  if (!toasts.length) return null
  // bottom-up stack: newest at the bottom; rows animate out in place and
  // the "more" counter only counts rows the user can still interact with
  const shown = toasts.slice(-3)
  const moreCount = toasts.filter((t) => !t.leaving).length - shown.filter((t) => !t.leaving).length
  return (
    <div style={{ position: 'fixed', right: 16, bottom: 34, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {moreCount > 0 && (
        <div style={{ height: 26, marginBottom: GAP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 11 }}>
          {moreCount} more
        </div>
      )}
      {shown.map((t) => <ToastRow key={t.id} t={t} />)}
    </div>
  )
}
