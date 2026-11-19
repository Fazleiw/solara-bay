// Generic buildings for each district, raised block by block from the fixed city seed:
// glass towers downtown, mid-rise offices in Mercado, pastel art-deco along Deco Row, villas
// with pools in Palm Grove, warehouses and container stacks at the docks, the park and the beach.
import { BLOCK_SIZE, GRID } from '../config.js';
import { awning, facadeBox, NEON_SIGNS, rooftopBillboard, streetNormal, wallSign } from './buildKit.js';

const KERB = 0.12;
const LOT = BLOCK_SIZE - GRID.sidewalk * 2; // 48 m buildable square
const GLASS_TINTS = ['#bfe3ff', '#a9dcec', '#d6e2ff', '#a8e8d8', '#ffd9b0', '#9fb8e0', '#e0c49c', '#c8f0ff'];
const OFFICE_TINTS = ['#ffffff', '#f4ecdf', '#e9eef3', '#f7e3d0'];
const PASTELS = ['#ffc8d8', '#bff3e0', '#fff0bf', '#c8e6ff', '#e5d1ff', '#ffd8b8', '#d2f7c4', '#ffffff'];
const ROOF_TILES = ['#c4623f', '#b5553a', '#7d8a96', '#d48a5c'];

/** Glass and steel towers with podiums, setbacks, crowns and spires. */
export function buildDowntownBlock(ctx, cx, cz, i, j) {
  const { rng } = ctx;
  const centrality = 1 - Math.min(1, Math.hypot(i - 5.6, j - 3.6) / 3.2);
  const layouts = [[[0, 0, 44, 44]], [[0, -12, 44, 20], [0, 12, 44, 20]], [[-12, 0, 20, 44], [12, 0, 20, 44]], [[-12, -12, 20, 20], [12, -12, 20, 20], [-12, 12, 20, 20], [12, 12, 20, 20]]];
  const layout = rng.pick(layouts);
  for (const [ox, oz, w, d] of layout) {
    const x = cx + ox, z = cz + oz;
    const h = 38 + centrality * 95 * rng.range(0.6, 1.1) + rng.range(0, 25) * (w > 30 ? 1.2 : 0.8);
    const podiumH = rng.range(6, 9);
    facadeBox(ctx, 'office', x, KERB, z, w, podiumH, d, rng.pick(OFFICE_TINTS));
    const inset = rng.range(1.5, 3.5);
    let tw = w - inset * 2, td = d - inset * 2;
    let y = KERB + podiumH;
    const style = rng.chance(0.75) ? 'glass' : 'office';
    const tint = style === 'glass' ? rng.pick(GLASS_TINTS) : rng.pick(OFFICE_TINTS);
    let remaining = h - podiumH;
    const sections = remaining > 60 && rng.chance(0.65) ? 2 : 1;
    for (let s = 0; s < sections; s += 1) {
      const sh = sections === 2 && s === 0 ? remaining * rng.range(0.55, 0.7) : remaining;
      facadeBox(ctx, style, x, y, z, tw, sh, td, tint, { collide: s === 0 });
      ctx.chunk.trim.box(x, y + sh - 0.6, z, tw + 0.5, 0.9, td + 0.5, '#e7e9ec');
      y += sh;
      remaining -= sh;
      tw -= rng.range(3, 6); td -= rng.range(3, 6);
    }
    tw += 4; td += 4;
    const crown = rng.int(0, 3);
    if (crown === 0) {
      ctx.chunk.metal.beam([x, y, z], [x, y + rng.range(10, 22), z], 0.35, 5, '#d0d4da');
      ctx.chunk.lamp.box(x, y + 0.1, z, 1.2, 0.8, 1.2, '#ffffff');
    } else if (crown === 1) {
      ctx.chunk[style].taperedBox(x, y, z, tw * 0.9, rng.range(5, 10), td * 0.9, tw * 0.3, td * 0.3, tint);
    } else if (crown === 2) {
      ctx.chunk.trim.box(x, y, z, tw * 0.6, 0.4, td * 0.6, '#3a3f46');
      ctx.chunk.trim.flat(x, y + 0.42, z, tw * 0.35, tw * 0.35, '#ffd166');
    } else {
      for (let n = 0; n < 4; n += 1) ctx.chunk.metal.box(x + rng.range(-tw / 3, tw / 3), y, z + rng.range(-td / 3, td / 3), 2.4, 1.6, 2.4, '#9aa0a8');
    }
    // Ground-floor storefront signs facing the street.
    const [nx, nz] = streetNormal(x, z, cx, cz);
    if (rng.chance(0.6)) wallSign(ctx.signs.neon(rng.int(0, NEON_SIGNS.length - 1)), x + nx * w / 2, KERB + podiumH - 1.6, z + nz * d / 2, 9, 2.25, nx, nz);
  }
}

