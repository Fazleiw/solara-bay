// Bayside Arms, the gun store in Mercado: guns, ammunition, body armour and first aid. Each gun
// is unlocked for sale at a respect rank (progression/respect.js); walk into the red marker
// and press E to browse.
import { LANDMARKS } from '../world/cityLayout.js';
import { createMarker } from '../gameplay/markers.js';
import { WEAPONS, giveWeapon, weaponUnlocked } from '../combat/weapons.js';

export const STORE_ITEMS = [
  { id: 'pistol', label: 'Kobra 9 pistol', price: WEAPONS.pistol.price, detail: '12-round sidearm' },
  { id: 'pistolAmmo', label: 'Kobra 9 rounds x36', price: WEAPONS.pistol.ammoPrice, needs: 'pistol' },
  { id: 'smg', label: 'Rattler SMG', price: WEAPONS.smg.price, detail: 'Fully automatic' },
  { id: 'smgAmmo', label: 'Rattler rounds x90', price: WEAPONS.smg.ammoPrice, needs: 'smg' },
  { id: 'shotgun', label: 'Breaker 12 shotgun', price: WEAPONS.shotgun.price, detail: 'Close-range stopper' },
  { id: 'shotgunAmmo', label: 'Breaker shells x18', price: WEAPONS.shotgun.ammoPrice, needs: 'shotgun' },
  { id: 'carbine', label: 'Longreach AR', price: WEAPONS.carbine.price, detail: 'Long-range rifle' },
  { id: 'carbineAmmo', label: 'Longreach rounds x90', price: WEAPONS.carbine.ammoPrice, needs: 'carbine' },
  { id: 'armor', label: 'Body armour', price: 250 },
  { id: 'health', label: 'First aid kit', price: 100 },
];

export function createGunStore(game) {
  const marker = createMarker(game, LANDMARKS.gunShop.front.x, LANDMARKS.gunShop.front.z, '#ff5050', { radius: 1.6, height: 4, label: 'Bayside Arms' });

  /** Why an item can't be bought right now, or null. */
  function lockReason(item) {
    const gun = WEAPONS[item.id] ?? WEAPONS[item.needs];
    if (gun && !weaponUnlocked(gun.id, game.respect.rank)) return `Respect ${gun.rank}`;
    return null;
  }

  function buy(id) {
    const item = STORE_ITEMS.find((i) => i.id === id);
    if (!item) return 'Unknown item';
    const locked = lockReason(item);
    if (locked) return `Unlocks at ${locked}`;
    if (game.state.cash < item.price) return 'Not enough cash';
    const inv = game.player.inventory;
    const h = game.player.human;
    if (item.needs && !inv.owned[item.needs]) return `Buy the ${WEAPONS[item.needs].name} first`;
    if (WEAPONS[id]) {
      giveWeapon(inv, id, WEAPONS[id].mag * 2);
      inv.current = id;
    } else if (id.endsWith('Ammo')) {
      const w = id.replace('Ammo', '');
      giveWeapon(inv, w, WEAPONS[w].ammoPack);
    } else if (id === 'armor') {
      if (h.armor >= 100) return 'Armour is already full';
      h.armor = 100;
    } else if (id === 'health') {
      if (h.health >= h.maxHealth) return 'Health is already full';
      h.health = h.maxHealth;
    }
    game.addCash(-item.price);
    game.audio?.sfx.pickup(true);
    return `Bought ${item.label}`;
  }

  /** The store prompt while standing in its marker; E opens the counter. */
  function update(input) {
    const p = game.player;
    if (p.vehicle || !marker.contains(p.x, p.z, 0.5)) return null;
    if (input.pressed('interact')) game.ui.openShop();
    return 'Press E to browse Bayside Arms';
  }

  return { items: STORE_ITEMS, buy, lockReason, update, marker };
}
