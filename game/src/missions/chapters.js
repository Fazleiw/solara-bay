// The story of Solara Bay in eight chapters, each split into stages the HUD mission card shows
// (STAGE 2/4, NEXT: ...). Dani Reyes is out after six years inside for the Saltjaw Crew; Auntie
// Coco, Tavo and Juno help Dani get back on the road, break the Velvet Knives' grip on Deco Row,
// and take the waterfront back from Gideon Pike:
//   1 Homecoming          steal a car and drive to Coco's taco shack
//   2 Showroom Special    steal the Vantor RS and deliver it to Tavo, undamaged
//   3 Heat Wave           the garage is raided: lose a three-star wanted level
//   4 Velvet Static       a night shootout with the Velvet Knives in Deco Row, boss Mara Velasco
//   5 Tail Lights         chase and wreck the Saltjaw courier, recover the ledger
//   6 Gold Coast Getaway  hit an armored truck on the Promenade, outrun a four-star response to
//                         Tavo's garage, or slip into Coco's shack unseen for a smaller cut
//   7 Ironwake Reckoning  take out the Saltjaw Crew at their dockside yard
//   8 Sunset Run          race the Vantor across the Causeway Bridge to stop Pike at Gull Key
import { giveWeapon } from '../combat/weapons.js';
import { attachRouteDriver } from '../ai/routeDriver.js';
import { LANDMARKS, lineCoord } from '../world/cityLayout.js';

const coco = LANDMARKS.cocoShack.front;
const tavo = LANDMARKS.tavoGarage;
const showroom = LANDMARKS.showroom;
const yard = LANDMARKS.warehouse;
const lighthouse = LANDMARKS.lighthouse;
const garageBay = { x: tavo.x, z: tavo.z - 13 };
/** Coco's side door on Ocean Promenade, a block from the armored truck's route. */
const COCO_DROP = { x: lineCoord(9) + 3.5, z: coco.z - 10 };
/** The Neon Palms corner in Deco Row where the Velvet Knives hold court. */
export const NEON_PALMS = { x: lineCoord(6) + 18, z: lineCoord(7) - 8 };
/** The armored truck's run down Ocean Promenade, from Vista St to the Ironwake vaults: about 50 s at
 *  its pace, long enough to get from Tavo's garage to the Promenade and catch it. */
const TRUCK_START = { x: lineCoord(9) - 3.5, z: lineCoord(2) + 8 };
const TRUCK_SPEED = 10;

const ESCAPE_OBJECTIVE = "Follow the GPS to stash Pike's cash";

/**
 * Gold Coast Getaway's escape: two drops. Tavo's garage takes Dani in with the cruisers on the
 * bumper; Coco's side door is a block from the heist but only opens once no unit can see Dani,
 * and Coco keeps a cut. The GPS chooses the nearer route once, then stays stable so a turn at an
 * intersection cannot make the HUD and route flip back and forth.
 */
function updateEscape(ctx) {
  const g = ctx.game;
  const p = g.player;
  ctx.data.cocoDrop ??= ctx.spot(COCO_DROP.x, COCO_DROP.z, { radius: 4.5, color: '#ffb347', label: "Coco's side door" });
  const drop = ctx.data.cocoDrop;
  const toCoco = Math.hypot(p.x - drop.x, p.z - drop.z);
  const toTavo = Math.hypot(p.x - garageBay.x, p.z - garageBay.z);
  if (!ctx.data.gpsTo) {
    ctx.data.gpsTo = toCoco < toTavo ? 'coco' : 'tavo';
    if (ctx.data.gpsTo === 'coco') g.gps.setTarget(drop.x, drop.z, '#ffb347');
  }
  const seen = g.wanted.state.seen && g.wanted.level > 0;
  const routeCoco = ctx.data.gpsTo === 'coco';
  ctx.objective(routeCoco
    ? (seen ? "Coco needs you unseen — break police sight or take Tavo's marker" : "Coco is clear — follow GPS or take Tavo's marker")
    : "Follow GPS, or use the map and orange marker for Coco");
  ctx.data.routeCue = routeCoco
    ? [
        `GPS · COCO ${Math.round(toCoco)} m · UNSEEN · $4,500`,
        `MAP · TAVO ${Math.round(toTavo)} m · HEAT OK · $6,000`,
      ]
    : [
        `GPS · TAVO ${Math.round(toTavo)} m · HEAT OK · $6,000`,
        `MAP · COCO ${Math.round(toCoco)} m · UNSEEN · $4,500`,
      ];
  if (ctx.atWaypoint(12) && p.vehicle) {
    // Driving into Tavo's bay with the heat on: the door rolls down behind Dani.
    finishEscape(ctx, 'tavo', "Drop the cash at Tavo's garage");
  } else if (!seen && ctx.atSpot(drop, 8)) {
    finishEscape(ctx, 'coco', 'Hand the case to Coco');
  }
}

