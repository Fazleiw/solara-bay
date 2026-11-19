// Tavo's Chrome & Paint, the garage in Deco Row: drive into the cyan bay and press E to open
// the workshop menu (ui/garageMenu.js). Services: repair, a respray that loses the police
// (new colour, wanted level cleared), three stages of engine tune, armour plating and race
// brakes, each tier gated by respect rank. An upgraded car becomes Dani's personal ride and is
// saved with the game. Tavo himself waits at the workshop door in his cap and overalls.
import { LANDMARKS } from '../world/cityLayout.js';
import { createMarker } from '../gameplay/markers.js';
import { VEHICLE_TYPES } from '../vehicles/vehicleTypes.js';
import { Human } from '../characters/human.js';

const TAVO_LOOK = { skin: '#f1c27d', hair: '#2b2b2b', shirt: '#3a86ff', pants: '#1d2b44', shoes: '#111111', vest: '#24324f', hairStyle: 0, height: 1.02, hat: '#3a86ff' };

const RESPRAY_COLORS = ['#ff6b1a', '#e0115f', '#00b4d8', '#ffd23f', '#7b2cbf', '#2d6a4f', '#f8f9fa', '#111111', '#3a86ff'];

/** The upgrade lines: price and respect rank needed for each stage. */
export const UPGRADES = {
  engine: { label: 'Engine tune', stages: [{ price: 1200, rank: 1 }, { price: 2400, rank: 2 }, { price: 4200, rank: 4 }], detail: '+7% top speed, +12% acceleration' },
  armor: { label: 'Armour plating', stages: [{ price: 1500, rank: 3 }, { price: 3000, rank: 3 }, { price: 5000, rank: 5 }], detail: '+30% body strength' },
  brakes: { label: 'Race brakes', stages: [{ price: 900, rank: 4 }, { price: 1800, rank: 4 }], detail: '+15% stopping power' },
};

// Stat bars compare against the best any car can reach with every upgrade.
const MAX = (() => {
  const all = Object.values(VEHICLE_TYPES);
  return {
    speed: Math.max(...all.map((t) => t.maxSpeed)) * 1.21,
    accel: Math.max(...all.map((t) => t.accel)) * 1.36,
    brake: Math.max(...all.map((t) => t.brake)) * 1.3,
    armor: Math.max(...all.map((t) => t.health)) * 1.9,
  };
})();

/** A car's four stat bars, 0-1, optionally with one upgrade stage added. */
export function carStats(car, preview = null) {
  const tune = { ...car.tune };
  if (preview) tune[preview] += 1;
  const t = car.type;
  return {
    speed: (t.maxSpeed * (1 + tune.engine * 0.07)) / MAX.speed,
    accel: (t.accel * (1 + tune.engine * 0.12)) / MAX.accel,
    brake: (t.brake * (1 + tune.brakes * 0.15)) / MAX.brake,
    armor: (t.health * (1 + tune.armor * 0.3)) / MAX.armor,
  };
}

export function createGarage(game) {
  const bay = { x: LANDMARKS.tavoGarage.x, z: LANDMARKS.tavoGarage.z - 13 };
  const marker = createMarker(game, bay.x, bay.z, '#3ef2ff', { radius: 3.4, height: 5, label: "Tavo's Chrome & Paint" });
  let tavo = null;

  /** Puts Tavo at his workshop door, facing the bay, once Dani has met him. */
  function placeTavo() {
    if (tavo) return;
    tavo = new Human(game, { x: bay.x + 6.2, z: bay.z + 6.4, heading: Math.PI * 0.8, look: TAVO_LOOK, role: 'npc', health: 5000 });
    tavo.syncMesh(0);
  }

  function repairPrice(car) { return Math.round((1 - car.condition) * 400 / 10) * 10 + 50; }

  /** Every service on offer for this car, with price and lock state. */
  function services(car) {
    const rank = game.respect.rank;
    const list = [
      { id: 'repair', label: 'Repair', detail: `Condition ${Math.round(car.condition * 100)}%`, price: repairPrice(car), done: car.condition >= 0.999 },
      { id: 'respray', label: 'Respray', detail: game.wanted.level ? 'New colour · loses the heat' : 'New colour', price: 250 + game.wanted.level * 150, heat: game.wanted.level > 0 },
    ];
    for (const [id, up] of Object.entries(UPGRADES)) {
      const stage = car.tune[id];
      const next = up.stages[stage];
      list.push({
        id, upgrade: true, label: `${up.label}${next ? ` ${stage + 1}` : ''}`, detail: next ? up.detail : 'Fully upgraded',
        price: next?.price ?? 0, stage, stages: up.stages.length, done: !next, lockedRank: next && next.rank > rank ? next.rank : null,
      });
    }
    return list;
  }

  /** Buys a service for the car in the bay; returns a status line. */
  function buy(car, id) {
    const service = services(car).find((s) => s.id === id);
    if (!service) return 'Not available';
    if (service.done) return service.upgrade ? 'Already maxed out' : 'Nothing to fix';
    if (service.lockedRank) return `Unlocks at Respect ${service.lockedRank}`;
    if (game.state.cash < service.price) return 'Not enough cash';
    game.addCash(-service.price);
    if (id === 'repair') car.repair();
    else if (id === 'respray') {
      const colors = RESPRAY_COLORS.filter((c) => c !== car.color);
      car.repaint(colors[(game.state.stats.resprays ?? 0) % colors.length]);
      game.state.stats.resprays = (game.state.stats.resprays ?? 0) + 1;
      car.repair();
      if (game.wanted.level) {
        game.wanted.clear();
        game.police.reset();
        game.hud.toast('HEAT LOST', 'Fresh paint, new plates', '#3ef2ff');
      }
      game.audio?.sfx.respray();
    } else {
      car.tune[id] += 1;
      if (id === 'armor') car.health = car.maxHealth;
      game.audio?.sfx.pickup(true);
    }
    // Any car Tavo has worked on becomes Dani's own and is kept in the save.
    car.personal = true;
    car.persistent = true;
    game.state.personalCar = { type: car.type.id, color: car.color, tune: { ...car.tune } };
    game.autosave();
    return `${service.label} done`;
  }

  /** The drive-in prompt; E opens the workshop menu. */
  function update(input) {
    const p = game.player;
    const open = game.state.storyProgress >= 2;
    marker.setVisible(open);
    if (open) placeTavo();
    if (!open || !p.vehicle || !marker.contains(p.x, p.z, 1) || game.missions.active?.blocksShops) return null;
    if (input.pressed('interact')) game.ui.openGarage();
    return "Press E to open Tavo's workshop";
  }

  return { bay, marker, services, buy, update, placeTavo, stats: carStats, upgrades: UPGRADES };
}
