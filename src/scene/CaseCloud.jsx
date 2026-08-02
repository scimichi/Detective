import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { renderCaseCard } from '../gfx/caseCard.js'
import { CASE_LIST } from '../data/index.js'
import { useStore } from '../state/store.js'
import { nav, flyTo, resetNav } from './nav.js'
import { audio } from '../audio/soundscape.js'
import { startArchiveTour, startCaseTour, stopTour } from './tour.js'
import Dust from './Dust.jsx'

/**
 * The opening.
 *
 * Thousands of evidence cards drift in the dark, all of them anonymous. Six
 * of them are the cases that actually exist. The camera flies through the
 * field on entry; after that you steer.
 *
 * The anonymous field is a single instanced draw whose motion is entirely in
 * the vertex shader, which is why the count can be in the thousands without
 * the CPU knowing about any of it.
 */
export default function CaseCloud() {
  const phase = useStore((s) => s.phase)
  const openCase = useStore((s) => s.openCase)
  const hoverId = useStore((s) => s.hoverId)
  const hover = useStore((s) => s.hover)
  const guided = useStore((s) => s.guided)
  // A ref rather than state: it survives React's development-mode double
  // invocation of effects, which otherwise fires the entry flight twice and
  // can leave the camera stranded at its start point with no tween running.
  const entered = useRef(false)

  const cards = useMemo(
    () =>
      CASE_LIST.map((c, i) => {
        // A shallow arc, so no card fully hides another.
        const a = (i - (CASE_LIST.length - 1) / 2) * 0.42
        return {
          data: c,
          pos: [Math.sin(a) * 22, Math.cos(a * 1.7) * 2.2 - 0.6, -Math.abs(a) * 7.5 - 2],
          rot: -a * 0.55,
        }
      }),
    [],
  )

  // The entry flight: out of nowhere, into the field. Driven through flyTo so
  // there is exactly one authority over the camera target — a bare tween here
  // could be left racing against one started somewhere else.
  useEffect(() => {
    if (phase !== 'cloud' || entered.current) return
    entered.current = true
    resetNav(150)
    flyTo(0, 0, 26, 7.5, 'power2.out')
    // The narration rides the entry flight rather than following it.
    if (guided) setTimeout(() => startArchiveTour(), 1200)
  }, [phase, guided])

  const onPick = (c, pos) => {
    if (nav.dragged) return
    audio.rustle(0.08)
    // Whatever the archive narration was saying, this supersedes it.
    stopTour(true)
    useStore.setState({ tourActive: false, tourPrompt: false, caption: '' })
    // Dive into the board: aim at the card, then hand over to the corkboard.
    flyTo(pos[0] * 0.35, pos[1] * 0.35, 3.2, 1.9, 'power3.in')
    setTimeout(() => {
      openCase(c.id)
      resetNav(46)
      flyTo(0, 0, 22, 2.6, 'power2.out')
      if (guided) setTimeout(() => startCaseTour(c.id), 2200)
    }, 1750)
  }

  return (
    <group>
      {/* The six real cases have to be legible from anywhere in the arc, and
          they are spread over forty units — so the ambient does the reading
          and the two practicals only do the modelling. */}
      <ambientLight intensity={0.42} color="#8a94a8" />
      <pointLight position={[0, 8, 18]} intensity={520} distance={120} decay={2} color="#ffcf9a" />
      <pointLight position={[-24, -8, -6]} intensity={300} distance={120} decay={2} color="#2a4a72" />

      <CardField count={2200} />
      <Dust />

      {cards.map(({ data, pos, rot }) => (
        <CaseCard
          key={data.id}
          data={data}
          position={pos}
          rotation={rot}
          hovered={hoverId === data.id}
          onOver={() => hover(data.id)}
          onOut={() => hover(null)}
          onPick={() => onPick(data, pos)}
        />
      ))}
    </group>
  )
}

function CaseCard({ data, position, rotation, hovered, onOver, onOut, onPick }) {
  const ref = useRef()
  const glow = useRef()
  const texture = useMemo(() => renderCaseCard(data), [data])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(0.05, delta)
    if (!ref.current) return
    // Each card breathes on its own phase.
    const p = data.index * 1.7
    ref.current.position.y = position[1] + Math.sin(t * 0.36 + p) * 0.22
    ref.current.rotation.z = Math.sin(t * 0.23 + p) * 0.035
    ref.current.rotation.y = rotation + Math.sin(t * 0.19 + p) * 0.05

    const want = hovered ? 1.09 : 1
    const s = ref.current.scale.x + (want - ref.current.scale.x) * (1 - Math.exp(-8 * dt))
    ref.current.scale.setScalar(s)
    if (glow.current) {
      glow.current.material.opacity +=
        ((hovered ? 0.42 : 0.12) - glow.current.material.opacity) * (1 - Math.exp(-6 * dt))
    }
  })

  return (
    <group ref={ref} position={position}>
      {/* Accent halo, so the card reads as an object in the dark. */}
      <mesh ref={glow} position={[0, 0, -0.06]} scale={1.12}>
        <planeGeometry args={[4.5, 6]} />
        <meshBasicMaterial
          color={data.accent}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* A generous, invisible hit area in front of the card. The narrator
          tells people to click a card; the card should not be a precision
          target floating in a field of decoys that drift as you reach. */}
      <mesh
        position={[0, 0, 0.35]}
        onClick={(e) => {
          e.stopPropagation()
          onPick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onOver()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onOut()
          document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[5.4, 6.9]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh
        castShadow
        onClick={(e) => {
          e.stopPropagation()
          onPick()
        }}
      >
        <planeGeometry args={[4.2, 5.6, 8, 8]} />
        {/* A little self-illumination: a file cover you cannot read is not a
            choice, it is an obstacle. */}
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.42}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
    </group>
  )
}

