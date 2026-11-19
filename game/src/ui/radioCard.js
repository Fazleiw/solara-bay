// The HUD radio card, bottom right while driving: the station in its colour, the song and the
// artist on air (audio/radio.js tracklists) and an equalizer that dances to the live music
// through the audio analyser, or to the station's tempo before sound has started.

const $ = (id) => document.getElementById(id);
const BANDS = 9;

export function createRadioCard(game) {
  const el = { card: $('hud-radio'), name: $('hud-radio-name'), song: $('hud-radio-song'), artist: $('hud-radio-artist'), eq: $('hud-eq') };
  const ctx = el.eq.getContext('2d');
  const levels = new Array(BANDS).fill(0);
  let flash = 0;

  function drawEqualizer(color, bpm) {
    const live = game.audio.spectrum?.(BANDS);
    const beat = (game.clock * bpm) / 60;
    for (let i = 0; i < BANDS; i += 1) {
      // Before audio unlocks, a tempo-locked pattern: kick-heavy lows, shimmering highs.
      const fake = 0.35 + 0.45 * Math.abs(Math.sin(beat * Math.PI * (i % 3 === 0 ? 1 : 2) + i * 1.7)) * (1 - i / (BANDS * 1.6));
      const target = live ? Math.min(1, live[i] * 1.4) : fake;
      levels[i] += (target - levels[i]) * 0.35;
    }
    const w = el.eq.width, h = el.eq.height;
    ctx.clearRect(0, 0, w, h);
    const bw = w / BANDS;
    for (let i = 0; i < BANDS; i += 1) {
      const segs = Math.max(1, Math.round(levels[i] * 8));
      for (let s = 0; s < segs; s += 1) {
        ctx.fillStyle = s >= 6 ? '#ffffff' : color;
        ctx.globalAlpha = 0.55 + (s / 8) * 0.45;
        ctx.fillRect(i * bw + 2, h - (s + 1) * (h / 8) + 1, bw - 4, h / 8 - 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  function render(dt) {
    const radio = game.audio.radio;
    const showing = !!game.player.vehicle && (radio.current || game.shotMode) || flash > 0;
    flash = Math.max(0, flash - dt);
    el.card.classList.toggle('hidden', !showing);
    if (!showing) return;
    const now = radio.nowPlaying();
    const on = now.on || game.shotMode;
    el.name.textContent = on ? now.station.name : 'RADIO OFF';
    el.name.style.color = on ? now.station.color : '#9aa3b5';
    el.song.textContent = on ? now.title : '';
    el.artist.textContent = on ? now.artist : '';
    el.card.style.setProperty('--accent', on ? now.station.color : '#9aa3b5');
    if (on) drawEqualizer(now.station.color, now.bpm);
    else ctx.clearRect(0, 0, el.eq.width, el.eq.height);
  }

  return {
    render,
    /** Shows the card for a few seconds after a station change, even on foot. */
    flash() { flash = 3.5; },
  };
}
