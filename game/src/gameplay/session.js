// The play session: progress state (cash, story, medallions, stats), new game and continue,
// saving to localStorage, the WASTED and BUSTED sequences with their hospital and police
// station respawns, and the running statistics.
import { loadGame, saveGame } from '../core/save.js';
import { createInventory, giveWeapon, WEAPONS } from '../combat/weapons.js';
import { LANDMARKS, isWalkable } from '../world/cityLayout.js';

export function freshState() {
  return {
    cash: 350,
    storyProgress: 0,
    medallions: [],
    stats: { missionsPassed: 0, kills: 0, carsStolen: 0, wasted: 0, busted: 0, distance: 0, taxiFares: 0, tacoRuns: 0 },
  };
}

export function createSession(game) {
  const session = { deathTimer: 0, deathKind: null };
  const enteredCars = new WeakSet();

  game.addCash = (amount) => {
    game.state.cash = Math.max(0, game.state.cash + amount);
    if (amount > 0) game.audio?.sfx.pickup(true);
  };

  function snapshot() {
    const p = game.player;
    return {
      cash: game.state.cash,
      storyProgress: game.state.storyProgress,
      medallions: game.state.medallions,
      stats: game.state.stats,
      weapons: Object.fromEntries(Object.entries(p.inventory.owned).filter(([id]) => id !== 'fists').map(([id, s]) => [id, s.mag + s.reserve])),
      health: p.human.health,
      armor: p.human.armor,
      hour: game.world.dayNight.state.hour,
      x: p.x,
      z: p.z,
    };
  }

  game.autosave = () => { if (!game.shotMode) saveGame(snapshot()); };

  function resetWorldState() {
    game.missions.abort?.();
    game.side.cancel(false);
    game.wanted.clear();
    game.police.reset();
    game.gangs.clear();
    game.dialogue.clear();
    game.hud.setObjective(null);
  }

  session.newGame = () => {
    resetWorldState();
    game.state = freshState();
    game.player.inventory = createInventory();
    game.player.revive();
    game.player.human.armor = 0;
    const s = LANDMARKS.safehouse.front;
    game.player.teleport(s.x - 1, s.z, -Math.PI / 2);
    game.camera.alignBehind(-Math.PI / 2);
    game.world.dayNight.setHour(17.2);
    game.collectibles.build();
    game.missions.refreshStartMarker();
    game.missions.startById('homecoming');
  };

  session.continueGame = () => {
    const data = loadGame();
    if (!data) { session.newGame(); return; }
    resetWorldState();
    game.state = { ...freshState(), cash: data.cash, storyProgress: data.storyProgress, medallions: data.medallions ?? [], stats: { ...freshState().stats, ...(data.stats ?? {}) } };
    const inv = createInventory();
    for (const [id, ammo] of Object.entries(data.weapons ?? {})) if (WEAPONS[id]) giveWeapon(inv, id, ammo);
    game.player.inventory = inv;
    game.player.revive();
    game.player.human.health = Math.max(30, data.health ?? 100);
    game.player.human.armor = data.armor ?? 0;
    const spot = isWalkable(data.x, data.z) ? { x: data.x, z: data.z } : LANDMARKS.safehouse.front;
    game.player.teleport(spot.x, spot.z);
    game.world.dayNight.setHour(data.hour ?? 17);
    game.collectibles.build();
    game.missions.refreshStartMarker();
    game.hud.notify('Welcome back to Solara Bay');
  };

  function beginDeath(kind) {
    if (session.deathKind) return;
    session.deathKind = kind;
    session.deathTimer = 0;
    if (game.player.vehicle && kind === 'busted') game.player.exitVehicle(true);
    game.player.controlsLocked = true;
    game.hud.setWasted(true);
    game.audio?.sfx.wasted();
    game.state.stats[kind] += 1;
    game.events.emit(kind === 'wasted' ? 'playerWasted' : 'playerBustedFinal', {});
  }

  game.events.on('humanDied', ({ human, source }) => {
    if (human.role === 'player') beginDeath('wasted');
    else if (source === 'player') game.state.stats.kills += 1;
  });
  game.events.on('playerBusted', () => beginDeath('busted'));
  game.events.on('playerEnteredVehicle', ({ vehicle }) => {
    if (!enteredCars.has(vehicle) && !vehicle.mission) { enteredCars.add(vehicle); game.state.stats.carsStolen += 1; }
    game.audio?.radio.turnOn();
  });
  game.events.on('playerExitedVehicle', () => game.audio?.radio.turnOff());

  /** Runs the death sequence; returns the time scale the world should run at. */
  session.update = (dt) => {
    const p = game.player;
    if (p.vehicle) game.state.stats.distance += p.vehicle.speed * dt;
    if (!session.deathKind) return 1;
    session.deathTimer += dt;
    if (session.deathTimer > 0.6 && session.deathTimer - dt <= 0.6) {
      game.hud.bigMessage(session.deathKind === 'wasted' ? 'WASTED' : 'BUSTED', session.deathKind === 'wasted' ? 'St. Marisol Medical will patch you up · $200' : 'Bay Police keep your fine and some ammo', session.deathKind === 'wasted' ? '#ff4040' : '#5aa0ff', 3.2);
    }
    if (session.deathTimer > 4.2) respawn();
    return 0.35;
  };

  function respawn() {
    const kind = session.deathKind;
    session.deathKind = null;
    game.hud.setWasted(false);
    resetWorldState();
    const p = game.player;
    p.revive();
    p.controlsLocked = false;
    const spot = kind === 'wasted' ? LANDMARKS.hospital.front : LANDMARKS.policeHQ.front;
    p.teleport(spot.x, spot.z, kind === 'wasted' ? 0 : -Math.PI / 2);
    game.camera.alignBehind(p.human.heading);
    game.addCash(-Math.min(game.state.cash, kind === 'wasted' ? 200 : Math.max(150, Math.round(game.state.cash * 0.1))));
    if (kind === 'busted') for (const slot of Object.values(p.inventory.owned)) if (Number.isFinite(slot.reserve)) slot.reserve = Math.floor(slot.reserve / 2);
    game.missions.refreshStartMarker();
    game.world.dayNight.setHour(game.world.dayNight.state.hour + 1.5);
  }

  session.isDead = () => !!session.deathKind;
  return session;
}
