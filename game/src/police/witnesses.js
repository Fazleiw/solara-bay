// Witnesses: when Dani steals a car, fires a gun or hurts someone in public, a bystander who
// saw it pulls out a phone. If they are still standing a few seconds later the police get the
// call ("A witness called the police") and the wanted level rises; silence them or get out of
// sight first and the call never happens. Carjackings also announce VEHICLE STOLEN.

const CALL_DELAY = 3.5;

export function createWitnesses(game) {
  const pending = [];

  /** The nearest pedestrian with a clear view of (x, z), or null. */
  function findWitness(x, z, radius) {
    let best = null, bestD = radius;
    for (const h of game.humans) {
      if (h.role !== 'ped' || !h.alive) continue;
      const d = Math.hypot(h.x - x, h.z - z);
      if (d < bestD && game.world.collision.lineOfSight(h.x, h.y + 1.6, h.z, x, 1.2, z)) { best = h; bestD = d; }
    }
    return best;
  }

  function report(x, z, crime, heat) {
    if (pending.some((c) => c.crime === crime)) return;
    const witness = findWitness(x, z, 32);
    if (!witness) return;
    pending.push({ witness, crime, heat, timer: CALL_DELAY });
  }

  game.events.on('carJacked', ({ vehicle }) => {
    game.hud?.toast('VEHICLE STOLEN', vehicle.type.name, '#ff9f1c');
    report(vehicle.x, vehicle.z, 'carjack', 0.6);
  });
  game.events.on('shotFired', ({ shooter, x, z }) => { if (shooter?.role === 'player') report(x, z, 'shots', 0.8); });
  game.events.on('humanHurt', ({ human, source }) => { if (source === 'player' && human.role === 'ped') report(human.x, human.z, 'assault', 0.5); });

  function update(dt) {
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const call = pending[i];
      call.timer -= dt;
      if (!call.witness.alive) { pending.splice(i, 1); continue; }
      if (call.timer <= 0) {
        pending.splice(i, 1);
        game.wanted.crime(call.heat, 1);
        game.hud?.toast('A WITNESS CALLED THE POLICE', call.crime === 'carjack' ? 'Reported stolen vehicle' : call.crime === 'shots' ? 'Shots fired reported' : 'Assault reported', '#5aa0ff');
      }
    }
  }

  return { update, report, get pending() { return pending; } };
}
