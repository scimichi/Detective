import { phraseKey } from './phraseKey.js'

/**
 * The voice.
 *
 * Three tiers, in order of preference:
 *
 *   1. Pre-rendered clips. If the build has been run with a text-to-speech
 *      key, every phrase in the archive exists as an audio file and the tour
 *      plays those. This is the only tier that sounds like a person.
 *   2. The browser's own speech synthesis. Free and always available, and on
 *      a machine with neural voices installed it is decent. On one without,
 *      it is a robot reading captions.
 *   3. Timed captions, for when there is no speech at all.
 *
 * Most of the code below is tier two refusing to fail silently. The Web
 * Speech API has a long list of ways to accept an utterance and then simply
 * not say it, and every one of them looks identical from the outside: the
 * captions advance and nothing comes out of the speakers.
 */

const SHORT_BEAT = 340
const LONG_BEAT = 820

/** Voices worth reaching for, in the order we want them. */
const PREFERRED = [
  { test: /natural/i, score: 100 },
  { test: /neural/i, score: 100 },
  { test: /premium/i, score: 90 },
  { test: /enhanced/i, score: 85 },
  { test: /siri/i, score: 80 },
  { test: /\b(serena|daniel|kate|oliver|libby|ryan|sonia|arthur)\b/i, score: 70 },
  { test: /\b(samantha|ava|allison|tom|alex|nathan|joanna|matthew)\b/i, score: 62 },
  { test: /\b(moira|fiona|karen|rishi|tessa)\b/i, score: 52 },
  { test: /^google (uk|us) english/i, score: 48 },
  { test: /^microsoft/i, score: 30 },
]

/** Voices that will make this sound like a 1990s train announcement. */
const AVOID = [
  { test: /espeak/i, score: -100 },
  { test: /festival/i, score: -100 },
  { test: /compact/i, score: -60 },
  { test: /\+/, score: -60 },
  { test: /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i, score: -120 },
]

class Narrator {
  constructor() {
    this.supported =
      typeof window !== 'undefined' && 'speechSynthesis' in window
    this.voices = []
    this.voice = null
    this.rate = 0.94
    this.pitch = 0.96
    this.enabled = true
    this.speaking = false
    this.paused = false

    /** 'clips' | 'speech' | 'captions' — what the last phrase actually used. */
    this.mode = 'captions'

    this.token = 0
    this.timers = new Set()
    this.voicesReady = false
    this.primed = false

    /** Utterances in flight. Dropping the reference lets the engine collect
     *  them mid-sentence, which is a real and very confusing bug. */
    this.live = new Set()

    /** Pre-rendered narration, if the build produced any. */
    this.clips = null
    this.clipBase = ''
    this.audio = null

    this.onChunk = null
    this.onDuck = null
    this.onVoices = null
    this.onStatus = null
  }

  init() {
    if (!this.supported) {
      this.setStatus('captions')
      return
    }
    const load = () => {
      const all = window.speechSynthesis.getVoices() || []
      if (!all.length) return
      this.voices = all
        .filter((v) => /^en/i.test(v.lang))
        .map((v) => ({ voice: v, score: this.score(v) }))
        .sort((a, b) => b.score - a.score)
        .map((v) => v.voice)
      if (!this.voices.length) this.voices = all
      if (!this.voice && this.voices.length) this.voice = this.voices[0]
      this.voicesReady = true
      this.onVoices?.()
    }
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    // Chrome does not always fire voiceschanged when the list was already
    // warm, so poll briefly rather than waiting for an event that never comes.
    let tries = 0
    const poll = setInterval(() => {
      if (this.voicesReady || ++tries > 20) return clearInterval(poll)
      load()
    }, 150)
  }

