// The road graph traffic, police and the GPS route use: a node at every grid intersection that
// a road reaches, an edge for every road segment, right-hand lanes, traffic-light phases and a
// breadth-first route finder.
import { GRID } from '../config.js';
import { horizontalSegmentExists, isBridgeSegment, lineCoord, verticalSegmentExists } from './cityLayout.js';

const N = GRID.cols + 1;

export function nodeId(k, l) {
  return k + l * N;
}

export function createRoadNetwork() {
  const nodes = new Map();
  const edges = [];

  function ensureNode(k, l) {
    const id = nodeId(k, l);
    if (!nodes.has(id)) nodes.set(id, { id, k, l, x: lineCoord(k), z: lineCoord(l), links: [] });
    return nodes.get(id);
  }

  function link(a, b, axis, bridge) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const edge = { id: edges.length, a: a.id, b: b.id, axis, bridge, length };
    edges.push(edge);
    a.links.push({ to: b.id, edge });
    b.links.push({ to: a.id, edge });
  }

  for (let k = 0; k <= GRID.cols; k += 1) {
    for (let j = 0; j < GRID.rows; j += 1) {
      if (verticalSegmentExists(k, j)) link(ensureNode(k, j), ensureNode(k, j + 1), 'ns', isBridgeSegment(k, j, true));
    }
  }
  for (let l = 0; l <= GRID.rows; l += 1) {
    for (let i = 0; i < GRID.cols; i += 1) {
      if (horizontalSegmentExists(l, i)) link(ensureNode(i, l), ensureNode(i + 1, l), 'ew', false);
    }
  }
  const nodeList = [...nodes.values()];
  for (const node of nodeList) node.hasLights = node.links.length >= 3;

  function nearestNode(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const node of nodeList) {
      const d = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (d < bestD) { bestD = d; best = node; }
    }
    return best;
  }

  /** Lane centre point travelling from node `from` to node `to`, at distance `s` from `from`. */
  function lanePoint(from, to, s, out = { x: 0, z: 0 }) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    const fx = dx / len, fz = dz / len;
    // Right of travel direction (x east, z south, viewed from above): (-fz, fx).
    out.x = from.x + fx * s - fz * GRID.laneOffset;
    out.z = from.z + fz * s + fx * GRID.laneOffset;
    return out;
  }

  /** Breadth-first route between two nodes; returns node ids from start to goal (inclusive). */
  function findRoute(startId, goalId) {
    if (startId === goalId) return [startId];
    const prev = new Map([[startId, -1]]);
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      if (id === goalId) break;
      for (const l of nodes.get(id).links) {
        if (!prev.has(l.to)) { prev.set(l.to, id); queue.push(l.to); }
      }
    }
    if (!prev.has(goalId)) return [];
    const route = [];
    for (let id = goalId; id !== -1; id = prev.get(id)) route.push(id);
    return route.reverse();
  }

  /**
   * Global traffic-light phase. North-south traffic has green for the first part of the
   * cycle, east-west for the second, with amber and all-red gaps between.
   */
  const CYCLE = 22;
  function lightState(axis, time) {
    const t = time % CYCLE;
    const ns = t < 9 ? 'green' : t < 11 ? 'amber' : 'red';
    const ew = t >= 11 && t < 20 ? 'green' : t >= 20 ? 'amber' : 'red';
    return axis === 'ns' ? ns : ew;
  }

  /** Nearest point on any road centre line, with its edge; used to put spawned cars on lanes. */
  function nearestEdge(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const edge of edges) {
      const a = nodes.get(edge.a), b = nodes.get(edge.b);
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / (edge.length ** 2)));
      const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bestD) { bestD = d; best = { edge, t, x: px, z: pz, distance: Math.sqrt(d) }; }
    }
    return best;
  }

  return { nodes, nodeList, edges, nearestNode, nearestEdge, lanePoint, findRoute, lightState, node: (id) => nodes.get(id) };
}
