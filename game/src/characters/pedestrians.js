// Pedestrians: people who stroll the sidewalk loop around each block, cross at the corners,
// amble on the beach, scream and run from gunfire, crashes and bodies, sometimes fight back
// when punched, and drop cash when they go down. The crowd is kept around the player.
import { BLOCK_SIZE, GRID, POPULATION } from '../config.js';
import { rng } from '../core/random.js';
import { blockCenter, districtOf } from '../world/cityLayout.js';
import { Human } from './human.js';
import { randomLook } from './humanModel.js';

const EDGE = BLOCK_SIZE / 2 - 1.6; // sidewalk walking line from the block centre
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

function hasSidewalk(i, j) {
  const d = districtOf(i, j);
  return d !== 'water' && d !== 'out' && d !== 'beach';
}

export function createPedestrians(game) {
  const peds = [];

  function cornerPos(ped) {
    const c = blockCenter(ped.bi, ped.bj);
    const [sx, sz] = CORNERS[ped.corner];
    return { x: c.x + sx * EDGE, z: c.z + sz * EDGE };
  }

  /** Re-anchors a pedestrian to the block it is standing in (after fleeing or a fight). */
  function relocate(ped) {
    const h = ped.human;
    ped.bi = Math.floor((h.x - GRID.origin) / GRID.pitch);
    ped.bj = Math.floor((h.z - GRID.origin) / GRID.pitch);
    ped.beach = districtOf(ped.bi, ped.bj) === 'beach';
    const c = blockCenter(ped.bi, ped.bj);
    ped.corner = CORNERS.findIndex(([sx, sz]) => Math.sign(h.x - c.x || 1) === sx && Math.sign(h.z - c.z || 1) === sz);
    ped.state = 'walk';
    if (!ped.beach && !hasSidewalk(ped.bi, ped.bj)) { ped.tx = h.x; ped.tz = h.z; return; }
    if (ped.beach) chooseNextTarget(ped);
    else { const p = cornerPos(ped); ped.tx = p.x; ped.tz = p.z; }
  }

  function chooseNextTarget(ped) {
    if (ped.beach) {
      const c = blockCenter(ped.bi, ped.bj);
      ped.tx = c.x + rng.range(-12, 40);
      ped.tz = c.z + rng.range(-30, 30);
      return;
    }
    // At a corner: sometimes cross to the block across the road, else walk on round the block.
    if (rng.chance(0.18)) {
      const [sx, sz] = CORNERS[ped.corner];
      const acrossX = rng.chance(0.5);
      const ni = ped.bi + (acrossX ? sx : 0), nj = ped.bj + (acrossX ? 0 : sz);
      if (hasSidewalk(ni, nj)) {
        ped.bi = ni; ped.bj = nj;
        ped.corner = CORNERS.findIndex(([cx, cz]) => cx === (acrossX ? -sx : sx) && cz === (acrossX ? sz : -sz));
        const p = cornerPos(ped);
        ped.tx = p.x; ped.tz = p.z;
        return;
      }
    }
    ped.corner = (ped.corner + ped.dir + 4) % 4;
    const p = cornerPos(ped);
    ped.tx = p.x; ped.tz = p.z;
  }

  function spawnAt(x, z, { bi, bj, corner = 0, beach = false, look = null, state = 'walk' } = {}) {
    const human = new Human(game, { x, z, heading: rng.range(0, 6.28), look: look ?? randomLook(rng), role: 'ped', health: 60 });
    const ped = { human, bi, bj, corner, dir: rng.chance(0.5) ? 1 : -1, beach, tx: x, tz: z, state, fleeTimer: 0, fleeX: 0, fleeZ: 0, walkSpeed: rng.range(1.2, 1.7), tough: rng.chance(0.22), attackTimer: 0, cash: rng.int(5, 60) };
    human.ped = ped;
    human.eject = null;
    peds.push(ped);
    if (state === 'walk') chooseNextTarget(ped);
    return ped;
  }

  /** Spawns a pedestrian on a sidewalk at a random spot between minD and maxD from (px, pz). */
  function spawnNear(px, pz, minD, maxD) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(minD, maxD);
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      const bi = Math.floor((x - GRID.origin) / GRID.pitch), bj = Math.floor((z - GRID.origin) / GRID.pitch);
      const dist = districtOf(bi, bj);
      if (dist === 'beach') {
        const c = blockCenter(bi, bj);
        return spawnAt(c.x + rng.range(-10, 35), c.z + rng.range(-30, 30), { bi, bj, beach: true });
      }
      if (!hasSidewalk(bi, bj)) continue;
      const c = blockCenter(bi, bj);
      const corner = rng.int(0, 3);
      const [sx, sz] = CORNERS[corner];
      const [nx, nz] = CORNERS[(corner + 1) % 4];
      const t = rng.next();
      return spawnAt(c.x + (sx + (nx - sx) * t) * EDGE, c.z + (sz + (nz - sz) * t) * EDGE, { bi, bj, corner: (corner + 1) % 4 });
    }
    return null;
  }

  function remove(ped) {
    const i = peds.indexOf(ped);
    if (i < 0) return;
    peds.splice(i, 1);
    ped.human.dispose();
  }

  /** Everyone within `radius` of (x, z) runs away from it. */
  function panic(x, z, radius, duration = 8) {
    for (const ped of peds) {
      const h = ped.human;
      if (!h.alive) continue;
      const d = Math.hypot(h.x - x, h.z - z);
      if (d > radius) continue;
      if (ped.state !== 'flee' && rng.chance(0.3)) game.audio?.sfx.scream(h.x, h.z);
      ped.state = 'flee';
      ped.fleeTimer = duration * rng.range(0.8, 1.3);
      ped.fleeX = x; ped.fleeZ = z;
    }
  }

  game.events.on('shotFired', ({ x, z }) => panic(x, z, 38));
  game.events.on('explosion', ({ x, z }) => panic(x, z, 50, 10));
  game.events.on('humanDied', ({ human }) => panic(human.x, human.z, 18));
  game.events.on('humanRunOver', ({ human }) => panic(human.x, human.z, 16));
  game.events.on('humanHurt', ({ human, source }) => {
    const ped = human.ped;
    if (!ped || !human.alive) return;
    if (source === 'player' && ped.tough && game.player.weaponId === 'fists') { ped.state = 'fight'; return; }
    ped.state = 'flee';
    ped.fleeTimer = 10;
    const p = game.player;
    ped.fleeX = p.x; ped.fleeZ = p.z;
  });
  game.events.on('humanDied', ({ human }) => {
    if (human.ped && human.ped.cash > 0) {
      game.pickups?.dropCash(human.x, human.z, human.ped.cash);
      human.ped.cash = 0;
    }
  });

  function updatePed(ped, dt) {
    const h = ped.human;
    if (!h.alive) { h.move(0, 0, 0); return; }
    const player = game.player;
    if (ped.state === 'walk') {
      const dx = ped.tx - h.x, dz = ped.tz - h.z;
      if (dx * dx + dz * dz < 1.2) {
        if (ped.beach || hasSidewalk(ped.bi, ped.bj)) chooseNextTarget(ped);
        else relocate(ped);
      }
      h.move(dx, dz, ped.walkSpeed);
      h.faceToward(dx, dz, dt, 6);
      // Someone pointing a gun at them nearby makes them bolt.
      if (player.isAiming && !player.vehicle && Math.hypot(h.x - player.x, h.z - player.z) < 14) panic(player.x, player.z, 6, 6);
    } else if (ped.state === 'flee') {
      let dx = h.x - ped.fleeX, dz = h.z - ped.fleeZ;
      if (Math.abs(dx) + Math.abs(dz) < 0.1) { dx = 1; dz = 0; }
      h.move(dx, dz, 6.2);
      h.faceToward(dx, dz, dt, 12);
      ped.fleeTimer -= dt;
      if (ped.fleeTimer <= 0) relocate(ped);
    } else if (ped.state === 'fight') {
      const ph = player.human;
      if (player.vehicle || !ph.alive) { relocate(ped); return; }
      const dx = ph.x - h.x, dz = ph.z - h.z, d = Math.hypot(dx, dz);
      h.faceToward(dx, dz, dt, 12);
      h.move(dx, dz, d > 1.3 ? 4.5 : 0);
      ped.attackTimer -= dt;
      h.pose = ped.attackTimer > 0.55 ? 'punch' : 'idle';
      if (d < 1.6 && ped.attackTimer <= 0) {
        ped.attackTimer = 0.8;
        ph.takeDamage(6, h, { dirX: dx / d, dirZ: dz / d, force: 2 });
        game.audio?.sfx.punch(true, h.x, h.z);
      }
    }
  }

  function update(dt) {
    const px = game.player.x, pz = game.player.z;
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      const h = ped.human;
      const d = Math.hypot(h.x - px, h.z - pz);
      if (!ped.keep && d > POPULATION.pedDespawn || (!h.alive && h.deadTime > 30 && d > 25)) { remove(ped); continue; }
      updatePed(ped, dt);
      h.physics(dt);
      h.syncMesh(dt);
    }
    const alive = peds.filter((p) => p.human.alive).length;
    if (alive < game.population.peds && game.allowSpawning) spawnNear(px, pz, POPULATION.pedSpawnMin, POPULATION.pedSpawnMax);
  }

  /** Turns a car's evicted driver into a pedestrian who runs off (or squares up). */
  function fromEjectedDriver(car, look) {
    const door = car.doorPosition();
    const ped = spawnAt(door.x, door.z, { bi: 0, bj: 0, look, state: 'flee' });
    ped.fleeX = car.x; ped.fleeZ = car.z; ped.fleeTimer = 7;
    ped.human.heading = car.heading;
    if (ped.tough && rng.chance(0.5)) ped.state = 'fight';
    return ped;
  }

  return { peds, update, spawnNear, spawnAt, panic, remove, fromEjectedDriver };
}
