// Palm boulevards: Solara Bay's showpiece streets (Palmera St running down to the ocean,
// Causeway Blvd up to the bridge, Ocean Promenade along the beach) get a royal palm on both
// kerbs every 13 m, skipping the intersections, plus the odd bench and bus shelter between.
import { GRID } from '../config.js';
import { createRandom } from '../core/random.js';
import { districtOf, horizontalSegmentExists, lineCoord, verticalSegmentExists } from './cityLayout.js';

/** Grid lines that are boulevards: { k, alongX } (alongX: the street runs east-west). */
export const BOULEVARDS = [
  { k: 5, alongX: true, name: 'Palmera St' },
  { k: 6, alongX: false, name: 'Causeway Blvd' },
  { k: 9, alongX: false, name: 'Ocean Promenade' },
];

const KERB_OFFSET = GRID.road / 2 + 1.3;
const SPACING = 13;

/** Adds boulevard palms (and benches) to the prop lists and the chunk. */
export function plantBoulevards(props, chunk) {
  const rng = createRandom(5150);
  for (const b of BOULEVARDS) {
    const line = lineCoord(b.k);
    for (let seg = 0; seg < (b.alongX ? GRID.cols : GRID.rows); seg += 1) {
      const exists = b.alongX ? horizontalSegmentExists(b.k, seg) : verticalSegmentExists(b.k, seg);
      if (!exists || (!b.alongX && b.k === 6 && seg === 1)) continue; // not on the bridge deck
      const from = lineCoord(seg) + 11, to = lineCoord(seg + 1) - 11;
      for (const side of [-1, 1]) {
        // Only plant on a side that has a sidewalk (not the beach side of the Promenade).
        const ci = b.alongX ? seg : b.k + (side > 0 ? 0 : -1);
        const cj = b.alongX ? b.k + (side > 0 ? 0 : -1) : seg;
        const d = districtOf(ci, cj);
        if (d === 'water' || d === 'out') continue;
        const beachSide = d === 'beach';
        for (let t = from; t <= to + 0.01; t += SPACING) {
          const off = side * (KERB_OFFSET + (beachSide ? 2 : 0));
          const x = b.alongX ? t : line + off, z = b.alongX ? line + off : t;
          props.palms.push({ x, z, h: rng.range(11, 14.5) });
        }
        if (!beachSide && chunk && rng.chance(0.7)) {
          // A bench facing the road halfway along.
          const mid = (from + to) / 2 + SPACING / 2;
          const bx = b.alongX ? mid : line + side * (KERB_OFFSET + 1.4), bz = b.alongX ? line + side * (KERB_OFFSET + 1.4) : mid;
          chunk.trim.box(bx, 0.42, bz, b.alongX ? 2.2 : 0.5, 0.08, b.alongX ? 0.5 : 2.2, '#7a4a2a');
          chunk.trim.box(bx + (b.alongX ? 0 : side * 0.25), 0.7, bz + (b.alongX ? side * 0.25 : 0), b.alongX ? 2.2 : 0.08, 0.5, b.alongX ? 0.08 : 2.2, '#7a4a2a');
        }
      }
    }
  }
}
