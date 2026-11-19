// The day/night cycle: a 24-hour clock drives the sun's arc (rising over the hills, setting
// over the ocean), a keyframed palette for sky, fog and light colours, the shadow-casting sun
// that follows the player, and a night factor that lights windows, neon and street lamps.
import * as THREE from 'three';
import { HOUR_SECONDS } from '../config.js';

/** Palette keyframes by hour: sky top, horizon, fog, sun colour, sun strength, ambient strength. */
const KEYS = [
  { t: 0, top: '#060b22', horizon: '#1a2350', fog: '#141b3a', sun: '#8fa8ff', sunI: 0.35, amb: 0.42, cloud: 0.0 },
  { t: 4.8, top: '#0b1230', horizon: '#2a2c5a', fog: '#1d2244', sun: '#8fa8ff', sunI: 0.3, amb: 0.42, cloud: 0.1 },
  { t: 6.0, top: '#3b4f8c', horizon: '#ff9f80', fog: '#d49a8a', sun: '#ffb27a', sunI: 1.3, amb: 0.55, cloud: 0.9 },
  { t: 7.5, top: '#3d86d6', horizon: '#ffe3c2', fog: '#d8dfe6', sun: '#ffe2b8', sunI: 2.6, amb: 0.7, cloud: 0.4 },
  { t: 12, top: '#2c7ad6', horizon: '#bfe2ff', fog: '#c6dcec', sun: '#fff6e6', sunI: 3.0, amb: 0.75, cloud: 0.05 },
  { t: 16, top: '#2f74cc', horizon: '#ffe2b0', fog: '#e6d6bf', sun: '#ffe2b0', sunI: 2.9, amb: 0.7, cloud: 0.3 },
  { t: 17.6, top: '#3a6cc4', horizon: '#ffc06a', fog: '#f2c28e', sun: '#ffb45a', sunI: 3.0, amb: 0.6, cloud: 0.85 },
  { t: 18.6, top: '#35509f', horizon: '#ff8a50', fog: '#eea070', sun: '#ff8a40', sunI: 2.3, amb: 0.55, cloud: 1.0 },
  { t: 19.4, top: '#262b6b', horizon: '#ff5f7e', fog: '#9a5a7a', sun: '#ff6a50', sunI: 0.7, amb: 0.48, cloud: 1.0 },
  { t: 20.3, top: '#121646', horizon: '#5a3a7a', fog: '#3a2c5c', sun: '#8fa8ff', sunI: 0.35, amb: 0.42, cloud: 0.3 },
  { t: 24, top: '#060b22', horizon: '#1a2350', fog: '#141b3a', sun: '#8fa8ff', sunI: 0.35, amb: 0.42, cloud: 0.0 },
];
const parsed = KEYS.map((k) => ({ ...k, top: new THREE.Color(k.top), horizon: new THREE.Color(k.horizon), fog: new THREE.Color(k.fog), sun: new THREE.Color(k.sun) }));

function samplePalette(hour, out) {
  let a = parsed[0], b = parsed[parsed.length - 1];
  for (let i = 0; i < parsed.length - 1; i += 1) {
    if (hour >= parsed[i].t && hour <= parsed[i + 1].t) { a = parsed[i]; b = parsed[i + 1]; break; }
  }
  const f = (hour - a.t) / Math.max(0.0001, b.t - a.t);
  out.top.copy(a.top).lerp(b.top, f);
  out.horizon.copy(a.horizon).lerp(b.horizon, f);
  out.fog.copy(a.fog).lerp(b.fog, f);
  out.sun.copy(a.sun).lerp(b.sun, f);
  out.sunI = a.sunI + (b.sunI - a.sunI) * f;
  out.amb = a.amb + (b.amb - a.amb) * f;
  out.cloud = a.cloud + (b.cloud - a.cloud) * f;
  return out;
}

