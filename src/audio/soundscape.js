import * as THREE from 'three'

/**
 * Nothing loops.
 *
 * There are no audio files in this project either. The room is synthesised:
 * rain is filtered noise with a wandering band, the clock is a scheduled
 * transient, thunder is a rare envelope on a low-passed burst, and the desk
 * lamp hums at mains frequency from its actual position in space.
 *
 * Because every voice is scheduled rather than played, the soundscape never
 * repeats and never reveals a loop point.
 */

class Soundscape {
  constructor() {
    this.ctx = null
    this.started = false
    this.master = null
    this.sources = new Map() // spatial one-offs, keyed by evidence id
    this.timers = []
    this.muted = false
    this.ducked = false
    this.listener = new THREE.Vector3()
  }

  async start() {
    if (this.started) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.started = true

    this.master = this.ctx.createGain()
    this.master.gain.value = 0.0001
    this.master.connect(this.ctx.destination)
    this.master.gain.exponentialRampToValueAtTime(0.55, this.ctx.currentTime + 4)

    this.noiseBuffer = this.makeNoise(3)
    this.buildRain()
    this.buildRoomTone()
    this.scheduleAll()
  }

  /**
   * Pull the room down under the narrator. Rain and a ticking clock are
   * atmosphere until somebody is talking, at which point they are noise.
   */
  setDuck(on) {
    if (!this.master) return
    this.ducked = on
    if (this.muted) return
    this.master.gain.setTargetAtTime(on ? 0.16 : 0.55, this.ctx.currentTime, 0.25)
  }

