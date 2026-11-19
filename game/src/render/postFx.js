// The post-processing pipeline: the scene renders into a multisampled HDR target, a dual-filter
// bloom (bright pass, four downsamples, four upsamples) makes the sun, neon, headlights and
// police light bars glow, and a final pass tone-maps (ACES filmic), grades the colour warm,
// adds a soft vignette and encodes to sRGB on the screen.
import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tInput;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float w = max(soft, l - uThreshold) / max(l, 1e-4);
    gl_FragColor = vec4(min(c * w, vec3(24.0)), 1.0);
  }
`;

const DOWN_FRAG = /* glsl */`
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(tInput, vUv).rgb * 4.0;
    sum += texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(1.0, -1.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(sum / 8.0, 1.0);
  }
`;

const UP_FRAG = /* glsl */`
  uniform sampler2D tInput;
  uniform sampler2D tBase;
  uniform vec2 uTexel;
  uniform float uMix;
  varying vec2 vUv;
  void main() {
    vec3 sum = vec3(0.0);
    sum += texture2D(tInput, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(2.0, 0.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(0.0, -2.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(0.0, 2.0)).rgb;
    sum += texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
    sum += texture2D(tInput, vUv + uTexel * vec2(1.0, -1.0)).rgb * 2.0;
    sum += texture2D(tInput, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 2.0;
    sum += texture2D(tInput, vUv + uTexel * vec2(1.0, 1.0)).rgb * 2.0;
    gl_FragColor = vec4(sum / 12.0 + texture2D(tBase, vUv).rgb * uMix, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloom;
  uniform float uExposure;
  uniform float uVignette;
  uniform vec3 uTint;
  uniform float uSaturation;
  uniform float uContrast;
  varying vec2 vUv;

  vec3 rrtOdtFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 acesFilmic(vec3 c) {
    const mat3 inputMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 outputMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    c *= uExposure / 0.6;
    c = inputMat * c;
    c = rrtOdtFit(c);
    c = outputMat * c;
    return clamp(c, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
  }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
    c *= uTint;
    c = acesFilmic(c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSaturation);
    // A gentle S-curve: deeper shadows and richer mids without clipping the highlights.
    c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);
    vec2 d = vUv - 0.5;
    c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
    gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
  }
`;

function makeTarget(w, h, samples = 0) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
}

export function createPostFx(renderer, scene) {
  const LEVELS = 5;
  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  const bright = pass(BRIGHT_FRAG, { tInput: { value: null }, uThreshold: { value: 1.0 }, uKnee: { value: 0.5 } });
  const down = pass(DOWN_FRAG, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = pass(UP_FRAG, { tInput: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
  const composite = pass(COMPOSITE_FRAG, {
    tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.22 }, uExposure: { value: 1 },
    uVignette: { value: 0.38 }, uTint: { value: new THREE.Color(1.04, 1.0, 0.95) }, uSaturation: { value: 1.16 }, uContrast: { value: 0.3 },
  });

  let sceneTarget = null;
  let downTargets = [];
  let upTargets = [];
  const settings = { enabled: true, bloom: 0.22, threshold: 1.0 };

  function setSize(width, height) {
    const pr = renderer.getPixelRatio();
    const w = Math.floor(width * pr), h = Math.floor(height * pr);
    sceneTarget?.dispose();
    for (const t of [...downTargets, ...upTargets]) t.dispose();
    sceneTarget = makeTarget(w, h, 4);
    downTargets = [];
    upTargets = [];
    for (let i = 0; i < LEVELS; i += 1) {
      const s = 2 ** (i + 1);
      downTargets.push(makeTarget(Math.ceil(w / s), Math.ceil(h / s)));
      upTargets.push(makeTarget(Math.ceil(w / s), Math.ceil(h / s)));
    }
  }

  function draw(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  /** Renders the scene through the bloom and grading passes to the screen. */
  function render(camera) {
    if (!settings.enabled || !sceneTarget) {
      api.prepass?.(camera);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    api.prepass?.(camera);
    renderer.setRenderTarget(sceneTarget);
    renderer.render(scene, camera);

    bright.uniforms.tInput.value = sceneTarget.texture;
    bright.uniforms.uThreshold.value = settings.threshold;
    draw(bright, downTargets[0]);
    for (let i = 1; i < LEVELS; i += 1) {
      const src = downTargets[i - 1];
      down.uniforms.tInput.value = src.texture;
      down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      draw(down, downTargets[i]);
    }
    let src = downTargets[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i -= 1) {
      up.uniforms.tInput.value = src.texture;
      up.uniforms.tBase.value = downTargets[i].texture;
      up.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
      draw(up, upTargets[i]);
      src = upTargets[i];
    }

    composite.uniforms.tScene.value = sceneTarget.texture;
    composite.uniforms.tBloom.value = upTargets[0].texture;
    composite.uniforms.uBloom.value = settings.bloom;
    composite.uniforms.uExposure.value = renderer.toneMappingExposure;
    draw(composite, null);
  }

  /** `prepass(camera)` runs before each scene render (the wet-road reflection). */
  const api = { render, setSize, settings, uniforms: composite.uniforms, prepass: null };
  return api;
}
