// ?selftest=1: a scripted play-through of every system in fast-forward (new game, carjacking and
// the witness call, driving and drifting, the radio, gunfire, the wanted level, the police
// dispatch roster, GULL ONE and roadblocks, busted, wasted, all eight story chapters, both
// Gold Coast Getaway drops, both side jobs, respect ranks, the gun store, the garage upgrades,
// the menus, wet night roads and save/continue). Each step reports pass or the error it threw,
// so a headless browser can check the whole game in one load.
import { STEP } from '../config.js';
import { giveWeapon } from '../combat/weapons.js';
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
      if (def.id === 'goldcoast' && game.world.tavoShutter?.visible) throw new Error('Tavo shutter remained after abort');
    });
  }
  // Gold Coast Getaway's two drops: wreck the truck, grab the case, then stash it either way.
  const escapeTo = (drop) => {
    game.wanted.clear();
    game.police.reset();
    const index = CHAPTERS.findIndex((c) => c.id === 'goldcoast');
    game.state.storyProgress = index;
    const cashBefore = game.state.cash;
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
    const initialRoute = ctx.data.escape.route;
    const routeTerms = ctx.data.routeCue?.join(' ') ?? '';
    if (!routeTerms.includes('$6,000') || !routeTerms.includes('$4,500')) throw new Error(`missing route terms: ${routeTerms}`);
    // V is collision-free, persistent, and retargets the real GPS in both directions.
    const firstTarget = { ...game.gps.state.target };
    input.tap('KeyV'); run(0.1);
    if (ctx.data.escape.route === initialRoute) throw new Error('V did not switch route');
    if (game.gps.state.target.x === firstTarget.x && game.gps.state.target.z === firstTarget.z) throw new Error('V did not retarget GPS');
    input.tap('KeyV'); run(0.1);
    if (ctx.data.escape.route !== initialRoute) throw new Error('second V did not restore route');
    if (ctx.data.escape.route !== drop) { input.tap('KeyV'); run(0.1); }
    if (ctx.data.escape.route !== drop) throw new Error(`route stayed ${ctx.data.escape.route}, wanted ${drop}`);
    const spot = drop === 'coco' ? ctx.data.cocoCover : ctx.data.tavoDrop;
    const parked = drop === 'tavo' ? { x: spot.x, z: spot.z - 2.5 } : spot;
    const car = game.vehicles.spawn('vantor', parked.x, parked.z - 9, 0);
    p.teleport(car.x - 2, car.z);
    p.enterVehicle(car);
    // A cruiser right beside Dani keeps real sight and pressure live.
    let stagedUnit = game.police.spawnUnitAt(car.x, car.z + 8, 0);
    car.x = parked.x; car.z = parked.z; car.vx = car.vz = 0;
    const runParked = (seconds, x = parked.x, z = parked.z) => {
      for (let t = 0; t < seconds; t += STEP) {
        car.x = x; car.z = z; car.vx = car.vz = 0;
        run(STEP);
      }
    };
    runParked(0.3);
    if (drop === 'coco') {
      if (ctx.stageIndex !== 2) throw new Error('Coco opened with a cruiser watching');
      if (!/break police sight/i.test(ctx.objectiveText)) throw new Error(`objective "${ctx.objectiveText}"`);
      game.police.reset();
      game.allowSpawning = false;
      game.police.helicopter.placeAt(spot.x + 26, 34, spot.z, 0.05);
      runParked(1.2);
      if (game.wanted.level !== 4 || game.wanted.state.seen) throw new Error(`cover did not hide real four-star sight (${game.wanted.level}, ${game.wanted.state.seen})`);
      if (ctx.data.escape.cocoClear) throw new Error('brief unseen window cleared Coco');
      stagedUnit = game.police.spawnUnitAt(car.x, car.z + 8, 0);
      runParked(0.3);
      if (ctx.data.escape.cocoUnseen !== 0) throw new Error('restored sight did not reset Coco');
      game.police.removeUnitFor(stagedUnit.car);
      runParked(3.2);
      if (game.wanted.level !== 4 || game.wanted.state.seen || !ctx.data.escape.cocoClear) throw new Error('real wanted helicopter cover did not qualify Coco');
      p.exitVehicle(true);
      p.teleport(ctx.data.cocoDrop.x, ctx.data.cocoDrop.z);
      stagedUnit = game.police.spawnUnitAt(p.x, p.z + 8, 0);
      run(0.2);
      if (ctx.stageIndex !== 2 || !ctx.data.escape.cocoClear) throw new Error('Coco door ignored restored sight or lost earned cover');
      if (!/cover qualified.*break sight/i.test(ctx.objectiveText)) throw new Error(`final Coco guidance "${ctx.objectiveText}"`);
      game.police.officers.reset();
      game.police.removeUnitFor(stagedUnit.car);
      // The real searchlight is blind for the last 1.5 seconds of every six-second sweep.
      // Let normal simulation reach that window; allow a second sweep only for boundary timing.
      for (let sweep = 0; sweep < 2 && game.missions.active; sweep += 1) {
        for (let elapsed = 0; elapsed < 6 && game.missions.active; elapsed += STEP) run(STEP);
      }
    } else {
      game.allowSpawning = false;
      runParked(1.4);
      if (ctx.data.escape.tavoHold <= 0 || ctx.stageIndex !== 2) throw new Error('Tavo hold did not count visibly');
      game.police.officers.reset();
      game.police.removeUnitFor(stagedUnit.car);
      runParked(0.2, spot.x + 20, spot.z);
      if (ctx.data.escape.tavoHold !== 0) throw new Error('leaving Tavo bay did not reset hold');
      runParked(5.2);
    }
    if (drop !== 'coco') run(0.3);
    if (game.missions.active) throw new Error(`still on stage ${ctx.stageIndex}: ${ctx.objectiveText}`);
    if (game.world.tavoShutter?.visible) throw new Error('Tavo shutter remained after payoff');
    if (game.state.choices.goldcoastDrop !== drop) throw new Error(`choice saved as ${game.state.choices.goldcoastDrop}`);
    const expectedReward = drop === 'coco' ? 4500 : 6000;
    if (game.state.cash !== cashBefore + expectedReward) throw new Error(`${drop} paid $${game.state.cash - cashBefore}, expected $${expectedReward}`);
    if (game.state.storyProgress !== index + 1) throw new Error(`story progress ${game.state.storyProgress}`);
    if (p.vehicle) p.exitVehicle(true);
    run(0.5);
  };
  const tryEscape = (drop) => {
    const allowSpawning = game.allowSpawning;
    try { escapeTo(drop); } finally {
      game.allowSpawning = allowSpawning;
      game.missions.abort();
      game.police.reset();
      if (p.vehicle) p.exitVehicle(true);
    }
  };
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
