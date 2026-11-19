// Side activities between story missions:
//   Solcab fares: in any Solcab taxi press T, pick up the waiting fare, drop them off before
//   the meter runs out, and keep the chain going for growing tips.
//   Coco's Taco Run: at the taco shack press E and deliver three orders around the city
//   against one clock.
import { rng } from '../core/random.js';
import { createMarker } from '../gameplay/markers.js';
import { LANDMARKS } from '../world/cityLayout.js';

export function createSideJobs(game) {
  const net = game.world.network;
  const tacoMarker = createMarker(game, LANDMARKS.cocoShack.x + 6, LANDMARKS.cocoShack.z + 9, '#ff9a3c', { radius: 1.5, height: 4, label: "Coco's Taco Run" });
  const tacoBlip = { x: tacoMarker.x, z: tacoMarker.z, color: '#ff9a3c', icon: 'letter', letter: '$', size: 7, edge: false, label: 'Taco Run' };
  game.blips.add(tacoBlip);
  let job = null;

  function setTarget(x, z, color, label, radius = 4) {
    job.marker?.remove();
    if (job.blip) game.blips.delete(job.blip);
    job.marker = createMarker(game, x, z, color, { radius, height: 10, label });
    job.blip = { x, z, color, icon: 'dot', size: 7, edge: true, label };
    game.blips.add(job.blip);
    game.gps.setTarget(x, z, color);
    job.tx = x; job.tz = z; job.radius = radius;
  }

  function randomStreetPoint(minD, maxD) {
    const p = game.player;
    for (let i = 0; i < 30; i += 1) {
      const edge = rng.pick(net.edges);
      const a = net.node(edge.a), b = net.node(edge.b);
      const pt = net.lanePoint(a, b, rng.range(12, edge.length - 12), { x: 0, z: 0 });
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d > minD && d < maxD && !edge.bridge) return pt;
    }
    return { x: p.x + 100, z: p.z };
  }

  function cancel(announce = true) {
    if (!job) return;
    job.marker?.remove();
    if (job.blip) game.blips.delete(job.blip);
    if (job.farePed) game.peds.remove(job.farePed);
    game.gps.clear();
    game.hud.setObjective(null);
    game.hud.setTimer(null);
    if (announce) game.hud.bigMessage(job.kind === 'taxi' ? 'SHIFT OVER' : 'TACO RUN FAILED', job.earned ? `Earned $${job.earned.toLocaleString()}` : '', '#ffd23f');
    job = null;
  }

  function startTaxi() {
    job = { kind: 'taxi', step: 'pickup', fares: 0, earned: 0, time: 0 };
    nextFare();
    game.hud.bigMessage('SOLCAB', 'Fares on the clock · press T to clock off', '#ffc72c');
  }

  function nextFare() {
    const pt = randomStreetPoint(90, 260);
    const kerbX = pt.x, kerbZ = pt.z;
    job.step = 'pickup';
    const ped = game.peds.spawnAt(kerbX, kerbZ, { bi: 0, bj: 0, state: 'idle' });
    ped.state = 'hail';
    ped.keep = true;
    job.fare = ped.human;
    job.farePed = ped;
    setTarget(kerbX, kerbZ, '#5cc8ff', 'Fare', 5);
    game.hud.setObjective('Pick up the waiting fare');
    job.time = 60;
  }

  function startTacoRun() {
    job = { kind: 'taco', step: 'deliver', drops: 0, earned: 0, time: 110 };
    const pt = randomStreetPoint(120, 330);
    setTarget(pt.x, pt.z, '#ff9a3c', 'Taco order', 4);
    game.hud.setObjective('Deliver tacos: order 1 / 3');
    game.hud.bigMessage("COCO'S TACO RUN", 'Three orders, one clock', '#ff9a3c');
  }

  function update(dt, input) {
    const p = game.player;
    const story = game.missions.active;
    tacoMarker.setVisible(!job && !story);
    if (!job) {
      if (story) return null;
      if (p.vehicle?.type.taxi && input.pressed('job')) { startTaxi(); return null; }
      if (tacoMarker.contains(p.x, p.z, p.vehicle ? 1.5 : 0.3)) {
        if (input.pressed('interact')) startTacoRun();
        return "Press E to start Coco's Taco Run";
      }
      if (p.vehicle?.type.taxi) return 'Press T to take Solcab fares';
      return null;
    }
    job.time -= dt;
    game.hud.setTimer(Math.max(0, job.time));
    if (job.time <= 0 || !p.human.alive) { cancel(); return null; }
    const near = Math.hypot(p.x - job.tx, p.z - job.tz) < job.radius + 2;
    if (job.kind === 'taxi') {
      if (!p.vehicle || !p.vehicle.type.taxi || input.pressed('job')) { cancel(); return null; }
      if (job.step === 'pickup') {
        if (job.fare) job.fare.faceToward(p.x - job.fare.x, p.z - job.fare.z, dt);
        if (near && p.vehicle.speed < 2) {
          game.peds.remove(job.farePed);
          job.fare = null;
          job.farePed = null;
          job.step = 'dropoff';
          const dest = randomStreetPoint(200, 520);
          job.distance = Math.hypot(dest.x - p.x, dest.z - p.z);
          job.time = 25 + job.distance / 9;
          setTarget(dest.x, dest.z, '#5cc8ff', 'Drop-off', 5);
          game.hud.setObjective('Take the fare to the destination');
          game.audio?.sfx.door();
        }
      } else if (near && p.vehicle.speed < 3) {
        const fare = Math.round(40 + job.distance * 0.35 + job.time * 3 + job.fares * 15);
        job.fares += 1;
        job.earned += fare;
        game.state.stats.taxiFares += 1;
        game.addCash(fare);
        game.hud.notify(`Fare paid $${fare} · ${job.fares} in a row`);
        nextFare();
      }
      return null;
    }
    // Taco run.
    if (near && p.speed < 6) {
      job.drops += 1;
      const pay = 120 + Math.round(job.time);
      job.earned += pay;
      game.addCash(pay);
      game.audio?.sfx.pickup(true);
      if (job.drops >= 3) {
        game.state.stats.tacoRuns += 1;
        const bonus = 300;
        game.addCash(bonus);
        job.earned += bonus;
        const earned = job.earned;
        job.marker?.remove();
        if (job.blip) game.blips.delete(job.blip);
        game.gps.clear();
        game.hud.setObjective(null);
        game.hud.setTimer(null);
        job = null;
        game.hud.bigMessage('TACO RUN COMPLETE', `Earned $${earned.toLocaleString()}`, '#ff9a3c');
        game.autosave();
        return null;
      }
      const pt = randomStreetPoint(120, 330);
      job.time += 25;
      setTarget(pt.x, pt.z, '#ff9a3c', 'Taco order', 4);
      game.hud.setObjective(`Deliver tacos: order ${job.drops + 1} / 3`);
    }
    return null;
  }

  return { update, cancel, get active() { return job; } };
}
