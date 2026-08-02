import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Corkboard from './Corkboard.jsx'
import EvidenceItem from './EvidenceItem.jsx'
import Strings from './Strings.jsx'
import Lamp from './Lamp.jsx'
import Dust from './Dust.jsx'
import MapTerrain from './MapTerrain.jsx'
import { graphLayout } from './graphLayout.js'
import { useStore } from '../state/store.js'
import { lod } from '../gfx/lod.js'
import { nav, flyTo } from './nav.js'
import { audio } from '../audio/soundscape.js'
import { DIST } from '../constants.js'

/** One case, assembled. Everything here shares a single coordinate system. */
export default function Board({ data }) {
  const year = useStore((s) => s.year)
  const filters = useStore((s) => s.filters)
  const mode = useStore((s) => s.mode)
  const focusId = useStore((s) => s.focusId)
  const lens = useStore((s) => s.lens)

  const lampRef = useRef()
  const handLamp = useRef()
  const cardsRef = useRef()
  const anchors = useRef(new Map())

  // Warm the thumbnail tier so nothing on the board is ever blank.
  useEffect(() => {
    lod.warm(data.evidence)
    return () => {
      lod.disposeAll()
      audio.detachAll()
      anchors.current.clear()
    }
  }, [data])

  const { present, links } = useMemo(() => {
    const present = new Set(
      data.evidence
        .filter(
          (e) =>
            year >= e.since &&
            (e.until == null || year <= e.until) &&
            (filters.length === 0 || filters.includes(e.kind)),
        )
        .map((e) => e.id),
    )
    const links = data.links.filter(
      (l) =>
        present.has(l.from) &&
        present.has(l.to) &&
        year >= (l.since ?? data.yearRange[0]) &&
        (l.until == null || year <= l.until),
    )
    return { present, links }
  }, [data, year, filters])

  /**
   * A mode change is meaningless if you are pressed against a document when
   * it happens — you'd lift the whole board into a graph and see cork. So
   * changing mode also steps the camera back to where that mode is legible.
   */
  const firstMode = useRef(true)
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false
      return
    }
    if (mode === 'graph') flyTo(0, 0, 26, 1.9)
    else if (nav.tgt.z < 9) flyTo(nav.tgt.x, nav.tgt.y, 18, 1.6)
  }, [mode])

  const graphPositions = useMemo(() => {
    if (mode !== 'graph') return null
    const live = data.evidence.filter((e) => present.has(e.id))
    return graphLayout(data.id, year, live, links)
  }, [mode, data, year, present, links])

  useFrame((st, delta) => {
    const dt = Math.min(0.05, delta)

    if (handLamp.current) {
      // Held slightly up and to the left of the eye, like a torch in the
      // hand you are not pointing with.
      const z = Math.max(0.35, nav.cur.z)
      // Held back as well as up, so its falloff across a single sheet is
      // gentle instead of a hotspot in one corner.
      handLamp.current.position.set(
        st.camera.position.x - z * 0.13,
        st.camera.position.y + z * 0.15,
        st.camera.position.z + z * 0.45,
      )
      handLamp.current.distance = THREE.MathUtils.clamp(z * 5, 3, 80)
      // Inverse-square light, so intensity ∝ z² holds the exposure steady.
      // Under a lens the room goes down to almost nothing: you inspect a
      // document under ultraviolet in the dark, not under a desk lamp.
      const dim = lens === 'none' ? 1 : 0.12
      handLamp.current.intensity = THREE.MathUtils.clamp(1.1 * z * z, 0.05, 190) * dim
    }

    if (cardsRef.current) {
      // Relationship mode rotates the constellation, not the room.
      const wantX = mode === 'graph' ? nav.spin.x : 0
      const wantY = mode === 'graph' ? nav.spin.y : 0
      const k = 1 - Math.exp(-4 * dt)
      cardsRef.current.rotation.x += (wantX - cardsRef.current.rotation.x) * k
      cardsRef.current.rotation.y += (wantY - cardsRef.current.rotation.y) * k
    }
    // The room opens up as you pull back — rain gets louder, the board smaller.
    audio.setOpenness(THREE.MathUtils.clamp((nav.cur.z - 20) / (DIST.warehouse - 20), 0, 1))
  })

  const focusedMap = useMemo(() => {
    if (!focusId) return null
    const item = data.byId.get(focusId)
    return item && item.kind === 'map' ? item : null
  }, [focusId, data])

  return (
    <group>
      <Corkboard />
      <Lamp ref={lampRef} />
      <Dust lampRef={lampRef} />

      {/* A little cold fill so the far corners of the board are not pure
          black — a real room always has some spill from somewhere. */}
      <ambientLight intensity={lens === 'none' ? 0.1 : 0.012} color="#5a6a86" />
      <pointLight position={[10, -6, 8]} intensity={9} distance={30} decay={2} color="#2c3f5a" />

      {/* The light you brought with you. Its intensity tracks the square of
          your standoff, so the irradiance on whatever you are reading stays
          roughly constant from across the room down to the paper fibres —
          you can always see the thing you have chosen to look at. */}
      <pointLight ref={handLamp} intensity={0} decay={2} color="#ffe0b8" castShadow={false} />

      <group ref={cardsRef}>
        {data.evidence.map((item, i) => (
          <EvidenceItem
            key={item.id}
            item={item}
            index={i}
            present={present.has(item.id)}
            graphPos={graphPositions?.get(item.id)}
            anchors={anchors}
          />
        ))}
      </group>

      <Strings links={links} anchors={anchors} />

      {focusedMap && <MapTerrain item={focusedMap} active={!!focusedMap} />}
    </group>
  )
}
