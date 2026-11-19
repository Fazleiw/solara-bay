// The audio engine: one AudioContext started on the first click, master/music/effects buses
// with a generated reverb, distance and stereo placement for world sounds, and the continuous
// loops: the player's engine note, tyre screech, police sirens, the helicopter and the sea.
import { createSynth } from './synth.js';
import { createSfx } from './sfx.js';
import { createRadio } from './radio.js';
import { SHORE_X } from '../world/cityLayout.js';

export function createAudioEngine(game) {
  const engine = {
    ctx: null,
    synth: null,
    master: null,
    musicBus: null,
    sfxBus: null,
    reverbSend: null,
    onRadioChange: null,
  };
  const loops = {};
  const listener = { x: 0, z: 0, yaw: 0 };

  function makeNoise(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function makeImpulse(ctx, seconds = 2.2) {
    const length = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
    }
    return buffer;
  }

  function loopGain(source, filter, gainValue = 0) {
    const g = engine.ctx.createGain();
    g.gain.value = gainValue;
    if (filter) source.connect(filter).connect(g); else source.connect(g);
    g.connect(engine.sfxBus);
    return g;
  }

  function buildLoops() {
    const ctx = engine.ctx;
    // Engine: a sawtooth and a sub square through a lowpass that opens with revs.
    const e1 = ctx.createOscillator(); e1.type = 'sawtooth';
    const e2 = ctx.createOscillator(); e2.type = 'square';
    const eLp = ctx.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 600; eLp.Q.value = 2;
    const eMix = ctx.createGain(); eMix.gain.value = 0.5;
    e1.connect(eMix); e2.connect(eMix);
    loops.engine = { o1: e1, o2: e2, lp: eLp, gain: loopGain(eMix, eLp) };
    e1.start(); e2.start();
    // Tyre screech.
    const sNoise = ctx.createBufferSource(); sNoise.buffer = engine.noise; sNoise.loop = true;
    const sBp = ctx.createBiquadFilter(); sBp.type = 'bandpass'; sBp.frequency.value = 1900; sBp.Q.value = 4;
    loops.screech = { gain: loopGain(sNoise, sBp) };
    sNoise.start();
    // Siren: a triangle wailing under an LFO.
    const siren = ctx.createOscillator(); siren.type = 'triangle'; siren.frequency.value = 900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 380;
    lfo.connect(lfoGain).connect(siren.frequency);
    loops.siren = { gain: loopGain(siren, null) };
    siren.start(); lfo.start();
    // Helicopter: low noise chopped by a fast LFO.
    const hNoise = ctx.createBufferSource(); hNoise.buffer = engine.noise; hNoise.loop = true;
    const hLp = ctx.createBiquadFilter(); hLp.type = 'lowpass'; hLp.frequency.value = 260;
    const chop = ctx.createGain(); chop.gain.value = 0.5;
    const chopLfo = ctx.createOscillator(); chopLfo.type = 'square'; chopLfo.frequency.value = 13;
    const chopDepth = ctx.createGain(); chopDepth.gain.value = 0.5;
    chopLfo.connect(chopDepth).connect(chop.gain);
    hNoise.connect(hLp).connect(chop);
    loops.heli = { gain: loopGain(chop, null) };
    hNoise.start(); chopLfo.start();
    // Surf and city ambience.
    const wNoise = ctx.createBufferSource(); wNoise.buffer = engine.noise; wNoise.loop = true;
    const wLp = ctx.createBiquadFilter(); wLp.type = 'lowpass'; wLp.frequency.value = 500;
    const swell = ctx.createGain(); swell.gain.value = 0.5;
    const swellLfo = ctx.createOscillator(); swellLfo.frequency.value = 0.12;
    const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.45;
    swellLfo.connect(swellDepth).connect(swell.gain);
    wNoise.connect(wLp).connect(swell);
    loops.surf = { gain: loopGain(swell, null) };
    wNoise.start(); swellLfo.start();
    const cNoise = ctx.createBufferSource(); cNoise.buffer = engine.noise; cNoise.loop = true;
    const cLp = ctx.createBiquadFilter(); cLp.type = 'lowpass'; cLp.frequency.value = 180;
    loops.city = { gain: loopGain(cNoise, cLp, 0.03) };
    cNoise.start();
  }

  /** Starts audio; must be called from a user gesture. */
  engine.unlock = () => {
    if (engine.ctx) { if (engine.ctx.state === 'suspended') engine.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    engine.ctx = ctx;
    engine.noise = makeNoise(ctx);
    engine.synth = createSynth(ctx, engine.noise);
    engine.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    engine.master.connect(comp).connect(ctx.destination);
    engine.musicBus = ctx.createGain();
    engine.sfxBus = ctx.createGain();
    engine.musicBus.connect(engine.master);
    engine.sfxBus.connect(engine.master);
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx);
    engine.reverbSend = ctx.createGain();
    engine.reverbSend.gain.value = 0.25;
    engine.reverbSend.connect(reverb).connect(engine.sfxBus);
    buildLoops();
    engine.applySettings(game.settings);
  };

  engine.applySettings = (s) => {
    if (!engine.ctx) return;
    engine.master.gain.value = s.masterVolume;
    engine.musicBus.gain.value = s.musicVolume;
    engine.sfxBus.gain.value = s.sfxVolume;
  };

  /** A gain + panner chain for a sound at (x, z), or null when too far away to hear. */
  engine.spatial = (x, z, maxDistance) => {
    const ctx = engine.ctx;
    if (!ctx) return null;
    if (x === undefined) return engine.sfxBus;
    const dx = x - listener.x, dz = z - listener.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDistance) return null;
    const g = ctx.createGain();
    g.gain.value = Math.pow(1 - d / maxDistance, 1.6);
    const pan = ctx.createStereoPanner();
    // Right of the camera view direction is (-cos yaw, sin yaw).
    const right = (dx * -Math.cos(listener.yaw) + dz * Math.sin(listener.yaw)) / (d || 1);
    pan.pan.value = Math.max(-1, Math.min(1, right * 0.8));
    g.connect(pan).connect(engine.sfxBus);
    setTimeout(() => { g.disconnect(); pan.disconnect(); }, 4000);
    return g;
  };

  let sirenLevel = 0, heliLevel = 0;
  engine.setSiren = (level) => { sirenLevel = level; };
  engine.setHelicopter = (level) => { heliLevel = level; };

  engine.update = (dt, paused) => {
    const ctx = engine.ctx;
    if (!ctx) return;
    const cam = game.camera;
    listener.x = cam.position.x; listener.z = cam.position.z; listener.yaw = cam.state.yaw;
    const t = ctx.currentTime;
    const smooth = (param, value) => param.setTargetAtTime(value, t, 0.08);
    const car = game.player.vehicle;
    if (car && !paused && !car.destroyed) {
      const speed = Math.abs(car.fwdSpeed);
      const gearSpan = car.type.maxSpeed / 5;
      const gear = Math.min(4, Math.floor(speed / gearSpan));
      const rpm = 0.25 + ((speed - gear * gearSpan) / gearSpan) * 0.75 * (gear === 4 ? 1.3 : 1) + Math.max(0, car.controls.throttle) * 0.08;
      const base = car.type.bike ? 70 : car.type.id === 'tessaro' || car.type.id === 'haulden' ? 34 : car.type.id === 'vantor' ? 48 : 40;
      smooth(loops.engine.o1.frequency, base + rpm * base * 2.6);
      smooth(loops.engine.o2.frequency, (base + rpm * base * 2.6) / 2);
      smooth(loops.engine.lp.frequency, 300 + rpm * 1400 + Math.max(0, car.controls.throttle) * 500);
      smooth(loops.engine.gain.gain, 0.09 + Math.max(0, car.controls.throttle) * 0.06);
      smooth(loops.screech.gain.gain, car.drifting ? Math.min(0.12, Math.abs(car.latSpeed) * 0.012) : 0);
    } else {
      smooth(loops.engine.gain.gain, 0);
      smooth(loops.screech.gain.gain, 0);
    }
    smooth(loops.siren.gain.gain, paused ? 0 : sirenLevel * sirenLevel * 0.09);
    smooth(loops.heli.gain.gain, paused ? 0 : heliLevel * 0.25);
    const shore = Math.max(0, 1 - Math.abs(listener.x - SHORE_X) / 120);
    smooth(loops.surf.gain.gain, paused ? 0 : shore * 0.12);
    smooth(engine.musicBus.gain, paused ? game.settings.musicVolume * 0.35 : game.settings.musicVolume);
  };

  engine.sfx = createSfx(engine);
  engine.radio = createRadio(engine);
  return engine;
}
