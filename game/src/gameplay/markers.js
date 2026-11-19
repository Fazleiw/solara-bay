// World markers: a glowing ring on the ground with a soft light column, used for mission
// starts, destinations, race checkpoints, shops and the save point. Each pulses gently.
import * as THREE from 'three';

let shared = null;
function assets(glowTexture) {
  if (shared) return shared;
  const columnTexture = (() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  shared = {
    ring: new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2),
    disc: new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
    column: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0),
    columnTexture,
    glowTexture,
  };
  return shared;
}

export function createMarker(game, x, z, color = '#ffd23f', { radius = 2.2, height = 10, label = null } = {}) {
  const a = assets(game.world.textures.glow);
  const group = new THREE.Group();
  const mk = (geo, opacity, map = null) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  const ring = mk(a.ring, 0.9);
  const disc = mk(a.disc, 0.18, a.glowTexture);
  const column = mk(a.column, 0.35, a.columnTexture);
  ring.scale.setScalar(radius);
  disc.scale.setScalar(radius * 1.3);
  column.scale.set(radius * 0.85, height, radius * 0.85);
  ring.position.y = 0.18; disc.position.y = 0.17;
  group.add(ring, disc, column);
  group.position.set(x, 0, z);
  group.renderOrder = 3;
  game.scene.add(group);
  const marker = {
    x, z, radius, color, label, group,
    visible: true,
    update(time) {
      const pulse = 1 + Math.sin(time * 3) * 0.06;
      ring.scale.setScalar(radius * pulse);
      column.material.opacity = 0.25 + Math.sin(time * 2) * 0.08;
    },
    setVisible(v) { marker.visible = v; group.visible = v; },
    moveTo(nx, nz) { marker.x = nx; marker.z = nz; group.position.set(nx, 0, nz); },
    contains(px, pz, extra = 0) { return Math.hypot(px - marker.x, pz - marker.z) < radius + extra; },
    remove() { game.scene.remove(group); game.markers.delete(marker); },
  };
  game.markers.add(marker);
  return marker;
}
