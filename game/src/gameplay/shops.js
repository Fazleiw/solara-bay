// Places to spend money and to save: Bayside Arms (guns, ammo, armour, first aid), Tavo's
// Respray (drive in to repair the car and shake off the police, once Tavo trusts you) and the
// safehouse door, where the game is saved.
import { LANDMARKS } from '../world/cityLayout.js';
import { createMarker } from './markers.js';
import { WEAPONS, giveWeapon } from '../combat/weapons.js';

export const SHOP_ITEMS = [
  { id: 'pistol', label: 'Kobra 9 pistol', price: WEAPONS.pistol.price, detail: '12-round sidearm' },
  { id: 'pistolAmmo', label: 'Kobra 9 rounds x36', price: WEAPONS.pistol.ammoPrice, needs: 'pistol' },
  { id: 'smg', label: 'Rattler SMG', price: WEAPONS.smg.price, detail: 'Fully automatic' },
  { id: 'smgAmmo', label: 'Rattler rounds x90', price: WEAPONS.smg.ammoPrice, needs: 'smg' },
  { id: 'shotgun', label: 'Breaker 12 shotgun', price: WEAPONS.shotgun.price, detail: 'Close-range stopper' },
  { id: 'shotgunAmmo', label: 'Breaker shells x18', price: WEAPONS.shotgun.ammoPrice, needs: 'shotgun' },
  { id: 'armor', label: 'Body armour', price: 250 },
  { id: 'health', label: 'First aid kit', price: 100 },
];
export const RESPRAY_PRICE = 250;

export function createShops(game) {
  const armsMarker = createMarker(game, LANDMARKS.gunShop.front.x, LANDMARKS.gunShop.front.z, '#ff5050', { radius: 1.6, height: 4, label: 'Bayside Arms' });
  const resprayMarker = createMarker(game, LANDMARKS.tavoGarage.x, LANDMARKS.tavoGarage.z - 13, '#3ef2ff', { radius: 3.4, height: 5, label: 'Respray' });
  const saveMarker = createMarker(game, LANDMARKS.safehouse.front.x, LANDMARKS.safehouse.front.z, '#7dffb3', { radius: 1.6, height: 4, label: 'Save' });

  function buy(id) {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return 'Unknown item';
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

  /** Shows the right prompt and handles E at each place. Returns the prompt text or null. */
  function update(input) {
    const p = game.player;
    resprayMarker.setVisible(game.state.storyProgress >= 2);
    if (game.missions.active?.blocksShops) return null;
    if (!p.vehicle && armsMarker.contains(p.x, p.z, 0.5)) {
      if (input.pressed('interact')) game.ui.openShop();
      return 'Press E to browse Bayside Arms';
    }
    if (!p.vehicle && saveMarker.contains(p.x, p.z, 0.5)) {
      if (input.pressed('interact')) {
        game.autosave();
        game.hud.notify('Game saved');
      }
      return 'Press E to save your progress';
    }
    if (p.vehicle && resprayMarker.visible && resprayMarker.contains(p.x, p.z, 1)) {
      if (input.pressed('interact')) {
        if (game.state.cash < RESPRAY_PRICE) game.hud.notify('Tavo: "No cash, no paint."');
        else {
          game.addCash(-RESPRAY_PRICE);
          p.vehicle.repair();
          game.wanted.clear();
          game.police.reset();
          game.hud.bigMessage('RESPRAYED', 'Car repaired · wanted level cleared', '#3ef2ff');
          game.audio?.sfx.respray();
        }
      }
      return `Press E for a respray and repair ($${RESPRAY_PRICE})`;
    }
    return null;
  }

  return { buy, update, items: SHOP_ITEMS, markers: { armsMarker, resprayMarker, saveMarker } };
}
