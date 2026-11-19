// Weapon definitions: fists and four guns, with damage, fire rate, spread, magazine size, price
// at Bayside Arms and the respect rank that unlocks each one there. Guns are hitscan; the
// shotgun fires a spread of pellets. The HUD weapon bar shows all five slots, locked or not.

export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', short: 'FISTS', slot: 1, melee: true, damage: 20, rate: 0.42, range: 1.9, rank: 1 },
  pistol: { id: 'pistol', name: 'Kobra 9', short: 'KOBRA 9', slot: 2, damage: 30, rate: 0.24, spread: 0.012, mag: 12, range: 130, auto: false, sound: 'pistol', price: 400, ammoPrice: 60, ammoPack: 36, rank: 1 },
  smg: { id: 'smg', name: 'Rattler SMG', short: 'RATTLER', slot: 3, damage: 16, rate: 0.085, spread: 0.034, mag: 30, range: 95, auto: true, sound: 'smg', price: 1500, ammoPrice: 120, ammoPack: 90, rank: 2 },
  shotgun: { id: 'shotgun', name: 'Breaker 12', short: 'BREAKER', slot: 4, damage: 14, pellets: 8, rate: 0.85, spread: 0.075, mag: 6, range: 45, auto: false, sound: 'shotgun', price: 2200, ammoPrice: 100, ammoPack: 18, rank: 5 },
  carbine: { id: 'carbine', name: 'Longreach AR', short: 'LONGREACH', slot: 5, damage: 26, rate: 0.12, spread: 0.014, mag: 30, range: 150, auto: true, sound: 'smg', price: 3800, ammoPrice: 160, ammoPack: 90, rank: 6 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'carbine'];

/** Is this weapon unlocked for sale at the player's respect rank? */
export function weaponUnlocked(id, rank) {
  return rank >= WEAPONS[id].rank;
}

/** A fresh inventory: fists only. Guns are { mag, reserve }. */
export function createInventory() {
  return { current: 'fists', owned: { fists: { mag: Infinity, reserve: 0 } } };
}

export function giveWeapon(inventory, id, ammo) {
  const def = WEAPONS[id];
  if (!inventory.owned[id]) inventory.owned[id] = { mag: 0, reserve: 0 };
  const slot = inventory.owned[id];
  slot.reserve += ammo;
  if (slot.mag === 0) {
    const load = Math.min(def.mag, slot.reserve);
    slot.mag += load;
    slot.reserve -= load;
  }
}

/** Moves rounds from reserve into the magazine; returns true when anything was loaded. */
export function reload(inventory) {
  const def = WEAPONS[inventory.current];
  const slot = inventory.owned[inventory.current];
  if (!def || def.melee || !slot || slot.mag >= def.mag || slot.reserve <= 0) return false;
  const load = Math.min(def.mag - slot.mag, slot.reserve);
  slot.mag += load;
  slot.reserve -= load;
  return true;
}

/** Cycles to the next (or previous) owned weapon. */
export function cycleWeapon(inventory, direction) {
  const owned = WEAPON_ORDER.filter((id) => inventory.owned[id]);
  const i = owned.indexOf(inventory.current);
  inventory.current = owned[(i + direction + owned.length) % owned.length];
}
