import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { KIND_SIZE, BOARD, CAMERA } from '../constants.js'
import { lod, levelForDistance } from '../gfx/lod.js'
import { makeEvidenceMaterial, setEvidenceUniforms } from '../gfx/evidenceMaterial.js'
import { useStore } from '../state/store.js'
import { nav, flyTo } from './nav.js'
import { audio } from '../audio/soundscape.js'
import { mulberry } from '../gfx/canvas2d.js'

const geometryCache = new Map()

/** Paper does not lie flat. A little curl catches the lamp and sells it. */
function paperGeometry(kind, scale, seed) {
  const key = `${kind}:${scale}:${seed % 64}`
  if (geometryCache.has(key)) return geometryCache.get(key)

  const [w, h] = KIND_SIZE[kind] || [1.6, 2]
  const g = new THREE.PlaneGeometry(w * scale, h * scale, 10, 10)
  const rand = mulberry(seed)
  const pos = g.attributes.position
  const a = 0.008 + rand() * 0.02
  const bx = rand() * 6.28
  const by = rand() * 6.28
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w * scale)
    const y = pos.getY(i) / (h * scale)
    // Corners lift more than the middle, where the pin holds it down.
    const corner = (Math.abs(x) + Math.abs(y)) * 1.4
    const z =
      a * corner * (Math.sin(x * 4.1 + bx) + Math.cos(y * 3.3 + by)) +
      a * 0.6 * Math.sin((x + y) * 5.2)
    pos.setZ(i, z)
  }
  g.computeVertexNormals()
  geometryCache.set(key, g)
  return g
}

export default function EvidenceItem({ item, graphPos, present, index, anchors }) {
  const group = useRef()
  const mesh = useRef()
  const pin = useRef()

  const mode = useStore((s) => s.mode)
  const lens = useStore((s) => s.lens)
  const focusId = useStore((s) => s.focusId)
  const hoverId = useStore((s) => s.hoverId)
  const focus = useStore((s) => s.focus)
  const hover = useStore((s) => s.hover)
  const year = useStore((s) => s.year)

  const scale = item.scale || 1
  const geo = useMemo(() => paperGeometry(item.kind, scale, item.seed), [item, scale])
  const material = useMemo(() => makeEvidenceMaterial(null), [item.id])

  const state = useRef({
    fade: 0,
    lift: 0,
    tick: index % 5,
    tapeOn: false,
    level: 0,
    world: new THREE.Vector3(),
  })

  const isFocused = focusId === item.id
  const isHovered = hoverId === item.id

  /**
   * Adopt whatever resolution the streamer currently has for this item.
   *
   * This is polled rather than pushed because generation is asynchronous: the
   * level the camera *wants* is requested immediately, but the canvas for it
   * may not exist for several frames. Re-reading each tick means the sheet
   * sharpens the moment its scan is ready, instead of staying blurred until
   * the camera happens to cross another threshold.
   */
  const adopt = (want) => {
    const tex = lod.request(item, want)
    if (tex && material.map !== tex) {
      const first = !material.map
      material.map = tex
      // Only a null→texture transition changes the shader's defines.
      if (first) material.needsUpdate = true
    }
    // Attach the hidden layer as soon as you've leaned in at all — the
    // lens should reward a look, not a pilgrimage.
    if (want >= 1 && item.hidden && !material.userData.uniforms.uHasHidden.value) {
      setEvidenceUniforms(material, { uHidden: lod.hidden(item), uHasHidden: 1 })
    }
  }

  useEffect(() => {
    adopt(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, material])

  useEffect(() => () => material.dispose(), [material])

  // Age the print as the year slider moves: recent years show restored scans,
  // early years show the document as it was when it was still being handled.
  useEffect(() => {
    const span = Math.max(1, 2024 - item.since)
    const t = 1 - (year - item.since) / span
    setEvidenceUniforms(material, { uAge: THREE.MathUtils.clamp(t, 0, 1) * 0.85 })
  }, [year, item.since, material])

  useFrame((st, delta) => {
    const dt = Math.min(0.05, delta)
    const g = group.current
    if (!g) return

    // ── Where should this item be right now? ──────────────────────────────
    const inGraph = mode === 'graph' && graphPos
    const targetX = inGraph ? graphPos[0] : item.pos[0]
    const targetY = inGraph ? graphPos[1] : item.pos[1]
    const targetZ = inGraph
      ? graphPos[2]
      : BOARD.paperZ + item.depth + state.current.lift

    const k = 1 - Math.exp(-(inGraph ? 3.4 : 5.5) * dt)
    g.position.x += (targetX - g.position.x) * k
    g.position.y += (targetY - g.position.y) * k
    g.position.z += (targetZ - g.position.z) * k

    // In relationship mode the cards square up to face the viewer, which means
    // cancelling out the graph's own rotation — otherwise spinning the
    // constellation turns half of it into blank card backs. On the board they
    // keep whatever angle the person who pinned them left behind.
    if (inGraph && g.parent) {
      g.parent.getWorldQuaternion(Q)
      Q.invert()
    } else {
      EULER.set(0, 0, item.rot)
      Q.setFromEuler(EULER)
    }
    g.quaternion.slerp(Q, k)

    // ── Presence: the year slider fades material in and out ───────────────
    const want = present ? 1 : 0
    state.current.fade += (want - state.current.fade) * (1 - Math.exp(-4 * dt))
    const fade = state.current.fade
    g.visible = fade > 0.01
    material.opacity = fade
    material.transparent = fade < 0.995
    const s = 0.86 + fade * 0.14
    g.scale.setScalar(s)

    // Hover lifts the sheet off the cork; the shadow separates with it.
    const wantLift = isHovered ? 0.075 : isFocused ? 0.05 : 0
    state.current.lift += (wantLift - state.current.lift) * (1 - Math.exp(-9 * dt))

    // Publish the pin's world position so the strings have something to hang
    // from. Doing it here means threads track cards through every transition.
    if (anchors && pin.current) {
      g.updateMatrixWorld()
      let vec = anchors.current.get(item.id)
      if (!vec) anchors.current.set(item.id, (vec = new THREE.Vector3()))
      pin.current.getWorldPosition(vec)
    }

    // ── Level of detail ───────────────────────────────────────────────────
    // Staggered so fifteen documents never re-request on the same frame.
    state.current.tick++
    if (state.current.tick % 6 === 0 && g.visible) {
      g.getWorldPosition(state.current.world)
      const d = st.camera.position.distanceTo(state.current.world)
      const want = levelForDistance(d)
      state.current.level = want
      adopt(want)

      if (item.kind === 'tape') {
        const near = d < 7
        if (near && !state.current.tapeOn) {
          audio.attachTape(item.id, [
            state.current.world.x,
            state.current.world.y,
            state.current.world.z,
          ])
          audio.setTapeActive(item.id, true)
          state.current.tapeOn = true
        } else if (!near && state.current.tapeOn) {
          audio.setTapeActive(item.id, false)
          state.current.tapeOn = false
        }
      }
    }

    // ── Lens uniforms ─────────────────────────────────────────────────────
    setEvidenceUniforms(material, {
      uLens: lens === 'uv' ? 1 : lens === 'ir' ? 2 : 0,
      uFlashOn: lens === 'none' ? 0 : 1,
      uSelect: isFocused ? 1 : isHovered ? 0.35 : 0,
    })
    if (lens !== 'none') {
      // The beam lands exactly where the pointer ray meets the board.
      setEvidenceUniforms(material, {
        uFlashPos: nav.flash,
        uFlashRadius: THREE.MathUtils.clamp(nav.cur.z * 0.38, 0.5, 3.4),
      })
    }
  })

  const onClick = (e) => {
    e.stopPropagation()
    if (nav.dragged) return
    audio.rustle(0.045)
    if (isFocused) {
      // Already looking at it — go all the way in, to the fibres. Aim a
      // little above centre, where the margin notes tend to be.
      flyTo(item.pos[0], item.pos[1] + 0.35, 0.8, 1.5)
    } else {
      focus(item.id)
      const { dist, shift } = frameFor(item)
      flyTo(item.pos[0] + shift, item.pos[1], dist, 1.7)
    }
  }

  const pinColor = PIN_COLOURS[item.kind] || '#b8342c'
  const [, ih] = KIND_SIZE[item.kind] || [1.6, 2]

  return (
    <group ref={group} position={[item.pos[0], item.pos[1], BOARD.paperZ]} rotation={[0, 0, item.rot]}>
      <mesh
        ref={mesh}
        geometry={geo}
        material={material}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          hover(item.id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hover(null)
          document.body.style.cursor = ''
        }}
      />

      {/* The pin. Small, metal, and the thing casting the sharpest shadow. */}
      <group ref={pin} position={[0, (ih * scale) / 2 - 0.12, 0.02]}>
        <mesh castShadow position={[0, 0, 0.055]}>
          <sphereGeometry args={[0.055, 12, 10]} />
          <meshStandardMaterial color={pinColor} roughness={0.28} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 6]} />
          <meshStandardMaterial color="#b9b6ae" roughness={0.3} metalness={0.85} />
        </mesh>
      </group>
    </group>
  )
}

