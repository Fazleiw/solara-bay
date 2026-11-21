// ?selftest=1: a scripted play-through of every system in fast-forward (new game, carjacking and
// the witness call, driving and drifting, the radio, gunfire, the wanted level, the police
// dispatch roster, GULL ONE and roadblocks, busted, wasted, all eight story chapters, both
// Gold Coast Getaway drops, both side jobs, respect ranks, the gun store, the garage upgrades,
// the menus, wet night roads and save/continue). Each step reports pass or the error it threw,
// so a headless browser can check the whole game in one load.
import { STEP } from '../config.js';
import { giveWeapon } from '../combat/weapons.js';
import { deleteSave, loadGame, saveGame } from '../core/save.js';
import { hydrateState } from '../gameplay/session.js';
import { CHAPTERS } from '../missions/chapters.js';
import { isOnBlock, isWalkable, LANDMARKS } from '../world/cityLayout.js';

export function runSelfTest(game, { simulate, input, session, interactions }, report) {
  const results = [];
  const run = (seconds, keys = [], taps = [], extra = {}) => {
    input.simulate(keys);
    Object.assign(input.state, { aim: false, fire: false, ...extra });
    taps.forEach((t) => input.tap(t));
    for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
      interactions(STEP);
      simulate(STEP);
      game.camera.update(STEP, input, game.settings);
      game.hud.update(STEP);
      game.dialogue.update(STEP);
      game.effects.update(STEP, game.camera.camera, 720);
      input.consumePresses();
      session.update(STEP);
    }
  };
  const step = (name, fn) => {
    try { fn(); results.push(`ok ${name}`); } catch (error) { results.push(`FAIL ${name}: ${error.message} ${error.stack?.split('\n')[1] ?? ''}`); }
  };
  const p = game.player;

  step('audio engine', () => {
    game.audio.unlock();
    if (!game.audio.ctx) throw new Error('no AudioContext');
    const fx = game.audio.sfx;
    fx.gunshot('pistol', p.x + 5, p.z); fx.gunshot('smg'); fx.gunshot('shotgun', p.x, p.z + 3);
    fx.explosion(p.x, p.z); fx.crash(0.8, p.x, p.z); fx.punch(true, p.x, p.z); fx.horn(1); fx.horn(0.9, p.x, p.z);
    fx.scream(p.x, p.z); fx.pickup(true); fx.collect(); fx.checkpoint(); fx.missionStart(); fx.missionPassed();
    fx.missionFailed(); fx.wasted(); fx.click(); fx.reload(); fx.door(); fx.respray(); fx.staticBurst(); fx.uiSelect();
    for (let i = 0; i < 6; i += 1) game.audio.radio.next();
    game.audio.setSiren(0.8);
    game.audio.setHelicopter(0.5);
    game.audio.update(0.016, false);
  });
  step('new game', () => { session.newGame(); run(1.5); });
  step('steal a car', () => {
    run(2);
    const car = game.vehicles.nearestVehicle(p.x, p.z, 400, (v) => !v.destroyed && v.driver && v.driver !== 'player');
    if (!car) throw new Error('no traffic car found');
    p.teleport(car.x + 3, car.z);
    run(0.1, [], ['KeyF']);
    if (p.vehicle !== car) throw new Error('did not enter the car');
  });
  step('drive, drift, horn, radio', () => {
    const start = { x: p.x, z: p.z };
    run(2.5, ['KeyW']);
    const moved = Math.hypot(p.x - start.x, p.z - start.z);
    if (moved < 5) throw new Error(`car barely moved (${moved.toFixed(1)} m)`);
    run(1.0, ['KeyW', 'KeyA', 'Space']);
    run(0.2, [], ['KeyH', 'KeyR']);
  });
  step('exit car', () => { run(1.5, ['KeyS']); run(0.1, [], ['KeyF']); run(0.5); if (p.vehicle) throw new Error('still in car'); });
  step('gunfire and wanted', () => {
    giveWeapon(p.inventory, 'pistol', 48);
    p.inventory.current = 'pistol';
    run(0.6, [], [], { aim: true, fire: true, firePressed: true });
    game.wanted.setLevel(3);
    run(6);
    if (!game.police.units.length) throw new Error('no police units spawned');
  });
  step('helicopter, roadblock and dispatch', () => {
    const car = game.vehicles.spawn('vantor', p.x + 4, p.z, 0);
    p.enterVehicle(car);
    game.wanted.setLevel(5);
    run(0.8, ['KeyW']);
    if (!game.police.helicopter.state.active) throw new Error(`no helicopter at ${game.wanted.level} stars`);
    const block = game.police.roadblocks.buildAt(p.x + 60, p.z, 0);
    if (block.cars.length !== 2) throw new Error('roadblock without cruisers');
    const { rows } = game.police.roster(5);
    if (!rows.length || !rows.every((r) => r.callsign && r.status.label)) throw new Error('dispatch roster incomplete');
    if (!rows.some((r) => r.status.label === 'ROADBLOCK')) throw new Error('roadblock missing from the roster');
    run(3);
    p.exitVehicle(true);
  });
  step('witness call', () => {
    game.wanted.clear();
    game.police.reset();
    game.peds.spawnNear(p.x, p.z, 3, 8);
    const target = game.vehicles.spawn('mirela', p.x + 3, p.z, 0);
    game.events.emit('carJacked', { vehicle: target, driver: null });
    run(4.5);
    if (game.witnesses.pending.length) throw new Error('witness call never resolved');
  });
  step('busted', () => { game.events.emit('playerBusted', {}); run(5.5); if (session.isDead()) throw new Error('did not respawn'); });
  step('wasted: clear hospital respawn and camera', () => {
    const cash = game.state.cash, progress = game.state.storyProgress;
    p.human.takeDamage(1000, null);
    if (!session.isDead()) throw new Error('did not enter WASTED');
    for (let i = 0; session.isDead() && i < 6 / STEP; i += 1) run(STEP);
    if (session.isDead() || !p.human.alive || p.controlsLocked || p.vehicle) throw new Error('did not revive on foot with controls');
    if (game.state.cash !== Math.max(0, cash - 200) || game.state.storyProgress !== progress) throw new Error('respawn changed the fine or story progress');

    // Check the teleport before physics can push Dani out of a bad spawn.
    const { x, z } = p;
    const h = p.human, hospital = LANDMARKS.hospital, collision = game.world.collision;
    if (!isWalkable(x, z) || !isOnBlock(x, z) || Math.hypot(x - hospital.x, z - hospital.z) > 30 || collision.resolveCircle(x, z, h.radius, h.y).hit) {
      throw new Error(`blocked or off the hospital lot at (${x}, ${z})`);
    }
    // The first foot-camera tick should keep the full boom and look away from the hospital.
    run(STEP);
    const camera = game.camera;
    const lens = camera.position, forward = camera.forward();
    const chestY = h.y + 1.55;
    const boom = Math.hypot(lens.x - p.x, lens.y - chestY, lens.z - p.z);
    if (boom < camera.state.distance - 0.05 || !collision.lineOfSight(p.x, chestY, p.z, lens.x, lens.y, lens.z)) {
      throw new Error(`camera crowded at ${boom.toFixed(2)} m (wanted ${camera.state.distance.toFixed(2)} m)`);
    }
    if (forward.x * (x - hospital.x) + forward.z * (z - hospital.z) <= 0) throw new Error('camera faces back toward the hospital');
    run(0.5, ['KeyW']);
    input.simulate([]);
    if ((p.x - x) * forward.x + (p.z - z) * forward.z < 1) throw new Error('Dani cannot walk away after respawn');
  });
  step('explosion', () => {
    const car = game.vehicles.list.find((v) => !v.destroyed && v !== p.vehicle);
    if (car) { car.damage(5000, 'player'); run(5.5); if (!car.destroyed) throw new Error('car did not explode'); }
  });
  step('eight chapters', () => { if (CHAPTERS.length !== 8) throw new Error(`${CHAPTERS.length} chapters`); });
  for (const def of CHAPTERS) {
    step(`mission ${def.id}`, () => {
      game.wanted.clear();
      game.police.reset();
      if (def.start) p.teleport(def.start.x, def.start.z);
      game.missions.startById(def.id);
      if (!game.missions.active) throw new Error('mission did not start');
      run(3, ['KeyW']);
      game.missions.abort();
      run(0.5);
    });
  }
  // Gold Coast Getaway's two drops: wreck the truck, grab the case, then stash it either way.
  const escapeTo = (drop) => {
    game.wanted.clear();
    game.police.reset();
    const index = CHAPTERS.findIndex((c) => c.id === 'goldcoast');
    game.state.storyProgress = index;
    const ctx = game.missions.startById('goldcoast');
    const truck = ctx.data.truck;
    truck.damage(truck.maxHealth * 0.85, 'player');
    run(0.2);
    if (ctx.stageIndex !== 1) throw new Error(`truck wrecked but stage ${ctx.stageIndex}`);
    if (p.vehicle) p.exitVehicle(true);
    p.teleport(ctx.current.x, ctx.current.z);
    run(0.2);
    if (ctx.stageIndex !== 2 || game.wanted.level !== 4) throw new Error(`case grabbed but stage ${ctx.stageIndex}, ${game.wanted.level} stars`);
    run(0.2);
    const spot = drop === 'coco' ? ctx.data.cocoDrop : ctx.current;
    const car = game.vehicles.spawn('vantor', spot.x, spot.z - 9, 0);
    p.teleport(car.x - 2, car.z);
    p.enterVehicle(car);
    // A cruiser right beside Dani: Coco keeps her door shut, Tavo still takes the car in.
    const unit = game.police.spawnUnitAt(car.x + 5, car.z, 0);
    car.x = spot.x; car.z = spot.z; car.vx = car.vz = 0;
    run(0.3);
    if (drop === 'coco') {
      if (ctx.stageIndex !== 2) throw new Error('Coco opened with a cruiser watching');
      if (!/break line of sight/.test(ctx.objectiveText)) throw new Error(`objective "${ctx.objectiveText}"`);
      game.police.reset();
      game.vehicles.remove(unit.car);
      run(0.5);
    }
    run(0.3);
    if (game.missions.active) throw new Error(`still on stage ${ctx.stageIndex}: ${ctx.objectiveText}`);
    if (game.state.choices.goldcoastDrop !== drop) throw new Error(`choice saved as ${game.state.choices.goldcoastDrop}`);
    if (game.state.storyProgress !== index + 1) throw new Error(`story progress ${game.state.storyProgress}`);
    if (p.vehicle) p.exitVehicle(true);
    run(0.5);
  };
  const tryEscape = (drop) => { try { escapeTo(drop); } finally { game.missions.abort(); } };
  step("gold coast: Tavo's garage under fire", () => tryEscape('tavo'));
  step("gold coast: Coco's door only when unseen", () => tryEscape('coco'));
  step('taxi fares', () => {
    const cab = game.vehicles.spawn('solcab', p.x + 4, p.z, 0);
    p.enterVehicle(cab);
    run(0.1, [], ['KeyT']);
    run(1.5);
    if (!game.side.active) throw new Error('taxi job did not start');
    game.side.cancel(false);
    p.exitVehicle(true);
  });
  step('taco run', () => {
    const m = LANDMARKS.cocoShack;
    p.teleport(m.x + 6, m.z + 9);
    run(0.2);
    run(0.1, [], ['KeyE']);
    run(1);
    if (!game.side.active) throw new Error('taco run did not start');
    game.side.cancel(false);
  });
  step('street race ordering, payout and cleanup', () => {
    game.wanted.clear();
    game.police.reset();
    const race = game.side.race;
    const car = game.vehicles.spawn('mirela', race.start.x, race.start.z, race.start.heading, { color: '#e0115f' });
    p.enterVehicle(car);
    run(0.1, [], ['KeyE']);
    if (game.side.active?.kind !== 'race') throw new Error('race did not start from the E prompt in a car');

    // Visiting checkpoint two first must not advance or pay anything.
    const skipped = race.checkpoints[1];
    car.x = skipped.x; car.z = skipped.z; car.vx = car.vz = 0;
    run(0.1);
    if (game.side.active?.checkpoint !== 0) throw new Error('race accepted a skipped checkpoint');

    const cash = game.state.cash, respect = game.state.respect, wins = game.state.stats.streetRaces;
    for (let i = 0; i < race.checkpoints.length; i += 1) {
      const point = race.checkpoints[i];
      car.x = point.x; car.z = point.z; car.vx = car.vz = 0;
      run(0.1);
      if (i < race.checkpoints.length - 1 && game.side.active?.checkpoint !== i + 1) throw new Error(`checkpoint ${i + 1} did not advance once`);
    }
    if (game.side.active || game.state.cash !== cash + race.reward || game.state.respect !== respect + 60 || game.state.stats.streetRaces !== wins + 1) {
      throw new Error('finish did not award one cash payout, respect award and win');
    }
    run(0.2);
    if (game.state.cash !== cash + race.reward || game.state.respect !== respect + 60) throw new Error('race paid twice');

    // The same live start path must also cleanly fail on timeout and leaving the entry car.
    car.x = race.start.x; car.z = race.start.z;
    run(0.1, [], ['KeyE']);
    game.side.active.time = 0.01;
    run(0.1);
    if (game.side.active) throw new Error('timed-out race stayed active');
    car.x = race.start.x; car.z = race.start.z;
    run(0.1, [], ['KeyE']);
    p.exitVehicle(true);
    run(0.1);
    if (game.side.active || game.gps.state.target) throw new Error('vehicle exit did not clear the race and GPS');
  });
  step('street race personal best and aborted-run persistence', () => {
    game.state.stats.bestStreetRaceTime = null;
    const race = game.side.race;
    const car = game.vehicles.spawn('vantor', race.start.x, race.start.z, race.start.heading);
    p.enterVehicle(car);
    const completeIn = (seconds) => {
      car.x = race.start.x; car.z = race.start.z; car.vx = car.vz = 0;
      run(0.1, [], ['KeyE']);
      if (game.side.active?.kind !== 'race') throw new Error('focused sprint did not start');
      for (let i = 0; i < race.checkpoints.length; i += 1) {
        const point = race.checkpoints[i];
        if (i === race.checkpoints.length - 1) game.side.active.time = race.time - seconds + STEP;
        car.x = point.x; car.z = point.z; car.vx = car.vz = 0;
        run(0.1);
      }
    };

    const cash = game.state.cash;
    completeIn(20);
    if (Math.abs(game.state.stats.bestStreetRaceTime - 20) > 0.001) throw new Error(`first best was ${game.state.stats.bestStreetRaceTime}`);
    if (!document.getElementById('hud-big-sub').textContent.includes('0:20.0 · PERSONAL BEST')) throw new Error('first finish did not show time and PB status');
    completeIn(18.5);
    if (Math.abs(game.state.stats.bestStreetRaceTime - 18.5) > 0.001) throw new Error(`faster best was ${game.state.stats.bestStreetRaceTime}`);
    completeIn(24);
    if (Math.abs(game.state.stats.bestStreetRaceTime - 18.5) > 0.001) throw new Error('slower finish replaced the best');
    if (!document.getElementById('hud-big-sub').textContent.includes('0:24.0 · BEST 0:18.5')) throw new Error('slower finish did not show result and saved best');
    if (game.state.cash !== cash + race.reward * 3) throw new Error('focused finishes changed the $900 payout');

    car.x = race.start.x; car.z = race.start.z;
    run(0.1, [], ['KeyE']);
    p.exitVehicle(true);
    run(0.1);
    if (game.side.active || Math.abs(game.state.stats.bestStreetRaceTime - 18.5) > 0.001) throw new Error('aborted run changed the saved best');
  });
  step('street race best save compatibility', () => {
    const oldSave = hydrateState({ cash: 350, storyProgress: 0, stats: { streetRaces: 2 } });
    if (oldSave.stats.bestStreetRaceTime !== null || oldSave.stats.streetRaces !== 2) throw new Error('pre-best save did not hydrate compatibly');
    const currentSave = hydrateState({ cash: 350, storyProgress: 0, stats: { streetRaces: 3, bestStreetRaceTime: 18.5 } });
    if (currentSave.stats.bestStreetRaceTime !== 18.5) throw new Error('saved sprint best did not hydrate');
    saveGame({ cash: 350, storyProgress: 0, stats: currentSave.stats });
    const reloaded = hydrateState(loadGame());
    deleteSave();
    if (reloaded.stats.bestStreetRaceTime !== 18.5) throw new Error('sprint best did not persist through normal save storage');
  });
  step('respect ranks', () => {
    game.state.respect = 0;
    game.respect.award(1400, 'self-test');
    if (game.respect.rank !== 3) throw new Error(`rank ${game.respect.rank}, expected 3`);
  });
  step('shop', () => {
    game.state.cash = 5000;
    const r = game.gunStore.buy('smg');
    if (!r.startsWith('Bought')) throw new Error(r);
    game.ui.openShop();
    game.ui.closeShop();
  });
  step('garage upgrades', () => {
    game.state.cash = 20000;
    game.state.storyProgress = Math.max(game.state.storyProgress, 2);
    const car = game.vehicles.spawn('vantor', game.garage.bay.x, game.garage.bay.z, 0);
    p.enterVehicle(car);
    const before = game.garage.stats(car).speed;
    const r = game.garage.buy(car, 'engine');
    if (!r.endsWith('done')) throw new Error(r);
    if (!(game.garage.stats(car).speed > before)) throw new Error('engine tune did not raise top speed');
    game.ui.openGarage();
    game.garageMenu.select(3);
    game.garageMenu.close();
    p.exitVehicle(true);
  });
  step('menus', () => {
    for (const tab of ['map', 'brief', 'settings', 'controls']) game.ui.openPause(tab);
    game.ui.mapScreen.setWaypoint(100, 100);
    game.ui.refreshPause();
    game.ui.closePause();
  });
  step('save and continue', () => { game.autosave(); session.continueGame(); run(1); });
  step('day, night and wet roads', () => {
    game.world.dayNight.setHour(22);
    game.world.update(0.1, { x: 0, y: 0, z: 0 }, game.camera.camera);
    game.post.render(game.camera.camera);
    if (!(game.wet.uniforms.uWet.value > 0.5)) throw new Error('roads are not wet at night');
    game.world.dayNight.setHour(12);
    game.world.update(0.1, { x: 0, y: 0, z: 0 }, game.camera.camera);
    game.post.render(game.camera.camera);
    if (game.wet.uniforms.uWet.value > 0.01) throw new Error('roads still wet at noon');
  });
  report(`SELFTEST ${results.filter((r) => r.startsWith('ok')).length}/${results.length}\n${results.join('\n')}`);
}
