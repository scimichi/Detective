import { useRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Rig from './Rig.jsx'
import Post from './Post.jsx'
import Board from './Board.jsx'
import CaseCloud from './CaseCloud.jsx'
import Warehouse from './Warehouse.jsx'
import Strings from './Strings.jsx'
import Dust from './Dust.jsx'
import { useStore } from '../state/store.js'
import { CASES } from '../data/index.js'

/**
 * The whole site, as one scene graph. Nothing here mounts or unmounts because
 * of a URL — the only thing that changes is which part of the room is built.
 */
export default function Experience() {
  const phase = useStore((s) => s.phase)
  const caseId = useStore((s) => s.caseId)
  const data = caseId ? CASES[caseId] : null

  return (
    <>
      <color attach="background" args={['#010101']} />
      <fogExp2 attach="fog" args={['#05050a', 0.0021]} />

      <Rig />

      <Suspense fallback={null}>
        {phase === 'intro' && <IntroScene />}
        {phase === 'cloud' && <CaseCloud />}
        {phase === 'board' && data && (
          <>
            <Board data={data} />
            <Warehouse />
          </>
        )}
      </Suspense>

      <Post />
    </>
  )
}

/**
 * The homepage. Dust, and one red string being drawn between two points that
 * are not there — the same verlet solver the boards use, with two anchors and
 * nothing pinned to them.
 */
function IntroScene() {
  const anchors = useRef(
    new Map([
      ['a', new THREE.Vector3(-7, 2.2, -1)],
      ['b', new THREE.Vector3(7, -1.6, -1)],
    ]),
  )
  const links = useRef([{ from: 'a', to: 'b', kind: 'default' }])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const a = anchors.current.get('a')
    const b = anchors.current.get('b')
    // The invisible points wander, so the thread is never at rest.
    a.set(-7 + Math.sin(t * 0.17) * 1.6, 2.2 + Math.sin(t * 0.23 + 1.1) * 1.1, -1)
    b.set(7 + Math.sin(t * 0.13 + 2.4) * 1.4, -1.6 + Math.cos(t * 0.19) * 1.3, -1)
  })

  return (
    <group>
      <ambientLight intensity={0.06} color="#5a6a86" />
      <Dust />
      <Strings links={links.current} anchors={anchors} />
    </group>
  )
}
