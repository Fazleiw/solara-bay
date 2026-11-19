// Combat resolution: hitscan gunfire against people, vehicles and buildings (with muzzle
// flash, tracer, sparks and blood), punches, and explosions that hurt and fling everything near.
import { rng } from '../core/random.js';
import { rayBox } from '../world/collision.js';
import { WEAPONS } from './weapons.js';

export function createCombatSystem(game) {
  /** Nearest thing a ray hits: { t, human?, vehicle? } (t is Infinity on a miss). */
  function castRay(ox, oy, oz, dx, dy, dz, range, ignoreHuman, ignoreVehicle) {
    let best = { t: game.world.collision.raycast(ox, oy, oz, dx, dy, dz, range), human: null, vehicle: null };
    for (const h of game.humans) {
      if (h === ignoreHuman || h.inVehicle || !h.alive) continue;
      if (Math.abs(h.x - ox) > range + 1 || Math.abs(h.z - oz) > range + 1) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, h.x - 0.35, h.y, h.z - 0.35, h.x + 0.35, h.y + 1.85, h.z + 0.35);
      if (t >= 0 && t < best.t) best = { t, human: h, vehicle: null };
    }
    for (const v of game.vehicles.list) {
      if (v === ignoreVehicle) continue;
      if (Math.abs(v.x - ox) > range + 4 || Math.abs(v.z - oz) > range + 4) continue;
      const o = v.worldToLocal(ox, oz);
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const ldz = dx * fx + dz * fz, ldx = dx * fz - dz * fx;
      const W = v.type.width / 2, L = v.type.length / 2;
      const t = rayBox(o.lx, oy, o.lz, ldx, dy, ldz, -W, v.y + 0.15, -L, W, v.y + v.type.height, L);
      if (t >= 0 && t < best.t) best = { t, human: null, vehicle: v };
    }
    return best;
  }

  /**
   * Fires `weaponId` from (ox, oy, oz) along (dx, dy, dz). `shooter` is a Human; `inaccuracy`
   * adds spread for AI marksmen. Returns the first hit of the first pellet.
   */
  function fire(shooter, weaponId, ox, oy, oz, dx, dy, dz, { inaccuracy = 0, damageScale = 1 } = {}) {
    const def = WEAPONS[weaponId];
    const pellets = def.pellets ?? 1;
    const ignoreVehicle = shooter?.inVehicle ?? null;
    let firstHit = null;
    for (let p = 0; p < pellets; p += 1) {
      const spread = def.spread + inaccuracy;
      let rx = dx + rng.range(-spread, spread), ry = dy + rng.range(-spread, spread) * 0.6, rz = dz + rng.range(-spread, spread);
      const len = Math.hypot(rx, ry, rz);
      rx /= len; ry /= len; rz /= len;
      const hit = castRay(ox, oy, oz, rx, ry, rz, def.range, shooter, ignoreVehicle);
      const t = Math.min(hit.t, def.range);
      const hx = ox + rx * t, hy = oy + ry * t, hz = oz + rz * t;
      if (p === 0 || pellets < 4 || p % 3 === 0) game.effects.tracer(ox + rx * 0.6, oy + ry * 0.6, oz + rz * 0.6, hx, hy, hz);
      const source = shooter?.role === 'player' ? 'player' : shooter;
      if (hit.human) {
        const head = hy > hit.human.y + 1.55;
        hit.human.takeDamage(def.damage * damageScale * (head ? 2.2 : 1), source, { dirX: rx, dirZ: rz, force: 1.5 });
      } else if (hit.vehicle) {
        hit.vehicle.damage(def.damage * damageScale * 1.4, source);
        game.effects.sparks(hx, hy, hz, 4);
        if (hit.vehicle === game.player.vehicle && shooter?.role !== 'player') game.player.human.takeDamage(def.damage * damageScale * 0.22, source);
        game.events.emit('vehicleShot', { vehicle: hit.vehicle, source });
      } else if (hit.t <= def.range) {
        game.effects.sparks(hx, hy, hz, 3);
        game.effects.dust(hx, hy, hz);
      }
      if (!firstHit) firstHit = hit;
    }
    game.effects.muzzle(ox, oy, oz, dx, dy, dz, weaponId !== 'pistol');
    game.audio?.sfx.gunshot(def.sound, ox, oz);
    game.events.emit('shotFired', { shooter, x: ox, z: oz, weapon: weaponId });
    return firstHit;
  }

  /** A punch: the nearest person in front within reach takes a hit and staggers. */
  function punch(attacker) {
    const def = WEAPONS.fists;
    const fx = Math.sin(attacker.heading), fz = Math.cos(attacker.heading);
    let target = null, bestD = def.range;
    for (const h of game.humans) {
      if (h === attacker || h.inVehicle || !h.alive) continue;
      const dx = h.x - attacker.x, dz = h.z - attacker.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.5) { bestD = d; target = h; }
    }
    game.audio?.sfx.punch(!!target, attacker.x, attacker.z);
    if (target) {
      const source = attacker.role === 'player' ? 'player' : attacker;
      target.takeDamage(def.damage, source, { dirX: fx, dirZ: fz, force: 4 });
      target.knockTimer = Math.max(target.knockTimer, target.alive ? 0.15 : 0);
      game.events.emit('assault', { attacker, target });
    }
    return target;
  }

  /** Blast damage and impulse to everyone and everything within reach. */
  function explosion(x, y, z, source = null) {
    game.effects.explosion(x, y, z);
    game.audio?.sfx.explosion(x, z);
    game.camera?.shake(Math.max(0, 1.2 - Math.hypot(game.camera.position.x - x, game.camera.position.z - z) / 60));
    for (const h of game.humans) {
      if (h.inVehicle && h.inVehicle.destroyed === false) continue;
      const d = Math.hypot(h.x - x, h.z - z);
      if (d > 8) continue;
      const k = 1 - d / 8;
      const dirX = (h.x - x) / (d || 1), dirZ = (h.z - z) / (d || 1);
      if (h.inVehicle) h.takeDamage(500, source);
      else {
        h.takeDamage(140 * k, source, { dirX, dirZ, force: 12 * k });
        h.vy = 5 * k; h.onGround = false; h.knockTimer = 1.2 * k;
      }
    }
    for (const v of game.vehicles.list) {
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < 0.5 || d > 10) continue;
      const k = 1 - d / 10;
      v.vx += ((v.x - x) / d) * 10 * k;
      v.vz += ((v.z - z) / d) * 10 * k;
      v.damage(600 * k, source);
    }
    game.events.emit('explosion', { x, z, source });
  }

  return { fire, punch, explosion, castRay };
}
