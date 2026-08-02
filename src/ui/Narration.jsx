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
  const speechMode = useStore((s) => s.speechMode)
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

          <button
            onClick={() => setSettings((v) => !v)}
            className={`ghost voice-status ${speechMode}`}
            title="Choose a voice"
          >
            {speechMode === 'clips'
              ? '◉ Recorded voice'
              : speechMode === 'speech'
                ? '◉ Voice'
                : '○ Captions only'}
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
 * Says which of the three tiers is actually playing.
 *
 * Every failure mode of browser speech looks the same from the outside — the
 * captions advance and nothing comes out of the speakers — so the one thing
 * this panel must not do is leave someone guessing whether it is broken.
 */
function SpeechExplainer() {
  const mode = useStore((s) => s.speechMode)
  if (mode === 'clips') {
    return (
      <p className="vp-note vp-good">
        Playing recorded narration. This build was made with a text-to-speech
        key, so the voice is a real one rather than the browser's.
      </p>
    )
  }
  if (mode === 'speech') {
    return (
      <p className="vp-note">
        Using your browser's own voice — currently{' '}
        <strong>{narrator.voice?.name || 'the default'}</strong>. Pick a
        different one below if it sounds mechanical.
      </p>
    )
  }
  return (
    <p className="vp-note vp-warn">
      Nothing is being spoken aloud — the tour is running as captions. Pick a
      voice below to try again; if none of them make a sound, your browser is
      refusing to speak and the captions are the whole show.
    </p>
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
  const mode = useStore((s) => s.speechMode)
  useStore((s) => s.voiceTick) // re-render when the voice list arrives

  // When there is a recorded voice, the browser's own voices are a spare tyre.
  // Putting a list of them front and centre invites someone to go shopping
  // through a set of options that are all worse than what is already playing.
  const [showFallback, setShowFallback] = useState(false)
  const recorded = mode === 'clips'

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

      <SpeechExplainer />

      {!narrator.supported && (
        <p className="vp-note">
          This browser has no speech synthesis. The tour will run as captions.
        </p>
      )}

      {narrator.supported && recorded && !showFallback && (
        <button className="vp-more" onClick={() => setShowFallback(true)}>
          Browser voices (fallback) →
        </button>
      )}

      {narrator.supported && (!recorded || showFallback) && (
        <>
          <p className="vp-note">
            These are the voices installed on your machine — the page can't
            download one, so if they all sound mechanical, that is your
            operating system rather than this site. The best ones are at the
            top. Click to hear it.
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
        </>
      )}

      {narrator.supported && (
        <>
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