  setMuted(muted) {
    this.muted = muted
    if (!this.master) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    const level = muted ? 0.0001 : this.ducked ? 0.16 : 0.55
    this.master.gain.setTargetAtTime(level, now, 0.4)
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      // A touch of brown noise gives the rain body instead of hiss.
      last = (last + 0.02 * white) / 1.02
      d[i] = white * 0.7 + last * 3.2
    }
    return buf
  }

  // ── Continuous beds ──────────────────────────────────────────────────────

  buildRain() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true

    const band = this.ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1400
    band.Q.value = 0.55

    const shelf = this.ctx.createBiquadFilter()
    shelf.type = 'highshelf'
    shelf.frequency.value = 3000
    shelf.gain.value = -8

    const gain = this.ctx.createGain()
    gain.gain.value = 0.05

    // Two slow, mutually prime LFOs so squalls never arrive on a beat.
    for (const [rate, depth] of [
      [0.037, 380],
      [0.011, 700],
    ]) {
      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = rate
      const amt = this.ctx.createGain()
      amt.gain.value = depth
      lfo.connect(amt).connect(band.frequency)
      lfo.start()
    }
    const vol = this.ctx.createOscillator()
    vol.frequency.value = 0.023
    const volAmt = this.ctx.createGain()
    volAmt.gain.value = 0.022
    vol.connect(volAmt).connect(gain.gain)
    vol.start()

    src.connect(band).connect(shelf).connect(gain).connect(this.master)
    src.start()
    this.rainGain = gain
  }

  buildRoomTone() {
    // Desk-lamp ballast hum, positioned above and slightly left of the board.
    const panner = this.ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 2.5
    panner.maxDistance = 40
    panner.rolloffFactor = 1.4
    this.setPos(panner, -1.4, 6.4, 4.2)

    const gain = this.ctx.createGain()
    gain.gain.value = 0.028

    for (const [mult, level] of [
      [1, 1],
      [2, 0.4],
      [3, 0.22],
      [5, 0.08],
    ]) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = 50 * mult
      const g = this.ctx.createGain()
      g.gain.value = level * 0.5
      osc.connect(g).connect(gain)
      osc.start()
    }
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    gain.connect(lp).connect(panner).connect(this.master)
    this.lampGain = gain
  }

  // ── Scheduled one-shots ──────────────────────────────────────────────────

  scheduleAll() {
    this.every(0.98, 1.02, () => this.clockTick())
    this.every(9, 26, () => this.floorCreak())
    this.every(34, 96, () => this.thunder())
    this.every(14, 44, () => this.radioBurst())
    this.every(21, 60, () => this.paperShift())
  }

  every(min, max, fn) {
    const run = () => {
      if (!this.started) return
      try {
        fn()
      } catch {
        /* a dropped voice must never take the room down */
      }
      const id = setTimeout(run, (min + Math.random() * (max - min)) * 1000)
      this.timers.push(id)
    }
    const id = setTimeout(run, Math.random() * (max - min) * 1000)
    this.timers.push(id)
  }

  env(node, t0, attack, decay, peak) {
    const g = node.gain
    g.cancelScheduledValues(t0)
    g.setValueAtTime(0.0001, t0)
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack)
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay)
  }

  clockTick() {
    const t = this.ctx.currentTime
    // Tick and tock differ — a clock that ticks identically sounds like a
    // metronome, and a metronome sounds like software.
    const tock = Math.random() > 0.5
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 1 + Math.random() * 0.2

    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = tock ? 2600 : 3400
    bp.Q.value = 9

    const g = this.ctx.createGain()
    this.env(g, t, 0.001, tock ? 0.05 : 0.035, 0.05)
    src.connect(bp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 0.12)
  }

  floorCreak() {
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    const f0 = 90 + Math.random() * 130
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(f0 * (0.55 + Math.random() * 0.3), t + 0.5)

    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    lp.Q.value = 6

    const g = this.ctx.createGain()
    this.env(g, t, 0.09, 0.7, 0.035)
    osc.connect(lp).connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 1.0)
  }

  thunder() {
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.35

    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(320, t)
    lp.frequency.exponentialRampToValueAtTime(70, t + 3.4)

    const g = this.ctx.createGain()
    this.env(g, t, 0.5, 3.6, 0.09)
    src.connect(lp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 4.4)
  }

  radioBurst() {
    const t = this.ctx.currentTime
    const bursts = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < bursts; i++) {
      const at = t + i * (0.28 + Math.random() * 0.5)
      const src = this.ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      src.playbackRate.value = 0.9 + Math.random() * 0.6

      // Comms-band voice: narrow, harsh, unintelligible on purpose.
      const bp = this.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 900 + Math.random() * 900
      bp.Q.value = 4.5

      const g = this.ctx.createGain()
      const dur = 0.12 + Math.random() * 0.5
      this.env(g, at, 0.02, dur, 0.03)

      // Syllable gating gives it the cadence of speech.
      const gate = this.ctx.createOscillator()
      gate.type = 'square'
      gate.frequency.value = 5 + Math.random() * 7
      const gateAmt = this.ctx.createGain()
      gateAmt.gain.value = 0.012
      gate.connect(gateAmt).connect(g.gain)
      gate.start(at)
      gate.stop(at + dur + 0.1)

      src.connect(bp).connect(g).connect(this.master)
      src.start(at)
      src.stop(at + dur + 0.1)
    }
  }

  paperShift() {
    this.rustle(0.018)
  }

  /** A sheet moving. Also fired when you pin your attention to something. */
  rustle(level = 0.05) {
    if (!this.started) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 1.6 + Math.random() * 0.8

    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1800

    const g = this.ctx.createGain()
    const dur = 0.18 + Math.random() * 0.3
    this.env(g, t, 0.03, dur, level)

    const flutter = this.ctx.createOscillator()
    flutter.type = 'square'
    flutter.frequency.value = 14 + Math.random() * 20
    const fAmt = this.ctx.createGain()
    fAmt.gain.value = level * 0.5
    flutter.connect(fAmt).connect(g.gain)
    flutter.start(t)
    flutter.stop(t + dur + 0.1)

    src.connect(hp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.1)
  }

  // ── Spatial cassettes ────────────────────────────────────────────────────

  /**
   * A tape only exists as sound while you are near it. Walk away and the
   * panner's distance model fades it out for you — no manual volume curve.
   */
  attachTape(id, position) {
    if (!this.started || this.sources.has(id)) return
    const panner = this.ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 1.1
    panner.maxDistance = 26
    panner.rolloffFactor = 2.4
    this.setPos(panner, position[0], position[1], position[2])

    const out = this.ctx.createGain()
    out.gain.value = 0.0001

    // Tape hiss.
    const hiss = this.ctx.createBufferSource()
    hiss.buffer = this.noiseBuffer
    hiss.loop = true
    const hissF = this.ctx.createBiquadFilter()
    hissF.type = 'highpass'
    hissF.frequency.value = 2400
    const hissG = this.ctx.createGain()
    hissG.gain.value = 0.05
    hiss.connect(hissF).connect(hissG).connect(out)
    hiss.start()

    // A muffled voice: two detuned saws through a narrow lowpass, with
    // wow-and-flutter on the pitch and a speech-rate amplitude gate.
    const voiceGain = this.ctx.createGain()
    voiceGain.gain.value = 0.0
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    lp.Q.value = 1.4

    const oscs = []
    for (const detune of [-7, 5]) {
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 108
      o.detune.value = detune
      o.connect(voiceGain)
      o.start()
      oscs.push(o)
    }
    // Wow: slow pitch drift, the signature of a worn transport.
    const wow = this.ctx.createOscillator()
    wow.frequency.value = 0.6
    const wowAmt = this.ctx.createGain()
    wowAmt.gain.value = 9
    wow.connect(wowAmt)
    for (const o of oscs) wowAmt.connect(o.detune)
    wow.start()

    const syll = this.ctx.createOscillator()
    syll.type = 'triangle'
    syll.frequency.value = 3.1
    const syllAmt = this.ctx.createGain()
    syllAmt.gain.value = 0.02
    syll.connect(syllAmt).connect(voiceGain.gain)
    syll.start()

    const formant = this.ctx.createOscillator()
    formant.frequency.value = 0.27
    const formantAmt = this.ctx.createGain()
    formantAmt.gain.value = 420
    formant.connect(formantAmt).connect(lp.frequency)
    formant.start()

    voiceGain.connect(lp).connect(out)
    out.connect(panner).connect(this.master)

    this.sources.set(id, { panner, out, nodes: [hiss, ...oscs, wow, syll, formant] })
  }

  /** Fade a tape's playback in when the camera commits to it. */
  setTapeActive(id, active) {
    const s = this.sources.get(id)
    if (!s) return
    s.out.gain.setTargetAtTime(active ? 0.5 : 0.0001, this.ctx.currentTime, 0.6)
  }

  detachAll() {
    for (const { nodes, out } of this.sources.values()) {
      try {
        out.gain.setValueAtTime(0.0001, this.ctx.currentTime)
        for (const n of nodes) n.stop?.()
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear()
  }

  setPos(panner, x, y, z) {
    if (panner.positionX) {
      panner.positionX.value = x
      panner.positionY.value = y
      panner.positionZ.value = z
    } else panner.setPosition(x, y, z)
  }

  /** Keeps the Web Audio listener glued to the three.js camera. */
  setListener(camera) {
    if (!this.started) return
    const l = this.ctx.listener
    const p = camera.position
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    if (l.positionX) {
      const t = this.ctx.currentTime
      l.positionX.setTargetAtTime(p.x, t, 0.02)
      l.positionY.setTargetAtTime(p.y, t, 0.02)
      l.positionZ.setTargetAtTime(p.z, t, 0.02)
      l.forwardX.setTargetAtTime(fwd.x, t, 0.02)
      l.forwardY.setTargetAtTime(fwd.y, t, 0.02)
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.02)
      l.upX.setTargetAtTime(up.x, t, 0.02)
      l.upY.setTargetAtTime(up.y, t, 0.02)
      l.upZ.setTargetAtTime(up.z, t, 0.02)
    } else {
      l.setPosition(p.x, p.y, p.z)
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z)
    }
  }

  /** Rain gets louder as you pull back out of the board into the warehouse. */
  setOpenness(v) {
    if (!this.rainGain) return
    this.rainGain.gain.setTargetAtTime(0.035 + v * 0.06, this.ctx.currentTime, 1.2)
  }
}

export const audio = new Soundscape()
