// Procedural vehicle models: body, glasshouse, bumpers and lights built with GeometryBuilder
// for each body style (sedan, sports, pickup, police, taxi, van, bike), plus spinning wheels,
// the police light bar and a soft headlight pool on the road for night driving.
import * as THREE from 'three';
import { GeometryBuilder } from '../core/geometryBuilder.js';

const GLASS = '#2a4258';
const TRIM = '#202326';
const CHROME = '#c9ced4';

let shared = null;
function sharedAssets(glowTexture) {
  if (shared) return shared;
  shared = {
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55 }),
    burnt: new THREE.MeshStandardMaterial({ color: '#1c1a19', roughness: 0.95, metalness: 0.2 }),
    lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    tyre: new THREE.MeshStandardMaterial({ color: '#16181a', roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#b8bec6', roughness: 0.3, metalness: 0.9 }),
    beam: new THREE.MeshBasicMaterial({ map: glowTexture, color: '#fff1c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    wheelGeo: new THREE.CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2),
    rimGeo: new THREE.CylinderGeometry(0.62, 0.62, 1.04, 8).rotateZ(Math.PI / 2),
    beamGeo: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  return shared;
}

/** Adds the paint, glass and trim volumes of a body style to a builder. */
function buildBody(b, lights, type, paint) {
  const L = type.length, W = type.width;
  const half = L / 2;
  const headlight = '#fff6dc', taillight = '#ff2a2a';
  const addLights = (y, inset = 0.35) => {
    for (const s of [-1, 1]) {
      lights.box(s * (W / 2 - inset), y, half - 0.02, 0.42, 0.14, 0.06, headlight);
      lights.box(s * (W / 2 - inset), y, -half + 0.02, 0.42, 0.14, 0.06, taillight);
    }
  };
  switch (type.body) {
    case 'sports': {
      const shoulderPaint = new THREE.Color(paint).offsetHSL(0, 0.02, 0.08);
      b.box(0, 0.28, 0, W, 0.28, L, paint);
      b.taperedBox(0, 0.56, 0, W, 0.17, L, W * 0.9, L * 0.94, shoulderPaint);
      b.taperedBox(0, 0.73, -0.25, W * 0.86, 0.42, L * 0.42, W * 0.7, L * 0.22, GLASS, -0.1);
      b.box(0, 1.14, -0.33, W * 0.68, 0.04, L * 0.2, paint);
      for (const s of [-1, 1]) b.taperedBox(s * W * 0.385, 0.73, -0.28, 0.07, 0.42, 0.14, 0.06, 0.1, paint);
      b.taperedBox(0, 0.73, half - 0.75, W * 0.95, 0.08, 1.5, W * 0.85, 1.2, paint);
      b.box(0, 0.95, -half + 0.25, W * 0.9, 0.06, 0.4, TRIM);
      for (const s of [-1, 1]) b.box(s * W * 0.38, 0.73, -half + 0.3, 0.08, 0.22, 0.08, TRIM);
      b.box(0, 0.2, half - 0.1, W * 0.9, 0.2, 0.25, TRIM);
      b.box(0, 0.2, -half + 0.1, W * 0.9, 0.2, 0.25, TRIM);
      b.box(0, 0.19, -half + 0.015, W * 0.72, 0.1, 0.07, '#111418');
      for (const s of [-1, 0, 1]) b.box(s * W * 0.22, 0.19, -half + 0.1, 0.045, 0.13, 0.2, '#111418');
      for (const s of [-1, 1]) b.box(s * (W / 2 + 0.01), 0.38, 0, 0.04, 0.12, L * 0.5, TRIM);
      for (const s of [-1, 1]) {
        lights.box(s * (W / 2 - 0.32), 0.58, half - 0.02, 0.42, 0.14, 0.06, headlight);
        lights.box(s * (W / 2 - 0.3), 0.58, -half + 0.02, 0.34, 0.12, 0.06, taillight);
        lights.box(s * (W / 2 - 0.57), 0.6, -half + 0.015, 0.16, 0.07, 0.07, '#ff7068');
      }
      break;
    }
    case 'pickup': {
      b.box(0, 0.4, 0, W, 0.62, L, paint);
      b.taperedBox(0, 1.02, 0.55, W * 0.94, 0.66, 1.9, W * 0.86, 1.5, GLASS, -0.1);
      b.box(0, 1.66, 0.48, W * 0.86, 0.06, 1.45, paint);
      b.box(0, 1.02, -1.25, W, 0.05, 2.3, '#2b2b2b');
      for (const s of [-1, 1]) b.box(s * (W / 2 - 0.06), 1.02, -1.25, 0.12, 0.4, 2.4, paint);
      b.box(0, 1.02, -half + 0.08, W, 0.4, 0.12, paint);
      b.box(0, 0.3, half - 0.05, W * 1.02, 0.3, 0.2, CHROME);
      b.box(0, 0.3, -half + 0.05, W * 1.02, 0.25, 0.2, CHROME);
      addLights(0.82);
      break;
    }
    case 'van': {
      b.box(0, 0.35, 0, W, 1.9, L, paint);
      b.taperedBox(0, 1.25, half - 0.55, W * 0.98, 0.95, 1.0, W * 0.92, 0.5, GLASS, -0.2);
      if (type.armored) {
        // Armored cash truck: blind steel box, riveted bands, gold company stripe, roof beacon.
        for (const z of [-L * 0.3, 0, L * 0.18]) b.box(0, 1.3, z, W + 0.05, 1.6, 0.08, '#4a535c');
        b.box(0, 1.15, -0.2, W + 0.05, 0.22, L * 0.75, '#e0a526');
        b.box(0, 2.3, 0.2, 0.5, 0.18, 0.5, '#e0a526');
      } else {
        for (const s of [-1, 1]) b.box(s * (W / 2 + 0.01), 1.45, -0.3, 0.03, 0.6, L * 0.62, GLASS);
        b.box(0, 0.88, 0, W + 0.04, 0.12, L * 0.98, '#ff8a3d');
      }
      b.box(0, 2.25, 0, W * 0.96, 0.08, L * 0.94, '#dfe3e6');
      b.box(0, 0.25, half - 0.05, W * 1.02, 0.3, 0.2, TRIM);
      b.box(0, 0.25, -half + 0.05, W * 1.02, 0.3, 0.2, TRIM);
      addLights(0.7);
      break;
    }
    case 'bike': {
      b.box(0, 0.45, 0.05, 0.3, 0.35, 1.3, paint);
      b.taperedBox(0, 0.75, 0.35, 0.42, 0.28, 0.7, 0.3, 0.4, paint);
      b.box(0, 0.78, -0.35, 0.3, 0.12, 0.7, TRIM);
      b.beam([0, 0.6, 0.75], [0, 1.08, 0.62], 0.04, 4, CHROME);
      b.box(0, 1.08, 0.62, 0.72, 0.04, 0.04, TRIM);
      lights.box(0, 0.86, 0.82, 0.18, 0.14, 0.06, headlight);
      lights.box(0, 0.7, -0.72, 0.16, 0.08, 0.04, taillight);
      break;
    }
    default: {
      // sedan, police, taxi share the saloon shape.
      const H0 = 0.32, bodyH = 0.58;
      b.box(0, H0, 0, W, bodyH, L, paint);
      b.taperedBox(0, H0 + bodyH, -0.2, W * 0.92, 0.55, L * 0.5, W * 0.78, L * 0.3, GLASS, -0.05);
      b.box(0, H0 + bodyH + 0.55, -0.25, W * 0.78, 0.05, L * 0.3, paint);
      for (const s of [-1, 1]) b.taperedBox(s * W * 0.43, H0 + bodyH, -0.22, 0.07, 0.55, 0.16, 0.06, 0.12, paint);
      b.box(0, 0.22, half - 0.08, W * 1.01, 0.24, 0.22, type.body === 'police' ? TRIM : CHROME);
      b.box(0, 0.22, -half + 0.08, W * 1.01, 0.24, 0.22, type.body === 'police' ? TRIM : CHROME);
      for (const s of [-1, 1]) b.box(s * (W / 2 + 0.01), H0 + 0.25, 0, 0.03, 0.06, L * 0.6, CHROME);
      if (type.body === 'police') {
        b.box(0, H0 + 0.001, half * 0.55, W * 1.005, bodyH * 1.005, L * 0.28, '#14171c');
        b.box(0, H0 + 0.001, -half * 0.62, W * 1.005, bodyH * 1.005, L * 0.24, '#14171c');
        b.box(0, H0 + 0.05, half - 0.06, W * 0.7, 0.3, 0.12, '#0b0b0b');
      }
      if (type.body === 'taxi') {
        b.box(0, H0 + bodyH + 0.6, -0.25, 0.9, 0.24, 0.32, '#111111');
        lights.box(0, H0 + bodyH + 0.66, -0.25, 0.8, 0.14, 0.34, '#ffe9a8');
        b.box(0, H0 + 0.24, 0, W + 0.03, 0.1, L * 0.7, '#1a1a1a');
      }
      addLights(H0 + 0.36);
    }
  }
}

/**
 * Builds the model for a vehicle type in a paint colour: { group, body, wheels, lightBar, beam }.
 * The group's origin is at road level under the centre of the car; the car faces +z.
 */
export function buildVehicleModel(type, paint, glowTexture) {
  const assets = sharedAssets(glowTexture);
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);
  const b = new GeometryBuilder();
  const lb = new GeometryBuilder();
  buildBody(b, lb, type, paint);
  const body = new THREE.Mesh(b.build(), assets.paint);
  body.castShadow = true;
  body.receiveShadow = true;
  bodyGroup.add(body);
  bodyGroup.add(new THREE.Mesh(lb.build(), assets.lights));

  const wheels = [];
  const r = type.wheelRadius;
  const positions = type.bike
    ? [[0, type.wheelbase / 2], [0, -type.wheelbase / 2]]
    : [[-(type.width / 2 - 0.2), type.wheelbase / 2], [type.width / 2 - 0.2, type.wheelbase / 2], [-(type.width / 2 - 0.2), -type.wheelbase / 2], [type.width / 2 - 0.2, -type.wheelbase / 2]];
  for (const [x, z] of positions) {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(assets.wheelGeo, assets.tyre);
    tyre.scale.set(type.bike ? 0.14 : 0.26, r, r);
    const rim = new THREE.Mesh(assets.rimGeo, assets.rim);
    rim.scale.set(type.bike ? 0.15 : 0.27, r, r);
    tyre.castShadow = true;
    spin.add(tyre, rim);
    pivot.add(spin);
    group.add(pivot);
    wheels.push({ pivot, spin, front: z > 0 });
  }

  let lightBar = null;
  if (type.police) {
    const red = new THREE.MeshBasicMaterial({ color: '#ff1a2e', toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: '#1a5cff', toneMapped: false });
    const barY = 0.32 + 0.58 + 0.6;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.26), red);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.26), blue);
    left.position.set(-0.36, barY, -0.2);
    right.position.set(0.36, barY, -0.2);
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture, color: '#ff2040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const glowMatB = glowMat.clone();
    glowMatB.color.set('#2a6bff');
    const glowL = new THREE.Sprite(glowMat);
    const glowR = new THREE.Sprite(glowMatB);
    glowL.position.copy(left.position); glowR.position.copy(right.position);
    glowL.scale.setScalar(5); glowR.scale.setScalar(5);
    bodyGroup.add(left, right, glowL, glowR);
    lightBar = { red, blue, glowL, glowR };
  }

  const beam = new THREE.Mesh(assets.beamGeo, assets.beam);
  beam.scale.set(type.bike ? 4 : 7, 1, 14);
  beam.position.set(0, 0.06, type.length / 2 + 6);
  beam.renderOrder = 1;
  group.add(beam);

  return { group, bodyGroup, body, wheels, lightBar, beam, assets };
}

/** Sets how bright the shared head/tail lights and road beams are (0 by day, 1 at night). */
export function setVehicleNightLevel(night) {
  if (!shared) return;
  shared.lights.color.setScalar(0.8 + night * 1.8);
  shared.beam.opacity = night * 0.32;
}
