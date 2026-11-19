// Bay Police officers on foot: they bail out of cruisers that have the player cornered, chase
// down and cuff a one-star suspect, open fire from two stars (SMGs from four), run back to
// their cruiser when the player drives off, and count down the BUSTED timer when they get
// their hands on Dani.
import { rng } from '../core/random.js';
import { Human } from '../characters/human.js';
import { createShooterBrain, playerTarget, updateShooter } from '../ai/combatBrain.js';

export const COP_LOOK = (r) => ({
  skin: r.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
  hair: r.pick(['#1b1b1b', '#3b2314', '#6a4e2e']), hairStyle: r.int(0, 2),
  shirt: '#2d4f8a', sleeves: '#2d4f8a', vest: '#1c2533', pants: '#1c2533', shoes: '#0d0d0d', hat: '#16233b', height: r.range(0.98, 1.06),
});

export function createOfficers(game, force) {
  const cops = [];
  const wanted = game.wanted;
  let bustTimer = 0;

  function spawn(x, z, heading, unit) {
    const human = new Human(game, { x, z, heading, look: COP_LOOK(rng), role: 'cop', health: 70, armor: 20 });
    const cop = { human, unit, brain: createShooterBrain({ weapon: wanted.level >= 4 ? 'smg' : 'pistol', minRange: 7, maxRange: 20, skill: 0.45 + wanted.level * 0.06 }) };
    human.weapon = 'pistol';
    cops.push(cop);
    return cop;
  }

  /** The crew of a cruiser jumps out on both sides. */
  function deployFrom(unit) {
    const car = unit.car;
    for (let n = 0; n < unit.crew; n += 1) {
      const side = n === 0 ? 1 : -1;
      const door = car.localToWorld(side * (car.type.width / 2 + 0.8), 0.4 - n * 0.6);
      spawn(door.x, door.z, car.heading, unit);
    }
    unit.crew = 0;
    unit.deployed = true;
    car.driver = null;
    car.ai = null;
    car.controls.throttle = 0;
    car.controls.handbrake = true;
  }

  function updateCop(cop, dt) {
    const h = cop.human;
    if (!h.alive) { h.move(0, 0, 0); return; }
    const p = game.player;
    const target = playerTarget(game);
    const d = Math.hypot(target.x - h.x, target.z - h.z);
    const unitCar = cop.unit?.car;
    const carUsable = unitCar && !unitCar.destroyed && unitCar.driver === null && game.vehicles.list.includes(unitCar) && !cop.unit.roadblock;
    if (wanted.level === 0 || (p.vehicle && p.vehicle.speed > 5 && d > 20 && carUsable && Math.hypot(unitCar.x - h.x, unitCar.z - h.z) < 35)) {
      // Head back to the cruiser and climb in.
      if (carUsable) {
        const door = unitCar.doorPosition();
        h.move(door.x - h.x, door.z - h.z, 5);
        h.faceToward(door.x - h.x, door.z - h.z, dt);
        h.pose = 'idle';
        if (Math.hypot(door.x - h.x, door.z - h.z) < 1.6) {
          cop.unit.crew += 1;
          cop.remove = true;
          if (!unitCar.driver) force.attachDriver(unitCar, cop.unit);
          cop.unit.deployed = false;
        }
      } else {
        h.move(h.x - p.x, h.z - p.z, wanted.level === 0 ? 1.4 : 5);
        h.pose = 'idle';
      }
      return;
    }
    if (wanted.level === 1) {
      // One star: no guns, just a foot chase to the cuffs (or the driver's door).
      const goal = p.vehicle ? p.vehicle.doorPosition() : target;
      const gd = Math.hypot(goal.x - h.x, goal.z - h.z);
      h.weapon = null;
      h.faceToward(goal.x - h.x, goal.z - h.z, dt);
      h.move(goal.x - h.x, goal.z - h.z, gd > 1.3 ? 6.1 : 0);
      h.pose = 'idle';
      return;
    }
    cop.brain.weapon = wanted.level >= 4 ? 'smg' : 'pistol';
    updateShooter(game, h, cop.brain, target, dt);
  }

  function checkBusted(dt) {
    const p = game.player;
    if (wanted.level === 0 || !p.human.alive) { bustTimer = 0; return; }
    let close = false;
    for (const cop of cops) {
      const h = cop.human;
      if (!h.alive || h.knockTimer > 0) continue;
      if (p.vehicle) {
        const door = p.vehicle.doorPosition();
        if (p.vehicle.speed < 1.2 && Math.hypot(door.x - h.x, door.z - h.z) < 2.4) close = true;
      } else if (Math.hypot(p.human.x - h.x, p.human.z - h.z) < 1.9 && (wanted.level <= 1 || p.human.speed < 2.5)) close = true;
    }
    bustTimer = close ? bustTimer + dt : Math.max(0, bustTimer - dt);
    if (bustTimer > (p.vehicle ? 2.0 : 1.4)) {
      bustTimer = 0;
      game.events.emit('playerBusted', {});
    }
  }

  function update(dt) {
    const p = game.player;
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      const h = cop.human;
      updateCop(cop, dt);
      h.physics(dt);
      h.syncMesh(dt);
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (cop.remove || d > 200 || (!h.alive && h.deadTime > 30 && d > 25) || (wanted.level === 0 && d > 90)) {
        h.dispose();
        cops.splice(i, 1);
      }
    }
    checkBusted(dt);
  }

  function reset() {
    for (const cop of cops) cop.human.dispose();
    cops.length = 0;
    bustTimer = 0;
  }

  return { cops, spawn, deployFrom, update, reset };
}
