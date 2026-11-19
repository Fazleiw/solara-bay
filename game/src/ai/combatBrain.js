// The on-foot gunfight behaviour police officers and gang members share: close the distance
// until they have a clear line of fire, keep to a preferred range, strafe sideways between
// shots, and fire with an inaccuracy that grows with distance.
import { rng } from '../core/random.js';
import { WEAPONS } from '../combat/weapons.js';

export function createShooterBrain({ weapon = 'pistol', minRange = 6, maxRange = 18, skill = 0.5 } = {}) {
  return { weapon, minRange, maxRange, skill, cooldown: rng.range(0.6, 1.6), strafe: rng.sign(), strafeTimer: rng.range(1, 3), losTimer: 0, los: false, burst: 0, lastShot: -10 };
}

/** Current aim point of the player (their car if driving). */
export function playerTarget(game) {
  const p = game.player;
  if (p.vehicle) return { x: p.vehicle.x, y: p.vehicle.y + 0.9, z: p.vehicle.z };
  return { x: p.human.x, y: p.human.y + 1.2, z: p.human.z };
}

/**
 * Runs one tick of gunfight behaviour for `human` against a target point. Returns the distance
 * to the target so callers can make their own decisions (arrests, giving up).
 */
export function updateShooter(game, human, brain, target, dt) {
  const dx = target.x - human.x, dz = target.z - human.z;
  const d = Math.hypot(dx, dz) || 0.001;
  brain.losTimer -= dt;
  if (brain.losTimer <= 0) {
    brain.losTimer = 0.35;
    brain.los = game.world.collision.lineOfSight(human.x, human.y + 1.5, human.z, target.x, target.y, target.z);
  }
  human.weapon = brain.weapon;
  human.faceToward(dx, dz, dt, 9);
  if (!brain.los || d > brain.maxRange) {
    human.move(dx, dz, 5.6);
    human.pose = 'idle';
  } else {
    brain.strafeTimer -= dt;
    if (brain.strafeTimer <= 0) { brain.strafe = -brain.strafe; brain.strafeTimer = rng.range(1.2, 2.8); }
    const away = d < brain.minRange ? -1 : 0;
    human.move(dx / d * away * 3 + (-dz / d) * brain.strafe * 1.6, dz / d * away * 3 + (dx / d) * brain.strafe * 1.6, d < brain.minRange ? 3.5 : 1.8);
    human.pose = 'aim';
    human.aimPitch = Math.atan2(target.y - (human.y + 1.4), d) * 0.8;
  }
  brain.cooldown -= dt;
  if (brain.los && d < WEAPONS[brain.weapon].range * 0.9 && brain.cooldown <= 0) {
    const def = WEAPONS[brain.weapon];
    const fx = Math.sin(human.heading), fz = Math.cos(human.heading);
    const ox = human.x + fx * 0.7, oy = human.y + 1.42, oz = human.z + fz * 0.7;
    let ax = target.x - ox, ay = target.y - oy, az = target.z - oz;
    const len = Math.hypot(ax, ay, az);
    ax /= len; ay /= len; az /= len;
    const inaccuracy = (1 - brain.skill) * 0.09 + d * 0.0022;
    game.combat.fire(human, brain.weapon, ox, oy, oz, ax, ay, az, { inaccuracy, damageScale: 0.36 });
    brain.lastShot = game.clock;
    if (def.auto) {
      brain.burst = brain.burst > 0 ? brain.burst - 1 : rng.int(3, 6);
      brain.cooldown = brain.burst > 0 ? def.rate * 1.4 : rng.range(0.9, 1.8);
    } else {
      brain.cooldown = def.rate + rng.range(0.7, 1.6) * (1.2 - brain.skill * 0.5);
    }
  }
  return d;
}
