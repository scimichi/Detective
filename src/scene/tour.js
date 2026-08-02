import { useStore } from '../state/store.js'
import { narrator } from '../audio/narrator.js'
import { audio } from '../audio/soundscape.js'
import { nav, flyTo, cancelFlight, startSweep, stopSweep } from './nav.js'
import { frameFor } from './EvidenceItem.jsx'
import { CASES } from '../data/index.js'
import { ARCHIVE_TOUR, TOURS } from '../data/tours.js'

/**
 * The director.
 *
 * A tour is a list of beats, and a beat can move the camera, scrub the year,
 * lift the board into a graph, switch on an ultraviolet lamp — and speak over
 * the top of all of it. The point is that the viewer does not have to know
 * where anything is, or which key does what. They watch.
 *
 * The camera move starts *before* the line does, by about half a second, so
 * the picture and the voice arrive together instead of taking turns.
 */

const state = {
  gen: 0,
  beats: [],
  running: false,
}

const S = () => useStore.getState()

// ── lifecycle ──────────────────────────────────────────────────────────────

export function startArchiveTour() {
  begin(ARCHIVE_TOUR, 'archive')
}

export function startCaseTour(caseId) {
  const beats = TOURS[caseId]
  if (!beats) return
  begin(beats, 'case')
}

function begin(beats, kind) {
  stopTour(true)
  state.gen++
  state.beats = beats
  state.running = true
  S().setTour({
    tourActive: true,
    tourKind: kind,
    tourIndex: 0,
    tourTotal: beats.length,
    tourPaused: false,
    tourPrompt: false,
    caption: '',
  })
  // Manual input during a tour pauses it rather than fighting it.
  nav.onUserInput = () => {
    if (S().tourActive && !S().tourPaused) pauseTour()
  }
  run(0, state.gen)
}

export function stopTour(quiet = false) {
  state.gen++
  state.running = false
  narrator.stop()
  stopSweep()
  nav.onUserInput = null
  if (!quiet) {
    S().setTour({
      tourActive: false,
      tourPrompt: false,
      tourPaused: false,
      caption: '',
    })
    S().setLensExact('none')
  }
}

export function pauseTour() {
  if (!S().tourActive) return
  S().setTourPaused(true)
  narrator.pause()
}

export function resumeTour() {
  if (!S().tourActive) return
  S().setTourPaused(false)
  narrator.resume()
}

export function toggleTourPause() {
  S().tourPaused ? resumeTour() : pauseTour()
}

export function nextBeat() {
  // A prompt beat is terminal: it is waiting for the viewer to choose a case,
  // and skipping past it would quietly end the tour at the exact moment they
  // were asked to do something.
  if (state.beats[S().tourIndex]?.prompt) return
  const i = S().tourIndex + 1
  if (i >= state.beats.length) return finish()
  state.gen++
  narrator.stop()
  S().setTourPaused(false)
  run(i, state.gen)
}

export function prevBeat() {
  const i = Math.max(0, S().tourIndex - 1)
  state.gen++
  narrator.stop()
  S().setTourPaused(false)
  run(i, state.gen)
}

function finish() {
  const kind = S().tourKind
  stopTour()
  // A finished case tour hands the board back rather than dumping you out.
  if (kind === 'case') S().setTour({ hintSeen: false })
}

// ── the loop ───────────────────────────────────────────────────────────────

async function run(index, gen) {
  const beat = state.beats[index]
  if (!beat || gen !== state.gen) return

  S().setTour({ tourIndex: index })
  applyState(beat)
  moveCamera(beat)

  // Let the move begin, then talk over it.
  await sleep(420, gen)
  if (gen !== state.gen) return

  if (beat.lens) sweepBeam()
  else stopSweep()

  // Fetch the start of the next beat while this one is being spoken, so the
  // hand-over between beats doesn't open with a pause for the network.
  const upcoming = state.beats[index + 1]
  if (upcoming) narrator.warmScript(upcoming.say)

  await narrator.speak(beat.say)
  if (gen !== state.gen) return

  S().setCaption('')
  await sleep(beat.hold ?? 500, gen)
  if (gen !== state.gen) return

  // The archive tour stops and waits for a choice rather than ending.
  if (beat.prompt) {
    S().setTour({ tourPrompt: true })
    return
  }

  if (index + 1 >= state.beats.length) return finish()
  run(index + 1, gen)
}

