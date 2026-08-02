import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'
import { audio } from '../audio/soundscape.js'
import { wireNarrator } from '../scene/tour.js'
import { narrator } from '../audio/narrator.js'

/**
 * The homepage. One sentence — and then two doors, because the single biggest
 * problem with a room like this is not knowing where to stand in it.
 *
 * The guided door is listed first and styled as the primary action. Somebody
 * who wants to poke at it themselves will find the second one; somebody who
 * doesn't know where to start shouldn't have to.
 */
export default function Intro() {
  const phase = useStore((s) => s.phase)
  const begin = useStore((s) => s.beginJourney)
  const setGuided = useStore((s) => s.setGuided)

  const enter = (guided) => {
    // The room can only make noise after a gesture, and so can the narrator —
    // but neither is allowed to gate the door. Creating an AudioContext can
    // take seconds on some machines and can hang outright where there is no
    // output device, and a homepage button that does nothing is worse than a
    // silent room.
    wireNarrator()
    // Spend this click unlocking the speech engine — browsers will not let a
    // page speak later without a gesture to point back to.
    narrator.prime()
    setGuided(guided)
    begin()
    audio.start().catch(() => {})
  }

  return (
    <AnimatePresence>
      {phase === 'intro' && (
        <motion.div
          className="intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="intro-inner">
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 2.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              Every mystery has a <em>thousand threads.</em>
            </motion.h1>

            <motion.div
              className="doors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.4, delay: 2 }}
            >
              <button className="door primary" onClick={() => enter(true)}>
                <span className="door-title">Take me through it</span>
                <span className="door-sub">
                  Narrated. The camera drives itself. About twelve minutes a case.
                </span>
              </button>

              <button className="door" onClick={() => enter(false)}>
                <span className="door-title">Let me look around</span>
                <span className="door-sub">
                  No commentary. Scroll to move, click anything to read it.
                </span>
              </button>
            </motion.div>

            <motion.div
              className="intro-foot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.6, delay: 3.6 }}
            >
              Sound on · WebGL required · You can switch between the two at any time
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
