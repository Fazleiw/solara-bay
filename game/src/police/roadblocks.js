// Roadblocks from four stars: dispatch picks the road about 110 m ahead of the player's car and
// parks two cruisers across it at an angle, with striped barriers, a spike strip that shreds
// the grip of any car that crosses it, and officers taking cover behind the cars. Roadblocks
// are cleared once the player is long gone or the heat is off.
import * as THREE from 'three';

let barrierAssets = null;
function barriers() {
  if (barrierAssets) return barrierAssets;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i += 1) { ctx.fillStyle = i % 2 ? '#f4f4f4' : '#ff3b1f'; ctx.beginPath(); ctx.moveTo(i * 8, 0); ctx.lineTo(i * 8 + 8, 0); ctx.lineTo(i * 8, 16); ctx.lineTo(i * 8 - 8, 16); ctx.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  barrierAssets = {
    board: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#401008', emissiveIntensity: 0.3 }),
    leg: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.8 }),
    spike: new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.5, metalness: 0.7 }),
  };
  return barrierAssets;
}

/** A sawhorse barrier with a striped board and an amber lamp on top. */
function buildBarrier(glowTexture) {
  const a = barriers();
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.32, 0.08), a.board);
  board.position.y = 0.95; board.castShadow = true;
  g.add(board);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.5), a.leg);
    leg.position.set(s * 1.0, 0.5, 0);
    g.add(leg);
  }
  const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#ffb020', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  lamp.position.set(0.9, 1.25, 0); lamp.scale.setScalar(1.4);
  g.add(lamp);
  return g;
}

export function createRoadblocks(game, force) {
  const blocks = [];
  const net = game.world.network;

  /** Builds a roadblock across the road at (x, z), with the road running along `along`. */
  function buildAt(x, z, along) {
    const perpX = Math.cos(along), perpZ = -Math.sin(along);
    const fwdX = Math.sin(along), fwdZ = Math.cos(along);
    const block = { x, z, along, cars: [], props: [], timer: 60 };
    for (const s of [-1, 1]) {
      const car = game.vehicles.spawn('cruzer', x + perpX * s * 3.3, z + perpZ * s * 3.3, along + Math.PI / 2 + s * 0.42);
      car.sirenOn = true;
      car.persistent = true;
      car.controls.handbrake = true;
      block.cars.push(car);
      const unit = force.addUnit(car, { roadblock: true, crew: 0 });
      const behind = { x: x + perpX * s * 3.8 - fwdX * 4.2, z: z + perpZ * s * 3.8 - fwdZ * 4.2 };
      force.officers.spawn(behind.x, behind.z, along + Math.PI, unit);
    }
    // Barriers on the shoulders, a spike strip across the gap in the middle.
    for (const s of [-1, 1]) {
      const b = buildBarrier(game.world.textures.glow);
      b.position.set(x + perpX * s * 7.6 + fwdX * 1.5, 0, z + perpZ * s * 7.6 + fwdZ * 1.5);
      b.rotation.y = along + Math.PI / 2;
      game.scene.add(b);
      block.props.push(b);
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 0.35), barriers().spike);
    strip.position.set(x + fwdX * 6, 0.05, z + fwdZ * 6);
    strip.rotation.y = along + Math.PI / 2;
    strip.receiveShadow = true;
    game.scene.add(strip);
    block.props.push(strip);
    block.spikes = { x: strip.position.x, z: strip.position.z, along };
    blocks.push(block);
    game.events.emit('roadblock', { x, z });
    return block;
  }

  /** Dispatch: block the road about 110 m ahead of the player's car. */
  function placeAhead() {
    const p = game.player;
    const v = p.vehicle;
    const dirX = v ? v.vx : Math.sin(game.camera.state.yaw), dirZ = v ? v.vz : Math.cos(game.camera.state.yaw);
    const len = Math.hypot(dirX, dirZ) || 1;
    const ax = p.x + (dirX / len) * 110, az = p.z + (dirZ / len) * 110;
    const near = net.nearestEdge(ax, az);
    if (!near || near.distance > 30 || Math.hypot(near.x - p.x, near.z - p.z) < 60) return null;
    const a = net.node(near.edge.a), b = net.node(near.edge.b);
    return buildAt(near.x, near.z, Math.atan2(b.x - a.x, b.z - a.z));
  }

  function remove(block) {
    for (const car of block.cars) force.removeUnitFor(car);
    for (const prop of block.props) game.scene.remove(prop);
    blocks.splice(blocks.indexOf(block), 1);
  }

  function update(dt) {
    const p = game.player;
    for (const block of [...blocks]) {
      block.timer -= dt;
      // Spikes: a car crossing the strip loses most of its grip and some health.
      for (const car of game.vehicles.list) {
        const local = { x: car.x - block.spikes.x, z: car.z - block.spikes.z };
        const along = local.x * Math.sin(block.along) + local.z * Math.cos(block.along);
        const across = local.x * Math.cos(block.along) - local.z * Math.sin(block.along);
        if (Math.abs(along) < 0.8 && Math.abs(across) < 3.2 && car.speed > 3 && !car.type.police && !car.spiked) {
          car.spiked = true;
          car.damage?.(120, 'spikes');
          game.events.emit('tyresSpiked', { vehicle: car });
        }
      }
      const far = block.cars.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > 150);
      if (far && (block.timer <= 0 || game.wanted.level === 0)) remove(block);
    }
  }

  function reset() { for (const block of [...blocks]) remove(block); }

  return { blocks, buildAt, placeAhead, update, reset };
}
