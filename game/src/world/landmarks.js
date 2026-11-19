// The one-of-a-kind places of Solara Bay: Dani's safehouse, Coco Loco Tacos, Tavo's garage,
// the hospital, police headquarters, the motors plaza, the Saltjaw yard, Bayside Arms, the Gull
// Key lighthouse, the pier with the Sol Wheel, the Causeway Bridge, the dock cranes and the hills.
import * as THREE from 'three';
import { GeometryBuilder, meshFromBuilder } from '../core/geometryBuilder.js';
import { facadeBox, rooftopBillboard, wallSign, awning } from './buildKit.js';
import { lineCoord, PIER, QUAY } from './cityLayout.js';
import { WATER_LEVEL } from '../config.js';

const KERB = 0.12;

export function buildSafehouse(ctx, cx, cz) {
  facadeBox(ctx, 'house', cx - 6, KERB, cz, 18, 6.6, 13, '#fff4e6');
  ctx.chunk.trim.box(cx - 6, KERB + 6.6, cz, 19, 0.5, 14, '#2fb5b0');
  facadeBox(ctx, 'house', cx - 10, KERB + 6.6, cz - 1, 9, 3.3, 9, '#ffd6e0');
  ctx.chunk.trim.box(cx + 3.6, KERB, cz + 2, 0.4, 2.6, 4, '#7a4a2a');
  ctx.chunk.trim.box(cx + 10, KERB, cz - 9, 12, 0.25, 7, '#f4f1ea');
  ctx.chunk.pool.flat(cx + 10, KERB + 0.27, cz - 9, 10.6, 5.6, '#ffffff', 2, 1.2);
  ctx.chunk.trim.box(cx + 16, KERB, cz + 14, 0.6, 1.0, 22, '#4f8a3a');
  ctx.props.palms.push({ x: cx + 16, z: cz - 3, h: 11 }, { x: cx + 4, z: cz - 14, h: 9 }, { x: cx - 16, z: cz + 14, h: 10 }, { x: cx + 14, z: cz + 18, h: 8 });
}

export function buildCocoShack(ctx, cx, cz) {
  const x = cx - 18, z = cz;
  ctx.chunk.wood.box(x, 0.2, z, 7, 3, 5.5, '#ffffff', { uvScale: 0.25 });
  ctx.chunk.trim.cylinder(x, 3.2, z, 5.8, 0, 2.4, 4, '#d9b26a');
  ctx.chunk.wood.box(x - 3.9, 0.2, z, 1, 1.1, 5.5, '#ffffff');
  ctx.collision.addCenteredBox(x, z, 7, 5.5, 3.4, 'shack');
  wallSign(ctx.signs.landmark('coco'), x - 2.6, 4.6, z, 9, 1.4, -1, 0);
  for (let n = 0; n < 3; n += 1) {
    const tz = z - 6 + n * 6, tx = x + 8;
    ctx.chunk.wood.cylinder(tx, 0, tz, 0.9, 0.9, 0.8, 8, '#ffffff');
    ctx.chunk.metal.cylinder(tx, 0.8, tz, 0.05, 0.05, 1.8, 4, '#dddddd');
    ctx.chunk.trim.cylinder(tx, 2.4, tz, 1.8, 0.05, 0.6, 8, ['#ff6b6b', '#ffd93d', '#4ecdc4'][n]);
  }
  ctx.chunk.neon.box(x - 3.6, 3.15, z, 0.1, 0.1, 5.6, '#ffb347');
}

export function buildTavoGarage(ctx, cx, cz) {
  facadeBox(ctx, 'warehouse', cx, KERB, cz + 6, 30, 9, 22, '#d8ecf2');
  ctx.chunk.trim.box(cx, KERB, cz - 5.1, 12, 6, 0.4, '#262a30');
  ctx.chunk.trim.box(cx, KERB + 9, cz + 6, 30.6, 0.8, 22.6, '#2fb5b0');
  wallSign(ctx.signs.landmark('tavo'), cx, KERB + 7.3, cz - 5, 14, 1.8, 0, -1);
  ctx.chunk.concrete.flat(cx, KERB + 0.02, cz - 15, 44, 18, '#7d7b77', 6, 3);
  for (const s of [-1, 1]) ctx.chunk.neon.box(cx + s * 6.4, KERB + 0.2, cz - 5.3, 0.12, 5.8, 0.12, '#3ef2ff');
  facadeBox(ctx, 'stucco', cx - 18, KERB, cz + 18, 10, 8, 10, '#ffc8d8');
  facadeBox(ctx, 'stucco', cx + 18, KERB, cz + 18, 10, 12, 10, '#bff3e0');
}

