import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../state/store.js'
import { narrator } from '../audio/narrator.js'
import { toggleTourPause, nextBeat, prevBeat, stopTour } from '../scene/tour.js'

/**
 * The narrator's presence on screen.
 *
 * Captions are not an accessibility afterthought here — they are the primary
 * channel whenever the machine has no decent voice installed, whenever the
 * viewer is somewhere they can't play sound, and whenever a name is spelled
 * in a way speech synthesis will fumble. They are typeset accordingly.
 */
export default function Narration() {
  const active = useStore((s) => s.tourActive)
  const paused = useStore((s) => s.tourPaused)
  const caption = useStore((s) => s.caption)
  const index = useStore((s) => s.tourIndex)
  const total = useStore((s) => s.tourTotal)
  const prompt = useStore((s) => s.tourPrompt)
  const [settings, setSettings] = useState(false)

  if (!active) return null

  return (
    <>
      <div className="narration">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.p
              key={caption}
              className="caption"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {caption}
            </motion.p>
          )}
        </AnimatePresence>

        {prompt && (
          <motion.p
            className="caption prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Click any case card to go inside.
          </motion.p>
        )}

        <div className="transport">
          <button onClick={prevBeat} title="Previous" aria-label="Previous">
            ◀◀
          </button>
          <button
            className="play"
            onClick={toggleTourPause}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? '▶ Resume' : '❚❚ Pause'}
          </button>
          <button onClick={nextBeat} title="Next" aria-label="Next">
            ▶▶
          </button>

          <span className="beats" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i <= index ? 'done' : ''} />
            ))}
          </span>

          <button onClick={() => setSettings((v) => !v)} className="ghost">
            Voice
          </button>
          <button onClick={() => stopTour()} className="ghost">
            Explore on my own
          </button>
        </div>

        {paused && (
          <div className="paused-note">
            Paused — you took the wheel. Move around as much as you like.
          </div>
        )}
      </div>

      {settings && <VoicePanel onClose={() => setSettings(false)} />}
    </>
  )
}

/**
 * Voice quality is entirely a property of the viewer's machine, so the honest
 * thing is to say so and let them choose. The list is pre-ranked — neural
 * voices first, the old formant ones last.
 */
export function VoicePanel({ onClose }) {
  const voiceURI = useStore((s) => s.voiceURI)
  const setVoiceURI = useStore((s) => s.setVoiceURI)
  const rate = useStore((s) => s.voiceRate)
  const setRate = useStore((s) => s.setVoiceRate)
  const narrationOn = useStore((s) => s.narrationOn)
  const setNarration = useStore((s) => s.setNarration)
  useStore((s) => s.voiceTick) // re-render when the voice list arrives

  useEffect(() => {
    narrator.enabled = narrationOn
    if (!narrationOn) narrator.stop()
  }, [narrationOn])

  useEffect(() => {
    narrator.setRate(rate)
  }, [rate])

  const voices = narrator.voices || []
  const current = voiceURI || narrator.voice?.voiceURI

  return (
    <div className="voice-panel" onClick={(e) => e.stopPropagation()}>
      <div className="vp-head">
        <span>Narrator</span>
        <button onClick={onClose}>✕</button>
      </div>

      {!narrator.supported && (
        <p className="vp-note">
          This browser has no speech synthesis. The tour will run as captions.
        </p>
      )}

      {narrator.supported && (
        <>
          <p className="vp-note">
            These are the voices installed on your machine — the page can't
            download one. The best ones are at the top. Click to hear it.
          </p>

          <div className="vp-list">
            {voices.slice(0, 14).map((v) => (
              <button
                key={v.voiceURI}
                className={`vp-voice ${v.voiceURI === current ? 'on' : ''}`}
                onClick={() => {
                  setVoiceURI(v.voiceURI)
                  narrator.audition(v.voiceURI)
                }}
              >
                <span className="vp-name">{v.name}</span>
                <span className="vp-lang">{v.lang}</span>
              </button>
            ))}
            {voices.length === 0 && (
              <p className="vp-note">No voices reported yet — try again in a moment.</p>
            )}
          </div>

          <label className="vp-row">
            <span>Pace</span>
            <input
              type="range"
              min="0.75"
              max="1.15"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(+e.target.value)}
            />
          </label>

          <label className="vp-row">
            <span>Speak aloud</span>
            <button
              className={`vp-toggle ${narrationOn ? 'on' : ''}`}
              onClick={() => setNarration(!narrationOn)}
            >
              {narrationOn ? 'On' : 'Captions only'}
            </button>
          </label>
        </>
      )}
    </div>
  )
}
