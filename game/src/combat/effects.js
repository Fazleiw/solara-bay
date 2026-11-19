// Visual effects: two pooled soft-particle systems (additive for fire, sparks and muzzle
// flashes; blended for smoke, dust and blood), bullet tracers, tyre skid marks and short-lived
// flash lights for gunfire and explosions. Everything is preallocated; nothing is created per shot.
import * as THREE from 'three';
import { rng } from '../core/random.js';

const particleVertex = /* glsl */`
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float uScale;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vTint = tint;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const particleFragment = /* glsl */`
  varying vec3 vTint;
  varying float vAlpha;
  uniform float uSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(uSoft, 1.0, d)) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint, a);
  }
`;

function createParticleSystem(scene, capacity, additive) {
  const positions = new Float32Array(capacity * 3);
  const tints = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tints, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uSoft: { value: additive ? 0.1 : 0.35 } },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = additive ? 5 : 4;
  scene.add(points);
  const p = {
    vx: new Float32Array(capacity), vy: new Float32Array(capacity), vz: new Float32Array(capacity),
    life: new Float32Array(capacity), maxLife: new Float32Array(capacity),
    size0: new Float32Array(capacity), size1: new Float32Array(capacity),
    alpha0: new Float32Array(capacity), gravity: new Float32Array(capacity), drag: new Float32Array(capacity),
    r0: new Float32Array(capacity), g0: new Float32Array(capacity), b0: new Float32Array(capacity),
    r1: new Float32Array(capacity), g1: new Float32Array(capacity), b1: new Float32Array(capacity),
  };
  let cursor = 0;
  const c0 = new THREE.Color(), c1 = new THREE.Color();

  function emit(x, y, z, vx, vy, vz, { life = 1, size = 1, endSize = size, alpha = 1, gravity = 0, drag = 0, color = '#ffffff', endColor = color }) {
    const i = cursor;
    cursor = (cursor + 1) % capacity;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
    p.life[i] = life; p.maxLife[i] = life;
    p.size0[i] = size; p.size1[i] = endSize;
    p.alpha0[i] = alpha; p.gravity[i] = gravity; p.drag[i] = drag;
    c0.set(color); c1.set(endColor);
    p.r0[i] = c0.r; p.g0[i] = c0.g; p.b0[i] = c0.b;
    p.r1[i] = c1.r; p.g1[i] = c1.g; p.b1[i] = c1.b;
  }

  function update(dt) {
    for (let i = 0; i < capacity; i += 1) {
      if (p.life[i] <= 0) { alphas[i] = 0; continue; }
      p.life[i] -= dt;
      const t = 1 - Math.max(0, p.life[i]) / p.maxLife[i];
      const drag = Math.exp(-p.drag[i] * dt);
      p.vx[i] *= drag; p.vz[i] *= drag;
      p.vy[i] = p.vy[i] * drag - p.gravity[i] * dt;
      positions[i * 3] += p.vx[i] * dt;
      positions[i * 3 + 1] += p.vy[i] * dt;
      positions[i * 3 + 2] += p.vz[i] * dt;
      if (positions[i * 3 + 1] < 0.05 && p.gravity[i] > 0) { positions[i * 3 + 1] = 0.05; p.vy[i] *= -0.3; }
      sizes[i] = p.size0[i] + (p.size1[i] - p.size0[i]) * t;
      alphas[i] = p.alpha0[i] * (1 - t) * Math.min(1, t * 12 + 0.3);
      tints[i * 3] = p.r0[i] + (p.r1[i] - p.r0[i]) * t;
      tints[i * 3 + 1] = p.g0[i] + (p.g1[i] - p.g0[i]) * t;
      tints[i * 3 + 2] = p.b0[i] + (p.b1[i] - p.b0[i]) * t;
    }
    for (const name of ['position', 'tint', 'size', 'alpha']) geometry.attributes[name].needsUpdate = true;
  }

  return { emit, update, material };
}

export function createEffects(scene) {
  const glow = createParticleSystem(scene, 1400, true);
  const haze = createParticleSystem(scene, 1800, false);

  // Tracers.
  const TRACERS = 48;
  const tracerPos = new Float32Array(TRACERS * 6);
  const tracerCol = new Float32Array(TRACERS * 6);
  const tracerLife = new Float32Array(TRACERS);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 3).setUsage(THREE.DynamicDrawUsage));
  const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  tracers.frustumCulled = false;
  scene.add(tracers);
  let tracerCursor = 0;

  // Skid marks: a ring buffer of dark quads on the road.
  const SKIDS = 600;
  const skidPos = new Float32Array(SKIDS * 18);
  const skidGeo = new THREE.BufferGeometry();
  skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3).setUsage(THREE.DynamicDrawUsage));
  const skids = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: '#111111', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  skids.frustumCulled = false;
  skids.renderOrder = 1;
  scene.add(skids);
  let skidCursor = 0;

  // Flash lights (gunfire, explosions).
  const flashes = [];
  for (let i = 0; i < 3; i += 1) {
    const light = new THREE.PointLight('#ffb050', 0, 18, 1.6);
    scene.add(light);
    flashes.push({ light, life: 0, max: 1, peak: 0 });
  }
  let flashCursor = 0;

  function flashLight(x, y, z, intensity, color, duration, range = 18) {
    const f = flashes[flashCursor];
    flashCursor = (flashCursor + 1) % flashes.length;
    f.light.position.set(x, y, z);
    f.light.color.set(color);
    f.light.distance = range;
    f.life = duration; f.max = duration; f.peak = intensity;
  }

  const r = (a) => rng.range(-a, a);
  return {
    sparks(x, y, z, count = 8) {
      for (let i = 0; i < count; i += 1) glow.emit(x, y, z, r(5), rng.range(1, 6), r(5), { life: rng.range(0.25, 0.6), size: 0.18, endSize: 0.05, gravity: 14, drag: 1, color: '#fff2b0', endColor: '#ff6a00' });
    },
    smoke(x, y, z, darkness = 0.5) {
      const shade = Math.floor(40 + darkness * 160);
      const col = `rgb(${shade},${shade},${shade})`;
      haze.emit(x + r(0.3), y, z + r(0.3), r(0.4), rng.range(1.2, 2.4), r(0.4), { life: rng.range(1.6, 2.6), size: 0.8, endSize: 3.6, alpha: 0.55, drag: 0.6, color: col });
    },
    tyreSmoke(x, z) {
      haze.emit(x + r(0.4), 0.3, z + r(0.4), r(0.6), rng.range(0.3, 0.9), r(0.6), { life: rng.range(0.9, 1.6), size: 1.0, endSize: 3.4, alpha: 0.35, drag: 1.2, color: '#e8e4df' });
    },
    dust(x, y, z) {
      for (let i = 0; i < 4; i += 1) haze.emit(x, y, z, r(1.2), rng.range(0.3, 1.5), r(1.2), { life: 0.6, size: 0.3, endSize: 0.9, alpha: 0.6, drag: 2, color: '#b8ab98' });
    },
    fire(x, y, z) {
      glow.emit(x + r(0.5), y + r(0.2), z + r(0.5), r(0.4), rng.range(1.5, 3.5), r(0.4), { life: rng.range(0.4, 0.8), size: 1.3, endSize: 0.3, alpha: 0.9, color: '#ffd27a', endColor: '#ff3a00' });
      if (rng.next() < 0.3) haze.emit(x, y + 1, z, r(0.3), 2.5, r(0.3), { life: 2.2, size: 1.2, endSize: 4.5, alpha: 0.5, drag: 0.5, color: '#2a2622' });
    },
    blood(x, y, z, dx, dz) {
      for (let i = 0; i < 7; i += 1) haze.emit(x, y, z, dx * 2 + r(1.5), rng.range(0.5, 3), dz * 2 + r(1.5), { life: rng.range(0.3, 0.6), size: 0.14, endSize: 0.06, alpha: 0.95, gravity: 12, color: '#a0101a', endColor: '#5a0008' });
    },
    muzzle(x, y, z, dx, dy, dz, big = false) {
      for (let i = 0; i < (big ? 6 : 3); i += 1) glow.emit(x + dx * 0.2 * i, y + dy * 0.2 * i, z + dz * 0.2 * i, dx * 2, dy * 2, dz * 2, { life: 0.06, size: big ? 0.8 : 0.5, endSize: 0.2, color: '#fff3c0', endColor: '#ff9a30' });
      flashLight(x, y, z, big ? 30 : 18, '#ffc070', 0.06, 14);
    },
    tracer(ax, ay, az, bx, by, bz) {
      const i = tracerCursor;
      tracerCursor = (tracerCursor + 1) % TRACERS;
      tracerPos.set([ax, ay, az, bx, by, bz], i * 6);
      tracerLife[i] = 0.07;
    },
    explosion(x, y, z) {
      for (let i = 0; i < 60; i += 1) glow.emit(x + r(1), y + r(0.5), z + r(1), r(9), rng.range(2, 12), r(9), { life: rng.range(0.4, 1.1), size: rng.range(1.5, 3.2), endSize: 0.4, drag: 2.5, color: '#fff0a0', endColor: '#ff3000' });
      for (let i = 0; i < 30; i += 1) haze.emit(x + r(2), y + rng.range(0, 3), z + r(2), r(3), rng.range(2, 6), r(3), { life: rng.range(2.5, 4.5), size: 2.5, endSize: 8, alpha: 0.7, drag: 1.2, color: '#3a3330', endColor: '#7a746e' });
      for (let i = 0; i < 24; i += 1) glow.emit(x, y, z, r(14), rng.range(4, 14), r(14), { life: rng.range(0.6, 1.4), size: 0.22, endSize: 0.08, gravity: 16, color: '#ffe080', endColor: '#ff4000' });
      flashLight(x, y + 2, z, 400, '#ff9a40', 0.6, 60);
    },
    splash(x, y, z) {
      for (let i = 0; i < 10; i += 1) haze.emit(x, y, z, r(2), rng.range(2, 5), r(2), { life: 0.8, size: 0.4, endSize: 1.2, alpha: 0.7, gravity: 9, color: '#e8f6ff' });
    },
    skid(x, z, heading, width) {
      const fx = Math.sin(heading), fz = Math.cos(heading);
      const rx = -fz, rz = fx;
      for (const side of [-1, 1]) {
        const cx = x + rx * side * (width / 2 - 0.25), cz = z + rz * side * (width / 2 - 0.25);
        const w = 0.14, l = 0.35;
        const a = [cx - rx * w - fx * l, 0.03, cz - rz * w - fz * l];
        const b = [cx + rx * w - fx * l, 0.03, cz + rz * w - fz * l];
        const c = [cx + rx * w + fx * l, 0.03, cz + rz * w + fz * l];
        const d = [cx - rx * w + fx * l, 0.03, cz - rz * w + fz * l];
        skidPos.set([...a, ...c, ...b, ...a, ...d, ...c], skidCursor * 18);
        skidCursor = (skidCursor + 1) % SKIDS;
      }
      skidGeo.attributes.position.needsUpdate = true;
    },
    flashLight,
    update(dt, camera, viewportHeight) {
      const scale = viewportHeight * 0.5 * camera.projectionMatrix.elements[5];
      glow.material.uniforms.uScale.value = scale;
      haze.material.uniforms.uScale.value = scale;
      glow.update(dt);
      haze.update(dt);
      for (let i = 0; i < TRACERS; i += 1) {
        tracerLife[i] = Math.max(0, tracerLife[i] - dt);
        const k = tracerLife[i] > 0 ? 1 : 0;
        tracerCol[i * 6] = 1 * k; tracerCol[i * 6 + 1] = 0.85 * k; tracerCol[i * 6 + 2] = 0.5 * k;
        tracerCol[i * 6 + 3] = 1 * k; tracerCol[i * 6 + 4] = 0.6 * k; tracerCol[i * 6 + 5] = 0.2 * k;
      }
      tracerGeo.attributes.position.needsUpdate = true;
      tracerGeo.attributes.color.needsUpdate = true;
      for (const f of flashes) {
        f.life = Math.max(0, f.life - dt);
        f.light.intensity = f.life > 0 ? f.peak * (f.life / f.max) : 0;
      }
    },
  };
}
