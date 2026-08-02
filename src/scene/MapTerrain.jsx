import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { motifTerrain } from '../gfx/canvas2d.js'
import { KIND_SIZE } from '../constants.js'
import { rng } from '../data/util.js'

/**
 * Click a location and the map stops being a picture of a place.
 *
 * The terrain is displaced from the *same* noise field that drew the paper
 * map's contours, so the ridges you traced on the sheet are the ridges that
 * rise out of it. Not a tile server — a stylised sheet of paper standing up.
 */
export default function MapTerrain({ item, active }) {
  const group = useRef()
  const flight = useRef()
  const t = useRef(0)

  const [w, h] = KIND_SIZE.map
  const scale = item.scale || 1
  const W = w * scale
  const H = h * scale

  const { geometry, cities, pin, path } = useMemo(() => {
    const sample = motifTerrain(item.seed)
    const SEGS = 128
    const g = new THREE.PlaneGeometry(W, H, SEGS, SEGS)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)

    // A paper relief model: the palette of a printed survey sheet that has
    // stood up, not of a satellite photograph.
    const low = new THREE.Color('#6b6350')
    const mid = new THREE.Color('#9a8f73')
    const high = new THREE.Color('#e6dcc0')
    const water = new THREE.Color('#243b4a')
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / W + 0.5
      const v = 0.5 - pos.getY(i) / H
      const n = sample(u, v)
      const isWater = n < 0.42
      const elev = isWater ? 0 : (n - 0.42) * 0.9
      pos.setZ(i, elev)
      if (isWater) c.copy(water)
      else if (n < 0.62) c.copy(low).lerp(mid, (n - 0.42) / 0.2)
      else c.copy(mid).lerp(high, Math.min(1, (n - 0.62) / 0.38))
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()

    // Settlements cluster on flat, low-but-dry ground, the way they actually do.
    const rand = rng(item.seed ^ 0x1234)
    const cities = []
    for (let i = 0; i < 420 && cities.length < 90; i++) {
      const u = rand()
      const v = rand()
      const n = sample(u, v)
      if (n < 0.46 || n > 0.7) continue
      const nx = sample(u + 0.01, v)
      const ny = sample(u, v + 0.01)
      const slope = Math.abs(nx - n) + Math.abs(ny - n)
      if (slope > 0.045) continue
      cities.push({
        x: (u - 0.5) * W,
        y: (0.5 - v) * H,
        z: (n - 0.42) * 0.9,
        h: 0.05 + rand() * 0.22,
        w: 0.02 + rand() * 0.035,
      })
    }

    const pin = { x: (rand() - 0.5) * W * 0.6, y: (rand() - 0.5) * H * 0.6 }
    pin.z = Math.max(0, (sample(pin.x / W + 0.5, 0.5 - pin.y / H) - 0.42) * 0.9)

    // A great-circle-ish arc across the sheet, for the cases that have one.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-W * 0.45, -H * 0.3, 0.4),
      new THREE.Vector3(-W * 0.1, H * 0.1, 1.5),
      new THREE.Vector3(W * 0.2, H * 0.25, 1.7),
      new THREE.Vector3(W * 0.46, -H * 0.05, 0.5),
    ])
    const path = new THREE.TubeGeometry(curve, 96, 0.012, 6, false)

    return { geometry: g, cities, pin, path }
  }, [item.seed, W, H])

  const cityGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const instRef = useRef()

  useFrame((_, delta) => {
    t.current += delta
    if (!group.current) return
    const want = active ? 1 : 0
    const k = 1 - Math.exp(-3.2 * Math.min(0.05, delta))
    group.current.scale.z += (want - group.current.scale.z) * k
    group.current.visible = group.current.scale.z > 0.01
    if (flight.current) {
      // The route draws itself, over and over.
      flight.current.material.opacity = active ? 0.85 : 0
      const d = (t.current * 0.18) % 1
      flight.current.geometry.setDrawRange(0, Math.floor(d * path.index.count))
    }
    if (instRef.current && !instRef.current.userData.done) {
      const dummy = new THREE.Object3D()
      cities.forEach((c, i) => {
        dummy.position.set(c.x, c.y, c.z + c.h / 2)
        dummy.scale.set(c.w, c.w, c.h)
        dummy.updateMatrix()
        instRef.current.setMatrixAt(i, dummy.matrix)
      })
      instRef.current.instanceMatrix.needsUpdate = true
      instRef.current.userData.done = true
    }
  })

  return (
    <group
      ref={group}
      position={[item.pos[0], item.pos[1], 0.1]}
      rotation={[0, 0, item.rot]}
      scale={[1, 1, 0]}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0.02} flatShading />
      </mesh>

      <instancedMesh
        ref={instRef}
        args={[cityGeo, undefined, Math.max(1, cities.length)]}
        castShadow
      >
        <meshStandardMaterial color="#d8d2bc" roughness={0.6} emissive="#3a2f1c" />
      </instancedMesh>

      {/* Location pin */}
      <group position={[pin.x, pin.y, pin.z]}>
        <mesh position={[0, 0, 0.34]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.34, 10]} />
          <meshStandardMaterial color="#c8342b" emissive="#5a1210" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.56]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshBasicMaterial color="#ff6a58" toneMapped={false} />
        </mesh>
      </group>

      <mesh ref={flight} geometry={path}>
        <meshBasicMaterial color="#8fd7ff" transparent opacity={0} toneMapped={false} />
      </mesh>
    </group>
  )
}
