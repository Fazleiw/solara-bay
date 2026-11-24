// The payout screen after a heist: the medal, the take, each crew member's cut and Dani's share,
// with the job's numbers (bags, drill jams, time in the green, alarm beaten or not). Any key or
// a few seconds closes it.
const MEDAL = { gold: ['GOLD', '#ffd23f'], silver: ['SILVER', '#d8e2ee'], bronze: ['BRONZE', '#e0915a'] };
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export function createPayoutScreen(game, root) {
  const el = document.createElement('section');
  el.id = 'heist-payout';
  el.className = 'hidden';
  root.appendChild(el);
  let timer = 0;

  function show(result, h) {
    const [label, color] = MEDAL[result.medal];
    const green = h.drillTime > 0 ? Math.round((h.greenTime / h.drillTime) * 100) : 0;
    el.innerHTML = `
      <div class="payout-card">
        <div class="payout-head"><small>HEIST COMPLETE</small><h2>MARISOL SAVINGS &amp; LOAN</h2></div>
        <div class="payout-medal" style="--medal:${color}"><div class="medal-disc">★</div><b>${label}</b></div>
        <div class="payout-take"><span>THE TAKE</span><b>${money(result.take)}</b></div>
        <ul class="payout-cuts">
          ${result.cuts.map((c) => `<li><span>${c.name}<small>${c.role}</small></span><em>${c.percent}%</em><b>${money(c.amount)}</b></li>`).join('')}
          <li class="dani"><span>Dani Reyes<small>Your cut${result.bonus ? ` · ${label.toLowerCase()} bonus ${money(result.bonus)}` : ''}</small></span><em>${result.daniPercent}%</em><b>${money(result.dani)}</b></li>
        </ul>
        <div class="payout-stats"><span>BAGS <b>${h.bags.length}/4</b></span><span>DRILL JAMS <b>${h.jams}</b></span><span>IN THE GREEN <b>${green}%</b></span><span>ALARM <b>${h.alarmTripped ? 'TRIPPED' : 'BEATEN'}</b></span></div>
        <p class="payout-hint">Press any key to continue</p>
      </div>`;
    el.classList.remove('hidden');
    timer = game.shotMode ? 1e9 : 9;
  }

  function hide() { el.classList.add('hidden'); }
  window.addEventListener('keydown', () => { if (!el.classList.contains('hidden') && !game.shotMode) hide(); });

  return {
    show,
    hide,
    update(dt) { if (timer > 0) { timer -= dt; if (timer <= 0) hide(); } },
  };
}
