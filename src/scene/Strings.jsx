import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { nav } from './nav.js'
import { useStore } from '../state/store.js'

/**
 * Every string is simulated.
 *
 * Verlet points, distance constraints, and — the part that makes the board
 * feel alive rather than decorated — a spatial hash that lets strings collide
 * with each other. Nudge one thread near a junction and the disturbance
 * travels outward through everything pinned to it, because the collision
 * response is a real exchange of momentum rather than a scripted wobble.
 */

const SEG = 13 // points per string
const ITER = 4 // constraint relaxation passes
const RADIUS = 0.055 // half-thickness for string-on-string contact

// Most threads are red thread. The others are the small number of
// distinctions a person actually makes when they run out of red: a different
// colour for "these are the same hand", for "these two cannot both be true".
const KIND_STYLE = {
  contradicts: { color: [0.82, 0.34, 0.13], width: 0.017, slack: 1.1, glow: 0.62 },
  excluded: { color: [0.4, 0.42, 0.45], width: 0.011, slack: 1.14, glow: 0.4 },
  speculative: { color: [0.44, 0.21, 0.24], width: 0.009, slack: 1.2, glow: 0.4 },
  'same-hand': { color: [0.86, 0.7, 0.3], width: 0.018, slack: 1.06, glow: 0.6 },
  physical: { color: [0.8, 0.24, 0.19], width: 0.02, slack: 1.05, glow: 0.6 },
  analysis: { color: [0.3, 0.5, 0.7], width: 0.012, slack: 1.12, glow: 0.5 },
  explains: { color: [0.28, 0.62, 0.5], width: 0.015, slack: 1.09, glow: 0.55 },
  default: { color: [0.76, 0.15, 0.12], width: 0.016, slack: 1.08, glow: 0.58 },
}

