// Deterministic screenshot scenes behind ?shot=. Each sets up a moment with the real systems
// (missions, traffic, police, gangs, the HUD), then plays the simulation forward for a few
// seconds with scripted controls, so the frame is a genuine moment of play:
//   cover   golden hour on Ocean Promenade, Dani beside a Vantor RS, the first mission running
//   drive   dusk drive up Luz Ave through Vista Centro traffic, radio on
//   police  a four-star chase at nightfall: cruisers, roadblock and helicopter (rear view)
//   mission Ironwake Reckoning: a gunfight with the Saltjaw Crew at their dockside yard
import { STEP } from '../config.js';
import { giveWeapon } from '../combat/weapons.js';
import { freshState } from '../gameplay/session.js';

function prepare(game, hour, progress) {
  game.state = { ...freshState(), cash: 18450 + progress * 3125, storyProgress: progress, medallions: [0, 3, 5, 8, 11, 14, 19] };
  game.world.dayNight.setHour(hour);
  game.world.dayNight.state.frozen = true;
  game.collectibles.build();
  game.missions.refreshStartMarker();
}

function populate(game, x, z, cars, peds, carMin = 30, carMax = 140) {
  for (let i = 0; i < cars; i += 1) game.traffic.spawnNear(x, z, carMin, carMax);
  for (let i = 0; i < peds; i += 1) game.peds.spawnNear(x, z, 6, 45);
}

function run(game, tools, seconds, keys = [], { aim = false, fire = false, lookBack = false, onStep = null } = {}) {
  const { simulate, input } = tools;
  input.simulate([...keys, ...(lookBack ? ['KeyC'] : [])]);
  input.state.aim = aim;
  input.state.fire = fire;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    onStep?.();
    simulate(STEP);
    game.camera.update(STEP, input, game.settings);
    game.dialogue.update(STEP);
    game.effects.update(STEP, game.camera.camera, 720);
    game.hud.update(STEP);
    input.consumePresses();
  }
}

/** Places a traffic car on a lane at (x, z) heading `heading` at `speed`. */
function trafficCar(game, type, x, z, heading, speed, color) {
  const net = game.world.network;
  const v = game.vehicles.spawn(type, x, z, heading, color ? { color } : {});
  v.vx = Math.sin(heading) * speed;
  v.vz = Math.cos(heading) * speed;
  const near = net.nearestEdge(x, z);
  const a = net.node(near.edge.a), b = net.node(near.edge.b);
  const towardB = (b.x - a.x) * Math.sin(heading) + (b.z - a.z) * Math.cos(heading) > 0;
  game.traffic.attachDriver(v, towardB ? a.id : b.id, towardB ? b.id : a.id);
  return v;
}

