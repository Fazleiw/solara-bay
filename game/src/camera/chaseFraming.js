// The chase camera's framing as plain numbers (no three.js): how far back, how high and how
// wide the lens sits behind a car at a given speed, where it aims, and how it swings back
// behind the car when the mouse rests. camera/followCamera.js applies it each frame.
//
// The car sits in the lower third with road and sky ahead of it; speed is felt through a slow
// pull-back and a few degrees of field of view rather than a fisheye, so the car, the cruisers
// on its bumper and the road ahead stay readable together.

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Seconds the mouse must rest before the camera starts swinging back behind the car. */
export const RECENTRE_DELAY = 0.9;
/** Seconds of steady reversing before the camera turns to look out of the back. */
export const REVERSE_LOOK_DELAY = 0.8;

/** Distance, pivot height above the car's base, settled pitch, field of view and aim offsets for a car at `speed` m/s. */
export function chaseFraming(speed, length, height) {
  const s = Math.abs(speed);
  return {
    distance: 3.0 + length * 0.6 + Math.min(0.7, s * 0.02),
    pivotRise: height + 0.55,
    pitch: 0.13,
    fov: 61 + Math.min(7, s * 0.15),
    aimDistance: 14 + Math.min(14, s * 0.4),
    aimRise: 0.6 + Math.min(1.2, s * 0.04),
  };
}

/** Unit view direction for a yaw and a downward pitch. */
export function viewDirection(yaw, pitch) {
  return { x: Math.sin(yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
}

/**
 * Camera position and aim point behind a car: the lens sits `distance` back along the view
 * direction from a pivot over the car, and aims `aimDistance` past the pivot, raised by `aimRise`
 * so the car sits below the middle of the screen with road ahead of it.
 */
export function chaseRig(car, frame, yaw, pitch, distance = frame.distance) {
  const look = viewDirection(yaw, pitch);
  const pivot = { x: car.x, y: car.y + frame.pivotRise, z: car.z };
  return {
    pivot,
    look,
    position: { x: pivot.x - look.x * distance, y: pivot.y - look.y * distance, z: pivot.z - look.z * distance },
    aim: { x: pivot.x + look.x * frame.aimDistance, y: pivot.y + look.y * frame.aimDistance + frame.aimRise, z: pivot.z + look.z * frame.aimDistance },
  };
}

/**
 * One step of the auto-recentre. Mouse look always wins: nothing moves until the mouse has
 * rested RECENTRE_DELAY seconds, then the yaw eases in (no snap, capped per frame) back behind
 * the bonnet, faster at speed. A tap of reverse keeps the view forward; only steady reversing
 * turns it to look out of the back. Below walking pace the camera stays where it was left.
 * `rig` holds { yaw, pitch, idle, reverseTime }; returns the new { yaw, pitch, reverseTime }.
 */
export function recenterStep(rig, car, dt, restPitch = 0.13) {
  const speed = Math.abs(car.fwdSpeed);
  let { yaw, pitch } = rig;
  let reverseTime = rig.reverseTime ?? 0;
  if (car.fwdSpeed < -2) reverseTime += dt;
  else if (car.fwdSpeed > -0.5) reverseTime = 0;
  if (rig.idle > RECENTRE_DELAY && speed > 2) {
    const behind = reverseTime > REVERSE_LOOK_DELAY ? car.heading + Math.PI : car.heading;
    const easeIn = Math.min(1, (rig.idle - RECENTRE_DELAY) / 0.5);
    const rate = (1.2 + Math.min(1.6, speed * 0.06)) * easeIn;
    const maxStep = 3 * dt;
    const step = wrap(behind - yaw) * Math.min(1, dt * rate);
    yaw += Math.max(-maxStep, Math.min(maxStep, step));
    pitch += (restPitch - pitch) * Math.min(1, dt * 1.5 * easeIn);
  }
  return { yaw, pitch, reverseTime };
}
