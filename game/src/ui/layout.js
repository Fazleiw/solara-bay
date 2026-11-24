// The interface markup: the HUD (mission card, police-response panel, clock, cash, wanted
// stars, weapon bar, toasts, minimap with district, health, armour and respect, radio and
// vehicle cards, dialogue box, garage menu, crosshair, big messages) and the full-screen panels
// (title, intro, pause with the city map, shop, ending). It is mounted into the page at boot,
// before the HUD and menu modules look up their elements.

const INTERFACE_HTML = `
<div id="hud" class="hidden">
  <div id="hud-damage"></div>
  <div id="hud-wasted"></div>
  <div id="letterbox"></div>

  <div id="hud-topleft">
    <section id="hud-mission" class="panel-card hidden">
      <header><span id="hud-mission-chapter"></span><span id="hud-timer" class="hidden"></span></header>
      <p id="hud-objective"></p>
      <div id="hud-target" class="hidden"><span id="hud-target-label"></span><div class="meter"><i id="hud-target-fill"></i></div></div>
      <div class="stage-row"><div id="hud-stage-segments"></div><span id="hud-stage-label"></span></div>
      <footer id="hud-mission-next"></footer>
    </section>
    <section id="hud-dispatch" class="panel-card hidden">
      <header><span>POLICE RESPONSE</span><span id="hud-dispatch-count"></span></header>
      <ol id="hud-dispatch-rows"></ol>
      <footer id="hud-dispatch-more"></footer>
    </section>
  </div>

  <div id="hud-topright">
    <div class="tr-row"><span id="hud-clock">18:00</span><span id="hud-daypart"></span></div>
    <div id="hud-cash">$0</div>
    <div id="hud-loot" class="hidden"><small>LOOT</small><b id="hud-loot-amount">$0</b></div>
    <div id="hud-stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>
    <div id="hud-wanted-tag" class="hidden"></div>
    <div id="hud-weapons"></div>
  </div>

  <div id="hud-toasts"></div>
  <div id="hud-prompt" class="hidden"></div>

  <div id="hud-bottomleft">
    <div id="hud-minimap-wrap"><canvas id="hud-minimap" width="440" height="440"></canvas></div>
    <div id="hud-status">
      <div id="hud-district"><i id="hud-district-dot"></i><div><b id="hud-area"></b><span id="hud-street"></span></div></div>
      <div id="hud-crew" class="hidden"></div>
      <div class="stat-bar health" id="hud-health-bar"><em>HEALTH</em><div class="meter"><i id="hud-health"></i></div><b id="hud-health-num">100</b></div>
      <div class="stat-bar armor"><em>ARMOR</em><div class="meter"><i id="hud-armor"></i></div><b id="hud-armor-num">0</b></div>
      <div id="hud-respect"><div class="respect-head"><b id="hud-respect-rank"></b><span id="hud-respect-title"></span></div><div class="meter gold"><i id="hud-respect-fill"></i></div><small id="hud-respect-xp"></small></div>
    </div>
  </div>

  <div id="hud-bottomright">
    <section id="hud-radio" class="panel-card hidden">
      <div class="radio-text"><b id="hud-radio-name"></b><span id="hud-radio-song"></span><small id="hud-radio-artist"></small></div>
      <canvas id="hud-eq" width="120" height="72"></canvas>
    </section>
    <section id="hud-vehicle" class="panel-card hidden">
      <header><span id="hud-vehicle-name"></span><span id="hud-vehicle-tune"></span></header>
      <div class="condition"><span>CONDITION</span><div class="meter"><i id="hud-vehicle-condition"></i></div><b id="hud-vehicle-condition-pct"></b></div>
      <div class="speed-row"><span id="hud-speed"></span><small>KM/H</small><span id="hud-gear"></span></div>
    </section>
  </div>

  <div id="hud-dialogue" class="hidden"><canvas id="hud-portrait" width="160" height="160"></canvas><div class="dialogue-text"><div class="who"><b id="hud-speaker"></b><span id="hud-role"></span></div><p id="hud-line"></p></div></div>
  <div id="hud-garage" class="hidden"></div>
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
