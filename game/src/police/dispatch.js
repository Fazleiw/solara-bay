// Bay Police dispatch: gives every unit a call sign (MARLIN-21, HERON-07, GULL ONE...), reads
// what each one is really doing from the simulation (RAMMING, PURSUIT, ROADBLOCK, SPOTLIGHT,
// FIRING, ON FOOT, EN ROUTE, CODE 4) and keeps the roster the HUD's police-response panel
// lists, nearest first. It also voices scanner chatter when the response escalates.

const PREFIXES = ['MARLIN', 'HERON', 'TARPON', 'PELICAN', 'SNAPPER', 'OSPREY', 'BARRACUDA', 'EGRET'];

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

  // Scanner chatter on escalation.
  game.events.on('wantedRaised', ({ level }) => {
    if (game.shotMode) return;
    if (level >= 3 && chatter.lastLevel < 3) game.dialogue?.say([{ who: 'dispatch', text: 'All units, suspect vehicle heading through the city. GULL ONE is airborne.' }]);
    else if (level >= 4 && chatter.lastLevel < 4) game.dialogue?.say([{ who: 'dispatch', text: 'Roadblocks authorized. Box that car in.' }]);
    chatter.lastLevel = level;
  });
  game.events.on('wantedCleared', () => { chatter.lastLevel = 0; });

  return { callsign, roster, statusOf };
}
