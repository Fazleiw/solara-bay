// Paints the city map once into an offscreen canvas (water, districts, beach, parks, every
// building footprint, roads with centre lines, the bridge and pier) and draws blips, the GPS
// route and the player arrow on top. The minimap and the pause-menu city map both use it.
import { GRID } from '../config.js';
import { blockCenter, DISTRICTS, districtOf, horizontalSegmentExists, lineCoord, MAP_BOUNDS, PIER, QUAY, verticalSegmentExists } from '../world/cityLayout.js';

export const MAP_SCALE = 2; // canvas pixels per metre

export function worldToMap(x, z) {
  return { x: (x - MAP_BOUNDS.minX) * MAP_SCALE, y: (z - MAP_BOUNDS.minZ) * MAP_SCALE };
}

export function buildMapCanvas(collision) {
  const w = (MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * MAP_SCALE;
  const h = (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) * MAP_SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rect = (x0, z0, x1, z1, color) => {
    const a = worldToMap(x0, z0), b = worldToMap(x1, z1);
    ctx.fillStyle = color;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  };
  const water = ctx.createLinearGradient(0, 0, w, h);
  water.addColorStop(0, '#2f7fa8'); water.addColorStop(1, '#1f5f8a');
  ctx.fillStyle = water; ctx.fillRect(0, 0, w, h);
  // Gentle wave texture.
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 26) { ctx.beginPath(); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 4); ctx.stroke(); }
  // Hills to the west.
  rect(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, GRID.origin - 7, MAP_BOUNDS.maxZ, '#6d8a57');
  // Blocks and the road strips around them.
  for (let i = 0; i < GRID.cols; i += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      const d = districtOf(i, j);
      if (d === 'water') continue;
      const c = blockCenter(i, j);
      rect(c.x - 35, c.z - 35, c.x + 35, c.z + 35, '#8d8f93');
    }
  }
  rect(lineCoord(10), lineCoord(2), 378, lineCoord(10) + 7, '#efdcab');
  rect(QUAY.x0, QUAY.z0, QUAY.x1, QUAY.z1, '#9a978f');
  for (let i = 0; i < GRID.cols; i += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      const d = districtOf(i, j);
      if (d === 'water') continue;
      const c = blockCenter(i, j);
      if (d === 'beach') { rect(c.x - 35, c.z - 35, c.x + 35, c.z + 35, '#efdcab'); rect(c.x - 28, c.z - 35, c.x - 18, c.z + 35, '#b08a62'); continue; }
      rect(c.x - 28, c.z - 28, c.x + 28, c.z + 28, '#d6d1c7');
      rect(c.x - 24, c.z - 24, c.x + 24, c.z + 24, DISTRICTS[d].tint);
    }
  }
  // Building footprints.
  for (const box of collision.boxes) {
    if (box.kind === 'rail') continue;
    const a = worldToMap(box.minX, box.minZ), b = worldToMap(box.maxX, box.maxZ);
    const tall = Math.min(1, box.height / 90);
    ctx.fillStyle = box.kind === 'container' ? 'rgba(150,70,60,0.75)' : `rgba(${70 - tall * 30},${76 - tall * 30},${92 - tall * 20},${0.55 + tall * 0.3})`;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  // Roads.
  const road = (x0, z0, x1, z1, alongX) => {
    rect(x0, z0, x1, z1, '#3f444c');
    const a = worldToMap(x0, z0), b = worldToMap(x1, z1);
    ctx.strokeStyle = 'rgba(255,214,90,0.55)'; ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    if (alongX) { ctx.moveTo(a.x, (a.y + b.y) / 2); ctx.lineTo(b.x, (a.y + b.y) / 2); } else { ctx.moveTo((a.x + b.x) / 2, a.y); ctx.lineTo((a.x + b.x) / 2, b.y); }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const half = GRID.road / 2;
  for (let k = 0; k <= GRID.cols; k += 1) for (let j = 0; j < GRID.rows; j += 1) if (verticalSegmentExists(k, j)) road(lineCoord(k) - half, lineCoord(j) - half, lineCoord(k) + half, lineCoord(j + 1) + half, false);
  for (let l = 0; l <= GRID.rows; l += 1) for (let i = 0; i < GRID.cols; i += 1) if (horizontalSegmentExists(l, i)) road(lineCoord(i) - half, lineCoord(l) - half, lineCoord(i + 1) + half, lineCoord(l) + half, true);
  rect(PIER.x0, PIER.z - PIER.halfWidth, PIER.x1, PIER.z + PIER.halfWidth, '#a07850');
  return canvas;
}

const ICON_COLOURS = { police: ['#ff2a3a', '#2a6bff'] };

/** Draws one blip; `scale` grows icons on the big map. */
export function drawBlip(ctx, blip, x, y, scale = 1, time = 0) {
  const s = (blip.size ?? 6) * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = '#111';
  if (blip.icon === 'police') {
    ctx.fillStyle = ICON_COLOURS.police[Math.floor(time * 6) % 2];
    ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (blip.icon === 'letter' || blip.icon === 'label') {
    ctx.fillStyle = blip.color;
    ctx.beginPath(); ctx.arc(0, 0, s * 1.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = `900 ${Math.round(s * 1.4)}px Arial Black, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(blip.letter ?? '?', 0, s * 0.08);
  } else if (blip.icon === 'car') {
    ctx.fillStyle = blip.color;
    ctx.beginPath(); ctx.roundRect(-s * 0.7, -s, s * 1.4, s * 2, s * 0.3); ctx.fill(); ctx.stroke();
  } else if (blip.icon === 'square') {
    ctx.fillStyle = blip.color;
    ctx.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); ctx.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
  } else {
    ctx.fillStyle = blip.color;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

/** The player's heading arrow. */
export function drawPlayerArrow(ctx, x, y, angle, size = 11) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size); ctx.lineTo(size * 0.72, size * 0.75); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size * 0.72, size * 0.75); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.restore();
}

/** Position of a blip (fixed point, or an entity that moves). */
export function blipPosition(blip) {
  if (blip.entity) return { x: blip.entity.x, z: blip.entity.z };
  return { x: blip.x, z: blip.z };
}
