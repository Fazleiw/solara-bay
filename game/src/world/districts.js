// Districts as the player meets them: each of Solara Bay's nine areas has a name, a one-line
// character, an accent colour for the HUD's district pill and, where a crew holds it, the
// gang that runs the corners. districtInfo() answers for any point on the map.
import { districtAt, streetNameAt, DISTRICTS } from './cityLayout.js';
import { crewForDistrict } from '../gangs/crews.js';

export const DISTRICT_FLAVOR = {
  downtown: { tag: 'Glass towers and money', color: '#7fc8ff' },
  midtown: { tag: 'Markets and corner stores', color: '#ffb36b' },
  deco: { tag: 'Pastel neon nights', color: '#ff6fd8' },
  residential: { tag: 'Villas under the palms', color: '#8fe08a' },
  port: { tag: 'Cranes, containers, trouble', color: '#ff8a5c' },
  beach: { tag: 'Sand, surf and the Sol Wheel', color: '#ffd23f' },
  island: { tag: 'Lighthouse rock', color: '#9fe6c0' },
  park: { tag: 'Green lungs of the city', color: '#7ee08a' },
  water: { tag: 'Open water', color: '#5cc8ff' },
  bridge: { tag: 'Cable-stayed over the inlet', color: '#ffc06a' },
};

/** Everything the HUD shows about where (x, z) is. */
export function districtInfo(x, z) {
  const key = districtAt(x, z);
  const name = key === 'bridge' ? 'Causeway Bridge' : key === 'out' ? 'Solara Bay' : DISTRICTS[key].name;
  const flavor = DISTRICT_FLAVOR[key] ?? { tag: '', color: '#ffffff' };
  return { key, name, street: streetNameAt(x, z), tag: flavor.tag, color: flavor.color, crew: crewForDistrict(key) };
}
