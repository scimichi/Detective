import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'
import { search, CASES } from '../data/index.js'
import { KIND_LABEL } from '../constants.js'
import { flyTo } from '../scene/nav.js'
import { frameFor } from '../scene/EvidenceItem.jsx'

/**
 * Full-text across the whole archive — every headline, every body paragraph,
 * every margin note, every transcript, in every case. Picking a result flies
 * the camera to that piece of paper, opening its board first if it has to.
 */
export default function SearchPanel() {
  const open = useStore((s) => s.searchOpen)
  const toggle = useStore((s) => s.toggleSearch)
  const openCase = useStore((s) => s.openCase)
  const focus = useStore((s) => s.focus)
  const caseId = useStore((s) => s.caseId)
  const setYear = useStore((s) => s.setYear)

  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef()

  const results = useMemo(() => search(q), [q])

  useEffect(() => {
    if (open) {
      setSel(0)
      setTimeout(() => input.current?.focus(), 40)
    } else setQ('')
  }, [open])

  const go = (r) => {
    const target = CASES[r.caseId]
    const item = target.byId.get(r.id)
    // Make sure the year slider is somewhere this exhibit actually exists.
    const year = Math.max(item.since, Math.min(item.until ?? target.yearRange[1], target.yearRange[1]))
    const { dist, shift } = frameFor(item)

    toggle()
    if (r.caseId !== caseId) {
      openCase(r.caseId)
      setTimeout(() => {
        setYear(year)
        focus(r.id)
        flyTo(item.pos[0] + shift, item.pos[1], dist, 2.2)
      }, 60)
    } else {
      setYear(year)
      focus(r.id)
      flyTo(item.pos[0] + shift, item.pos[1], dist, 1.8)
    }
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && results[sel]) {
      go(results[sel])
    } else if (e.key === 'Escape') {
      toggle()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="search"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={toggle}
        >
          <motion.div
            className="search-box"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setSel(0)
              }}
              onKeyDown={onKey}
              placeholder="Search every board…"
              spellCheck={false}
            />

            <div className="search-results">
              {q.length >= 2 && results.length === 0 && (
                <div className="search-empty">Nothing in the archive matches.</div>
              )}
              {q.length < 2 && (
                <div className="search-empty">
                  Try: cipher · titanium · avalanche · rockets · handwriting · barnacle
                </div>
              )}
              {results.map((r, i) => (
                <button
                  key={`${r.caseId}-${r.id}`}
                  className={`result ${i === sel ? 'sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(r)}
                >
                  <div className="r-top">
                    <span>{r.caseTitle}</span>
                    <span>
                      {KIND_LABEL[r.kind]} · {r.date}
                    </span>
                  </div>
                  <div className="r-title">{r.title}</div>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
