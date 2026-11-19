// The safehouse in Palm Grove: press E at its door to save the game (core/save.js) and top up
// health. Dani's personal car, the one Tavo upgraded, waits at the kerb outside after a load.
import { LANDMARKS } from '../world/cityLayout.js';
import { createMarker } from '../gameplay/markers.js';

export function createSafehouse(game) {
  const door = LANDMARKS.safehouse.front;
  const marker = createMarker(game, door.x, door.z, '#7dffb3', { radius: 1.6, height: 4, label: 'Save' });

  /** Parks the saved personal car outside, with its upgrades. */
  function parkPersonalCar() {
    const saved = game.state.personalCar;
    if (!saved) return null;
    const car = game.vehicles.spawn(saved.type, door.x + 9, door.z - 6, Math.PI, { color: saved.color });
    Object.assign(car.tune, saved.tune);
    car.repair();
    car.persistent = true;
    car.personal = true;
    return car;
  }

  function update(input) {
    const p = game.player;
    if (p.vehicle || !marker.contains(p.x, p.z, 0.5)) return null;
    if (input.pressed('interact')) {
      p.human.health = p.human.maxHealth;
      game.autosave();
      game.hud.toast('GAME SAVED', 'Safehouse · Palm Grove', '#7dffb3');
    }
    return 'Press E to save your progress';
  }

  return { update, parkPersonalCar, marker };
}