/** Mid-rise offices and shops with awnings, water tanks and rooftop billboards. */
export function buildMidtownBlock(ctx, cx, cz) {
  const { rng } = ctx;
  const alongX = rng.chance(0.5);
  const count = rng.int(3, 4);
  const span = LOT / count;
  for (let n = 0; n < count; n += 1) {
    for (const side of [-1, 1]) {
      const along = -LOT / 2 + span * (n + 0.5);
      const w = span - rng.range(0.5, 1.5), d = LOT / 2 - rng.range(1, 3);
      const x = cx + (alongX ? along : side * LOT / 4);
      const z = cz + (alongX ? side * LOT / 4 : along);
      const bw = alongX ? w : d, bd = alongX ? d : w;
      const h = rng.range(10, 34);
      const style = rng.chance(0.55) ? 'office' : 'stucco';
      const tint = style === 'office' ? rng.pick(OFFICE_TINTS) : rng.pick(PASTELS);
      facadeBox(ctx, style, x, KERB, z, bw, h, bd, tint);
      ctx.chunk.trim.box(x, KERB + h, z, bw + 0.4, 0.7, bd + 0.4, '#ece8e0');
      const nx = alongX ? 0 : side, nz = alongX ? side : 0;
      const fx = x + nx * bw / 2, fz = z + nz * bd / 2;
      awning(ctx, fx, KERB + 3.2, fz, (alongX ? bw : bd) * 0.8, nx, nz, rng.pick(['#e94f37', '#2a9d8f', '#f4a261', '#264653', '#e76f51']));
      if (rng.chance(0.4)) wallSign(ctx.signs.neon(rng.int(0, NEON_SIGNS.length - 1)), fx, KERB + 5.2, fz, 7, 1.75, nx, nz);
      if (rng.chance(0.35)) ctx.chunk.wood.cylinder(x + rng.range(-2, 2), KERB + h + 0.7, z + rng.range(-2, 2), 1.6, 1.6, 3, 10, '#ffffff');
      else if (rng.chance(0.3)) rooftopBillboard(ctx, rng.int(0, 4), x, KERB + h + 0.7, z, nx, nz);
    }
  }
}

/** Pastel art-deco along Deco Row: rounded corners suggested by fins, bands and neon. */
export function buildDecoBlock(ctx, cx, cz) {
  const { rng } = ctx;
  const slots = [[-12, -12], [12, -12], [-12, 12], [12, 12]];
  for (const [ox, oz] of slots) {
    const x = cx + ox, z = cz + oz;
    const w = rng.range(19, 22.5), d = rng.range(19, 22.5);
    const floors = rng.int(3, 5);
    const h = floors * 4;
    const tint = rng.pick(PASTELS);
    facadeBox(ctx, 'stucco', x, KERB, z, w, h, d, tint);
    // Horizontal racing bands and a crown band.
    for (let f = 1; f < floors; f += 1) ctx.chunk.trim.box(x, KERB + f * 4 - 0.15, z, w + 0.3, 0.3, d + 0.3, '#ffffff');
    ctx.chunk.trim.box(x, KERB + h, z, w + 0.6, 1.0, d + 0.6, rng.pick(['#ffffff', '#2fb5b0', '#ff8fab', '#ffd166']));
    // A stepped central fin on the street side, the signature of the style.
    for (const [nx, nz] of [[Math.sign(ox), 0], [0, Math.sign(oz)]]) {
      const fx = x + nx * (w / 2 + 0.4), fz = z + nz * (d / 2 + 0.4);
      ctx.chunk.stucco.box(fx, KERB, fz, nx ? 0.8 : 3, h + 4, nz ? 0.8 : 3, tint, { uvScale: 1 / 16 });
      ctx.chunk.trim.box(fx, KERB + h + 4, fz, nx ? 1.2 : 3.6, 0.5, nz ? 1.2 : 3.6, '#ffffff');
      const sideOffset = 6;
      const sx = fx + (nz ? sideOffset : 0), sz = fz + (nx ? sideOffset : 0);
      if (rng.chance(0.85)) wallSign(ctx.signs.neon(rng.int(0, NEON_SIGNS.length - 1)), sx, KERB + h - 2, sz, 8, 2, nx, nz);
      awning(ctx, fx - (nz ? sideOffset : 0), KERB + 3.1, fz - (nx ? sideOffset : 0), 6, nx, nz, rng.pick(['#ff6f91', '#2ec4b6', '#ffbf69', '#9b5de5']));
      // Neon blade strips up both edges of the fin and a shop sign over the street-level awning
      // (picked from the position, so the rest of the block layout keeps its random sequence).
      const pick = Math.abs(Math.round(fx * 7 + fz * 13));
      const bladeColor = ['#ff3ec8', '#3ef2ff', '#b26bff', '#ff9a3c'][pick % 4];
      for (const e of [-1, 1]) ctx.chunk.neon.box(fx + nx * 0.45 + (nz ? e * 1.55 : 0), KERB + 4.2, fz + nz * 0.45 + (nx ? e * 1.55 : 0), 0.14, h - 0.6, 0.14, bladeColor);
      wallSign(ctx.signs.neon(pick % NEON_SIGNS.length), fx - (nz ? sideOffset : 0) + nx * 0.4, KERB + 4.7, fz - (nx ? sideOffset : 0) + nz * 0.4, 6, 1.5, nx, nz);
      // Neon tube along the crown edge.
      ctx.chunk.neon.box(x + nx * (w / 2 + 0.35), KERB + h + 0.5, z + nz * (d / 2 + 0.35), nx ? 0.12 : w * 0.9, 0.12, nz ? 0.12 : d * 0.9, rng.pick(['#ff3ec8', '#3ef2ff', '#ffd166', '#7dffb3']));
    }
  }
  ctx.props.palms.push({ x: cx, z: cz, h: 9 });
}

