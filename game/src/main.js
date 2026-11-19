// Solara Bay: boot and the main loop. Builds the city and every system into one `game`
// object, then runs the screens (title, intro, play, pause, shop) with the world advancing in
// fixed 1/60 s steps and rendering once per frame.
//
// ?shot=cover|drive|police|mission&seed=N stages a screenshot scene from the real game code,
// renders it and sets window.__shotReady (see shots/shotScenes.js).
import * as THREE from 'three';
import { MAX_FRAME, POPULATION, STEP } from './config.js';
import { rng } from './core/random.js';
import { createInput } from './core/input.js';
import { createEventBus } from './core/events.js';
import { loadGame, loadSettings } from './core/save.js';
import { buildCity } from './world/cityGen.js';
import { LANDMARKS } from './world/cityLayout.js';
import { createFollowCamera } from './camera/followCamera.js';
import { createEffects } from './combat/effects.js';
import { createCombatSystem } from './combat/combatSystem.js';
import { createVehicleManager } from './vehicles/vehicleManager.js';
import { createPlayer } from './characters/player.js';
import { createPedestrians } from './characters/pedestrians.js';
import { createTraffic } from './ai/traffic.js';
import { createWantedSystem } from './ai/wanted.js';
import { createPolice } from './ai/police.js';
import { createGangs } from './ai/gangs.js';
import { createPickups } from './gameplay/pickups.js';
import { createGps } from './gameplay/gps.js';
import { createShops } from './gameplay/shops.js';
import { createSession, freshState } from './gameplay/session.js';
import { createCollectibles } from './missions/collectibles.js';
import { createMissionSystem } from './missions/missionSystem.js';
import { createSideJobs } from './missions/sideJobs.js';
import { buildMapCanvas } from './ui/mapRenderer.js';
import { createHud } from './ui/hud.js';
import { createDialogue } from './ui/dialogue.js';
import { createMenus } from './ui/menus.js';
import { mountInterface } from './ui/layout.js';
import { createAudioEngine } from './audio/audioEngine.js';
import { stageShot } from './shots/shotScenes.js';
import { runSelfTest } from './shots/selfTest.js';

window.addEventListener('error', (e) => reportError(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => reportError(String(e.reason)));
function reportError(text) {
  let pre = document.getElementById('errors');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'errors';
    pre.style.cssText = 'position:fixed;left:8px;bottom:8px;color:#f66;font:12px monospace;z-index:99;white-space:pre-wrap;max-width:60vw';
    document.body.appendChild(pre);
  }
  pre.textContent += `${text}\n`;
}

mountInterface(document.getElementById('ui'));

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
if (Number.isInteger(seedParam)) rng.reseed(seedParam);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();

/** The shared game context every system receives. */
const game = {
  scene,
  renderer,
  events: createEventBus(),
  humans: new Set(),
  markers: new Set(),
  blips: new Set(),
  routeDrivers: new Set(),
  settings: loadSettings(),
  state: freshState(),
  clock: 0,
  shotMode: !!shot,
  allowSpawning: true,
  population: { traffic: POPULATION.traffic, peds: POPULATION.peds },
};

game.world = buildCity(scene, renderer);
game.camera = createFollowCamera(game, window.innerWidth / window.innerHeight);
game.effects = createEffects(scene);
game.vehicles = createVehicleManager(game);
game.combat = createCombatSystem(game);
game.player = createPlayer(game, LANDMARKS.safehouse.front.x, LANDMARKS.safehouse.front.z);
game.peds = createPedestrians(game);
game.traffic = createTraffic(game);
game.wanted = createWantedSystem(game);
game.police = createPolice(game);
game.gangs = createGangs(game);
game.pickups = createPickups(game);
game.collectibles = createCollectibles(game);
game.gps = createGps(game);
game.missions = createMissionSystem(game);
game.side = createSideJobs(game);
game.shops = createShops(game);
const mapCanvas = buildMapCanvas(game.world.collision);
game.hud = createHud(game, mapCanvas);
game.dialogue = createDialogue(game, { box: document.getElementById('hud-dialogue'), portrait: document.getElementById('hud-portrait'), speaker: document.getElementById('hud-speaker'), line: document.getElementById('hud-line') });
game.audio = createAudioEngine(game);
game.audio.onRadioChange = (station) => game.hud.radioToast(station);
const session = createSession(game);
const input = createInput(canvas);

// Landmark blips shown when nearby.
for (const [key, letter, color] of [['safehouse', 'S', '#7dffb3'], ['hospital', '+', '#ff6b6b'], ['policeHQ', 'P', '#6fa8ff'], ['gunShop', 'A', '#ff5050'], ['tavoGarage', 'R', '#3ef2ff']]) {
  const mark = LANDMARKS[key];
  game.blips.add({ x: mark.front.x, z: mark.front.z, color, icon: 'letter', letter, size: 6, edge: false, label: mark.label });
}
game.police.parkCruisersAtHQ();
game.collectibles.build();

let mode = 'title';

function applySettings() {
  const s = game.settings;
  game.world.dayNight.sun.castShadow = s.shadows;
  game.population.traffic = Math.round(POPULATION.traffic * s.drawDistance);
  game.population.peds = Math.round(POPULATION.peds * s.drawDistance);
  game.audio.applySettings(s);
}
applySettings();

function startPlaying() {
  mode = 'play';
  game.ui.hideTitle();
  game.hud.setVisible(true);
  game.player.human.model.group.visible = true;
  game.player.controlsLocked = false;
  input.requestLock();
}

