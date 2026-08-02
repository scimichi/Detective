import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Experience from './scene/Experience.jsx'
import Intro from './ui/Intro.jsx'
import HUD from './ui/HUD.jsx'
import Inspector from './ui/Inspector.jsx'
import TimelinePanel from './ui/TimelinePanel.jsx'
import SearchPanel from './ui/SearchPanel.jsx'
import { useStore } from './state/store.js'
import { nav, flyTo } from './scene/nav.js'
import { audio } from './audio/soundscape.js'

export default function App() {
  const quality = useStore((s) => s.quality)

  useEffect(() => {
    const s = useStore.getState

    const onKey = (e) => {
      // Never steal keys from the search field.
      if (e.target && /input|textarea/i.test(e.target.tagName)) {
        if (e.key === 'Escape') s().toggleSearch()
        return
      }

      const st = s()
      switch (e.key) {
        case ' ':
          if (st.phase === 'board') {
            e.preventDefault()
            st.toggleGraph()
          }
          break
        case 't':
        case 'T':
          if (st.phase === 'board') st.toggleTimeline()
          break
        case 'u':
        case 'U':
          st.setLens('uv')
          break
        case 'i':
        case 'I':
          st.setLens('ir')
          break
        case '/':
          e.preventDefault()
          st.toggleSearch()
          break
        case '?':
          st.toggleHelp()
          break
        case 'Escape':
          // Back out one layer at a time, in the order they were entered.
          if (st.helpOpen) st.toggleHelp()
          else if (st.searchOpen) st.toggleSearch()
          else if (st.timelineOpen) st.toggleTimeline()
          else if (st.lens !== 'none') st.setLens(st.lens)
          else if (st.mode === 'graph') st.setMode('board')
          else if (st.focusId) {
            st.focus(null)
            flyTo(nav.tgt.x, nav.tgt.y, 16, 1.5)
          } else if (st.phase === 'board') {
            st.closeCase()
            flyTo(0, 0, 26, 2)
          }
          break
        default:
          break
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        s().toggleSearch()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A deep link skips the intro, and with it the gesture that lets the room
  // make noise. Arm the soundscape on whatever the first interaction is.
  useEffect(() => {
    const arm = () => {
      if (useStore.getState().audioOn) audio.start()
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
    window.addEventListener('pointerdown', arm)
    window.addEventListener('keydown', arm)
    return () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [])

  return (
    <>
      <div className="stage">
        <Canvas
          shadows="soft"
          dpr={[1, quality === 'low' ? 1.2 : 1.8]}
          gl={{
            antialias: false, // the post stack handles edges
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          }}
          camera={{ fov: 42, near: 0.05, far: 4000, position: [0, 0, 24] }}
          onCreated={({ gl, scene, camera }) => {
            if (import.meta.env.DEV) window.__three = { gl, scene, camera }
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.08
            gl.shadowMap.type = THREE.PCFSoftShadowMap
            gl.shadowMap.autoUpdate = true
            scene.matrixWorldAutoUpdate = true
          }}
          onPointerMissed={() => {
            // Clicking the dark deselects, the way putting a document down does.
            const st = useStore.getState()
            if (!nav.dragged && st.focusId) st.focus(null)
          }}
        >
          <Experience />
        </Canvas>
      </div>

      <div className="overlay">
        <Intro />
        <HUD />
        <Inspector />
        <TimelinePanel />
        <SearchPanel />
      </div>
    </>
  )
}
