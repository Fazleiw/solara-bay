// In-car radio: four procedural stations, each a little generative band with its own tempo,
// chord progression, drum pattern and lead instrument, scheduled ahead on the audio clock.
// Switching stations crackles with static and shows the station name on the HUD.
import { createRandom } from '../core/random.js';

const CHORDS = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62],
  Fm: [53, 56, 60], Db: [49, 53, 56], Ab: [56, 60, 63], Eb: [51, 55, 58],
  Dm7: [50, 53, 57, 60], G7: [55, 59, 62, 65], Cmaj7: [48, 52, 55, 59], Am7: [57, 60, 64, 67],
  Em: [52, 55, 59], D: [50, 54, 57],
};

const pattern = (s) => s.split('').map((c) => c === 'x' ? 1 : c === 'o' ? 0.5 : 0);

export const STATIONS = [
  {
    id: 'sunwave', name: 'SUNWAVE 101.7', tagline: 'Retro synths for golden hours', color: '#ff5fd2', bpm: 96, swing: 0,
    progression: ['Am', 'F', 'C', 'G'],
    kick: pattern('x.......x.......'), snare: pattern('....x.......x...'), hat: pattern('o.o.o.o.o.o.o.o.'),
    play(s, out, t, step, chord, bar, rng, dur) {
      if (step % 2 === 0) s.bass(out, t, chord[0] - 24 + (step % 4 === 2 ? 12 : 0), dur * 1.6, 0.26, 'sawtooth', 420);
      if (step === 0) s.pad(out, t, chord.map((n) => n + 12), dur * 16, 0.05, 1600);
      const arp = [0, 1, 2, 1, 0, 2, 1, 2];
      s.pluck(out, t, chord[arp[step % 8] % chord.length] + 24, 0.07, 'square', 0.14, 3000);
    },
  },
  {
    id: 'bayside', name: 'BAYSIDE BASS 94.3', tagline: 'Club heat from Vista Centro', color: '#3ef2ff', bpm: 124, swing: 0,
    progression: ['Fm', 'Db', 'Ab', 'Eb'],
    kick: pattern('x...x...x...x...'), snare: pattern('....x.......x...'), clap: true, hat: pattern('..x...x...x...x.'), openHat: true,
    play(s, out, t, step, chord, bar, rng, dur) {
      if (step % 4 === 2) s.bass(out, t, chord[0] - 24, dur * 1.5, 0.32, 'square', 380);
      if (step === 3 || step === 6 || step === 11) for (const n of chord) s.pluck(out, t, n + 12, 0.05, 'square', 0.2, 1800);
    },
  },
  {
    id: 'tropicana', name: 'RADIO TROPICANA 88.9', tagline: 'Island rhythm, all day', color: '#ffb347', bpm: 95, swing: 0,
    progression: ['C', 'G', 'Am', 'F'],
    kick: pattern('x...x...x...x...'), snare: pattern('...x..x....x..x.'), hat: pattern('oooooooooooooooo'),
    melody: true,
    play(s, out, t, step, chord, bar, rng, dur, melody) {
      if (step === 0 || step === 3 || step === 8 || step === 11) s.bass(out, t, chord[0] - 24, dur * 2, 0.3, 'triangle', 700);
      const note = melody[(bar % 2) * 16 + step];
      if (note) s.marimba(out, t, note, 0.18);
      if (step === 0 || step === 8) s.pad(out, t, chord.map((n) => n + 12), dur * 7, 0.025, 1000);
    },
  },
  {
    id: 'lowtide', name: 'LOW TIDE 106.1', tagline: 'Lo-fi for the late shift', color: '#9bd5ff', bpm: 78, swing: 0.18,
    progression: ['Dm7', 'G7', 'Cmaj7', 'Am7'],
    kick: pattern('x......x..x.....'), snare: pattern('....o.......o...'), hat: pattern('o.o.o.o.o.o.o.o.'),
    crackle: true, melody: true,
    play(s, out, t, step, chord, bar, rng, dur, melody) {
      if (step === 0 || step === 10) s.epiano(out, t, chord, dur * 8, 0.06);
      if (step === 0 || step === 7) s.bass(out, t, chord[0] - 24, dur * 5, 0.24, 'sine', 300);
      const note = melody[(bar % 2) * 16 + step];
      if (note && step % 2 === 0) s.lead(out, t, note, dur * 1.8, 0.03);
    },
  },
];

export function createRadio(engine) {
  let index = 0;
  let on = false;
  let nextTime = 0;
  let step = 0;
  let bar = 0;
  let timer = null;
  let out = null;
  const melodies = STATIONS.map((st, i) => {
    const r = createRandom(900 + i * 17);
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    return Array.from({ length: 32 }, (_, k) => (r.chance(k % 4 === 0 ? 0.8 : 0.35) ? 72 + r.pick(scale) - (i === 3 ? 12 : 0) : 0));
  });

  function schedule() {
    const ctx = engine.ctx;
    if (!ctx || !on) return;
    const st = STATIONS[index];
    const dur = 60 / st.bpm / 4;
    while (nextTime < ctx.currentTime + 0.2) {
      const t = nextTime + (step % 2 === 1 ? st.swing * dur : 0);
      const chord = CHORDS[st.progression[bar % st.progression.length]];
      const s = engine.synth;
      if (st.kick[step]) s.kick(out, t, 0.75 * st.kick[step]);
      if (st.snare[step]) { if (st.clap) s.clap(out, t, 0.32); else s.snare(out, t, 0.32 * st.snare[step]); }
      if (st.hat[step]) s.hat(out, t, 0.07 * st.hat[step], st.openHat && step % 4 === 2);
      if (st.crackle && step % 4 === 0) s.hat(out, t, 0.012, false);
      st.play(s, out, t, step, chord, bar, null, dur, melodies[index]);
      nextTime += dur;
      step = (step + 1) % 16;
      if (step === 0) bar += 1;
    }
  }

  function start() {
    if (!engine.ctx) return;
    if (!out) { out = engine.ctx.createGain(); out.gain.value = 0.55; out.connect(engine.musicBus); }
    nextTime = engine.ctx.currentTime + 0.12;
    step = 0;
    if (!timer) timer = setInterval(schedule, 30);
  }

  return {
    stations: STATIONS,
    get current() { return on ? STATIONS[index] : null; },
    get index() { return index; },
    /** Turns the radio on (entering a car) at the current station. */
    turnOn() {
      if (on) return;
      on = true;
      start();
      engine.onRadioChange?.(STATIONS[index]);
    },
    turnOff() {
      on = false;
      if (timer) { clearInterval(timer); timer = null; }
    },
    /** Next station; after the last one the radio switches off, then wraps around. */
    next() {
      engine.sfx?.staticBurst();
      if (!on) { index = 0; on = true; start(); engine.onRadioChange?.(STATIONS[index]); return; }
      if (index === STATIONS.length - 1) { on = false; if (timer) { clearInterval(timer); timer = null; } engine.onRadioChange?.(null); return; }
      index += 1;
      bar = 0;
      start();
      engine.onRadioChange?.(STATIONS[index]);
    },
    setStation(i) { index = i; },
  };
}
