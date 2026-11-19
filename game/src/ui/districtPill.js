// The HUD district pill above the health bars: the district's name and accent colour, the
// street Dani is on, and a turf tag when a rival crew runs these corners (world/districts.js).
// Entering a new district also flashes its one-line character as a toast.

import { districtInfo } from '../world/districts.js';

const $ = (id) => document.getElementById(id);

export function createDistrictPill(game, toast) {
  const el = { pill: $('hud-district'), dot: $('hud-district-dot'), area: $('hud-area'), street: $('hud-street'), crew: $('hud-crew') };
  let lastKey = '';

  function render() {
    const p = game.player;
    const info = districtInfo(p.x, p.z);
    if (info.key !== lastKey) {
      if (lastKey && !game.shotMode) toast(info.name.toUpperCase(), info.tag, info.color);
      lastKey = info.key;
      el.area.textContent = info.name.toUpperCase();
      el.dot.style.background = info.color;
      el.pill.style.setProperty('--accent', info.color);
      el.crew.classList.toggle('hidden', !info.crew);
      if (info.crew) {
        el.crew.textContent = `${info.crew.name.toUpperCase()} TURF`;
        el.crew.style.setProperty('--crew', info.crew.color);
      }
    }
    if (el.street.textContent !== info.street) el.street.textContent = info.street;
  }

  return { render };
}
