// The heads-up display: clock, weapon and ammo, cash, wanted stars (flashing while the police
// search), mission timer, health and armour bars under the minimap, area and street names,
// vehicle name and speedometer, radio station toast, help prompts, notifications, objectives,
// target health, crosshair, title cards, big "MISSION PASSED / WASTED / BUSTED" messages and
// the red damage vignette.
import { areaName, streetNameAt } from '../world/cityLayout.js';
import { WEAPONS } from '../combat/weapons.js';
import { createMinimap } from './minimap.js';

const $ = (id) => document.getElementById(id);

/** Draws a weapon silhouette into the HUD weapon box. */
function drawWeaponIcon(canvas, id) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  const shape = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.closePath(); ctx.stroke(); ctx.fill(); };
  if (id === 'fists') {
    ctx.beginPath(); ctx.roundRect(w * 0.36, h * 0.2, w * 0.3, h * 0.55, 14); ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#000';
    for (let i = 1; i < 4; i += 1) ctx.fillRect(w * 0.36 + i * w * 0.075, h * 0.22, 2, h * 0.26);
  } else if (id === 'pistol') {
    shape([[0.3, 0.25], [0.78, 0.25], [0.78, 0.45], [0.52, 0.45], [0.48, 0.85], [0.34, 0.85], [0.36, 0.45], [0.3, 0.45]]);
  } else if (id === 'smg') {
    shape([[0.08, 0.3], [0.86, 0.3], [0.86, 0.5], [0.6, 0.5], [0.56, 0.9], [0.46, 0.9], [0.48, 0.5], [0.3, 0.5], [0.24, 0.62], [0.08, 0.62]]);
  } else {
    shape([[0.04, 0.38], [0.94, 0.32], [0.94, 0.46], [0.42, 0.5], [0.3, 0.72], [0.12, 0.72], [0.18, 0.5], [0.04, 0.5]]);
  }
}

