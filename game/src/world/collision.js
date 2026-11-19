// Static collision: every building, wall and container stack is an axis-aligned box kept in a
// spatial hash. Circles (people, car corners) are pushed out of boxes, and rays (bullets,
// police line of sight, the camera) are tested against them.

const CELL = 24;

export function createCollisionWorld() {
  const boxes = [];
  const cells = new Map();

  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

  function addBox(minX, minZ, maxX, maxZ, height = 30, kind = 'building') {
    const box = { minX, minZ, maxX, maxZ, height, kind, id: boxes.length };
    boxes.push(box);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const k = key(cx, cz);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(box);
      }
    }
    return box;
  }

  /** Adds a box from a centre and size. */
  function addCenteredBox(x, z, w, d, height, kind) {
    return addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, height, kind);
  }

  const seen = new Set();
  function nearby(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    seen.clear();
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const list = cells.get(key(cx, cz));
        if (!list) continue;
        for (const box of list) {
          if (!seen.has(box.id)) { seen.add(box.id); out.push(box); }
        }
      }
    }
    return out;
  }

  const scratch = [];
  const push = { x: 0, z: 0, nx: 0, nz: 0, hit: false, depth: 0 };

  /**
   * Pushes a circle at (x, z) of radius r out of every box it overlaps (only boxes taller than
   * `y`, so a car can sit on nothing taller than a kerb). Returns the summed push and normal.
   */
  function resolveCircle(x, z, r, y = 0) {
    push.x = 0; push.z = 0; push.nx = 0; push.nz = 0; push.hit = false; push.depth = 0;
    nearby(x - r, z - r, x + r, z + r, scratch);
    let px = x, pz = z;
    for (const box of scratch) {
      if (box.height <= y + 0.3) continue;
      const cx = Math.max(box.minX, Math.min(px, box.maxX));
      const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
      let dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let depth, nx, nz;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d; depth = r - d;
      } else {
        // Centre inside the box: leave by the nearest face.
        const left = px - box.minX, right = box.maxX - px, top = pz - box.minZ, bottom = box.maxZ - pz;
        const m = Math.min(left, right, top, bottom);
        if (m === left) { nx = -1; nz = 0; } else if (m === right) { nx = 1; nz = 0; } else if (m === top) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
        depth = m + r;
      }
      px += nx * depth; pz += nz * depth;
      push.nx += nx; push.nz += nz;
      push.depth = Math.max(push.depth, depth);
      push.hit = true;
    }
    push.x = px - x; push.z = pz - z;
    const nl = Math.hypot(push.nx, push.nz);
    if (nl > 0) { push.nx /= nl; push.nz /= nl; }
    return push;
  }

  /** Distance along a 3D ray to the first box it hits, or Infinity. Direction must be unit length. */
  function raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
    nearby(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez), scratch);
    let best = Infinity;
    for (const box of scratch) {
      const t = rayBox(ox, oy, oz, dx, dy, dz, box.minX, 0, box.minZ, box.maxX, box.height, box.maxZ);
      if (t >= 0 && t < best && t <= maxDist) best = t;
    }
    if (dy < 0) {
      const tg = -oy / dy;
      if (tg >= 0 && tg < best && tg <= maxDist) best = tg;
    }
    return best;
  }

  /** True when nothing solid stands between two points. */
  function lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    return raycast(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.05;
  }

  return { boxes, addBox, addCenteredBox, resolveCircle, raycast, lineOfSight, nearby: (a, b, c, d) => nearby(a, b, c, d, []) };
}

/** Slab test of a ray against an axis-aligned box; returns entry distance or -1. */
export function rayBox(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [[ox, dx, minX, maxX], [oy, dy, minY, maxY], [oz, dz, minZ, maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : 0;
}