export function buildHospital(ctx, cx, cz) {
  facadeBox(ctx, 'office', cx, KERB, cz - 4, 40, 26, 30, '#ffffff');
  facadeBox(ctx, 'office', cx, KERB + 26, cz - 6, 22, 8, 18, '#f2f7fa');
  ctx.chunk.trim.box(cx, KERB + 4, cz + 13, 16, 0.5, 6, '#e9eef2');
  for (const s of [-1, 1]) ctx.chunk.metal.box(cx + s * 7.5, KERB, cz + 15.5, 0.4, 4, 0.4, '#cfd6db');
  wallSign(ctx.signs.landmark('hospital'), cx, KERB + 21, cz + 11, 22, 2.8, 0, 1);
  // Red cross on the roof annex, lit at night.
  ctx.chunk.neon.box(cx, KERB + 34.1, cz - 6, 8, 0.2, 2.4, '#ff3040');
  ctx.chunk.neon.box(cx, KERB + 34.1, cz - 6, 2.4, 0.2, 8, '#ff3040');
}

export function buildPoliceHQ(ctx, cx, cz) {
  facadeBox(ctx, 'office', cx + 6, KERB, cz, 32, 15, 40, '#dfe8f2');
  ctx.chunk.trim.box(cx + 6, KERB + 15, cz, 32.6, 0.9, 40.6, '#1f3b73');
  ctx.chunk.trim.box(cx - 10.4, KERB + 3.5, cz, 1, 0.5, 14, '#1f3b73');
  wallSign(ctx.signs.landmark('police'), cx - 10, KERB + 11, cz, 14, 2, -1, 0);
  ctx.chunk.neon.box(cx - 10.2, KERB + 13, cz, 0.12, 0.12, 30, '#4f8cff');
  ctx.chunk.metal.cylinder(cx - 16, KERB, cz + 14, 0.12, 0.12, 9, 6, '#d6d6d6');
}

export function buildShowroom(ctx, cx, cz) {
  ctx.chunk.glass.box(cx - 6, KERB, cz - 14, 30, 7, 16, '#e6f6ff', { uvScale: 1 / 16, top: false });
  ctx.chunk.roof.flat(cx - 6, KERB + 7, cz - 14, 30, 16, '#ffffff', 4, 2);
  ctx.collision.addCenteredBox(cx - 6, cz - 14, 30, 16, KERB + 7);
  ctx.chunk.trim.box(cx - 6, KERB + 7, cz - 14, 31, 0.6, 17, '#f1f1f1');
  wallSign(ctx.signs.landmark('motors'), cx - 6, KERB + 5.5, cz - 6, 14, 1.8, 0, 1);
  ctx.chunk.trim.cylinder(cx, KERB, cz + 6, 4.2, 4.2, 0.3, 20, '#2b2f36');
  ctx.chunk.neon.cylinder(cx, KERB + 0.3, cz + 6, 4.25, 4.25, 0.06, 20, '#ffe08a');
  facadeBox(ctx, 'glass', cx + 15, KERB, cz - 12, 16, 118, 20, '#ffe1c4');
  ctx.chunk.metal.beam([cx + 15, KERB + 118, cz - 12], [cx + 15, KERB + 136, cz - 12], 0.4, 5, '#d0d4da');
  for (const [px, pz] of [[-18, 14], [18, 18], [-18, -2]]) ctx.props.palms.push({ x: cx + px, z: cz + pz, h: 11 });
}

export function buildWarehouseYard(ctx, cx, cz) {
  facadeBox(ctx, 'warehouse', cx, KERB, cz - 14, 36, 12, 18, '#b9c4cc');
  ctx.chunk.trim.box(cx, KERB, cz - 4.8, 10, 7, 0.4, '#20242a');
  wallSign(ctx.signs.landmark('saltjaw'), cx, KERB + 9.5, cz - 4.8, 16, 2, 0, 1);
  const colours = ['#8e2b2b', '#2c4f6e', '#6b5b2b', '#3e5f3a'];
  const cover = [[-16, 6], [16, 6], [-6, 14], [8, 14], [-18, 18], [18, 18]];
  cover.forEach(([ox, oz], n) => {
    const stack = 1 + (n % 2);
    for (let s = 0; s < stack; s += 1) ctx.chunk.warehouse.box(cx + ox, KERB + s * 2.6, cz + oz, 7, 2.6, 2.5, colours[n % 4], { uvScale: 1 / 6 });
    ctx.collision.addCenteredBox(cx + ox, cz + oz, 7, 2.5, KERB + stack * 2.6, 'container');
  });
  for (const [ox, oz] of [[0, 4], [-4, 8], [4, 9]]) {
    ctx.chunk.wood.box(cx + ox, KERB, cz + oz, 1.4, 1.4, 1.4, '#ffffff');
    ctx.collision.addCenteredBox(cx + ox, cz + oz, 1.4, 1.4, KERB + 1.4, 'crate');
  }
  ctx.props.lamps.push({ x: cx - 22, z: cz + 22, tall: true }, { x: cx + 22, z: cz - 2, tall: true });
}

