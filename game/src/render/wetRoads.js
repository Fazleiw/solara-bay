// Rain-slick streets after dark: the city is rendered a second time from a camera mirrored in
// the road plane (y = 0) into a half-resolution target, and the asphalt materials sample it with
// a little ripple, a Fresnel falloff and patchy puddles, so neon signs, lit windows, headlights
// and police light bars smear across the wet road. Wetness follows the night factor.
import * as THREE from 'three';

const PATCH_VERT_HEAD = /* glsl */`
  uniform mat4 uReflectMatrix;
  varying vec4 vReflectUv;
  varying vec3 vWetWorld;
`;
const PATCH_VERT_BODY = /* glsl */`
  vec4 wetWorld = modelMatrix * vec4(transformed, 1.0);
  vWetWorld = wetWorld.xyz;
  vReflectUv = uReflectMatrix * wetWorld;
`;
const PATCH_FRAG_HEAD = /* glsl */`
  uniform sampler2D tReflect;
  uniform float uWet;
  varying vec4 vReflectUv;
  varying vec3 vWetWorld;
  float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wetNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(wetHash(i), wetHash(i + vec2(1.0, 0.0)), f.x), mix(wetHash(i + vec2(0.0, 1.0)), wetHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;
const PATCH_FRAG_BODY = /* glsl */`
  if (uWet > 0.001) {
    // Puddles: low-frequency patches that are glassy, the rest is a duller damp sheen.
    float puddle = smoothstep(0.42, 0.62, wetNoise(vWetWorld.xz * 0.11) * 0.7 + wetNoise(vWetWorld.xz * 0.37) * 0.3);
    vec2 ripple = vec2(wetNoise(vWetWorld.xz * 1.7) - 0.5, wetNoise(vWetWorld.zx * 1.9 + 7.0) - 0.5) * mix(0.012, 0.003, puddle);
    vec2 ruv = vReflectUv.xy / vReflectUv.w + ripple;
    // Wet asphalt smears each light into a vertical streak; puddles keep it crisper.
    float streak = mix(0.016, 0.005, puddle);
    vec3 refl = texture2D(tReflect, ruv).rgb * 0.24;
    refl += texture2D(tReflect, ruv + vec2(0.0, streak)).rgb * 0.2;
    refl += texture2D(tReflect, ruv - vec2(0.0, streak)).rgb * 0.2;
    refl += texture2D(tReflect, ruv + vec2(0.0, streak * 2.2)).rgb * 0.13;
    refl += texture2D(tReflect, ruv - vec2(0.0, streak * 2.2)).rgb * 0.13;
    refl += texture2D(tReflect, ruv + vec2(0.0, streak * 3.6)).rgb * 0.05;
    refl += texture2D(tReflect, ruv - vec2(0.0, streak * 3.6)).rgb * 0.05;
    float facing = clamp(dot(normalize(vViewPosition), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0, 1.0);
    float fresnel = 0.18 + 0.82 * pow(1.0 - facing, 4.0);
    float amount = uWet * fresnel * mix(0.55, 1.0, puddle);
    outgoingLight = outgoingLight * (1.0 - uWet * 0.3) + refl * amount;
  }
`;

/** Patches a road material so it reflects the mirrored city through `shared` uniforms. */
function makeWet(material, shared) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PATCH_VERT_HEAD}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${PATCH_VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PATCH_FRAG_HEAD}`)
      .replace('#include <opaque_fragment>', `${PATCH_FRAG_BODY}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'wet-road';
  material.needsUpdate = true;
}

export function createWetRoads(renderer, scene, materials) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 2 });
  const mirror = new THREE.PerspectiveCamera();
  const shared = {
    tReflect: { value: target.texture },
    uReflectMatrix: { value: new THREE.Matrix4() },
    uWet: { value: 0 },
  };
  for (const m of [materials.road, materials.crossing]) makeWet(m, shared);
  // Keep only what stands above the road surface: the road itself, lamp pools and headlight
  // splashes on it, and everything below ground never reach the mirror.
  const clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1)];
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const forward = new THREE.Vector3();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3();
  const settings = { wetness: 0, enabled: true };

  function setSize(width, height) {
    target.setSize(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
  }

  /** Renders the mirrored city into the reflection target (call before the main render). */
  function render(camera) {
    shared.uWet.value = settings.enabled ? settings.wetness : 0;
    if (shared.uWet.value < 0.01) return;
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);
    mirror.position.copy(camera.position).setY(-camera.position.y);
    look.copy(camera.position).addScaledVector(forward, 10).multiply({ x: 1, y: -1, z: 1 });
    up.set(0, 1, 0).applyQuaternion(camera.quaternion).multiply({ x: 1, y: -1, z: 1 });
    mirror.up.copy(up);
    mirror.lookAt(look);
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    mirror.updateMatrixWorld();
    mirror.matrixWorldInverse.copy(mirror.matrixWorld).invert();
    shared.uReflectMatrix.value.copy(bias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);

    const autoShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.clippingPlanes = clip;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, mirror);
    renderer.clippingPlanes = [];
    renderer.shadowMap.autoUpdate = autoShadow;
  }

  return { render, setSize, settings, uniforms: shared };
}
