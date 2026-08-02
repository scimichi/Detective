import * as THREE from 'three'
import gsap from 'gsap'
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

  // True while the pointer is being dragged, so a pan doesn't also register
  // as a click on whatever happened to be under the cursor.
  dragged: false,

  // Where the depth-of-field is focused; the post stack reads this.
  focusDistance: CAMERA.startZ,

  // Where the pointer ray meets the board plane. The lens beam lands here,
  // so the torch is genuinely under the cursor rather than near it.
  flash: new THREE.Vector3(),
}

/**
 * GSAP smooths over long frames by pretending they were short ones, which is
 * right for a UI transition and wrong for a camera. On a slow renderer it
 * stretches a seven-second flight across the archive into minutes, because
 * the tween advances by a fictional 33 ms per frame instead of by the time
 * that actually passed. Every tween here is a move through space with a
 * duration the viewer feels, so give it the real clock.
 */
gsap.ticker.lagSmoothing(0)

if (import.meta.env.DEV && typeof window !== 'undefined') window.__nav = nav

export function resetNav(z = CAMERA.startZ) {
  nav.cur.set(0, 0, z)
  nav.tgt.set(0, 0, z)
  nav.prev.copy(nav.cur)
  nav.vel.set(0, 0, 0)
  nav.speed = 0
  nav.locked = false
}

/** Scripted camera move. Returns the tween so callers can chain onComplete. */
export function flyTo(x, y, z, duration = 2.2, ease = 'power3.inOut') {
  nav.locked = true
  gsap.killTweensOf(nav.tgt)
  gsap.killTweensOf(nav)
  gsap.to(nav, { handheld: 0.35, duration: duration * 0.3 })
  return gsap.to(nav.tgt, {
    x,
    y,
    z,
    duration,
    ease,
    onComplete: () => {
      nav.locked = false
      gsap.to(nav, { handheld: 1, duration: 1.4 })
    },
  })
}

export function dolly(delta) {
  if (nav.locked) return
  // Movement scales with distance: sweeping when you're across the room,
  // hair-fine when your nose is against the paper. One notch of a mouse wheel
  // is about a tenth of your current standoff, so getting from the far wall
  // to the paper fibres is a deliberate journey rather than a flick.
  const step = delta * 0.001 * Math.max(0.4, nav.tgt.z)
  nav.tgt.z = THREE.MathUtils.clamp(nav.tgt.z + step, CAMERA.minZ, CAMERA.maxZ)
}

export function pan(dx, dy) {
  if (nav.locked) return
  const k = nav.tgt.z * 0.0016
  const halfW = BOARD.width * 0.75
  const halfH = BOARD.height * 0.75
  nav.tgt.x = THREE.MathUtils.clamp(nav.tgt.x - dx * k, -halfW, halfW)
  nav.tgt.y = THREE.MathUtils.clamp(nav.tgt.y + dy * k, -halfH, halfH)
}

export function spinGraph(dx, dy) {
  nav.spinVel.y += dx * 0.0026
  nav.spinVel.x += dy * 0.0022
}
