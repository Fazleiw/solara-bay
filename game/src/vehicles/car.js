// Vehicle: arcade driving physics (engine, brakes, a bicycle steering model, lateral grip that
// breaks into drifts under the handbrake), collision with buildings and the sea wall, damage
// with smoke and fire, and the final explosion. Whoever drives sets `controls` each tick.
import { groundHeightAt, isDrivable } from '../world/cityLayout.js';
import { buildVehicleModel } from './carModel.js';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { rng } from '../core/random.js';

let nextVehicleId = 1;

export class Vehicle {
  constructor(game, typeId, x, z, heading, { color = null, random = rng } = {}) {
    this.id = nextVehicleId++;
    this.game = game;
    this.type = VEHICLE_TYPES[typeId];
    this.color = color ?? random.pick(this.type.colors);
    this.model = buildVehicleModel(this.type, this.color, game.world.textures.glow);
    this.x = x;
    this.z = z;
    this.y = 0;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.steerAngle = 0;
    this.wheelSpin = 0;
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.health = this.type.health;
    this.driver = null; // null, 'player', or an AI driver object
    this.ai = null;
    this.sirenOn = false;
    this.burnTimer = 0;
    this.destroyed = false;
    this.drifting = false;
    this.lastImpact = 0;
    this.lastHitBy = null;
    this.lastHitTime = -10;
    this.persistent = false;
    this.mission = null;
    this.roll = 0;
    this.pitch = 0;
    this.fwdSpeed = 0;
    this.latSpeed = 0;
    game.scene.add(this.model.group);
    this.syncMesh();
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  get forwardX() { return Math.sin(this.heading); }
  get forwardZ() { return Math.cos(this.heading); }

  /** World position of a point given in the car's local frame (x right... +z forward). */
  localToWorld(lx, lz) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    // local +x is the car's left side (three.js models face +z with +x to their left).
    return { x: this.x + fx * lz + fz * lx, z: this.z + fz * lz - fx * lx };
  }

