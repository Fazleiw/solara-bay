// Ground and streets: the land slabs with their sea walls, road segments with lane markings,
// intersections with zebra crossings, raised sidewalks with kerbs, and each block's lot surface.
import * as THREE from 'three';
import { GRID, BLOCK_SIZE } from '../config.js';
import { GeometryBuilder, meshFromBuilder } from '../core/geometryBuilder.js';
import { blockCenter, DISTRICTS, districtOf, horizontalSegmentExists, isBridgeSegment, isLandDistrict, lineCoord, verticalSegmentExists } from './cityLayout.js';

const HALF_ROAD = GRID.road / 2;
const KERB = 0.12;

/** A road quad on the ground with its texture running along x (alongX) or along z. */
function roadQuad(b, x0, z0, x1, z1, alongX, y = 0.0) {
  const rgb = [1, 1, 1];
  const L = (alongX ? x1 - x0 : z1 - z0) / GRID.road;
  const A = [x0, y, z1], B = [x1, y, z1], C = [x1, y, z0], D = [x0, y, z0];
  if (alongX) {
    b.tri(A, B, C, [1, 0], [1, L], [0, L], rgb);
    b.tri(A, C, D, [1, 0], [0, L], [0, 0], rgb);
  } else {
    b.tri(A, B, C, [0, L], [1, L], [1, 0], rgb);
    b.tri(A, C, D, [0, L], [1, 0], [0, 0], rgb);
  }
}

export function buildGroundAndRoads(materials) {
  const group = new THREE.Group();
  group.name = 'ground';
  const roads = new GeometryBuilder();
  const crossings = new GeometryBuilder();
  const slabs = new GeometryBuilder();
  const sidewalks = new GeometryBuilder();
  const lots = { plaza: new GeometryBuilder(), grass: new GeometryBuilder(), asphalt: new GeometryBuilder(), sand: new GeometryBuilder() };
  const intersections = new Set();

  // Road segments and the slab under each one (so road strips beside water still have ground).
  for (let k = 0; k <= GRID.cols; k += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      if (!verticalSegmentExists(k, j)) continue;
      const x = lineCoord(k), z0 = lineCoord(j) + HALF_ROAD, z1 = lineCoord(j + 1) - HALF_ROAD;
      roadQuad(roads, x - HALF_ROAD, z0, x + HALF_ROAD, z1, false, isBridgeSegment(k, j, true) ? 0.02 : 0);
      if (!isBridgeSegment(k, j, true)) slabs.box(x, -6, (z0 + z1) / 2, GRID.road, 5.98, z1 - z0, '#9a968d', { uvScale: 0.25 });
      intersections.add(`${k},${j}`).add(`${k},${j + 1}`);
    }
  }
  for (let l = 0; l <= GRID.rows; l += 1) {
    for (let i = 0; i < GRID.cols; i += 1) {
      if (!horizontalSegmentExists(l, i)) continue;
      const z = lineCoord(l), x0 = lineCoord(i) + HALF_ROAD, x1 = lineCoord(i + 1) - HALF_ROAD;
      roadQuad(roads, x0, z - HALF_ROAD, x1, z + HALF_ROAD, true);
      slabs.box((x0 + x1) / 2, -6, z, x1 - x0, 5.98, GRID.road, '#9a968d', { uvScale: 0.25 });
      intersections.add(`${i},${l}`).add(`${i + 1},${l}`);
    }
  }
  for (const id of intersections) {
    const [k, l] = id.split(',').map(Number);
    const x = lineCoord(k), z = lineCoord(l);
    roadQuad(crossings, x - HALF_ROAD, z - HALF_ROAD, x + HALF_ROAD, z + HALF_ROAD, false);
    slabs.box(x, -6, z, GRID.road, 5.98, GRID.road, '#9a968d', { uvScale: 0.25 });
  }

  // Blocks: land slab (sea wall), sidewalk ring with kerb, and the lot surface.
  for (let i = 0; i < GRID.cols; i += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      const district = districtOf(i, j);
      if (!isLandDistrict(district)) continue;
      const { x, z } = blockCenter(i, j);
      slabs.box(x, -6, z, GRID.pitch, 5.98, GRID.pitch, '#a39f95', { uvScale: 0.25 });
      if (district === 'beach') {
        sidewalks.box(x - 31, 0, z, 8, KERB, GRID.pitch, '#ffffff', { uvScale: 0.25 });
        lots.sand.flat(x + 4, 0.02, z, GRID.pitch - 8, GRID.pitch, '#ffffff', 8, 8);
        continue;
      }
      sidewalks.box(x, 0, z, BLOCK_SIZE, KERB, BLOCK_SIZE, '#ffffff', { uvScale: 0.25 });
      const ground = DISTRICTS[district].ground;
      const inner = BLOCK_SIZE - GRID.sidewalk * 2;
      lots[ground].flat(x, KERB + 0.005, z, inner, inner, ground === 'asphalt' ? '#8e8c88' : '#ffffff', inner / 8, inner / 8);
    }
  }

  // The beach slope east of the grid, down under the waves.
  const beach = new GeometryBuilder();
  const rgb = [1, 1, 1];
  const zA = lineCoord(2), zB = lineCoord(10) + HALF_ROAD;
  const xA = lineCoord(10), xB = 412;
  const yB = -(xB - 352) * 0.062;
  beach.quad([xA, 0.02, zB], [352, 0.02, zB], [352, 0.02, zA], [xA, 0.02, zA], rgb, 0, 0, 0.5, (zB - zA) / 8);
  beach.quad([352, 0.02, zB], [xB, yB, zB], [xB, yB, zA], [352, 0.02, zA], rgb, 0, 0, (xB - 352) / 8, (zB - zA) / 8);
  // North and south ends of the beach drop into the water as well.
  beach.quad([xA, 0.02, zA], [xB, yB, zA], [xB, yB - 4, zA], [xA, -4, zA], rgb);

  const add = (builder, material, receive = true, cast = false) => {
    const mesh = meshFromBuilder(builder, material, { castShadow: cast, receiveShadow: receive });
    if (mesh) group.add(mesh);
    return mesh;
  };
  add(slabs, materials.concrete);
  add(roads, materials.road);
  add(crossings, materials.crossing);
  add(sidewalks, materials.sidewalk);
  add(lots.plaza, materials.plaza);
  add(lots.grass, materials.grass);
  add(lots.asphalt, materials.concrete);
  add(lots.sand, materials.sand);
  add(beach, materials.sand);
  return group;
}
