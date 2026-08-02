import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ChromaticAberration,
  Noise,
  Vignette,
  SSAO,
  BrightnessContrast,
  HueSaturation,
} from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from '../state/store.js'
import { QUALITY_TIERS } from '../constants.js'
import { nav } from './nav.js'

/**
 * The grade.
 *
 * The single most important element here is the depth of field, because it is
 * doing narrative work rather than decorative work: it tells you what you are
 * looking at. Its focus distance is tied to the camera's distance from the
 * board, so leaning toward a document brings that document — and only that
 * document — into focus, and everything pinned around it falls away.
 */
export default function Post() {
  const quality = useStore((s) => s.quality)
  const tier = QUALITY_TIERS[quality]
  const dof = useRef()
  // The effect keeps this exact Vector2 in its uniform, so mutating it in
  // place is all that's needed — no ref, no re-render.
  const caOffset = useMemo(() => new THREE.Vector2(0.00035, 0.00028), [])

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)

    if (dof.current?.circleOfConfusionMaterial) {
      const coc = dof.current.circleOfConfusionMaterial
      // focusDistance and focusRange are both in world units here, so the
      // focal plane can simply be *where the camera is looking*.
      const want = Math.max(0.4, nav.focusDistance)
      const k = 1 - Math.exp(-5 * dt)
      coc.focusDistance += (want - coc.focusDistance) * k

      // Up close the depth of field is paper-thin; across the room it opens
      // out so the whole board stays legible.
      const range = THREE.MathUtils.clamp(want * 0.16, 0.09, 6)
      coc.focusRange += (range - coc.focusRange) * k

      const bokeh = THREE.MathUtils.clamp(5.5 - want * 0.2, 1.2, 5.5)
      dof.current.bokehScale += (bokeh - dof.current.bokehScale) * 0.06
    }

    // Aberration blooms with motion — the lens complaining about the pan.
    const amt = 0.00035 + Math.min(0.0022, nav.speed * 0.00022)
    caOffset.set(amt, amt * 0.8)
  })

  return (
    <EffectComposer multisampling={0} enableNormalPass={tier.ssao} depthBuffer>
      {tier.ssao ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={19}
          rings={4}
          radius={0.12}
          intensity={22}
          luminanceInfluence={0.55}
          distanceThreshold={0.4}
          distanceFalloff={0.12}
          rangeThreshold={0.001}
          rangeFalloff={0.008}
          bias={0.028}
          worldDistanceThreshold={12}
          worldDistanceFalloff={4}
          worldProximityThreshold={0.6}
          worldProximityFalloff={0.2}
          color={new THREE.Color('#0a0806')}
        />
      ) : (
        <></>
      )}

      <Bloom
        intensity={0.72}
        luminanceThreshold={0.42}
        luminanceSmoothing={0.35}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      {tier.dof ? (
        <DepthOfField
          ref={dof}
          focusDistance={18}
          focusRange={3}
          bokehScale={3.2}
          resolutionScale={0.5}
        />
      ) : (
        <></>
      )}

      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={caOffset}
        radialModulation
        modulationOffset={0.4}
      />

      <HueSaturation saturation={-0.06} />
      <BrightnessContrast brightness={-0.012} contrast={0.11} />

      {/* Film grain, and the vignette of a lens that was never very good. */}
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.42} />
      <Vignette eskil={false} offset={0.24} darkness={0.86} />
    </EffectComposer>
  )
}
