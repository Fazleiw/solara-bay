// Gang turf: while Dani walks or drives through a district a crew holds (gangs/crews.js), a few
// of its soldiers loiter on the sidewalk corners nearby. They leave an unarmed passer-by alone
// and open fire on anyone who draws a gun on their corner; the HUD district pill names the crew.
import { BLOCK_SIZE, GRID } from '../config.js';
import { rng } from '../core/random.js';
import { blockCenter, districtAt, districtOf } from '../world/cityLayout.js';
import { crewForDistrict } from './crews.js';

const CORNER = BLOCK_SIZE / 2 - 2.2;
const MAX_POSTED = 4;

export function createTerritory(game) {
  let timer = 0;

  /** The crew whose turf the player stands on, or null. */
  function crewHere() {
    const p = game.player;
    return crewForDistrict(districtAt(p.x, p.z));
  }

  /** Posts one soldier on a block corner of the crew's turf 30-80 m from the player. */
  function postSoldier(crew) {
    const p = game.player;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(30, 80);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const bi = Math.floor((x - GRID.origin) / GRID.pitch), bj = Math.floor((z - GRID.origin) / GRID.pitch);
      if (!crew.turf.includes(districtOf(bi, bj))) continue;
      const c = blockCenter(bi, bj);
      const sx = rng.sign(), sz = rng.sign();
      return game.gangs.spawnMember(c.x + sx * CORNER, c.z + sz * CORNER, { crew: crew.id, weapon: rng.chance(0.3) ? 'smg' : 'pistol', heading: Math.atan2(sx, sz), tag: 'turf' });
    }
    return null;
  }

  function update(dt) {
    timer -= dt;
    if (timer > 0 || !game.allowSpawning) return;
    timer = 1.5;
    const p = game.player;
    // Let go of soldiers the player has left far behind.
    for (const m of [...game.gangs.members]) {
      if (m.tag === 'turf' && !m.alerted && Math.hypot(m.human.x - p.x, m.human.z - p.z) > 120) {
        m.human.dispose();
        game.gangs.members.splice(game.gangs.members.indexOf(m), 1);
      }
    }
    const crew = crewHere();
    if (!crew || game.missions.active) return;
    const posted = game.gangs.members.filter((m) => m.tag === 'turf' && m.crew === crew.id && m.human.alive).length;
    if (posted < MAX_POSTED) postSoldier(crew);
  }

  return { update, crewHere, postSoldier };
}
