// All vehicles in the world: spawning and removal, the per-tick physics pass, car-to-car
// collisions with impulses and damage, cars striking people, keeping people out of car bodies,
// and the real headlight spotlight that rides on the player's car after dark.
import * as THREE from 'three';
import { Vehicle } from './car.js';
import { setVehicleNightLevel } from './carModel.js';

export function createVehicleManager(game) {
  const list = [];
  const headlight = new THREE.SpotLight('#fff1d0', 0, 70, 0.55, 0.5, 1.2);
  headlight.castShadow = false;
  game.scene.add(headlight, headlight.target);

  function spawn(typeId, x, z, heading, options = {}) {
    const v = new Vehicle(game, typeId, x, z, heading, options);
    list.push(v);
    return v;
  }

  function remove(v) {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    v.dispose();
  }

  /** Two collision circles per car along its length. */
  function circles(v, out) {
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const o = v.type.length * 0.28;
    out[0] = v.x + fx * o; out[1] = v.z + fz * o;
    out[2] = v.x - fx * o; out[3] = v.z - fz * o;
    return v.type.width * 0.58;
  }

  const ca = [0, 0, 0, 0], cb = [0, 0, 0, 0];
  function collidePair(a, b) {
    if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) return;
    const ra = circles(a, ca), rb = circles(b, cb);
    for (let i = 0; i < 4; i += 2) {
      for (let j = 0; j < 4; j += 2) {
        const dx = cb[j] - ca[i], dz = cb[j + 1] - ca[i + 1];
        const d2 = dx * dx + dz * dz, rr = ra + rb;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, overlap = rr - d;
        const ma = a.type.mass, mb = b.type.mass, total = ma + mb;
        a.x -= nx * overlap * (mb / total); a.z -= nz * overlap * (mb / total);
        b.x += nx * overlap * (ma / total); b.z += nz * overlap * (ma / total);
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const impulse = (-(1 + 0.3) * rel) / (1 / ma + 1 / mb);
          a.vx -= (impulse / ma) * nx; a.vz -= (impulse / ma) * nz;
          b.vx += (impulse / mb) * nx; b.vz += (impulse / mb) * nz;
          const px = (ca[i] + cb[j]) / 2, pz = (ca[i + 1] + cb[j + 1]) / 2;
          a.impact(-rel, px, pz, b);
          b.impact(-rel, px, pz, a);
          a.heading += (i === 0 ? 1 : -1) * Math.min(0.08, -rel * 0.004) * Math.sign(nx * Math.cos(a.heading) - nz * Math.sin(a.heading));
        }
      }
    }
  }

  /** People inside a moving car's footprint get hit; slow cars just shove them aside. */
  function strikeHumans(v) {
    const speed = v.speed;
    for (const h of game.humans) {
      if (h.inVehicle || Math.abs(h.x - v.x) > 4 || Math.abs(h.z - v.z) > 4) continue;
      const { lx, lz } = v.worldToLocal(h.x, h.z);
      const hw = v.type.width / 2 + 0.3, hl = v.type.length / 2 + 0.3;
      if (Math.abs(lx) > hw || Math.abs(lz) > hl || h.y > v.y + v.type.height + 0.3) continue;
      if (speed > 4.5 && h.knockTimer <= 0 && (h.alive || speed > 8)) {
        h.hitByVehicle(v, speed);
        v.vx *= 0.93; v.vz *= 0.93;
        v.damage(speed * 1.5);
      }
    }
  }

  /** Called from Human.physics: moves a person standing inside a car's footprint out of it. */
  function pushHumanOut(h) {
    for (const v of list) {
      if (Math.abs(h.x - v.x) > 4 || Math.abs(h.z - v.z) > 4) continue;
      if (h.y > v.y + v.type.height) continue;
      const { lx, lz } = v.worldToLocal(h.x, h.z);
      const hw = v.type.width / 2 + h.radius, hl = v.type.length / 2 + h.radius;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hl) continue;
      const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      if (px < pz) {
        const s = Math.sign(lx) * px;
        h.x += fz * s; h.z -= fx * s;
      } else {
        const s = Math.sign(lz) * pz;
        h.x += fx * s; h.z += fz * s;
      }
    }
  }

  function nearestVehicle(x, z, range, filter = () => true) {
    let best = null, bestD = range * range;
    for (const v of list) {
      const d = (v.x - x) ** 2 + (v.z - z) ** 2;
      if (d < bestD && filter(v)) { bestD = d; best = v; }
    }
    return best;
  }

  function update(dt) {
    for (const v of list) v.update(dt);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) collidePair(list[i], list[j]);
      if (list[i].speed > 4) strikeHumans(list[i]);
    }
    const night = game.world.dayNight.state.night;
    setVehicleNightLevel(night);
    const car = game.player.vehicle;
    if (car && night > 0.2 && !car.destroyed) {
      const front = car.localToWorld(0, car.type.length / 2);
      const ahead = car.localToWorld(0, car.type.length / 2 + 20);
      headlight.position.set(front.x, car.y + 0.9, front.z);
      headlight.target.position.set(ahead.x, car.y - 1, ahead.z);
      headlight.intensity = night * 60;
    } else {
      headlight.intensity = 0;
    }
  }

  return { list, spawn, remove, update, nearestVehicle, pushHumanOut };
}