export function createDayNight(scene, renderer, sky, water, materials) {
  const sun = new THREE.DirectionalLight('#ffffff', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 10; sc.far = 600;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#bcd7ff', '#8a7a62', 0.7);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2('#e0c8b0', 0.0022);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.mesh.geometry, sky.mesh.material);
  envScene.add(envSky);
  let envTarget = null;
  let lastEnvHour = -10;

  const palette = { top: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), sunI: 0, amb: 0, cloud: 0 };
  const sunDir = new THREE.Vector3();
  const state = { hour: 18, night: 0, sunDir, timeScale: 1, frozen: false };

  function sunDirection(hour, out) {
    // 6:00 rises in the west over the hills, 18:30 sets in the east over the ocean (a coastal quirk of the bay).
    const a = ((hour - 6.25) / 12.5) * Math.PI;
    const elevation = Math.sin(a);
    out.set(-Math.cos(a) * 0.82, elevation * 0.9 + 0.02, 0.38).normalize();
    return out;
  }

  function apply(focus) {
    const hour = state.hour;
    samplePalette(hour, palette);
    sunDirection(hour, sunDir);
    const below = sunDir.y < 0.03;
    // At night the "sun" light becomes soft moonlight from high above.
    const lightDir = below ? new THREE.Vector3(0.3, 0.9, 0.3).normalize() : sunDir;
    sun.color.copy(palette.sun);
    sun.intensity = palette.sunI;
    sun.position.copy(focus).addScaledVector(lightDir, 300);
    sun.target.position.copy(focus);
    hemi.intensity = palette.amb * 0.8;
    hemi.color.copy(palette.top).lerp(new THREE.Color('#ffffff'), 0.55);
    hemi.groundColor.copy(palette.fog).multiplyScalar(0.6);
    scene.fog.color.copy(palette.fog);
    const night = THREE.MathUtils.clamp(hour < 12 ? (6.3 - hour) / 1.0 : (hour - 18.9) / 1.2, 0, 1);
    state.night = night;
    scene.fog.density = 0.0012 + night * 0.0007;

    const u = sky.uniforms;
    u.uTop.value.copy(palette.top);
    u.uHorizon.value.copy(palette.horizon);
    u.uBottom.value.copy(palette.fog).multiplyScalar(0.8);
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(palette.sun);
    u.uNight.value = night;
    u.uCloudLight.value = palette.cloud;

    const w = water.uniforms;
    w.uSunDir.value.copy(sunDir);
    w.uSunColor.value.copy(palette.sun).multiplyScalar(below ? 0.1 : 1);
    w.uSkyColor.value.copy(palette.horizon).lerp(palette.top, 0.35);
    w.uDeep.value.set('#0b4f6c').lerp(new THREE.Color('#041226'), night);
    w.uShallow.value.set('#1aa3a8').lerp(new THREE.Color('#0a2a44'), night);
    w.uNight.value = night;

    const windows = 0.15 + night * 1.6;
    for (const m of materials.facades) m.emissiveIntensity = windows * (m === materials.glass ? 1.2 : 1);
    materials.neonTube.color.setScalar(0.75 + night * 1.6);
    for (const m of materials.neonSigns ?? []) m.color.setScalar(0.85 + night * 1.4);
    renderer.toneMappingExposure = 0.9 + night * 0.3;

    if (Math.abs(hour - lastEnvHour) > 0.5) {
      lastEnvHour = hour;
      if (envTarget) envTarget.dispose();
      envTarget = pmrem.fromScene(envScene, 0, 1, 2000);
      scene.environment = envTarget.texture;
    }
  }

  return {
    state,
    sun,
    setHour(hour) { state.hour = ((hour % 24) + 24) % 24; lastEnvHour = -10; },
    update(dt, focus) {
      if (!state.frozen) state.hour = (state.hour + (dt * state.timeScale) / HOUR_SECONDS) % 24;
      apply(focus);
    },
    clockText() {
      const h = Math.floor(state.hour), m = Math.floor((state.hour - h) * 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
  };
}
