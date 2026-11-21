// Deterministic screenshot scenes behind ?shot=. Each one stages a real moment with the game's
// own systems (chapters, traffic, the Bay Police, crews, the garage, the HUD), then plays the
// simulation forward with scripted controls, so every frame is a genuine moment of play:
//   cover   Gold Coast Getaway: a four-star sunset chase east down Palmera St, GULL ONE overhead,
//           a roadblock with spike strips ahead, Juno on the radio
//   beach   midday carjacking on Ocean Promenade by the pier and the Sol Wheel, a witness calls it in
//   neon    Velvet Static: a night shootout with the Velvet Knives under Deco Row's neon
//   payoff  Gold Coast Getaway: Dani completes the quiet Coco drop on foot in Coral Strand
import { STEP } from '../config.js';
import { giveWeapon } from '../combat/weapons.js';
import { freshState } from '../gameplay/session.js';
import { NEON_PALMS } from '../missions/chapters.js';
import { LANDMARKS, lineCoord } from '../world/cityLayout.js';

const EAST = Math.PI / 2;

function prepare(game, hour, progress, extra = {}) {
  game.state = { ...freshState(), cash: 18450 + progress * 3125, storyProgress: progress, medallions: [0, 3, 5, 8, 11, 14, 19], ...extra };
  game.world.dayNight.setHour(hour);
  game.world.dayNight.state.frozen = true;
  game.collectibles.build();
  game.missions.refreshStartMarker();
}

function populate(game, x, z, cars, peds, carMin = 30, carMax = 140) {
  for (let i = 0; i < cars; i += 1) game.traffic.spawnNear(x, z, carMin, carMax);
  for (let i = 0; i < peds; i += 1) game.peds.spawnNear(x, z, 6, 45);
}

