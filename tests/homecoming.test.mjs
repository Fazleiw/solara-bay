import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAPTERS } from '../game/src/missions/chapters.js';
import { isOnRoad, LANDMARKS } from '../game/src/world/cityLayout.js';

const home = CHAPTERS.find(({ id }) => id === 'homecoming');

function fixture() {
  const p = { ...LANDMARKS.safehouse.front, vehicle: null };
  const cars = [], tracks = new Set(), cleanups = [];
  let spawns = 0;
  const vehicles = {
    list: cars,
    spawn(type, x, z, heading) {
      spawns++;
      const car = { type: { id: type }, x, z, heading, speed: 0, persistent: false };
      cars.push(car);
      return car;
    },
    remove(car) { cars.splice(cars.indexOf(car), 1); },
    nearestVehicle(x, z, range, filter) {
      return cars.find(car => Math.hypot(x - car.x, z - car.z) < range && filter(car));
    },
  };
  function attempt() {
    return {
      game: { player: p, vehicles, dialogue: { clear() {} } },
      data: {},
      stageIndex: 0,
      stage(index, text) { this.stageIndex = index; this.objective(text); },
      objective(text) { this.objectiveText = text; },
      atWaypoint() { return this.arrived; },
      waypoint(x, z, opts) { this.target = { x, z, ...opts }; },
      say() {},
      pass(reward) { this.reward = reward; },
      onCleanup(fn) { cleanups.push(fn); },
      track(entity, color, label, { marker: options }) {
        const blip = { entity, color, label, marker: { options, moveTo() {} } };
        tracks.add(blip);
        return blip;
      },
      untrack(blip) { tracks.delete(blip); },
      cleanup() { for (const fn of cleanups.splice(0)) fn(); },
    };
  }
  return { p, cars, tracks, attempt, spawnCount: () => spawns };
}

test('Homecoming supplies one nearby marked curb car and no drive route yet', () => {
  const { p, cars, tracks, attempt, spawnCount } = fixture();
  const ctx = attempt();
  home.begin(ctx);
  const [car] = cars;
  assert.equal(cars.length, 1);
  assert.ok(isOnRoad(car.x, car.z));
  assert.ok(Math.hypot(p.x - car.x, p.z - car.z) < 14);
  assert.equal(car.persistent, true);
  assert.equal(tracks.size, 1);
  assert.equal([...tracks][0].entity, car);
  assert.ok([...tracks][0].marker.options.height > 0);
  assert.equal(ctx.target, undefined);
  for (let i = 0; i < 120; i++) home.update(ctx);
  assert.equal(spawnCount(), 1);
  assert.equal(tracks.size, 1);
});

test('either car advances to the same live Coco waypoint and original payout', () => {
  for (const useCurbCar of [true, false]) {
    const { p, cars, tracks, attempt } = fixture();
    const ctx = attempt();
    home.begin(ctx);
    const [curb] = cars;
    const other = { x: p.x - 1, z: p.z };
    cars.push(other);
    p.vehicle = useCurbCar ? curb : other;
    home.update(ctx);
    assert.equal(ctx.stageIndex, 1);
    assert.match(ctx.objectiveText.replaceAll('*', ''), /Drive to Coco Loco Tacos/);
    assert.equal(tracks.size, 0);
    assert.equal(cars.includes(curb), useCurbCar);
    assert.equal(curb.persistent, false);
    assert.equal(cars.includes(other), true);
    assert.deepEqual(ctx.target, { ...LANDMARKS.cocoShack.front, radius: 5, label: 'Coco Loco Tacos' });
    ctx.arrived = true;
    home.update(ctx);
    assert.equal(ctx.reward, 500);
    ctx.cleanup();
    assert.ok(cars.includes(p.vehicle));
  }
});

test('abort removes an unused loaner; retry can reuse one already parked or start seated', () => {
  const { p, cars, tracks, attempt, spawnCount } = fixture();
  let ctx = attempt();
  home.begin(ctx);
  ctx.cleanup();
  assert.equal(tracks.size, 0);
  assert.equal(cars.length, 0);
  ctx = attempt();
  home.begin(ctx);
  const [loaner] = cars;
  assert.equal(tracks.size, 1);
  p.vehicle = loaner;
  home.update(ctx);
  ctx.cleanup();
  ctx = attempt();
  home.begin(ctx);
  assert.equal(ctx.stageIndex, 1);
  assert.equal(tracks.size, 0);
  assert.equal(spawnCount(), 2);
  ctx.cleanup();
  p.vehicle = null;
  ctx = attempt();
  home.begin(ctx);
  assert.equal(spawnCount(), 2);
  assert.deepEqual(cars, [loaner]);
  assert.equal([...tracks][0].entity, loaner);
  ctx.cleanup();
  assert.equal(tracks.size, 0);
  assert.equal(loaner.persistent, false);
});

test('a wrecked loaner drops its marks without blocking the any-car objective or respawning', () => {
  const { p, cars, tracks, attempt, spawnCount } = fixture();
  const ctx = attempt();
  home.begin(ctx);
  const [loaner] = cars;
  assert.ok(loaner);
  loaner.destroyed = true;
  for (let i = 0; i < 120; i++) home.update(ctx);
  assert.equal(spawnCount(), 1);
  assert.equal(tracks.size, 0);
  assert.equal(loaner.persistent, false);
  assert.match(ctx.objectiveText, /any car/);
  p.vehicle = {};
  home.update(ctx);
  assert.equal(ctx.stageIndex, 1);
});
