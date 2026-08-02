import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'
import { KIND_LABEL } from '../constants.js'

/**
 * What the document says, for the reader who would rather read than squint.
 * The board itself is the primary text; this is the transcript.
 */
export default function Inspector() {
  const focusId = useStore((s) => s.focusId)
  const data = useStore((s) => (s.caseId ? s.activeCase() : null))
  const lens = useStore((s) => s.lens)
  const camDistance = useStore((s) => s.camDistance)
  const tourActive = useStore((s) => s.tourActive)
  // While the narrator is talking about a document, it is the transcript —
  // showing the panel as well collides with the captions and doubles the text.
  const item = focusId && data && !tourActive ? data.byId.get(focusId) : null

  const close = useStore((s) => s.focus)

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="inspector"
          key={item.id}
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 26 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="kind">{KIND_LABEL[item.kind]}</div>
          <h3>{item.title}</h3>
          <div className="date">
            {item.date}
            {item.source ? ` · ${item.source}` : ''}
          </div>

          {item.body?.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {item.margin && <div className="margin-note">“{item.margin}”</div>}

          {item.audio && (
            <p style={{ opacity: 0.72 }}>
              <strong style={{ fontWeight: 500 }}>{item.audio.label}. </strong>
              {item.audio.transcript}
            </p>
          )}

          {item.hidden && (
            <div className="hint">
              {lens === item.hidden.mode
                ? `Revealed: ${item.hidden.text}`
                : `Something responds to ${item.hidden.mode === 'uv' ? 'ultraviolet' : 'infrared'}.`}
            </div>
          )}

          {camDistance > 1.4 && (
            <div className="hint" style={{ color: 'var(--faint)' }}>
              Keep going — there is more on this page than you can see yet.
            </div>
          )}

          <div className="meta">
            <span>First filed {item.since}</span>
            {item.until && <span>Withdrawn {item.until}</span>}
            {item.tags?.map((t) => (
              <span key={t}>#{t}</span>
            ))}
            <button
              onClick={() => close(null)}
              style={{
                marginLeft: 'auto',
                color: 'var(--red)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontSize: '0.55rem',
              }}
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
