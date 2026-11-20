// The third-person camera: mouse-orbit around the player on foot (tight over-the-shoulder
// framing while aiming), a low chase view behind cars that frames the car in the lower third
// and swings back behind the bonnet when the mouse rests (camera/chaseFraming.js), wall
// avoidance and camera shake.
import * as THREE from 'three';
import { rng } from '../core/random.js';
import { chaseFraming, chaseRig, recenterStep } from './chaseFraming.js';

export function createFollowCamera(game, aspect) {
  const camera = new THREE.PerspectiveCamera(65, aspect, 0.25, 2600);
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const state = { yaw: 0, pitch: 0.22, distance: 5.2, idle: 0, shake: 0, fov: 65, lookBack: false, cinematic: null, reverseTime: 0, aimDistance: 10, aimRise: 0, pivotRise: 1.6 };

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  /** Direction the lens looks along through the middle of the screen (unit): where shots go. */
  function forward(out = new THREE.Vector3()) {
    return camera.getWorldDirection(out);
  }

  function update(dt, input, settings) {
    const player = game.player;
    const car = player.vehicle;
    const sens = 0.0024 * (settings?.mouseSensitivity ?? 1);
    const mdx = input.state.mouseDX, mdy = input.state.mouseDY * (settings?.invertY ? -1 : 1);
    state.yaw -= mdx * sens;
    state.pitch = THREE.MathUtils.clamp(state.pitch + mdy * sens, -0.5, 1.25);
    state.idle = Math.abs(mdx) + Math.abs(mdy) > 0.5 ? 0 : state.idle + dt;

    const aiming = !car && player.isAiming;
    let dist, fov, shoulder = 0, aimDistance = 10, aimRise = 0;
    if (car) {
      const frame = chaseFraming(car.fwdSpeed, car.type.length, car.type.height);
      // Rise, aim distance and lift ease like the distance does, so a gear change never jolts the frame.
      const k = Math.min(1, dt * 3);
      state.pivotRise += (frame.pivotRise - state.pivotRise) * k;
      state.aimDistance += (frame.aimDistance - state.aimDistance) * k;
      state.aimRise += (frame.aimRise - state.aimRise) * k;
      target.set(car.x, car.y + state.pivotRise, car.z);
      dist = frame.distance;
      fov = frame.fov;
      aimDistance = state.aimDistance;
      aimRise = state.aimRise;
      Object.assign(state, recenterStep(state, car, dt, frame.pitch));
    } else {
      const h = player.human;
      target.set(h.x, h.y + 1.55, h.z);
      dist = aiming ? 3.1 : 5.0;
      shoulder = aiming ? 0.95 : 0.25;
      fov = aiming ? 52 : 64;
      state.reverseTime = 0;
      state.pivotRise = 1.6;
      state.aimDistance = 10;
      state.aimRise = 0;
    }
    let yaw = state.yaw;
    if (input.down('lookBack')) yaw += Math.PI;
    state.distance += (dist - state.distance) * Math.min(1, dt * 6);
    state.fov += (fov - state.fov) * Math.min(1, dt * 4);
    // Right of the view direction: (-cos yaw, sin yaw).
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const pivot = desired.set(target.x + rx * shoulder, target.y, target.z + rz * shoulder);
    const lens = { pivotRise: 0, aimDistance, aimRise };
    // Pull in when a wall is between the player and the camera.
    let d = state.distance;
    let rig = chaseRig(pivot, lens, yaw, state.pitch, d);
    look.set(rig.look.x, rig.look.y, rig.look.z);
    const hit = game.world.collision.raycast(pivot.x, pivot.y, pivot.z, -look.x, -look.y, -look.z, d + 0.4);
    if (hit < d + 0.4) { d = Math.max(0.8, hit - 0.4); rig = chaseRig(pivot, lens, yaw, state.pitch, d); }
    camera.position.set(rig.position.x, Math.max(rig.position.y, 0.4), rig.position.z);
    if (state.shake > 0) {
      camera.position.x += rng.range(-1, 1) * state.shake * 0.3;
      camera.position.y += rng.range(-1, 1) * state.shake * 0.3;
      state.shake = Math.max(0, state.shake - dt * 2.5);
    }
    camera.lookAt(rig.aim.x, rig.aim.y, rig.aim.z);
    if (Math.abs(camera.fov - state.fov) > 0.05) { camera.fov = state.fov; camera.updateProjectionMatrix(); }
  }

  /** Puts the camera at an exact pose (screenshots, title screen flyover). */
  function setPose(x, y, z, lx, ly, lz, fov = 60) {
    camera.position.set(x, y, z);
    camera.lookAt(lx, ly, lz);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  return {
    camera,
    state,
    update,
    forward,
    setPose,
    shake(amount) { state.shake = Math.min(1.5, state.shake + amount); },
    get position() { return camera.position; },
    /** Faces the camera the same way as a heading (behind the player or car). */
    alignBehind(heading, pitch = 0.22) { state.yaw = heading; state.pitch = pitch; },
  };
}
