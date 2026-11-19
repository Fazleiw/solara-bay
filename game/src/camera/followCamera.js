// The third-person camera: mouse-orbit around the player on foot (tight over-the-shoulder
// framing while aiming), a chase view behind cars that swings back behind the bonnet when the
// mouse rests, speed-based field of view, wall avoidance and camera shake.
import * as THREE from 'three';
import { rng } from '../core/random.js';

export function createFollowCamera(game, aspect) {
  const camera = new THREE.PerspectiveCamera(65, aspect, 0.25, 2600);
  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const state = { yaw: 0, pitch: 0.22, distance: 5.2, idle: 0, shake: 0, fov: 65, lookBack: false, cinematic: null };

  function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

  /** Direction the camera looks along (unit). */
  function forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(state.yaw) * Math.cos(state.pitch), -Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch));
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
    let dist, height, fov, shoulder = 0;
    if (car) {
      target.set(car.x, car.y + car.type.height * 0.7 + 0.6, car.z);
      dist = 4.2 + car.type.length * 0.75;
      height = 0;
      const speed = Math.abs(car.fwdSpeed);
      fov = 66 + Math.min(18, speed * 0.32);
      if (state.idle > 1.0 && speed > 2) {
        const behind = car.fwdSpeed < -2 ? car.heading + Math.PI : car.heading;
        state.yaw += wrap(behind - state.yaw) * Math.min(1, dt * 2.5);
        state.pitch += (0.2 - state.pitch) * Math.min(1, dt * 1.5);
      }
    } else {
      const h = player.human;
      target.set(h.x, h.y + 1.55, h.z);
      dist = aiming ? 3.1 : 5.0;
      shoulder = aiming ? 0.95 : 0.25;
      fov = aiming ? 52 : 64;
      height = 0;
    }
    let yaw = state.yaw;
    if (input.down('lookBack')) yaw += Math.PI;
    state.distance += (dist - state.distance) * Math.min(1, dt * 6);
    state.fov += (fov - state.fov) * Math.min(1, dt * 4);
    forward(look);
    if (yaw !== state.yaw) look.set(Math.sin(yaw) * Math.cos(state.pitch), -Math.sin(state.pitch), Math.cos(yaw) * Math.cos(state.pitch));
    // Right of the view direction: (-cos yaw, sin yaw).
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const pivot = desired.set(target.x + rx * shoulder, target.y + height, target.z + rz * shoulder);
    // Pull in when a wall is between the player and the camera.
    let d = state.distance;
    const hit = game.world.collision.raycast(pivot.x, pivot.y, pivot.z, -look.x, -look.y, -look.z, d + 0.4);
    if (hit < d + 0.4) d = Math.max(0.8, hit - 0.4);
    camera.position.set(pivot.x - look.x * d, Math.max(pivot.y - look.y * d, 0.4), pivot.z - look.z * d);
    if (state.shake > 0) {
      camera.position.x += rng.range(-1, 1) * state.shake * 0.3;
      camera.position.y += rng.range(-1, 1) * state.shake * 0.3;
      state.shake = Math.max(0, state.shake - dt * 2.5);
    }
    camera.lookAt(pivot.x + look.x * 10, pivot.y + look.y * 10, pivot.z + look.z * 10);
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
