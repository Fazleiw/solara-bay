// The Marisol Savings & Loan job, run inside the real game loop (main.js simulate). A gold $
// marker across Solstice St from the bank opens the heist board; E there starts the job at night:
//   1 GET IN        cross to the vault door before the silent alarm reaches the Bay Police
//   2 DRILL         Juno's drill: hold E to lean on it, keep the heat meter green, Z cools it
//   3 GRAB THE LOOT four bags on the sidewalk; each one Dani takes is strapped to Dani's back
//   4 THE ALARM     the existing Bay Police respond at three stars, four with most of the vault
//   5 GETAWAY       Tavo's car at the curb, then Tavo's garage with the heat on
//   6 PAYOUT        the crew's cuts and a gold / silver / bronze medal (ui/payoutScreen.js)
// Crew abilities on Z / X / C (heists/heistRules.js): Juno cools the drill or jams the alarm
// line, Tavo calls in a decoy (one star less), Coco patches Dani up.
import { Human } from '../characters/human.js';
import { createMarker } from '../gameplay/markers.js';
import { LANDMARKS } from '../world/cityLayout.js';
import { BANK, buildBankFront } from './bankFront.js';
import { dropBag, strapBags } from './lootBags.js';
import {
  CREW, PHASES, PHASE_LABELS, VAULT_BAGS,
  alarmStars, freshHeist, grabBag, heatBand, payout, stepAlarm, stepDrill, useAbility,
} from './heistRules.js';

export const JUNO_LOOK = { skin: '#8d5524', hair: '#2a1a12', hairStyle: 1, shirt: '#e85d04', sleeves: '#1d1d2b', pants: '#1d1d2b', shoes: '#111111', vest: '#2b2b38', height: 0.96 };

const OBJECTIVES = {
  getIn: 'Cross Solstice St to the *vault door* before the silent alarm',
  drill: 'Hold *E* to drill · keep the heat in the *green* · *Z* cools',
  loot: 'Grab the *loot bags* · walk over them',
  alarm: "Get the bags to *Tavo's car* at the curb",
  escape: "Lose the heat at *Tavo's garage*",
};

