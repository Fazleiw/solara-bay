// The Promenade Sprint: a short, fixed time trial on existing surface streets. Points sit on
// lane centres so the whole route is safely drivable while normal traffic stays active.
import { lineCoord } from '../world/cityLayout.js';

export const STREET_RACE = {
  id: 'promenade',
  title: 'Promenade Sprint',
  color: '#3ef2ff',
  time: 58,
  reward: 900,
  start: { x: lineCoord(9) - 3.5, z: lineCoord(2), heading: 0 },
  checkpoints: [
    { x: lineCoord(9) - 3.5, z: lineCoord(4), label: 'Ocean Promenade' },
    { x: lineCoord(9) - 3.5, z: lineCoord(6), label: 'Sol Wheel' },
    { x: lineCoord(9) - 3.5, z: lineCoord(8), label: 'Harbor turn' },
    { x: lineCoord(7), z: lineCoord(8) - 3.5, label: 'Marina straight' },
    { x: lineCoord(5), z: lineCoord(8) - 3.5, label: 'Lumen finish' },
  ],
};
