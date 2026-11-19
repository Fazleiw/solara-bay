// The HUD respect bar beside the minimap: "RESPECT 4", the rank title, a gold XP bar and the
// XP still needed for the next rank (progression/respect.js).

const $ = (id) => document.getElementById(id);

export function createRespectBar(game) {
  const el = { rank: $('hud-respect-rank'), title: $('hud-respect-title'), fill: $('hud-respect-fill'), xp: $('hud-respect-xp') };
  let key = '';

  function render() {
    const r = game.respect;
    const prog = r.progress();
    const k = `${r.xp}`;
    if (k === key) return;
    key = k;
    el.rank.textContent = `RESPECT ${r.rank}`;
    el.title.textContent = r.title.toUpperCase();
    el.fill.style.width = `${Math.round(prog.fraction * 100)}%`;
    el.xp.textContent = prog.next ? `${prog.into.toLocaleString('en-US')} / ${prog.span.toLocaleString('en-US')} XP` : 'MAX RANK';
  }

  return { render };
}
