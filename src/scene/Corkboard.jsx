import { useMemo } from 'react'
import * as THREE from 'three'
import { BOARD } from '../constants.js'
import { makeCorkTexture, makeCorkBump, makeWoodTexture } from '../gfx/room.js'

/** The surface everything is pinned to. Receives every shadow in the room. */
export default function Corkboard() {
  const cork = useMemo(() => makeCorkTexture(1024), [])
  const bump = useMemo(() => makeCorkBump(512), [])
  const wood = useMemo(() => makeWoodTexture(512), [])

  const W = BOARD.width
  const H = BOARD.height
  const frame = 0.55

  const rails = [
    { pos: [0, H / 2 + frame / 2, 0.1], size: [W + frame * 2, frame, 0.42] },
    { pos: [0, -H / 2 - frame / 2, 0.1], size: [W + frame * 2, frame, 0.42] },
    { pos: [-W / 2 - frame / 2, 0, 0.1], size: [frame, H, 0.42] },
    { pos: [W / 2 + frame / 2, 0, 0.1], size: [frame, H, 0.42] },
  ]

  return (
    <group>
      <mesh receiveShadow position={[0, 0, BOARD.z]}>
        <planeGeometry args={[W, H, 1, 1]} />
        <meshStandardMaterial
          map={cork}
          bumpMap={bump}
          bumpScale={0.35}
          roughness={0.97}
          metalness={0}
        />
      </mesh>

      {rails.map((r, i) => (
        <mesh key={i} position={r.pos} castShadow receiveShadow>
          <boxGeometry args={r.size} />
          <meshStandardMaterial map={wood} roughness={0.7} metalness={0.05} color="#6a4a30" />
        </mesh>
      ))}

      {/* Backing board. Kept only a little larger than the cork: any bigger
          and, once you have pulled back into the warehouse, it reads as a
          black hole punched in the wall of other boards. */}
      <mesh position={[0, 0, -0.35]} receiveShadow>
        <planeGeometry args={[W + 2.2, H + 2.2]} />
        <meshStandardMaterial color="#0d0c0b" roughness={1} side={THREE.FrontSide} />
      </mesh>
    </group>
  )
}
