import * as THREE from 'three'

/**
 * Evidence surfaces are ordinary lit, shadow-receiving standard materials —
 * they have to be, or the desk lamp stops meaning anything — with two extra
 * jobs patched into the compiled shader:
 *
 *   1. A hidden layer (bleached writing, latent prints, what was under the
 *      marker) that only exists inside the flashlight cone.
 *   2. A world-space position varying, so that cone is a real volume in the
 *      room rather than a screen-space circle.
 */
export function makeEvidenceMaterial(map) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0.0,
    // Double-sided so a card tumbling between board and graph layouts never
    // shows a hole where its back should be.
    side: THREE.DoubleSide,
    transparent: false,
  })

  mat.userData.uniforms = {
    uHidden: { value: null },
    uHasHidden: { value: 0 },
    uLens: { value: 0 }, // 0 none, 1 uv, 2 ir
    uFlashPos: { value: new THREE.Vector3(0, 0, 0) },
    uFlashRadius: { value: 1.6 },
    uFlashOn: { value: 0 },
    uSelect: { value: 0 },
    uAge: { value: 0 }, // 0 = pristine restoration, 1 = as-found
  }

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vEvWorld;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vEvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vEvWorld;
         uniform sampler2D uHidden;
         uniform float uHasHidden;
         uniform float uLens;
         uniform vec3  uFlashPos;
         uniform float uFlashRadius;
         uniform float uFlashOn;
         uniform float uSelect;
         uniform float uAge;`,
      )
      // Ageing: the year slider literally bleaches and yellows the print.
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         {
           float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
           vec3 aged = mix(diffuseColor.rgb, vec3(lum) * vec3(1.06, 0.97, 0.82), uAge * 0.55);
           // Old material also loses contrast, not just colour.
           aged = mix(aged, vec3(lum * 0.85 + 0.14), uAge * 0.3);
           diffuseColor.rgb = aged;
         }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         if (uLens > 0.5 && uHasHidden > 0.5) {
           float d = distance(vEvWorld, uFlashPos);
           float cone = 1.0 - smoothstep(uFlashRadius * 0.35, uFlashRadius, d);
           cone *= uFlashOn;
           vec3 h = texture2D(uHidden, vMapUv).rgb;
           // Ultraviolet fluoresces cold; infrared reads as a hot monochrome.
           vec3 tint = uLens < 1.5 ? vec3(0.52, 0.72, 1.0) : vec3(1.0, 0.42, 0.28);
           totalEmissiveRadiance += h * tint * cone * 4.5;
           // The beam itself lifts the paper enough to see where it lands.
           totalEmissiveRadiance += tint * 0.16 * cone;
         }
         totalEmissiveRadiance += vec3(0.85, 0.28, 0.22) * uSelect * 0.35;`,
      )

    mat.userData.shader = shader
  }

  // Distinguish the patched program from an unpatched standard material.
  mat.customProgramCacheKey = () => 'evidence-v1'
  return mat
}

/** Cheap per-frame uniform push; the material may not have compiled yet. */
export function setEvidenceUniforms(mat, values) {
  const u = mat.userData.uniforms
  if (!u) return
  for (const k in values) {
    if (!u[k]) continue
    if (u[k].value?.isVector3 && values[k]?.isVector3) u[k].value.copy(values[k])
    else u[k].value = values[k]
  }
}