export function createHud(game, mapCanvas) {
  const el = {
    root: $('hud'), clock: $('hud-clock'), ammo: $('hud-ammo'), weaponIcon: $('hud-weapon-icon'), cash: $('hud-cash'), stars: $('hud-stars'),
    timer: $('hud-timer'), health: $('hud-health'), healthBar: $('hud-health-bar'), armor: $('hud-armor'), area: $('hud-area'), street: $('hud-street'),
    vehicle: $('hud-vehicle'), vehicleName: $('hud-vehicle-name'), speed: $('hud-speed'), radio: $('hud-radio'), radioName: $('hud-radio-name'),
    radioTag: $('hud-radio-tag'), prompt: $('hud-prompt'), notify: $('hud-notify'), objective: $('hud-objective'), target: $('hud-target'),
    targetLabel: $('hud-target-label'), targetFill: $('hud-target-fill'), crosshair: $('hud-crosshair'), big: $('hud-big'), bigTitle: $('hud-big-title'),
    bigSub: $('hud-big-sub'), titlecard: $('hud-titlecard'), titleName: $('hud-titlecard-name'), titleTag: $('hud-titlecard-tag'),
    damage: $('hud-damage'), wasted: $('hud-wasted'), letterbox: $('letterbox'), fps: $('hud-fps'),
  };
  const minimap = createMinimap(game, $('hud-minimap'), mapCanvas);
  const starEls = [...el.stars.children];
  const state = { weapon: null, cash: -1, displayedCash: 0, area: '', areaTimer: 0, promptText: null, promptTimer: 0, bigTimer: 0, titleTimer: 0, radioTimer: 0, damage: 0, lastHealth: 100, frames: 0, fpsTime: 0 };

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function show(node, visible) { node.classList.toggle('hidden', !visible); }

  const hud = {
    minimap,
    setVisible(v) { show(el.root, v); },
    setObjective(text) {
      if (!text) { el.objective.innerHTML = ''; return; }
      el.objective.innerHTML = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*(.+?)\*/g, '<em>$1</em>');
    },
    setTimer(seconds) {
      if (seconds == null) { show(el.timer, false); return; }
      show(el.timer, true);
      const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
      setText(el.timer, `${m}:${String(s).padStart(2, '0')}`);
      el.timer.classList.toggle('low', seconds < 10);
    },
    setTargetHealth(fraction, label = '') {
      if (fraction == null) { show(el.target, false); return; }
      show(el.target, true);
      setText(el.targetLabel, label);
      el.targetFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    },
    /** A help box in the top-left corner; shown while called each frame, or for `seconds`. */
    prompt(text, seconds = 0) {
      state.promptText = text;
      state.promptTimer = Math.max(state.promptTimer, seconds);
      el.prompt.innerHTML = text.replace(/\b(E|F|T|R|H|M|Space|Shift|Esc)\b(?= to| for)/g, '<kbd>$1</kbd>');
      show(el.prompt, true);
    },
    notify(text) {
      const div = document.createElement('div');
      div.textContent = text;
      el.notify.appendChild(div);
      while (el.notify.children.length > 4) el.notify.firstChild.remove();
      setTimeout(() => div.remove(), 3500);
    },
    bigMessage(title, sub = '', color = '#ffd23f', seconds = 4) {
      setText(el.bigTitle, title);
      setText(el.bigSub, sub);
      el.bigTitle.style.color = color;
      show(el.big, true);
      state.bigTimer = seconds;
    },
    titleCard(name, tagline) {
      setText(el.titleName, name);
      setText(el.titleTag, tagline);
      show(el.titlecard, true);
      state.titleTimer = 3.5;
    },
    radioToast(station) {
      setText(el.radioName, station ? station.name : 'RADIO OFF');
      setText(el.radioTag, station ? station.tagline : '');
      el.radioName.style.color = station ? station.color : '#ccc';
      show(el.radio, true);
      state.radioTimer = 3.2;
    },
    setWasted(on) { el.wasted.style.opacity = on ? '1' : '0'; },
    setLetterbox(on) { el.letterbox.classList.toggle('on', on); },
    showEnding() { setTimeout(() => game.ui.showEnding(), game.shotMode ? 0 : 9000); },
    update(dt) {
      const p = game.player;
      const h = p.human;
      setText(el.clock, game.world.dayNight.clockText());
      // Cash counts up smoothly.
      if (game.shotMode) state.displayedCash = game.state.cash;
      if (state.displayedCash !== game.state.cash) {
        const diff = game.state.cash - state.displayedCash;
        state.displayedCash += Math.abs(diff) < 3 ? diff : Math.round(diff * Math.min(1, dt * 6));
        el.cash.classList.toggle('gain', diff > 0);
      } else el.cash.classList.remove('gain');
      setText(el.cash, `$${Math.max(0, state.displayedCash).toLocaleString('en-US')}`);
      // Weapon and ammo.
      const wid = p.inventory.current;
      if (wid !== state.weapon) { state.weapon = wid; drawWeaponIcon(el.weaponIcon, wid); }
      const slot = p.inventory.owned[wid];
      setText(el.ammo, WEAPONS[wid].melee ? '' : `${slot.mag} / ${slot.reserve}`);
      // Wanted stars.
      const level = game.wanted.level;
      starEls.forEach((s, i) => s.classList.toggle('on', i < level));
      el.stars.classList.toggle('flash', game.wanted.evading);
      // Health and armour.
      const hp = Math.max(0, h.health / h.maxHealth);
      el.health.style.width = `${hp * 100}%`;
      el.healthBar.classList.toggle('low', hp < 0.3);
      el.armor.style.width = `${Math.max(0, h.armor)}%`;
      if (h.health < state.lastHealth - 0.5) state.damage = Math.min(1, state.damage + (state.lastHealth - h.health) / 25);
      state.lastHealth = h.health;
      state.damage = Math.max(hp < 0.25 && h.alive ? 0.35 + Math.sin(game.clock * 5) * 0.1 : 0, state.damage - dt * 1.5);
      el.damage.style.opacity = state.damage.toFixed(2);
      // Location.
      const area = areaName(p.x, p.z);
      if (area !== state.area) { state.area = area; state.areaTimer = 5; setText(el.area, area); }
      state.areaTimer -= dt;
      el.area.style.opacity = state.areaTimer > 0 || p.vehicle || game.shotMode ? '1' : '0.0';
      setText(el.street, streetNameAt(p.x, p.z));
      // Vehicle.
      show(el.vehicle, !!p.vehicle);
      if (p.vehicle) {
        setText(el.vehicleName, p.vehicle.type.name);
        el.speed.innerHTML = `${Math.round(Math.abs(p.vehicle.fwdSpeed) * 3.6)}<small>KM/H</small>`;
      }
      show(el.crosshair, !p.vehicle && h.alive && p.isAiming && wid !== 'fists');
      // Timed elements.
      if (state.promptTimer > 0) state.promptTimer -= dt;
      else if (state.promptText === null) show(el.prompt, false);
      state.promptText = null;
      if (state.bigTimer > 0) { state.bigTimer -= dt; if (state.bigTimer <= 0) show(el.big, false); }
      if (state.titleTimer > 0) { state.titleTimer -= dt; if (state.titleTimer <= 0) show(el.titlecard, false); }
      if (state.radioTimer > 0) { state.radioTimer -= dt; if (state.radioTimer <= 0) show(el.radio, false); }
      minimap.draw();
      if (game.settings.showFps) {
        state.frames += 1; state.fpsTime += dt;
        if (state.fpsTime > 0.5) { setText(el.fps, `${Math.round(state.frames / state.fpsTime)} fps`); state.frames = 0; state.fpsTime = 0; }
      }
      show(el.fps, game.settings.showFps);
    },
  };
  return hud;
}
