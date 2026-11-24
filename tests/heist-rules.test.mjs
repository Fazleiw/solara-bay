import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALARM_SECONDS,
  CREW,
  DRILL,
  VAULT_BAGS,
  abilityReady,
  alarmStars,
  freshHeist,
  grabBag,
  heatBand,
  medalFor,
  payout,
  stepAlarm,
  stepDrill,
  useAbility,
} from '../game/src/heists/heistRules.js';

const STEP = 1 / 60;

test('the silent alarm trips once, when its clock runs out', () => {
  const h = freshHeist();
  let trips = 0;
  for (let t = 0; t < ALARM_SECONDS + 5; t += 0.5) if (stepAlarm(h, 0.5)) trips += 1;
  assert.equal(trips, 1);
  assert.equal(h.alarm, 0);
  assert.ok(h.alarmTripped);
});

test('an easy drill stays green and opens the vault without jamming', () => {
  const h = freshHeist();
  let open = false;
  for (let i = 0; i < 60 * 30 && !open; i += 1) open = stepDrill(h, STEP, false);
  assert.ok(open, 'vault opens');
  assert.equal(h.jams, 0);
  assert.equal(heatBand(h.heat), 'green');
});

test('leaning on the drill runs hot, jams in the red and needs to cool before it turns again', () => {
  const h = freshHeist();
  for (let i = 0; i < 60 * 10 && !h.jammed; i += 1) stepDrill(h, STEP, true);
  assert.ok(h.jammed, 'jammed');
  assert.equal(h.jams, 1);
  assert.ok(h.heat >= DRILL.red);
  const progress = h.drill;
  stepDrill(h, STEP, true);
  assert.equal(h.drill, progress, 'no progress while jammed');
  for (let i = 0; i < 60 * 10 && h.jammed; i += 1) stepDrill(h, STEP, false);
  assert.ok(!h.jammed && h.heat <= DRILL.unjamAt);
});

test("Juno's Z cools the drill, then waits out her cooldown", () => {
  const h = freshHeist();
  h.heat = 80;
  assert.ok(useAbility(h, 'juno'));
  assert.equal(h.heat, 35);
  assert.ok(!abilityReady(h, 'juno'));
  assert.equal(useAbility(h, 'juno'), false);
  stepAlarm(h, CREW.find((c) => c.id === 'juno').cooldown);
  assert.ok(abilityReady(h, 'juno'));
});

test('the alarm brings three stars, four once Dani carries most of the vault out', () => {
  const h = freshHeist();
  grabBag(h, VAULT_BAGS[0]);
  assert.equal(alarmStars(h), 3);
  grabBag(h, VAULT_BAGS[1]);
  grabBag(h, VAULT_BAGS[2]);
  assert.equal(alarmStars(h), 4);
});

test('medals: gold for a clean full take, silver for most of it, bronze otherwise', () => {
  const clean = freshHeist();
  for (let i = 0; i < 60 * 20; i += 1) stepDrill(clean, STEP, false);
  for (const v of VAULT_BAGS) grabBag(clean, v);
  assert.equal(medalFor(clean), 'gold');
  clean.alarmTripped = true;
  assert.equal(medalFor(clean), 'silver');
  const light = freshHeist();
  grabBag(light, VAULT_BAGS[0]);
  assert.equal(medalFor(light), 'bronze');
});

test("the crew's cuts and Dani's share add up to the take plus the medal bonus", () => {
  const h = freshHeist();
  for (let i = 0; i < 60 * 20; i += 1) stepDrill(h, STEP, false);
  for (const v of VAULT_BAGS) grabBag(h, v);
  const p = payout(h);
  const take = VAULT_BAGS.reduce((a, b) => a + b, 0);
  assert.equal(p.take, take);
  assert.equal(p.medal, 'gold');
  assert.equal(p.cuts.reduce((s, c) => s + c.amount, 0) + p.dani, take + p.bonus);
  assert.equal(p.daniPercent, 55);
});
