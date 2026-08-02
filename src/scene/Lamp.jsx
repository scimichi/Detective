import { useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { QUALITY_TIERS } from '../constants.js'

/**
 * One practical light, swinging on its flex.
 *
 * Everything else in the room is lit by it, so every shadow on the board
 * moves — the strings' shadows sweep across the paper, the corners of
 * overlapping documents crawl, and the board is never twice the same.
 *
 * The visible shaft is a cone with an analytic falloff rather than a
 * raymarched volume: at this scale the difference is invisible and the cost
 * difference is not.
 */
const Lamp = forwardRef(function Lamp(_, ref) {
  const pivot = useRef()
  const head = useRef()
  const spot = useRef()
  const shaft = useRef()
  const quality = useStore((s) => s.quality)
  const lens = useStore((s) => s.lens)
  const lensRef = useRef('none')
  lensRef.current = lens
  const tier = QUALITY_TIERS[quality]

  useImperativeHandle(ref, () => head.current, [])

  const shaftUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: tier.godRays },
      uColor: { value: new THREE.Color('#ffc98a') },
    }),
    [tier.godRays],
  )

  // Imperative, so the frame loop's mutations reach the compiled program.
  const shaftMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: shaftUniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
      }),
    [shaftUniforms],
  )
  useEffect(() => () => shaftMaterial.dispose(), [shaftMaterial])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    shaftUniforms.uTime.value = t
    shaftUniforms.uIntensity.value +=
      ((lensRef.current === 'none' ? tier.godRays : tier.godRays * 0.1) -
        shaftUniforms.uIntensity.value) *
      0.06

    if (pivot.current) {
      // A pendulum with a second, slower axis — a lamp on a flex never
      // swings in a plane for long.
      pivot.current.rotation.z = Math.sin(t * 0.44) * 0.085 + Math.sin(t * 0.17) * 0.03
      pivot.current.rotation.x = Math.sin(t * 0.31 + 1.1) * 0.05
    }
    if (spot.current && head.current) {
      // Keep the cone pointed at the board no matter where the head swung.
      spot.current.target.position.set(0, 0, 0)
      spot.current.target.updateMatrixWorld()
      // Filament flicker, mostly steady with an occasional dip.
      const flick =
        1 + Math.sin(t * 31.0) * 0.012 + (Math.sin(t * 2.3) > 0.985 ? -0.14 : 0)
      const dim = lensRef.current === 'none' ? 1 : 0.1
      spot.current.intensity = 95 * flick * dim
    }
  })

  return (
    <group ref={pivot} position={[-1.4, 9.6, 5.6]}>
      {/* Flex */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 2.4, 6]} />
        <meshStandardMaterial color="#141210" roughness={0.9} />
      </mesh>

      <group ref={head} position={[0, -2.4, 0]}>
        {/* Shade */}
        <mesh castShadow>
          <coneGeometry args={[0.78, 0.86, 26, 1, true]} />
          <meshStandardMaterial
            color="#2b2620"
            roughness={0.55}
            metalness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inside of the shade, catching the bulb */}
        <mesh scale={0.97}>
          <coneGeometry args={[0.76, 0.84, 26, 1, true]} />
          <meshBasicMaterial color="#7a5a34" side={THREE.BackSide} />
        </mesh>
        {/* Bulb — small, bright, and the anchor for bloom */}
        <mesh position={[0, -0.3, 0]}>
          <sphereGeometry args={[0.13, 14, 12]} />
          <meshBasicMaterial color="#ffe6bd" toneMapped={false} />
        </mesh>

        {/* Wide and very soft. A shade throws a bright core and a long spill;
            modelling only the core leaves two thirds of the board in the
            dark, which looks like a bug rather than like night. */}
        <spotLight
          ref={spot}
          position={[0, -0.28, 0]}
          angle={0.98}
          penumbra={0.72}
          distance={70}
          decay={1.45}
          intensity={95}
          color="#ffcf9a"
          castShadow
          shadow-mapSize-width={tier.shadowMap}
          shadow-mapSize-height={tier.shadowMap}
          shadow-bias={-0.0006}
          shadow-normalBias={0.022}
          shadow-camera-near={0.6}
          shadow-camera-far={40}
        />

        {/* The visible shaft of light */}
        <mesh ref={shaft} position={[0, -6.2, 0]} material={shaftMaterial} renderOrder={2}>
          <coneGeometry args={[5.6, 12.4, 40, 20, true]} />
        </mesh>
      </group>
    </group>
  )
})

export default Lamp

const SHAFT_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vViewDir;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const SHAFT_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3  uColor;
  varying vec3 vLocal;
  varying vec3 vViewDir;

  // Cheap value noise — the shaft needs texture, not accuracy.
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }

  void main() {
    // Cone local space: y runs from +h/2 at the apex to -h/2 at the mouth.
    float h = 12.4;
    float t = clamp((vLocal.y + h * 0.5) / h, 0.0, 1.0);

    // Bright at the bulb, thinning toward the floor.
    float along = pow(1.0 - t, 1.6);

    // Radial softness so the cone has no hard silhouette edge.
    float radius = length(vLocal.xz);
    float maxR = mix(5.6, 0.05, t);
    float radial = 1.0 - smoothstep(maxR * 0.25, maxR, radius);

    // Grazing angles read denser — that is what sells it as a volume.
    float graze = pow(1.0 - abs(dot(normalize(vViewDir), vec3(0.0, 1.0, 0.0))), 1.5);

    // Drifting motes of density inside the beam.
    float n = noise(vLocal * 0.55 + vec3(0.0, uTime * 0.25, uTime * 0.06));
    n = 0.62 + n * 0.5;

    float a = along * radial * n * (0.35 + graze * 0.75) * 0.11 * uIntensity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`
