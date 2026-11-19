// Shared tools for raising the city: one set of geometry builders per block (merged into one
// mesh per material when the block is done), facade boxes with roofs and colliders, and neon
// signs and billboards batched by texture across the whole city.
import * as THREE from 'three';
import { GeometryBuilder, meshFromBuilder } from '../core/geometryBuilder.js';
import { billboardTexture, neonSignTexture } from './textures.js';

const CHUNK_LAYERS = ['glass', 'office', 'stucco', 'house', 'warehouse', 'roof', 'trim', 'metal', 'neon', 'pool', 'wood', 'concrete', 'lamp'];
const FACADE_UV = 1 / 16;

export const NEON_SIGNS = [
  ['NOVA LOUNGE', '#ff3ec8'], ['MANGO CLUB', '#ff9a3c'], ['HOTEL ESTRELLA', '#3ef2ff'], ['PALMA CAFE', '#7dffb3'],
  ['SOL DINER', '#ff5f6d'], ['BAILA', '#ff4fd8'], ['TIKI TOWER', '#ffd166'], ['LUXE', '#ffe08a'],
  ['OPEN 24H', '#ff4040'], ['CORAL CINEMA', '#5ee7ff'], ['VELVET TIDE', '#b26bff'], ['SURF & SODA', '#3effd2'],
];
export const LANDMARK_SIGNS = {
  coco: ['COCO LOCO TACOS', '#ffb347'],
  tavo: ["TAVO'S CHROME & PAINT", '#3ef2ff'],
  arms: ['BAYSIDE ARMS', '#ff5050'],
  hospital: ['ST. MARISOL MEDICAL', '#7dfcff'],
  police: ['BAY POLICE', '#6fa8ff'],
  motors: ['LUMIERE MOTORS', '#ffe08a'],
  saltjaw: ['SALTJAW SHIPPING', '#ff7b54'],
  wheel: ['SOL WHEEL', '#ff3ec8'],
};
export const BILLBOARDS = [
  ['KOLIBRI COLA', 'Taste the gold hour', ['#ff5f8f', '#ffb347']],
  ['VANTOR RS', 'Born to outrun the sunset', ['#1d2b64', '#f8cdda']],
  ['SUNWAVE 101.7', 'Synths all night long', ['#7b2ff7', '#f107a3']],
  ['SUNNY SIDE', 'Insurance for every fender', ['#11998e', '#38ef7d']],
  ['CORAL STRAND', 'Beach parties every Friday', ['#f7971e', '#ffd200']],
];

export function createSignRegistry() {
  const entries = new Map();
  function get(key, makeTexture) {
    if (!entries.has(key)) {
      const material = new THREE.MeshBasicMaterial({ map: makeTexture(), transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
      material.userData.neon = true;
      entries.set(key, { builder: new GeometryBuilder(), material });
    }
    return entries.get(key).builder;
  }
  return {
    neon: (index) => get(`neon${index}`, () => neonSignTexture(NEON_SIGNS[index][0], NEON_SIGNS[index][1])),
    landmark: (key) => get(`lm-${key}`, () => neonSignTexture(LANDMARK_SIGNS[key][0], LANDMARK_SIGNS[key][1], { width: 1024, font: 'italic 900 80px "Arial Black", Impact, sans-serif' })),
    billboard: (index) => get(`bb${index}`, () => billboardTexture(...BILLBOARDS[index])),
    /** Merges every batch into a mesh; neon materials are returned so night can brighten them. */
    build(group) {
      const neonMaterials = [];
      for (const { builder, material } of entries.values()) {
        const mesh = meshFromBuilder(builder, material, { castShadow: false, receiveShadow: false });
        if (!mesh) continue;
        mesh.renderOrder = 2;
        group.add(mesh);
        neonMaterials.push(material);
      }
      return neonMaterials;
    },
  };
}

/** A fresh set of per-block builders. */
export function createChunk() {
  const b = {};
  for (const layer of CHUNK_LAYERS) b[layer] = new GeometryBuilder();
  return b;
}

/** Merges a block's builders into meshes on `group`, one per non-empty material. */
export function finishChunk(chunk, materials, group) {
  const materialFor = { neon: materials.neonTube };
  for (const layer of CHUNK_LAYERS) {
    const mesh = meshFromBuilder(chunk[layer], materialFor[layer] ?? materials[layer], {
      castShadow: layer !== 'neon' && layer !== 'pool',
      receiveShadow: layer !== 'neon',
    });
    if (mesh) group.add(mesh);
  }
}

/**
 * A building volume: textured sides in `style`, a gravel roof, and a collider. `y` is the base
 * height (kerb top for most buildings).
 */
export function facadeBox(ctx, style, x, y, z, w, h, d, tint, { collide = true } = {}) {
  ctx.chunk[style].box(x, y, z, w, h, d, tint, { uvScale: FACADE_UV, top: false });
  ctx.chunk.roof.flat(x, y + h, z, w, d, '#ffffff', w / 8, d / 8);
  if (collide) ctx.collision.addCenteredBox(x, z, w, d, y + h);
}

/** A vertical quad centred at (x, y, z) facing horizontal normal (nx, nz), uv 0..1. */
export function verticalQuad(builder, x, y, z, w, h, nx, nz, color = '#ffffff') {
  const rgb = builder.setColor(color);
  const rx = nz, rz = -nx;
  const a = [x - rx * w / 2, y - h / 2, z - rz * w / 2];
  const b = [x + rx * w / 2, y - h / 2, z + rz * w / 2];
  const c = [b[0], y + h / 2, b[2]];
  const d = [a[0], y + h / 2, a[2]];
  builder.quad(a, b, c, d, rgb);
}

/** A sign standing proud of a wall, so it never z-fights the facade. */
export function wallSign(builder, x, y, z, w, h, nx, nz) {
  verticalQuad(builder, x + nx * 0.25, y, z + nz * 0.25, w, h, nx, nz);
}

/** A double-sided rooftop billboard on two posts. */
export function rooftopBillboard(ctx, index, x, y, z, nx, nz) {
  const w = 14, h = 7;
  verticalQuad(ctx.signs.billboard(index), x, y + 3 + h / 2, z, w, h, nx, nz);
  const rx = nz, rz = -nx;
  for (const s of [-0.35, 0.35]) ctx.chunk.metal.box(x + rx * w * s - nx * 0.4, y, z + rz * w * s - nz * 0.4, 0.4, 3 + h, 0.4, '#555b63');
  ctx.chunk.metal.box(x - nx * 0.5, y + 3, z - nz * 0.5, Math.abs(rx) * w + 0.6, h, Math.abs(rz) * w + 0.6, '#3b4047');
}

/** A striped shop awning sticking out from a wall at height y. */
export function awning(ctx, x, y, z, w, nx, nz, color) {
  const depth = 1.8;
  const rx = Math.abs(nz), rz = Math.abs(nx);
  ctx.chunk.trim.taperedBox(x + nx * depth / 2, y, z + nz * depth / 2, rx * w + rz * depth, 0.5, rz * w + rx * depth, rx * w + rz * 0.2, rz * w + rx * 0.2, color);
}

/** The direction (normal) from a block centre towards the nearest street for a point. */
export function streetNormal(px, pz, cx, cz) {
  const dx = px - cx, dz = pz - cz;
  if (Math.abs(dx) > Math.abs(dz)) return [Math.sign(dx), 0];
  return [0, Math.sign(dz) || 1];
}
