// Low-poly people: a jointed body (hips, torso, head with hair, swinging arms and legs) whose
// clothes, skin and hair come from a "look". Materials are cached per colour so a crowd of
// pedestrians shares a small palette. animateHuman() poses walking, running, aiming and lying.
import * as THREE from 'three';

const materialCache = new Map();
function mat(color) {
  if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return materialCache.get(color);
}

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
};

function part(parent, color, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(geo.box, mat(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a86b3c'];
export const HAIR_COLOURS = ['#1b1b1b', '#3b2314', '#6a4e2e', '#b5884c', '#d9b380', '#2b2b2b', '#7a1f1f'];
export const SHIRT_COLOURS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#f7fff7', '#1a535c', '#ff9f1c', '#8338ec', '#3a86ff', '#ffbe0b', '#e0e1dd', '#ff70a6', '#70d6ff'];
export const PANTS_COLOURS = ['#22333b', '#3d405b', '#5e503f', '#1d3557', '#f2e9e4', '#6b705c', '#2b2d42', '#bc6c25'];

export function randomLook(rng) {
  return {
    skin: rng.pick(SKIN_TONES),
    hair: rng.pick(HAIR_COLOURS),
    shirt: rng.pick(SHIRT_COLOURS),
    pants: rng.pick(PANTS_COLOURS),
    shoes: rng.pick(['#111111', '#f5f5f5', '#6b4226']),
    hairStyle: rng.int(0, 2),
    height: rng.range(0.92, 1.06),
    hat: rng.chance(0.15) ? rng.pick(['#f4d35e', '#ee964b', '#ffffff', '#0d3b66']) : null,
  };
}

/** Builds a person; returns { group, parts } where parts holds the joints to animate. */
export function buildHumanModel(look) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(look.height ?? 1);
  group.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  part(hips, look.pants, 0.36, 0.2, 0.22, 0, 0, 0);
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);
  part(torso, look.shirt, 0.44, 0.58, 0.26, 0, 0.3, 0);
  if (look.vest) part(torso, look.vest, 0.46, 0.4, 0.28, 0, 0.32, 0);
  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);
  part(head, look.skin, 0.1, 0.08, 0.1, 0, 0.02, 0);
  part(head, look.skin, 0.24, 0.27, 0.25, 0, 0.18, 0);
  if (look.hairStyle === 0) part(head, look.hair, 0.26, 0.08, 0.27, 0, 0.33, -0.01);
  else if (look.hairStyle === 1) { part(head, look.hair, 0.26, 0.12, 0.27, 0, 0.31, -0.01); part(head, look.hair, 0.26, 0.22, 0.06, 0, 0.2, -0.13); }
  else part(head, look.hair, 0.27, 0.1, 0.28, 0, 0.32, 0);
  if (look.hat) { part(head, look.hat, 0.29, 0.07, 0.3, 0, 0.36, 0); part(head, look.hat, 0.29, 0.03, 0.14, 0, 0.33, 0.18); }
  if (look.shades) part(head, '#111111', 0.25, 0.05, 0.02, 0, 0.2, 0.13);

  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 0.52, 0);
    torso.add(pivot);
    part(pivot, look.sleeves ?? look.shirt, 0.13, 0.24, 0.14, 0, -0.1, 0);
    part(pivot, look.skin, 0.11, 0.38, 0.12, 0, -0.39, 0);
    return pivot;
  };
  const leg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1, -0.02, 0);
    hips.add(pivot);
    part(pivot, look.pants, 0.15, 0.86, 0.17, 0, -0.44, 0);
    part(pivot, look.shoes, 0.15, 0.09, 0.26, 0, -0.9, 0.04);
    return pivot;
  };
  const armL = arm(1), armR = arm(-1);
  const legL = leg(1), legR = leg(-1);
  // A gun held in the right hand, hidden until armed.
  const gun = new THREE.Group();
  gun.position.set(0, -0.58, 0.06);
  part(gun, '#1c1c1c', 0.06, 0.1, 0.28, 0, 0, 0.08);
  gun.visible = false;
  armR.add(gun);

  return { group, parts: { body, hips, torso, head, armL, armR, legL, legR, gun } };
}

/**
 * Poses a model. `state` is one of idle, walk, run, aim, dead, ragdoll, drive; `phase` is the
 * walk cycle angle; `aimPitch` raises the arm when aiming.
 */
export function animateHuman(parts, state, phase, aimPitch = 0) {
  const { body, hips, torso, armL, armR, legL, legR } = parts;
  let swing = 0, lift = 0;
  if (state === 'walk') swing = 0.55;
  if (state === 'run') { swing = 1.0; lift = 0.06; }
  const s = Math.sin(phase);
  legL.rotation.x = s * swing;
  legR.rotation.x = -s * swing;
  armL.rotation.x = -s * swing * 0.8;
  armR.rotation.x = s * swing * 0.8;
  armL.rotation.z = 0.06;
  armR.rotation.z = -0.06;
  torso.rotation.x = state === 'run' ? 0.12 : 0;
  hips.position.y = 0.95 + Math.abs(Math.cos(phase)) * lift;
  body.rotation.set(0, 0, 0);
  body.position.set(0, 0, 0);
  if (state === 'aim' || state === 'aimWalk') {
    armR.rotation.x = -Math.PI / 2 - aimPitch;
    armR.rotation.z = 0;
    armL.rotation.x = -Math.PI / 2.4 - aimPitch;
    armL.rotation.z = -0.45;
  }
  if (state === 'punch') {
    armR.rotation.x = -Math.PI / 2;
    armL.rotation.x = -0.6;
  }
  if (state === 'hands') {
    armL.rotation.x = Math.PI; armR.rotation.x = Math.PI;
  }
  if (state === 'dead') {
    body.rotation.x = -Math.PI / 2;
    body.position.set(0, 0.14, -0.9);
    legL.rotation.x = 0.1; legR.rotation.x = -0.15;
    armL.rotation.z = 1.2; armR.rotation.z = -1.0;
  }
  if (state === 'drive') {
    legL.rotation.x = legR.rotation.x = -1.4;
    armL.rotation.x = armR.rotation.x = -1.2;
  }
}
