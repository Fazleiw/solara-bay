// The heist board: Juno's corkboard of scores and Dani's career, opened at the gold $ marker
// across from the Marisol Savings & Loan. Left, the three targets (the bank job open, the
// Lumen & Co. Jewel Grab and The Pike Pier Score still locked); centre, the chosen job's
// approach, crew and cuts, and the estimated take against Dani's cut; right, completion and
// career stats. E starts the bank job; walking away closes the board.
import { CREW, VAULT_BAGS } from '../heists/heistRules.js';
import { CHAPTERS } from '../missions/chapters.js';
import { rankFor } from '../progression/respect.js';

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export const SCORES = [
  { id: 'marisol', name: 'Marisol Savings & Loan', place: 'Solstice St · Deco Row', kind: 'BANK JOB', est: VAULT_BAGS.reduce((a, b) => a + b, 0), color: '#ffd23f' },
  { id: 'lumen', name: 'Lumen & Co. Jewel Grab', place: 'Centro Blvd · Vista Centro', kind: 'SMASH & GRAB', est: 112000, color: '#3ef2ff', lock: 'Gold medal on the Marisol job' },
  { id: 'pier', name: 'The Pike Pier Score', place: 'Coral Strand pier', kind: "PIKE'S STASH", est: 240000, color: '#ff6b6b', lock: 'Finish Ironwake Reckoning' },
];

export function createHeistBoard(game, root) {
  const el = document.createElement('section');
  el.id = 'heist-board';
  el.className = 'hidden';
  root.appendChild(el);

  function completion() {
    const s = game.state;
    const heists = s.heists?.career?.jobs ? 1 : 0;
    const parts = [s.storyProgress / CHAPTERS.length, (s.medallions?.length ?? 0) / 25, heists / SCORES.length];
    return Math.round(((parts[0] * 0.6 + parts[1] * 0.2 + parts[2] * 0.2)) * 100);
  }

  function render() {
    const s = game.state;
    const rec = s.heists ?? { marisol: { runs: 0, best: 0, medal: null }, career: { take: 0, bags: 0, jobs: 0 } };
    const job = SCORES[0];
    const crewCut = CREW.reduce((sum, c) => sum + c.cut, 0);
    const rank = rankFor(s.respect ?? 0);
    const pct = completion();
    el.innerHTML = `
      <div class="board">
        <header><small>JUNO'S BOARD · SOLARA BAY</small><h1>THE SCORES</h1><span class="board-cash">${money(s.cash)}</span></header>
        <div class="board-cols">
          <ol class="board-targets">
            ${SCORES.map((t, i) => `<li class="${t.lock ? 'locked' : 'open'}${i === 0 ? ' chosen' : ''}" style="--c:${t.color}">
              <small>${t.kind}</small><b>${t.name}</b><span>${t.place}</span>
              <em>${t.lock ? `LOCKED · ${t.lock}` : rec.marisol.medal ? `BEST ${rec.marisol.medal.toUpperCase()} · ${money(rec.marisol.best)}` : 'OPEN · AFTER DARK'}</em>
              <i>EST. ${money(t.est)}</i></li>`).join('')}
          </ol>
          <div class="board-plan">
            <h2>${job.name}</h2>
            <div class="plan-approach"><small>APPROACH</small><b>LOUD AFTER DARK</b><span>Beat the silent alarm to the vault door, drill it in the green, bag four sacks, run for Tavo's car before the Bay Police box in Solstice St.</span></div>
            <ul class="plan-crew">
              ${CREW.map((c) => `<li><kbd>${c.key}</kbd><span><b>${c.name}</b><small>${c.role} · ${c.ability}</small></span><em>${c.cut}%</em><i>${money((job.est * c.cut) / 100)}</i></li>`).join('')}
              <li class="dani"><kbd>★</kbd><span><b>Dani Reyes</b><small>Driver · the plan</small></span><em>${100 - crewCut}%</em><i>${money((job.est * (100 - crewCut)) / 100)}</i></li>
            </ul>
            <div class="plan-split"><div><small>THE TAKE</small><b>${money(job.est)}</b></div><div class="bar"><i style="width:${100 - crewCut}%"></i></div><div><small>YOUR CUT</small><b class="gold">${money((job.est * (100 - crewCut)) / 100)}</b></div></div>
            <p class="plan-go"><kbd>E</kbd> START THE JOB · walk away to close</p>
          </div>
          <aside class="board-career">
            <div class="career-ring" style="--p:${pct}"><b>${pct}%</b><small>COMPLETE</small></div>
            <dl>
              <dt>Respect</dt><dd>RANK ${rank.rank} · ${rank.title}</dd>
              <dt>Chapters</dt><dd>${s.storyProgress}/${CHAPTERS.length}</dd>
              <dt>Heists pulled</dt><dd>${rec.career.jobs}</dd>
              <dt>Career take</dt><dd>${money(rec.career.take)}</dd>
              <dt>Bags carried</dt><dd>${rec.career.bags}</dd>
              <dt>Cars stolen</dt><dd>${s.stats?.carsStolen ?? 0}</dd>
              <dt>Sun Medallions</dt><dd>${s.medallions?.length ?? 0}/25</dd>
            </dl>
          </aside>
        </div>
      </div>`;
  }

  const board = {
    get isOpen() { return !el.classList.contains('hidden'); },
    open() { render(); el.classList.remove('hidden'); },
    close() { el.classList.add('hidden'); },
  };
  return board;
}