export function buildGunShopBlock(ctx, cx, cz) {
  facadeBox(ctx, 'office', cx + 13, KERB, cz, 20, 9, 18, '#e9e2d6');
  ctx.chunk.trim.box(cx + 23.2, KERB, cz, 0.4, 3, 6, '#2a2a2a');
  wallSign(ctx.signs.landmark('arms'), cx + 23.2, KERB + 6.6, cz, 10, 1.4, 1, 0);
  awning(ctx, cx + 23.2, KERB + 3.4, cz, 7, 1, 0, '#3a3a3a');
  facadeBox(ctx, 'stucco', cx - 12, KERB, cz - 12, 22, 22, 22, '#fff0bf');
  facadeBox(ctx, 'office', cx - 12, KERB, cz + 12, 22, 28, 22, '#f4ecdf');
  rooftopBillboard(ctx, 0, cx - 12, KERB + 28, cz + 12, 0, 1);
}

export function buildLighthouse(ctx, cx, cz) {
  const x = cx, z = cz - 8;
  const rings = 6;
  for (let n = 0; n < rings; n += 1) {
    const r0 = 3.4 - n * 0.22, r1 = 3.4 - (n + 1) * 0.22;
    ctx.chunk.trim.cylinder(x, KERB + n * 4, z, r0, r1, 4, 14, n % 2 ? '#d7263d' : '#fbfbf8');
  }
  const top = KERB + rings * 4;
  ctx.chunk.metal.cylinder(x, top, z, 2.9, 2.9, 0.4, 14, '#2b2f36');
  ctx.chunk.lamp.cylinder(x, top + 0.4, z, 1.6, 1.6, 2.4, 10, '#ffffff');
  ctx.chunk.trim.cylinder(x, top + 2.8, z, 2.2, 0, 2, 10, '#d7263d');
  ctx.collision.addCenteredBox(x, z, 6.5, 6.5, top + 4);
  facadeBox(ctx, 'house', x + 11, KERB, z + 4, 8, 4, 6, '#ffffff');
  ctx.chunk.trim.gable(x + 11, KERB + 4, z + 4, 8.6, 2.2, 6.6, '#d7263d');
  // A wooden dock out into the inlet.
  ctx.chunk.wood.box(x - 14, -0.3, z - 30, 4, 0.4, 26, '#ffffff', { uvScale: 0.25 });
  return { x, y: top + 1.6, z };
}

