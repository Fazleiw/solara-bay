// Loot bags: the stuffed duffels Juno pushes out of the vault, lying on the floor until Dani
// picks one up, then strapped to the carrier's back (up to two shown, the rest implied) so a
// loaded crew reads as one from any camera.
import * as THREE from 'three';

let shared = null;
function assets() {
  if (shared) return shared;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f4a2a'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffd23f';
  ctx.font = '900 40px Arial Black, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', 32, 34);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  shared = {
    body: new THREE.CapsuleGeometry(0.2, 0.42, 4, 10).rotateZ(Math.PI / 2),
    knot: new THREE.SphereGeometry(0.09, 8, 6),
    strap: new THREE.TorusGeometry(0.16, 0.025, 6, 14, Math.PI),
    canvas: new THREE.MeshStandardMaterial({ color: '#ffffff', map, roughness: 0.9 }),
    tie: new THREE.MeshStandardMaterial({ color: '#c9a36a', roughness: 0.8 }),
  };
  return shared;
}

export function buildBag() {
  const a = assets();
  const bag = new THREE.Group();
  const body = new THREE.Mesh(a.body, a.canvas);
  body.castShadow = true;
  bag.add(body);
  const knot = new THREE.Mesh(a.knot, a.tie);
  knot.position.set(0.36, 0.05, 0);
  bag.add(knot);
  const strap = new THREE.Mesh(a.strap, a.tie);
  strap.position.y = 0.15;
  bag.add(strap);
  return bag;
}

/** A bag lying on the ground at (x, z), with a soft gold glow so it reads as loot. */
export function dropBag(scene, x, z, value, glowTexture) {
  const bag = buildBag();
  bag.position.set(x, 0.22, z);
  bag.rotation.y = (x * 7.3 + z * 3.1) % Math.PI;
  scene.add(bag);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#ffd23f', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.setScalar(1.6);
  halo.position.set(x, 0.3, z);
  scene.add(halo);
  return { x, z, value, mesh: bag, halo, remove() { scene.remove(bag, halo); } };
}

/** Straps `count` bags onto a person's back (their torso joint); returns a function that takes them off. */
export function strapBags(human, count) {
  const torso = human.model.parts.torso;
  const old = torso.userData.lootBags ?? [];
  for (const b of old) torso.remove(b);
  const bags = [];
  for (let i = 0; i < Math.min(2, count); i += 1) {
    const bag = buildBag();
    bag.rotation.y = Math.PI / 2;
    bag.rotation.z = i ? 0.25 : -0.15;
    bag.position.set(i ? 0.14 : -0.1, 0.32 + i * 0.08, -0.32 - i * 0.12);
    torso.add(bag);
    bags.push(bag);
  }
  torso.userData.lootBags = bags;
  return () => { for (const b of bags) torso.remove(b); torso.userData.lootBags = []; };
}