/** Steps the whole game for `seconds` with keys held, like a player's frames at 60 fps. */
function run(game, tools, seconds, keys = [], { aim = false, fire = false, onStep = null } = {}) {
  const { simulate, input } = tools;
  input.simulate(keys);
  input.state.aim = aim;
  input.state.fire = fire;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    onStep?.(i);
    simulate(STEP);
    game.camera.update(STEP, input, game.settings);
    game.dialogue.update(STEP);
    game.effects.update(STEP, game.camera.camera, 800);
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

/** Clears pedestrians standing right in front of the lens. */
function clearLens(game, radius = 7) {
  const cam = game.camera.camera.position;
  for (const ped of [...game.peds.peds]) if (Math.hypot(ped.human.x - cam.x, ped.human.z - cam.z) < radius) game.peds.remove(ped);
}

/** Starts a chapter and fast-forwards it to stage `index` the way playing it would. */
function startChapterAt(game, id, index, objective) {
  const ctx = game.missions.startById(id);
  ctx.stage(index, objective);
  return ctx;
}

const SCENES = {
  cover(game, tools) {
    prepare(game, 18.2, 5, { respect: 2900 });
    const p = game.player;
    game.audio.radio.setStation(1);
    giveWeapon(p.inventory, 'pistol', 60);
    giveWeapon(p.inventory, 'smg', 180);
    p.inventory.current = 'smg';
    p.human.armor = 62;
    p.human.health = 78;
    // Gold Coast Getaway, stage 3: the case is in the car and the Bay Police are on the bumper.
    const ctx = startChapterAt(game, 'goldcoast', 2, "Outrun the four-star response and reach Tavo's garage");
    game.vehicles.remove(ctx.data.truck);
    const tavo = LANDMARKS.tavoGarage;
    ctx.waypoint(tavo.x, tavo.z - 13, { radius: 4.5, color: '#3ef2ff', label: "Tavo's garage" });
    ctx.timer(131.4);
    const car = game.vehicles.spawn('vantor', 170, -1.8, EAST, { color: '#12c8e0' });
    car.persistent = true;
    p.teleport(car.x, car.z - 2);
    p.enterVehicle(car);
    car.vx = 31;
    game.wanted.setLevel(4);
    // The pack on Dani's bumper: one dead astern, two flanking, one more behind.
    const units = [[164, 3.4], [158.5, 6.2], [156, 0.8], [151, -4.2]].map(([x, z]) => {
      const u = game.police.spawnUnitAt(x, z, EAST);
      u.car.vx = 31;
      return u;
    });
    trafficCar(game, 'solcab', 236, -3.5, -EAST, 6);
    trafficCar(game, 'mirela', 214, -3.5, -EAST, 8, '#f1faee');
    trafficCar(game, 'tessaro', lineCoord(9) - 3.5, 30, Math.PI, 6, '#a8dadc');
    populate(game, 200, 0, 4, 20, 50, 130);
    game.camera.alignBehind(EAST, 0.12);
    run(game, tools, 0.3, ['KeyW']);
    // Dispatch boxes the road in at the Promenade, the helicopter leans in over the chase.
    game.police.roadblocks.buildAt(lineCoord(8) + 14, 0, EAST);
    game.police.helicopter.placeAt(car.x + 30, 19, car.z - 1, 0);
    game.dialogue.clear();
    game.dialogue.say([{ who: 'juno', text: 'Roadblock at the Promenade! Thread the gap and do NOT touch the spikes, Dani!', duration: 30 }]);
    run(game, tools, 0.3, ['KeyW']);
    units[0].ramming = true;
    // A close chase camera that keeps Dani's car dominant while the police pack and route read clearly.
    const lead = game.player.vehicle ?? car;
    game.camera.setPose(lead.x - 14, 4.1, lead.z - 4, lead.x + 20, 2, lead.z + 1.4, 57);
    clearLens(game);
  },

  beach(game, tools) {
    prepare(game, 13.4, 3, { respect: 1450 });
    const p = game.player;
    game.audio.radio.setStation(2);
    giveWeapon(p.inventory, 'pistol', 36);
    const promenade = lineCoord(9);
    // A sedan waits at the lights where Palmera St meets the beach; Dani walks up to the door.
    const mark = trafficCar(game, 'mirela', promenade - 13, 3.5, EAST, 0, '#e0115f');
    mark.vx = mark.vz = 0;
    trafficCar(game, 'solcab', promenade - 3.5, 40, Math.PI, 8);
    trafficCar(game, 'tessaro', promenade + 3.5, -38, 0, 8, '#a8dadc');
    trafficCar(game, 'vantor', promenade + 3.5, -10, 0, 10, '#ffd23f');
    trafficCar(game, 'haulden', promenade - 60, -3.5, -EAST, 5, '#3a5a40');
    populate(game, promenade + 20, 10, 3, 18, 70, 150);
    for (let i = 0; i < 16; i += 1) game.peds.spawnNear(promenade + 25, 20, 4, 30);
    p.teleport(mark.x - 0.6, mark.z - 2.6, Math.PI / 2);
    game.camera.alignBehind(EAST, 0.12);
    run(game, tools, 0.3);
    // F: Dani hauls the driver out and takes the wheel.
    tools.input.tap('KeyF');
    run(game, tools, 0.1);
    game.wanted.setLevel(1);
    run(game, tools, 0.55, ['KeyW']);
    game.hud.toast('A WITNESS CALLED THE POLICE', 'Reported stolen vehicle', '#5aa0ff');
    run(game, tools, 0.1, ['KeyW']);
    const v = p.vehicle ?? mark;
    // Behind the car, looking down the boulevard to the beach, the pier and the Sol Wheel.
    game.camera.setPose(v.x - 12, 3.0, v.z - 5.5, v.x + 60, 5, v.z + 14, 62);
    clearLens(game, 4);
  },

  neon(game, tools) {
    prepare(game, 22.6, 3, { respect: 2100 });
    const p = game.player;
    game.audio.radio.setStation(0);
    giveWeapon(p.inventory, 'pistol', 60);
    giveWeapon(p.inventory, 'smg', 150);
    p.inventory.current = 'smg';
    p.human.armor = 45;
    p.human.health = 64;
    game.missions.startById('velvet');
    // Dani walks up Solstice St towards the Neon Palms, where the Knives are waiting.
    p.teleport(NEON_PALMS.x - 30, lineCoord(7) + 2.5, EAST);
    run(game, tools, 0.2);
    populate(game, NEON_PALMS.x, NEON_PALMS.z, 2, 4, 70, 140);
    game.camera.alignBehind(EAST, 0.04);
    const aimAt = (m) => {
      const cam = game.camera.camera.position;
      const dx = m.human.x - cam.x, dz = m.human.z - cam.z;
      game.camera.state.yaw = Math.atan2(dx, dz);
      game.camera.state.pitch = Math.atan2(cam.y - (m.human.y + 1.2), Math.hypot(dx, dz));
    };
    const knives = () => game.gangs.members.filter((m) => m.tag === 'velvet' && m.human.alive)
      .sort((a, b) => Math.hypot(a.human.x - p.human.x, a.human.z - p.human.z) - Math.hypot(b.human.x - p.human.x, b.human.z - p.human.z));
    const first = knives()[0];
    if (first) {
      run(game, tools, 0.3, [], { aim: true, onStep: () => aimAt(first) });
      run(game, tools, 0.8, [], { aim: true, fire: true, onStep: () => first.human.alive && aimAt(first) });
    }
    game.dialogue.clear();
    game.dialogue.say([{ who: 'mara', text: "Coco sends a jailbird to do her talking? Knives, cut it up.", duration: 30 }]);
    const next = knives()[0];
    if (next) {
      run(game, tools, 0.3, [], { aim: true, onStep: () => aimAt(next) });
      run(game, tools, 0.22, [], { aim: true, fire: true, onStep: () => aimAt(next) });
    }
    // Keep Dani and the next Knife large in frame, with the neon street still establishing Deco Row.
    const h = p.human, t = (next ?? first).human;
    const len = Math.hypot(t.x - h.x, t.z - h.z) || 1;
    const fx = (t.x - h.x) / len, fz = (t.z - h.z) / len;
    game.camera.setPose(h.x - fx * 4.6 - fz * 1.7, 2.25, h.z - fz * 4.6 + fx * 1.7, t.x, t.y + 1.25, t.z, 45);
    clearLens(game, 3);
  },

  payoff(game, tools) {
    prepare(game, 16.1, 5, { respect: 2750 });
    const p = game.player;
    giveWeapon(p.inventory, 'pistol', 60);
    giveWeapon(p.inventory, 'smg', 150);
    p.inventory.current = 'smg';
    const ctx = startChapterAt(game, 'goldcoast', 2, "Outrun the heat to Tavo's garage, or lose sight of the cops and slip into Coco's");
    game.vehicles.remove(ctx.data.truck);
    const coco = LANDMARKS.cocoShack;
    const drop = { x: lineCoord(9) + 3.5, z: coco.front.z - 10 };
    ctx.timer(74.2);
    ctx.waypoint(LANDMARKS.tavoGarage.x, LANDMARKS.tavoGarage.z - 13, { radius: 4.5, color: '#3ef2ff', label: "Tavo's garage" });
    p.teleport(drop.x, drop.z, Math.PI);
    populate(game, drop.x, drop.z, 4, 15, 35, 115);
    game.wanted.clear();
    game.police.reset();
    game.dialogue.clear();
    game.hud.clearBanners();
    // Two normal mission ticks: enter Coco's live objective, then award the authentic quiet-drop payout.
    run(game, tools, STEP * 2);
    game.dialogue.clear();
    game.camera.setPose(p.x - 5.8, 2.35, p.z - 5.4, p.x + 1.2, 1.45, p.z + 1.8, 53);
    clearLens(game, 3);
  },
};

export function stageShot(name, game, tools) {
  if (name === 'garage') name = 'payoff';
  const scene = SCENES[name] ?? SCENES.cover;
  game.player.controlsLocked = false;
  game.player.human.model.group.visible = true;
  scene(game, tools);
  if (name !== 'payoff') game.hud.clearBanners();
}
