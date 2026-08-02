import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './ui/styles.css'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const root = createRoot(document.getElementById('root'))

if (!hasWebGL()) {
  root.render(
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        textAlign: 'center',
        padding: '2rem',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.8rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(235,231,222,0.6)',
      }}
    >
      This board is rendered in WebGL. Your browser cannot open it.
    </div>,
  )
} else {
  // StrictMode double-invokes effects in development. Everything here is
  // written to tolerate that — texture caches are keyed, camera state is a
  // singleton, and audio start is idempotent.
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
