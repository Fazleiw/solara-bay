import test from 'node:test';
import assert from 'node:assert/strict';
import { findRoadblockAhead } from '../game/src/police/dispatch.js';

const player = { x: 0, z: 0, vx: 0, vz: 20, heading: 0 };
const route = [{ x: 0, z: 0 }, { x: 0, z: 200 }];

test('roadblock alert selects a real block ahead and rejects invalid alerts', () => {
  const result = findRoadblockAhead(player, [{ x: 0, z: 90 }, { x: 0, z: -20 }], route, true);
  assert.equal(result?.block.z, 90);
  assert.equal(Math.round(result.distance), 90);
  assert.equal(findRoadblockAhead(player, [{ x: 0, z: -40 }], route, true), null);
  assert.equal(findRoadblockAhead(player, [{ x: 60, z: 90 }], route, true), null);
  assert.equal(findRoadblockAhead(player, [{ x: 0, z: 90 }], route, false), null);
});
