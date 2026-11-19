// Respect: the street reputation Dani earns by playing. Story chapters, side jobs, carjackings,
// shaking off the police, beating rival crews and finding Sun Medallions all pay respect XP;
// six ranks unlock guns at Bayside Arms and upgrade tiers at Tavo's garage, and every rank-up
// gets its own banner.

export const RANKS = [
  { rank: 1, title: 'Fresh Out', xp: 0 },
  { rank: 2, title: 'Corner Hustler', xp: 500 },
  { rank: 3, title: 'Wheel Artist', xp: 1300 },
  { rank: 4, title: 'Street Captain', xp: 2600 },
  { rank: 5, title: 'Bay Shot-Caller', xp: 4400 },
  { rank: 6, title: 'Golden Coast Legend', xp: 7000 },
];

/** What each rank opens up, for the rank-up banner. */
export const RANK_UNLOCKS = {
  2: 'Rattler SMG at Bayside Arms · engine tune stage 2',
  3: 'Armour plating at the garage',
  4: 'Engine tune stage 3 · race brakes',
  5: 'Breaker 12 shotgun at Bayside Arms',
  6: 'Longreach AR at Bayside Arms',
};

/** XP paid for each kind of deed. */
export const XP = { chapter: 450, sideJob: 60, carjack: 15, evade: 70, rival: 30, medallion: 80, respray: 10 };

export function rankFor(xp) {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.xp) current = r;
  return current;
}

export function createRespect(game) {
  function award(amount, reason) {
    const before = rankFor(game.state.respect);
    game.state.respect += amount;
    const after = rankFor(game.state.respect);
    game.hud?.toast?.(`+${amount} RESPECT`, reason, '#ffd23f');
    if (after.rank > before.rank) {
      game.hud?.bigMessage(`RESPECT ${after.rank}`, `${after.title} · ${RANK_UNLOCKS[after.rank] ?? ''}`, '#ffd23f', 4.5);
      game.audio?.sfx.missionPassed();
      game.events.emit('rankUp', { rank: after.rank });
    }
  }

  game.events.on('missionEnded', ({ passed, chapter }) => { if (passed) award(XP.chapter + (chapter ?? 1) * 50, 'Chapter complete'); });
  game.events.on('sideJobPaid', ({ kind }) => award(XP.sideJob, kind === 'taxi' ? 'Solcab fare' : 'Taco delivered'));
  game.events.on('carJacked', () => award(XP.carjack, 'Carjacking'));
  game.events.on('wantedDropped', ({ level, from }) => { if (level === 0 && from >= 2) award(XP.evade * from, 'Lost the heat'); });
  game.events.on('medallionFound', () => award(XP.medallion, 'Sun Medallion'));
  game.events.on('humanDied', ({ human, source }) => { if (source === 'player' && human.role === 'gang') award(XP.rival, `${human.crew ?? 'Rival'} down`); });

  return {
    award,
    get xp() { return game.state.respect; },
    get rank() { return rankFor(game.state.respect).rank; },
    get title() { return rankFor(game.state.respect).title; },
    /** Progress through the current rank, 0-1, with the XP numbers for the HUD. */
    progress() {
      const xp = game.state.respect;
      const cur = rankFor(xp);
      const next = RANKS[cur.rank] ?? null;
      if (!next) return { fraction: 1, into: xp - cur.xp, span: 0, next: null };
      return { fraction: (xp - cur.xp) / (next.xp - cur.xp), into: xp - cur.xp, span: next.xp - cur.xp, next };
    },
  };
}
