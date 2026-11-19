// The HUD vehicle card, bottom right while driving: the car's name, Tavo's upgrade pips
// (engine, armour, brakes), its condition bar, a big speedometer in km/h and the gear.

const $ = (id) => document.getElementById(id);

export function createVehicleCard(game) {
  const el = {
    card: $('hud-vehicle'), name: $('hud-vehicle-name'), tune: $('hud-vehicle-tune'), condition: $('hud-vehicle-condition'),
    conditionPct: $('hud-vehicle-condition-pct'), speed: $('hud-speed'), gear: $('hud-gear'),
  };

  function render() {
    const car = game.player.vehicle;
    el.card.classList.toggle('hidden', !car);
    if (!car) return;
    el.name.textContent = car.type.name.toUpperCase();
    const t = car.tune;
    el.tune.textContent = t.engine + t.armor + t.brakes ? `E${t.engine} · A${t.armor} · B${t.brakes}` : car.personal ? 'PERSONAL' : car.type.police ? 'POLICE' : 'STOCK';
    const c = car.condition;
    el.condition.style.width = `${c * 100}%`;
    el.condition.style.background = c > 0.6 ? 'linear-gradient(90deg,#47d16c,#9df07a)' : c > 0.3 ? 'linear-gradient(90deg,#f0a020,#ffd23f)' : 'linear-gradient(90deg,#d6283a,#ff6a5a)';
    el.conditionPct.textContent = `${Math.round(c * 100)}%`;
    el.speed.textContent = String(Math.round(Math.abs(car.fwdSpeed) * 3.6));
    const gear = car.gear;
    el.gear.textContent = typeof gear === 'number' ? `G${gear}` : gear;
  }

  return { render };
}
