// The heads-up display: lays out and updates every HUD component each frame. Top left the
// mission card (ui/missionCard.js) and police-response panel (ui/dispatchPanel.js); top right
// the clock, cash, wanted stars with their IN SIGHT / SEARCH ZONE tag and the weapon bar
// (ui/weaponBar.js); bottom left the minimap, district pill, health, armour and respect;
// bottom right the radio and vehicle cards; plus toasts, help prompts, the crosshair, title
// cards, MISSION PASSED / WASTED / BUSTED banners and the red damage vignette.
import { createMinimap } from './minimap.js';
import { createMissionCard } from './missionCard.js';
import { createDispatchPanel } from './dispatchPanel.js';
import { createWeaponBar } from './weaponBar.js';
import { createRadioCard } from './radioCard.js';
import { createVehicleCard } from './vehicleCard.js';
import { createRespectBar } from './respectBar.js';
import { createDistrictPill } from './districtPill.js';
import { createToasts } from './toasts.js';
import { createHeistHud } from './heistHud.js';
import { createHeistBoard } from './heistBoard.js';
import { createPayoutScreen } from './payoutScreen.js';

const $ = (id) => document.getElementById(id);

function dayPart(hour) {
  if (hour >= 16.5 && hour < 19.4) return 'GOLDEN HOUR';
  if (hour >= 19.4 || hour < 5.5) return 'NIGHT';
  if (hour < 11) return 'MORNING';
  return 'AFTERNOON';
}