const SCENES = {
  cover(game, tools) {
    prepare(game, 17.75, 0);
    const p = game.player;
    p.teleport(322, 18, -1.75);
    const car = game.vehicles.spawn('vantor', 318.5, 12.5, -2.3, { color: '#ff6b1a' });
    car.persistent = true;
    populate(game, 285, 0, 10, 16, 40, 150);
    trafficCar(game, 'solcab', 283.5, 40, 0, 9);
    trafficCar(game, 'mirela', 276.5, -10, Math.PI, 10, '#e8e4dc');
    trafficCar(game, 'tessaro', 283.5, -50, 0, 8, '#a8dadc');
    trafficCar(game, 'haulden', 276.5, 75, Math.PI, 9, '#3a5a40');
    game.missions.startById('homecoming');
    game.camera.alignBehind(-1.75, 0.0);
    run(game, tools, 3.0);
    p.human.heading = -1.95;
    game.camera.state.yaw = -1.72;
    game.camera.state.pitch = -0.03;
    run(game, tools, 1.0);
  },

  drive(game, tools) {
    prepare(game, 19.45, 2);
    game.audio.radio.setStation(0);
    const p = game.player;
    const car = game.vehicles.spawn('vantor', 3.5, 40, Math.PI, { color: '#e0115f' });
    p.teleport(car.x + 2, car.z);
    p.enterVehicle(car);
    car.vx = 0; car.vz = -17;
    game.camera.alignBehind(Math.PI, 0.16);
    trafficCar(game, 'mirela', 3.5, -18, Math.PI, 9, '#f1faee');
    trafficCar(game, 'tessaro', 3.5, -58, Math.PI, 8, '#457b9d');
    trafficCar(game, 'solcab', -3.5, -40, 0, 10);
    trafficCar(game, 'haulden', -3.5, -95, 0, 10, '#e9c46a');
    trafficCar(game, 'cruzer', -3.5, 5, 0, 9);
    trafficCar(game, 'mirela', -40, -66.5, Math.PI / 2, 8, '#c8102e');
    populate(game, 0, -40, 6, 18, 60, 150);
    run(game, tools, 2.2, ['KeyW']);
    game.hud.radioToast(game.audio.radio.stations[0]);
    game.gps.setTarget(70, -280, '#ffd23f');
    run(game, tools, 0.3, ['KeyW']);
  },

  police(game, tools) {
    prepare(game, 19.95, 3);
    const p = game.player;
    const car = game.vehicles.spawn('mirela', 276.5, -150, 0, { color: '#f4a261' });
    p.teleport(car.x + 2, car.z);
    p.enterVehicle(car);
    car.vz = 22;
    game.camera.alignBehind(0, 0.12);
    populate(game, 276, -60, 6, 12, 70, 160);
    game.wanted.setLevel(4);
    game.police.spawnUnitAt(276.5, -168, 0).car.vz = 23;
    game.police.spawnUnitAt(272.5, -186, 0.05).car.vz = 24;
    game.police.spawnUnitAt(280, -205, 0).car.vz = 23;
    run(game, tools, 3.4, ['KeyW']);
    // The player glances back over the shoulder with the mouse.
    game.camera.state.yaw = car.heading + 2.72;
    game.camera.state.pitch = 0.24;
    run(game, tools, 0.06, ['KeyW']);
    // Nobody standing right in front of the lens.
    const cam = game.camera.camera.position;
    for (const ped of [...game.peds.peds]) if (Math.hypot(ped.human.x - cam.x, ped.human.z - cam.z) < 9) game.peds.remove(ped);
    run(game, tools, 0.06, ['KeyW']);
  },

  mission(game, tools) {
    prepare(game, 17.35, 4);
    const p = game.player;
    p.teleport(-178, 343, Math.PI);
    game.missions.startById('reckoning');
    giveWeapon(p.inventory, 'smg', 120);
    p.inventory.current = 'smg';
    game.camera.alignBehind(Math.PI + 0.05, 0.08);
    run(game, tools, 0.8, ['KeyW']);
    // Track a target through the crosshair the way a player's mouse would.
    const aimAt = (m) => {
      const cam = game.camera.camera.position;
      const dx = m.human.x - cam.x, dz = m.human.z - cam.z;
      game.camera.state.yaw = Math.atan2(dx, dz);
      game.camera.state.pitch = Math.atan2(cam.y - (m.human.y + 1.2), Math.hypot(dx, dz));
    };
    const targets = game.gangs.members.filter((m) => m.tag === 'yard').sort((a, b) => Math.hypot(a.human.x - p.human.x, a.human.z - p.human.z) - Math.hypot(b.human.x - p.human.x, b.human.z - p.human.z));
    for (const t of targets.slice(0, 2)) {
      run(game, tools, 0.35, [], { aim: true, onStep: () => aimAt(t) });
      run(game, tools, 0.9, [], { aim: true, fire: true, onStep: () => t.human.alive && aimAt(t) });
    }
    // Finish facing the warehouse door, where the rest of the crew is dug in.
    const door = { x: game.missions.active.def ? -175 : 0, z: 300 };
    const next = targets.filter((m) => m.human.alive).sort((a, b) => Math.hypot(a.human.x - door.x, a.human.z - door.z) - Math.hypot(b.human.x - door.x, b.human.z - door.z))[0] ?? targets[3];
    game.dialogue.clear();
    game.dialogue.say([{ who: 'tavo', text: "They're dug in behind the containers. Keep moving, Dani!" }]);
    run(game, tools, 0.5, [], { aim: true, onStep: () => aimAt(next) });
    run(game, tools, 0.25, [], { aim: true, fire: true, onStep: () => aimAt(next) });
  },
};

export function stageShot(name, game, tools) {
  const scene = SCENES[name] ?? SCENES.cover;
  game.player.controlsLocked = false;
  game.player.human.model.group.visible = true;
  scene(game, tools);
}
