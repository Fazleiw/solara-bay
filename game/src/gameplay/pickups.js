// Pickups: health packs, body armour, weapons and ammunition placed around the city (they
// come back a while after being taken), plus cash and ammo dropped by the fallen. Each one
// spins and bobs over a glowing ring.
import * as THREE from 'three';
import { WEAPONS, giveWeapon } from '../combat/weapons.js';
import { LANDMARKS } from '../world/cityLayout.js';

const PLACED = [
  { kind: 'health', x: LANDMARKS.hospital.front.x + 4, z: LANDMARKS.hospital.front.z },
  { kind: 'armor', x: LANDMARKS.policeHQ.front.x, z: LANDMARKS.policeHQ.front.z - 12 },
  { kind: 'pistol', x: LANDMARKS.safehouse.front.x - 3, z: LANDMARKS.safehouse.front.z + 14 },
  { kind: 'smg', x: LANDMARKS.warehouse.x + 24, z: LANDMARKS.warehouse.z + 26 },
  { kind: 'shotgun', x: LANDMARKS.lighthouse.x + 8, z: LANDMARKS.lighthouse.z + 14 },
  { kind: 'armor', x: 322, z: 150 },
  { kind: 'health', x: LANDMARKS.park.x + 6, z: LANDMARKS.park.z + 6 },
  { kind: 'health', x: -105, z: 210 },
  { kind: 'pistol', x: 140, z: -100 },
  { kind: 'health', x: 290, z: -60 },
];

const COLOURS = { health: '#ff4d5e', armor: '#4da3ff', pistol: '#ffd23f', smg: '#ffd23f', shotgun: '#ffd23f', ammo: '#ffb347', cash: '#5cff8d' };

function pickupMesh(kind) {
  const group = new THREE.Group();
  const m = (color, emissive = 0.35) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4 });
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(x, y, z); group.add(mesh); return mesh; };
  if (kind === 'health') { box(0.6, 0.6, 0.25, m('#ffffff', 0.2)); box(0.42, 0.13, 0.28, m('#e3171f')); box(0.13, 0.42, 0.28, m('#e3171f')); }
  else if (kind === 'armor') { box(0.6, 0.7, 0.22, m('#2e6fd8')); box(0.4, 0.2, 0.24, m('#9cc4ff'), 0, 0.15, 0); }
  else if (kind === 'cash') { box(0.5, 0.18, 0.28, m('#3fbf5f')); box(0.52, 0.05, 0.08, m('#e8ffe8', 0.1), 0, 0.1, 0); }
  else { box(0.7, 0.18, 0.12, m('#2b2b2b', 0.05)); box(0.14, 0.32, 0.12, m('#2b2b2b', 0.05), -0.22, -0.18, 0); box(0.72, 0.04, 0.14, m('#ffd23f', 0.6), 0, 0.11, 0); }
  return group;
}

export function createPickups(game) {
  const items = [];
  const ringGeo = new THREE.RingGeometry(0.55, 0.75, 28).rotateX(-Math.PI / 2);

  function add(kind, x, z, { amount = 0, weapon = null, respawn = 0, life = 0 } = {}) {
    const group = pickupMesh(kind);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COLOURS[kind] ?? '#ffffff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ring.position.set(x, 0.18, z);
    group.position.set(x, 0.9, z);
    game.scene.add(group, ring);
    const item = { kind, x, z, amount, weapon, respawn, life, group, ring, hidden: 0 };
    items.push(item);
    return item;
  }

  for (const p of PLACED) add(p.kind, p.x, p.z, { respawn: 90 });

  function collect(item) {
    const player = game.player;
    const h = player.human;
    const notify = (text) => game.hud?.notify(text);
    switch (item.kind) {
      case 'health':
        if (h.health >= h.maxHealth) return false;
        h.health = Math.min(h.maxHealth, h.health + 50);
        notify('+50 Health');
        break;
      case 'armor':
        if (h.armor >= 100) return false;
        h.armor = Math.min(100, h.armor + 50);
        notify('+50 Armor');
        break;
      case 'cash':
        game.addCash(item.amount);
        break;
      case 'ammo':
        giveWeapon(player.inventory, item.weapon, item.amount);
        notify(`${WEAPONS[item.weapon].name} ammo +${item.amount}`);
        break;
      default: {
        const def = WEAPONS[item.kind];
        const fresh = !player.inventory.owned[item.kind];
        giveWeapon(player.inventory, item.kind, def.mag * 3);
        if (fresh) player.inventory.current = item.kind;
        notify(fresh ? `Picked up ${def.name}` : `${def.name} ammo +${def.mag * 3}`);
      }
    }
    game.audio?.sfx.pickup(item.kind === 'cash');
    return true;
  }

  function update(dt) {
    const p = game.player;
    const t = game.clock;
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      if (item.hidden > 0) {
        item.hidden -= dt;
        if (item.hidden <= 0) { item.group.visible = item.ring.visible = true; }
        continue;
      }
      item.group.rotation.y = t * 2;
      item.group.position.y = 0.9 + Math.sin(t * 3 + i) * 0.12;
      if (item.life > 0) {
        item.life -= dt;
        if (item.life <= 0) { game.scene.remove(item.group, item.ring); items.splice(i, 1); continue; }
      }
      const reach = p.vehicle ? 2.8 : 1.4;
      if (p.human.alive && Math.hypot(p.x - item.x, p.z - item.z) < reach && collect(item)) {
        if (item.respawn > 0) { item.hidden = item.respawn; item.group.visible = item.ring.visible = false; }
        else { game.scene.remove(item.group, item.ring); items.splice(i, 1); }
      }
    }
  }

  return {
    items,
    update,
    add,
    dropCash: (x, z, amount) => add('cash', x, z, { amount, life: 40 }),
    dropAmmo: (x, z, weapon) => add('ammo', x, z, { weapon, amount: Math.ceil(WEAPONS[weapon].mag * 1.5), life: 40 }),
  };
}
