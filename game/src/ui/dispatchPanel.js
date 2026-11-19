// The HUD police-response panel, under the mission card while the stars are up: each unit on
// the player from police/dispatch.js with its call sign, a car / helicopter / roadblock icon,
// its distance and a coloured status tag (RAMMING, PURSUIT, ROADBLOCK, SPOTLIGHT, FIRING,
// CODE 4), then how many more units are working the search zone.

const $ = (id) => document.getElementById(id);
const ICONS = {
  car: '<svg viewBox="0 0 28 16"><rect x="9" y="0" width="5" height="3" fill="#ff3348"/><rect x="14" y="0" width="5" height="3" fill="#3d7bff"/><path d="M2 9l3-5h18l3 5v4H2z" fill="#e8edf5"/><path d="M8 4.5h12l2 4H6z" fill="#1c2638"/><circle cx="8" cy="13" r="2.6" fill="#111"/><circle cx="20" cy="13" r="2.6" fill="#111"/></svg>',
  heli: '<svg viewBox="0 0 28 16"><rect x="1" y="1" width="26" height="1.6" fill="#e8edf5"/><rect x="13" y="1" width="2" height="4" fill="#e8edf5"/><ellipse cx="11" cy="9" rx="7" ry="4.5" fill="#e8edf5"/><path d="M17 8h10v2H17z" fill="#e8edf5"/><path d="M6 9a5 4 0 0 1 5-3v3z" fill="#1c2638"/><rect x="5" y="14" width="12" height="1.4" fill="#e8edf5"/></svg>',
  block: '<svg viewBox="0 0 28 16"><rect x="1" y="3" width="26" height="6" fill="#ff5a1f"/><path d="M4 3h4l-4 6H0zM12 3h4l-4 6H8zM20 3h4l-4 6h-4z" fill="#fff"/><rect x="4" y="9" width="2" height="6" fill="#ccc"/><rect x="22" y="9" width="2" height="6" fill="#ccc"/></svg>',
};

export function createDispatchPanel(game) {
  const el = { panel: $('hud-dispatch'), count: $('hud-dispatch-count'), rows: $('hud-dispatch-rows'), more: $('hud-dispatch-more') };
  let lastHtml = '';
  let timer = 0;

  function render(dt) {
    const level = game.wanted.level;
    el.panel.classList.toggle('hidden', level === 0);
    if (level === 0) return;
    timer -= dt;
    if (timer > 0 && lastHtml) return;
    timer = 0.25;
    const { rows, more } = game.police.roster(5);
    const html = rows.map((r) => `<li class="unit-${r.kind}"><i>${ICONS[r.kind]}</i><b>${r.callsign}</b><span>${Math.round(r.distance)} m</span><em style="--tag:${r.status.color}">${r.status.label}</em></li>`).join('');
    if (html !== lastHtml) { el.rows.innerHTML = html; lastHtml = html; }
    const total = rows.length + more;
    el.count.textContent = `${total} UNIT${total === 1 ? '' : 'S'}`;
    el.more.textContent = more > 0 ? `+${more} more unit${more === 1 ? '' : 's'} in the search zone` : game.wanted.evading ? 'Units sweeping the search zone' : 'All units on you';
  }

  return { render };
}
