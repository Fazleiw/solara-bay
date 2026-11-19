// Dani Reyes, the player: on-foot movement relative to the camera (jog, sprint, jump), aiming
// and shooting or punching, weapon switching and reloading, stealing a car by pulling its
// driver out, driving (throttle, brakes, handbrake drifts, horn, siren, radio, drive-by fire)
// and getting out again.
import { PLAYER } from '../config.js';
import { Human } from './human.js';
import { animateHuman } from './humanModel.js';
import { createInventory, cycleWeapon, reload, WEAPON_ORDER, WEAPONS } from '../combat/weapons.js';

export const DANI_LOOK = {
  skin: '#c68642', hair: '#161616', hairStyle: 1, shirt: '#f4efe6', sleeves: '#1fa9a3', vest: '#1fa9a3',
  pants: '#2b2d42', shoes: '#f5f5f5', height: 1.0, shades: true,
};

export function createPlayer(game, x, z) {
  const human = new Human(game, { x, z, look: DANI_LOOK, role: 'player', health: PLAYER.maxHealth });
  const player = {
    human,
    vehicle: null,
    inventory: createInventory(),
    isAiming: false,
    fireCooldown: 0,
    punchTimer: 0,
    enterCooldown: 0,
    controlsLocked: false,
    get x() { return this.vehicle ? this.vehicle.x : human.x; },
    get z() { return this.vehicle ? this.vehicle.z : human.z; },
    get speed() { return this.vehicle ? this.vehicle.speed : human.speed; },
    get weaponId() { return this.inventory.current; },
  };

  function aimRay() {
    const cam = game.camera.camera;
    const f = game.camera.forward();
    return { ox: cam.position.x, oy: cam.position.y, oz: cam.position.z, dx: f.x, dy: f.y, dz: f.z };
  }

  /** Fires the current gun toward the crosshair, from the hand (or the car window). */
  function shoot() {
    const def = WEAPONS[player.inventory.current];
    const slot = player.inventory.owned[def.id];
    if (slot.mag <= 0) {
      if (!reload(player.inventory)) game.audio?.sfx.click();
      else { player.fireCooldown = 1.0; game.audio?.sfx.reload(); }
      return;
    }
    slot.mag -= 1;
    player.fireCooldown = def.rate;
    const ray = aimRay();
    // Find what the crosshair points at, then shoot at it from the muzzle.
    const probe = game.combat.castRay(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, def.range + 10, human, player.vehicle);
    const t = Math.min(probe.t, def.range + 10);
    const tx = ray.ox + ray.dx * t, ty = ray.oy + ray.dy * t, tz = ray.oz + ray.dz * t;
    let mx, my, mz;
    if (player.vehicle) {
      const side = player.vehicle.localToWorld(player.vehicle.type.width / 2 + 0.3, 0.2);
      mx = side.x; my = player.vehicle.y + 1.3; mz = side.z;
    } else {
      const fx = Math.sin(human.heading), fz = Math.cos(human.heading);
      mx = human.x + fx * 0.75 - fz * 0.25; my = human.y + 1.42; mz = human.z + fz * 0.75 + fx * 0.25;
    }
    let dx = tx - mx, dy = ty - my, dz = tz - mz;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    game.combat.fire(human, def.id, mx, my, mz, dx, dy, dz, { inaccuracy: player.vehicle ? 0.02 : 0 });
    game.camera.shake(def.id === 'shotgun' ? 0.25 : 0.06);
    if (slot.mag === 0 && slot.reserve > 0) { reload(player.inventory); player.fireCooldown = 1.1; game.audio?.sfx.reload(); }
  }

  function handleWeapons(dt, input, onFoot) {
    player.fireCooldown -= dt;
    if (input.state.wheel) cycleWeapon(player.inventory, input.state.wheel > 0 ? 1 : -1);
    if (input.pressed('prevWeapon')) cycleWeapon(player.inventory, -1);
    WEAPON_ORDER.forEach((id, i) => { if (input.pressed(`weapon${i + 1}`) && player.inventory.owned[id]) player.inventory.current = id; });
    if (onFoot && input.pressed('reload') && reload(player.inventory)) { player.fireCooldown = 1.1; game.audio?.sfx.reload(); }
    const def = WEAPONS[player.inventory.current];
    const wantsFire = def.auto ? input.state.fire : input.state.firePressed;
    if (!wantsFire || player.fireCooldown > 0) return;
    if (def.melee) {
      if (!onFoot) return;
      player.fireCooldown = def.rate;
      player.punchTimer = 0.25;
      game.combat.punch(human);
    } else {
      shoot();
    }
  }

  /** Gets into the nearest car, pulling out whoever was driving it. */
  function tryEnterVehicle() {
    const car = game.vehicles.nearestVehicle(human.x, human.z, PLAYER.enterRange, (v) => !v.destroyed && (!v.type.bike || true));
    if (!car) return false;
    const previous = car.driver;
    if (previous && previous !== 'player') {
      game.events.emit('carJacked', { vehicle: car, driver: previous });
      if (previous.eject) previous.eject(car);
    }
    car.driver = 'player';
    car.ai = null;
    car.controls.throttle = 0;
    player.vehicle = car;
    human.inVehicle = car;
    human.pose = car.type.bike ? 'drive' : 'idle';
    player.enterCooldown = 0.4;
    game.audio?.sfx.door();
    game.events.emit('playerEnteredVehicle', { vehicle: car });
    return true;
  }

  function exitVehicle(force = false) {
    const car = player.vehicle;
    if (!car) return;
    if (!force && car.speed > 9) return;
    const door = car.doorPosition();
    human.x = door.x; human.z = door.z;
    human.y = car.y;
    human.inVehicle = null;
    human.pose = 'idle';
    human.heading = car.heading;
    car.driver = null;
    car.controls.throttle = 0;
    car.controls.handbrake = car.speed < 3;
    car.sirenOn = false;
    player.vehicle = null;
    player.enterCooldown = 0.4;
    game.audio?.sfx.door();
    game.events.emit('playerExitedVehicle', { vehicle: car });
  }

  function updateOnFoot(dt, input) {
    const cam = game.camera.state;
    const fwd = input.axis('back', 'forward');
    const strafe = input.axis('left', 'right');
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const rx = -fz, rz = fx;
    const mx = fx * fwd + rx * strafe, mz = fz * fwd + rz * strafe;
    const armed = player.inventory.current !== 'fists';
    player.isAiming = input.state.aim || (armed && input.state.fire);
    const speed = player.isAiming ? 3.2 : input.down('sprint') ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    human.move(mx, mz, Math.hypot(fwd, strafe) > 0 ? speed : 0);
    if (player.isAiming) {
      human.faceToward(fx, fz, dt, 20);
      human.pose = armed ? 'aim' : 'idle';
      human.aimPitch = -cam.pitch * 0.8;
    } else {
      human.faceToward(mx, mz, dt, 12);
      human.pose = 'idle';
    }
    if (player.punchTimer > 0) { player.punchTimer -= dt; human.pose = 'punch'; }
    if (input.pressed('jump')) human.jump(PLAYER.jumpSpeed);
    human.weapon = player.inventory.current;
    handleWeapons(dt, input, true);
    if (input.pressed('enter') && player.enterCooldown <= 0) tryEnterVehicle();
  }

  function updateDriving(dt, input) {
    const car = player.vehicle;
    car.controls.throttle = input.axis('back', 'forward');
    car.controls.steer = input.axis('right', 'left');
    car.controls.handbrake = input.down('handbrake');
    player.isAiming = false;
    if (input.pressed('horn')) game.audio?.sfx.horn(car.type.id === 'tessaro' || car.type.id === 'haulden' ? 0.8 : 1.1);
    if (input.pressed('interact') && car.type.police) car.sirenOn = !car.sirenOn;
    if (input.pressed('radio')) game.audio?.radio.next();
    human.weapon = player.inventory.current;
    if (player.inventory.current !== 'fists') handleWeapons(dt, input, false);
    else if (input.state.wheel || input.pressed('prevWeapon')) handleWeapons(dt, input, false);
    human.x = car.x; human.z = car.z; human.y = car.y + (car.type.bike ? 0.35 : 0);
    if (car.type.bike) {
      const g = human.model.group;
      g.position.set(car.x, car.y + 0.25, car.z);
      g.rotation.y = car.heading;
      g.rotation.z = car.model.bodyGroup.rotation.z;
      animateHuman(human.model.parts, 'drive', 0);
    }
    if (input.pressed('enter') && player.enterCooldown <= 0) exitVehicle();
    if (car.destroyed && car.burnTimer <= 0 && human.alive) exitVehicle(true);
  }

  player.update = (dt, input) => {
    player.enterCooldown -= dt;
    if (!human.alive || player.controlsLocked) {
      human.move(0, 0, 0);
      if (player.vehicle) { player.vehicle.controls.throttle = 0; player.vehicle.controls.handbrake = true; }
      return;
    }
    if (player.vehicle) updateDriving(dt, input);
    else updateOnFoot(dt, input);
  };

  player.enterVehicle = (car) => {
    human.x = car.x; human.z = car.z;
    return tryEnterVehicleDirect(car);
  };
  function tryEnterVehicleDirect(car) {
    car.driver = 'player';
    car.ai = null;
    player.vehicle = car;
    human.inVehicle = car;
    game.events.emit('playerEnteredVehicle', { vehicle: car });
    return true;
  }
  player.exitVehicle = exitVehicle;
  player.tryEnterVehicle = tryEnterVehicle;

  /** Places Dani somewhere new on foot, healthy (respawns, mission starts, screenshots). */
  player.teleport = (x, z, heading = 0) => {
    if (player.vehicle) exitVehicle(true);
    human.x = x; human.z = z; human.y = 0; human.vy = 0;
    human.heading = heading;
    human.pushX = human.pushZ = 0;
  };
  player.revive = () => {
    human.alive = true;
    human.health = PLAYER.maxHealth;
    human.knockTimer = 0;
    human.deadTime = 0;
  };
  return player;
}
