// The workshop menu at Tavo's Chrome & Paint (shops/garage.js), a panel over the live garage
// scene: the car's name, four stat bars (top speed, acceleration, braking, armour) that preview
// the highlighted upgrade, and the list of services with prices, stage pips and respect locks.
// W/S or the arrows choose, E or Enter buys, Esc or F drives out; the mouse works too.

const STAT_LABELS = [['speed', 'TOP SPEED'], ['accel', 'ACCELERATION'], ['brake', 'BRAKING'], ['armor', 'ARMOUR']];

export function createGarageMenu(game, { onClose }) {
  const root = document.getElementById('hud-garage');
  const state = { open: false, index: 0, status: '' };

  function car() { return game.player.vehicle; }

  function render() {
    const v = car();
    if (!v) return;
    const list = game.garage.services(v);
    state.index = Math.max(0, Math.min(list.length - 1, state.index));
    const sel = list[state.index];
    const now = game.garage.stats(v);
    const preview = sel?.upgrade && !sel.done && !sel.lockedRank ? game.garage.stats(v, sel.id) : now;
    const bars = STAT_LABELS.map(([key, label]) => {
      const a = Math.min(1, now[key]), b = Math.min(1, preview[key]);
      return `<div class="gstat"><span>${label}</span><div class="gbar"><i style="width:${(a * 100).toFixed(1)}%"></i>${b > a ? `<u style="left:${(a * 100).toFixed(1)}%;width:${((b - a) * 100).toFixed(1)}%"></u>` : ''}</div></div>`;
    }).join('');
    const rows = list.map((s, i) => {
      const pips = s.upgrade ? `<span class="pips">${Array.from({ length: s.stages }, (_, k) => `<i class="${k < s.stage ? 'on' : ''}"></i>`).join('')}</span>` : '';
      const price = s.done ? (s.upgrade ? 'MAXED' : 'OK') : s.lockedRank ? `RESPECT ${s.lockedRank}` : `$${s.price.toLocaleString('en-US')}`;
      const cls = [i === state.index ? 'sel' : '', s.done ? 'done' : '', s.lockedRank ? 'locked' : '', s.heat ? 'heat' : '', game.state.cash < s.price && !s.done ? 'poor' : ''].join(' ');
      return `<li class="${cls}" data-i="${i}"><div><b>${s.label}</b><small>${s.detail}</small></div>${pips}<em>${price}</em></li>`;
    }).join('');
    root.innerHTML = `
      <header><span>TAVO'S CHROME &amp; PAINT</span><b>$${game.state.cash.toLocaleString('en-US')}</b></header>
      <h3>${v.type.name}<small>${v.personal ? 'PERSONAL RIDE' : 'WALK-IN'} · CONDITION ${Math.round(v.condition * 100)}%</small></h3>
      <div class="gstats">${bars}</div>
      <ul class="gservices">${rows}</ul>
      <footer>${state.status || '<kbd>W</kbd><kbd>S</kbd> choose · <kbd>E</kbd> buy · <kbd>Esc</kbd> drive out'}</footer>`;
  }

  function buy() {
    const v = car();
    const sel = v && game.garage.services(v)[state.index];
    if (!sel) return;
    state.status = game.garage.buy(v, sel.id);
    render();
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    root.classList.add('hidden');
    document.getElementById('hud').classList.remove('garage-open');
    onClose();
  }

  root.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    const i = Number(li.dataset.i);
    if (i === state.index) buy();
    else { state.index = i; state.status = ''; render(); }
  });
  window.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') { state.index -= 1; state.status = ''; render(); }
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') { state.index += 1; state.status = ''; render(); }
    else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') buy();
    else if (e.code === 'Escape' || e.code === 'KeyF' || e.code === 'Backspace') close();
    else return;
    e.preventDefault();
  });

  return {
    open(index = 0) {
      if (!car()) return;
      state.open = true;
      state.index = index;
      state.status = '';
      root.classList.remove('hidden');
      // The menu takes the right of the screen: the radio and vehicle cards and the bay marker step aside.
      document.getElementById('hud').classList.add('garage-open');
      game.garage.marker.setVisible(false);
      game.garage.placeTavo();
      game.dialogue.say([{ who: 'tavo', text: game.wanted.level ? "Inside, quick! Fresh paint and new plates, and they'll never know it was you." : `Engine, armour, brakes... what are we doing to the ${car().type.name} today, Dani?` }]);
      render();
    },
    close,
    render,
    select(index) { state.index = index; render(); },
    get isOpen() { return state.open; },
  };
}
