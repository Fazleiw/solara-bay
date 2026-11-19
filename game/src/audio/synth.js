// Procedural instrument voices, all Web Audio oscillators and filtered noise, no samples.
// Drums: kick, snare, clap, closed/open hats, a pitched tom/conga (a sine with a pitch drop and
// a short skin slap) and a shaker (bandpassed noise with a swell then a snap).
// Tones: filtered bass, warm detuned pads whose lowpass opens slowly and settles back,
// plucks, marimba, electric piano and a vibrato lead. The radio stations and jingles use them.

export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createSynth(ctx, noiseBuffer) {
  function env(gain, t, attack, peak, decay, sustain = 0, release = 0.05, hold = 0) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + attack + decay);
    if (hold) {
      gain.gain.setValueAtTime(Math.max(0.0001, sustain || 0.0001), t + attack + decay + hold);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + hold + release);
    }
  }
  function noise(t, duration) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.start(t, Math.random() * 1.5);
    src.stop(t + duration + 0.05);
    return src;
  }
  function osc(type, freq, t, duration) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + duration + 0.05);
    return o;
  }

  return {
    kick(out, t, level = 1) {
      const o = osc('sine', 150, t, 0.4);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      const g = ctx.createGain();
      env(g, t, 0.002, level, 0.32);
      o.connect(g).connect(out);
    },
    snare(out, t, level = 0.6) {
      const n = noise(t, 0.2);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const g = ctx.createGain(); env(g, t, 0.002, level, 0.17);
      n.connect(hp).connect(g).connect(out);
      const o = osc('triangle', 190, t, 0.12);
      const g2 = ctx.createGain(); env(g2, t, 0.002, level * 0.6, 0.09);
      o.connect(g2).connect(out);
    },
    clap(out, t, level = 0.5) {
      const n = noise(t, 0.25);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      for (const d of [0, 0.012, 0.024]) { g.gain.linearRampToValueAtTime(level, t + d + 0.002); g.gain.exponentialRampToValueAtTime(level * 0.2, t + d + 0.011); }
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      n.connect(bp).connect(g).connect(out);
    },
    hat(out, t, level = 0.18, open = false) {
      const n = noise(t, open ? 0.3 : 0.06);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
      const g = ctx.createGain(); env(g, t, 0.001, level, open ? 0.25 : 0.045);
      n.connect(hp).connect(g).connect(out);
    },
    /** Pitched hand drum: low notes sound like a floor tom, high ones (~MIDI 60+) like a conga. */
    tom(out, t, note = 50, level = 0.4) {
      const f = midiToFreq(note);
      const body = osc('sine', f * 1.5, t, 0.35);
      body.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      const bg = ctx.createGain(); env(bg, t, 0.002, level, note >= 60 ? 0.18 : 0.3);
      body.connect(bg).connect(out);
      const slap = noise(t, 0.03);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 6; bp.Q.value = 2;
      const sg = ctx.createGain(); env(sg, t, 0.001, level * 0.35, 0.025);
      slap.connect(bp).connect(sg).connect(out);
    },
    /** Shaker: a soft noise swell that snaps off, like beads hitting the shell. */
    shaker(out, t, level = 0.06, length = 0.07) {
      const n = noise(t, length + 0.02);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6500; bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + length * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      n.connect(bp).connect(g).connect(out);
    },
    bass(out, t, note, duration, level = 0.35, type = 'sawtooth', cutoff = 520) {
      const o = osc(type, midiToFreq(note), t, duration + 0.1);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff * 2.2, t); lp.frequency.exponentialRampToValueAtTime(cutoff, t + 0.08); lp.Q.value = 4;
      const g = ctx.createGain(); env(g, t, 0.005, level, 0.08, level * 0.6, 0.06, Math.max(0, duration - 0.09));
      o.connect(lp).connect(g).connect(out);
    },
    pad(out, t, notes, duration, level = 0.08, cutoff = 1400) {
      // Warm sweep: start dark, bloom slightly past the cutoff mid-chord, then settle back down.
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.6;
      lp.frequency.setValueAtTime(cutoff * 0.45, t);
      lp.frequency.exponentialRampToValueAtTime(cutoff * 1.15, t + Math.max(0.05, duration * 0.5));
      lp.frequency.exponentialRampToValueAtTime(cutoff * 0.7, t + duration + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + Math.min(0.4, duration * 0.3));
      g.gain.setValueAtTime(level, t + duration * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.3);
      lp.connect(g).connect(out);
      for (const n of notes) {
        for (const detune of [-8, 8]) {
          const o = osc('sawtooth', midiToFreq(n), t, duration + 0.35);
          o.detune.value = detune;
          o.connect(lp);
        }
      }
    },
    pluck(out, t, note, level = 0.2, type = 'square', decay = 0.18, cutoff = 2600) {
      const o = osc(type, midiToFreq(note), t, decay + 0.1);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(400, t + decay);
      const g = ctx.createGain(); env(g, t, 0.003, level, decay);
      o.connect(lp).connect(g).connect(out);
    },
    marimba(out, t, note, level = 0.25) {
      const o = osc('sine', midiToFreq(note), t, 0.5);
      const o2 = osc('sine', midiToFreq(note) * 4, t, 0.1);
      const g = ctx.createGain(); env(g, t, 0.002, level, 0.4);
      const g2 = ctx.createGain(); env(g2, t, 0.001, level * 0.3, 0.05);
      o.connect(g).connect(out);
      o2.connect(g2).connect(out);
    },
    epiano(out, t, notes, duration, level = 0.1) {
      for (const n of notes) {
        const o = osc('sine', midiToFreq(n), t, duration + 0.5);
        const o2 = osc('triangle', midiToFreq(n) * 2, t, 0.4);
        const g = ctx.createGain(); env(g, t, 0.004, level, duration + 0.4, 0, 0.1);
        const g2 = ctx.createGain(); env(g2, t, 0.002, level * 0.25, 0.25);
        o.connect(g).connect(out);
        o2.connect(g2).connect(out);
      }
    },
    lead(out, t, note, duration, level = 0.09) {
      const o = osc('square', midiToFreq(note), t, duration + 0.2);
      const vib = osc('sine', 5.5, t, duration + 0.2);
      const vg = ctx.createGain(); vg.gain.value = 6;
      vib.connect(vg).connect(o.detune);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g = ctx.createGain(); env(g, t, 0.02, level, 0.1, level * 0.7, 0.12, Math.max(0, duration - 0.12));
      o.connect(lp).connect(g).connect(out);
    },
    noise,
    osc,
    env,
  };
}
