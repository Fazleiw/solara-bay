// The police helicopter, call sign GULL ONE: joins the chase from three stars, circles the
// player at rooftop height, sweeps a searchlight cone down onto them (bright at night, a pale
// shaft at golden hour), keeps the wanted level alive while the light is on them, and peels
// away once the stars drop.
import * as THREE from 'three';
import { WANTED } from '../config.js';

/** Builds the helicopter mesh, its rotors, strobes and searchlight beam. */
export function buildHelicopterModel(glowTexture) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#16213a', roughness: 0.35, metalness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.4 });
  const stripe = new THREE.MeshStandardMaterial({ color: '#2f6bff', roughness: 0.4, emissive: '#10308a', emissiveIntensity: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1b2a3a', roughness: 0.05, metalness: 0.9 });
  const add = (geo, m, x, y, z, parent = group) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  add(new THREE.SphereGeometry(1.45, 16, 10).scale(1, 0.92, 1.75), paint, 0, 0, 0);
  add(new THREE.BoxGeometry(2.95, 0.16, 1.4), stripe, 0, -0.35, 0.3);
  add(new THREE.SphereGeometry(1.08, 14, 10).scale(1, 0.78, 1.05), glass, 0, 0.18, 1.32);
  add(new THREE.BoxGeometry(0.45, 0.45, 4.8), paint, 0, 0.22, -3.7);
  add(new THREE.BoxGeometry(0.12, 1.3, 0.8), white, 0, 0.75, -5.9);
  add(new THREE.BoxGeometry(1.6, 0.08, 0.5), white, 0, 0.35, -5.6);
  add(new THREE.BoxGeometry(0.9, 0.5, 1.3), paint, 0, 1.25, -0.2);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.1, 0.1, 3.2), white, s * 1.25, -1.45, 0.1);
    add(new THREE.BoxGeometry(0.08, 0.6, 0.08), white, s * 1.1, -1.15, 0.8);
    add(new THREE.BoxGeometry(0.08, 0.6, 0.08), white, s * 1.1, -1.15, -0.6);
  }
  const hub = new THREE.Group();
  hub.position.set(0, 1.6, -0.2);
  group.add(hub);
  for (let i = 0; i < 4; i += 1) {
    const blade = add(new THREE.BoxGeometry(0.34, 0.05, 6.2).translate(0, 0, 3.1), white, 0, 0, 0, hub);
    blade.rotation.y = (i * Math.PI) / 2;
  }
  // A faint rotor disc reads as motion blur.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#cfd8e3', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
  disc.position.copy(hub.position);
  group.add(disc);
  const tail = new THREE.Group();
  tail.position.set(0.22, 0.75, -5.9);
  group.add(tail);
  add(new THREE.BoxGeometry(0.05, 1.9, 0.22), white, 0, 0, 0, tail);
  // Nav strobes: red port, green starboard, white tail.
  const strobe = (color, x, y, z) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    s.position.set(x, y, z); s.scale.setScalar(2.2); group.add(s); return s;
  };
  const strobes = [strobe('#ff3030', -1.5, -0.2, 0.2), strobe('#30ff60', 1.5, -0.2, 0.2), strobe('#ffffff', 0, 1.4, -6.3)];
  // The searchlight lamp under the nose, the cone that fades from the lamp down, the pool on the ground.
  const lamp = strobe('#fff6dc', 0, -1.1, 1.6);
  lamp.scale.setScalar(4.5);
  const fade = document.createElement('canvas');
  fade.width = 4; fade.height = 128;
  const fctx = fade.getContext('2d');
  const grad = fctx.createLinearGradient(0, 0, 0, 128);
  // A narrow shaft: bright at the lamp, thinning out before it reaches the bright pool on the ground.
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(150,150,150,1)'); grad.addColorStop(1, 'rgba(18,18,18,1)');
  fctx.fillStyle = grad; fctx.fillRect(0, 0, 4, 128);
  const beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fade), color: '#ffe9b8', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1, 28, 1, true).translate(0, -0.5, 0), beamMat);
  beam.frustumCulled = false;
  const spot = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture, color: '#fff2d0', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  spot.renderOrder = 2;
  return { group, hub, disc, tail, strobes, lamp, beam, beamMat, spot };
}

