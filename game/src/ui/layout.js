// The interface markup: the HUD (clock, weapon, cash, stars, minimap, bars, location,
// speedometer, radio toast, prompts, objective, dialogue, crosshair, big messages) and the
// full-screen panels (title, intro, pause with the city map, shop, ending). It is mounted into
// the page at boot, before the HUD and menu modules look up their elements.

const INTERFACE_HTML = `
<div id="hud" class="hidden">
  <div id="hud-damage"></div>
  <div id="hud-wasted"></div>
  <div id="letterbox"></div>
  <div id="hud-topright">
    <div id="hud-clock">18:00</div>
    <div id="hud-weapon"><canvas id="hud-weapon-icon" width="184" height="80"></canvas><span id="hud-ammo"></span></div>
    <div id="hud-cash">$0</div>
    <div id="hud-stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>
    <div id="hud-timer" class="hidden"></div>
  </div>
  <div id="hud-minimap-wrap">
    <canvas id="hud-minimap" width="432" height="432"></canvas>
    <div id="hud-bars"><div class="bar health" id="hud-health-bar"><i id="hud-health"></i></div><div class="bar armor"><i id="hud-armor"></i></div></div>
  </div>
  <div id="hud-vehicle" class="hidden"><span id="hud-vehicle-name"></span><span id="hud-speed"></span></div>
  <div id="hud-location"><span id="hud-area"></span><span id="hud-street"></span></div>
  <div id="hud-radio" class="hidden"><b id="hud-radio-name"></b><span id="hud-radio-tag"></span></div>
  <div id="hud-prompt" class="hidden"></div>
  <div id="hud-notify"></div>
  <div id="hud-target" class="hidden"><span id="hud-target-label"></span><div class="bar"><i id="hud-target-fill"></i></div></div>
  <div id="hud-dialogue" class="hidden"><canvas id="hud-portrait" width="128" height="128"></canvas><div><b id="hud-speaker"></b><p id="hud-line"></p></div></div>
  <div id="hud-objective"></div>
  <div id="hud-crosshair" class="hidden"></div>
  <div id="hud-titlecard" class="hidden"><h2 id="hud-titlecard-name"></h2><p id="hud-titlecard-tag"></p></div>
  <div id="hud-big" class="hidden"><h1 id="hud-big-title"></h1><p id="hud-big-sub"></p></div>
  <div id="hud-fps" class="hidden"></div>
</div>

<div id="screen-title" class="screen hidden">
  <div class="title-block">
    <div class="logo"><div class="logo-sun"></div><h1>SOLARA<span>BAY</span></h1><p>THE GOLDEN COAST</p></div>
    <div class="menu" id="title-menu">
      <button id="btn-continue">Continue</button>
      <button id="btn-new">New Game</button>
      <button id="btn-controls">Controls</button>
      <button id="btn-about">The Story</button>
    </div>
    <div class="title-foot" id="title-foot">Dani Reyes is out after six years. Auntie Coco has work, Tavo has wheels, and Gideon Pike has a lot to answer for.</div>
  </div>
  <div class="panel hidden" id="title-panel" style="position:absolute;right:6vw;top:50%;transform:translateY(-50%);max-width:520px"></div>
</div>

<div id="screen-intro" class="screen hidden"><div id="intro-lines"></div><small>Click to skip</small></div>

<div id="screen-pause" class="screen hidden">
  <div class="pause-head">
    <h1>PAUSED</h1>
    <div class="tabs" id="pause-tabs">
      <button data-tab="map" class="on">Map</button>
      <button data-tab="brief">Brief</button>
      <button data-tab="settings">Settings</button>
      <button data-tab="controls">Controls</button>
    </div>
  </div>
  <div class="pause-body" id="pause-body">
    <canvas id="pause-map"></canvas>
    <div class="map-legend" id="map-legend"></div>
  </div>
  <div class="pause-actions">
    <button class="btn" id="btn-resume">Resume</button>
    <button class="btn" id="btn-save">Save Game</button>
    <button class="btn" id="btn-clear-waypoint">Clear Waypoint</button>
    <button class="btn" id="btn-quit">Quit to Title</button>
  </div>
</div>

<div id="screen-shop" class="screen hidden">
  <div class="panel"><h2>Bayside Arms</h2><div id="shop-cash"></div><div class="shop-list" id="shop-list"></div><div id="shop-status"></div><button class="btn" id="btn-shop-close">Leave</button></div>
</div>

<div id="screen-ending" class="screen hidden">
  <h1>SOLARA BAY</h1>
  <p>Pike is finished, the ledger is on its way to the papers, and the waterfront has a new name on everyone's lips. The city is yours: keep driving.</p>
  <button class="btn" id="btn-ending-close">Keep Playing</button>
</div>
`;

/** Inserts the interface into `root` (the page's #ui element). */
export function mountInterface(root) {
  root.innerHTML = INTERFACE_HTML;
}
