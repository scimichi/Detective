import * as THREE from 'three'
import { CAMERA, BOARD } from '../constants.js'

/**
 * The camera is the only navigation this site has. There are no routes, so
 * every "page change" is a position in the same room — which means one
 * mutable object can describe where the whole experience currently is.
 */
export const nav = {
  cur: new THREE.Vector3(0, 0, CAMERA.startZ),
  tgt: new THREE.Vector3(0, 0, CAMERA.startZ),
  prev: new THREE.Vector3(0, 0, CAMERA.startZ),
  vel: new THREE.Vector3(),
  speed: 0,

  // Pointer parallax, in normalised device coordinates.
  ptr: new THREE.Vector2(),

  // Set while a scripted move is playing; user input is ignored until it ends.
  locked: false,

  // Relationship mode spins the graph, not the camera.
  spin: { x: -0.12, y: 0.32 },
  spinVel: { x: 0, y: 0 },

  // Handheld intensity — dialled down during scripted moves.
  handheld: 1,
  handheldTarget: 1,

  // True while the pointer is being dragged, so a pan doesn't also register
  // as a click on whatever happened to be under the cursor.
  dragged: false,

  // Where the depth-of-field is focused; the post stack reads this.
  focusDistance: CAMERA.startZ,

  // Where the pointer ray meets the board plane. The lens beam lands here,
  // so the torch is genuinely under the cursor rather than near it.
  flash: new THREE.Vector3(),

  // Set while a tour is running. Any deliberate move by the viewer pauses the
  // narration instead of wrestling it for the camera.
  onUserInput: null,
}

/**
 * Scripted camera moves run on the render loop, not on an animation library's
 * ticker.
 *
 * That is a deliberate correction. Driving these with GSAP meant a flight only
 * advanced when GSAP got a tick — and while the texture streamer was building
 * a full-resolution scan, it did not. Each new flight then killed a
 * predecessor that had never moved, and the camera sat still through an entire
 * narrated sequence while the captions and the year slider carried on without
 * it.
 *
 * Tying the interpolation to the loop that draws the frame gives a much
 * stronger invariant: if a frame renders, the camera has moved.
 */
const flight = {
  active: false,
  t: 0,
  dur: 1,
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  ease: easeInOutCubic,
}

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
}
function easeOutQuad(p) {
  return 1 - (1 - p) * (1 - p)
}
function easeInCubic(p) {
  return p * p * p
}

const EASES = {
  'power3.inOut': easeInOutCubic,
  'power2.out': easeOutQuad,
  'power3.in': easeInCubic,
}

/** A slow sweep of the lens beam, for when the tour is showing you something. */
const sweep = { active: false, t: 0 }

if (import.meta.env.DEV && typeof window !== 'undefined') window.__nav = nav

export function resetNav(z = CAMERA.startZ) {
  cancelFlight()
  nav.cur.set(0, 0, z)
  nav.tgt.set(0, 0, z)
  nav.prev.copy(nav.cur)
  nav.vel.set(0, 0, 0)
  nav.speed = 0
  nav.locked = false
}

/** Scripted camera move. Supersedes whatever move was already in progress. */
export function flyTo(x, y, z, duration = 2.2, ease = 'power3.inOut') {
  flight.from.copy(nav.tgt)
  flight.to.set(x, y, z)
  flight.t = 0
  flight.dur = Math.max(0.05, duration)
  flight.ease = EASES[ease] || easeInOutCubic
  flight.active = true
  nav.locked = true
  nav.handheldTarget = 0.35
}

export function cancelFlight() {
  flight.active = false
  nav.locked = false
  nav.handheldTarget = 1
}

/** Called once per frame by the rig, with the real frame delta. */
export function updateFlight(dt) {
  if (!flight.active) return
  flight.t += dt
  const p = Math.min(1, flight.t / flight.dur)
  nav.tgt.lerpVectors(flight.from, flight.to, flight.ease(p))
  if (p >= 1) {
    flight.active = false
    nav.locked = false
    nav.handheldTarget = 1
  }
}

export const flightActive = () => flight.active

export function startSweep() {
  sweep.active = true
  sweep.t = 0
}

export function stopSweep() {
  sweep.active = false
}

/**
 * Drives the beam across the page on the tour's behalf. Two incommensurate
 * frequencies, so it wanders rather than tracing a path the eye can predict.
 */
export function updateSweep(dt) {
  if (!sweep.active) return
  sweep.t += dt
  nav.ptr.set(
    Math.sin(sweep.t * 0.42) * 0.42,
    Math.sin(sweep.t * 0.29 + 1.1) * 0.3,
  )
}

export function dolly(delta) {
  nav.onUserInput?.()
  if (nav.locked) return
  // Movement scales with distance: sweeping when you're across the room,
  // hair-fine when your nose is against the paper. One notch of a mouse wheel
  // is about a tenth of your current standoff, so getting from the far wall
  // to the paper fibres is a deliberate journey rather than a flick.
  const step = delta * 0.001 * Math.max(0.4, nav.tgt.z)
  nav.tgt.z = THREE.MathUtils.clamp(nav.tgt.z + step, CAMERA.minZ, CAMERA.maxZ)
}

export function pan(dx, dy) {
  nav.onUserInput?.()
  if (nav.locked) return
  const k = nav.tgt.z * 0.0016
  const halfW = BOARD.width * 0.75
  const halfH = BOARD.height * 0.75
  nav.tgt.x = THREE.MathUtils.clamp(nav.tgt.x - dx * k, -halfW, halfW)
  nav.tgt.y = THREE.MathUtils.clamp(nav.tgt.y + dy * k, -halfH, halfH)
}

export function spinGraph(dx, dy) {
  nav.onUserInput?.()
  nav.spinVel.y += dx * 0.0026
  nav.spinVel.x += dy * 0.0022
}