export function createHelicopter(game) {
  const state = { x: 0, z: 0, y: 34, angle: 0, active: false, onTarget: false, spotX: 0, spotZ: 0, callsign: 'GULL ONE' };
  let model = null;
  const up = new THREE.Vector3(0, -1, 0);
  const dir = new THREE.Vector3();

  function spawn() {
    model = buildHelicopterModel(game.world.textures.glow);
    game.scene.add(model.group, model.beam, model.spot);
    const p = game.player;
    state.x = p.x - 60; state.z = p.z - 40; state.y = 34;
  }

  function despawn() {
    if (!model) return;
    game.scene.remove(model.group, model.beam, model.spot);
    model = null;
    state.active = false;
    state.onTarget = false;
  }

  /** Places the helicopter at an exact spot (scripted scenes) and spawns it if needed. */
  function placeAt(x, y, z, angle = 0) {
    if (!model) spawn();
    state.x = x; state.y = y; state.z = z; state.angle = angle; state.active = true;
  }

  function update(dt) {
    const want = game.wanted.level >= WANTED.helicopterFromStar;
    if (want && !model) spawn();
    if (!model) { game.audio?.setHelicopter(0); return; }
    state.active = want;
    const p = game.player;
    const pv = p.vehicle;
    // Circle ahead of a moving car so the light leads the chase.
    const leadX = p.x + (pv ? pv.vx * 1.2 : 0), leadZ = p.z + (pv ? pv.vz * 1.2 : 0);
    state.angle += dt * 0.22;
    const tx = want ? leadX + Math.cos(state.angle) * 26 : p.x - 320;
    const tz = want ? leadZ + Math.sin(state.angle) * 26 : p.z - 320;
    const k = Math.min(1, dt * 0.7);
    state.x += (tx - state.x) * k;
    state.z += (tz - state.z) * k;
    const g = model.group;
    g.position.set(state.x, state.y, state.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = Math.atan2(leadX - state.x, leadZ - state.z);
    g.rotation.x = 0.14;
    g.rotation.z = Math.sin(state.angle * 2) * 0.06;
    model.hub.rotation.y += dt * 28;
    model.tail.rotation.x += dt * 40;
    const blink = (game.clock * 1.4) % 1 < 0.18;
    for (const s of model.strobes) s.material.opacity = blink ? 1 : 0.25;

    // Searchlight: sways around the player, brighter as the light fades.
    const night = game.world.dayNight.state.night;
    state.spotX = p.x + Math.sin(game.clock * 0.7) * 2.5;
    state.spotZ = p.z + Math.cos(game.clock * 0.9) * 2.5;
    const nose = g.localToWorld(new THREE.Vector3(0, -1.2, 1.6));
    dir.set(state.spotX - nose.x, -nose.y + 0.1, state.spotZ - nose.z);
    const len = dir.length();
    dir.divideScalar(len);
    model.beam.position.copy(nose);
    model.beam.scale.set(1, len, 1);
    model.beam.quaternion.setFromUnitVectors(up, dir);
    model.beamMat.opacity = want ? 0.16 + night * 0.1 : 0;
    model.spot.position.set(state.spotX, 0.12, state.spotZ);
    model.spot.material.opacity = want ? 0.6 + night * 0.4 : 0;
    model.lamp.material.opacity = want ? 1 : 0;
    state.onTarget = want && Math.hypot(p.x - state.x, p.z - state.z) < 70;

    if (!want && Math.hypot(state.x - p.x, state.z - p.z) > 260) despawn();
    game.audio?.setHelicopter(model ? Math.max(0, 1 - Math.hypot(state.x - p.x, state.z - p.z) / 160) : 0);
  }

  return { state, update, placeAt, reset: despawn, get model() { return model; } };
}