/** Coral Strand pier with the Sol Wheel; returns the animated wheel. */
export function buildPierAndWheel(ctx, group, materials) {
  const b = ctx.chunk;
  const len = PIER.x1 - PIER.x0;
  b.wood.box((PIER.x0 + PIER.x1) / 2, -0.4, PIER.z, len, 0.45, PIER.halfWidth * 2, '#ffffff', { uvScale: 0.25 });
  for (let x = PIER.x0 + 4; x < PIER.x1; x += 9) {
    for (const s of [-1, 1]) b.wood.cylinder(x, WATER_LEVEL - 4, PIER.z + s * (PIER.halfWidth - 0.6), 0.35, 0.35, 4 + Math.abs(WATER_LEVEL) - 0.4, 6, '#6b5039');
  }
  for (const s of [-1, 1]) {
    b.trim.box((PIER.x0 + PIER.x1) / 2, 0, PIER.z + s * (PIER.halfWidth - 0.2), len, 1.0, 0.15, '#f2f2f2');
    ctx.collision.addCenteredBox((PIER.x0 + PIER.x1) / 2, PIER.z + s * (PIER.halfWidth + 0.1), len, 0.6, 1.0, 'rail');
  }
  ctx.collision.addCenteredBox(PIER.x1 + 0.3, PIER.z, 0.6, PIER.halfWidth * 2, 1.0, 'rail');
  // Arcade booth with its sign.
  facadeBox(ctx, 'stucco', PIER.x0 + 40, 0, PIER.z - 4.5, 10, 4, 4.5, '#ffd6e0');
  wallSign(ctx.signs.landmark('wheel'), PIER.x0 + 40, 5.2, PIER.z - 2.2, 9, 1.4, 0, 1);

  const cx = PIER.x1 - 24, cy = 22, cz = PIER.z, radius = 17;
  for (const s of [-1, 1]) {
    b.metal.beam([cx - 9, 0, cz + s * 3.2], [cx, cy, cz + s * 2.2], 0.45, 6, '#e8e8e8');
    b.metal.beam([cx + 9, 0, cz + s * 3.2], [cx, cy, cz + s * 2.2], 0.45, 6, '#e8e8e8');
  }
  ctx.collision.addCenteredBox(cx - 9, cz, 1.4, 8, 6, 'wheel');
  ctx.collision.addCenteredBox(cx + 9, cz, 1.4, 8, 6, 'wheel');
  const wheelB = new GeometryBuilder();
  const rimB = new GeometryBuilder();
  const spokes = 16;
  for (let n = 0; n < spokes; n += 1) {
    const a0 = (n / spokes) * Math.PI * 2, a1 = ((n + 1) / spokes) * Math.PI * 2;
    for (const s of [-1.6, 1.6]) {
      wheelB.beam([0, 0, s], [Math.cos(a0) * radius, Math.sin(a0) * radius, s], 0.12, 4, '#f4f4f4');
      rimB.beam([Math.cos(a0) * radius, Math.sin(a0) * radius, s], [Math.cos(a1) * radius, Math.sin(a1) * radius, s], 0.22, 4, n % 2 ? '#ff3ec8' : '#3ef2ff');
    }
  }
  wheelB.beam([0, 0, -2.6], [0, 0, 2.6], 0.9, 8, '#cccccc');
  const wheel = new THREE.Group();
  wheel.position.set(cx, cy, cz);
  const frame = meshFromBuilder(wheelB, materials.metal);
  const rim = meshFromBuilder(rimB, materials.neonTube, { castShadow: true, receiveShadow: false });
  wheel.add(frame, rim);
  group.add(wheel);
  const cabinGeo = new THREE.BoxGeometry(2.2, 2.4, 2.4);
  const cabins = new THREE.InstancedMesh(cabinGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), 12);
  const cabinColours = ['#ff6b6b', '#ffd93d', '#4ecdc4', '#ff8fab', '#9b5de5', '#00bbf9'];
  for (let n = 0; n < 12; n += 1) cabins.setColorAt(n, new THREE.Color(cabinColours[n % cabinColours.length]));
  cabins.castShadow = true;
  group.add(cabins);
  const m = new THREE.Matrix4();
  return {
    update(time) {
      const angle = time * 0.08;
      wheel.rotation.z = angle;
      for (let n = 0; n < 12; n += 1) {
        const a = angle + (n / 12) * Math.PI * 2;
        m.makeTranslation(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius - 1.6, cz);
        cabins.setMatrixAt(n, m);
      }
      cabins.instanceMatrix.needsUpdate = true;
    },
  };
}

/** The cable-stayed Causeway Bridge over the Solara Inlet. */
export function buildCausewayBridge(ctx) {
  const b = ctx.chunk;
  const x = lineCoord(6), z0 = lineCoord(1) + 7, z1 = lineCoord(2) - 7, zm = (z0 + z1) / 2, len = z1 - z0;
  b.concrete.box(x, -1.6, zm, 15, 1.6, len + 2, '#c8c3b8', { uvScale: 0.25 });
  for (const s of [-1, 1]) {
    b.concrete.box(x + s * 7.2, 0, zm, 0.6, 1.1, len, '#e8e4dc');
    ctx.collision.addCenteredBox(x + s * 7.6, zm, 0.8, len + 14, 1.1, 'rail');
    // Pylon legs and cables.
    b.concrete.beam([x + s * 9, WATER_LEVEL - 2, zm], [x + s * 5, 40, zm], 0.9, 6, '#f1ede6');
    for (let n = 1; n <= 6; n += 1) {
      for (const d of [-1, 1]) b.metal.beam([x + s * 7, 0.8, zm + d * n * 4.2], [x + s * 5.4, 37 - n * 1.6, zm], 0.07, 3, '#f0f0f0');
    }
  }
  b.concrete.box(x, 34, zm, 11, 1.4, 1.6, '#f1ede6');
  b.lamp.box(x, 40.2, zm, 1.2, 0.8, 1.2, '#ffffff');
  for (const zz of [z0 + 6, z1 - 6]) b.concrete.box(x, WATER_LEVEL - 3, zz, 10, 3 + Math.abs(WATER_LEVEL) - 1.6, 3, '#bdb8ad');
}

