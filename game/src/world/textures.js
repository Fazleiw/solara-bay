// Every texture in the game is painted here on a canvas at start-up: building facades with
// their night-time window maps, asphalt with lane markings, crosswalks, sidewalks, sand, grass,
// palm fronds, neon signs and soft glow sprites. No image file is loaded.
import * as THREE from 'three';
import { createRandom } from '../core/random.js';

const paintRng = createRandom(4242);

function canvasTexture(width, height, paint, { repeat = true, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function noise(ctx, w, h, amount, alpha, light = 255) {
  for (let i = 0; i < amount; i += 1) {
    const v = Math.floor(paintRng.range(0, light));
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(paintRng.range(0, w), paintRng.range(0, h), paintRng.range(1, 3), paintRng.range(1, 3));
  }
}

/**
 * A facade tile covering 16 m x 16 m (4 windows by 4 storeys) and its matching emissive map,
 * where some windows glow warm at night. `style` picks the architecture.
 */
function facadePair(style) {
  const size = 256;
  const lit = [];
  for (let i = 0; i < 16; i += 1) lit.push(paintRng.chance(style === 'glass' ? 0.55 : 0.4) ? paintRng.pick(['#ffd9a0', '#fff1c9', '#ffc070', '#bfe6ff', '#ffe7b0']) : null);
  const drawWindows = (ctx, fill, frame, inset) => {
    const cell = size / 4;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        const x = c * cell + inset, y = r * cell + inset * 1.4;
        const w = cell - inset * 2, h = cell - inset * 2.6;
        if (frame) { ctx.fillStyle = frame; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); }
        fill(ctx, x, y, w, h, r * 4 + c);
      }
    }
  };
  const map = canvasTexture(size, size, (ctx) => {
    if (style === 'glass') {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#9fc4dc'); g.addColorStop(0.5, '#6f9bbd'); g.addColorStop(1, '#4d7697');
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      drawWindows(ctx, (c, x, y, w, h) => {
        const wg = c.createLinearGradient(x, y, x + w, y + h);
        wg.addColorStop(0, '#d6ecf7'); wg.addColorStop(0.45, '#7fb0d0'); wg.addColorStop(1, '#3c6688');
        c.fillStyle = wg; c.fillRect(x, y, w, h);
      }, null, 3);
      ctx.fillStyle = '#e8eef2';
      for (let r = 0; r <= 4; r += 1) ctx.fillRect(0, r * 64 - 2, size, 4);
      for (let c = 0; c <= 4; c += 1) ctx.fillRect(c * 64 - 1, 0, 2, size);
    } else if (style === 'office') {
      ctx.fillStyle = '#ece6da'; ctx.fillRect(0, 0, size, size);
      noise(ctx, size, size, 900, 0.05);
      drawWindows(ctx, (c, x, y, w, h) => {
        const wg = c.createLinearGradient(x, y, x, y + h);
        wg.addColorStop(0, '#5d7f99'); wg.addColorStop(1, '#2c445a');
        c.fillStyle = wg; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x + w / 2 - 1, y, 2, h);
      }, '#b9ae9c', 12);
    } else if (style === 'stucco') {
      ctx.fillStyle = '#f7f3ee'; ctx.fillRect(0, 0, size, size);
      noise(ctx, size, size, 1400, 0.04);
      drawWindows(ctx, (c, x, y, w, h) => {
        c.fillStyle = '#3f6a7c'; c.fillRect(x, y, w, h);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, y, w, 4);
        c.fillStyle = '#ffffff'; c.fillRect(x - 5, y + h, w + 10, 5);
      }, '#ffffff', 16);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let r = 0; r < 4; r += 1) ctx.fillRect(0, r * 64 + 60, size, 4);
    } else if (style === 'house') {
      ctx.fillStyle = '#fbf7f0'; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      for (let y = 0; y < size; y += 8) ctx.fillRect(0, y, size, 2);
      drawWindows(ctx, (c, x, y, w, h) => {
        c.fillStyle = '#4b6f80'; c.fillRect(x, y, w, h);
        c.fillStyle = '#fff'; c.fillRect(x + w / 2 - 2, y, 4, h); c.fillRect(x, y + h / 2 - 2, w, 4);
      }, '#ffffff', 18);
    } else {
      // Corrugated warehouse metal.
      ctx.fillStyle = '#d8d8d4'; ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 8) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, 0, 3, size);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 4, 0, 2, size);
      }
      noise(ctx, size, size, 600, 0.08);
      ctx.fillStyle = '#4a5a66';
      for (let c = 0; c < 4; c += 1) ctx.fillRect(c * 64 + 10, 14, 44, 10);
    }
  });
  const emissive = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    if (style === 'warehouse') {
      ctx.fillStyle = '#ffcf85';
      for (let c = 0; c < 4; c += 1) if (lit[c]) ctx.fillRect(c * 64 + 10, 14, 44, 10);
      return;
    }
    const inset = { glass: 3, office: 12, stucco: 16, house: 18 }[style];
    const cell = size / 4;
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        const color = lit[r * 4 + c];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(c * cell + inset, r * cell + inset * 1.4, cell - inset * 2, cell - inset * 2.6);
      }
    }
  });
  return { map, emissive };
}

