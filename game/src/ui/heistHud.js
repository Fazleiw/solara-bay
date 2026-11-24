// The heist strip beside the mission card while a job runs: the phase track, Juno's drill
// meter (progress plus a heat bar banded green / amber / red, JAMMED in the red) and the crew's
// Z / X / C ability slots with portraits-in-miniature and their cooldowns.
import { CREW, DRILL, PHASES, PHASE_LABELS, heatBand } from '../heists/heistRules.js';

export function createHeistHud(game, root) {
  const el = document.createElement('section');
  el.id = 'hud-heist';
  el.className = 'hidden';
  el.innerHTML = `
    <div class="heist-phases"></div>
    <div class="heist-drill hidden">
      <div class="drill-head"><b>VAULT DRILL</b><span class="drill-pct">0%</span></div>
      <div class="drill-progress"><i></i></div>
      <div class="drill-heat"><i></i><u style="left:${DRILL.green}%"></u><u style="left:${DRILL.red}%"></u></div>
      <div class="drill-tag">HEAT · GREEN</div>
    </div>
    <div class="heist-crew">${CREW.map((c) => `<div class="crew-slot" data-id="${c.id}"><kbd>${c.key}</kbd><div><b>${c.name.split(' ')[c.id === 'coco' ? 1 : 0].toUpperCase()}</b><small>${c.ability}</small></div><em></em></div>`).join('')}</div>`;
  root.appendChild(el);
  const phases = el.querySelector('.heist-phases');
  const drill = el.querySelector('.heist-drill');
  const pct = el.querySelector('.drill-pct');
  const progress = el.querySelector('.drill-progress i');
  const heat = el.querySelector('.drill-heat i');
  const tag = el.querySelector('.drill-tag');
  const slots = Object.fromEntries([...el.querySelectorAll('.crew-slot')].map((s) => [s.dataset.id, s]));
  let lastPhase = '';

  function render() {
    const run = game.heists?.active;
    el.classList.toggle('hidden', !run);
    if (!run) return;
    const h = run.h;
    if (h.phase !== lastPhase) {
      lastPhase = h.phase;
      const index = PHASES.indexOf(h.phase);
      phases.innerHTML = PHASES.map((p, i) => `<span class="${i < index ? 'done' : i === index ? 'now' : ''}">${i + 1} ${PHASE_LABELS[p]}</span>`).join('');
    }
    drill.classList.toggle('hidden', h.phase !== 'drill');
    if (h.phase === 'drill') {
      const band = heatBand(h.heat);
      pct.textContent = `${Math.floor(h.drill)}%`;
      progress.style.width = `${h.drill}%`;
      heat.style.width = `${h.heat}%`;
      heat.dataset.band = band;
      tag.dataset.band = h.jammed ? 'red' : band;
      tag.textContent = h.jammed ? 'JAMMED · LET IT COOL · Z' : `HEAT · ${band.toUpperCase()}${band === 'green' ? '' : ' · EASE OFF E'}`;
    }
    for (const c of CREW) {
      const cd = h.cooldowns[c.id];
      slots[c.id].classList.toggle('cooling', cd > 0);
      slots[c.id].querySelector('em').textContent = cd > 0 ? `${Math.ceil(cd)}s` : 'READY';
    }
  }

  return { render };
}
