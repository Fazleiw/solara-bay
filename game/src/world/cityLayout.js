// The map of Solara Bay: which district each grid block belongs to, which road segments
// exist, street names, named landmarks, and the land/water tests every moving thing uses.
//
//   x grows east, z grows south. Block (i, j) is column i, row j.
//   Row 0 holds Gull Key (an island), row 1 is the Solara Inlet crossed by the Causeway Bridge,
//   column 9 is the Coral Strand beach with the ocean beyond, rows 8-9 are the Ironwake Docks.
import { GRID, BLOCK_SIZE, WATER_LEVEL } from '../config.js';

export const DISTRICTS = {
  downtown: { name: 'Vista Centro', tint: '#c9d6ea', ground: 'plaza' },
  midtown: { name: 'Mercado', tint: '#e2d5c3', ground: 'plaza' },
  deco: { name: 'Deco Row', tint: '#f3d1dc', ground: 'plaza' },
  residential: { name: 'Palm Grove', tint: '#cfe3c0', ground: 'grass' },
  port: { name: 'Ironwake Docks', tint: '#b9b4ad', ground: 'asphalt' },
  beach: { name: 'Coral Strand', tint: '#f2dfb0', ground: 'sand' },
  island: { name: 'Gull Key', tint: '#bfe0a8', ground: 'grass' },
  park: { name: 'Lumen Park', tint: '#a8d98f', ground: 'grass' },
  water: { name: 'Solara Inlet', tint: '#3d8fb5', ground: 'water' },
};

export const STREETS_NS = ['Westshore Expressway', 'Jacaranda Ave', 'Hibiscus Ave', 'Mercado Ave', 'Centro Blvd', 'Luz Ave', 'Causeway Blvd', 'Marisol Ave', 'Coral Ave', 'Ocean Promenade', 'Shoreline'];
export const STREETS_EW = ['North Shore', 'Gull Key Rd', 'Inlet Drive', 'Vista St', 'Dorado St', 'Palmera St', 'Amber St', 'Solstice St', 'Harbor Way', 'Dock St', 'Quay Road'];

/** Landmarks the story, respawns and minimap use. Positions are filled in below from blocks. */
export const LANDMARKS = {
  safehouse: { block: [1, 4], label: 'Safehouse', icon: 'house' },
  cocoShack: { block: [9, 4], label: 'Coco Loco Tacos', icon: 'C' },
  tavoGarage: { block: [3, 6], label: "Tavo's Chrome & Paint", icon: 'T' },
  hospital: { block: [4, 2], label: 'St. Marisol Medical', icon: 'hospital' },
  policeHQ: { block: [7, 5], label: 'Bay Police Central', icon: 'police' },
  showroom: { block: [6, 3], label: 'Lumière Motors Plaza', icon: 'car' },
  warehouse: { block: [2, 9], label: 'Saltjaw Yard', icon: 'skull' },
  lighthouse: { block: [7, 0], label: 'Gull Key Lighthouse', icon: 'flag' },
  gunShop: { block: [3, 3], label: 'Bayside Arms', icon: 'gun' },
  park: { block: [5, 6], label: 'Lumen Park', icon: null },
};

export function lineCoord(k) {
  return GRID.origin + k * GRID.pitch;
}

export function blockCenter(i, j) {
  return { x: GRID.origin + (i + 0.5) * GRID.pitch, z: GRID.origin + (j + 0.5) * GRID.pitch };
}

/** District key of block (i, j); 'out' beyond the grid. */
export function districtOf(i, j) {
  if (i < 0 || j < 0 || i >= GRID.cols || j >= GRID.rows) return 'out';
  if (i === 5 && j === 6) return 'park';
  if (j === 0) return i >= 5 && i <= 8 ? 'island' : 'water';
  if (j === 1) return 'water';
  if (i === 9) return 'beach';
  if (j >= 8) return 'port';
  if (i <= 2) return 'residential';
  if (j <= 5 && i >= 4 && i <= 7) return 'downtown';
  if (j >= 6) return 'deco';
  return 'midtown';
}

const isRoadLand = (d) => d !== 'water' && d !== 'out' && d !== 'beach';
export const isLandDistrict = (d) => d !== 'water' && d !== 'out';

/** Vertical (north-south) segment on grid line k between rows j and j+1. */
export function verticalSegmentExists(k, j) {
  if (k === 6 && j === 1) return true; // Causeway Bridge
  if (k === 10) return false;
  return isRoadLand(districtOf(k - 1, j)) || isRoadLand(districtOf(k, j));
}

/** Horizontal (east-west) segment on grid line k between columns i and i+1. */
export function horizontalSegmentExists(k, i) {
  if (k === 0) return false;
  if (k === 10) return i <= 8;
  return isRoadLand(districtOf(i, k - 1)) || isRoadLand(districtOf(i, k));
}

export function isBridgeSegment(k, j, vertical) {
  return vertical && k === 6 && j === 1;
}

