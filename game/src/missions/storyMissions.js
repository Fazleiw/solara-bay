// The story of Solara Bay in six missions. Dani Reyes is out after six years inside for the
// Saltjaw Crew; Auntie Coco and Tavo help Dani get back on the road, get even with Gideon Pike
// and take the waterfront back:
//   1 Homecoming       steal a car and drive to Coco's taco shack
//   2 Showroom Special steal the Vantor RS and deliver it to Tavo, undamaged
//   3 Heat Wave        the garage is raided: lose a three-star wanted level
//   4 Tail Lights      chase and wreck the Saltjaw courier, recover the ledger
//   5 Ironwake Reckoning  take out the Saltjaw Crew at their dockside yard
//   6 Sunset Run       race the Vantor across the Causeway Bridge to stop Pike at Gull Key
import { giveWeapon } from '../combat/weapons.js';
import { attachRouteDriver } from '../ai/routeDriver.js';
import { LANDMARKS } from '../world/cityLayout.js';

const coco = LANDMARKS.cocoShack.front;
const tavo = LANDMARKS.tavoGarage;
const showroom = LANDMARKS.showroom;
const yard = LANDMARKS.warehouse;
const lighthouse = LANDMARKS.lighthouse;
const garageBay = { x: tavo.x, z: tavo.z - 13 };