function finishEscape(ctx, drop, objective) {
  const g = ctx.game;
  g.wanted.clear();
  g.police.reset();
  ctx.clearTimer();
  ctx.data.drop = drop;
  delete ctx.data.routeCue;
  ctx.stage(3, objective);
}

export const CHAPTERS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    tagline: 'Six years is a long time to be off the road.',
    giverLetter: 'C',
    start: { x: LANDMARKS.safehouse.front.x, z: LANDMARKS.safehouse.front.z + 4 },
    reward: 500,
    stages: ['Steal a car', 'Drive to Coco Loco Tacos'],
    begin(ctx) {
      ctx.say([
        { who: 'coco', text: 'Dani! They really let you out. Six years, mija.' },
        { who: 'dani', text: 'Five years, eleven months. Not that I was counting.' },
        { who: 'coco', text: 'Borrow some wheels and come see me at the shack on Coral Strand.' },
      ]);
      ctx.stage(0, 'Steal a car: walk up to any car and press F');
    },
    update(ctx) {
      const p = ctx.game.player;
      if (ctx.stageIndex === 0 && p.vehicle) {
        ctx.stage(1, 'Drive to Coco Loco Tacos on the Coral Strand');
        ctx.waypoint(coco.x, coco.z, { radius: 5, label: 'Coco Loco Tacos' });
      }
      if (ctx.stageIndex === 1 && ctx.atWaypoint(7)) {
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
    stages: ['Steal the Vantor RS', 'Lose the alarm response', "Deliver it to Tavo's garage"],
    begin(ctx) {
      ctx.say([
        { who: 'tavo', text: 'Dani Reyes, back from the dead! Come here.' },
        { who: 'tavo', text: 'I have a buyer for a Vantor RS. Lumière Motors keeps one on the plaza downtown.' },
        { who: 'tavo', text: 'Bring it here in one piece. Every scratch comes out of your cut.' },
      ]);
      const car = ctx.vehicle('vantor', showroom.x, showroom.z + 6, 0.6, { color: '#ff6b1a' });
      ctx.data.car = car;
      ctx.track(car, '#5cc8ff', 'Vantor RS');
      ctx.stage(0, 'Steal the Vantor RS from the Lumière Motors plaza');
      ctx.waypoint(car.x, car.z, { radius: 3, marker: false, label: 'Vantor RS' });
    },
    update(ctx) {
      const g = ctx.game;
      const car = ctx.data.car;
      if (car.destroyed) { ctx.fail('The Vantor was destroyed.'); return; }
      const inCar = g.player.vehicle === car;
      g.hud.setTargetHealth(car.condition, 'Vantor condition');
      if (ctx.stageIndex === 0 && inCar) {
        g.wanted.setLevel(1);
        ctx.say([{ who: 'dispatch', text: 'Alarm at Lumière Motors, Vista Centro. Units respond.' }]);
        ctx.stage(1, 'Lose the police before you go near the garage');
        ctx.clearWaypoint();
      }
      if (ctx.stageIndex === 1 && g.wanted.level === 0) {
        ctx.stage(2, "Deliver the Vantor RS to Tavo's garage in Deco Row");
        ctx.waypoint(garageBay.x, garageBay.z, { radius: 4, color: '#3ef2ff', label: "Tavo's garage" });
      }
      if (ctx.stageIndex === 2) {
        if (!inCar) ctx.objective('Get back in the Vantor RS');
        else ctx.objective("Deliver the Vantor RS to Tavo's garage in Deco Row");
        if (inCar && g.wanted.level === 0 && ctx.atWaypoint(4)) {
          const bonus = Math.round(car.condition * 1000);
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
    stages: ['Take the Haulden', 'Lose the three-star heat'],
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
      ctx.stage(1, 'Lose the police: get out of their sight until the stars fade');
    },
    update(ctx) {
      if (ctx.game.wanted.level === 0) {
        ctx.pass(2000, [
          { who: 'tavo', text: "You're a ghost, Dani. Like the old days." },
          { who: 'coco', text: 'Dani, the Velvet Knives are squeezing my suppliers in Deco Row. Come see me.' },
        ]);
      }
    },
  },
  {
    id: 'velvet',
    title: 'Velvet Static',
    tagline: 'Deco Row glows pink. The Velvet Knives keep it that way.',
    giverLetter: 'C',
    start: { x: coco.x, z: coco.z },
    reward: 3000,
    stages: ['Drive to the Neon Palms', 'Break the shakedown', 'Take down Mara Velasco', 'Get clear of Deco Row'],
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'coco', text: 'Mara Velasco runs the Velvet Knives out of the Neon Palms club in Deco Row.' },
        { who: 'coco', text: 'Her soldiers bleed every kitchen on the strip. Mine included.' },
        { who: 'dani', text: "Then I'll go and settle the bill." },
      ]);
      if (!g.player.inventory.owned.pistol) giveWeapon(g.player.inventory, 'pistol', 48);
      ctx.stage(0, 'Drive to the Neon Palms club in Deco Row');
      ctx.waypoint(NEON_PALMS.x, NEON_PALMS.z + 20, { radius: 10, color: '#ff4fd8', label: 'Neon Palms', marker: false });
    },
    update(ctx) {
      const g = ctx.game;
      const p = g.player;
      if (ctx.stageIndex === 0 && Math.hypot(p.x - NEON_PALMS.x, p.z - NEON_PALMS.z) < 50) {
        ctx.clearWaypoint();
        const spots = [[-8, 6, 'pistol'], [6, 4, 'smg'], [-14, -2, 'pistol'], [12, -4, 'pistol'], [0, -10, 'smg'], [-4, 14, 'pistol']];
        for (const [ox, oz, weapon] of spots) g.gangs.spawnMember(NEON_PALMS.x + ox, NEON_PALMS.z + oz, { crew: 'velvet', weapon, guard: false, tag: 'velvet' });
        for (const m of g.gangs.members) if (m.tag === 'velvet') ctx.track(m.human, '#c04dff', 'Velvet Knife');
        ctx.say([{ who: 'mara', text: "Coco sends a jailbird to do her talking? Knives, cut it up." }]);
        ctx.stage(1, 'Break the shakedown: take out the Velvet Knives');
      }
      if (ctx.stageIndex === 1) {
        const left = g.gangs.aliveCount('velvet');
        ctx.objective(`Take out the Velvet Knives: ${left} left`);
        if (left === 0) {
          const mara = g.gangs.spawnMember(NEON_PALMS.x + 2, NEON_PALMS.z - 16, { crew: 'velvet', weapon: 'smg', guard: false, health: 240, tag: 'mara' });
          ctx.data.mara = mara;
          ctx.track(mara.human, '#ff2020', 'Mara Velasco');
          ctx.say([{ who: 'mara', text: 'You know what this street cost me? Come here and find out.' }]);
          ctx.stage(2, 'Take down Mara Velasco');
        }
      }
      if (ctx.stageIndex === 2) {
        const mara = ctx.data.mara.human;
        g.hud.setTargetHealth(Math.max(0, mara.health) / mara.maxHealth, 'Mara Velasco');
        if (!mara.alive) {
          g.wanted.setLevel(Math.max(2, g.wanted.level));
          ctx.say([{ who: 'dispatch', text: 'Shots fired outside the Neon Palms, Deco Row. All units.' }]);
          ctx.stage(3, 'Get clear of Deco Row and lose the police');
        }
      }
      if (ctx.stageIndex === 3 && g.wanted.level === 0) {
        g.state.crewsBroken = { ...(g.state.crewsBroken ?? {}), velvet: true };
        ctx.pass(3000, [
          { who: 'coco', text: 'The kitchens on the strip are cooking again. They know your name now, Dani.' },
          { who: 'coco', text: 'And the Saltjaw ledger is moving tonight. Come back to the shack.' },
        ]);
      }
    },
  },
  {
    id: 'taillights',
    title: 'Tail Lights',
    tagline: 'The Saltjaw ledger is on the move.',
    giverLetter: 'C',
    start: { x: coco.x, z: coco.z },
    reward: 2500,
    stages: ['Wreck the courier van', 'Grab the ledger', 'Bring it to Coco'],
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'coco', text: 'Gideon Pike runs the Saltjaw Crew now. The man who let you take the fall.' },
        { who: 'coco', text: "His courier is carrying the crew's ledger to the docks. Every bribe, every name." },
        { who: 'coco', text: 'Stop that van before it reaches the Saltjaw yard, and bring me the book.' },
      ]);
      const van = ctx.vehicle('tessaro', 70 + 3.5, -110, Math.PI, { color: '#3a1f1f' });
      van.health = van.maxHealth * 0.75;
      ctx.data.van = van;
      ctx.data.driver = attachRouteDriver(g, van, yard.x, yard.z + 30, { speed: 15 });
      ctx.data.blip = ctx.track(van, '#ff4040', 'Courier');
      ctx.stage(0, 'Chase down and wreck the Saltjaw courier van');
      ctx.timer(150);
      g.gps.setTarget(van.x, van.z, '#ff4040');
    },
    update(ctx) {
      const g = ctx.game;
      const van = ctx.data.van;
      if (ctx.stageIndex === 0) {
        g.hud.setTargetHealth(van.condition, 'Courier van');
        if (ctx.elapsed % 1 < 0.02) g.gps.setTarget(van.x, van.z, '#ff4040');
        if (ctx.data.driver.arrived && !van.destroyed) { ctx.fail('The courier reached the Saltjaw yard.'); return; }
        if (van.destroyed || van.condition < 0.15) {
          if (van.ai) { van.ai = null; van.driver = null; g.peds.fromEjectedDriver(van); }
          ctx.untrack(ctx.data.blip);
          ctx.clearTimer();
          g.hud.setTargetHealth(null);
          const spot = van.localToWorld(van.type.width / 2 + 2.2, 0);
          ctx.stage(1, 'Grab the ledger from the wreck');
          ctx.waypoint(spot.x, spot.z, { radius: 1.6, color: '#5cff8d', label: 'Ledger' });
        }
      } else if (ctx.stageIndex === 1 && ctx.atWaypoint()) {
        if (g.player.vehicle) g.hud.prompt('Get out of the car to pick up the ledger');
        else {
          g.audio?.sfx.pickup(false);
          ctx.stage(2, 'Bring the ledger to Coco on the Coral Strand');
          ctx.waypoint(coco.x, coco.z, { radius: 5, label: 'Coco Loco Tacos' });
        }
      } else if (ctx.stageIndex === 2 && ctx.atWaypoint(7)) {
        ctx.pass(2500, [
          { who: 'coco', text: 'Ay, Dani. Half the harbour board is in here. And Pike signed every page.' },
          { who: 'tavo', text: 'Pike pays his crew from a Solmark armored truck. I know its route. Come see me.' },
        ]);
      }
    },
  },
  {
    id: 'goldcoast',
    title: 'Gold Coast Getaway',
    tagline: "Pike's payroll rides the Promenade at sunset.",
    giverLetter: 'T',
    start: { x: tavo.front.x, z: tavo.front.z },
    reward: 6000,
    stages: ['Hit the Solmark armored truck', 'Grab the cash case', 'Outrun the Bay Police', "Stash the cash at Tavo's or Coco's"],
    begin(ctx) {
      const g = ctx.game;
      ctx.say([
        { who: 'tavo', text: "Pike's payroll rides a Bastion armored truck down Ocean Promenade every sundown." },
        { who: 'juno', text: "I'm Juno. I open the case, you do the driving. Deal?" },
        { who: 'dani', text: 'Deal. Get in.' },
      ]);
      const truck = ctx.vehicle('bastion', TRUCK_START.x, TRUCK_START.z, 0);
      ctx.data.truck = truck;
      ctx.data.driver = attachRouteDriver(g, truck, lineCoord(9) - 3.5, lineCoord(9), { speed: TRUCK_SPEED });
      ctx.data.blip = ctx.track(truck, '#ffd23f', 'Armored truck');
      ctx.stage(0, 'Ram the Bastion armored truck off the road on Ocean Promenade');
    },
    update(ctx) {
      const g = ctx.game;
      const truck = ctx.data.truck;
      if (ctx.stageIndex === 0) {
        g.hud.setTargetHealth(truck.condition, 'Armored truck');
        if (ctx.data.driver.arrived) { ctx.fail('The truck reached the Ironwake vaults.'); return; }
        if (truck.destroyed || truck.condition < 0.25) {
          if (truck.ai) { truck.ai = null; truck.driver = null; g.peds.fromEjectedDriver(truck); }
          ctx.untrack(ctx.data.blip);
          g.hud.setTargetHealth(null);
          const spot = truck.localToWorld(0, -truck.type.length / 2 - 2);
          ctx.stage(1, 'Grab the cash case from the back of the truck');
          ctx.waypoint(spot.x, spot.z, { radius: 1.8, color: '#5cff8d', label: 'Cash case' });
        }
      } else if (ctx.stageIndex === 1 && ctx.atWaypoint() && !g.player.vehicle) {
        g.audio?.sfx.pickup(true);
        g.wanted.setLevel(4);
        ctx.say([
          { who: 'dispatch', text: 'Armored car robbery, Ocean Promenade. GULL ONE, light them up.' },
          { who: 'juno', text: "Case is ours. Now drive like you mean it, Dani!" },
        ]);
        ctx.timer(180);
        ctx.stage(2, ESCAPE_OBJECTIVE);
        ctx.say([{ who: 'juno', text: "Tavo shuts his door on anyone. Coco's shack is closer, but she won't open with cops watching, and she takes a cut." }]);
        ctx.waypoint(garageBay.x, garageBay.z, { radius: 4.5, color: '#3ef2ff', label: "Tavo's garage" });
      } else if (ctx.stageIndex === 2) {
        updateEscape(ctx);
      } else if (ctx.stageIndex === 3) {
        const viaCoco = ctx.data.drop === 'coco';
        g.state.choices = { ...g.state.choices, goldcoastDrop: ctx.data.drop };
        ctx.pass(viaCoco ? 4500 : 6000, viaCoco ? [
          { who: 'coco', text: "In the cool room, under the carnitas. Nobody saw a thing, mija. My cut's already counted." },
          { who: 'juno', text: "Pike's money, gone without a trace. He won't even know who to blame." },
        ] : [
          { who: 'juno', text: "Forty grand of Pike's money. He'll feel that tonight." },
          { who: 'tavo', text: "Now he can't pay his crew. Time to visit Ironwake, Dani." },
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
    stages: ['Gear up', 'Reach the Saltjaw yard', 'Take out the Saltjaw Crew'],
    begin(ctx) {
      const g = ctx.game;
      const quiet = g.state.choices?.goldcoastDrop === 'coco';
      ctx.say([
        quiet
          ? { who: 'tavo', text: "Coco says you came in quiet. Pike's people still don't know who took the payroll." }
          : { who: 'tavo', text: "Pike's people saw my door roll down behind you. They know who took the payroll." },
        { who: 'tavo', text: 'The ledger says Pike is holed up at the Saltjaw yard, Ironwake Docks.' },
        { who: 'tavo', text: "There's a Rattler SMG and a vest on the bench. Take them. Make some noise." },
        { who: 'dani', text: 'Six years of noise.' },
      ]);
      giveWeapon(g.player.inventory, 'smg', 150);
      g.player.inventory.current = 'smg';
      g.player.human.armor = 100;
      const spots = [[-12, 10, 'smg'], [12, 10, 'pistol'], [-4, 18, 'pistol'], [5, 22, 'smg'], [-20, 24, 'pistol'], [20, 12, 'pistol'], [0, -2, 'smg'], [10, 2, 'pistol']];
      for (const [ox, oz, weapon] of spots) g.gangs.spawnMember(yard.x + ox, yard.z + oz, { weapon, heading: Math.PI * 0.9, tag: 'yard' });
      ctx.stage(1, 'Go to the Saltjaw yard at Ironwake Docks');
      ctx.waypoint(yard.x, yard.z + 30, { radius: 9, color: '#ff4040', label: 'Saltjaw yard', marker: false });
      ctx.onCleanup(() => { for (const m of g.gangs.members) if (m.tag === 'yard') m.tag = null; });
    },
    update(ctx) {
      const g = ctx.game;
      const left = g.gangs.aliveCount('yard');
      const p = g.player;
      if (ctx.stageIndex === 1 && (Math.hypot(p.x - yard.x, p.z - (yard.z + 10)) < 45 || left < 8)) {
        ctx.clearWaypoint();
        for (const m of g.gangs.members) if (m.tag === 'yard') ctx.track(m.human, '#ff4040', 'Saltjaw');
        ctx.stage(2, `Take out the Saltjaw Crew: ${left} left`);
      }
      if (ctx.stageIndex === 2) {
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
    stages: ['Race to Gull Key', 'Stop Gideon Pike'],
    begin(ctx) {
      const g = ctx.game;
      g.wanted.clear();
      g.police.reset();
      ctx.say([
        { who: 'coco', text: "Tavo left the Vantor out front. He says it's 'on loan'." },
        { who: 'dani', text: "Then let's see what it can do." },
        { who: 'coco', text: 'Over the Causeway Bridge to the lighthouse. Do not stop for anything.' },
      ]);
      const car = ctx.vehicle('vantor', 283.5, -12, Math.PI, { color: '#ffd23f' });
      g.player.teleport(car.x - 2.5, car.z);
      g.player.enterVehicle(car);
      g.camera.alignBehind(car.heading);
      ctx.data.checkpoints = [[280, -70], [280, -140], [280, -210], [210, -210], [140, -210], [70, -210], [70, -280], [140, -280], [lighthouse.front.x, lighthouse.front.z]];
      ctx.data.index = 0;
      ctx.timer(70);
      const [x, z] = ctx.data.checkpoints[0];
      ctx.waypoint(x, z, { radius: 8, label: 'Checkpoint' });
      ctx.stage(0, `Race to Gull Key lighthouse · checkpoint 1 / ${ctx.data.checkpoints.length}`);
    },
    update(ctx) {
      const g = ctx.game;
      if (ctx.stageIndex === 0) {
        if (!ctx.atWaypoint()) return;
        ctx.data.index += 1;
        g.audio?.sfx.checkpoint();
        const cps = ctx.data.checkpoints;
        if (ctx.data.index >= cps.length) {
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
          ctx.stage(1, 'Stop Gideon Pike');
        } else {
          const [x, z] = cps[ctx.data.index];
          ctx.waypoint(x, z, { radius: ctx.data.index === cps.length - 1 ? 6 : 8, label: 'Checkpoint' });
          ctx.objective(`Race to Gull Key lighthouse · checkpoint ${ctx.data.index + 1} / ${cps.length}`);
        }
      } else if (ctx.stageIndex === 1) {
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

// Chapter numbers for the HUD card ("CH 6 · GOLD COAST GETAWAY").
CHAPTERS.forEach((def, i) => { def.chapter = i + 1; });
