import { create } from 'zustand'
import { CASES, CASE_LIST } from '../data/index.js'
import { QUALITY_TIERS } from '../constants.js'

function detectQuality() {
  if (typeof navigator === 'undefined') return 'medium'
  const mem = navigator.deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4
  const coarse =
    typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  if (coarse || mem <= 4 || cores <= 4) return 'low'
  if (mem >= 8 && cores >= 8) return 'high'
  return 'medium'
}

/**
 * Deep links. There are no pages here, so a URL cannot address a route — but
 * it can address a *place*: which board, and how hard to push the renderer.
 *   ?case=zodiac   open straight onto that board
 *   ?q=low         force a quality tier
 */
function readParams() {
  if (typeof location === 'undefined') return {}
  const p = new URLSearchParams(location.search)
  const out = {}
  const q = p.get('q')
  if (q && QUALITY_TIERS[q]) out.quality = q
  const c = p.get('case')
  if (c && CASES[c]) {
    out.caseId = c
    out.phase = 'board'
    out.year = CASES[c].yearRange[1]
    out.audioOn = true
  }
  return out
}

const params = readParams()

export const useStore = create((set, get) => ({
  // ── where we are ─────────────────────────────────────────────────────────
  phase: 'intro', // intro → cloud → board
  caseId: null,
  mode: 'board', // board | graph | map
  transitioning: false,

  // ── time travel ──────────────────────────────────────────────────────────
  year: 2024,

  // ── inspection ───────────────────────────────────────────────────────────
  focusId: null,
  hoverId: null,
  lens: 'none', // none | uv | ir
  flashlight: [0, 0, 0],
  flashlightOn: false,

  // ── the guided tour ──────────────────────────────────────────────────────
  guided: false,        // the user came in through the narrated door
  tourActive: false,
  tourKind: null,       // 'archive' | 'case'
  tourIndex: 0,
  tourTotal: 0,
  tourPaused: false,
  tourPrompt: false,    // waiting for the viewer to choose a case
  caption: '',
  narrationOn: true,
  voiceURI: null,
  voiceRate: 0.94,
  voiceTick: 0,         // bumped when the voice list arrives
  hintSeen: false,

  // ── panels ───────────────────────────────────────────────────────────────
  timelineOpen: false,
  searchOpen: false,
  helpOpen: false,
  filters: [], // empty = show everything

  // ── engine ───────────────────────────────────────────────────────────────
  quality: detectQuality(),
  audioOn: false,
  camDistance: 24,
  streaming: 0, // number of assets currently decoding, for the HUD readout
  fps: 60,

  // ── derived helpers ──────────────────────────────────────────────────────
  activeCase: () => (get().caseId ? CASES[get().caseId] : null),
  tier: () => QUALITY_TIERS[get().quality],

  /** Evidence visible at the currently scrubbed year, after type filters. */
  visibleEvidence: () => {
    const c = get().activeCase()
    if (!c) return []
    const { year, filters } = get()
    return c.evidence.filter(
      (e) =>
        year >= e.since &&
        (e.until == null || year <= e.until) &&
        (filters.length === 0 || filters.includes(e.kind)),
    )
  },

  visibleLinks: () => {
    const c = get().activeCase()
    if (!c) return []
    const { year } = get()
    const live = new Set(get().visibleEvidence().map((e) => e.id))
    return c.links.filter(
      (l) =>
        live.has(l.from) &&
        live.has(l.to) &&
        year >= (l.since ?? c.yearRange[0]) &&
        (l.until == null || year <= l.until),
    )
  },

  // ── actions ──────────────────────────────────────────────────────────────
  beginJourney: () => set({ phase: 'cloud', audioOn: true }),

  openCase: (id) => {
    const c = CASES[id]
    if (!c) return
    set({
      caseId: id,
      phase: 'board',
      mode: 'board',
      transitioning: true,
      year: c.yearRange[1],
      focusId: null,
      filters: [],
    })
  },

  closeCase: () =>
    set({ phase: 'cloud', caseId: null, mode: 'board', focusId: null }),

  finishTransition: () => set({ transitioning: false }),

  setYear: (year) => set({ year }),
  setMode: (mode) => set({ mode, focusId: null }),
  toggleGraph: () =>
    set((s) => ({ mode: s.mode === 'graph' ? 'board' : 'graph', focusId: null })),

  focus: (id) => set({ focusId: id }),
  hover: (id) => set({ hoverId: id }),

  setLens: (lens) => set((s) => ({ lens: s.lens === lens ? 'none' : lens })),
  /** Unconditional — the tour sets a lens rather than toggling it. */
  setLensExact: (lens) => set({ lens }),
  setFlashlight: (p, on) => set({ flashlight: p, flashlightOn: on }),

  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),
  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  toggleFilter: (kind) =>
    set((s) => ({
      filters: s.filters.includes(kind)
        ? s.filters.filter((k) => k !== kind)
        : [...s.filters, kind],
    })),
  clearFilters: () => set({ filters: [] }),

  setGuided: (guided) => set({ guided }),
  setTour: (patch) => set(patch),
  setCaption: (caption) => set({ caption }),
  setTourPaused: (tourPaused) => set({ tourPaused }),
  setNarration: (narrationOn) => set({ narrationOn }),
  setVoiceURI: (voiceURI) => set({ voiceURI }),
  setVoiceRate: (voiceRate) => set({ voiceRate }),
  bumpVoices: () => set((s) => ({ voiceTick: s.voiceTick + 1 })),
  dismissHint: () => set({ hintSeen: true }),

  setQuality: (quality) => set({ quality }),
  setAudio: (audioOn) => set({ audioOn }),
  setCamDistance: (camDistance) => set({ camDistance }),
  setStreaming: (streaming) => set({ streaming }),
  setFps: (fps) => set({ fps }),

  ...params,
}))

if (import.meta.env.DEV && typeof window !== 'undefined') window.__store = useStore

export { CASES, CASE_LIST }
