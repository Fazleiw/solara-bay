// Sun Medallions: 25 golden tokens hidden around Solara Bay, on street corners, the beach,
// the pier, Gull Key and the docks. Each pays out and is remembered in the save; finding all
// of them pays a big bonus. They show on the minimap only once you are close.
import * as THREE from 'three';
import { blockCenter, PIER } from '../world/cityLayout.js';

const SPOTS = [
  [0, 2, -26, 0], [1, 3, 0, 26], [2, 5, 26, -10], [0, 7, -26, 20], [1, 6, 10, 26], [3, 2, -26, -26],
  [4, 4, 26, 26], [5, 3, -26, 0], [6, 5, 0, -26], [7, 2, 26, 10], [8, 3, 0, 26], [3, 5, -26, 12],
  [4, 7, 0, 26], [6, 6, 26, -20], [8, 7, -26, -26], [5, 6, -10, -12], [1, 9, 0, -26], [5, 8, 26, 0],
  [7, 9, 26, 26], [9, 3, 20, 0], [9, 7, 30, -10], [6, 0, 0, -10], [8, 0, -15, 10],
];

export const MEDALLIONS = [
  ...SPOTS.map(([i, j, ox, oz], n) => { const c = blockCenter(i, j); return { id: n, x: c.x + ox, z: c.z + oz }; }),
  { id: SPOTS.length, x: PIER.x1 - 5, z: PIER.z },
  { id: SPOTS.length + 1, x: -200, z: 365 },
];

export const MEDALLION_REWARD = 250;
export const MEDALLION_BONUS = 10000;

export function createCollectibles(game) {
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24).rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffcc33', emissive: '#ff9a00', emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.25 });
  const glowMat = new THREE.SpriteMaterial({ map: game.world.textures.glow, color: '#ffc040', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, toneMapped: false });
  const live = [];

  function build() {
    for (const l of live) game.scene.remove(l.mesh, l.glow);
    live.length = 0;
    for (const m of MEDALLIONS) {
      if (game.state.medallions.includes(m.id)) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(m.x, 1.1, m.z);
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(mesh.position);
      glow.scale.setScalar(2.2);
      game.scene.add(mesh, glow);
      live.push({ ...m, mesh, glow });
    }
  }

  function update(dt) {
    const p = game.player;
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const m = live[i];
      m.mesh.rotation.y += dt * 2.5;
      m.mesh.position.y = 1.1 + Math.sin(game.clock * 2 + i) * 0.15;
      if (Math.hypot(p.x - m.x, p.z - m.z) < (p.vehicle ? 2.6 : 1.3)) {
        game.scene.remove(m.mesh, m.glow);
        live.splice(i, 1);
        game.state.medallions.push(m.id);
        game.addCash(MEDALLION_REWARD);
        const found = game.state.medallions.length;
        game.audio?.sfx.collect();
        if (found === MEDALLIONS.length) {
          game.addCash(MEDALLION_BONUS);
          game.hud?.bigMessage('ALL SUN MEDALLIONS', `Bonus $${MEDALLION_BONUS.toLocaleString()}`, '#ffcc33');
        } else {
          game.hud?.notify(`Sun Medallion ${found} / ${MEDALLIONS.length}`);
        }
        game.autosave?.();
      }
    }
  }

  return { live, build, update, total: MEDALLIONS.length };
}
