// ?selftest=1: a scripted play-through of every system in fast-forward (new game, carjacking and
// the witness call, driving and drifting, the radio, gunfire, the wanted level, the police
// dispatch roster, GULL ONE and roadblocks, busted, wasted, all eight story chapters, both side
// jobs, respect ranks, the gun store, the garage upgrades, the menus, wet night roads and
// save/continue). Each step reports pass or the error it threw, so a headless browser can
// check the whole game in one load.
import { STEP } from '../config.js';
import { giveWeapon } from '../combat/weapons.js';
import { CHAPTERS } from '../missions/chapters.js';
import { LANDMARKS } from '../world/cityLayout.js';

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
  step('wasted', () => { p.human.takeDamage(1000, null); run(5.5); if (!p.human.alive) throw new Error('did not revive'); });
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
