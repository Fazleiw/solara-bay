// One-shot sound effects, all synthesised: gunshots per weapon, explosions, crashes, punches,
// horns, screams, pickups, mission jingles, checkpoints, doors, reloads and radio static.
// Sounds placed in the world fade with distance and pan with the camera.

export function createSfx(engine) {
  const voice = (x, z, maxDistance = 120) => engine.spatial(x, z, maxDistance);

  return {
    gunshot(kind = 'pistol', x, z) {
      const out = voice(x, z, 160);
      if (!out) return;
      const { ctx, synth } = engine;
      const t = ctx.currentTime;
      const len = kind === 'shotgun' ? 0.4 : kind === 'smg' ? 0.12 : 0.22;
      const n = synth.noise(t, len);
      const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.setValueAtTime(kind === 'smg' ? 5000 : 3800, t); bp.frequency.exponentialRampToValueAtTime(300, t + len);
      const g = ctx.createGain(); synth.env(g, t, 0.001, kind === 'shotgun' ? 1.2 : 0.8, len);
      n.connect(bp).connect(g).connect(out);
      const o = synth.osc('sine', kind === 'shotgun' ? 90 : 140, t, 0.15);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g2 = ctx.createGain(); synth.env(g2, t, 0.001, 0.9, 0.12);
      o.connect(g2).connect(out);
      g.connect(engine.reverbSend);
    },
    explosion(x, z) {
      const out = voice(x, z, 400);
      if (!out) return;
      const { ctx, synth } = engine;
      const t = ctx.currentTime;
      const n = synth.noise(t, 2.2);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(90, t + 2);
      const g = ctx.createGain(); synth.env(g, t, 0.005, 1.6, 2.0);
      n.connect(lp).connect(g).connect(out);
      g.connect(engine.reverbSend);
      const o = synth.osc('sine', 70, t, 1.2);
      o.frequency.exponentialRampToValueAtTime(25, t + 1);
      const g2 = ctx.createGain(); synth.env(g2, t, 0.005, 1.2, 1.1);
      o.connect(g2).connect(out);
    },
    crash(intensity, x, z) {
      const out = voice(x, z, 90);
      if (!out) return;
      const { ctx, synth } = engine;
      const t = ctx.currentTime;
      const n = synth.noise(t, 0.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + intensity * 1500;
      const g = ctx.createGain(); synth.env(g, t, 0.002, 0.3 + intensity * 0.9, 0.35);
      n.connect(lp).connect(g).connect(out);
      for (const f of [310, 467]) {
        const o = synth.osc('square', f * (0.9 + Math.random() * 0.2), t, 0.25);
        const g2 = ctx.createGain(); synth.env(g2, t, 0.001, 0.05 * intensity, 0.2);
        o.connect(g2).connect(out);
      }
    },
    punch(hit, x, z) {
      const out = voice(x, z, 40);
      if (!out) return;
      const { ctx, synth } = engine;
      const t = ctx.currentTime;
      if (hit) {
        const o = synth.osc('sine', 130, t, 0.1); o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
        const g = ctx.createGain(); synth.env(g, t, 0.001, 0.8, 0.09);
        o.connect(g).connect(out);
      }
      const n = synth.noise(t, 0.08);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hit ? 900 : 2500;
      const g = ctx.createGain(); synth.env(g, t, 0.001, hit ? 0.4 : 0.12, 0.07);
      n.connect(bp).connect(g).connect(out);
    },
    horn(pitch = 1, x, z) {
      const out = x === undefined ? engine.sfxBus : voice(x, z, 80);
      if (!out) return;
      const { ctx, synth } = engine;
      const t = ctx.currentTime;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = ctx.createGain(); synth.env(g, t, 0.01, 0.16, 0.05, 0.14, 0.08, 0.38);
      lp.connect(g).connect(out);
      for (const f of [349, 440]) synth.osc('square', f * pitch, t, 0.55).connect(lp);
    },
    scream(x, z) {
      const out = voice(x, z, 45);
      if (!out) return;
      const { ctx, synth } = engine;
      const t = ctx.currentTime;
      const base = 600 + Math.random() * 500;
      const o = synth.osc('sawtooth', base, t, 0.6);
      o.frequency.linearRampToValueAtTime(base * 1.25, t + 0.15);
      o.frequency.linearRampToValueAtTime(base * 0.8, t + 0.55);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
      const g = ctx.createGain(); synth.env(g, t, 0.03, 0.08, 0.5);
      o.connect(bp).connect(g).connect(out);
    },
    pickup(cash) {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      (cash ? [84, 88, 91] : [76, 83]).forEach((n, i) => synth.pluck(engine.sfxBus, t + i * 0.06, n, 0.12, 'triangle', 0.25));
    },
    collect() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      [79, 83, 86, 91, 95].forEach((n, i) => synth.marimba(engine.sfxBus, t + i * 0.07, n, 0.25));
    },
    checkpoint() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      [81, 88].forEach((n, i) => synth.pluck(engine.sfxBus, t + i * 0.08, n, 0.14, 'square', 0.15));
    },
    missionStart() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      synth.pad(engine.sfxBus, t, [57, 64, 69], 1.6, 0.06, 1800);
      [69, 72, 76].forEach((n, i) => synth.pluck(engine.sfxBus, t + i * 0.12, n, 0.1, 'square', 0.3));
    },
    missionPassed() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((chord, i) => {
        synth.pad(engine.sfxBus, t + i * 0.32, chord, i === 3 ? 1.6 : 0.3, 0.07, 2400);
        synth.pluck(engine.sfxBus, t + i * 0.32, chord[2] + 12, 0.12, 'square', 0.3);
      });
      synth.kick(engine.sfxBus, t + 0.96, 0.8);
    },
    missionFailed() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      [[64, 67, 71], [62, 65, 69], [57, 60, 64]].forEach((chord, i) => synth.pad(engine.sfxBus, t + i * 0.4, chord, i === 2 ? 1.4 : 0.38, 0.07, 1200));
    },
    wasted() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      synth.pad(engine.sfxBus, t, [45, 52, 57], 2.6, 0.09, 700);
      synth.kick(engine.sfxBus, t, 1);
    },
    click() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      synth.hat(engine.sfxBus, ctx.currentTime, 0.2, false);
    },
    reload() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      synth.hat(engine.sfxBus, t, 0.25, false);
      synth.hat(engine.sfxBus, t + 0.35, 0.3, false);
    },
    door() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = synth.osc('sine', 90, t, 0.12); o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
      const g = ctx.createGain(); synth.env(g, t, 0.002, 0.5, 0.1);
      o.connect(g).connect(engine.sfxBus);
    },
    respray() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      const n = synth.noise(t, 1.2);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      const g = ctx.createGain(); synth.env(g, t, 0.1, 0.2, 1.0);
      n.connect(hp).connect(g).connect(engine.sfxBus);
    },
    staticBurst() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      const t = ctx.currentTime;
      const n = synth.noise(t, 0.25);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.6;
      const g = ctx.createGain(); synth.env(g, t, 0.005, 0.18, 0.22);
      n.connect(bp).connect(g).connect(engine.musicBus);
    },
    uiSelect() {
      const { ctx, synth } = engine;
      if (!ctx) return;
      synth.pluck(engine.sfxBus, ctx.currentTime, 88, 0.08, 'triangle', 0.08);
    },
  };
}
