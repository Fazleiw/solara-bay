// The Bay Police response, scaled by the wanted level: pursuit cruisers spawned out of sight
// (police/pursuitDriver.js), patrol cars in traffic that join in, officers on foot
// (police/officers.js), the GULL ONE helicopter from three stars (police/helicopter.js),
// roadblocks from four (police/roadblocks.js), call signs and unit status for the HUD
// (police/dispatch.js), and the line-of-sight test that keeps the stars from fading.
import { WANTED } from '../config.js';
import { LANDMARKS } from '../world/cityLayout.js';
import { playerTarget } from '../ai/combatBrain.js';
import { createOfficers } from './officers.js';
import { createHelicopter } from './helicopter.js';
import { createRoadblocks } from './roadblocks.js';
import { createDispatch } from './dispatch.js';
import { drivePursuit, pickSpawnPoint } from './pursuitDriver.js';

/** Units dispatch has assigned to the search zone at each star level (simulated or not). */
const ASSIGNED_UNITS = [0, 2, 4, 7, 10, 14];

export function createPolice(game) {
  const units = [];
  const wanted = game.wanted;
  const net = game.world.network;
  let spawnTimer = 0;
  let roadblockTimer = 6;

  const force = {
    units,
    get reserveUnits() { return wanted.level ? Math.max(0, ASSIGNED_UNITS[wanted.level] - units.length - (force.helicopter.state.active ? 1 : 0)) : 0; },
  };
  force.officers = createOfficers(game, force);
  force.helicopter = createHelicopter(game);
  force.roadblocks = createRoadblocks(game, force);
  force.dispatch = createDispatch(game, force);

  function attachDriver(car, unit) {
    car.driver = { kind: 'police', unit, eject: () => { unit.crew = Math.max(0, unit.crew - 1); force.officers.deployFrom(unit); } };
    car.ai = car.driver;
    car.sirenOn = true;
  }
  force.attachDriver = attachDriver;

  /** Registers a cruiser as a unit with a call sign. */
  function addUnit(car, { roadblock = false, crew = 2 } = {}) {
    const unit = { car, crew, path: [], pathTimer: 0, stuck: 0, reverse: 0, deployed: roadblock, roadblock, distance: 999, direct: false, ramming: false, callsign: force.dispatch.callsign() };
    units.push(unit);
    return unit;
  }
  force.addUnit = addUnit;

  function spawnUnitAt(x, z, heading) {
    const car = game.vehicles.spawn('cruzer', x, z, heading);
    const unit = addUnit(car);
    attachDriver(car, unit);
    return unit;
  }

  function removeUnit(unit) {
    units.splice(units.indexOf(unit), 1);
    if (unit.car !== game.player.vehicle && game.vehicles.list.includes(unit.car)) game.vehicles.remove(unit.car);
  }
  force.removeUnitFor = (car) => { const unit = units.find((u) => u.car === car); if (unit) removeUnit(unit); };

  function anyoneSeesPlayer() {
    const t = playerTarget(game);
    for (const cop of force.officers.cops) {
      const h = cop.human;
      if (!h.alive) continue;
      const d = Math.hypot(t.x - h.x, t.z - h.z);
      if (d < 12 || (d < WANTED.sightRange && game.world.collision.lineOfSight(h.x, h.y + 1.6, h.z, t.x, t.y, t.z))) return true;
    }
    for (const unit of units) {
      const car = unit.car;
      if (!car.ai || car.destroyed) continue;
      const d = Math.hypot(t.x - car.x, t.z - car.z);
      if (d < 15 || (d < WANTED.sightRange && game.world.collision.lineOfSight(car.x, 1.4, car.z, t.x, t.y, t.z))) return true;
    }
    // The searchlight holds the player for most of each sweep, but solid roofs still provide cover.
    const heli = force.helicopter.state;
    return heli.onTarget && game.clock % 6 < 4.5
      && game.world.collision.lineOfSight(heli.x, heli.y, heli.z, t.x, t.y, t.z);
  }

  // A cruiser that trades paint with the player is logged as ramming.
  game.events.on('vehicleImpact', ({ vehicle, other }) => {
    if (other !== game.player.vehicle && vehicle !== game.player.vehicle) return;
    const cop = vehicle === game.player.vehicle ? other : vehicle;
    const unit = units.find((u) => u.car === cop);
    if (unit) unit.lastContact = game.clock;
  });

  function update(dt) {
    const level = wanted.level;
    const p = game.player;
    if (level > 0) {
      // Patrol cruisers in traffic join the chase.
      for (const v of game.vehicles.list) {
        if (v.type.police && v.ai?.kind === 'traffic' && Math.hypot(v.x - p.x, v.z - p.z) < 130) {
          game.traffic.drivers.delete(v.ai);
          attachDriver(v, addUnit(v));
        }
      }
      spawnTimer -= dt;
      const active = units.filter((u) => !u.roadblock && !u.car.destroyed).length;
      if (spawnTimer <= 0 && active < WANTED.copCars[level] && game.allowSpawning) {
        spawnTimer = 2.2;
        const spot = pickSpawnPoint(game);
        if (spot) spawnUnitAt(spot.x, spot.z, spot.heading);
      }
      if (level >= WANTED.roadblockFromStar && p.vehicle) {
        roadblockTimer -= dt;
        if (roadblockTimer <= 0) { roadblockTimer = 28; force.roadblocks.placeAhead(); }
      }
    }

    for (const unit of [...units]) {
      const car = unit.car;
      if (car === p.vehicle) { units.splice(units.indexOf(unit), 1); continue; }
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      unit.distance = d;
      if (car.ai?.kind === 'police') {
        if (level > 0 && !car.destroyed) drivePursuit(game, unit, dt, force.officers.deployFrom);
        else if (!car.destroyed) {
          // Stand down: rejoin ordinary traffic with the siren off.
          car.sirenOn = false;
          const near = net.nearestEdge(car.x, car.z);
          game.traffic.attachDriver(car, near.edge.a, near.edge.b);
          units.splice(units.indexOf(unit), 1);
          continue;
        }
      }
      const crewOut = force.officers.cops.some((c) => c.unit === unit);
      if (!unit.roadblock && ((d > 240 && !crewOut) || (car.destroyed && d > 120))) removeUnit(unit);
    }

    force.officers.update(dt);
    force.roadblocks.update(dt);
    force.helicopter.update(dt);
    wanted.update(dt, level > 0 && anyoneSeesPlayer());
    let sirenD = Infinity;
    for (const unit of units) if (unit.car.sirenOn && !unit.car.destroyed) sirenD = Math.min(sirenD, Math.hypot(unit.car.x - p.x, unit.car.z - p.z));
    game.audio?.setSiren(sirenD < 160 ? 1 - sirenD / 160 : 0);
  }

  /** Clears every unit (after busted/wasted, a respray, or for a scripted scene). */
  function reset() {
    force.officers.reset();
    force.roadblocks.reset();
    for (const unit of [...units]) removeUnit(unit);
    force.helicopter.reset();
  }

  /** Parked cruisers outside headquarters, free to steal (at a price). */
  function parkCruisersAtHQ() {
    const hq = LANDMARKS.policeHQ;
    for (const dz of [-8, 8]) {
      const car = game.vehicles.spawn('cruzer', hq.x - 19, hq.z + dz, Math.PI);
      car.persistent = true;
    }
  }

  return Object.assign(force, {
    update,
    reset,
    spawnUnitAt,
    parkCruisersAtHQ,
    get cops() { return force.officers.cops; },
    deployOfficers: (unit) => force.officers.deployFrom(unit),
    roster: (limit) => force.dispatch.roster(limit),
  });
}
