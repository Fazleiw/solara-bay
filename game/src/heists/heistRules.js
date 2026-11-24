// The rules of a heist, kept free of three.js and the DOM so node can test them
// (tests/heist-rules.test.mjs): the phases of the Marisol Savings & Loan job, the silent-alarm
// clock, Juno's vault drill and its heat meter, the loot bags, the crew's Z/X/C abilities with
// their cooldowns, the crew's cuts of the take and the gold / silver / bronze medal.

export const PHASES = ['getIn', 'drill', 'loot', 'alarm', 'escape', 'payout'];

export const PHASE_LABELS = {
  getIn: 'GET IN',
  drill: 'DRILL THE VAULT',
  loot: 'GRAB THE LOOT',
  alarm: 'THE ALARM',
  escape: 'GETAWAY',
  payout: 'PAYOUT',
};

/** Seconds before the bank's silent alarm reaches the Bay Police on its own. */
export const ALARM_SECONDS = 120;

/** Juno's drill: progress per second, heat per second while pushed or idling, and the bands. */
export const DRILL = { rate: 7, pushRate: 13, heat: 9, pushHeat: 26, cool: 22, green: 60, red: 88, unjamAt: 40 };

/** The bags in the vault; values in dollars, heaviest first. */
export const VAULT_BAGS = [21500, 18750, 16400, 14100];

/** Crew cuts of the take, in percent; Dani keeps the rest. */
export const CREW = [
  { id: 'juno', name: 'Juno Vale', role: 'Safecracker', cut: 20, key: 'Z', ability: 'COOL DRILL', cooldown: 25 },
  { id: 'tavo', name: 'Tavo Lin', role: 'Wheelman', cut: 15, key: 'X', ability: 'DECOY', cooldown: 40 },
  { id: 'coco', name: 'Auntie Coco', role: 'Fixer', cut: 10, key: 'C', ability: 'PATCH UP', cooldown: 45 },
];

/** A fresh run of the job. */
export function freshHeist() {
  return {
    phase: 'getIn',
    alarm: ALARM_SECONDS,
    alarmTripped: false,
    drill: 0,
    heat: 0,
    jammed: false,
    jams: 0,
    greenTime: 0,
    drillTime: 0,
    bags: [],
    loot: 0,
    cooldowns: { juno: 0, tavo: 0, coco: 0 },
    elapsed: 0,
  };
}

/** Counts the alarm down; once it reaches zero (or something trips it) the police are called. */
export function stepAlarm(h, dt) {
  h.elapsed += dt;
  for (const id of Object.keys(h.cooldowns)) h.cooldowns[id] = Math.max(0, h.cooldowns[id] - dt);
  if (h.alarmTripped) return false;
  h.alarm = Math.max(0, h.alarm - dt);
  if (h.alarm > 0) return false;
  h.alarmTripped = true;
  return true;
}

/** The heat band the HUD colours the meter with. */
export function heatBand(heat) {
  if (heat >= DRILL.red) return 'red';
  if (heat >= DRILL.green) return 'amber';
  return 'green';
}

/**
 * One step of the drill. `push` is the player holding E to lean on it: faster, but hotter.
 * In the red the bit jams and stops until it cools to DRILL.unjamAt. Returns true once the vault opens.
 */
export function stepDrill(h, dt, push) {
  h.drillTime += dt;
  if (h.jammed) {
    h.heat = Math.max(0, h.heat - DRILL.cool * dt);
    if (h.heat <= DRILL.unjamAt) h.jammed = false;
    return false;
  }
  h.heat = Math.min(100, h.heat + (push ? DRILL.pushHeat : DRILL.heat) * dt - (push ? 0 : DRILL.cool * 0.55 * dt));
  h.heat = Math.max(0, h.heat);
  if (heatBand(h.heat) === 'green') h.greenTime += dt;
  if (h.heat >= DRILL.red) {
    h.jammed = true;
    h.jams += 1;
    return false;
  }
  h.drill = Math.min(100, h.drill + (push ? DRILL.pushRate : DRILL.rate) * dt);
  return h.drill >= 100;
}

/** Dani shoulders a bag; returns its value. */
export function grabBag(h, value) {
  h.bags.push(value);
  h.loot += value;
  return value;
}

/** Whether a crew ability is ready, and firing it (which starts its cooldown). */
export const abilityReady = (h, id) => h.cooldowns[id] <= 0;
export function useAbility(h, id) {
  if (!abilityReady(h, id)) return false;
  const member = CREW.find((c) => c.id === id);
  h.cooldowns[id] = member.cooldown;
  if (id === 'juno') { h.heat = Math.max(0, h.heat - 45); h.jammed = false; }
  return true;
}

/** The police response the alarm brings: three stars, four once Dani is out with more than two bags. */
export function alarmStars(h) {
  return h.bags.length > 2 ? 4 : 3;
}

/**
 * Grades a finished job: gold for every bag, no jams and the alarm beaten, silver for most of the
 * take, bronze for getting out at all.
 */
export function medalFor(h) {
  const allBags = h.bags.length >= VAULT_BAGS.length;
  const clean = h.jams === 0 && h.drillTime > 0 && h.greenTime / h.drillTime >= 0.8;
  if (allBags && clean && !h.alarmTripped) return 'gold';
  if (h.bags.length >= VAULT_BAGS.length - 1) return 'silver';
  return 'bronze';
}

export const MEDAL_BONUS = { gold: 0.1, silver: 0.05, bronze: 0 };

/** Splits the take: each crew member's cut, then Dani's share plus the medal bonus. */
export function payout(h) {
  const take = h.loot;
  const medal = medalFor(h);
  const cuts = CREW.map((c) => ({ id: c.id, name: c.name, role: c.role, percent: c.cut, amount: Math.round((take * c.cut) / 100) }));
  const crewTotal = cuts.reduce((sum, c) => sum + c.amount, 0);
  const bonus = Math.round(take * MEDAL_BONUS[medal]);
  return { take, medal, cuts, bonus, dani: take - crewTotal + bonus, daniPercent: 100 - CREW.reduce((s, c) => s + c.cut, 0) };
}
