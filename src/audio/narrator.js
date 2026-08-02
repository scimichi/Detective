/**
 * The voice.
 *
 * There is no network and there are no audio assets, so the only speech
 * available is whatever the machine already has installed. That is a hard
 * constraint, and most of the difference between "a robot reading captions"
 * and "someone telling you a story" is won inside it:
 *
 *   1. Voice selection. Modern platforms ship neural voices alongside the old
 *      formant ones, and the good ones are never the default. We rank them.
 *   2. Phrasing. A paragraph handed to a synthesiser in one piece comes back
 *      flat, and Chrome truncates it after about fifteen seconds anyway. We
 *      speak one clause at a time.
 *   3. Direction. The script carries performance marks — beats to pause on,
 *      clauses to slow down for — so the delivery has shape rather than a
 *      constant rate.
 *
 * Everything degrades: if the browser has no speech synthesis, or the user
 * has muted it, the same script plays as timed captions.
 */

const SHORT_BEAT = 340
const LONG_BEAT = 820

/** Voices worth reaching for, in the order we want them. */
const PREFERRED = [
  // Neural / premium tiers advertise themselves in the name.
  { test: /natural/i, score: 100 },
  { test: /neural/i, score: 100 },
  { test: /premium/i, score: 90 },
  { test: /enhanced/i, score: 85 },
  { test: /siri/i, score: 80 },
  // Known-good platform voices.
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
  { test: /\+/, score: -60 }, // espeak variants: "english+f2"
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

    /** Bumped on every stop, so stale callbacks from a cancelled line die. */
    this.token = 0
    this.timers = new Set()
    this.keepAlive = null
    this.onChunk = null // (text | null) → caption
    this.onDuck = null // (boolean) → duck the room tone
    this.onVoices = null // () → the settings panel needs a redraw
  }

  init() {
    if (!this.supported) return
    const load = () => {
      const all = window.speechSynthesis.getVoices() || []
      this.voices = all
        .filter((v) => /^en/i.test(v.lang))
        .map((v) => ({ voice: v, score: this.score(v) }))
        .sort((a, b) => b.score - a.score)
        .map((v) => v.voice)
      // Nothing English installed? Take whatever there is rather than nothing.
      if (!this.voices.length) this.voices = all
      if (!this.voice && this.voices.length) this.voice = this.voices[0]
      this.onVoices?.()
    }
    load()
    // Chrome populates the list asynchronously, sometimes twice.
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
  }

  score(v) {
    let s = 0
    const name = v.name || ''
    for (const { test, score } of PREFERRED) if (test.test(name)) s = Math.max(s, score)
    for (const { test, score } of AVOID) if (test.test(name)) s += score
    // This material is written in British English; let the accent match it,
    // but never at the cost of a markedly better voice.
    if (/^en-GB/i.test(v.lang)) s += 8
    else if (/^en-US/i.test(v.lang)) s += 4
    if (v.localService) s += 3 // no network round trip, no cut-outs
    return s
  }

  setVoice(uri) {
    const found = this.voices.find((v) => v.voiceURI === uri)
    if (found) this.voice = found
  }

  setRate(rate) {
    this.rate = rate
  }

  /**
   * Splits a directed script into speakable phrases.
   *
   *   ||   a beat
   *   |||  a longer beat, for a reveal
   *   ~…~  slow this clause down
   *
   * Sentences are split too, because a synthesiser given one long block
   * flattens its intonation across the whole thing — and Chrome cuts it off.
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
      // Sentence-ish split that keeps the terminator with its sentence.
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

  /** Plain text for captions and for the timed fallback. */
  static clean(script) {
    return String(script).replace(/\|\|\||\|\||~/g, ' ').replace(/\s+/g, ' ').trim()
  }

  /**
   * Performs a script. Resolves when the last phrase has finished, or
   * immediately if the narration is stopped.
   */
  speak(script) {
    this.stop()
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
        this.stopKeepAlive()
        resolve()
      }

      const step = () => {
        if (token !== this.token) return
        if (i >= parts.length) return finish()
        const part = parts[i++]

        if (part.pause) {
          this.wait(part.pause, step, token)
          return
        }

        this.onChunk?.(part.text)

        const useVoice = this.supported && this.enabled && this.voice
        if (!useVoice) {
          // Timed captions: about 155 words a minute, with a floor so short
          // lines don't flash past.
          const words = part.text.split(/\s+/).length
          this.wait(Math.max(1100, (words / 2.58) * 1000), step, token)
          return
        }

        const u = new SpeechSynthesisUtterance(part.text)
        u.voice = this.voice
        u.lang = this.voice.lang
        u.rate = this.rate * (part.slow ? 0.9 : 1)
        u.pitch = this.pitch
        u.volume = 1

        let advanced = false
        const advance = () => {
          if (advanced) return
          advanced = true
          // A breath between clauses. Without this the delivery runs on and
          // reads as a machine working through a list.
          this.wait(part.text.length > 90 ? 260 : 180, step, token)
        }
        u.onend = advance
        u.onerror = advance

        // Some engines silently drop an utterance. Fall back on a timer
        // sized to the text so the tour can never wedge.
        const words = part.text.split(/\s+/).length
        const bail = (words / 2.2) * 1000 + 3500
        this.wait(bail, advance, token)

        try {
          window.speechSynthesis.speak(u)
          this.startKeepAlive()
        } catch {
          advance()
        }
      }

      step()
    })
  }

  /**
   * A timer that only counts down while the narration is running.
   *
   * This matters more than it looks. When speech is paused mid-sentence the
   * utterance's `onend` will not fire until it resumes — so a plain timeout
   * would treat the pause as a stall and skip to the next line the moment the
   * user stopped listening.
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

  /**
   * Chrome stalls long-running synthesis unless it is periodically poked.
   * This is a documented workaround, not superstition.
   */
  startKeepAlive() {
    if (this.keepAlive || !this.supported) return
    this.keepAlive = setInterval(() => {
      if (this.paused) return
      const s = window.speechSynthesis
      if (s.speaking && !s.paused) {
        s.pause()
        s.resume()
      }
    }, 8000)
  }

  stopKeepAlive() {
    if (this.keepAlive) clearInterval(this.keepAlive)
    this.keepAlive = null
  }

  pause() {
    this.paused = true
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
    this.stopKeepAlive()
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
    if (token === this.token) window.speechSynthesis.speak(u)
  }
}

export const narrator = new Narrator()
export const cleanScript = Narrator.clean