export function createHeists(game) {
  const drop = { x: LANDMARKS.tavoGarage.x, z: LANDMARKS.tavoGarage.z - 13 };
  const sys = {
    active: null,
    front: null,
    board: null,
    payoutScreen: null,
    get loot() { return sys.active ? sys.active.h.loot : 0; },
  };
  let startMarker = null;
  let startBlip = null;

  function ensureWorld() {
    if (!sys.front) sys.front = buildBankFront(game.scene);
    if (!startMarker) {
      startMarker = createMarker(game, BANK.meet.x, BANK.meet.z, '#ffd23f', { radius: 2.4, height: 12, label: 'Marisol Savings & Loan' });
      startBlip = { x: BANK.meet.x, z: BANK.meet.z, color: '#ffd23f', icon: 'letter', letter: '$', size: 7, edge: false, label: 'Heist: Marisol Savings & Loan' };
      game.blips.add(startBlip);
    }
  }

  function record() {
    game.state.heists ??= { marisol: { runs: 0, best: 0, medal: null }, career: { take: 0, bags: 0, jobs: 0 } };
    return game.state.heists;
  }

  function waypoint(run, x, z, color, label, radius = 2) {
    clearWaypoint(run);
    run.marker = createMarker(game, x, z, color, { radius, height: 10, label });
    run.blip = { x, z, color, icon: 'dot', size: 7, edge: true, label };
    game.blips.add(run.blip);
    game.gps.setTarget(x, z, color);
    run.target = { x, z, radius };
  }

  function clearWaypoint(run) {
    run.marker?.remove();
    if (run.blip) game.blips.delete(run.blip);
    game.gps.clear();
    run.marker = run.blip = run.target = null;
  }

  const near = (x, z, r) => Math.hypot(game.player.x - x, game.player.z - z) < r;

  function setPhase(run, phase) {
    run.h.phase = phase;
    game.hud.toast(`HEIST · ${PHASE_LABELS[phase]}`, `${PHASES.indexOf(phase) + 1} of ${PHASES.length}`, '#ffd23f', 2.6);
  }

  /** Starts the job: night falls on Deco Row, Juno meets Dani at the marker. */
  function start() {
    if (sys.active || game.missions.active) return false;
    ensureWorld();
    const dn = game.world.dayNight;
    if (dn.state.hour > 5 && dn.state.hour < 21) dn.setHour(22.5);
    const p = game.player;
    const juno = new Human(game, { x: p.x + 1.4, z: p.z - 0.8, heading: Math.PI, look: JUNO_LOOK, role: 'crew', health: 600, armor: 100 });
    const run = { h: freshHeist(), juno, ground: [], car: null, unstrap: null, unstrapJuno: null, marker: null, blip: null, target: null, opened: 0 };
    sys.active = run;
    record().marisol.runs += 1;
    sys.board?.close();
    waypoint(run, BANK.door.x, BANK.door.z, '#3ef2ff', 'Vault door', 1.6);
    setPhase(run, 'getIn');
    game.dialogue.say([
      { who: 'juno', text: "Marisol Savings & Loan. The silent alarm trips in two minutes whether we're in or not." },
      { who: 'juno', text: "Get me to that vault door. Z if you need me, X for Tavo's decoy, C for Coco." },
    ]);
    return true;
  }

  function fail(reason) {
    const run = sys.active;
    if (!run) return;
    end(run);
    game.hud.bigMessage('HEIST FAILED', reason, '#ff4040', 3.5);
  }

  function end(run) {
    clearWaypoint(run);
    for (const b of run.ground) b.remove();
    run.unstrap?.();
    run.unstrapJuno?.();
    run.juno.dispose();
    if (run.car) run.car.persistent = false;
    if (sys.front) sys.front.drill.visible = false;
    sys.active = null;
  }

  function finish(run) {
    const result = payout(run.h);
    const rec = record();
    rec.marisol.best = Math.max(rec.marisol.best, result.take);
    const rank = { gold: 3, silver: 2, bronze: 1 };
    if (!rec.marisol.medal || rank[result.medal] > rank[rec.marisol.medal]) rec.marisol.medal = result.medal;
    rec.career.take += result.take;
    rec.career.bags += run.h.bags.length;
    rec.career.jobs += 1;
    game.wanted.clear();
    game.police.reset();
    game.addCash(result.dani);
    game.respect?.award?.(result.medal === 'gold' ? 900 : result.medal === 'silver' ? 600 : 350, 'Marisol Savings & Loan');
    setPhase(run, 'payout');
    end(run);
    sys.payoutScreen?.show(result, run.h);
    game.autosave?.();
  }

  /** Raises the alarm: the existing Bay Police take it from here. */
  function soundAlarm(run, early) {
    if (run.alarmed) return;
    run.alarmed = true;
    run.h.alarmTripped ||= early;
    game.wanted.setLevel(Math.max(game.wanted.level, alarmStars(run.h)));
    game.dialogue.say([{ who: 'dispatch', text: 'Two-eleven in progress, Marisol Savings & Loan, Solstice St. All units.' }]);
  }

  function spawnBags(run) {
    VAULT_BAGS.forEach((value, i) => {
      const x = BANK.door.x - 2.2 + i * 1.5, z = BANK.door.z + 1.3 + (i % 2) * 0.6;
      run.ground.push(dropBag(game.scene, x, z, value, game.world.textures.glow));
    });
  }

  function abilities(run) {
    const input = game.input;
    if (!input) return;
    for (const [action, id] of [['crew1', 'juno'], ['crew2', 'tavo'], ['crew3', 'coco']]) {
      if (!input.pressed(action)) continue;
      const member = CREW.find((c) => c.id === id);
      if (!useAbility(run.h, id)) { game.hud.toast(`${member.name.toUpperCase()} · ${Math.ceil(run.h.cooldowns[id])}s`, 'Still on cooldown', '#8a8fa8', 1.4); continue; }
      if (id === 'juno' && run.h.phase !== 'drill' && !run.h.alarmTripped) run.h.alarm += 12;
      if (id === 'tavo' && game.wanted.level > 1) game.wanted.setLevel(game.wanted.level - 1);
      if (id === 'coco') {
        const hu = game.player.human;
        hu.health = Math.min(hu.maxHealth, hu.health + 35);
        hu.armor = Math.min(100, hu.armor + 30);
      }
      game.hud.toast(`${member.key} · ${member.ability}`, member.name, '#3ef2ff', 1.8);
    }
  }

  /** Juno keeps at Dani's shoulder on foot and rides along once they are in the car. */
  function followJuno(run, dt, spot = null) {
    const j = run.juno;
    const p = game.player;
    j.model.group.visible = !p.vehicle;
    if (p.vehicle) { j.x = p.x; j.z = p.z; return; }
    const tx = spot ? spot.x : p.x - Math.sin(p.human.heading) * 1.6 + 1.1, tz = spot ? spot.z : p.z - Math.cos(p.human.heading) * 1.6;
    const dx = tx - j.x, dz = tz - j.z, d = Math.hypot(dx, dz);
    if (d > 0.6) j.move(dx / d, dz / d, d > 6 ? 6.5 : 4);
    else j.move(0, 0, 0);
    j.physics(dt);
    j.syncMesh(dt);
  }

  function update(dt) {
    if (!sys.front && !game.shotMode) ensureWorld();
    const run = sys.active;
    const p = game.player;
    if (!run) {
      const atMeet = startMarker && !game.missions.active && !p.vehicle && near(BANK.meet.x, BANK.meet.z, 3);
      if (sys.board?.isOpen) {
        if (!atMeet && !game.shotMode) sys.board.close();
        else if (game.input?.pressed('interact')) start();
      } else if (atMeet) {
        game.hud.prompt('E to open the heist board · Marisol Savings & Loan');
        if (game.input?.pressed('interact')) sys.board ? sys.board.open() : start();
      }
      return;
    }
    if (!p.human.alive) { fail('Dani went down'); return; }
    const h = run.h;
    abilities(run);
    if (stepAlarm(h, dt) && h.phase !== 'escape') soundAlarm(run, true);
    const front = sys.front;
    switch (h.phase) {
      case 'getIn':
        followJuno(run, dt);
        if (near(BANK.door.x, BANK.door.z, 1.8)) {
          setPhase(run, 'drill');
          clearWaypoint(run);
          front.drill.visible = true;
          game.dialogue.say([{ who: 'juno', text: "Drill's on. Lean on it with E, but if it glows red the bit jams. Z and I'll cool it." }]);
        }
        break;
      case 'drill': {
        followJuno(run, dt, { x: BANK.door.x + 1.4, z: BANK.door.z - 0.2 });
        const push = !!game.input?.down('interact') && near(BANK.door.x, BANK.door.z, 3.5);
        if (stepDrill(h, dt, push)) {
          front.drill.visible = false;
          setPhase(run, 'loot');
          spawnBags(run);
          game.dialogue.say([{ who: 'juno', text: 'We are IN. Four bags. Grab them and do not get greedy with the clock.' }]);
        }
        front.spin(dt);
        front.setHeat(h.heat);
        if (!h.jammed && Math.random() < 0.6) { const tip = front.bitTip(); game.effects.sparks(tip.x, tip.y, tip.z, push ? 5 : 2); }
        if (h.jammed && Math.random() < 0.3) { const tip = front.bitTip(); game.effects.smoke(tip.x, tip.y, tip.z, 0.3); }
        break;
      }
      case 'loot': {
        run.opened = Math.min(1, run.opened + dt * 0.8);
        front.setOpen(run.opened);
        followJuno(run, dt, { x: BANK.door.x + 1.6, z: BANK.door.z + 0.6 });
        for (const bag of [...run.ground]) {
          if (!near(bag.x, bag.z, 1.1)) continue;
          grabBag(h, bag.value);
          bag.remove();
          run.ground.splice(run.ground.indexOf(bag), 1);
          game.audio?.sfx.pickup(true);
          run.unstrap?.();
          run.unstrap = strapBags(p.human, Math.ceil(h.bags.length / 2));
          run.unstrapJuno?.();
          run.unstrapJuno = h.bags.length > 1 ? strapBags(run.juno, Math.floor(h.bags.length / 2)) : null;
          game.hud.toast(`LOOT +$${bag.value.toLocaleString('en-US')}`, `${h.bags.length}/${VAULT_BAGS.length} bags`, '#ffd23f', 1.8);
        }
        const walkedOff = h.bags.length > 0 && !near(BANK.door.x, BANK.door.z, 9);
        if (run.ground.length === 0 || walkedOff) {
          for (const b of run.ground) b.remove();
          run.ground = [];
          setPhase(run, 'alarm');
          run.alarmed = false;
          soundAlarm(run, false);
          game.wanted.setLevel(Math.max(game.wanted.level, alarmStars(h)));
          run.car = game.vehicles.spawn('vantor', BANK.curb.x, BANK.curb.z, -Math.PI / 2, { color: '#12c8e0' });
          run.car.persistent = true;
          waypoint(run, run.car.x, run.car.z, '#3ef2ff', "Tavo's car", 3);
          game.dialogue.say([{ who: 'tavo', text: "Car's at the curb, engine running. Bags in the back, go go go!" }]);
        }
        break;
      }
      case 'alarm':
        followJuno(run, dt);
        if (p.vehicle === run.car) {
          setPhase(run, 'escape');
          waypoint(run, drop.x, drop.z, '#3ef2ff', "Tavo's garage", 4.5);
        }
        break;
      case 'escape':
        followJuno(run, dt);
        if (run.target && near(drop.x, drop.z, run.target.radius + 1.5) && p.speed < 6) finish(run);
        break;
      default:
        break;
    }
  }

  /** What the HUD mission card shows while a job runs. */
  function card() {
    const run = sys.active;
    if (!run) return null;
    const h = run.h;
    const index = PHASES.indexOf(h.phase);
    return {
      title: 'HEIST · MARISOL SAVINGS & LOAN',
      objective: OBJECTIVES[h.phase] ?? '',
      stage: index,
      stages: PHASES.length,
      next: PHASE_LABELS[PHASES[index + 1]] ?? 'PAYOUT',
      timer: h.alarmTripped || h.phase === 'escape' || h.phase === 'alarm' ? null : h.alarm,
    };
  }

  game.events.on('playerBustedFinal', () => fail('Busted outside the bank'));

  return Object.assign(sys, { start, update, card, fail, ensureWorld, heatBand, setPhase, spawnBags, soundAlarm, waypoint, strap: strapBags });
}
