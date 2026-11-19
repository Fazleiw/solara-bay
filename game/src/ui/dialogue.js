// Dialogue cut-ins: a queue of subtitle lines, each with the speaker's name in their colour
// and a painted portrait, shown long enough to read and then the next.
import { CAST } from '../missions/cast.js';

/** Paints a character portrait on a square canvas. */
export function paintPortrait(canvas, person) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  const bg = ctx.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, person.accent); bg.addColorStop(1, '#14102a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s);
  // Shoulders.
  ctx.fillStyle = person.accent;
  ctx.beginPath(); ctx.ellipse(s / 2, s * 1.02, s * 0.42, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(s / 2, s * 1.02, s * 0.42, s * 0.3, 0, Math.PI, Math.PI * 2); ctx.fill();
  // Neck and face.
  ctx.fillStyle = person.skin;
  ctx.fillRect(s * 0.43, s * 0.6, s * 0.14, s * 0.16);
  ctx.beginPath(); ctx.ellipse(s / 2, s * 0.47, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  // Hair.
  ctx.fillStyle = person.hair;
  ctx.beginPath(); ctx.ellipse(s / 2, s * 0.34, s * 0.22, s * 0.14, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(s * 0.28, s * 0.3, s * 0.06, s * 0.16);
  ctx.fillRect(s * 0.66, s * 0.3, s * 0.06, s * 0.16);
  if (person.cap) {
    ctx.fillStyle = person.accent;
    ctx.beginPath(); ctx.ellipse(s / 2, s * 0.3, s * 0.23, s * 0.12, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(s * 0.5, s * 0.28, s * 0.28, s * 0.04);
  }
  // Eyes or shades, mouth.
  if (person.shades) {
    ctx.fillStyle = '#111';
    ctx.fillRect(s * 0.33, s * 0.43, s * 0.14, s * 0.07);
    ctx.fillRect(s * 0.53, s * 0.43, s * 0.14, s * 0.07);
    ctx.fillRect(s * 0.47, s * 0.45, s * 0.06, s * 0.02);
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(s * 0.42, s * 0.46, s * 0.022, 0, Math.PI * 2); ctx.arc(s * 0.58, s * 0.46, s * 0.022, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(80,30,30,0.8)'; ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.arc(s / 2, s * 0.56, s * 0.06, 0.2, Math.PI - 0.2); ctx.stroke();
  if (person.scar) { ctx.strokeStyle = '#b05050'; ctx.beginPath(); ctx.moveTo(s * 0.58, s * 0.38); ctx.lineTo(s * 0.64, s * 0.55); ctx.stroke(); }
  if (person.earrings) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(s * 0.3, s * 0.54, s * 0.025, 0, Math.PI * 2); ctx.arc(s * 0.7, s * 0.54, s * 0.025, 0, Math.PI * 2); ctx.fill(); }
}

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
    els.line.textContent = line.text;
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