/**
 * Every other mystery. Anonymous, uncountable, and never resolving into
 * anything you can read — which is the point.
 */
function CardField({ count }) {
  const geometry = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1.32)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.attributes.position = base.attributes.position
    g.attributes.uv = base.attributes.uv
    g.instanceCount = count

    const offset = new Float32Array(count * 3)
    const rot = new Float32Array(count * 3)
    const misc = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // A hollow shell of cards: dense enough to feel infinite, sparse in the
      // middle so the six real cases have room to exist.
      const r = 26 + Math.pow(Math.random(), 0.5) * 150
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(Math.random() * 2 - 1)
      offset[i * 3] = Math.sin(ph) * Math.cos(th) * r
      offset[i * 3 + 1] = (Math.random() * 2 - 1) * 46
      offset[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r - 40
      rot[i * 3] = Math.random() * 6.283
      rot[i * 3 + 1] = Math.random() * 6.283
      rot[i * 3 + 2] = Math.random() * 6.283
      misc[i * 3] = 0.8 + Math.random() * 2.6 // scale
      misc[i * 3 + 1] = Math.random() * 6.283 // phase
      misc[i * 3 + 2] = 0.25 + Math.random() * 0.75 // brightness
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3))
    g.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 3))
    g.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -40), 260)
    return g
  }, [count])

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } }),
    [],
  )

  // Imperative, so the frame loop's mutations reach the compiled program.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: FIELD_VERT,
        fragmentShader: FIELD_FRAG,
      }),
    [uniforms],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uCam.value.copy(state.camera.position)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}

const FIELD_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec3 aRot;
  attribute vec3 aMisc;

  uniform float uTime;
  uniform vec3  uCam;

  varying float vBright;
  varying vec2  vUv;
  varying float vDist;

  mat3 rotXYZ(vec3 r) {
    float cx = cos(r.x), sx = sin(r.x);
    float cy = cos(r.y), sy = sin(r.y);
    float cz = cos(r.z), sz = sin(r.z);
    return mat3(
      cy * cz, -cy * sz, sy,
      sx * sy * cz + cx * sz, -sx * sy * sz + cx * cz, -sx * cy,
      -cx * sy * cz + sx * sz, cx * sy * sz + sx * cz, cx * cy
    );
  }

  void main() {
    vUv = uv;
    float t = uTime * 0.06 + aMisc.y;
    vec3 r = aRot + vec3(sin(t) * 0.22, t * 0.35, cos(t * 0.8) * 0.18);
    vec3 local = rotXYZ(r) * (position * aMisc.x);
    vec3 world = local + aOffset + vec3(
      sin(uTime * 0.13 + aMisc.y) * 1.4,
      cos(uTime * 0.11 + aMisc.y * 1.7) * 1.1,
      sin(uTime * 0.09 + aMisc.y * 0.6) * 1.2
    );

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vDist = length(world - uCam);
    vBright = aMisc.z;
    gl_Position = projectionMatrix * mv;
  }
`

const FIELD_FRAG = /* glsl */ `
  precision highp float;
  varying float vBright;
  varying vec2  vUv;
  varying float vDist;

  void main() {
    // A card shape with a suggestion of print on it — never enough to read.
    vec2 p = abs(vUv - 0.5) * 2.0;
    float body = 1.0 - smoothstep(0.94, 1.0, max(p.x, p.y));
    float bars = step(0.5, fract(vUv.y * 14.0)) * step(vUv.x, 0.78) * step(0.14, vUv.x);
    float ink = mix(1.0, 0.55, bars * step(vUv.y, 0.72));

    // Everything fades into the dark; nothing in this field is ever in focus.
    float near = smoothstep(6.0, 26.0, vDist);
    float far  = 1.0 - smoothstep(90.0, 220.0, vDist);
    float a = body * near * far * vBright * 0.5;
    if (a < 0.004) discard;
    vec3 col = vec3(0.72, 0.68, 0.58) * ink;
    gl_FragColor = vec4(col * a, a);
  }
`