/** Gantry cranes on the quay apron and a container ship moored beyond them. */
export function buildDocksideCranes(ctx) {
  const b = ctx.chunk;
  b.concrete.box((QUAY.x0 + QUAY.x1) / 2, -6, (QUAY.z0 + QUAY.z1) / 2, QUAY.x1 - QUAY.x0, 5.98, QUAY.z1 - QUAY.z0, '#a39f95', { uvScale: 0.25 });
  b.concrete.box((QUAY.x0 + QUAY.x1) / 2, -0.01, (QUAY.z0 + QUAY.z1) / 2, QUAY.x1 - QUAY.x0, 0.02, QUAY.z1 - QUAY.z0, '#8e8c88', { uvScale: 0.25 });
  for (const cxr of [-250, -120, 10, 160]) {
    const zFront = QUAY.z1 - 2, zBack = QUAY.z0 + 3;
    for (const sx of [-6, 6]) {
      b.metal.box(cxr + sx, 0, zFront, 1.2, 30, 1.2, '#e2a72e');
      b.metal.box(cxr + sx, 0, zBack, 1.2, 30, 1.2, '#e2a72e');
      b.metal.beam([cxr + sx, 2, zFront], [cxr + sx, 28, zBack], 0.3, 4, '#c98f1d');
      ctx.collision.addCenteredBox(cxr + sx, zFront, 1.4, 1.4, 30, 'crane');
      ctx.collision.addCenteredBox(cxr + sx, zBack, 1.4, 1.4, 30, 'crane');
    }
    b.metal.box(cxr, 30, (zFront + zBack) / 2 + 14, 14, 2.2, zFront - zBack + 60, '#e2a72e');
    b.metal.box(cxr, 32.2, zBack + 2, 6, 4, 6, '#f2f2f2');
    b.lamp.box(cxr, 32.2, zFront + 44, 0.8, 0.8, 0.8, '#ff3030');
  }
  // Container ship.
  const shipZ = QUAY.z1 + 22, shipX = -40;
  b.trim.box(shipX, WATER_LEVEL - 3, shipZ, 170, 10, 26, '#1f3550');
  b.trim.box(shipX, WATER_LEVEL + 7, shipZ, 170, 0.6, 26, '#b03a2e');
  b.trim.taperedBox(shipX + 92, WATER_LEVEL - 3, shipZ, 14, 10.6, 26, 2, 4, '#1f3550');
  facadeBox(ctx, 'office', shipX - 70, WATER_LEVEL + 7.6, shipZ, 14, 12, 20, '#ffffff', { collide: false });
  const colours = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#ca6f1e', '#e0e0e0'];
  let seed = 7;
  for (let x = shipX - 55; x < shipX + 80; x += 12.5) {
    for (let row = -1; row <= 1; row += 1) {
      seed = (seed * 16807) % 2147483647;
      const stack = 1 + (seed % 3);
      for (let s = 0; s < stack; s += 1) b.warehouse.box(x, WATER_LEVEL + 7.6 + s * 2.6, shipZ + row * 7.5, 12, 2.6, 7, colours[(seed >> (s + 2)) % colours.length], { uvScale: 1 / 6 });
    }
  }
}

/** Low green hills behind Palm Grove and across the inlet, so the city never ends in a void. */
export function buildDistantHills(ctx) {
  const b = ctx.chunk;
  const hills = [];
  for (let n = 0; n < 14; n += 1) hills.push([-470 - (n % 3) * 50, -420 + n * 62, 55 + (n * 37) % 40, 35 + (n * 23) % 45]);
  for (let n = 0; n < 10; n += 1) hills.push([-420 + n * 70, -480 - (n % 2) * 40, 50 + (n * 29) % 40, 28 + (n * 17) % 40]);
  for (const [x, z, r, h] of hills) {
    b.trim.cylinder(x, -4, z, r, r * 0.82, h * 0.4, 14, '#5c7c48', { top: false });
    b.trim.cylinder(x, -4 + h * 0.4, z, r * 0.82, r * 0.5, h * 0.35, 14, '#668650', { top: false });
    b.trim.cylinder(x, -4 + h * 0.75, z, r * 0.5, 0, h * 0.28, 14, '#71915a');
  }
}
