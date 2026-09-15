// Shared line-gutter state: the ProseMirror plugin reads it on every
// repaint, the React side mutates it and then calls api.refresh().
// Kept outside React so pref flips never rebuild the Milkdown editor
export const lineGutterState = { enabled: false, wrap: true, api: null }

export function setLineGutterState(patch) {
  Object.assign(lineGutterState, patch)
}
