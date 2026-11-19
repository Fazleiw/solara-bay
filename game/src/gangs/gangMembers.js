// Crew soldiers in the street: missions and gang turf (gangs/territory.js) post them on guard.
// They stand watch until they spot an armed Dani, hear shots or get hurt, then fight with
// pistols and SMGs, and drop ammunition and cash when they fall.
import { rng } from '../core/random.js';
import { Human } from '../characters/human.js';
import { createShooterBrain, playerTarget, updateShooter } from '../ai/combatBrain.js';
import { CREWS } from './crews.js';

export function createGangs(game) {
  const members = [];

  function spawnMember(x, z, { crew = 'saltjaw', weapon = 'pistol', heading = 0, guard = true, health = 80, tag = null } = {}) {
    const def = CREWS[crew];
    const human = new Human(game, { x, z, heading, look: def.look(rng), role: 'gang', health });
    human.crew = def.name;
    const member = { human, crew, brain: createShooterBrain({ weapon, minRange: 5, maxRange: 22, skill: 0.55 }), alerted: !guard, homeX: x, homeZ: z, tag };
    human.weapon = weapon;
    members.push(member);
    return member;
  }

  function alertAll(x, z, radius) {
    for (const m of members) if (Math.hypot(m.human.x - x, m.human.z - z) < radius) m.alerted = true;
  }

  game.events.on('shotFired', ({ x, z }) => alertAll(x, z, 45));
  game.events.on('humanHurt', ({ human }) => {
    if (human.role === 'gang') alertAll(human.x, human.z, 30);
  });
  game.events.on('humanDied', ({ human }) => {
    if (human.role !== 'gang') return;
    const m = members.find((g) => g.human === human);
    if (m) game.pickups?.dropAmmo(human.x, human.z, m.brain.weapon);
    if (rng.chance(0.6)) game.pickups?.dropCash(human.x + 0.6, human.z, rng.int(40, 140));
  });

  function update(dt) {
    const target = playerTarget(game);
    // Turf soldiers leave Dani alone unless Dani is waving a gun around on their corner.
    const threat = game.player.isAiming && game.player.inventory.current !== 'fists';
    for (let i = members.length - 1; i >= 0; i -= 1) {
      const m = members[i];
      const h = m.human;
      if (h.alive && game.player.human.alive) {
        const d = Math.hypot(target.x - h.x, target.z - h.z);
        if (!m.alerted && d < 26 && (m.tag !== 'turf' || threat) && game.world.collision.lineOfSight(h.x, h.y + 1.6, h.z, target.x, target.y, target.z)) m.alerted = true;
        if (m.alerted) updateShooter(game, h, m.brain, target, dt);
        else {
          h.move(m.homeX - h.x, m.homeZ - h.z, Math.hypot(m.homeX - h.x, m.homeZ - h.z) > 1 ? 1.3 : 0);
          h.pose = 'idle';
        }
      } else {
        h.move(0, 0, 0);
        if (h.alive) h.pose = 'idle';
      }
      h.physics(dt);
      h.syncMesh(dt);
      if (!h.alive && h.deadTime > 40) { h.dispose(); members.splice(i, 1); }
    }
  }

  function clear() {
    for (const m of members) m.human.dispose();
    members.length = 0;
  }

  return { members, spawnMember, update, clear, alertAll, aliveCount: (tag) => members.filter((m) => m.human.alive && (!tag || m.tag === tag)).length };
}
