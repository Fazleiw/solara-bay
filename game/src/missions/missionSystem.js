// The mission framework: start markers for the next story chapter, the title card, the
// mission context (stages, objectives, dialogue, waypoints with GPS, tracked targets, timers,
// spawned things that get cleaned up), and pass / fail with rewards and an autosave.
import { createMarker } from '../gameplay/markers.js';
import { CHAPTERS } from './chapters.js';

export function createMissionSystem(game) {
  const system = { active: null, startMarker: null, startBlip: null, lockedUntil: 0 };

  function makeContext(def) {
    const cleanup = [];
    const ctx = {
      game,
      def,
      data: {},
      elapsed: 0,
      ended: false,
      stageIndex: 0,
      objectiveText: '',
      objective(text) { ctx.objectiveText = text; game.hud.setObjective(text); },
      /** Moves to stage `index` of def.stages with a new objective line. */
      stage(index, text) {
        if (index !== ctx.stageIndex) game.audio?.sfx.checkpoint?.();
        ctx.stageIndex = index;
        ctx.objective(text ?? def.stages?.[index] ?? '');
      },
      say(lines) { game.dialogue.say(lines); },
      waypoint(x, z, { radius = 3.5, color = '#ffd23f', label = 'Destination', marker = true } = {}) {
        ctx.clearWaypoint();
        const m = marker ? createMarker(game, x, z, color, { radius, height: 12, label }) : null;
        const blip = { x, z, color, icon: 'dot', size: 7, edge: true, label };
        game.blips.add(blip);
        game.gps.setTarget(x, z, color);
        ctx.current = { x, z, radius, marker: m, blip };
        return ctx.current;
      },
      clearWaypoint() {
        if (!ctx.current) return;
        ctx.current.marker?.remove();
        game.blips.delete(ctx.current.blip);
        game.gps.clear();
        ctx.current = null;
      },
      atWaypoint(slowEnough = 99) {
        const w = ctx.current;
        if (!w) return false;
        const p = game.player;
        return Math.hypot(p.x - w.x, p.z - w.z) < w.radius + (p.vehicle ? 1.5 : 0) && p.speed < slowEnough;
      },
      /** A second destination beside the waypoint (a choice of drops): marker and blip, no GPS, gone at cleanup. */
      spot(x, z, { radius = 4.5, color = '#ffb347', label = 'Destination' } = {}) {
        const marker = createMarker(game, x, z, color, { radius, height: 12, label });
        const blip = { x, z, color, icon: 'dot', size: 7, edge: true, label };
        game.blips.add(blip);
        cleanup.push(() => { marker.remove(); game.blips.delete(blip); });
        return { x, z, radius };
      },
      /** Whether the player is inside a spot from ctx.spot (in a car counts a little wider), below `slowEnough` m/s. */
      atSpot(spot, slowEnough = 99) {
        const p = game.player;
        return Math.hypot(p.x - spot.x, p.z - spot.z) < spot.radius + (p.vehicle ? 1.5 : 0) && p.speed < slowEnough;
      },
      /** Shows a moving thing (car or person) on the minimap, optionally with a world marker. */
      track(entity, color = '#ff4040', label = 'Target', { marker = null } = {}) {
        const blip = { entity, color, icon: entity.type ? 'car' : 'dot', size: 7, edge: true, label };
        if (marker) blip.marker = createMarker(game, entity.x, entity.z, color, { ...marker, label });
        game.blips.add(blip);
        cleanup.push(() => ctx.untrack(blip));
        return blip;
      },
      untrack(blip) {
        if (game.blips.delete(blip)) blip.marker?.remove();
      },
      timer(seconds) { ctx.timeLeft = seconds; },
      clearTimer() { ctx.timeLeft = null; game.hud.setTimer(null); },
      vehicle(type, x, z, heading, options = {}) {
        const v = game.vehicles.spawn(type, x, z, heading, options);
        v.persistent = true;
        v.mission = def.id;
        cleanup.push(() => {
          v.persistent = false;
          v.mission = null;
        });
        return v;
      },
      onCleanup(fn) { cleanup.push(fn); },
      pass(reward, line = null) { finish(true, reward, line); },
      fail(reason) { finish(false, 0, reason); },
      runCleanup() {
        ctx.clearWaypoint();
        ctx.clearTimer();
        game.hud.setObjective(null);
        game.hud.setTargetHealth(null);
        for (const fn of cleanup.splice(0)) fn();
      },
    };
    return ctx;
  }

  function nextStory() {
    return CHAPTERS[game.state.storyProgress] ?? null;
  }

  function refreshStartMarker() {
    system.startMarker?.remove();
    if (system.startBlip) game.blips.delete(system.startBlip);
    system.startMarker = null;
    system.startBlip = null;
    const def = nextStory();
    if (!def || !def.start || system.active) return;
    const s = def.start;
    system.startMarker = createMarker(game, s.x, s.z, '#ffd23f', { radius: 2.4, height: 14, label: def.title });
    system.startBlip = { x: s.x, z: s.z, color: '#ffd23f', icon: 'letter', letter: def.giverLetter, size: 9, edge: true, label: def.title, mission: true };
    game.blips.add(system.startBlip);
  }

  function start(def) {
    if (system.active) return;
    system.startMarker?.remove();
    if (system.startBlip) game.blips.delete(system.startBlip);
    system.startMarker = null;
    const ctx = makeContext(def);
    system.active = ctx;
    game.side?.cancel(false);
    if (def.showTitleCard !== false) game.hud.titleCard(`CHAPTER ${def.chapter} · ${def.title}`, def.tagline);
    game.audio?.sfx.missionStart();
    def.begin(ctx);
    game.events.emit('missionStarted', { id: def.id });
  }

  function finish(passed, reward, line) {
    const ctx = system.active;
    if (!ctx || ctx.ended) return;
    ctx.ended = true;
    ctx.runCleanup();
    system.active = null;
    const def = ctx.def;
    if (passed) {
      game.state.storyProgress = Math.max(game.state.storyProgress, CHAPTERS.indexOf(def) + 1);
      game.state.stats.missionsPassed += 1;
      game.addCash(reward);
      game.hud.bigMessage('MISSION PASSED', `${def.title} · $${reward.toLocaleString()}`, '#ffd23f');
      game.audio?.sfx.missionPassed();
      if (line) game.dialogue.say(line);
      game.autosave();
      const next = nextStory();
      if (next && next.chained) {
        system.lockedUntil = game.clock + 4;
        setTimeout(() => { if (!system.active && game.player.human.alive) start(next); }, game.shotMode ? 0 : 3800);
      }
    } else {
      game.hud.bigMessage('MISSION FAILED', line ?? '', '#ff5050');
      game.audio?.sfx.missionFailed();
      if (def.chained) game.state.storyProgress = Math.max(0, CHAPTERS.indexOf(def) - 1);
    }
    game.events.emit('missionEnded', { id: def.id, passed, chapter: def.chapter });
    refreshStartMarker();
  }

  function update(dt) {
    for (const m of game.markers) m.update(game.clock);
    const ctx = system.active;
    if (ctx) {
      ctx.elapsed += dt;
      if (ctx.timeLeft != null) {
        ctx.timeLeft -= dt;
        game.hud.setTimer(Math.max(0, ctx.timeLeft));
        if (ctx.timeLeft <= 0) { ctx.def.onTimeout?.(ctx); if (!ctx.ended) ctx.fail('Out of time.'); return; }
      }
      ctx.def.update(ctx, dt);
      return;
    }
    // Walking or driving into the next mission's marker starts it.
    const def = nextStory();
    const p = game.player;
    if (def && system.startMarker && game.clock > system.lockedUntil && game.wanted.level === 0 && system.startMarker.contains(p.x, p.z, p.vehicle ? 1.5 : 0) && p.speed < 8) {
      start(def);
    } else if (def && system.startMarker && game.wanted.level > 0 && system.startMarker.contains(p.x, p.z, 2)) {
      game.hud.prompt('Lose the police before starting a mission');
    }
  }

  game.events.on('playerWasted', () => system.active?.fail('Wasted.'));
  game.events.on('playerBusted', () => system.active?.fail('Busted.'));

  return {
    get active() { return system.active; },
    start,
    update,
    refreshStartMarker,
    nextStory,
    startById(id) {
      const def = CHAPTERS.find((m) => m.id === id);
      if (def) start(def);
      return system.active;
    },
    chapters: CHAPTERS,
    abort() { if (system.active) finish(false, 0, 'Mission abandoned.'); },
  };
}
