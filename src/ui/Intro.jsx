import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'
import { audio } from '../audio/soundscape.js'

/**
 * The homepage. One sentence, one instruction, and nothing else — no nav, no
 * footer, no explanation of what this is.
 */
export default function Intro() {
  const phase = useStore((s) => s.phase)
  const begin = useStore((s) => s.beginJourney)

  const enter = async () => {
    // The room can only start making noise after a gesture, so this is it.
    await audio.start()
    begin()
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
              transition={{ duration: 2.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              Every mystery has a <em>thousand threads.</em>
            </motion.h1>

            <motion.button
              className="pick"
              onClick={enter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.6, delay: 2.4 }}
            >
              Pick a case
            </motion.button>

            <motion.div
              className="intro-foot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.6, delay: 4 }}
            >
              Headphones recommended · WebGL required
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
