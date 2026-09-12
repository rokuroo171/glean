import { Plugin, PluginKey } from 'prosemirror-state'

export const linkClickKey = new PluginKey('glean-link-click')

// Plain clicks must never navigate the app window away, so every anchor
// click is preventDefaulted; ctrl/cmd+click opens http and mailto hrefs
// in the system browser, matching the read view's behavior
export const linkClick = () => new Plugin({
  key: linkClickKey,
  props: {
    handleDOMEvents: {
      click(view, event) {
        const target = event.target
        const a = target && target.closest ? target.closest('a') : null
        if (!a || !view.dom.contains(a)) return false
        event.preventDefault()
        if (!(event.ctrlKey || event.metaKey)) return true
        const href = a.getAttribute('href') || ''
        if (!/^(https?:|mailto:)/.test(href)) return true
        if (window.runtime?.BrowserOpenURL) window.runtime.BrowserOpenURL(href)
        else window.open(href, '_blank')
        return true
      }
    }
  }
})
