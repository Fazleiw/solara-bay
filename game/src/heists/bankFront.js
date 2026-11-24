// The Marisol Savings & Loan on Solstice St in Deco Row: a deco stone front with columns, a gold
// neon sign, warm lobby glass and the round vault door that Juno drills, plus the drill rig
// itself (shown while it runs). Built once, the first time the heist system starts.
import * as THREE from 'three';
import { lineCoord } from '../world/cityLayout.js';

/** Where the bank stands: the vault door on the facade, the crew's meeting spot across the street,
 *  the curb where Tavo pulls up, and the drop at his garage. */
export const BANK = {
  x: lineCoord(7) + 35,
  facadeZ: lineCoord(7) - 11,
  door: { x: lineCoord(7) + 35, z: lineCoord(7) - 8.4 },
  meet: { x: lineCoord(7) + 22, z: lineCoord(7) + 12 },
  curb: { x: lineCoord(7) + 52, z: lineCoord(7) - 3.5 },
};

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d3b3a';
  ctx.fillRect(0, 0, 1024, 128);
  ctx.strokeStyle = '#ffd36b';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 112);
  ctx.fillStyle = '#ffe39a';
  ctx.font = '900 66px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MARISOL SAVINGS & LOAN', 512, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildBankFront(scene) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: '#efe0c6', roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: '#2a8f86', roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: '#b9c2cc', metalness: 0.85, roughness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d9a83c', metalness: 0.9, roughness: 0.35 });
  const glow = (color, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  };
  // The stone front, the stepped deco crown and the teal bands.
  box(24, 10, 1.2, stone, 0, 5, 0);
  box(16, 2.2, 1.0, stone, 0, 11.1, 0);
  box(8, 1.6, 0.9, stone, 0, 12.9, 0);
  box(24.4, 0.5, 1.5, trim, 0, 8.6, 0.1);
  box(24.4, 0.4, 1.5, trim, 0, 0.2, 0.1);
  // Columns either side of the vault bay.
  for (const x of [-9.5, -5.5, 5.5, 9.5]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 8.2, 16), stone);
    col.position.set(x, 4.3, 1.1); col.castShadow = true; group.add(col);
    box(1.6, 0.4, 1.6, trim, x, 8.4, 1.1);
  }
  // Warm lobby glass behind the columns.
  for (const x of [-7.5, 7.5]) box(2.6, 5, 0.1, glow('#ffc978', 1.1), x, 3.2, 0.62);
  // The gold neon sign and the trim strip under it.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.9), new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.5) }));
  sign.position.set(0, 9.8, 0.66);
  group.add(sign);
  box(15.6, 0.12, 0.12, glow('#ffd36b', 2.6), 0, 8.86, 0.9);
  // The vault bay: a dark recess, the round steel door with its brass wheel and bolts.
  box(7.2, 6.6, 0.2, new THREE.MeshStandardMaterial({ color: '#141a22', roughness: 0.9 }), 0, 3.4, 0.62);
  box(7.6, 0.25, 0.4, glow('#3ef2ff', 2), 0, 6.8, 0.75);
  const vault = new THREE.Group();
  vault.position.set(0, 2.9, 0.85);
  group.add(vault);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 40).rotateX(Math.PI / 2), steel);
  door.castShadow = true;
  vault.add(door);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.16, 10, 40), brass);
  vault.add(ring);
  const wheel = new THREE.Group();
  wheel.position.z = 0.35;
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 8, 24), brass));
  for (let i = 0; i < 3; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), brass);
    spoke.rotation.z = (i * Math.PI) / 3;
    wheel.add(spoke);
  }
  vault.add(wheel);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8).rotateX(Math.PI / 2), brass);
    bolt.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0.3);
    vault.add(bolt);
  }
  // Juno's drill rig: a tripod, the motor and a bit pressed into the door beside the wheel.
  const drill = new THREE.Group();
  drill.position.set(1.3, 0.2, 0.7);
  const yellow = new THREE.MeshStandardMaterial({ color: '#ffb400', roughness: 0.5 });
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.9), yellow);
  motor.position.z = 0.7;
  drill.add(motor);
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8).rotateX(Math.PI / 2), steel);
  bit.position.z = 0.1;
  drill.add(bit);
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glow('#ff7a1a', 3));
  hot.position.z = -0.25;
  drill.add(hot);
  drill.visible = false;
  vault.add(drill);
  group.position.set(BANK.x, 0, BANK.facadeZ);
  scene.add(group);
  const light = new THREE.PointLight('#ffd08a', 30, 22, 1.6);
  light.position.set(BANK.x, 5, BANK.facadeZ + 4);
  scene.add(light);
  return {
    group,
    drill,
    hot,
    /** The door swings open once the drill is through. */
    setOpen(amount) { vault.rotation.y = -amount * 1.4; vault.position.x = amount * -2.2; },
    /** The bit glows hotter with the heat meter. */
    setHeat(heat) { hot.scale.setScalar(0.6 + heat / 60); hot.material.color.setRGB(1 + heat / 40, 0.35 + heat / 200, 0.05).multiplyScalar(2); },
    spin(dt) { bit.rotation.z += dt * 40; wheel.rotation.z += dt * 0.2; },
    /** World position of the bit's tip, where the sparks fly. */
    bitTip() { return hot.getWorldPosition(new THREE.Vector3()); },
  };
}
