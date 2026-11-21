// Regression test for the chase camera's framing (game/src/camera/chaseFraming.js).
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { chaseFraming, chaseRig, recenterStep } from '../game/src/camera/chaseFraming.js';

const CARS = {
  vantor: { length: 4.45, height: 1.18 },
  mirela: { length: 4.6, height: 1.45 },
  tessaro: { length: 5.6, height: 2.4 },
};
const ASPECT = 1280 / 800;
const STEP = 1 / 60;

/** Projects a world point through a camera at `pos` aiming at `aim` with vertical `fov` degrees; returns NDC {x, y, depth}. */
function project(point, pos, aim, fov) {
  const f = norm(sub(aim, pos));
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const u = cross(r, f);
  const d = sub(point, pos);
  const depth = dot(d, f);
  const t = Math.tan((fov * Math.PI) / 360);
  return { x: dot(d, r) / depth / (t * ASPECT), y: dot(d, u) / depth / t, depth };
}
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };

/** A car at the origin heading +z, framed by the settled chase rig at `speed`. */
function frameCar(kind, speed) {
  const { length, height } = CARS[kind];
  const car = { x: 0, y: 0, z: 0 };
  const frame = chaseFraming(speed, length, height);
  const rig = chaseRig(car, frame, 0, frame.pitch);
  const base = project({ x: 0, y: 0, z: 0 }, rig.position, rig.aim, frame.fov);
  const roof = project({ x: 0, y: height, z: 0 }, rig.position, rig.aim, frame.fov);
  const centre = project({ x: 0, y: height / 2, z: 0 }, rig.position, rig.aim, frame.fov);
  // Where the middle of the screen meets the road, measured from the car.
  const dir = norm(sub(rig.aim, rig.position));
  const groundAhead = dir.y < 0 ? rig.position.z + dir.z * (rig.position.y / -dir.y) : Infinity;
  return { frame, rig, base, roof, centre, groundAhead, height };
}

test('the car sits in the lower part of the screen, never at dead centre or clipped', () => {
  for (const kind of Object.keys(CARS)) {
    for (const speed of [0, 12, 25, 40, 60]) {
      const { centre, base } = frameCar(kind, speed);
      assert.ok(centre.y < -0.15 && centre.y > -0.55, `${kind} at ${speed} m/s: car centre at NDC y ${centre.y.toFixed(3)}`);
      assert.ok(base.y > -0.85, `${kind} at ${speed} m/s: wheels at NDC y ${base.y.toFixed(3)} too close to the bottom edge`);
    }
  }
});

test('the car reads larger than a thin sliver at chase speed', () => {
  for (const speed of [25, 40]) {
    const { roof, base } = frameCar('vantor', speed);
    const share = (roof.y - base.y) / 2;
    assert.ok(share >= 0.13, `vantor at ${speed} m/s fills ${(share * 100).toFixed(1)}% of the screen height`);
  }
});

test('the field of view widens a little with speed, not a fisheye', () => {
  const rest = chaseFraming(0, 4.45, 1.18).fov;
  let prev = rest;
  for (const speed of [10, 20, 30, 45, 64]) {
    const fov = chaseFraming(speed, 4.45, 1.18).fov;
    assert.ok(fov >= prev, 'fov never narrows as speed rises');
    prev = fov;
  }
  assert.ok(prev <= 74, `top-speed fov ${prev.toFixed(1)} is over 74 degrees`);
  assert.ok(prev - rest <= 9, `fov swings ${(prev - rest).toFixed(1)} degrees from rest to top speed`);
});

test('there is more road ahead as the car goes faster', () => {
  const slow = frameCar('vantor', 0).groundAhead;
  const fast = frameCar('vantor', 30).groundAhead;
  assert.ok(fast >= 25, `at 30 m/s the screen centre meets the road ${fast.toFixed(1)} m ahead`);
  assert.ok(fast > slow, 'look-ahead grows with speed');
});

test('the lens keeps clear of the roof and the body', () => {
  for (const kind of Object.keys(CARS)) {
    for (const speed of [0, 30, 60]) {
      const { rig, height } = frameCar(kind, speed);
      assert.ok(rig.position.y - height >= 0.9, `${kind}: lens only ${(rig.position.y - height).toFixed(2)} m over the roof`);
      assert.ok(-rig.position.z >= CARS[kind].length / 2 + 2, `${kind}: lens inside the car's length`);
    }
  }
});

/** Runs recenterStep for `seconds` with the car at constant fwdSpeed. */
function settle(start, car, seconds, idle = 5) {
  let rig = { yaw: start, pitch: 0.13, idle, reverseTime: 0 };
  let biggest = 0;
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    const next = recenterStep(rig, car, STEP);
    biggest = Math.max(biggest, Math.abs(next.yaw - rig.yaw));
    rig = { ...rig, ...next, idle: idle + i * STEP };
  }
  return { rig, biggest };
}

test('mouse input wins: no recentre while the player is looking around', () => {
  const car = { heading: 0, fwdSpeed: 20 };
  const { rig } = settle(1.2, car, 0.5, 0.2);
  assert.equal(rig.yaw, 1.2);
});

test('auto recentre eases back behind the bonnet without a snap', () => {
  const car = { heading: 0, fwdSpeed: 20 };
  const { rig, biggest } = settle(Math.PI / 2, car, 2.5);
  assert.ok(Math.abs(rig.yaw) < 0.17, `still ${rig.yaw.toFixed(2)} rad off after 2.5 s`);
  assert.ok(biggest < 0.06, `one frame swung ${biggest.toFixed(3)} rad`);
});

test('a quick tap of reverse does not spin the camera round', () => {
  const car = { heading: 0, fwdSpeed: -3 };
  const { rig } = settle(0, car, 0.3);
  assert.ok(Math.abs(rig.yaw) < 0.2, `tap of reverse swung the camera to ${rig.yaw.toFixed(2)} rad`);
});

test('reverse pulses separated by a sustained crawl do not trigger the reverse camera', () => {
  let rig = { yaw: 0, pitch: 0.13, idle: 5, reverseTime: 0 };
  for (const [speed, seconds] of [[-7, 0.5], [-1, 1.5], [-7, 0.5]]) {
    for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
      rig = { ...rig, ...recenterStep(rig, { heading: 0, fwdSpeed: speed }, STEP) };
    }
  }
  assert.equal(rig.yaw, 0);
});

test('sustained reversing turns the camera to look out of the back', () => {
  const car = { heading: 0, fwdSpeed: -7 };
  const { rig } = settle(0, car, 3);
  assert.ok(Math.abs(Math.abs(rig.yaw) - Math.PI) < 0.35, `after 3 s of reversing the camera faces ${rig.yaw.toFixed(2)} rad`);
});

test('parked or crawling: the camera stays where the player left it', () => {
  const car = { heading: 0, fwdSpeed: 1 };
  const { rig } = settle(0.9, car, 2);
  assert.equal(rig.yaw, 0.9);
});
