// Traffic: AI drivers that follow right-hand lanes along the road graph, pick a turn at each
// junction, stop at red lights and behind whatever is ahead, honk, recover when knocked off
// their lane, panic and floor it after a crash or gunfire, and bail out of wrecks. Cars are
// spawned on lanes out of the player's way and removed once far behind.
import { POPULATION } from '../config.js';
import { rng } from '../core/random.js';
import { randomLook } from '../characters/humanModel.js';
import { pickTrafficType } from '../vehicles/vehicleTypes.js';
import { districtAt } from '../world/cityLayout.js';

const STOP_LINE = 9.5;

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

export function createTraffic(game) {
  const net = game.world.network;
  const drivers = new Set();
  const tmp = { x: 0, z: 0 };

  function pickNext(fromId, toId) {
    const node = net.node(toId);
    const options = node.links.filter((l) => l.to !== fromId);
    if (!options.length) return fromId; // dead end: U-turn
    // Prefer going straight a little more often than turning.
    const from = net.node(fromId);
    const dx = node.x - from.x, dz = node.z - from.z;
    const weighted = options.map((l) => {
      const n = net.node(l.to);
      const straight = Math.sign(n.x - node.x) === Math.sign(dx) && Math.sign(n.z - node.z) === Math.sign(dz);
      return [l.to, straight ? 2.2 : 1];
    });
    const total = weighted.reduce((s, [, w]) => s + w, 0);
    let r = rng.next() * total;
    for (const [id, w] of weighted) { r -= w; if (r <= 0) return id; }
    return weighted[0][0];
  }

  /** Makes `vehicle` a traffic car driving from node a toward node b. */
  function attachDriver(vehicle, a, b, look = null) {
    const driver = {
      kind: 'traffic',
      vehicle,
      from: a,
      to: b,
      next: pickNext(a, b),
      cruise: rng.range(10.5, 13.5),
      panic: 0,
      stuck: 0,
      reverse: 0,
      honk: 0,
      look: look ?? randomLook(rng),
      eject(car) {
        drivers.delete(driver);
        game.peds.fromEjectedDriver(car, driver.look);
      },
    };
    vehicle.driver = driver;
    vehicle.ai = driver;
    drivers.add(driver);
    return driver;
  }

  /** Spawns a traffic car on a random lane `minD`..`maxD` from (px, pz); returns it or null. */
  function spawnNear(px, pz, minD, maxD, typeId = null) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const edge = rng.pick(net.edges);
      const forward = rng.chance(0.5);
      const a = net.node(forward ? edge.a : edge.b), b = net.node(forward ? edge.b : edge.a);
      const s = rng.range(10, edge.length - 14);
      const p = net.lanePoint(a, b, s, { x: 0, z: 0 });
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < minD || d > maxD) continue;
      if (game.vehicles.list.some((v) => Math.abs(v.x - p.x) < 9 && Math.abs(v.z - p.z) < 9)) continue;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      const v = game.vehicles.spawn(typeId ?? pickTrafficType(rng), p.x, p.z, heading);
      const speed = rng.range(6, 11);
      v.vx = Math.sin(heading) * speed; v.vz = Math.cos(heading) * speed;
      attachDriver(v, a.id, b.id);
      return v;
    }
    return null;
  }

  /** Distance to the nearest thing ahead in this car's lane (cars, people, the player). */
  function clearanceAhead(v, range) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    let best = range;
    const consider = (x, z, halfWidth) => {
      const dx = x - v.x, dz = z - v.z;
      const along = dx * fx + dz * fz;
      if (along <= 0 || along > best) return;
      const lateral = Math.abs(dx * fz - dz * fx);
      if (lateral < 1.4 + halfWidth) best = along;
    };
    for (const o of game.vehicles.list) if (o !== v) consider(o.x, o.z, o.type.width / 2);
    for (const h of game.humans) if (!h.inVehicle && h.alive) consider(h.x, h.z, 0.3);
    return best;
  }

  function steerToward(v, tx, tz) {
    const desired = Math.atan2(tx - v.x, tz - v.z);
    return Math.max(-1, Math.min(1, wrap(desired - v.heading) * 2.4));
  }

  function updateDriver(driver, dt) {
    const v = driver.vehicle;
    const c = v.controls;
    if (v.destroyed) { drivers.delete(driver); v.driver = null; v.ai = null; return; }
    const a = net.node(driver.from), b = net.node(driver.to);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const fx = (b.x - a.x) / len, fz = (b.z - a.z) / len;
    const s = (v.x - a.x) * fx + (v.z - a.z) * fz;
    const fwd = v.fwdSpeed;

    // Reached the junction: move on to the next edge.
    if (s > len - 3.5) {
      driver.from = driver.to;
      driver.to = driver.next;
      driver.next = pickNext(driver.from, driver.to);
      return;
    }
    // Knocked far off the lane: rejoin the nearest road.
    const lane = net.lanePoint(a, b, Math.max(0, s), tmp);
    if (Math.hypot(lane.x - v.x, lane.z - v.z) > 14) {
      const near = net.nearestEdge(v.x, v.z);
      const ea = net.node(near.edge.a), eb = net.node(near.edge.b);
      const toB = Math.cos(v.heading) * (eb.z - ea.z) + Math.sin(v.heading) * (eb.x - ea.x) > 0;
      driver.from = toB ? ea.id : eb.id;
      driver.to = toB ? eb.id : ea.id;
      driver.next = pickNext(driver.from, driver.to);
      return;
    }

    const look = 6 + Math.abs(fwd) * 0.45;
    let target;
    if (s + look < len) target = net.lanePoint(a, b, s + look, tmp);
    else target = net.lanePoint(b, net.node(driver.next), s + look - len, tmp);
    c.steer = steerToward(v, target.x, target.z);

    let targetSpeed = driver.panic > 0 ? 21 : driver.cruise * (districtAt(v.x, v.z) === 'downtown' ? 0.9 : 1);
    const toEnd = len - s;
    const nextNode = net.node(driver.next);
    const turning = Math.abs(wrap(Math.atan2(nextNode.x - b.x, nextNode.z - b.z) - Math.atan2(fx, fz))) > 0.3;
    if (turning && toEnd < 22) targetSpeed = Math.min(targetSpeed, 6.5 + toEnd * 0.25);
    if (b.hasLights && driver.panic <= 0) {
      const light = net.lightState(len > 0 && Math.abs(fz) > Math.abs(fx) ? 'ns' : 'ew', game.clock);
      const stopDist = toEnd - STOP_LINE;
      if (light !== 'green' && stopDist > -0.5 && stopDist < 30 && !(light === 'amber' && stopDist < 3)) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, stopDist * 0.7 - 0.3));
      }
    }
    const clear = clearanceAhead(v, 8 + Math.abs(fwd) * 1.3);
    if (clear < 30) {
      const safe = Math.max(0, (clear - 5.5) * 0.9);
      targetSpeed = Math.min(targetSpeed, safe);
      if (clear < 7 && Math.abs(fwd) < 1) {
        driver.honk -= dt;
        if (driver.honk <= 0 && game.player.vehicle && Math.hypot(game.player.x - v.x, game.player.z - v.z) < 12) {
          driver.honk = rng.range(2.5, 5);
          game.audio?.sfx.horn(0.9, v.x, v.z);
        }
      }
    }
    if (driver.panic > 0) driver.panic -= dt;

    // Stuck against something: back up for a moment.
    if (driver.reverse > 0) {
      driver.reverse -= dt;
      c.throttle = -1;
      c.steer = -c.steer;
      c.handbrake = false;
      return;
    }
    if (targetSpeed > 3 && Math.abs(fwd) < 0.6) driver.stuck += dt; else driver.stuck = 0;
    if (driver.stuck > 3) { driver.stuck = 0; driver.reverse = 1.4; }
    const err = targetSpeed - fwd;
    c.throttle = Math.max(-1, Math.min(1, err * 0.45));
    if (targetSpeed < 0.3 && Math.abs(fwd) < 0.4) c.throttle = 0;
    c.handbrake = targetSpeed < 0.3 && Math.abs(fwd) < 0.8;
  }

  // Crashes and gunfire spook drivers.
  game.events.on('vehicleImpact', ({ vehicle, force, other }) => {
    if (vehicle.ai?.kind === 'traffic' && force > 5) {
      vehicle.ai.panic = 8;
      if (other?.driver === 'player') game.audio?.sfx.horn(1, vehicle.x, vehicle.z);
    }
  });
  game.events.on('vehicleShot', ({ vehicle }) => {
    const d = vehicle.ai;
    if (d?.kind !== 'traffic') return;
    if (vehicle.speed < 3 && rng.chance(0.4)) { vehicle.driver = null; vehicle.ai = null; d.eject(vehicle); return; }
    d.panic = 12;
  });
  game.events.on('shotFired', ({ x, z }) => {
    for (const d of drivers) if (Math.hypot(d.vehicle.x - x, d.vehicle.z - z) < 30) d.panic = Math.max(d.panic, 6);
  });

  function update(dt) {
    const px = game.player.x, pz = game.player.z;
    for (const driver of [...drivers]) {
      if (driver.vehicle.ai !== driver) { drivers.delete(driver); continue; }
      updateDriver(driver, dt);
    }
    // Recycle cars far away (abandoned or traffic), keep the road busy near the player.
    for (const v of [...game.vehicles.list]) {
      if (v.persistent || v === game.player.vehicle || v.ai?.kind === 'police') continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d > POPULATION.trafficDespawn || (v.destroyed && d > 90)) {
        if (v.ai) drivers.delete(v.ai);
        game.vehicles.remove(v);
      }
    }
    if (drivers.size < game.population.traffic && game.allowSpawning) spawnNear(px, pz, POPULATION.trafficSpawnMin, POPULATION.trafficSpawnMax);
  }

  return { drivers, update, spawnNear, attachDriver };
}