export function createHud(game, mapCanvas) {
  const el = {
    root: $('hud'), clock: $('hud-clock'), daypart: $('hud-daypart'), cash: $('hud-cash'), stars: $('hud-stars'), wantedTag: $('hud-wanted-tag'),
    health: $('hud-health'), healthBar: $('hud-health-bar'), armor: $('hud-armor'), prompt: $('hud-prompt'), crosshair: $('hud-crosshair'),
    big: $('hud-big'), bigTitle: $('hud-big-title'), bigSub: $('hud-big-sub'), titlecard: $('hud-titlecard'), titleName: $('hud-titlecard-name'),
    titleTag: $('hud-titlecard-tag'), loot: $('hud-loot'), lootAmount: $('hud-loot-amount'), healthNum: $('hud-health-num'), armorNum: $('hud-armor-num'), damage: $('hud-damage'), wasted: $('hud-wasted'), letterbox: $('letterbox'), fps: $('hud-fps'),
  };
  const minimap = createMinimap(game, $('hud-minimap'), mapCanvas);
  const toasts = createToasts(game);
  const mission = createMissionCard(game);
  const dispatch = createDispatchPanel(game);
  const weapons = createWeaponBar(game);
  const radio = createRadioCard(game);
  const vehicle = createVehicleCard(game);
  const respect = createRespectBar(game);
  const district = createDistrictPill(game, toasts.toast);
  const heist = createHeistHud(game, $('hud-topleft'));
  const payoutScreen = createPayoutScreen(game, document.getElementById('ui'));
  if (game.heists) {
    game.heists.board = createHeistBoard(game, document.getElementById('ui'));
    game.heists.payoutScreen = payoutScreen;
  }
  const starEls = [...el.stars.children];
  const state = { displayedCash: 0, promptText: null, promptTimer: 0, bigTimer: 0, titleTimer: 0, damage: 0, lastHealth: 100, frames: 0, fpsTime: 0 };

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  function show(node, visible) { node.classList.toggle('hidden', !visible); }

  // The HUD is laid out for an 800 px tall window and scales with the window.
  function fit() { el.root.style.zoom = String(Math.max(0.7, Math.min(1.6, window.innerHeight / 800))); }
  window.addEventListener('resize', fit);
  fit();

  function updateWanted() {
    const w = game.wanted;
    const level = w.level;
    // Pursuits need a driving HUD, not the full free-roam dashboard. CSS keeps the
    // objective, heat, minimap and survival information dominant while collapsing
    // secondary cards. This is runtime state, so staged shots and normal play match.
    el.root.classList.toggle('pursuit', level > 0);
    starEls.forEach((s, i) => s.classList.toggle('on', i < level));
    el.stars.classList.toggle('flash', w.evading);
    show(el.wantedTag, level > 0);
    if (level > 0) {
      el.wantedTag.className = w.evading ? 'search' : 'seen';
      setText(el.wantedTag, w.evading ? `SEARCH ZONE · ${Math.round((1 - w.searchProgress) * 100)}% HEAT` : 'IN SIGHT · SEARCH ZONE FOLLOWS YOU');
    }
  }

  const hud = {
    minimap,
    toast: toasts.toast,
    clearToasts: toasts.clear,
    setVisible(v) { show(el.root, v); },
    setObjective(text) { mission.setObjective(text); },
    setTimer(seconds) { mission.setTimer(seconds); },
    setTargetHealth(fraction, label) { mission.setTargetHealth(fraction, label); },
    /** A help box at the top centre; shown while called each frame, or for `seconds`. */
    prompt(text, seconds = 0) {
      state.promptText = text;
      state.promptTimer = Math.max(state.promptTimer, seconds);
      el.prompt.innerHTML = text.replace(/\b(E|F|T|R|H|M|Space|Shift|Esc)\b(?= to| for)/g, '<kbd>$1</kbd>');
      show(el.prompt, true);
    },
    notify(text) { toasts.toast(text, '', '#9ad1ff'); },
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
    radioToast() { radio.flash(); },
    setWasted(on) { el.wasted.style.opacity = on ? '1' : '0'; },
    setLetterbox(on) { el.letterbox.classList.toggle('on', on); },
    /** Hides the chapter title card and the big banner at once (screenshots, menus). */
    clearBanners() { show(el.titlecard, false); show(el.big, false); state.titleTimer = 0; state.bigTimer = 0; },
    showEnding() { setTimeout(() => game.ui.showEnding(), game.shotMode ? 0 : 9000); },
    update(dt) {
      const p = game.player;
      const h = p.human;
      const dn = game.world.dayNight;
      setText(el.clock, dn.clockText());
      setText(el.daypart, dayPart(dn.state.hour));
      // Cash counts up smoothly.
      if (game.shotMode) state.displayedCash = game.state.cash;
      if (state.displayedCash !== game.state.cash) {
        const diff = game.state.cash - state.displayedCash;
        state.displayedCash += Math.abs(diff) < 3 ? diff : Math.round(diff * Math.min(1, dt * 6));
        el.cash.classList.toggle('gain', diff > 0);
      } else el.cash.classList.remove('gain');
      setText(el.cash, `$${Math.max(0, state.displayedCash).toLocaleString('en-US')}`);
      updateWanted();
      // The LOOT counter: the take a story job or a heist is carrying right now.
      const loot = game.heists?.loot ?? game.missions.active?.data?.loot ?? 0;
      show(el.loot, loot > 0);
      if (loot > 0) setText(el.lootAmount, `$${Math.round(loot).toLocaleString('en-US')}`);
      // Health and armour.
      const hp = Math.max(0, h.health / h.maxHealth);
      el.health.style.width = `${hp * 100}%`;
      el.healthBar.classList.toggle('low', hp < 0.3);
      el.armor.style.width = `${Math.max(0, h.armor)}%`;
      setText(el.healthNum, String(Math.max(0, Math.round(h.health))));
      setText(el.armorNum, String(Math.max(0, Math.round(h.armor))));
      if (h.health < state.lastHealth - 0.5) state.damage = Math.min(1, state.damage + (state.lastHealth - h.health) / 25);
      state.lastHealth = h.health;
      state.damage = Math.max(hp < 0.25 && h.alive ? 0.35 + Math.sin(game.clock * 5) * 0.1 : 0, state.damage - dt * 1.5);
      el.damage.style.opacity = state.damage.toFixed(2);
      show(el.crosshair, !p.vehicle && h.alive && p.isAiming && p.inventory.current !== 'fists');
      // Components.
      mission.render();
      dispatch.render(dt);
      weapons.render();
      radio.render(dt);
      vehicle.render();
      respect.render();
      district.render();
      heist.render();
      payoutScreen.update(dt);
      toasts.update(dt);
      minimap.draw();
      // Timed elements.
      if (state.promptTimer > 0) state.promptTimer -= dt;
      else if (state.promptText === null) show(el.prompt, false);
      state.promptText = null;
      if (state.bigTimer > 0) { state.bigTimer -= dt; if (state.bigTimer <= 0) show(el.big, false); }
      if (state.titleTimer > 0) { state.titleTimer -= dt; if (state.titleTimer <= 0) show(el.titlecard, false); }
      if (game.settings.showFps) {
        state.frames += 1; state.fpsTime += dt;
        if (state.fpsTime > 0.5) { setText(el.fps, `${Math.round(state.frames / state.fpsTime)} fps`); state.frames = 0; state.fpsTime = 0; }
      }
      show(el.fps, game.settings.showFps);
    },
  };
  return hud;
}