/** Palm Grove villas: pitched tile roofs, pools, hedges and palms. */
export function buildResidentialBlock(ctx, cx, cz) {
  const { rng } = ctx;
  for (let gx = -1; gx <= 1; gx += 1) {
    for (let gz = -1; gz <= 1; gz += 1) {
      if (gx === 0 && gz === 0) {
        // The middle lot is a shared garden with a pool.
        ctx.chunk.trim.box(cx, KERB, cz, 11, 0.25, 7, '#f4f1ea');
        ctx.chunk.pool.flat(cx, KERB + 0.27, cz, 9.6, 5.6, '#ffffff', 2, 1.2);
        ctx.props.palms.push({ x: cx - 6, z: cz + 5, h: 8 }, { x: cx + 6, z: cz - 5, h: 10 });
        continue;
      }
      const x = cx + gx * 16, z = cz + gz * 16;
      const w = rng.range(8.5, 11.5), d = rng.range(7, 9);
      const floors = rng.chance(0.4) ? 2 : 1;
      const h = floors * 3.3;
      facadeBox(ctx, 'house', x, KERB, z, w, h, d, rng.pick(PASTELS));
      ctx.chunk.roof.box(x, KERB + h, z, w + 0.8, 0.2, d + 0.8, '#d8d2c8');
      if (rng.chance(0.75)) ctx.chunk.trim.gable(x, KERB + h + 0.2, z, w + 0.8, rng.range(1.8, 2.6), d + 0.8, rng.pick(ROOF_TILES));
      // Hedge along the street side.
      const [nx, nz] = streetNormal(x, z, cx, cz);
      ctx.chunk.trim.box(x + nx * 7, KERB, z + nz * 7, nx ? 0.8 : 12, 1.0, nz ? 0.8 : 12, '#4f8a3a');
      if (rng.chance(0.55)) ctx.props.palms.push({ x: x + nx * 5 + rng.range(-3, 3), z: z + nz * 5 + rng.range(-3, 3), h: rng.range(7, 11) });
      else ctx.props.trees.push({ x: x - nx * 5, z: z - nz * 5, s: rng.range(0.8, 1.2) });
    }
  }
}

/** Ironwake Docks: corrugated warehouses and stacks of shipping containers. */
export function buildPortBlock(ctx, cx, cz) {
  const { rng } = ctx;
  const w = rng.range(30, 40), d = rng.range(16, 22);
  const wz = cz - LOT / 2 + d / 2 + 1;
  facadeBox(ctx, 'warehouse', cx, KERB, wz, w, rng.range(9, 13), d, rng.pick(['#e8e4dc', '#c9d6df', '#e0c9b8']));
  const colours = ['#c0392b', '#2471a3', '#d68910', '#1e8449', '#7d3c98', '#ca6f1e', '#117a65', '#e0e0e0'];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (rng.chance(0.25)) continue;
      const x = cx - 15 + col * 15, z = cz + 4 + row * 6.5;
      const stack = rng.int(1, 3);
      for (let s = 0; s < stack; s += 1) {
        ctx.chunk.warehouse.box(x, KERB + s * 2.6, z, 12, 2.6, 2.5, rng.pick(colours), { uvScale: 1 / 6 });
      }
      ctx.collision.addCenteredBox(x, z, 12, 2.5, KERB + stack * 2.6, 'container');
    }
  }
  ctx.props.lamps.push({ x: cx - 22, z: cz + 22, tall: true }, { x: cx + 22, z: cz + 22, tall: true });
}

