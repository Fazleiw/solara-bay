// The HUD weapon bar, top right: five slots (fists, Kobra 9, Rattler SMG, Breaker 12,
// Longreach AR) with painted silhouettes. The selected slot is lit with its magazine and
// reserve; guns Dani doesn't own show their price or the respect rank that unlocks them.
import { WEAPONS, WEAPON_ORDER, weaponUnlocked } from '../combat/weapons.js';

/** Paints a weapon silhouette into a slot canvas. */
export function drawWeaponIcon(canvas, id, color = '#fff') {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  const shape = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.closePath(); ctx.stroke(); ctx.fill(); };
  if (id === 'fists') {
    ctx.beginPath(); ctx.roundRect(w * 0.3, h * 0.22, w * 0.4, h * 0.56, 10); ctx.stroke(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (let i = 1; i < 4; i += 1) ctx.fillRect(w * 0.3 + i * w * 0.1, h * 0.24, 2, h * 0.24);
  } else if (id === 'pistol') {
    shape([[0.26, 0.28], [0.76, 0.28], [0.76, 0.46], [0.52, 0.46], [0.48, 0.82], [0.34, 0.82], [0.36, 0.46], [0.26, 0.46]]);
  } else if (id === 'smg') {
    shape([[0.08, 0.3], [0.86, 0.3], [0.86, 0.5], [0.6, 0.5], [0.57, 0.88], [0.47, 0.88], [0.49, 0.5], [0.3, 0.5], [0.24, 0.64], [0.08, 0.64]]);
  } else if (id === 'shotgun') {
    shape([[0.04, 0.4], [0.95, 0.34], [0.95, 0.47], [0.42, 0.5], [0.3, 0.72], [0.12, 0.72], [0.18, 0.5], [0.04, 0.52]]);
  } else {
    shape([[0.03, 0.42], [0.2, 0.36], [0.62, 0.36], [0.64, 0.3], [0.97, 0.32], [0.97, 0.42], [0.62, 0.46], [0.58, 0.8], [0.5, 0.8], [0.48, 0.48], [0.22, 0.5], [0.18, 0.66], [0.04, 0.62]]);
  }
}

export function createWeaponBar(game) {
  const root = document.getElementById('hud-weapons');
  root.innerHTML = WEAPON_ORDER.map((id) => `<div class="wslot" data-id="${id}"><span class="key">${WEAPONS[id].slot}</span><canvas width="96" height="48"></canvas><b></b><small></small></div>`).join('');
  const slots = WEAPON_ORDER.map((id) => {
    const node = root.querySelector(`[data-id="${id}"]`);
    return { id, node, canvas: node.querySelector('canvas'), ammo: node.querySelector('b'), label: node.querySelector('small'), key: '' };
  });

  function render() {
    const inv = game.player.inventory;
    const rank = game.respect.rank;
    for (const slot of slots) {
      const def = WEAPONS[slot.id];
      const owned = inv.owned[slot.id];
      const unlocked = weaponUnlocked(slot.id, rank);
      const selected = inv.current === slot.id;
      const status = selected ? 'selected' : owned ? 'owned' : unlocked ? 'buy' : 'locked';
      const ammo = !owned ? '' : def.melee ? '∞' : `${owned.mag}/${owned.reserve}`;
      const label = selected ? def.short : status === 'locked' ? `RESPECT ${def.rank}` : status === 'buy' ? `$${def.price.toLocaleString('en-US')}` : def.short;
      const key = `${status}|${ammo}|${label}`;
      if (key === slot.key) continue;
      if (slot.key.split('|')[0] !== status) drawWeaponIcon(slot.canvas, slot.id, status === 'selected' ? '#ffffff' : status === 'owned' ? '#d8dde6' : 'rgba(150,158,175,0.55)');
      slot.key = key;
      slot.node.className = `wslot ${status}`;
      slot.ammo.textContent = status === 'locked' ? '🔒' : ammo;
      slot.label.textContent = label;
    }
  }

  return { render };
}
