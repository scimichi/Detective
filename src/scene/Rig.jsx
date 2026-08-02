import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  nav,
  dolly,
  pan,
  spinGraph,
  updateFlight,
  updateSweep,
  stopSweep,
} from './nav.js'
import { useStore } from '../state/store.js'
import { CAMERA, BOARD } from '../constants.js'
import { audio } from '../audio/soundscape.js'

/**
 * Mouse wheel does not zoom. It moves you.
 *
 * There is no field-of-view change anywhere in this project — getting closer
 * to a document means the camera is closer to the document, which is why
 * parallax between overlapping paper behaves correctly and why the lamp's
 * shadows slide the way they should as you lean in.
 */
const RAY = new THREE.Vector3()

export default function Rig() {
  const { camera, gl } = useThree()
  const mode = useStore((s) => s.mode)
  const phase = useStore((s) => s.phase)
  const setCamDistance = useStore((s) => s.setCamDistance)
  const setFps = useStore((s) => s.setFps)

  const drag = useRef({ active: false, x: 0, y: 0, dist: 0 })
  const perf = useRef({ frames: 0, last: 0, acc: 0 })
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    const el = gl.domElement

    const onWheel = (e) => {
      e.preventDefault()
      // Trackpads report tiny pixel deltas; wheels report large line deltas.
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      dolly(e.deltaY * scale)
    }

    const onDown = (e) => {
      if (e.button !== 0) return
      drag.current = { active: true, x: e.clientX, y: e.clientY, dist: 0 }
      nav.dragged = false
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e) => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      // A real hand on the mouse always outranks the tour's beam sweep.
      stopSweep()
      nav.ptr.set((e.clientX / w) * 2 - 1, -((e.clientY / h) * 2 - 1))

      if (!drag.current.active) return
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      drag.current.x = e.clientX
      drag.current.y = e.clientY
      drag.current.dist += Math.abs(dx) + Math.abs(dy)
      if (drag.current.dist > 6) nav.dragged = true

      if (modeRef.current === 'graph') spinGraph(dx, dy)
      else pan(dx, dy)
    }

    const onUp = (e) => {
      drag.current.active = false
      el.releasePointerCapture?.(e.pointerId)
      // Let the click handler that fires immediately after still see the flag,
      // then clear it on the next tick.
      setTimeout(() => (nav.dragged = false), 0)
    }

    const onKey = (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return
      const step = 40
      if (e.key === 'ArrowLeft' || e.key === 'a') pan(step, 0)
      if (e.key === 'ArrowRight' || e.key === 'd') pan(-step, 0)
      if (e.key === 'ArrowUp' || e.key === 'w') pan(0, step)
      if (e.key === 'ArrowDown' || e.key === 's') pan(0, -step)
      if (e.key === 'q') dolly(-260)
      if (e.key === 'e') dolly(260)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl])

  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta)
    const t = state.clock.elapsedTime

    // Scripted moves advance here, on the render loop, so a busy main thread
    // can delay a flight but can never abandon one part-way.
    //
    // They advance on *real* elapsed time rather than the clamped step the
    // simulation uses. A parametric interpolation needs no stability clamp,
    // and clamping it would let the camera fall behind the narration it is
    // supposed to be moving with: the voice runs on wall-clock, so the
    // picture has to as well.
    const step = Math.min(0.25, delta)
    updateFlight(delta)
    updateSweep(delta)
    nav.handheld += (nav.handheldTarget - nav.handheld) * (1 - Math.exp(-3 * step))

    // Critically-damped-ish approach, frame-rate independent. This uses a
    // much looser step cap than the physics does: an exponential approach is
    // stable at any dt, and clamping it hard means that on a slow renderer
    // the camera crawls toward its target in wall-clock time.
    const k = 1 - Math.exp(-7 * step)
    nav.cur.lerp(nav.tgt, k)
    nav.vel.subVectors(nav.cur, nav.prev).divideScalar(Math.max(dt, 1 / 240))
    nav.speed = nav.vel.length()
    nav.prev.copy(nav.cur)

    // Relationship mode spins the graph rather than orbiting the camera.
    nav.spin.x += nav.spinVel.x
    nav.spin.y += nav.spinVel.y
    nav.spinVel.x *= 0.9
    nav.spinVel.y *= 0.9
    nav.spin.x = THREE.MathUtils.clamp(nav.spin.x, -1.2, 1.2)
    if (modeRef.current === 'graph' && Math.abs(nav.spinVel.y) < 0.0004) {
      nav.spin.y += dt * 0.045 // idle drift, so it never looks frozen
    }

    // Operator breathing: three incommensurate sines so it never loops.
    const hh = nav.handheld
    const bx = (Math.sin(t * 0.63) * 0.6 + Math.sin(t * 1.71 + 1.2) * 0.4) * 0.014 * hh
    const by = (Math.sin(t * 0.47 + 2.1) * 0.6 + Math.sin(t * 1.31) * 0.4) * 0.012 * hh
    const bz = Math.sin(t * 0.29 + 0.7) * 0.02 * hh
    const roll = Math.sin(t * 0.37 + 1.9) * 0.0038 * hh

    camera.position.set(nav.cur.x + bx, nav.cur.y + by, nav.cur.z + bz)

    // Look straight into the board, with a little parallax lead from the
    // pointer. Keeping the axis parallel is what stops paper from skewing.
    const lead = Math.min(nav.cur.z, 12)
    camera.lookAt(
      nav.cur.x + nav.ptr.x * lead * 0.05,
      nav.cur.y + nav.ptr.y * lead * 0.035,
      nav.cur.z - 10,
    )
    camera.rotateZ(roll)

    nav.focusDistance = nav.cur.z

    // Project the pointer onto the board plane so the lens beam has a real
    // world-space landing point rather than a screen-space approximation.
    camera.updateMatrixWorld()
    RAY.set(nav.ptr.x, nav.ptr.y, 0.5).unproject(camera).sub(camera.position).normalize()
    if (Math.abs(RAY.z) > 1e-4) {
      const tHit = (BOARD.paperZ - camera.position.z) / RAY.z
      if (tHit > 0) nav.flash.copy(camera.position).addScaledVector(RAY, tHit)
    }

    audio.setListener(camera)

    // Iris. Moving into the lamp's pool fills the frame with lit paper, and a
    // fixed exposure would blow it out — so the camera stops down as it
    // closes in, the way an eye or an auto-exposure lens does. It also makes
    // pulling back into the dark feel like the room opening up.
    const wantExposure = THREE.MathUtils.lerp(
      0.46,
      1.1,
      THREE.MathUtils.smoothstep(nav.cur.z, 0.6, 7),
    )
    state.gl.toneMappingExposure +=
      (wantExposure - state.gl.toneMappingExposure) * (1 - Math.exp(-2.2 * dt))

    // Throttled HUD readouts.
    perf.current.frames++
    perf.current.acc += dt
    if (perf.current.acc > 0.5) {
      setFps(Math.round(perf.current.frames / perf.current.acc))
      setCamDistance(nav.cur.z)
      perf.current.frames = 0
      perf.current.acc = 0
    }
  })

  useEffect(() => {
    camera.near = CAMERA.near
    camera.far = CAMERA.far
    camera.fov = CAMERA.fov
    camera.updateProjectionMatrix()
  }, [camera, phase])

  return null
}
