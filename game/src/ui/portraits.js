// Character portraits painted on a canvas from each cast member's features (missions/cast.js):
// a sunset backdrop in their accent colour, shoulders and collar, a shaded face with jaw, ears,
// nose and brows, hair styles (short, long, bun, cap), shades or eyes, scars and earrings,
// and a warm rim light. Used by the dialogue box and the pause menu's cast page.

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function paintPortrait(canvas, person) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  const u = (v) => v * s;
  ctx.save();
  ctx.clearRect(0, 0, s, s);
  // Backdrop: accent sky fading into a dusk band, with a low sun behind the head.
  const bg = ctx.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, shade(person.accent, -0.25));
  bg.addColorStop(0.55, person.accent);
  bg.addColorStop(1, '#1a1030');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);
  const sun = ctx.createRadialGradient(u(0.68), u(0.42), 0, u(0.68), u(0.42), u(0.5));
  sun.addColorStop(0, 'rgba(255,220,150,0.65)');
  sun.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 4; i += 1) { ctx.fillStyle = `rgba(20,10,40,${0.08 + i * 0.04})`; ctx.fillRect(0, u(0.62 + i * 0.05), s, u(0.02)); }

  // Shoulders and jacket with a collar.
  const jacket = shade(person.accent, -0.3);
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(u(0.08), s); ctx.quadraticCurveTo(u(0.12), u(0.76), u(0.36), u(0.72));
  ctx.lineTo(u(0.64), u(0.72)); ctx.quadraticCurveTo(u(0.88), u(0.76), u(0.92), s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(person.accent, 0.1);
  ctx.beginPath(); ctx.moveTo(u(0.38), u(0.72)); ctx.lineTo(u(0.5), u(0.92)); ctx.lineTo(u(0.62), u(0.72)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2efe8';
  ctx.beginPath(); ctx.moveTo(u(0.43), u(0.72)); ctx.lineTo(u(0.5), u(0.84)); ctx.lineTo(u(0.57), u(0.72)); ctx.closePath(); ctx.fill();

  // Neck, ears and face, shaded from the left.
  const skin = person.skin;
  ctx.fillStyle = shade(skin, -0.12);
  ctx.fillRect(u(0.43), u(0.58), u(0.14), u(0.16));
  ctx.fillStyle = shade(skin, -0.05);
  for (const x of [0.3, 0.7]) { ctx.beginPath(); ctx.ellipse(u(x), u(0.47), u(0.035), u(0.06), 0, 0, Math.PI * 2); ctx.fill(); }
  const face = ctx.createLinearGradient(u(0.3), 0, u(0.7), 0);
  face.addColorStop(0, shade(skin, -0.1)); face.addColorStop(0.55, skin); face.addColorStop(1, shade(skin, 0.08));
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.moveTo(u(0.31), u(0.4));
  ctx.quadraticCurveTo(u(0.31), u(0.24), u(0.5), u(0.23));
  ctx.quadraticCurveTo(u(0.69), u(0.24), u(0.69), u(0.4));
  ctx.quadraticCurveTo(u(0.69), u(0.58), u(0.5), u(0.65));
  ctx.quadraticCurveTo(u(0.31), u(0.58), u(0.31), u(0.4));
  ctx.fill();

  // Hair: a long fall behind the shoulders, a bun, or a short crop; then the cap.
  ctx.fillStyle = person.hair;
  if (person.bun) { ctx.beginPath(); ctx.arc(u(0.5), u(0.16), u(0.09), 0, Math.PI * 2); ctx.fill(); }
  if (person.earrings && !person.bun && !person.cap) {
    ctx.beginPath(); ctx.moveTo(u(0.29), u(0.3)); ctx.quadraticCurveTo(u(0.22), u(0.6), u(0.28), u(0.74)); ctx.lineTo(u(0.34), u(0.5)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(u(0.71), u(0.3)); ctx.quadraticCurveTo(u(0.78), u(0.6), u(0.72), u(0.74)); ctx.lineTo(u(0.66), u(0.5)); ctx.closePath(); ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(u(0.29), u(0.4));
  ctx.quadraticCurveTo(u(0.27), u(0.18), u(0.5), u(0.17));
  ctx.quadraticCurveTo(u(0.73), u(0.18), u(0.71), u(0.4));
  ctx.quadraticCurveTo(u(0.62), u(0.27), u(0.42), u(0.3));
  ctx.quadraticCurveTo(u(0.34), u(0.31), u(0.29), u(0.4));
  ctx.fill();
  if (person.cap) {
    ctx.fillStyle = person.accent;
    ctx.beginPath(); ctx.ellipse(u(0.5), u(0.25), u(0.215), u(0.11), 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(person.accent, -0.25);
    ctx.beginPath(); ctx.ellipse(u(0.58), u(0.26), u(0.2), u(0.04), -0.08, 0, Math.PI * 2); ctx.fill();
  }

  // Brows, eyes or shades, nose, mouth.
  ctx.strokeStyle = shade(person.hair, -0.1); ctx.lineWidth = u(0.022); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(u(0.37), u(0.385)); ctx.lineTo(u(0.46), u(0.375)); ctx.moveTo(u(0.54), u(0.375)); ctx.lineTo(u(0.63), u(0.385)); ctx.stroke();
  if (person.shades) {
    const lens = ctx.createLinearGradient(0, u(0.41), 0, u(0.48));
    lens.addColorStop(0, '#2a1840'); lens.addColorStop(1, '#ff7a59');
    ctx.fillStyle = lens;
    ctx.beginPath(); ctx.roundRect(u(0.34), u(0.41), u(0.14), u(0.075), u(0.02)); ctx.roundRect(u(0.52), u(0.41), u(0.14), u(0.075), u(0.02)); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(u(0.48), u(0.425), u(0.04), u(0.015));
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(u(0.36), u(0.42), u(0.04), u(0.012)); ctx.fillRect(u(0.54), u(0.42), u(0.04), u(0.012));
  } else {
    for (const x of [0.41, 0.59]) {
      ctx.fillStyle = '#fbf7f0'; ctx.beginPath(); ctx.ellipse(u(x), u(0.44), u(0.035), u(0.02), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(u(x + 0.005), u(0.44), u(0.016), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.strokeStyle = shade(skin, -0.22); ctx.lineWidth = u(0.016);
  ctx.beginPath(); ctx.moveTo(u(0.5), u(0.45)); ctx.lineTo(u(0.48), u(0.52)); ctx.lineTo(u(0.515), u(0.525)); ctx.stroke();
  ctx.strokeStyle = shade(skin, -0.32); ctx.lineWidth = u(0.02);
  ctx.beginPath(); ctx.moveTo(u(0.44), u(0.575)); ctx.quadraticCurveTo(u(0.5), u(0.6), u(0.57), u(0.57)); ctx.stroke();
  if (person.scar) { ctx.strokeStyle = '#9a3d3d'; ctx.lineWidth = u(0.014); ctx.beginPath(); ctx.moveTo(u(0.6), u(0.36)); ctx.lineTo(u(0.65), u(0.55)); ctx.stroke(); }
  if (person.earrings) { ctx.fillStyle = '#ffd23f'; for (const x of [0.3, 0.7]) { ctx.beginPath(); ctx.arc(u(x), u(0.54), u(0.022), 0, Math.PI * 2); ctx.fill(); } }

  // Warm rim light down the right side of the face.
  const rim = ctx.createLinearGradient(u(0.6), 0, u(0.72), 0);
  rim.addColorStop(0, 'rgba(255,200,120,0)'); rim.addColorStop(1, 'rgba(255,200,120,0.35)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rim;
  ctx.fillRect(u(0.6), u(0.2), u(0.14), u(0.5));
  ctx.restore();
}
