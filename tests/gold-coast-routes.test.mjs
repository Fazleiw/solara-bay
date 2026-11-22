import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COCO_UNSEEN_SECONDS,
  TAVO_HOLD_SECONDS,
  freshEscapeProgress,
  stepEscapeProgress,
  switchEscapeRoute,
} from '../game/src/missions/goldCoastEscape.js';

test('Gold Coast route choice persists and both holds reset on unsafe interruption', () => {
  const tavo = freshEscapeProgress('tavo');
  stepEscapeProgress(tavo, 2.5, { inTavoBay: true, inVehicle: true, slow: true });
  assert.equal(tavo.route, 'tavo');
  assert.equal(tavo.tavoHold, 2.5);
  stepEscapeProgress(tavo, 0.1, { inTavoBay: false, inVehicle: true, slow: true });
  assert.equal(tavo.tavoHold, 0, 'leaving the bay resets Tavo');
  stepEscapeProgress(tavo, TAVO_HOLD_SECONDS, { inTavoBay: true, inVehicle: true, slow: true });
  assert.equal(tavo.tavoHold, TAVO_HOLD_SECONDS);

  const coco = switchEscapeRoute(tavo);
  assert.deepEqual(coco, freshEscapeProgress('coco'), 'V switches once without leaking route progress');
  stepEscapeProgress(coco, 1.5, { seen: false, inCocoCover: true });
  assert.equal(coco.cocoClear, false, 'one unseen moment is not enough');
  stepEscapeProgress(coco, 0.1, { seen: true, inCocoCover: true });
  assert.equal(coco.cocoUnseen, 0, 'restored sight visibly resets Coco');
  stepEscapeProgress(coco, COCO_UNSEEN_SECONDS, { seen: false, inCocoCover: true });
  assert.equal(coco.cocoClear, true);
  stepEscapeProgress(coco, 1, { seen: false, inCocoCover: false });
  assert.equal(coco.cocoClear, true, 'cleared route remains payable at the side door, including zero heat');
});