/** Lumen Park: lawns, paths, trees and a fountain. */
export function buildParkBlock(ctx, cx, cz) {
  const { rng } = ctx;
  ctx.chunk.concrete.flat(cx, KERB + 0.02, cz, 4, LOT, '#d9cfbf', 1, 10);
  ctx.chunk.concrete.flat(cx, KERB + 0.02, cz, LOT, 4, '#d9cfbf', 10, 1);
  ctx.chunk.concrete.cylinder(cx, KERB, cz, 6, 6, 0.8, 18, '#e8e2d6');
  ctx.chunk.pool.cylinder(cx, KERB + 0.6, cz, 5.4, 5.4, 0.25, 18, '#ffffff');
  ctx.chunk.concrete.cylinder(cx, KERB, cz, 0.8, 0.5, 3.2, 8, '#efe9dd');
  ctx.collision.addCenteredBox(cx, cz, 10, 10, 1.0, 'fountain');
  for (let n = 0; n < 16; n += 1) {
    const x = cx + rng.range(-21, 21), z = cz + rng.range(-21, 21);
    if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
    if (rng.chance(0.5)) ctx.props.trees.push({ x, z, s: rng.range(0.9, 1.5) });
    else ctx.props.palms.push({ x, z, h: rng.range(8, 12) });
  }
}

/** Coral Strand beach: boardwalk, umbrellas, towels, lifeguard towers and rows of palms. */
export function buildBeachBlock(ctx, cx, cz, i, j) {
  const { rng } = ctx;
  const boardwalkX = cx - 22;
  ctx.chunk.wood.box(boardwalkX, 0, cz, 8, 0.25, 70, '#ffffff', { uvScale: 0.25 });
  for (let n = 0; n < 4; n += 1) ctx.props.palms.push({ x: cx - 27.5, z: cz - 26 + n * 17.5, h: rng.range(10, 14) });
  for (let n = 0; n < 3; n += 1) ctx.props.palms.push({ x: boardwalkX + 5, z: cz - 20 + n * 20 + rng.range(-3, 3), h: rng.range(8, 12) });
  const colours = ['#ff6b6b', '#ffd93d', '#4ecdc4', '#ff8fab', '#6a4c93', '#1982c4'];
  for (let n = 0; n < 9; n += 1) {
    const x = cx - 8 + rng.range(0, 50), z = cz + rng.range(-30, 30);
    const c = rng.pick(colours);
    ctx.chunk.metal.cylinder(x, 0, z, 0.06, 0.06, 2.4, 5, '#dddddd');
    ctx.chunk.trim.cylinder(x, 2.0, z, 1.9, 0.05, 0.7, 8, c);
    ctx.chunk.trim.flat(x + 1.2, 0.05, z + 0.6, 1.0, 2.0, rng.pick(colours));
  }
  if ((i + j) % 2 === 0) {
    const x = cx + 18, z = cz;
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.chunk.wood.box(x + lx * 1.1, 0, z + lz * 1.1, 0.25, 2.6, 0.25, '#ffffff');
    ctx.chunk.trim.box(x, 2.6, z, 3, 2, 3, '#ff5a5f');
    ctx.chunk.trim.box(x, 4.6, z, 3.6, 0.3, 3.6, '#ffffff');
    ctx.collision.addCenteredBox(x, z, 2.8, 2.8, 4.9, 'tower');
  }
}

/** Gull Key's open lawns, trees and a car park. */
export function buildIslandBlock(ctx, cx, cz) {
  const { rng } = ctx;
  for (let n = 0; n < 10; n += 1) {
    const x = cx + rng.range(-22, 22), z = cz + rng.range(-22, 22);
    if (rng.chance(0.5)) ctx.props.palms.push({ x, z, h: rng.range(8, 13) });
    else ctx.props.trees.push({ x, z, s: rng.range(0.9, 1.4) });
  }
}
