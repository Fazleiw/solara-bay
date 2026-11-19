// HUD toasts at the top centre: short stacked cards with a title, a detail line and a colour
// stripe, for things that just happened: VEHICLE STOLEN · Vantor RS, "A witness called the
// police", +60 RESPECT, GAME SAVED, a new district. Each slides in and fades after a few
// seconds; at most four show at once.

export function createToasts(game) {
  const root = document.getElementById('hud-toasts');
  const live = [];

  function toast(title, detail = '', color = '#ffd23f', seconds = 3.6) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.style.setProperty('--accent', color);
    node.innerHTML = `<b></b><span></span>`;
    node.firstChild.textContent = title;
    node.lastChild.textContent = detail;
    root.appendChild(node);
    live.push({ node, time: game.shotMode ? 999 : seconds });
    while (live.length > 4) live.shift().node.remove();
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const t = live[i];
      t.time -= dt;
      if (t.time < 0.4) t.node.style.opacity = String(Math.max(0, t.time / 0.4));
      if (t.time <= 0) { t.node.remove(); live.splice(i, 1); }
    }
  }

  return { toast, update };
}