  /** Point in this car's local frame for a world point: { lx, lz }. */
  worldToLocal(x, z) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const dx = x - this.x, dz = z - this.z;
    return { lz: dx * fx + dz * fz, lx: dx * fz - dz * fx };
  }

  /** Where the driver gets out: beside the left front door. */
  doorPosition() {
    return this.localToWorld(this.type.width / 2 + 0.9, 0.3);
  }

  update(dt) {
    const t = this.type;
    const c = this.controls;
    if (this.destroyed) { c.throttle = 0; c.steer = 0; c.handbrake = true; }
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx; // the car's right-hand side
    let fwd = this.vx * fx + this.vz * fz;
    let lat = this.vx * rx + this.vz * rz;
    const ground = groundHeightAt(this.x, this.z);
    const onSand = ground !== null && ground < -0.01 || this.x > 287 && this.x < 352 && this.z > -210;
    const accel = t.accel * (onSand ? 0.65 : 1) * (this.health < t.health * 0.2 ? 0.6 : 1);

    if (c.throttle > 0) {
      if (fwd < -0.5) fwd += t.brake * c.throttle * dt;
      else if (fwd < t.maxSpeed) fwd += accel * c.throttle * dt * (1 - (fwd / t.maxSpeed) * 0.55);
    } else if (c.throttle < 0) {
      if (fwd > 0.5) fwd -= t.brake * -c.throttle * dt;
      else if (fwd > -t.maxSpeed * 0.3) fwd -= accel * 0.6 * -c.throttle * dt;
    } else {
      fwd -= fwd * 0.45 * dt + Math.sign(fwd) * Math.min(Math.abs(fwd), 0.6 * dt);
    }
    if (c.handbrake) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 7 * dt);
    fwd -= fwd * Math.abs(fwd) * 0.0006 * dt * 60 * dt;

    const speedFactor = 1 / (1 + Math.abs(fwd) * 0.045);
    const targetSteer = c.steer * t.steer * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 9);
    let yawRate = (fwd / t.wheelbase) * Math.tan(this.steerAngle);
    let grip = t.grip * (onSand ? 0.7 : 1);
    if (c.handbrake && Math.abs(fwd) > 4) {
      yawRate *= 1.55;
      grip = t.driftGrip;
    } else if (Math.abs(lat) > 7) {
      grip *= 0.55; // a big slide recovers gradually
    }
    lat *= Math.exp(-grip * dt);
    this.yawRate = yawRate;
    this.vx = fx * fwd + rx * lat;
    this.vz = fz * fwd + rz * lat;
    this.fwdSpeed = fwd;
    this.latSpeed = lat;
    this.drifting = Math.abs(lat) > 3.2 && Math.abs(fwd) > 6;
    this.heading += yawRate * dt;

    const px = this.x, pz = this.z;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.collideWithCity(px, pz);
    const g = groundHeightAt(this.x, this.z);
    this.y += ((g ?? 0) - this.y) * Math.min(1, dt * 10);

    // Body lean and dive for feel.
    this.roll += (-lat * 0.012 - this.yawRate * fwd * 0.004 - this.roll) * Math.min(1, dt * 6);
    this.pitch += ((c.throttle < 0 && fwd > 1 ? 0.025 : c.throttle > 0 ? -0.012 : 0) - this.pitch) * Math.min(1, dt * 5);
    this.wheelSpin += (fwd / t.wheelRadius) * dt;
    this.updateDamage(dt);
    this.syncMesh();
  }

  /** Pushes the car's two collision circles out of buildings and keeps it out of the sea. */
  collideWithCity(px, pz) {
    const t = this.type;
    const radius = t.width * 0.55;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    for (const offset of [t.length * 0.28, -t.length * 0.28]) {
      const cx = this.x + fx * offset, cz = this.z + fz * offset;
      const push = this.game.world.collision.resolveCircle(cx, cz, radius, this.y);
      if (push.hit) {
        this.x += push.x;
        this.z += push.z;
        const vn = this.vx * push.nx + this.vz * push.nz;
        if (vn < 0) {
          this.vx -= 1.3 * vn * push.nx;
          this.vz -= 1.3 * vn * push.nz;
          this.vx *= 0.85;
          this.vz *= 0.85;
          // The corner that struck spins the car a little.
          this.heading += Math.sign(offset) * Math.sign(fx * push.nz - fz * push.nx) * Math.min(0.15, -vn * 0.01);
          this.impact(-vn, cx - push.nx * radius, cz - push.nz * radius, null);
        }
      }
      if (!isDrivable(cx, cz)) {
        this.x = px;
        this.z = pz;
        this.vx *= -0.25;
        this.vz *= -0.25;
        this.impact(4, cx, cz, null);
        return;
      }
    }
  }

  /** Damage and effects from a crash at speed `force` (m/s of closing speed). */
  impact(force, x, z, other) {
    if (force < 3) return;
    const now = this.game.clock;
    if (force > 5) this.damage((force - 5) * 22, other);
    if (now - this.lastImpact > 0.25) {
      this.lastImpact = now;
      this.game.effects.sparks(x, this.y + 0.6, z, Math.min(16, Math.floor(force)));
      this.game.audio?.sfx.crash(Math.min(1, force / 20), x, z);
      this.game.events.emit('vehicleImpact', { vehicle: this, force, other });
    }
  }

  damage(amount, source = null) {
    if (this.destroyed) return;
    this.health -= amount;
    if (source) { this.lastHitBy = source; this.lastHitTime = this.game.clock; }
    if (this.health <= 0 && this.burnTimer <= 0) this.burnTimer = 4.5;
  }

  updateDamage(dt) {
    const t = this.type;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const ex = this.x + fx * t.length * 0.38, ez = this.z + fz * t.length * 0.38;
    const ratio = this.health / t.health;
    if (!this.destroyed && ratio < 0.4 && rng.next() < (ratio < 0.2 ? 0.6 : 0.25)) this.game.effects.smoke(ex, this.y + 1.0, ez, ratio < 0.2 ? 0.25 : 0.55);
    if (this.burnTimer > 0 && !this.destroyed) {
      this.game.effects.fire(ex, this.y + 1.0, ez);
      this.burnTimer -= dt;
      if (this.burnTimer <= 0) this.explode();
    }
    if (this.destroyed && rng.next() < 0.15) this.game.effects.smoke(this.x, this.y + 1.2, this.z, 0.15);
    if (this.drifting && this.y > -0.05) {
      if (rng.next() < 0.5) this.game.effects.tyreSmoke(this.x - fx * t.length * 0.35, this.z - fz * t.length * 0.35);
      this.game.effects.skid(this.x - fx * t.wheelbase / 2, this.z - fz * t.wheelbase / 2, this.heading, t.width);
    }
  }

  explode() {
    this.destroyed = true;
    this.health = 0;
    this.model.body.material = this.model.assets.burnt;
    this.game.events.emit('vehicleExploded', { vehicle: this });
    this.game.combat.explosion(this.x, this.y + 0.8, this.z, this.lastHitBy);
    this.vx += (rng.next() - 0.5) * 4;
    this.vz += (rng.next() - 0.5) * 4;
  }

  repair() {
    this.health = this.type.health;
    this.burnTimer = 0;
  }

  syncMesh() {
    const m = this.model;
    m.group.position.set(this.x, this.y, this.z);
    m.group.rotation.y = this.heading;
    m.bodyGroup.rotation.z = this.roll;
    m.bodyGroup.rotation.x = this.pitch;
    for (const w of m.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = this.steerAngle;
    }
    if (this.type.bike) m.bodyGroup.rotation.z = -this.yawRate * Math.abs(this.fwdSpeed) * 0.04;
    if (m.lightBar) {
      const on = this.sirenOn && !this.destroyed;
      const phase = Math.floor(this.game.clock * 8) % 2;
      m.lightBar.red.color.set(on && phase ? '#ff2a3a' : '#4a1016');
      m.lightBar.blue.color.set(on && !phase ? '#2a6bff' : '#101a40');
      m.lightBar.glowL.visible = on && phase === 1;
      m.lightBar.glowR.visible = on && phase === 0;
    }
  }

  dispose() {
    this.game.scene.remove(this.model.group);
    this.model.body.geometry.dispose();
  }
}