function asphaltBase(ctx, w, h) {
  ctx.fillStyle = '#3b3d42'; ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 5000, 0.12);
  noise(ctx, w, h, 600, 0.12, 40);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(paintRng.range(0, w), 0, paintRng.range(6, 20), h);
}

export function createTextures() {
  const facades = {
    glass: facadePair('glass'),
    office: facadePair('office'),
    stucco: facadePair('stucco'),
    house: facadePair('house'),
    warehouse: facadePair('warehouse'),
  };

  // Road segment: 14 m across (u) by 14 m along (v); lanes, double yellow centre line, edges.
  const road = canvasTexture(256, 256, (ctx, w, h) => {
    asphaltBase(ctx, w, h);
    const m = w / 14;
    ctx.fillStyle = '#f2c84b';
    ctx.fillRect(w / 2 - 0.28 * m, 0, 0.14 * m, h);
    ctx.fillRect(w / 2 + 0.14 * m, 0, 0.14 * m, h);
    ctx.fillStyle = '#e9e9e4';
    ctx.fillRect(0.9 * m, 0, 0.16 * m, h);
    ctx.fillRect(w - 1.06 * m, 0, 0.16 * m, h);
    noise(ctx, w, h, 800, 0.08);
  });
  // Intersection: plain asphalt with zebra crossings along all four edges.
  const crossing = canvasTexture(256, 256, (ctx, w, h) => {
    asphaltBase(ctx, w, h);
    const m = w / 14;
    ctx.fillStyle = '#ecebe6';
    for (let s = 1.4; s < 12.8; s += 1.1) {
      ctx.fillRect(s * m, 0.2 * m, 0.55 * m, 2.2 * m);
      ctx.fillRect(s * m, h - 2.4 * m, 0.55 * m, 2.2 * m);
      ctx.fillRect(0.2 * m, s * m, 2.2 * m, 0.55 * m);
      ctx.fillRect(w - 2.4 * m, s * m, 2.2 * m, 0.55 * m);
    }
    noise(ctx, w, h, 800, 0.1);
  });
  const sidewalk = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9c4ba'; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 1200, 0.06);
    ctx.strokeStyle = 'rgba(70,60,50,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke();
    }
  });
  const plaza = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d9cfbf'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? '#d2c6b3' : '#e3dacb';
        ctx.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
      }
    }
    noise(ctx, w, h, 900, 0.05);
  });
  const grass = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6f9e48'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = paintRng.pick(['#5f8f3c', '#7fb054', '#88b85a', '#679a42', '#93c063']);
      ctx.fillRect(paintRng.range(0, w), paintRng.range(0, h), 1, paintRng.range(1, 3));
    }
  });
  const sand = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ead9ae'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i += 1) {
      ctx.fillStyle = paintRng.pick(['#e0cc9c', '#f3e4bf', '#d8c08e', '#f7ecd0']);
      ctx.fillRect(paintRng.range(0, w), paintRng.range(0, h), 1, 1);
    }
  });
  const concrete = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9b9890'; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 2500, 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, h - 3, w, 3); ctx.fillRect(w - 3, 0, 3, h);
  });
  const roof = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8d8a85'; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 3000, 0.1);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });
  const wood = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9b7653'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = paintRng.pick(['#8e6a48', '#a47e5a', '#94704d']);
      ctx.fillRect(x, 0, 15, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 15, 0, 1, h);
    }
    noise(ctx, w, h, 800, 0.08);
  });
  const frond = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#4f7a2a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w / 2, h); ctx.lineTo(w / 2, 4); ctx.stroke();
    for (let y = 8; y < h - 6; y += 5) {
      const span = Math.sin((y / h) * Math.PI) * (w / 2 - 4);
      ctx.strokeStyle = paintRng.pick(['#5b8f2e', '#6aa236', '#4d7f26', '#79ad3e']);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 - span, y + 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2, y); ctx.lineTo(w / 2 + span, y + 16); ctx.stroke();
    }
  }, { repeat: false });
  const glow = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, { repeat: false, srgb: false });
  const pool = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3fc6e0'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 14; i += 1) {
      ctx.beginPath(); ctx.arc(paintRng.range(0, w), paintRng.range(0, h), paintRng.range(3, 9), 0, Math.PI); ctx.stroke();
    }
  });

  return { facades, road, crossing, sidewalk, plaza, grass, sand, concrete, roof, wood, frond, glow, pool };
}

/** A neon sign: glowing text with a coloured halo on a transparent canvas. */
export function neonSignTexture(text, color, { width = 512, height = 128, font = 'italic 900 78px "Arial Black", Impact, sans-serif', frame = true } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (frame) {
      ctx.fillStyle = 'rgba(10,8,20,0.82)';
      ctx.fillRect(6, 6, w - 12, h - 12);
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 16;
      ctx.strokeRect(12, 12, w - 24, h - 24);
    }
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + 4);
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.75;
    ctx.fillText(text, w / 2, h / 2 + 4);
  }, { repeat: false });
}

/** A painted billboard poster for rooftops and walls. */
export function billboardTexture(title, subtitle, colors) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.35, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 900 64px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 28, 120);
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText(subtitle, 32, 176);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  }, { repeat: false });
}
