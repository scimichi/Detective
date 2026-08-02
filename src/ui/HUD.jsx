import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'
import { KIND_LABEL } from '../constants.js'
import { flyTo } from '../scene/nav.js'
import { audio } from '../audio/soundscape.js'
import { lod } from '../gfx/lod.js'

const fade = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
}

/** Everything you can do to the board, and everything the board is doing. */
export default function HUD() {
  const phase = useStore((s) => s.phase)
  const data = useStore((s) => (s.caseId ? s.activeCase() : null))
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const mode = useStore((s) => s.mode)
  const toggleGraph = useStore((s) => s.toggleGraph)
  const lens = useStore((s) => s.lens)
  const setLens = useStore((s) => s.setLens)
  const filters = useStore((s) => s.filters)
  const toggleFilter = useStore((s) => s.toggleFilter)
  const timelineOpen = useStore((s) => s.timelineOpen)
  const toggleTimeline = useStore((s) => s.toggleTimeline)
  const toggleSearch = useStore((s) => s.toggleSearch)
  const toggleHelp = useStore((s) => s.toggleHelp)
  const closeCase = useStore((s) => s.closeCase)
  const camDistance = useStore((s) => s.camDistance)
  const fps = useStore((s) => s.fps)
  const streaming = useStore((s) => s.streaming)
  const audioOn = useStore((s) => s.audioOn)
  const setAudio = useStore((s) => s.setAudio)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)

  // Stream count comes from the asset manager rather than React state.
  const setStreaming = useStore((s) => s.setStreaming)
  useEffect(() => {
    lod.onStreamChange = (n) => setStreaming(n)
    return () => {
      lod.onStreamChange = null
    }
  }, [setStreaming])

  useEffect(() => {
    audio.setMuted(!audioOn)
  }, [audioOn])

  const kinds = data ? Object.keys(data.counts) : []
  const [lo, hi] = data?.yearRange || [1900, 2024]
  const pct = ((year - lo) / Math.max(1, hi - lo)) * 100

  const visibleCount = data
    ? data.evidence.filter(
        (e) =>
          year >= e.since &&
          (e.until == null || year <= e.until) &&
          (filters.length === 0 || filters.includes(e.kind)),
      ).length
    : 0

  // Depth readout: where you are between the far wall and the paper fibres.
  const depthPct = Math.max(0, Math.min(100, (1 - Math.log10(Math.max(camDistance, 0.5)) / 2.85) * 100))

  return (
    <>
      <AnimatePresence>
        {phase === 'cloud' && (
          <motion.div className="cloud-title" {...fade} key="cloud-title">
            <h2>The Archive</h2>
            <p>Six of them have files. The rest are still waiting.</p>
          </motion.div>
        )}
        {phase === 'cloud' && (
          <motion.div className="cloud-caption" {...fade} key="cloud-caption">
            Scroll to move · Click a case to go inside
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'board' && data && (
          <motion.div className="hud-tl" {...fade} key="hud-tl">
            <h1 className="case-label">{data.title}</h1>
            <p className="case-sub">{data.subtitle}</p>

            <div className="year-block">
              <div className="year-head">
                <span>Time</span>
                <span>
                  {visibleCount} / {data.evidence.length} exhibits
                </span>
              </div>
              <div className="year-value">{year}</div>
              <input
                type="range"
                min={lo}
                max={hi}
                value={year}
                style={{ '--pct': `${pct}%` }}
                onChange={(e) => {
                  setYear(+e.target.value)
                  audio.rustle(0.012)
                }}
                aria-label="Year"
              />
              <div className="year-ticks">
                <span>{lo}</span>
                <span>{hi}</span>
              </div>
            </div>

            <div className="filters">
              {kinds.map((k) => (
                <button
                  key={k}
                  className={`chip ${filters.includes(k) ? 'on' : ''}`}
                  onClick={() => toggleFilter(k)}
                  title={KIND_LABEL[k]}
                >
                  {KIND_LABEL[k]} {data.counts[k]}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'board' && (
          <motion.div className="hud-tr" {...fade} key="hud-tr">
            <button
              className={`tool ${mode === 'graph' ? 'on' : ''}`}
              onClick={() => {
                toggleGraph()
                audio.rustle(0.06)
              }}
            >
              Relationships <kbd>space</kbd>
            </button>
            <button
              className={`tool ${timelineOpen ? 'on' : ''}`}
              onClick={toggleTimeline}
            >
              Timeline <kbd>t</kbd>
            </button>
            <button className={`tool ${lens === 'uv' ? 'on' : ''}`} onClick={() => setLens('uv')}>
              Ultraviolet <kbd>u</kbd>
            </button>
            <button className={`tool ${lens === 'ir' ? 'on' : ''}`} onClick={() => setLens('ir')}>
              Infrared <kbd>i</kbd>
            </button>
            <button className="tool" onClick={toggleSearch}>
              Search <kbd>/</kbd>
            </button>
            <button
              className={`tool ${audioOn ? 'on' : ''}`}
              onClick={() => setAudio(!audioOn)}
            >
              Room tone
            </button>
            <button
              className="tool"
              onClick={() =>
                setQuality(
                  quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high',
                )
              }
            >
              Quality · {quality}
            </button>
            <button className="tool" onClick={toggleHelp}>
              Controls <kbd>?</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'board' && (
          <motion.div className="hud-bl" {...fade} key="hud-bl">
            <div className="readout">
              Standoff <b>{camDistance.toFixed(2)} m</b>
            </div>
            <div className="readout">
              Detail{' '}
              <b>
                {camDistance < 1.15
                  ? 'fibre'
                  : camDistance < 3.2
                    ? 'full scan'
                    : camDistance < 9
                      ? '512 px'
                      : '64 px'}
              </b>
            </div>
            <div className="readout">
              {fps} fps · {lod.stats().textures} textures
            </div>
            <div className="depth-bar">
              <span style={{ left: `${depthPct}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {streaming > 0 && phase === 'board' && (
          <motion.div
            className="streaming"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            key="streaming"
          >
            <i />
            Streaming {streaming}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'board' && (
          <motion.button
            className="back"
            key="back"
            {...fade}
            onClick={() => {
              closeCase()
              flyTo(0, 0, 26, 2)
            }}
          >
            ← All cases
          </motion.button>
        )}
      </AnimatePresence>

      <LensTint lens={lens} />
      <Help />
    </>
  )
}

/** A cheap screen-space wash so the lens mode is felt, not just labelled. */
function LensTint({ lens }) {
  const ref = useRef()
  useEffect(() => {
    if (lens === 'none') return
    const onMove = (e) => {
      if (!ref.current) return
      ref.current.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`)
      ref.current.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [lens])

  if (lens === 'none') return null
  return <div ref={ref} className={`lens-tint ${lens}`} />
}

function Help() {
  const open = useStore((s) => s.helpOpen)
  const toggle = useStore((s) => s.toggleHelp)
  if (!open) return null
  return (
    <div className="help" onClick={toggle}>
      <div className="help-inner" onClick={(e) => e.stopPropagation()}>
        <h3>How to read a board</h3>
        {[
          ['Scroll', 'Moves the camera. It does not zoom — you are actually getting closer.'],
          ['Drag', 'Pan across the cork. In relationship mode, rotate the graph.'],
          ['Click', 'Frame a document. Click it again to go all the way in.'],
          ['W A S D / ↑ ← ↓ →', 'Pan. Q and E move you in and out.'],
          ['Space', 'Lift everything off the board into a 3D graph.'],
          ['T', 'Timeline. Every event opens into smaller events, without limit.'],
          ['U / I', 'Ultraviolet and infrared. Move the cursor to sweep the beam.'],
          ['/', 'Search the whole archive.'],
          ['Esc', 'Step back out, one level at a time.'],
        ].map(([k, v]) => (
          <div className="help-row" key={k}>
            <kbd>{k}</kbd>
            <span>{v}</span>
          </div>
        ))}
        <div className="help-row" style={{ borderBottom: 'none' }}>
          <kbd>Note</kbd>
          <span>
            Pull back far enough and the board is not the only one in the room.
          </span>
        </div>
      </div>
    </div>
  )
}