function applyState(beat) {
  const s = S()
  if (beat.year != null) s.setYear(beat.year)
  if (beat.mode && beat.mode !== s.mode) s.setMode(beat.mode)
  s.setLensExact(beat.lens || 'none')
  if (beat.focus) s.focus(beat.focus)
  else if (beat.move) s.focus(null)
}

function moveCamera(beat) {
  const s = S()
  if (beat.focus && s.caseId) {
    const item = CASES[s.caseId]?.byId.get(beat.focus)
    if (item) {
      const { dist, shift } = frameFor(item)
      flyTo(item.pos[0] + shift, item.pos[1], dist, 2.4)
      return
    }
  }

  switch (beat.move) {
    case 'wide':
      flyTo(0, 0, 24, 2.6)
      break
    case 'survey':
      flyTo(0, 0, 34, 2.6)
      break
    case 'warehouse':
      flyTo(0, 0, 210, 4)
      break
    default:
      // `mode` beats leave the camera to the board's own mode transition.
      break
  }
}

/**
 * Under a lens the reveal is somewhere on the page, and a viewer who has been
 * told to sit back will not go looking for it. So the tour sweeps the beam
 * across the sheet itself — the same pointer-driven torch, driven by the
 * director instead of by a hand.
 */
function sweepBeam() {
  startSweep()
}

function sleep(ms, gen) {
  return new Promise((resolve) => {
    let remaining = ms
    let last = Date.now()
    const tick = () => {
      if (gen !== state.gen) return resolve()
      const now = Date.now()
      // Holds respect the pause button too.
      if (!S().tourPaused) remaining -= now - last
      last = now
      if (remaining <= 0) return resolve()
      setTimeout(tick, Math.max(16, Math.min(120, remaining)))
    }
    setTimeout(tick, Math.max(16, Math.min(120, ms)))
  })
}

// ── wiring ─────────────────────────────────────────────────────────────────

let wired = false

/** Connects the narrator to the store, the room's volume, and any audio the
 *  build pre-rendered. */
export function wireNarrator() {
  if (wired) return
  wired = true
  narrator.init()
  narrator.prime()
  narrator.onStatus = (mode) => S().setSpeechMode(mode)

  // Pre-rendered narration is optional: the build only produces it when a
  // text-to-speech key is available, so a missing manifest is the normal case
  // and must not be treated as an error.
  const base = import.meta.env.BASE_URL || '/'
  fetch(`${base}narration/manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      if (!m?.clips) return
      narrator.setClips(m, `${base}narration/`)
      // The opening line is the one nobody can hide a fetch behind, so start
      // it now — this runs on the click that enters the site, and the archive
      // tour does not speak for another second and a half.
      narrator.warmScript(ARCHIVE_TOUR[0].say, 4)
    })
    .catch(() => {})
  narrator.onChunk = (text) => S().setCaption(text || '')
  narrator.onDuck = (on) => audio.setDuck(on)
  narrator.onVoices = () => {
    S().bumpVoices()
    const saved = S().voiceURI
    if (saved) narrator.setVoice(saved)
  }
  // The list may already have arrived — init() runs on the homepage, long
  // before this. Without this the panel would sit on "no voices reported yet"
  // for a session where the voices had in fact loaded first.
  if (narrator.voicesReady) narrator.onVoices()
  // Adopt whatever the viewer has already chosen in this session.
  narrator.setRate(S().voiceRate)
  narrator.enabled = S().narrationOn
  if (S().voiceURI) narrator.setVoice(S().voiceURI)
}