const Q = new THREE.Quaternion()
const EULER = new THREE.Euler()

const PIN_COLOURS = {
  newspaper: '#c9b03a',
  letter: '#3a6fc9',
  report: '#c9563a',
  map: '#3ac97a',
  note: '#c93a8e',
  photo: '#b8342c',
  polaroid: '#e0e0e0',
  tape: '#8e5ac9',
}

/**
 * How far back you have to stand for a given document to fit on screen, and
 * how far to slide sideways so the transcript panel doesn't sit on top of it.
 *
 * Solved against the live viewport rather than guessed, because a letter and
 * a fold-out map need very different standoffs from the same camera.
 */
export function frameFor(item) {
  const [w, h] = KIND_SIZE[item.kind] || [1.6, 2]
  const scale = item.scale || 1
  const vfov = (CAMERA.fov * Math.PI) / 180
  const aspect =
    typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const halfTan = Math.tan(vfov / 2)

  // Maps grow a terrain out of themselves once framed, so leave headroom.
  const margin = item.kind === 'map' ? 2.0 : 1.18
  const byHeight = (h * scale * margin) / (2 * halfTan)
  const byWidth = (w * scale * margin) / (2 * halfTan * aspect)
  const dist = Math.max(byHeight, byWidth, CAMERA.minZ + 0.3) + BOARD.paperZ

  // The inspector occupies the lower right. Nudge the document left of it,
  // but only on screens wide enough for the panel to be a real obstruction.
  const visibleWidth = 2 * dist * halfTan * aspect
  const shift = aspect > 1.15 ? visibleWidth * 0.14 : 0
  return { dist, shift }
}

/** Where a string should attach to this item. */
export function pinPoint(item) {
  const [, h] = KIND_SIZE[item.kind] || [1.6, 2]
  const scale = item.scale || 1
  return [item.pos[0], item.pos[1] + (h * scale) / 2 - 0.12, BOARD.pinZ]
}