export default function Strings({ links, anchors }) {
  const mesh = useRef()
  const mode = useStore((s) => s.mode)
  const hoverId = useStore((s) => s.hoverId)
  const focusId = useStore((s) => s.focusId)
  const modeRef = useRef(mode)
  modeRef.current = mode

  const sim = useMemo(() => {
    const n = links.length
    return {
      links,
      count: n,
      pos: new Float32Array(n * SEG * 3),
      prev: new Float32Array(n * SEG * 3),
      rest: new Float32Array(n),
      style: links.map((l) => KIND_STYLE[l.kind] || KIND_STYLE.default),
      seeded: new Uint8Array(n),
      energy: new Float32Array(n), // drives the glow, so vibration is visible
    }
  }, [links])

  const geometry = useMemo(() => {
    const quads = Math.max(1, links.length) * (SEG - 1)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(quads * 6 * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(quads * 6 * 3), 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200)
    return g
  }, [links.length])

  useEffect(() => () => geometry.dispose(), [geometry])

  // Development hook: lets the solver be inspected from the console without
  // reaching through React.
  useEffect(() => {
    if (import.meta.env.DEV) window.__strings = sim
  }, [sim])

  const scratch = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      view: new THREE.Vector3(),
      side: new THREE.Vector3(),
      grid: new Map(),
    }),
    [],
  )

  const acc = useRef(0)

  useFrame((state, delta) => {
    const { pos, prev, rest, style, seeded, energy } = sim
    const n = sim.count
    if (!n) return

    const graph = modeRef.current === 'graph'
    const gravity = graph ? -0.35 : -3.4
    const damping = graph ? 0.982 : 0.975

    // Verlet is only stable at a fixed step. Accumulate real time and run
    // whole substeps; a stalled frame catches up over three at most, so a
    // hitch never launches the whole web across the room.
    const STEP = 1 / 60
    acc.current = Math.min(acc.current + delta, STEP * 3)
    const steps = Math.floor(acc.current / STEP)
    acc.current -= steps * STEP
    const dt = STEP

    // ── 1. Anchors ────────────────────────────────────────────────────────
    for (let i = 0; i < n; i++) {
      const l = links[i]
      const A = anchors.current.get(l.from)
      const B = anchors.current.get(l.to)
      if (!A || !B) continue
      const base = i * SEG * 3

      if (!seeded[i]) {
        // Lay the string out along the straight line the first time we see
        // it, then let gravity find the catenary.
        for (let s = 0; s < SEG; s++) {
          const t = s / (SEG - 1)
          const o = base + s * 3
          pos[o] = prev[o] = A.x + (B.x - A.x) * t
          pos[o + 1] = prev[o + 1] = A.y + (B.y - A.y) * t
          pos[o + 2] = prev[o + 2] = A.z + (B.z - A.z) * t
        }
        rest[i] = (A.distanceTo(B) / (SEG - 1)) * style[i].slack
        seeded[i] = 1
      }

      // Ends follow their pins; if a card moves, the string is dragged.
      pos[base] = A.x
      pos[base + 1] = A.y
      pos[base + 2] = A.z
      const last = base + (SEG - 1) * 3
      pos[last] = B.x
      pos[last + 1] = B.y
      pos[last + 2] = B.z

      // Retune the rest length as cards move between board and graph layouts.
      const target = (A.distanceTo(B) / (SEG - 1)) * style[i].slack
      rest[i] += (target - rest[i]) * 0.06
    }

    // ── 2..4. Simulate ────────────────────────────────────────────────────
    for (let step = 0; step < steps; step++) simulate()

    // ── 5. Ribbon geometry, billboarded toward the camera ─────────────────
    buildRibbons()

    function simulate() {
    // ── 2. Integrate ──────────────────────────────────────────────────────
    const camX = state.camera.position.x
    const camY = state.camera.position.y
    const camZ = state.camera.position.z
    const windX = nav.vel.x * 0.014
    const windY = nav.vel.y * 0.014
    const windZ = nav.vel.z * 0.02
    const gdt = gravity * dt * dt

    for (let i = 0; i < n; i++) {
      const base = i * SEG * 3
      let moved = 0
      for (let s = 1; s < SEG - 1; s++) {
        const o = base + s * 3
        const vx = (pos[o] - prev[o]) * damping
        const vy = (pos[o + 1] - prev[o + 1]) * damping
        const vz = (pos[o + 2] - prev[o + 2]) * damping
        prev[o] = pos[o]
        prev[o + 1] = pos[o + 1]
        prev[o + 2] = pos[o + 2]

        // Air displaced by the camera falls off sharply with distance, so
        // only the strings you are actually near respond to you.
        const dx = pos[o] - camX
        const dy = pos[o + 1] - camY
        const dz = pos[o + 2] - camZ
        const d2 = dx * dx + dy * dy + dz * dz
        const gust = 2.6 / (1.0 + d2 * d2 * 0.02)

        pos[o] += vx - windX * gust
        pos[o + 1] += vy + gdt - windY * gust
        pos[o + 2] += vz - windZ * gust

        moved += Math.abs(vx) + Math.abs(vy) + Math.abs(vz)
      }
      energy[i] += (Math.min(1, moved * 12) - energy[i]) * 0.16
    }

    // ── 3. Constraints ────────────────────────────────────────────────────
    for (let k = 0; k < ITER; k++) {
      for (let i = 0; i < n; i++) {
        const base = i * SEG * 3
        const r = rest[i]
        for (let s = 0; s < SEG - 1; s++) {
          const o1 = base + s * 3
          const o2 = o1 + 3
          const dx = pos[o2] - pos[o1]
          const dy = pos[o2 + 1] - pos[o1 + 1]
          const dz = pos[o2 + 2] - pos[o1 + 2]
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5
          const diff = ((d - r) / d) * 0.5
          const ox = dx * diff
          const oy = dy * diff
          const oz = dz * diff
          // Endpoints are pinned; only interior points give.
          if (s > 0) {
            pos[o1] += ox
            pos[o1 + 1] += oy
            pos[o1 + 2] += oz
          }
          if (s < SEG - 2) {
            pos[o2] -= ox
            pos[o2 + 1] -= oy
            pos[o2 + 2] -= oz
          }
        }
      }
    }

    // ── 4. String-on-string contact ───────────────────────────────────────
    // A uniform grid keeps this linear. When two threads touch, both are
    // displaced — which is how a knock propagates across the whole web.
    const grid = scratch.grid
    grid.clear()
    const cell = RADIUS * 4
    for (let i = 0; i < n; i++) {
      const base = i * SEG * 3
      for (let s = 1; s < SEG - 1; s++) {
        const o = base + s * 3
        const key =
          (Math.floor(pos[o] / cell) * 73856093) ^
          (Math.floor(pos[o + 1] / cell) * 19349663) ^
          (Math.floor(pos[o + 2] / cell) * 83492791)
        let bucket = grid.get(key)
        if (!bucket) grid.set(key, (bucket = []))
        bucket.push(o | 0, i)
      }
    }
    const minDist = RADIUS * 2
    for (const bucket of grid.values()) {
      const m = bucket.length / 2
      if (m < 2) continue
      for (let a = 0; a < m; a++) {
        const oa = bucket[a * 2]
        const ia = bucket[a * 2 + 1]
        for (let b = a + 1; b < m; b++) {
          const ob = bucket[b * 2]
          const ib = bucket[b * 2 + 1]
          if (ia === ib) continue // neighbours on one string already constrained
          const dx = pos[ob] - pos[oa]
          const dy = pos[ob + 1] - pos[oa + 1]
          const dz = pos[ob + 2] - pos[oa + 2]
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 > minDist * minDist || d2 < 1e-9) continue
          const d = Math.sqrt(d2)
          const push = ((minDist - d) / d) * 0.5
          const px = dx * push
          const py = dy * push
          const pz = dz * push
          pos[oa] -= px
          pos[oa + 1] -= py
          pos[oa + 2] -= pz
          pos[ob] += px
          pos[ob + 1] += py
          pos[ob + 2] += pz
          // Contact excites both threads — that is the transfer.
          energy[ia] = Math.min(1, energy[ia] + 0.05)
          energy[ib] = Math.min(1, energy[ib] + 0.05)
        }
      }
    }
    }

    function buildRibbons() {
    const posAttr = geometry.attributes.position
    const colAttr = geometry.attributes.color
    const P = posAttr.array
    const C = colAttr.array
    const { a, b, mid, dir, view, side } = scratch
    let v = 0

    for (let i = 0; i < n; i++) {
      const base = i * SEG * 3
      const st = style[i]
      const l = links[i]
      // A thread attached to whatever you are looking at lights up along its
      // whole length — that is how you find what else is implicated.
      const lit =
        hoverId && (l.from === hoverId || l.to === hoverId)
          ? 3.0
          : focusId && (l.from === focusId || l.to === focusId)
            ? 2.4
            : 1
      const glow = st.glow * lit * (1 + energy[i] * 0.9)
      const width = st.width * (graph ? 1.5 : 1) * (lit > 1 ? 1.35 : 1)

      for (let s = 0; s < SEG - 1; s++) {
        const o1 = base + s * 3
        const o2 = o1 + 3
        a.set(pos[o1], pos[o1 + 1], pos[o1 + 2])
        b.set(pos[o2], pos[o2 + 1], pos[o2 + 2])
        mid.addVectors(a, b).multiplyScalar(0.5)
        dir.subVectors(b, a)
        view.subVectors(state.camera.position, mid)
        side.crossVectors(dir, view)
        const len = side.length()
        if (len < 1e-6) side.set(width, 0, 0)
        else side.multiplyScalar(width / len)

        // Two triangles per segment.
        const verts = [
          a.x - side.x, a.y - side.y, a.z - side.z,
          a.x + side.x, a.y + side.y, a.z + side.z,
          b.x + side.x, b.y + side.y, b.z + side.z,
          a.x - side.x, a.y - side.y, a.z - side.z,
          b.x + side.x, b.y + side.y, b.z + side.z,
          b.x - side.x, b.y - side.y, b.z - side.z,
        ]
        for (let q = 0; q < 18; q++) P[v * 3 + q] = verts[q]
        for (let q = 0; q < 6; q++) {
          C[(v + q) * 3] = st.color[0] * glow
          C[(v + q) * 3 + 1] = st.color[1] * glow
          C[(v + q) * 3 + 2] = st.color[2] * glow
        }
        v += 6
      }
    }

    // Anything left over from a longer previous frame collapses to a point.
    for (let q = v * 3; q < P.length; q++) P[q] = 0
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    geometry.setDrawRange(0, v)
    }
  })

  return (
    <mesh ref={mesh} geometry={geometry} castShadow frustumCulled={false} renderOrder={1}>
      {/* Tone-mapped, so the thread sits inside the room's exposure instead
          of floating on top of it as neon. Only the highlight of an excited
          or selected thread is allowed to clip into bloom. */}
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
    </mesh>
  )
}
