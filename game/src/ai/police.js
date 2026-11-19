// The Bay Police response: pursuit cruisers that route through the street grid and ram at two
// stars and up, officers who jump out to arrest (one star) or open fire (two or more), road
// blocks from three stars, a helicopter with a searchlight from four, the line-of-sight checks
// that keep the wanted level alive, and the "busted" check.
import * as THREE from 'three';
import { WANTED } from '../config.js';
import { rng } from '../core/random.js';
import { Human } from '../characters/human.js';
import { createShooterBrain, playerTarget, updateShooter } from './combatBrain.js';
import { LANDMARKS } from '../world/cityLayout.js';

const COP_LOOK = (r) => ({
  skin: r.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
  hair: r.pick(['#1b1b1b', '#3b2314', '#6a4e2e']), hairStyle: r.int(0, 2),
  shirt: '#2d4f8a', sleeves: '#2d4f8a', vest: '#1c2533', pants: '#1c2533', shoes: '#0d0d0d', hat: '#16233b', height: r.range(0.98, 1.06),
});

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

function buildHelicopter(glowTexture) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#1d2a44', roughness: 0.4, metalness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: '#e8edf2', roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#223344', roughness: 0.1, metalness: 0.8 });
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh); return mesh; };
  add(new THREE.SphereGeometry(1.4, 12, 8).scale(1, 0.9, 1.7), paint, 0, 0, 0);
  add(new THREE.SphereGeometry(1.05, 10, 8).scale(1, 0.75, 1), glass, 0, 0.15, 1.3);
  add(new THREE.BoxGeometry(0.4, 0.4, 4.6), paint, 0, 0.2, -3.6);
  add(new THREE.BoxGeometry(0.1, 1.2, 0.7), white, 0, 0.7, -5.8);
  add(new THREE.BoxGeometry(2.9, 0.1, 0.1), white, 0, -1.35, 0.6);
  add(new THREE.BoxGeometry(2.9, 0.1, 0.1), white, 0, -1.35, -0.6);
  const rotor = add(new THREE.BoxGeometry(11, 0.06, 0.32), white, 0, 1.4, 0);
  const rotor2 = add(new THREE.BoxGeometry(0.32, 0.06, 11), white, 0, 1.4, 0);
  const tail = add(new THREE.BoxGeometry(0.06, 1.8, 0.2), white, 0.25, 0.6, -5.8);
  // The searchlight fades from the lamp down to the ground, so the cone has no hard edge.
  const fade = document.createElement('canvas');
  fade.width = 4; fade.height = 128;
  const fctx = fade.getContext('2d');
  const grad = fctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.15, 'rgba(255,255,255,1)'); grad.addColorStop(0.75, 'rgba(110,110,110,1)'); grad.addColorStop(1, 'rgba(0,0,0,1)');
  fctx.fillStyle = grad; fctx.fillRect(0, 0, 4, 128);
  const beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fade), color: '#f4f8ff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5, 1, 20, 1, true).translate(0, -0.5, 0), beamMat);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture, color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  return { group, rotor, rotor2, tail, beam, beamMat, spot };
}