export const STORY_MISSIONS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    tagline: 'Six years is a long time to be off the road.',
    giverLetter: 'C',
    start: { x: LANDMARKS.safehouse.front.x, z: LANDMARKS.safehouse.front.z + 4 },
    reward: 500,
    begin(ctx) {
      ctx.say([
        { who: 'coco', text: 'Dani! They really let you out. Six years, mija.' },
        { who: 'dani', text: 'Five years, eleven months. Not that I was counting.' },
        { who: 'coco', text: 'Borrow some wheels and come see me at the shack on Coral Strand.' },
      ]);
      ctx.data.step = 'car';
      ctx.objective('Steal a car: walk up to any car and press F');
    },
    update(ctx) {
      const p = ctx.game.player;
      if (ctx.data.step === 'car' && p.vehicle) {
        ctx.data.step = 'drive';
        ctx.objective('Drive to Coco Loco Tacos on the Coral Strand');
        ctx.waypoint(coco.x, coco.z, { radius: 5, label: 'Coco Loco Tacos' });
      }
      if (ctx.data.step === 'drive' && ctx.atWaypoint(7)) {
        ctx.pass(500, [
          { who: 'coco', text: 'Look at you. Skinny, pale, and still driving like the devil.' },
          { who: 'coco', text: "Go see Tavo at his paint shop in Deco Row. He's got work." },
        ]);
      }
    },
  },
  {
    id: 'showroom',
    title: 'Showroom Special',
    tagline: 'Tavo has a buyer. The buyer has taste.',
    giverLetter: 'T',
    start: { x: tavo.front.x, z: tavo.front.z },
    reward: 1500,
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'tavo', text: 'Dani Reyes, back from the dead! Come here.' },
        { who: 'tavo', text: 'I have a buyer for a Vantor RS. Lumière Motors keeps one on the plaza downtown.' },
        { who: 'tavo', text: 'Bring it here in one piece. Every scratch comes out of your cut.' },
      ]);
      const car = ctx.vehicle('vantor', showroom.x, showroom.z + 6, 0.6, { color: '#ff6b1a' });
      ctx.data.car = car;
      ctx.data.blip = ctx.track(car, '#5cc8ff', 'Vantor RS');
      ctx.data.step = 'steal';
      ctx.objective('Steal the Vantor RS from the Lumière Motors plaza');
      ctx.waypoint(car.x, car.z, { radius: 3, marker: false, label: 'Vantor RS' });
      ctx.onCleanup(() => { if (g.player.vehicle !== car && car.persistent === false) car.persistent = false; });
    },
    update(ctx) {
      const g = ctx.game;
      const car = ctx.data.car;
      if (car.destroyed) { ctx.fail('The Vantor was destroyed.'); return; }
      const inCar = g.player.vehicle === car;
      ctx.game.hud.setTargetHealth(car.health / car.type.health, 'Vantor condition');
      if (ctx.data.step === 'steal' && inCar) {
        ctx.data.step = 'deliver';
        g.wanted.setLevel(1);
        ctx.say([{ who: 'dispatch', text: 'Alarm at Lumière Motors, Vista Centro. Units respond.' }]);
        ctx.waypoint(garageBay.x, garageBay.z, { radius: 4, color: '#3ef2ff', label: "Tavo's garage" });
      }
      if (ctx.data.step === 'deliver') {
        if (!inCar) ctx.objective('Get back in the Vantor RS');
        else if (g.wanted.level > 0) ctx.objective('Lose the police, then bring the Vantor to Tavo');
        else ctx.objective("Deliver the Vantor RS to Tavo's garage in Deco Row");
        if (inCar && g.wanted.level === 0 && ctx.atWaypoint(4)) {
          const bonus = Math.round((car.health / car.type.health) * 1000);
          g.player.exitVehicle(true);
          car.controls.handbrake = true;
          ctx.pass(1500 + bonus);
          car.persistent = false;
        }
      }
    },
  },
  {
    id: 'heatwave',
    title: 'Heat Wave',
    tagline: 'Somebody tipped off the Bay Police.',
    giverLetter: 'T',
    chained: true,
    start: null,
    reward: 2000,
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'tavo', text: "Wait... that's a Cruzer outside. Somebody tipped them off!" },
        { who: 'tavo', text: 'Take my Haulden and drag them away from the shop. Go, go!' },
      ]);
      const truck = ctx.vehicle('haulden', garageBay.x - 6, garageBay.z - 2, Math.PI, { color: '#8b1e1e' });
      g.player.teleport(truck.x + 2, truck.z);
      g.player.enterVehicle(truck);
      g.wanted.setLevel(3);
      g.police.spawnUnitAt(tavo.x - 30, tavo.z - 35, Math.PI / 2);
      g.police.spawnUnitAt(tavo.x + 30, tavo.z - 35, -Math.PI / 2);
      ctx.objective('Lose the police: get out of their sight until the stars fade');
    },
    update(ctx) {
      if (ctx.game.wanted.level === 0) {
        ctx.pass(2000, [
          { who: 'tavo', text: "You're a ghost, Dani. Like the old days." },
          { who: 'tavo', text: 'Coco called. She says she has news about Pike. Go see her.' },
        ]);
      }
    },
  },
  {
    id: 'taillights',
    title: 'Tail Lights',
    tagline: "The Saltjaw ledger is on the move.",
    giverLetter: 'C',
    start: { x: coco.x, z: coco.z },
    reward: 2500,
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'coco', text: 'Gideon Pike runs the Saltjaw Crew now. The man who let you take the fall.' },
        { who: 'coco', text: "His courier is carrying the crew's ledger to the docks. Every bribe, every name." },
        { who: 'coco', text: 'Stop that van before it reaches the Saltjaw yard, and bring me the book.' },
      ]);
      const van = ctx.vehicle('tessaro', 70 + 3.5, -110, Math.PI, { color: '#3a1f1f' });
      van.health = van.type.health * 0.75;
      ctx.data.van = van;
      ctx.data.driver = attachRouteDriver(g, van, yard.x, yard.z + 30, { speed: 15 });
      ctx.data.blip = ctx.track(van, '#ff4040', 'Courier');
      ctx.data.step = 'chase';
      ctx.objective('Chase down and wreck the Saltjaw courier van');
      ctx.timer(150);
      g.gps.setTarget(van.x, van.z, '#ff4040');
    },
    update(ctx) {
      const g = ctx.game;
      const van = ctx.data.van;
      if (ctx.data.step === 'chase') {
        g.hud.setTargetHealth(Math.max(0, van.health) / van.type.health, 'Courier van');
        if (ctx.elapsed % 1 < 0.02) g.gps.setTarget(van.x, van.z, '#ff4040');
        if (ctx.data.driver.arrived && !van.destroyed) { ctx.fail('The courier reached the Saltjaw yard.'); return; }
        if (van.destroyed || van.health < van.type.health * 0.15) {
          if (van.ai) { van.ai = null; van.driver = null; g.peds.fromEjectedDriver(van); }
          ctx.data.step = 'ledger';
          ctx.untrack(ctx.data.blip);
          ctx.clearTimer();
          g.hud.setTargetHealth(null);
          const spot = van.localToWorld(van.type.width / 2 + 2.2, 0);
          ctx.data.ledger = { x: spot.x, z: spot.z };
          ctx.objective('Grab the ledger from the wreck');
          ctx.waypoint(spot.x, spot.z, { radius: 1.6, color: '#5cff8d', label: 'Ledger' });
        }
      } else if (ctx.data.step === 'ledger' && ctx.atWaypoint() && !g.player.vehicle) {
        ctx.data.step = 'return';
        g.audio?.sfx.pickup(false);
        ctx.objective('Bring the ledger to Coco on the Coral Strand');
        ctx.waypoint(coco.x, coco.z, { radius: 5, label: 'Coco Loco Tacos' });
      } else if (ctx.data.step === 'ledger' && ctx.atWaypoint() && g.player.vehicle) {
        g.hud.prompt('Get out of the car to pick up the ledger');
      } else if (ctx.data.step === 'return' && ctx.atWaypoint(7)) {
        ctx.pass(2500, [
          { who: 'coco', text: 'Ay, Dani. Half the harbour board is in here. And Pike signed every page.' },
          { who: 'coco', text: 'Tavo wants a word. He says it is time to visit Ironwake.' },
        ]);
      }
    },
  },
  {
    id: 'reckoning',
    title: 'Ironwake Reckoning',
    tagline: 'The Saltjaw Crew is about to have a very bad night.',
    giverLetter: 'T',
    start: { x: tavo.front.x, z: tavo.front.z },
    reward: 4000,
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'tavo', text: "The ledger says Pike is holed up at the Saltjaw yard, Ironwake Docks." },
        { who: 'tavo', text: "There's a Rattler SMG and a vest on the bench. Take them. Make some noise." },
        { who: 'dani', text: 'Six years of noise.' },
      ]);
      giveWeapon(g.player.inventory, 'smg', 150);
      g.player.inventory.current = 'smg';
      g.player.human.armor = 100;
      const spots = [[-12, 10, 'smg'], [12, 10, 'pistol'], [-4, 18, 'pistol'], [5, 22, 'smg'], [-20, 24, 'pistol'], [20, 12, 'pistol'], [0, -2, 'smg'], [10, 2, 'pistol']];
      for (const [ox, oz, weapon] of spots) g.gangs.spawnMember(yard.x + ox, yard.z + oz, { weapon, heading: Math.PI * 0.9, tag: 'yard' });
      ctx.data.step = 'travel';
      ctx.objective('Go to the Saltjaw yard at Ironwake Docks');
      ctx.waypoint(yard.x, yard.z + 30, { radius: 9, color: '#ff4040', label: 'Saltjaw yard', marker: false });
      ctx.onCleanup(() => { for (const m of g.gangs.members) if (m.tag === 'yard') m.tag = null; });
    },
    update(ctx) {
      const g = ctx.game;
      const left = g.gangs.aliveCount('yard');
      const p = g.player;
      if (ctx.data.step === 'travel' && (Math.hypot(p.x - yard.x, p.z - (yard.z + 10)) < 45 || left < 8)) {
        ctx.data.step = 'fight';
        ctx.clearWaypoint();
        for (const m of g.gangs.members) if (m.tag === 'yard') ctx.track(m.human, '#ff4040', 'Saltjaw');
      }
      if (ctx.data.step === 'fight') {
        ctx.objective(`Take out the Saltjaw Crew: ${left} left`);
        if (left === 0) {
          ctx.pass(4000, [
            { who: 'coco', text: "Pike wasn't there, Dani. He's running for his boat on Gull Key." },
            { who: 'coco', text: 'Come by the shack. We end this at sundown.' },
          ]);
        }
      }
    },
  },
  {
    id: 'sunsetRun',
    title: 'Sunset Run',
    tagline: "Pike's boat leaves Gull Key at sundown.",
    giverLetter: 'C',
    start: { x: coco.x, z: coco.z },
    reward: 10000,
    begin(ctx) {
      const g = ctx.game;
      g.wanted.clear();
      g.police.reset();
      ctx.say([
        { who: 'coco', text: "Tavo left the Vantor out front. He says it's 'on loan'." },
        { who: 'dani', text: 'Then let us see what it can do.' },
        { who: 'coco', text: 'Over the Causeway Bridge to the lighthouse. Do not stop for anything.' },
      ]);
      const car = ctx.vehicle('vantor', 283.5, -12, Math.PI, { color: '#ffd23f' });
      g.player.teleport(car.x - 2.5, car.z);
      g.player.enterVehicle(car);
      g.camera.alignBehind(car.heading);
      ctx.data.car = car;
      ctx.data.checkpoints = [[280, -70], [280, -140], [280, -210], [210, -210], [140, -210], [70, -210], [70, -280], [140, -280], [lighthouse.front.x, lighthouse.front.z]];
      ctx.data.index = 0;
      ctx.data.step = 'race';
      ctx.timer(70);
      const [x, z] = ctx.data.checkpoints[0];
      ctx.waypoint(x, z, { radius: 8, label: 'Checkpoint' });
      ctx.objective(`Race to Gull Key lighthouse · checkpoint 1 / ${ctx.data.checkpoints.length}`);
    },
    update(ctx) {
      const g = ctx.game;
      if (ctx.data.step === 'race') {
        if (ctx.atWaypoint()) {
          ctx.data.index += 1;
          g.audio?.sfx.checkpoint();
          const cps = ctx.data.checkpoints;
          if (ctx.data.index >= cps.length) {
            ctx.data.step = 'boss';
            ctx.clearTimer();
            ctx.clearWaypoint();
            const pike = g.gangs.spawnMember(lighthouse.x - 8, lighthouse.z - 24, { weapon: 'smg', guard: false, health: 260, tag: 'pike' });
            pike.human.look.hat = null;
            ctx.data.pike = pike;
            for (const [ox, oz] of [[-16, -16], [6, -26], [-2, -18]]) g.gangs.spawnMember(lighthouse.x + ox, lighthouse.z + oz, { weapon: 'pistol', guard: false, tag: 'pike' });
            ctx.track(pike.human, '#ff2020', 'Gideon Pike');
            ctx.say([
              { who: 'pike', text: 'Reyes? You should have stayed inside, where it was safe.' },
              { who: 'dani', text: 'You should have learned to drive your own getaway, Pike.' },
            ]);
            ctx.objective('Stop Gideon Pike');
          } else {
            const [x, z] = cps[ctx.data.index];
            ctx.waypoint(x, z, { radius: ctx.data.index === cps.length - 1 ? 6 : 8, label: 'Checkpoint' });
            ctx.objective(`Race to Gull Key lighthouse · checkpoint ${ctx.data.index + 1} / ${cps.length}`);
          }
        }
      } else if (ctx.data.step === 'boss') {
        const pike = ctx.data.pike.human;
        g.hud.setTargetHealth(Math.max(0, pike.health) / pike.maxHealth, 'Gideon Pike');
        if (!pike.alive) {
          ctx.pass(10000, [
            { who: 'coco', text: 'It is over, mija. The ledger goes to the papers in the morning.' },
            { who: 'tavo', text: 'Solara Bay is yours now, Dani. Try not to scratch it.' },
            { who: 'dani', text: 'No promises.' },
          ]);
          g.hud.showEnding();
        }
      }
    },
  },
];
