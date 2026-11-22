// Bay Police dispatch: gives every unit a call sign (MARLIN-21, HERON-07, GULL ONE...), reads
// what each one is really doing from the simulation (RAMMING, PURSUIT, ROADBLOCK, SPOTLIGHT,
// FIRING, ON FOOT, EN ROUTE, CODE 4) and keeps the roster the HUD's police-response panel
// lists, nearest first. It also voices scanner chatter when the response escalates.

const PREFIXES = ['MARLIN', 'HERON', 'TARPON', 'PELICAN', 'SNAPPER', 'OSPREY', 'BARRACUDA', 'EGRET'];

function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** Nearest real roadblock that is in front of the player and on the active GPS route. */
export function findRoadblockAhead(player, blocks, route, heat) {
  if (!heat || !route?.length) return null;
  const speed = Math.hypot(player.vx ?? 0, player.vz ?? 0);
  const fx = speed > 2 ? player.vx / speed : Math.sin(player.heading ?? 0);
  const fz = speed > 2 ? player.vz / speed : Math.cos(player.heading ?? 0);
  return blocks.map((block) => {
    const dx = block.x - player.x, dz = block.z - player.z;
    const distance = Math.hypot(dx, dz);
    const ahead = distance ? (dx * fx + dz * fz) / distance : -1;
    const onRoute = route.some((point, i) => i && pointSegmentDistance(block, route[i - 1], point) < 22);
    return { block, distance, ahead, onRoute };
  }).filter((item) => item.distance < 190 && item.ahead > 0.35 && item.onRoute)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

/** Status tags with the colour the HUD shows them in. */
export const UNIT_STATUS = {
  RAMMING: { label: 'RAMMING', color: '#ff4d5e' },
  FIRING: { label: 'FIRING', color: '#ff8a3d' },
  PURSUIT: { label: 'PURSUIT', color: '#ffd23f' },
  ROADBLOCK: { label: 'ROADBLOCK', color: '#ff9f1c' },
  SPOTLIGHT: { label: 'SPOTLIGHT', color: '#e8f1ff' },
  ON_FOOT: { label: 'ON FOOT', color: '#9ad1ff' },
  EN_ROUTE: { label: 'EN ROUTE', color: '#7fb4ff' },
  CODE4: { label: 'CODE 4', color: '#8b93a7' },
};

export function createDispatch(game, force) {
  let serial = 0;
  const chatter = { lastLevel: 0, heliAnnounced: false };

  /** Assigns a fresh call sign to a new unit. */
  function callsign(kind = 'car') {
    serial += 1;
    if (kind === 'heli') return 'GULL ONE';
    const prefix = PREFIXES[(serial * 3) % PREFIXES.length];
    return `${prefix}-${String(10 + ((serial * 37) % 89)).padStart(2, '0')}`;
  }

  function statusOf(unit) {
    const car = unit.car;
    if (car.destroyed) return UNIT_STATUS.CODE4;
    if (unit.roadblock) return UNIT_STATUS.ROADBLOCK;
    const crew = force.officers.cops.filter((c) => c.unit === unit && c.human.alive);
    if (crew.some((c) => game.clock - c.brain.lastShot < 2.5)) return UNIT_STATUS.FIRING;
    if (crew.length) return UNIT_STATUS.ON_FOOT;
    if (car.ai?.kind !== 'police') return UNIT_STATUS.CODE4;
    if (unit.ramming || (unit.distance < 12 && game.clock - (unit.lastContact ?? -10) < 3)) return UNIT_STATUS.RAMMING;
    if (unit.direct || unit.distance < 45) return UNIT_STATUS.PURSUIT;
    return UNIT_STATUS.EN_ROUTE;
  }

  /**
   * The units on the player, nearest first: [{ callsign, kind, distance, status }], plus how
   * many more are out in the search zone beyond the ones listed.
   */
  function roster(limit = 5) {
    const p = game.player;
    const rows = [];
    const heli = force.helicopter.state;
    if (heli.active) {
      rows.push({ callsign: heli.callsign, kind: 'heli', distance: Math.hypot(heli.x - p.x, heli.z - p.z), status: heli.onTarget ? UNIT_STATUS.SPOTLIGHT : UNIT_STATUS.EN_ROUTE });
    }
    for (const unit of force.units) {
      rows.push({ callsign: unit.callsign, kind: unit.roadblock ? 'block' : 'car', distance: Math.hypot(unit.car.x - p.x, unit.car.z - p.z), status: statusOf(unit) });
    }
    rows.sort((a, b) => (a.status === UNIT_STATUS.CODE4) - (b.status === UNIT_STATUS.CODE4) || a.distance - b.distance);
    return { rows: rows.slice(0, limit), more: Math.max(0, rows.length - limit) + force.reserveUnits };
  }

  function roadblockAhead() {
    const p = game.player;
    const v = p.vehicle;
    return findRoadblockAhead({
      x: p.x, z: p.z, vx: v?.vx, vz: v?.vz,
      heading: v?.heading ?? game.camera.state.yaw,
    }, force.roadblocks.blocks, game.gps.state.route, game.wanted.level > 0);
  }

  // Scanner chatter on escalation.
  game.events.on('wantedRaised', ({ level }) => {
    if (game.shotMode) return;
    if (level >= 3 && chatter.lastLevel < 3) game.dialogue?.say([{ who: 'dispatch', text: 'All units, suspect vehicle heading through the city. GULL ONE is airborne.' }]);
    else if (level >= 4 && chatter.lastLevel < 4) game.dialogue?.say([{ who: 'dispatch', text: 'Roadblocks authorized. Box that car in.' }]);
    chatter.lastLevel = level;
  });
  game.events.on('wantedCleared', () => { chatter.lastLevel = 0; });

  return { callsign, roster, statusOf, roadblockAhead };
}