  /**
   * Unlocks the speech engine. Browsers require the first utterance to follow
   * a user gesture; a silent one spent on the click that starts the tour buys
   * the right to speak later, when there is no gesture to hand.
   */
  prime() {
    if (this.primed || !this.supported) return
    this.primed = true
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      window.speechSynthesis.speak(u)
    } catch {
      /* nothing to unlock */
    }
  }

  score(v) {
    let s = 0
    const name = v.name || ''
    for (const { test, score } of PREFERRED) if (test.test(name)) s = Math.max(s, score)
    for (const { test, score } of AVOID) if (test.test(name)) s += score
    if (/^en-GB/i.test(v.lang)) s += 8
    else if (/^en-US/i.test(v.lang)) s += 4
    if (v.localService) s += 3
    return s
  }

  setVoice(uri) {
    const found = this.voices.find((v) => v.voiceURI === uri)
    if (found) this.voice = found
  }

  setRate(rate) {
    this.rate = rate
  }

  /** Adopts a manifest of pre-rendered narration, if the build made one. */
  setClips(manifest, base) {
    this.clips = manifest?.clips || null
    this.clipBase = base || ''
    if (this.clips) this.setStatus('clips')
  }

  setStatus(mode) {
    if (this.mode === mode) return
    this.mode = mode
    this.onStatus?.(mode)
  }

  /**
   * Splits a directed script into speakable phrases.
   *   ||   a beat        |||  a longer beat        ~…~  slow this clause
   */
  phrase(script) {
    const out = []
    for (const raw of String(script).split(/(\|\|\||\|\|)/)) {
      if (raw === '||') {
        out.push({ pause: SHORT_BEAT })
        continue
      }
      if (raw === '|||') {
        out.push({ pause: LONG_BEAT })
        continue
      }
      const sentences = raw
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const s of sentences) {
        const slow = /~/.test(s)
        out.push({ text: s.replace(/~/g, ''), slow })
      }
    }
    return out
  }

  static clean(script) {
    return String(script).replace(/\|\|\||\|\||~/g, ' ').replace(/\s+/g, ' ').trim()
  }

  /** Resolves once the voice list has arrived, or after a short grace period. */
  ready() {
    if (!this.supported || this.voicesReady) return Promise.resolve()
    return new Promise((resolve) => {
      const started = Date.now()
      const check = () => {
        if (this.voicesReady || Date.now() - started > 2500) return resolve()
        setTimeout(check, 100)
      }
      check()
    })
  }

  async speak(script) {
    this.stop()
    // Speaking the very first line before the voice list has loaded is the
    // single most common way this ends up silent: with no voice selected the
    // engine is skipped entirely and the captions run on alone.
    await this.ready()

    const token = ++this.token
    const parts = this.phrase(script)

    return new Promise((resolve) => {
      this.speaking = true
      this.onDuck?.(true)

      let i = 0
      const finish = () => {
        if (token !== this.token) return
        this.speaking = false
        this.onDuck?.(false)
        this.onChunk?.(null)
        resolve()
      }

      const step = () => {
        if (token !== this.token) return
        if (i >= parts.length) return finish()
        const part = parts[i++]

        if (part.pause) return this.wait(part.pause, step, token)

        this.onChunk?.(part.text)

        const clip = this.clipFor(part.text)
        if (clip) return this.playClip(clip, part, step, token)
        if (this.canSpeak()) return this.speakPhrase(part, step, token)

        // Timed captions: about 155 words a minute, with a floor so short
        // lines don't flash past.
        this.setStatus('captions')
        const words = part.text.split(/\s+/).length
        this.wait(Math.max(1100, (words / 2.58) * 1000), step, token)
      }

      step()
    })
  }

  canSpeak() {
    return this.supported && this.enabled && !!this.voice
  }

  clipFor(text) {
    if (!this.clips || !this.enabled) return null
    const file = this.clips[phraseKey(text)]
    return file ? this.clipBase + file : null
  }

  // ── Tier one: a real recording ───────────────────────────────────────────

  playClip(url, part, next, token) {
    this.setStatus('clips')
    const audio = new Audio(url)
    audio.preload = 'auto'
    this.audio = audio

    let done = false
    const advance = () => {
      if (done || token !== this.token) return
      done = true
      this.audio = null
      this.wait(part.text.length > 90 ? 240 : 170, next, token)
    }
    audio.onended = advance
    // A missing or unplayable file falls through to synthesis rather than
    // stalling the tour on a 404.
    audio.onerror = () => {
      if (done || token !== this.token) return
      done = true
      this.audio = null
      if (this.canSpeak()) this.speakPhrase(part, next, token)
      else advance()
    }
    audio.play().catch(() => audio.onerror?.())
  }

  // ── Tier two: the browser's synthesiser ──────────────────────────────────

  speakPhrase(part, next, token) {
    const u = new SpeechSynthesisUtterance(part.text)
    u.voice = this.voice
    u.lang = this.voice.lang
    u.rate = this.rate * (part.slow ? 0.9 : 1)
    u.pitch = this.pitch
    u.volume = 1
    this.live.add(u)

    let advanced = false
    let started = false

    const advance = () => {
      if (advanced || token !== this.token) return
      advanced = true
      this.live.delete(u)
      // A breath between clauses. Without it the delivery runs on and reads
      // as a machine working through a list.
      this.wait(part.text.length > 90 ? 260 : 180, next, token)
    }

    u.onstart = () => {
      started = true
      this.setStatus('speech')
    }
    u.onend = advance
    u.onerror = advance

    // Some engines accept an utterance and never speak it. If nothing has
    // started shortly after we asked, treat this tier as unavailable and let
    // the captions carry the tour rather than stalling in silence.
    this.wait(
      1400,
      () => {
        if (started || advanced) return
        this.setStatus('captions')
        const words = part.text.split(/\s+/).length
        this.wait(Math.max(900, (words / 2.58) * 1000), advance, token)
      },
      token,
    )

    // A hard upper bound, so a lost `onend` can never wedge the tour.
    const words = part.text.split(/\s+/).length
    this.wait((words / 2.2) * 1000 + 4000, advance, token)

    try {
      // Chrome drops an utterance queued in the same tick as a cancel, so
      // give the engine a moment to actually clear before asking again.
      setTimeout(() => {
        if (token !== this.token || advanced) return
        try {
          window.speechSynthesis.speak(u)
        } catch {
          advance()
        }
      }, 60)
    } catch {
      advance()
    }
  }

  /**
   * A timer that only counts down while the narration is running.
   *
   * When speech is paused mid-sentence the utterance's `onend` will not fire
   * until it resumes — so a plain timeout would treat the pause as a stall
   * and skip to the next line the moment the user stopped listening.
   */
  wait(ms, fn, token) {
    let remaining = ms
    let last = Date.now()
    let id

    const tick = () => {
      this.timers.delete(id)
      if (token !== undefined && token !== this.token) return
      const now = Date.now()
      if (!this.paused) remaining -= now - last
      last = now
      if (remaining <= 0) return fn()
      id = setTimeout(tick, Math.max(16, Math.min(140, remaining)))
      this.timers.add(id)
    }

    id = setTimeout(tick, Math.max(16, Math.min(140, ms)))
    this.timers.add(id)
    return id
  }

  pause() {
    this.paused = true
    if (this.audio) this.audio.pause()
    if (this.supported) {
      try {
        window.speechSynthesis.pause()
      } catch {
        /* engine without pause support */
      }
    }
  }

  resume() {
    this.paused = false
    if (this.audio) this.audio.play().catch(() => {})
    if (this.supported) {
      try {
        window.speechSynthesis.resume()
      } catch {
        /* as above */
      }
    }
  }

  stop() {
    this.token++
    this.speaking = false
    this.paused = false
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
    this.live.clear()
    if (this.audio) {
      this.audio.pause()
      this.audio.onended = this.audio.onerror = null
      this.audio = null
    }
    this.onChunk?.(null)
    this.onDuck?.(false)
    if (this.supported) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* nothing to cancel */
      }
    }
  }

  /** A line for the settings panel, so a voice can be auditioned. */
  audition(uri) {
    this.setVoice(uri)
    this.stop()
    const token = ++this.token
    if (!this.supported || !this.voice) return
    const u = new SpeechSynthesisUtterance(
      'Five confirmed victims. Four ciphers. No name.',
    )
    u.voice = this.voice
    u.lang = this.voice.lang
    u.rate = this.rate
    u.pitch = this.pitch
    this.live.add(u)
    u.onend = () => this.live.delete(u)
    setTimeout(() => {
      if (token === this.token) window.speechSynthesis.speak(u)
    }, 60)
  }
}

export const narrator = new Narrator()
export const cleanScript = Narrator.clean
