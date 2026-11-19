// Human: the body every person shares (player, pedestrians, police, gangs): movement with
// collision against buildings and the sea, gravity and jumping, health and armour, being shot,
// punched or hit by a car (a tumbling knock-down), dying, and posing the model each frame.
import { groundHeightAt, isOnBlock, isWalkable } from '../world/cityLayout.js';
import { animateHuman, buildHumanModel } from './humanModel.js';
import { rng } from '../core/random.js';

let nextHumanId = 1;

export class Human {
  constructor(game, { x, z, heading = 0, look, role = 'ped', health = 100, armor = 0 }) {
    this.id = nextHumanId++;
    this.game = game;
    this.role = role;
    this.look = look;
    this.model = buildHumanModel(look);
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = heading;
    this.moveX = 0; // desired velocity this tick
    this.moveZ = 0;
    this.pushX = 0; // knock-back velocity
    this.pushZ = 0;
    this.health = health;
    this.maxHealth = health;
    this.armor = armor;
    this.alive = true;
    this.onGround = true;
    this.inVehicle = null;
    this.pose = 'idle';
    this.phase = rng.range(0, 6);
    this.aimPitch = 0;
    this.knockTimer = 0;
    this.deadTime = 0;
    this.radius = 0.4;
    this.weapon = null;
    this.lastAttacker = null;
    this.hitFlash = 0;
    game.scene.add(this.model.group);
    game.humans.add(this);
  }

  get speed() {
    return Math.hypot(this.moveX, this.moveZ);
  }

  /** Walk or run toward a direction this tick (dx, dz need not be unit length). */
  move(dx, dz, speed) {
    const len = Math.hypot(dx, dz);
    if (len < 1e-4 || speed <= 0) { this.moveX = 0; this.moveZ = 0; return; }
    this.moveX = (dx / len) * speed;
    this.moveZ = (dz / len) * speed;
  }

  faceToward(dx, dz, dt, rate = 10) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    const target = Math.atan2(dx, dz);
    let diff = target - this.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.heading += diff * Math.min(1, dt * rate);
  }

  jump(speed) {
    if (!this.onGround || !this.alive) return;
    this.vy = speed;
    this.onGround = false;
  }

  /** Integrates movement, knock-back and gravity; resolves walls, cars and the water's edge. */
  physics(dt) {
    if (this.inVehicle) return;
    const canWalk = this.alive && this.knockTimer <= 0;
    const vx = (canWalk ? this.moveX : 0) + this.pushX;
    const vz = (canWalk ? this.moveZ : 0) + this.pushZ;
    const damping = this.onGround ? 6 : 0.5;
    this.pushX -= this.pushX * Math.min(1, dt * damping);
    this.pushZ -= this.pushZ * Math.min(1, dt * damping);
    const nx = this.x + vx * dt, nz = this.z + vz * dt;
    if (isWalkable(nx, this.z)) this.x = nx; else this.pushX = 0;
    if (isWalkable(this.x, nz)) this.z = nz; else this.pushZ = 0;
    const push = this.game.world.collision.resolveCircle(this.x, this.z, this.radius, this.y);
    if (push.hit) { this.x += push.x; this.z += push.z; }
    this.game.vehicles.pushHumanOut(this);

    const ground = (groundHeightAt(this.x, this.z) ?? 0) + (isOnBlock(this.x, this.z) ? 0.12 : 0);
    this.vy -= 19 * dt;
    this.y += this.vy * dt;
    if (this.y <= ground) {
      this.y = ground;
      this.vy = 0;
      this.onGround = true;
    } else if (this.y > ground + 0.05) {
      this.onGround = false;
    }
    if (this.knockTimer > 0) this.knockTimer -= dt;
    if (!this.alive) this.deadTime += dt;
  }

  /** Applies damage; armour soaks most of it first. Returns true if this hit killed. */
  takeDamage(amount, source = null, { dirX = 0, dirZ = 0, force = 0 } = {}) {
    if (!this.alive) return false;
    let dmg = amount;
    if (this.armor > 0) {
      const soaked = Math.min(this.armor, dmg * 0.7);
      this.armor -= soaked;
      dmg -= soaked;
    }
    this.health -= dmg;
    this.lastAttacker = source;
    this.hitFlash = 0.15;
    this.pushX += dirX * force;
    this.pushZ += dirZ * force;
    this.game.effects.blood(this.x, this.y + 1.2, this.z, dirX, dirZ);
    this.game.events.emit('humanHurt', { human: this, source, amount });
    if (this.health <= 0) {
      this.die(source);
      return true;
    }
    return false;
  }

  /** Knocked by a car: thrown along its velocity, hurt by the closing speed. */
  hitByVehicle(vehicle, relSpeed) {
    if (this.inVehicle) return;
    const vx = vehicle.vx, vz = vehicle.vz;
    const len = Math.hypot(vx, vz) || 1;
    this.pushX = (vx / len) * relSpeed * 0.8;
    this.pushZ = (vz / len) * relSpeed * 0.8;
    this.vy = Math.min(7, relSpeed * 0.35);
    this.onGround = false;
    this.knockTimer = 1.4;
    const wasAlive = this.alive;
    const killer = vehicle.driver === 'player' ? 'player' : vehicle.driver ? 'npc' : null;
    this.takeDamage(relSpeed * 5.5, killer, {});
    if (wasAlive) this.game.events.emit('humanRunOver', { human: this, vehicle, killed: !this.alive });
  }

  die(source) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.deadTime = 0;
    this.model.parts.gun.visible = false;
    this.game.events.emit('humanDied', { human: this, source });
  }

  /** Poses and places the model; called after the owner's AI and physics. */
  syncMesh(dt) {
    const g = this.model.group;
    const cam = this.game.camera?.position;
    const far = cam && Math.abs(cam.x - this.x) + Math.abs(cam.z - this.z) > 160;
    g.visible = !far && (!this.inVehicle || (this.inVehicle.type.bike ?? false));
    if (this.inVehicle || far) return;
    g.position.set(this.x, this.y, this.z);
    g.rotation.y = this.heading;
    const speed = this.speed;
    let pose = this.pose;
    if (!this.alive) pose = 'dead';
    else if (this.knockTimer > 0) pose = 'dead';
    else if (pose === 'idle' || pose === 'walk' || pose === 'run') pose = speed > 5 ? 'run' : speed > 0.3 ? 'walk' : 'idle';
    this.phase += dt * (pose === 'run' ? speed * 1.6 : speed * 2.4);
    animateHuman(this.model.parts, pose, this.phase, this.aimPitch);
    this.model.parts.gun.visible = this.alive && !!this.weapon && this.weapon !== 'fists';
    if (this.knockTimer > 0 && !this.onGround) this.model.parts.body.rotation.x = -this.knockTimer * 4;
  }

  dispose() {
    this.game.scene.remove(this.model.group);
    this.game.humans.delete(this);
  }
}
