// Menus and full-screen panels: the title screen (Continue, New Game, Controls, The Story),
// the story intro, the pause menu with its city map, brief, settings and controls tabs, the
// Bayside Arms shop, and the ending card.
import { saveSettings } from '../core/save.js';
import { CAST, STORY_INTRO } from '../missions/cast.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { MEDALLIONS } from '../missions/collectibles.js';
import { createMapScreen } from './mapScreen.js';

const $ = (id) => document.getElementById(id);

export const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['Mouse', 'Look around'], ['Shift', 'Sprint'], ['Space', 'Jump · handbrake drift'],
  ['F', 'Steal / enter / exit a car'], ['Left click', 'Shoot · punch'], ['Right click', 'Aim'], ['1-4 · wheel · Q', 'Switch weapon'],
  ['R', 'Reload · next radio station'], ['H', 'Horn'], ['E', 'Interact · police siren'], ['T', 'Taxi fares in a Solcab'],
  ['C', 'Look behind'], ['M', 'City map'], ['Esc / P', 'Pause'],
];

function controlsHtml() {
  return `<div class="controls-grid">${CONTROLS.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div>`;
}

export function createMenus(game, mapCanvas, handlers) {
  const titleScreen = $('screen-title');
  const titlePanel = $('title-panel');
  const pauseScreen = $('screen-pause');
  const pauseBody = $('pause-body');
  const shopScreen = $('screen-shop');
  const introScreen = $('screen-intro');
  const endingScreen = $('screen-ending');
  const mapCanvasEl = $('pause-map');
  const legend = $('map-legend');
  const mapScreen = createMapScreen(game, mapCanvasEl, mapCanvas, legend);
  let tab = 'map';
  let tabPanel = null;

  const click = () => game.audio?.sfx.uiSelect();

  // ---- Title ----
  function showTitle(hasSave) {
    titleScreen.classList.remove('hidden');
    $('btn-continue').disabled = !hasSave;
    titlePanel.classList.add('hidden');
  }
  $('btn-continue').addEventListener('click', () => { click(); handlers.onContinue(); });
  $('btn-new').addEventListener('click', () => { click(); handlers.onNewGame(); });
  $('btn-controls').addEventListener('click', () => {
    click();
    titlePanel.innerHTML = `<h2>Controls</h2>${controlsHtml()}`;
    titlePanel.classList.toggle('hidden');
  });
  $('btn-about').addEventListener('click', () => {
    click();
    titlePanel.innerHTML = `<h2>The Story</h2>${STORY_INTRO.map((l) => `<p style="margin:0 0 10px;font:15px/1.5 Arial">${l}</p>`).join('')}
      ${['dani', 'coco', 'tavo', 'pike'].map((k) => `<p style="margin:6px 0;font:14px/1.45 Arial"><b style="color:${CAST[k].color}">${CAST[k].name}</b> · ${CAST[k].bio}</p>`).join('')}`;
    titlePanel.classList.toggle('hidden');
  });

  // ---- Intro ----
  function playIntro(done) {
    introScreen.classList.remove('hidden');
    const box = $('intro-lines');
    box.innerHTML = STORY_INTRO.map((l) => `<p>${l}</p>`).join('');
    const lines = [...box.children];
    let finished = false;
    const timers = lines.map((p, i) => setTimeout(() => p.classList.add('show'), 400 + i * 2300));
    const finish = () => {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      introScreen.classList.add('hidden');
      introScreen.removeEventListener('click', finish);
      done();
    };
    timers.push(setTimeout(finish, 400 + lines.length * 2300 + 1800));
    introScreen.addEventListener('click', finish);
  }

  // ---- Pause ----
  function renderTab() {
    for (const b of $('pause-tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
    mapCanvasEl.classList.toggle('hidden', tab !== 'map');
    legend.classList.toggle('hidden', tab !== 'map');
    tabPanel?.remove();
    tabPanel = null;
    if (tab === 'map') {
      mapScreen.layout();
      mapScreen.draw();
      return;
    }
    tabPanel = document.createElement('div');
    tabPanel.className = 'panel';
    tabPanel.style.flex = '1';
    tabPanel.style.overflow = 'auto';
    if (tab === 'controls') tabPanel.innerHTML = `<h2>Controls</h2>${controlsHtml()}`;
    if (tab === 'brief') tabPanel.innerHTML = briefHtml();
    if (tab === 'settings') buildSettings(tabPanel);
    pauseBody.appendChild(tabPanel);
  }

  function briefHtml() {
    const s = game.state;
    const missions = STORY_MISSIONS.map((m, i) => {
      const cls = i < s.storyProgress ? 'done' : i === s.storyProgress ? 'next' : 'locked';
      const mark = i < s.storyProgress ? '✔' : i === s.storyProgress ? '▶' : '·';
      return `<div class="${cls}">${mark} ${i + 1}. ${m.title}${i <= s.storyProgress ? ` <span style="opacity:.7">· ${m.tagline}</span>` : ''}</div>`;
    }).join('');
    const st = s.stats;
    return `<h2>Brief</h2><div class="brief">
      <section><h3>Story</h3>${missions}</section>
      <section><h3>Dani Reyes</h3><p>${CAST.dani.bio}</p></section>
      <section><h3>Progress</h3>
        <div>Cash: $${s.cash.toLocaleString()}</div>
        <div>Story missions: ${s.storyProgress} / ${STORY_MISSIONS.length}</div>
        <div>Sun Medallions: ${s.medallions.length} / ${MEDALLIONS.length}</div>
        <div>Taxi fares: ${st.taxiFares} · Taco runs: ${st.tacoRuns}</div>
        <div>Cars stolen: ${st.carsStolen} · Takedowns: ${st.kills}</div>
        <div>Times wasted: ${st.wasted} · Busted: ${st.busted}</div>
        <div>Distance driven: ${(st.distance / 1000).toFixed(1)} km</div></section>
      <section><h3>Side activities</h3><p>Press <b>T</b> in any yellow Solcab to take fares. Step into the orange marker at Coco Loco Tacos for a Taco Run. Bayside Arms in Mercado sells guns and armour. Once Tavo trusts you, drive into his garage forecourt for a respray that shakes off the police.</p></section>
    </div>`;
  }

  function buildSettings(panel) {
    const s = game.settings;
    const rows = [
      ['masterVolume', 'Master volume', 0, 1, 0.05], ['musicVolume', 'Radio volume', 0, 1, 0.05], ['sfxVolume', 'Effects volume', 0, 1, 0.05],
      ['mouseSensitivity', 'Mouse sensitivity', 0.3, 2.5, 0.1], ['drawDistance', 'Traffic density', 0.4, 1.4, 0.1],
    ];
    panel.innerHTML = `<h2>Settings</h2><div class="settings-grid">${rows.map(([k, label, min, max, step]) => `<label>${label}</label><input type="range" data-key="${k}" min="${min}" max="${max}" step="${step}" value="${s[k]}"><span>${s[k]}</span>`).join('')}
      <label>Invert mouse Y</label><input type="checkbox" data-key="invertY" ${s.invertY ? 'checked' : ''}><span></span>
      <label>Shadows</label><input type="checkbox" data-key="shadows" ${s.shadows ? 'checked' : ''}><span></span>
      <label>Show FPS</label><input type="checkbox" data-key="showFps" ${s.showFps ? 'checked' : ''}><span></span></div>`;
    panel.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.key;
        s[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        if (input.nextElementSibling && input.type !== 'checkbox') input.nextElementSibling.textContent = s[key];
        saveSettings(s);
        handlers.onSettings();
      });
    });
  }

  $('pause-tabs').addEventListener('click', (e) => {
    if (!e.target.dataset.tab) return;
    click();
    tab = e.target.dataset.tab;
    renderTab();
  });
  $('btn-resume').addEventListener('click', () => { click(); handlers.onResume(); });
  $('btn-save').addEventListener('click', () => { click(); game.autosave(); game.hud.notify('Game saved'); $('btn-save').textContent = 'Saved'; setTimeout(() => { $('btn-save').textContent = 'Save Game'; }, 1500); });
  $('btn-clear-waypoint').addEventListener('click', () => { click(); mapScreen.clearWaypoint(); mapScreen.draw(); });
  $('btn-quit').addEventListener('click', () => { click(); handlers.onQuit(); });

  // ---- Shop ----
  function renderShop(status = '') {
    $('shop-cash').textContent = `Cash: $${game.state.cash.toLocaleString()}`;
    $('shop-list').innerHTML = game.shops.items.map((item) => `<button data-id="${item.id}"><span>${item.label}${item.detail ? ` <small style="opacity:.6">· ${item.detail}</small>` : ''}</span><span>$${item.price.toLocaleString()}</span></button>`).join('');
    $('shop-status').textContent = status;
  }
  $('shop-list').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    renderShop(game.shops.buy(button.dataset.id));
  });
  $('btn-shop-close').addEventListener('click', () => { click(); handlers.onCloseShop(); });

  $('btn-ending-close').addEventListener('click', () => { click(); endingScreen.classList.add('hidden'); handlers.onResume(); });

  return {
    showTitle,
    hideTitle() { titleScreen.classList.add('hidden'); },
    playIntro,
    openPause(which = 'map') {
      tab = which;
      pauseScreen.classList.remove('hidden');
      renderTab();
    },
    closePause() { pauseScreen.classList.add('hidden'); },
    refreshPause() { if (!pauseScreen.classList.contains('hidden') && tab === 'map') mapScreen.draw(); },
    get pauseOpen() { return !pauseScreen.classList.contains('hidden'); },
    openShop() { renderShop(); shopScreen.classList.remove('hidden'); },
    closeShop() { shopScreen.classList.add('hidden'); },
    get shopOpen() { return !shopScreen.classList.contains('hidden'); },
    showEnding() { endingScreen.classList.remove('hidden'); handlers.onEnding(); },
    mapScreen,
  };
}
