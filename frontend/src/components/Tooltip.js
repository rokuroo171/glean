/*
 * CSS-only tooltip via data-tip attribute.
 * Import this module once to inject the tooltip styles.
 * Usage: <button data-tip="label">...</button>
 */
;(function injectTooltipStyles() {
  if (document.getElementById('glean-tooltip-css')) return
  const style = document.createElement('style')
  style.id = 'glean-tooltip-css'
  style.textContent = `
    [data-tip] { position: relative; }
    [data-tip]::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      background: rgba(10, 14, 24, 0.92);
      backdrop-filter: blur(8px);
      color: #c8d6e0;
      font-size: 11px;
      line-height: 1.3;
      white-space: nowrap;
      border-radius: 4px;
      border: 1px solid rgba(180, 140, 80, 0.15);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease 0.35s;
      z-index: 9999;
    }
    [data-tip]:hover::after {
      opacity: 1;
    }
  `
  document.head.appendChild(style)
})()
