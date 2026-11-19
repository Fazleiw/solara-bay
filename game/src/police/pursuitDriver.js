// How a Bay Police cruiser drives a pursuit: aim at where the player's car will be, route
// around blocks through the street grid when there is no line of sight, slow for corners,
// ram from two stars (box in at one), back out when stuck, and stop to send the crew out on
// foot once a suspect on foot is close. Also picks spawn points out of the player's view.
import { rng } from '../core/random.js';

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

function steerToward(car, tx, tz) {
  return Math.max(-1, Math.min(1, wrap(Math.atan2(tx - car.x, tz - car.z) - car.heading) * 2.6));
}

/** A road point 85-175 m from the player, preferring ones behind the camera. */
export function pickSpawnPoint(game) {
  const net = game.world.network;
  const p = game.player;
  const camF = game.camera.forward();
  let best = null;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const node = rng.pick(net.nodeList);
    const d = Math.hypot(node.x - p.x, node.z - p.z);
    if (d < 85 || d > 175) continue;
    const facing = ((node.x - p.x) * camF.x + (node.z - p.z) * camF.z) / d;
    if (!best || facing < best.facing) best = { node, facing };
    if (facing < 0.2) break;
  }
  if (!best) return null;
  const toward = net.node(rng.pick(best.node.links).to);
  const pos = net.lanePoint(best.node, toward, 6, { x: 0, z: 0 });
  if (game.vehicles.list.some((v) => Math.abs(v.x - pos.x) < 7 && Math.abs(v.z - pos.z) < 7)) return null;
  return { x: pos.x, z: pos.z, heading: Math.atan2(p.x - pos.x, p.z - pos.z) };
}

/** One tick of pursuit driving for `unit`; calls `deploy` when the crew should get out. */
export function drivePursuit(game, unit, dt, deploy) {
  const net = game.world.network;
  const car = unit.car;
  const c = car.controls;
  const p = game.player;
  const pv = p.vehicle;
  const tx = p.x + (pv ? pv.vx * 0.6 : 0), tz = p.z + (pv ? pv.vz * 0.6 : 0);
  const d = Math.hypot(tx - car.x, tz - car.z);
  const fwd = car.fwdSpeed;
  unit.distance = d;
  if (!pv && d < 24) {
    c.throttle = fwd > 0.5 ? -1 : 0;
    c.steer = steerToward(car, tx, tz);
    c.handbrake = fwd < 4;
    if (Math.abs(fwd) < 2.5) deploy(unit);
    return;
  }
  if (unit.reverse > 0) {
    unit.reverse -= dt;
    c.throttle = -1; c.steer = -steerToward(car, tx, tz); c.handbrake = false;
    return;
  }
  let aimX = tx, aimZ = tz;
  const direct = d < 75 && game.world.collision.lineOfSight(car.x, 1, car.z, tx, 1, tz);
  unit.direct = direct;
  if (!direct) {
    unit.pathTimer -= dt;
    if (unit.pathTimer <= 0 || !unit.path.length) {
      unit.pathTimer = 1.2;
      unit.path = net.findRoute(net.nearestNode(car.x, car.z).id, net.nearestNode(tx, tz).id);
      if (unit.path.length > 1) unit.path.shift();
    }
    const next = unit.path.length ? net.node(unit.path[0]) : null;
    if (next) {
      aimX = next.x; aimZ = next.z;
      if (Math.hypot(next.x - car.x, next.z - car.z) < 9) unit.path.shift();
    }
  }
  c.steer = steerToward(car, aimX, aimZ);
  const turn = Math.abs(wrap(Math.atan2(aimX - car.x, aimZ - car.z) - car.heading));
  let targetSpeed = car.maxSpeed * 0.82;
  if (turn > 0.5) targetSpeed = Math.min(targetSpeed, 9 + (1.6 - Math.min(1.6, turn)) * 14);
  unit.ramming = !!pv && d < 16 && game.wanted.level >= 2;
  if (pv && d < 16) targetSpeed = unit.ramming ? pv.speed + 8 : Math.max(0, pv.speed - 1);
  c.throttle = Math.max(-1, Math.min(1, (targetSpeed - fwd) * 0.35));
  c.handbrake = turn > 1.2 && fwd > 14;
  if (targetSpeed > 4 && Math.abs(fwd) < 0.8) unit.stuck += dt; else unit.stuck = 0;
  if (unit.stuck > 1.6) { unit.stuck = 0; unit.reverse = 1.1; }
}
