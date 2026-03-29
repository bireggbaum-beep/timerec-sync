import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startSync } from './db/sync'

try {
  startSync()
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (e) {
  document.getElementById('root').innerHTML =
    `<pre style="color:red;padding:1em;font-family:monospace">${e.message}\n${e.stack}</pre>`
}
