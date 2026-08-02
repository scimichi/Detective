import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { nav } from './nav.js'
import { DIST, BOARD } from '../constants.js'
import { makeConcreteTexture } from '../gfx/room.js'

/**
 * Pull far enough back and the board stops being the world.
 *
 * The other boards are one instanced draw with all motion and fading in the
 * vertex shader. They cost nothing until you are far enough away to see them,
 * and they are deliberately never resolvable — every one of them is a case
 * you are not looking at.
 */
export default function Warehouse() {
  const COLS = 34
  const ROWS = 16
  const DEPTH = 9
  const count = COLS * ROWS * DEPTH

  const floor = useMemo(() => makeConcreteTexture(512), [])

  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(BOARD.width, BOARD.height)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.attributes.position = base.attributes.position
    g.attributes.uv = base.attributes.uv

    const offset = new Float32Array(count * 3)
    const misc = new Float32Array(count * 3)
    let n = 0
    const spanX = BOARD.width + 18
    const spanY = BOARD.height + 11
    const spanZ = 52

    for (let z = 0; z < DEPTH; z++) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const ox = (x - (COLS - 1) / 2) * spanX
          const oy = (y - (ROWS - 1) / 2) * spanY
          const oz = -z * spanZ - spanZ
          // Leave the middle of the front rank empty — that slot is the
          // board you are standing in front of.
          if (z === 0 && Math.abs(ox) < spanX * 0.6 && Math.abs(oy) < spanY * 0.6) continue
          offset[n * 3] = ox
          offset[n * 3 + 1] = oy
          offset[n * 3 + 2] = oz
          misc[n * 3] = Math.random() // string density
          misc[n * 3 + 1] = Math.random() * 6.283 // phase
          misc[n * 3 + 2] = 0.55 + Math.random() * 0.6 // brightness
          n++
        }
      }
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset.slice(0, n * 3), 3))
    g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc.slice(0, n * 3), 3))
    g.instanceCount = n
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -260), 1800)
    return g
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    }),
    [],
  )

  // Imperative material: the animated uniforms must stay the same object the
  // frame loop mutates, which a JSX <shaderMaterial> does not guarantee.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: WH_VERT,
        fragmentShader: WH_FRAG,
      }),
    [uniforms],
  )
  useEffect(() => () => material.dispose(), [material])

  const groupRef = useRef()

  useFrame((state, delta) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uCam.value.copy(state.camera.position)
    // Reveal is driven purely by how far back you have pulled.
    const want = THREE.MathUtils.clamp(
      (nav.cur.z - DIST.boardExit) / (DIST.warehouse - DIST.boardExit),
      0,
      1,
    )
    uniforms.uReveal.value += (want - uniforms.uReveal.value) * (1 - Math.exp(-2.4 * Math.min(0.05, delta)))
    if (groupRef.current) groupRef.current.visible = uniforms.uReveal.value > 0.004
  })

  return (
    <group ref={groupRef} visible={false}>
      <mesh
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={-1}
      />

      {/* Floor, far below, so the space has a bottom. */}
      {/* Unlit on purpose: nothing in this room reaches the floor, and the
          fog is what gives it depth. */}
      <mesh position={[0, -235, -300]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshBasicMaterial map={floor} color="#14130f" fog />
      </mesh>
    </group>
  )
}

const WH_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aMisc;
  uniform float uTime;
  uniform float uReveal;
  uniform vec3  uCam;

  varying vec2  vUv;
  varying float vBright;
  varying float vSeed;
  varying float vFade;

  void main() {
    vUv = uv;
    vSeed = aMisc.x;
    vBright = aMisc.z;

    vec3 world = position + aOffset;
    // The whole rank sways a little, as if the room has air moving in it.
    world.x += sin(uTime * 0.12 + aMisc.y) * 0.35;
    world.y += cos(uTime * 0.09 + aMisc.y) * 0.22;

    float d = distance(world, uCam);
    // Boards materialise out of the dark as you retreat, and only within a
    // radius — the warehouse is always bigger than what you can see of it.
    vFade = uReveal * (1.0 - smoothstep(620.0, 1500.0, d)) * smoothstep(26.0, 78.0, d);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
  }
`

const WH_FRAG = /* glsl */ `
  precision highp float;
  varying vec2  vUv;
  varying float vBright;
  varying float vSeed;
  varying float vFade;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main() {
    if (vFade < 0.004) discard;

    // Cork.
    vec3 col = vec3(0.16, 0.11, 0.065);

    // Scraps of paper, laid out on an irregular grid.
    vec2 g = floor(vUv * vec2(9.0, 6.0));
    float h = hash(g + vSeed * 37.0);
    vec2 f = fract(vUv * vec2(9.0, 6.0));
    float card = step(0.18, f.x) * step(f.x, 0.82) * step(0.2, f.y) * step(f.y, 0.8);
    if (h > 0.42) col = mix(col, vec3(0.44, 0.41, 0.34), card * (0.5 + h * 0.5));

    // Red string, still visible when everything else has gone to mud.
    float s = hash(g * 1.7 + vSeed * 11.0);
    if (s > 0.72) {
      float line = smoothstep(0.06, 0.0, abs(f.y - f.x * 0.7 - 0.15));
      col += vec3(0.55, 0.08, 0.06) * line * vSeed;
    }

    float a = vFade * vBright * 0.85;
    gl_FragColor = vec4(col * (0.4 + vBright * 0.6), a);
  }
`
