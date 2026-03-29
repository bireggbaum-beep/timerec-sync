import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { startSync } from './db/sync'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      const e = this.state.error
      return (
        <pre style={{color:'red',padding:'1em',fontFamily:'monospace',whiteSpace:'pre-wrap',fontSize:'12px'}}>
          {e.message}{'\n'}{e.stack}
        </pre>
      )
    }
    return this.props.children
  }
}

startSync()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
