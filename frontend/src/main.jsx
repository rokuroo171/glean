import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { prismThemeCss } from './lib/prism-theme'

// Self-hosted mono faces (weights 400/500) so fonts work offline
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/500.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/source-code-pro/400.css'
import '@fontsource/source-code-pro/500.css'

// Inject the prism token theme once (mapped to glean theme variables)
const styleEl = document.createElement('style')
styleEl.textContent = prismThemeCss
document.head.appendChild(styleEl)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
