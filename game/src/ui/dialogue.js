// Dialogue cut-ins: a queue of story lines, each shown in the bottom dialogue box with the
// speaker's painted portrait (ui/portraits.js), name in their colour and role, long enough to
// read before the next line.
import { CAST } from '../missions/cast.js';
import { paintPortrait } from './portraits.js';

export function createDialogue(game, els) {
  const queue = [];
  let current = null;
  let timer = 0;

  function show(line) {
    const person = CAST[line.who] ?? CAST.dani;
    current = line;
    timer = line.duration ?? Math.max(2.6, line.text.length * 0.065);
    paintPortrait(els.portrait, person);
    els.speaker.textContent = person.name;
    els.speaker.style.color = person.color;
    els.role.textContent = person.role ?? '';
    els.line.textContent = line.text;
    els.box.style.setProperty('--accent', person.color);
    els.box.classList.remove('hidden');
  }

  return {
    say(lines) {
      for (const l of Array.isArray(lines) ? lines : [lines]) queue.push(l);
      if (!current) show(queue.shift());
    },
    update(dt) {
      if (!current) return;
      timer -= dt;
      if (timer <= 0) {
        current = null;
        if (queue.length) show(queue.shift());
        else els.box.classList.add('hidden');
      }
    },
    clear() { queue.length = 0; current = null; els.box.classList.add('hidden'); },
    get speaking() { return !!current; },
  };
}
