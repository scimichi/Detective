import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'

/**
 * Scroll horizontally. Years pass. Every event opens into smaller events, and
 * those open too — the data is a tree and the component simply recurses, so
 * there is no depth limit other than what has been written down.
 */
export default function TimelinePanel() {
  const open = useStore((s) => s.timelineOpen)
  const toggle = useStore((s) => s.toggleTimeline)
  const data = useStore((s) => (s.caseId ? s.activeCase() : null))
  const setYear = useStore((s) => s.setYear)
  const scroller = useRef()

  // A horizontal strip should respond to an ordinary vertical wheel.
  useEffect(() => {
    const el = scroller.current
    if (!el || !open) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open])

  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          className="timeline"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="timeline-head">
            <span>{data.title} — chronology</span>
            <span style={{ opacity: 0.6 }}>
              scroll sideways · click any event to open it
            </span>
            <button onClick={toggle} style={{ color: 'var(--red)' }}>
              Close ✕
            </button>
          </div>

          <div className="timeline-scroll" ref={scroller}>
            {data.timeline.map((era, i) => (
              <div className="era" key={i}>
                <button
                  className="era-year"
                  onClick={() => setYear(era.year)}
                  title="Set the board to this year"
                >
                  {era.year}
                </button>
                <Node node={era} depth={0} setYear={setYear} defaultOpen />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Node({ node, depth, setYear, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const hasKids = node.children && node.children.length > 0

  return (
    <div className="node">
      <div
        className="node-row"
        onClick={() => {
          if (hasKids) setOpen((o) => !o)
          setYear(node.year)
        }}
      >
        <span className={`node-caret ${open ? 'open' : ''}`}>{hasKids ? '›' : '·'}</span>
        <span className="node-title">{node.title}</span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {node.detail && <div className="node-detail">{node.detail}</div>}
            {hasKids && (
              <div className="node-children">
                {node.children.map((c, i) => (
                  <Node key={i} node={c} depth={depth + 1} setYear={setYear} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