// Fill landmark world positions: the block centre and a "front" spot on the sidewalk.
for (const mark of Object.values(LANDMARKS)) {
  const c = blockCenter(mark.block[0], mark.block[1]);
  mark.x = c.x;
  mark.z = c.z;
}
LANDMARKS.safehouse.front = { x: LANDMARKS.safehouse.x + 25, z: LANDMARKS.safehouse.z + 6 };
LANDMARKS.cocoShack.front = { x: LANDMARKS.cocoShack.x - 30, z: LANDMARKS.cocoShack.z + 4 };
LANDMARKS.cocoShack.x -= 18;
LANDMARKS.tavoGarage.front = { x: LANDMARKS.tavoGarage.x, z: LANDMARKS.tavoGarage.z - 25 };
LANDMARKS.hospital.front = { x: LANDMARKS.hospital.x, z: LANDMARKS.hospital.z + 25.5 };
LANDMARKS.policeHQ.front = { x: LANDMARKS.policeHQ.x - 25.5, z: LANDMARKS.policeHQ.z };
LANDMARKS.showroom.front = { x: LANDMARKS.showroom.x, z: LANDMARKS.showroom.z };
LANDMARKS.warehouse.front = { x: LANDMARKS.warehouse.x, z: LANDMARKS.warehouse.z - 8 };
LANDMARKS.lighthouse.front = { x: LANDMARKS.lighthouse.x, z: LANDMARKS.lighthouse.z + 22 };
LANDMARKS.gunShop.front = { x: LANDMARKS.gunShop.x + 25.5, z: LANDMARKS.gunShop.z };
LANDMARKS.park.front = { x: LANDMARKS.park.x, z: LANDMARKS.park.z };

/** The pier off Coral Strand, with the Sol Wheel at its end. */
export const PIER = { x0: 352, x1: 470, z: lineCoord(5) + 35, halfWidth: 7 };
/** Where the beach sand meets the water (x of the shoreline). */
export const SHORE_X = 375;
/** The dock apron south of the quay road, where the gantry cranes stand. */
export const QUAY = { x0: -357, x1: 287, z0: 357, z1: 372 };

function cellOf(x, z) {
  return {
    i: Math.floor((x - GRID.origin) / GRID.pitch),
    j: Math.floor((z - GRID.origin) / GRID.pitch),
  };
}

/** True when (x, z) lies on an existing road strip (within half a road of its centre line). */
export function isOnRoad(x, z) {
  const half = GRID.road / 2;
  const kx = Math.round((x - GRID.origin) / GRID.pitch);
  const kz = Math.round((z - GRID.origin) / GRID.pitch);
  const lx = lineCoord(kx), lz = lineCoord(kz);
  if (Math.abs(x - lx) <= half) {
    const j = Math.floor((z - GRID.origin) / GRID.pitch);
    if (j >= 0 && j < GRID.rows && verticalSegmentExists(kx, j)) return true;
    if (Math.abs(z - lz) <= half && nodeHasRoad(kx, kz)) return true;
  }
  if (Math.abs(z - lz) <= half) {
    const i = Math.floor((x - GRID.origin) / GRID.pitch);
    if (i >= 0 && i < GRID.cols && horizontalSegmentExists(kz, i)) return true;
  }
  return false;
}

function nodeHasRoad(k, l) {
  return (l > 0 && verticalSegmentExists(k, l - 1)) || (l < GRID.rows && verticalSegmentExists(k, l))
    || (k > 0 && horizontalSegmentExists(l, k - 1)) || (k < GRID.cols && horizontalSegmentExists(l, k));
}

/**
 * Ground height at (x, z), or null over open water. Land is any land block, any road strip,
 * the beach slope down to the shoreline and the pier deck.
 */
export function groundHeightAt(x, z) {
  if (z > PIER.z - PIER.halfWidth && z < PIER.z + PIER.halfWidth && x > 340 && x < PIER.x1) return 0;
  if (z >= QUAY.z0 - 1 && z <= QUAY.z1 && x >= QUAY.x0 && x <= QUAY.x1) return 0;
  const { i, j } = cellOf(x, z);
  if (x >= lineCoord(10) && j >= 2 && j <= 9) {
    const y = -Math.max(0, x - 352) * 0.062;
    return y > WATER_LEVEL + 0.1 ? y : null;
  }
  if (isLandDistrict(districtOf(i, j))) return 0;
  if (isOnRoad(x, z)) return 0;
  return null;
}

/** Can a person stand here (not in the water, not past the western hills)? */
export function isWalkable(x, z) {
  const h = groundHeightAt(x, z);
  return h !== null && h > -0.9 && x > GRID.origin - 7.5;
}

/** Can a vehicle drive here? Same as walkable: water stops cars at the sea wall. */
export function isDrivable(x, z) {
  return isWalkable(x, z);
}

/** Is (x, z) on a raised sidewalk/lot (a block interior), as opposed to the road? */
export function isOnBlock(x, z) {
  const { i, j } = cellOf(x, z);
  const c = blockCenter(i, j);
  return Math.abs(x - c.x) < BLOCK_SIZE / 2 && Math.abs(z - c.z) < BLOCK_SIZE / 2 && isLandDistrict(districtOf(i, j));
}

/** The district a point belongs to, for the HUD area name and the minimap. */
export function districtAt(x, z) {
  if (z > PIER.z - PIER.halfWidth && z < PIER.z + PIER.halfWidth && x > 345) return 'beach';
  const { i, j } = cellOf(Math.min(x, lineCoord(10) - 1), z);
  if (i === 6 && j === 1) return 'bridge';
  return districtOf(i, j);
}

export function areaName(x, z) {
  const d = districtAt(x, z);
  if (d === 'bridge') return 'Causeway Bridge';
  if (d === 'out') return 'Solara Bay';
  return DISTRICTS[d].name;
}

/** The nearest street name to a point, for the HUD's location line. */
export function streetNameAt(x, z) {
  const kx = Math.round((x - GRID.origin) / GRID.pitch);
  const kz = Math.round((z - GRID.origin) / GRID.pitch);
  const dx = Math.abs(x - lineCoord(kx));
  const dz = Math.abs(z - lineCoord(kz));
  if (dx < dz) return STREETS_NS[Math.max(0, Math.min(10, kx))];
  return STREETS_EW[Math.max(0, Math.min(10, kz))];
}

/** Bounds of the playable map for the minimap and the city map. */
export const MAP_BOUNDS = { minX: -380, maxX: 480, minZ: -380, maxZ: 380 };
