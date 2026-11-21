// The HUD mission card, top left: "CH 6 · GOLD COAST GETAWAY", the objective sentence, the
// countdown, the target's health (a boss, a van), STAGE 3/4 progress segments and the NEXT
// step. Between chapters it shows the running side job, or where the next chapter starts.

const $ = (id) => document.getElementById(id);
const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function createMissionCard(game) {
  const el = {
    card: $('hud-mission'), chapter: $('hud-mission-chapter'), timer: $('hud-timer'), objective: $('hud-objective'),
    segments: $('hud-stage-segments'), stageLabel: $('hud-stage-label'), next: $('hud-mission-next'),
    target: $('hud-target'), targetLabel: $('hud-target-label'), targetFill: $('hud-target-fill'),
  };
  const state = { objective: '', timer: null, segKey: '' };

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function setHtml(node, html) { if (node.innerHTML !== html) node.innerHTML = html; }

  function segments(count, current) {
    const key = `${count}:${current}`;
    if (key === state.segKey) return;
    state.segKey = key;
    el.segments.innerHTML = Array.from({ length: count }, (_, i) => `<i class="${i < current ? 'done' : i === current ? 'now' : ''}"></i>`).join('');
  }

  function render() {
    const ctx = game.missions.active;
    const side = game.side?.active;
    el.card.classList.remove('hidden');
    if (ctx) {
      const def = ctx.def;
      const stages = def.stages ?? [];
      el.card.dataset.kind = 'story';
      setText(el.chapter, `CH ${def.chapter} · ${def.title.toUpperCase()}`);
      setHtml(el.objective, esc(ctx.objectiveText || state.objective).replace(/\*(.+?)\*/g, '<em>$1</em>'));
      segments(stages.length, ctx.stageIndex);
      setText(el.stageLabel, `STAGE ${ctx.stageIndex + 1}/${stages.length}`);
      const next = stages[ctx.stageIndex + 1];
      setHtml(el.next, next ? `<b>NEXT</b> ${esc(next)}` : `<b>PAYOUT</b> $${def.reward.toLocaleString('en-US')}`);
    } else if (side && state.objective) {
      el.card.dataset.kind = 'side';
      setText(el.chapter, side.kind === 'taxi' ? `SOLCAB · FARE ${side.fares + 1}` : side.kind === 'race' ? `PROMENADE SPRINT · ${side.checkpoint}/${game.side.race.checkpoints.length}` : `COCO'S TACO RUN · ${side.drops ?? 0}/3`);
      setHtml(el.objective, esc(state.objective));
      const count = side.kind === 'taxi' ? 2 : side.kind === 'race' ? game.side.race.checkpoints.length : 3;
      const current = side.kind === 'taxi' ? (side.step === 'pickup' ? 0 : 1) : side.kind === 'race' ? side.checkpoint : side.drops ?? 0;
      segments(count, current);
      setText(el.stageLabel, side.kind === 'taxi' ? (side.step === 'pickup' ? 'PICK UP' : 'DROP OFF') : side.kind === 'race' ? 'CHECKPOINTS' : 'DELIVERIES');
      setHtml(el.next, side.kind === 'race' ? `<b>PAYOUT</b> $${game.side.race.reward.toLocaleString('en-US')}` : `<b>EARNED</b> $${(side.earned ?? 0).toLocaleString('en-US')}`);
    } else {
      const def = game.missions.nextStory();
      if (!def) { el.card.classList.add('hidden'); return; }
      el.card.dataset.kind = 'idle';
      setText(el.chapter, `CH ${def.chapter} · ${def.title.toUpperCase()}`);
      setHtml(el.objective, def.start ? `Meet <em>${def.giverLetter === 'C' ? 'Auntie Coco' : 'Tavo'}</em> at the ${def.giverLetter} marker to start` : 'Coming up next');
      segments(def.stages?.length ?? 1, -1);
      setText(el.stageLabel, `${def.stages?.length ?? 1} STAGES`);
      setHtml(el.next, `<b>FREE ROAM</b> side jobs, shops, Sun Medallions`);
    }
    el.timer.classList.toggle('hidden', state.timer == null);
    if (state.timer != null) {
      const m = Math.floor(state.timer / 60), s = Math.floor(state.timer % 60);
      setText(el.timer, `${m}:${String(s).padStart(2, '0')}`);
      el.timer.classList.toggle('low', state.timer < 10);
    }
  }

  return {
    render,
    setObjective(text) { state.objective = text ?? ''; },
    setTimer(seconds) { state.timer = seconds; },
    setTargetHealth(fraction, label = '') {
      el.target.classList.toggle('hidden', fraction == null);
      if (fraction == null) return;
      setText(el.targetLabel, label.toUpperCase());
      el.targetFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    },
  };
}