game.ui = createMenus(game, mapCanvas, {
  onNewGame() {
    game.audio.unlock();
    game.ui.hideTitle();
    mode = 'intro';
    game.ui.playIntro(() => { session.newGame(); startPlaying(); });
  },
  onContinue() { game.audio.unlock(); session.continueGame(); startPlaying(); },
  onResume() { resume(); },
  onQuit() {
    game.autosave();
    game.ui.closePause();
    showTitle();
  },
  onCloseShop() { game.ui.closeShop(); mode = 'play'; input.requestLock(); },
  onSettings: applySettings,
  onEnding() { mode = 'paused'; input.releaseLock(); },
});

function pause(tab = 'map') {
  if (mode !== 'play') return;
  mode = 'paused';
  input.releaseLock();
  game.ui.openPause(tab);
}
function resume() {
  game.ui.closePause();
  mode = 'play';
  input.requestLock();
}
const openShop = game.ui.openShop;
game.ui.openShop = () => { mode = 'shop'; input.releaseLock(); openShop(); };

function showTitle() {
  mode = 'title';
  game.hud.setVisible(false);
  game.player.controlsLocked = true;
  game.ui.showTitle(!!loadGame());
  game.world.dayNight.setHour(18.1);
  game.player.teleport(40, -70);
  game.player.human.model.group.visible = false;
}

// Losing pointer lock mid-game (Esc) opens the pause menu.
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && mode === 'play' && !game.shotMode) pause();
});

/** One fixed simulation step of the whole world. */
function simulate(dt) {
  game.clock += dt;
  game.player.update(dt, input);
  game.traffic.update(dt);
  for (const d of game.routeDrivers) {
    if (d.vehicle.ai !== d || !game.vehicles.list.includes(d.vehicle)) game.routeDrivers.delete(d);
    else d.update(dt);
  }
  game.police.update(dt);
  game.vehicles.update(dt);
  const h = game.player.human;
  h.physics(dt);
  h.syncMesh(dt);
  game.peds.update(dt);
  game.gangs.update(dt);
  game.pickups.update(dt);
  game.collectibles.update(dt);
  game.missions.update(dt);
}

/** Once-per-frame interactions that read key presses: shops, the save point and side jobs. */
function interactions(dt) {
  const shopPrompt = game.shops.update(input);
  const jobPrompt = game.side.update(dt, input);
  const prompt = shopPrompt ?? jobPrompt;
  if (prompt) game.hud.prompt(prompt);
}

let titleAngle = 0;
function frame(frameDt) {
  if (mode === 'play') {
    if (input.pressed('pause')) pause();
    else if (input.pressed('map')) pause('map');
  } else if (mode === 'paused' && (input.pressed('map') || input.pressed('pause')) && !game.shotMode) {
    resume();
  }

  if (mode === 'play') {
    const timeScale = session.update(frameDt);
    interactions(frameDt);
    accumulator += frameDt * timeScale;
    let first = true;
    while (accumulator >= STEP) {
      simulate(STEP);
      accumulator -= STEP;
      if (first) { input.consumePresses(); first = false; }
    }
    game.camera.update(frameDt, input, game.settings);
  } else if (mode === 'title' || mode === 'intro') {
    accumulator += frameDt;
    while (accumulator >= STEP) { simulate(STEP); accumulator -= STEP; }
    titleAngle += frameDt * 0.05;
    const cx = 60, cz = -120;
    game.camera.setPose(cx + Math.cos(titleAngle) * 260, 70, cz + Math.sin(titleAngle) * 260, cx, 25, cz, 55);
  }
  if (mode === 'paused') game.ui.refreshPause();

  const focus = game.player.vehicle ?? game.player.human;
  game.world.update(mode === 'paused' ? 0 : frameDt, new THREE.Vector3(focus.x, 0, focus.z), game.camera.camera);
  game.effects.update(mode === 'paused' ? 0 : frameDt, game.camera.camera, renderer.domElement.height);
  game.audio.update(frameDt, mode !== 'play');
  game.dialogue.update(mode === 'play' ? frameDt : 0);
  if (mode === 'play' || mode === 'paused' || mode === 'shop') game.hud.update(frameDt);
  renderer.render(scene, game.camera.camera);
  input.endFrame();
}

function resize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  game.camera.camera.aspect = w / h;
  game.camera.camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let accumulator = 0;
let last = performance.now();
let lastWidth = 0;
function loop(now) {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  if (canvas.clientWidth !== lastWidth) { lastWidth = canvas.clientWidth; resize(); }
  frame(dt);
  requestAnimationFrame(loop);
}

if (params.has('selftest')) {
  mode = 'play';
  game.shotMode = true;
  game.hud.setVisible(true);
  runSelfTest(game, { simulate, input, session, interactions }, reportError);
  renderer.render(scene, game.camera.camera);
  document.title = 'Solara Bay · selftest done';
} else if (shot) {
  mode = 'play';
  game.hud.setVisible(true);
  stageShot(shot, game, { simulate, input, session });
  resize();
  let painted = 0;
  const paint = () => {
    game.hud.update(1 / 60);
    game.world.update(0, new THREE.Vector3(game.player.x, 0, game.player.z), game.camera.camera);
    game.effects.update(0, game.camera.camera, renderer.domElement.height);
    renderer.render(scene, game.camera.camera);
    painted += 1;
    requestAnimationFrame(paint);
    if (painted === 3) {
      window.__shotReady = true;
      document.title = 'Solara Bay · ready';
      if (params.has('debug')) {
        const c = game.camera.camera.position, info = renderer.info.render;
        reportError(`cam ${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)} player ${game.player.x.toFixed(1)},${game.player.z.toFixed(1)} canvas ${canvas.width}x${canvas.height} calls ${info.calls} tris ${info.triangles} cars ${game.vehicles.list.length} humans ${game.humans.size}`);
      }
    }
  };
  requestAnimationFrame(paint);
} else {
  showTitle();
  requestAnimationFrame(loop);
}

window.__game = game;