export function createPolice(game) {
  const units = [];
  const cops = [];
  const roadblocks = [];
  const wanted = game.wanted;
  const net = game.world.network;
  let spawnTimer = 0;
  let roadblockTimer = 8;
  let bustTimer = 0;
  let heli = null;
  const heliState = { x: 0, z: 0, y: 40, angle: 0, active: false };

  function makeCop(x, z, heading, unit) {
    const human = new Human(game, { x, z, heading, look: COP_LOOK(rng), role: 'cop', health: 70, armor: 20 });
    const cop = { human, unit, brain: createShooterBrain({ weapon: wanted.level >= 4 ? 'smg' : 'pistol', minRange: 7, maxRange: 20, skill: 0.45 + wanted.level * 0.06 }), mode: 'engage' };
    human.weapon = 'pistol';
    cops.push(cop);
    return cop;
  }

  function attachPoliceDriver(car, unit) {
    car.driver = { kind: 'police', unit, eject: () => { /* officers bail out on their own */ unit.crew = Math.max(0, unit.crew - 1); deployOfficers(unit); } };
    car.ai = car.driver;
    car.sirenOn = true;
  }

  /** A pursuit unit: a cruiser with its crew, spawned on a road out of the player's sight. */
  function spawnUnit() {
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
    const link = rng.pick(best.node.links);
    const toward = net.node(link.to);
    const pos = net.lanePoint(best.node, toward, 6, { x: 0, z: 0 });
    if (game.vehicles.list.some((v) => Math.abs(v.x - pos.x) < 7 && Math.abs(v.z - pos.z) < 7)) return null;
    return spawnUnitAt(pos.x, pos.z, Math.atan2(p.x - pos.x, p.z - pos.z));
  }

  function spawnUnitAt(x, z, heading) {
    const car = game.vehicles.spawn('cruzer', x, z, heading);
    const unit = { car, crew: 2, path: [], pathTimer: 0, stuck: 0, reverse: 0, deployed: false };
    attachPoliceDriver(car, unit);
    units.push(unit);
    return unit;
  }

  function deployOfficers(unit) {
    const car = unit.car;
    for (let n = 0; n < unit.crew; n += 1) {
      const side = n === 0 ? 1 : -1;
      const door = car.localToWorld(side * (car.type.width / 2 + 0.8), 0.4 - n * 0.6);
      makeCop(door.x, door.z, car.heading, unit);
    }
    unit.crew = 0;
    unit.deployed = true;
    car.driver = null;
    car.ai = null;
    car.controls.throttle = 0;
    car.controls.handbrake = true;
  }

  function steer(car, tx, tz) {
    return Math.max(-1, Math.min(1, wrap(Math.atan2(tx - car.x, tz - car.z) - car.heading) * 2.6));
  }

  function updateUnitCar(unit, dt) {
    const car = unit.car;
    const c = car.controls;
    const p = game.player;
    const pv = p.vehicle;
    const tx = p.x + (pv ? pv.vx * 0.6 : 0), tz = p.z + (pv ? pv.vz * 0.6 : 0);
    const d = Math.hypot(tx - car.x, tz - car.z);
    const fwd = car.fwdSpeed;
    if (!pv && d < 24) {
      c.throttle = fwd > 0.5 ? -1 : 0;
      c.steer = steer(car, tx, tz);
      c.handbrake = fwd < 4;
      if (Math.abs(fwd) < 2.5) deployOfficers(unit);
      return;
    }
    if (unit.reverse > 0) {
      unit.reverse -= dt;
      c.throttle = -1; c.steer = -steer(car, tx, tz); c.handbrake = false;
      return;
    }
    let aimX = tx, aimZ = tz;
    const direct = d < 75 && game.world.collision.lineOfSight(car.x, 1, car.z, tx, 1, tz);
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
    c.steer = steer(car, aimX, aimZ);
    const turn = Math.abs(wrap(Math.atan2(aimX - car.x, aimZ - car.z) - car.heading));
    let targetSpeed = car.type.maxSpeed * 0.82;
    if (turn > 0.5) targetSpeed = Math.min(targetSpeed, 9 + (1.6 - Math.min(1.6, turn)) * 14);
    if (pv && d < 16) targetSpeed = wanted.level >= 2 ? pv.speed + 8 : Math.max(0, pv.speed - 1);
    c.throttle = Math.max(-1, Math.min(1, (targetSpeed - fwd) * 0.35));
    c.handbrake = turn > 1.2 && fwd > 14;
    if (targetSpeed > 4 && Math.abs(fwd) < 0.8) unit.stuck += dt; else unit.stuck = 0;
    if (unit.stuck > 1.6) { unit.stuck = 0; unit.reverse = 1.1; }
  }

  function updateCop(cop, dt) {
    const h = cop.human;
    if (!h.alive) { h.move(0, 0, 0); return; }
    const p = game.player;
    const target = playerTarget(game);
    const d = Math.hypot(target.x - h.x, target.z - h.z);
    const unitCar = cop.unit?.car;
    const carUsable = unitCar && !unitCar.destroyed && unitCar.driver === null && game.vehicles.list.includes(unitCar);
    if (wanted.level === 0 || (p.vehicle && p.vehicle.speed > 5 && d > 20 && carUsable && Math.hypot(unitCar.x - h.x, unitCar.z - h.z) < 35)) {
      // Head back to the cruiser and climb in.
      if (carUsable) {
        const door = unitCar.doorPosition();
        const dd = Math.hypot(door.x - h.x, door.z - h.z);
        h.move(door.x - h.x, door.z - h.z, 5);
        h.faceToward(door.x - h.x, door.z - h.z, dt);
        h.pose = 'idle';
        if (dd < 1.6) {
          cop.unit.crew += 1;
          cop.remove = true;
          if (!unitCar.driver) attachPoliceDriver(unitCar, cop.unit);
          cop.unit.deployed = false;
        }
      } else {
        h.move(h.x - p.x, h.z - p.z, wanted.level === 0 ? 1.4 : 5);
        h.pose = 'idle';
      }
      return;
    }
    if (wanted.level === 1 && !p.vehicle) {
      h.weapon = null;
      h.faceToward(target.x - h.x, target.z - h.z, dt);
      h.move(target.x - h.x, target.z - h.z, d > 1.4 ? 6.2 : 0);
      h.pose = 'idle';
      return;
    }
    if (wanted.level === 1 && p.vehicle) {
      const door = p.vehicle.doorPosition();
      h.move(door.x - h.x, door.z - h.z, Math.hypot(door.x - h.x, door.z - h.z) > 1.2 ? 6 : 0);
      h.faceToward(door.x - h.x, door.z - h.z, dt);
      h.weapon = null;
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

  function anyoneSeesPlayer() {
    const t = playerTarget(game);
    for (const cop of cops) {
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
    if (heliState.active && Math.hypot(t.x - heliState.x, t.z - heliState.z) < 60 && game.world.dayNight) return game.clock % 6 < 4.5;
    return false;
  }

  function placeRoadblock() {
    const p = game.player;
    const v = p.vehicle;
    const dirX = v ? v.vx : Math.sin(game.camera.state.yaw), dirZ = v ? v.vz : Math.cos(game.camera.state.yaw);
    const len = Math.hypot(dirX, dirZ) || 1;
    const ax = p.x + (dirX / len) * 110, az = p.z + (dirZ / len) * 110;
    const near = net.nearestEdge(ax, az);
    if (!near || near.distance > 30 || Math.hypot(near.x - p.x, near.z - p.z) < 60) return;
    const a = net.node(near.edge.a), b = net.node(near.edge.b);
    const along = Math.atan2(b.x - a.x, b.z - a.z);
    const perpX = Math.cos(along), perpZ = -Math.sin(along);
    const block = { cars: [], timer: 60 };
    for (const s of [-1, 1]) {
      const car = game.vehicles.spawn('cruzer', near.x + perpX * s * 3.4, near.z + perpZ * s * 3.4, along + Math.PI / 2 + s * 0.35);
      car.sirenOn = true;
      car.persistent = true;
      block.cars.push(car);
      const unit = { car, crew: 0, path: [], pathTimer: 0, stuck: 0, reverse: 0, deployed: true, roadblock: true };
      units.push(unit);
      const behind = car.localToWorld(0, -3.2);
      makeCop(behind.x + perpX * s, behind.z + perpZ * s, along + Math.PI, unit);
    }
    roadblocks.push(block);
    game.events.emit('roadblock', { x: near.x, z: near.z });
  }

  function updateHelicopter(dt) {
    const want = wanted.level >= WANTED.helicopterFromStar;
    if (want && !heli) {
      heli = buildHelicopter(game.world.textures.glow);
      game.scene.add(heli.group, heli.beam, heli.spot);
      const p = game.player;
      heliState.x = p.x - 45; heliState.z = p.z - 35; heliState.y = 38;
    }
    if (!heli) return;
    heliState.active = want;
    const p = game.player;
    heliState.angle += dt * 0.25;
    const tx = want ? p.x + Math.cos(heliState.angle) * 22 : p.x - 300;
    const tz = want ? p.z + Math.sin(heliState.angle) * 22 : p.z - 300;
    heliState.x += (tx - heliState.x) * Math.min(1, dt * 0.6);
    heliState.z += (tz - heliState.z) * Math.min(1, dt * 0.6);
    heli.group.position.set(heliState.x, heliState.y, heliState.z);
    heli.group.rotation.y = Math.atan2(p.x - heliState.x, p.z - heliState.z);
    heli.group.rotation.x = 0.12;
    heli.rotor.rotation.y += dt * 30;
    heli.rotor2.rotation.y = heli.rotor.rotation.y;
    heli.tail.rotation.x += dt * 40;
    // Searchlight from the nose down to the player.
    const night = game.world.dayNight.state.night;
    const sx = p.x + Math.sin(game.clock * 0.7) * 3, sz = p.z + Math.cos(game.clock * 0.9) * 3;
    const dx = sx - heliState.x, dy = -heliState.y, dz = sz - heliState.z;
    const len = Math.hypot(dx, dy, dz);
    heli.beam.position.set(heliState.x, heliState.y - 1, heliState.z);
    heli.beam.scale.set(1, len, 1);
    heli.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    heli.beamMat.opacity = want ? 0.05 + night * 0.14 : 0;
    heli.spot.position.set(sx, 0.2, sz);
    heli.spot.material.opacity = want ? 0.15 + night * 0.5 : 0;
    if (!want && Math.hypot(heliState.x - p.x, heliState.z - p.z) > 250) {
      game.scene.remove(heli.group, heli.beam, heli.spot);
      heli = null;
      heliState.active = false;
    }
    game.audio?.setHelicopter(heli ? Math.max(0, 1 - Math.hypot(heliState.x - p.x, heliState.z - p.z) / 160) : 0);
  }

  function removeUnit(unit) {
    units.splice(units.indexOf(unit), 1);
    if (unit.car !== game.player.vehicle && game.vehicles.list.includes(unit.car)) game.vehicles.remove(unit.car);
  }

  function update(dt) {
    const level = wanted.level;
    const p = game.player;
    // Patrol cruisers in traffic join the chase.
    if (level > 0) {
      for (const v of game.vehicles.list) {
        if (v.type.police && v.ai?.kind === 'traffic' && Math.hypot(v.x - p.x, v.z - p.z) < 130) {
          game.traffic.drivers.delete(v.ai);
          const unit = { car: v, crew: 2, path: [], pathTimer: 0, stuck: 0, reverse: 0, deployed: false };
          attachPoliceDriver(v, unit);
          units.push(unit);
        }
      }
      spawnTimer -= dt;
      const active = units.filter((u) => !u.roadblock && !u.car.destroyed).length;
      if (spawnTimer <= 0 && active < WANTED.copCars[level] && game.allowSpawning) {
        spawnTimer = 2.2;
        spawnUnit();
      }
      if (level >= WANTED.roadblockFromStar && p.vehicle) {
        roadblockTimer -= dt;
        if (roadblockTimer <= 0) { roadblockTimer = 28; placeRoadblock(); }
      }
    }

    for (const unit of [...units]) {
      const car = unit.car;
      if (car === p.vehicle) { units.splice(units.indexOf(unit), 1); continue; }
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (car.ai?.kind === 'police') {
        if (level > 0 && !car.destroyed) updateUnitCar(unit, dt);
        else if (!car.destroyed) {
          // Stand down: rejoin ordinary traffic with the siren off.
          car.sirenOn = false;
          const near = net.nearestEdge(car.x, car.z);
          game.traffic.attachDriver(car, near.edge.a, near.edge.b);
          units.splice(units.indexOf(unit), 1);
          continue;
        }
      }
      const crewOut = cops.some((c) => c.unit === unit);
      if ((d > 240 && !crewOut) || (car.destroyed && d > 120)) removeUnit(unit);
    }

    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      const h = cop.human;
      updateCop(cop, dt);
      h.physics(dt);
      h.syncMesh(dt);
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (cop.remove || d > 200 || (!h.alive && h.deadTime > 30 && d > 25) || (level === 0 && d > 90)) {
        h.dispose();
        cops.splice(i, 1);
      }
    }

    for (let i = roadblocks.length - 1; i >= 0; i -= 1) {
      const block = roadblocks[i];
      block.timer -= dt;
      const far = block.cars.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > 150);
      if (block.timer <= 0 && far || level === 0 && far) {
        for (const car of block.cars) {
          const unit = units.find((u) => u.car === car);
          if (unit) removeUnit(unit);
        }
        roadblocks.splice(i, 1);
      }
    }

    updateHelicopter(dt);
    wanted.update(dt, level > 0 && anyoneSeesPlayer());
    checkBusted(dt);
    let sirenD = Infinity;
    for (const unit of units) if (unit.car.sirenOn && !unit.car.destroyed) sirenD = Math.min(sirenD, Math.hypot(unit.car.x - p.x, unit.car.z - p.z));
    game.audio?.setSiren(sirenD < 160 ? 1 - sirenD / 160 : 0);
  }

  /** Clears every unit (after busted/wasted, or for a scripted scene). */
  function reset() {
    for (const cop of cops) cop.human.dispose();
    cops.length = 0;
    for (const unit of [...units]) removeUnit(unit);
    roadblocks.length = 0;
    if (heli) { game.scene.remove(heli.group, heli.beam, heli.spot); heli = null; heliState.active = false; }
    bustTimer = 0;
  }

  /** Parked cruisers outside headquarters, free to steal (at a price). */
  function parkCruisersAtHQ() {
    const hq = LANDMARKS.policeHQ;
    for (const dz of [-8, 8]) {
      const car = game.vehicles.spawn('cruzer', hq.x - 19, hq.z + dz, Math.PI);
      car.persistent = true;
    }
  }

  return { units, cops, update, reset, spawnUnitAt, parkCruisersAtHQ, deployOfficers, get helicopter() { return heliState.active ? heliState : null; } };
}
