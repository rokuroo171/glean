import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { prismThemeCss } from './lib/prism-theme'

// Inject the prism token theme once (mapped to glean theme variables)
const styleEl = document.createElement('style')
styleEl.textContent = prismThemeCss
document.head.appendChild(styleEl)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
