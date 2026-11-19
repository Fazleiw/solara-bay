// The wanted level (police/wantedLevel.js): crimes add "heat" (one star per point, up to five), witnessed crimes
// count for more, and once no officer can see Dani the stars flash and fall away one by one
// after a search period that grows with the level.
import { WANTED } from '../config.js';

export function createWantedSystem(game) {
  const state = {
    level: 0,
    heat: 0,
    searchTimer: 0,
    seen: false,
    lastSeenX: 0,
    lastSeenZ: 0,
    shotCooldown: 0,
    locked: false, // missions can pin the level
    peak: 0, // highest level this chase reached
  };

  function copsNear(x, z, radius) {
    for (const h of game.humans) {
      if (h.role === 'cop' && h.alive && Math.hypot(h.x - x, h.z - z) < radius) return true;
    }
    for (const v of game.vehicles.list) {
      if (v.type.police && v.ai && Math.hypot(v.x - x, v.z - z) < radius) return true;
    }
    return false;
  }

  function witnesses(x, z, radius) {
    for (const h of game.humans) if (h.role === 'ped' && h.alive && Math.hypot(h.x - x, h.z - z) < radius) return true;
    return false;
  }

  /** Adds heat for a crime; `minimum` guarantees at least that many stars. */
  function crime(amount, minimum = 0) {
    if (state.locked) return;
    const before = state.level;
    state.heat = Math.min(WANTED.maxStars + 0.99, Math.max(state.heat + amount, minimum));
    state.level = Math.min(WANTED.maxStars, Math.floor(state.heat));
    if (state.level > 0) {
      state.searchTimer = 0;
      const p = game.player;
      state.lastSeenX = p.x; state.lastSeenZ = p.z;
    }
    state.peak = Math.max(state.peak, state.level);
    if (state.level > before) game.events.emit('wantedRaised', { level: state.level, before });
  }

  function setLevel(level) {
    const before = state.level;
    state.level = level;
    state.heat = level;
    state.searchTimer = 0;
    const p = game.player;
    state.lastSeenX = p.x; state.lastSeenZ = p.z;
    state.peak = Math.max(state.peak, level);
    if (level > before) game.events.emit('wantedRaised', { level, before });
  }

  function clear() {
    state.level = 0; state.heat = 0; state.searchTimer = 0; state.peak = 0;
  }

  const byPlayer = (source) => source === 'player';
  game.events.on('shotFired', ({ shooter, x, z }) => {
    if (shooter?.role !== 'player' || state.shotCooldown > 0) return;
    state.shotCooldown = 4;
    if (copsNear(x, z, 55)) crime(0.6, 1);
    else if (witnesses(x, z, 40)) crime(0.25, 1);
  });
  game.events.on('humanHurt', ({ human, source }) => {
    if (!byPlayer(source) || !human.alive) return;
    if (human.role === 'cop') crime(0.4, 2);
    else if (human.role === 'ped') crime(copsNear(human.x, human.z, 50) ? 0.3 : 0.12, copsNear(human.x, human.z, 50) ? 1 : 0);
  });
  game.events.on('humanDied', ({ human, source }) => {
    if (!byPlayer(source)) return;
    if (human.role === 'cop') crime(0.9, 2);
    else if (human.role === 'ped') crime(copsNear(human.x, human.z, 60) ? 0.7 : 0.4, 1);
  });
  game.events.on('humanRunOver', ({ human, vehicle, killed }) => {
    if (vehicle.driver !== 'player') return;
    if (human.role === 'cop') crime(killed ? 1 : 0.5, 2);
    else if (human.role === 'ped') crime(killed ? 0.5 : 0.2, copsNear(human.x, human.z, 50) || killed ? 1 : 0);
  });
  game.events.on('carJacked', ({ vehicle }) => {
    if (vehicle.type.police) crime(1, 2);
    else if (copsNear(vehicle.x, vehicle.z, 40)) crime(0.6, 1);
  });
  game.events.on('vehicleImpact', ({ vehicle, other, force }) => {
    if (other?.driver === 'player' && vehicle.type.police && vehicle.ai && force > 4) crime(0.2, 1);
  });
  game.events.on('vehicleExploded', ({ vehicle }) => {
    if (vehicle.lastHitBy === 'player' && vehicle.type.police) crime(0.8, 2);
  });

  /** Called by the police each tick with whether any unit currently sees the player. */
  function update(dt, seen) {
    state.shotCooldown = Math.max(0, state.shotCooldown - dt);
    state.seen = seen;
    if (state.level === 0 || state.locked) return;
    if (seen) {
      state.searchTimer = 0;
      const p = game.player;
      state.lastSeenX = p.x; state.lastSeenZ = p.z;
      return;
    }
    state.searchTimer += dt;
    const needed = WANTED.evadeBase + WANTED.evadePerStar * state.level;
    if (state.searchTimer >= needed) {
      state.searchTimer = 0;
      state.level -= 1;
      state.heat = state.level;
      game.events.emit('wantedDropped', { level: state.level, from: state.peak });
      if (state.level === 0) { state.peak = 0; game.events.emit('wantedCleared', {}); }
    }
  }

  return {
    state,
    crime,
    setLevel,
    clear,
    update,
    get level() { return state.level; },
    get evading() { return state.level > 0 && !state.seen; },
    /** Radius of the search zone around the last sighting, growing with the level. */
    get searchRadius() { return 45 + state.level * 18; },
    get searchProgress() { return state.searchTimer / (WANTED.evadeBase + WANTED.evadePerStar * Math.max(1, state.level)); },
  };
}
