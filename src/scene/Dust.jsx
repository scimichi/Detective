import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { nav } from './nav.js'
import { useStore } from '../state/store.js'
import { QUALITY_TIERS } from '../constants.js'

/**
 * Dust.
 *
 * Every mote's position is computed in the vertex shader from a seed and the
 * clock — the CPU never touches a particle. That is what makes the count a
 * quality dial rather than a design decision, and it is why the field can
 * follow the camera forever: the box wraps in shader space, so there is no
 * edge to the dust anywhere in the warehouse.
 *
 * Motes are only *lit* inside the lamp cone. Outside it they are still there,
 * still moving, and invisible — which is exactly how a dark room behaves.
 */
export default function Dust({ lampRef }) {
  const quality = useStore((s) => s.quality)
  const count = QUALITY_TIERS[quality].dust
  const points = useRef()
  const push = useRef(new THREE.Vector3())

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const seeds = new Float32Array(count * 3)
    const rands = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      seeds[i * 3] = Math.random()
      seeds[i * 3 + 1] = Math.random()
      seeds[i * 3 + 2] = Math.random()
      rands[i * 4] = Math.random()
      rands[i * 4 + 1] = Math.random()
      rands[i * 4 + 2] = Math.random()
      // Mass: heavy motes resist the air you push at them.
      rands[i * 4 + 3] = 0.25 + Math.random() * 0.75
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rands, 4))
    // Position is unused but three wants it for the draw range.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    return g
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uPush: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(46, 30, 42) },
      uLampPos: { value: new THREE.Vector3(-1.4, 7.2, 5.2) },
      uLampDir: { value: new THREE.Vector3(0.1, -1, -0.35).normalize() },
      uConeCos: { value: Math.cos(0.62) },
      uAmbient: { value: 0.05 },
      uSize: { value: 1 },
      uPixelRatio: { value: 1 },
      uTint: { value: new THREE.Color('#ffdcae') },
    }),
    [],
  )

  // Built imperatively rather than as a <shaderMaterial> element: passing a
  // uniforms object through JSX does not guarantee the material keeps that
  // exact object, and every one of these systems animates by mutating it.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [uniforms],
  )
  useEffect(() => () => material.dispose(), [material])

  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta)
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uCamPos.value.copy(state.camera.position)
    uniforms.uPixelRatio.value = state.gl.getPixelRatio()

    // Air displacement trails the camera and settles — moving fast shoves
    // the motes aside, and they drift back when you stop.
    push.current.lerp(nav.vel, 1 - Math.exp(-2.6 * dt))
    uniforms.uPush.value.copy(push.current).clampLength(0, 26)

    if (lampRef?.current) {
      lampRef.current.getWorldPosition(uniforms.uLampPos.value)
      const target = new THREE.Vector3(0, -1, 0).add(uniforms.uLampPos.value)
      uniforms.uLampDir.value.copy(target).sub(uniforms.uLampPos.value).normalize()
    }
  })

  return (
    <points
      ref={points}
      frustumCulled={false}
      geometry={geometry}
      material={material}
      renderOrder={3}
    />
  )
}

const VERT = /* glsl */ `
  attribute vec3 aSeed;
  attribute vec4 aRand;

  uniform float uTime;
  uniform vec3  uCamPos;
  uniform vec3  uPush;
  uniform vec3  uBox;
  uniform vec3  uLampPos;
  uniform vec3  uLampDir;
  uniform float uConeCos;
  uniform float uAmbient;
  uniform float uSize;
  uniform float uPixelRatio;

  varying float vLight;
  varying float vAlpha;

  void main() {
    float t = uTime;
    vec3 p = aSeed * uBox - uBox * 0.5;

    // Lazy convection. Three incommensurate frequencies per axis so the
    // field never resolves into a visible pattern.
    float m = aRand.w;
    p.x += sin(t * (0.11 + aRand.x * 0.17) + aRand.y * 24.0) * (0.7 + aRand.z);
    p.y += sin(t * (0.07 + aRand.y * 0.12) + aRand.z * 31.0) * (0.5 + aRand.x * 0.8)
         + mod(t * (0.012 + aRand.z * 0.03), 1.0) * 0.0;
    p.z += cos(t * (0.09 + aRand.z * 0.14) + aRand.x * 17.0) * (0.6 + aRand.y);

    // Slow settle, so the room feels like it has gravity.
    p.y -= mod(t * (0.05 + aRand.x * 0.09), uBox.y);

    // Air pushed by the camera. Heavy motes lag.
    p -= uPush * (0.055 / m);

    // Wrap the box around the camera: an endless field with a finite buffer.
    vec3 rel = p - uCamPos;
    rel = mod(rel + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 world = uCamPos + rel;

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    float dist = -mv.z;

    // Lamp cone: motes are only visible where the light actually is.
    vec3 toMote = world - uLampPos;
    float d = length(toMote);
    float cosA = dot(normalize(toMote), uLampDir);
    float cone = smoothstep(uConeCos, uConeCos + 0.22, cosA);
    float falloff = 1.0 / (1.0 + d * d * 0.02);
    vLight = cone * falloff * 5.0 + uAmbient;

    // Fade at both ends: nothing pops in at the far plane, nothing smears
    // across the lens when it passes through the near plane.
    vAlpha = smoothstep(0.25, 1.6, dist) * (1.0 - smoothstep(24.0, 42.0, dist));

    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (14.0 + aRand.y * 22.0) / max(dist, 0.2);
    gl_PointSize = clamp(gl_PointSize, 0.6, 26.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uTint;
  varying float vLight;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    // Soft round mote with a hot centre so bloom has something to catch.
    float a = (1.0 - r * 4.0);
    a *= a;
    float i = vLight * vAlpha * a;
    if (i < 0.002) discard;
    gl_FragColor = vec4(uTint * i, i * 0.9);
  }
`
