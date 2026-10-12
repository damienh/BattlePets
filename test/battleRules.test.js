import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  firstAffliction, playerGoesFirst, hitChance, rollHit, damageFor, turnsLeft,
  decayStatuses, applyEffects, catchable, rollCatch, withStatus,
} from '../src/game/battleRules.js';
import { createPet } from '../src/game/pet.js';
import { rand } from '../src/game/rng.js';

const tpl = (over = {}) => ({
  id: 0, name: 'T', toughness: 4, speed: 4, smarts: 4, resist: [0, 0, 0, 0, 0, 0, 0], spells: [0, 1, 2, 3, 4], ...over,
});
const zap = { damage: 1, effects: [0, 0, 0, 0, 0, 0, 0] };
const hypnotize = { damage: 0, effects: [0.5, 0, 0, 0, 0, 0, 0] };
const poisonBite = { damage: 1, effects: [0, 0.5, 0, 0, 0, 0, 0] };
const powerShell = { damage: -1, effects: [0, 0, 0, 0, -1, 0, 0] };

test('firstAffliction reports the first negative status only', () => {
  const pet = createPet(tpl(), 1);
  assert.equal(firstAffliction(pet), 0);
  assert.equal(firstAffliction(withStatus(pet, 2, -1)), 3);
  assert.equal(firstAffliction(withStatus(withStatus(pet, 1, -1), 2, -1)), 2);
  assert.equal(firstAffliction(withStatus(pet, 4, 1)), 0, 'buffs are positive');
});

test('player wins speed ties; status speed counts', () => {
  const p = createPet(tpl(), 1);
  const e = createPet(tpl(), 1);
  assert.equal(playerGoesFirst(p, tpl(), e, tpl()), true);
  assert.equal(playerGoesFirst(withStatus(p, 6, -1), tpl(), e, tpl()), false);
  assert.equal(playerGoesFirst(p, tpl({ speed: 3 }), withStatus(e, 6, -1.25), tpl()), true);
});

test('hit chance: base 10, smarts difference, easy and rookie bonuses for player only', () => {
  const base = { attackerTpl: tpl({ smarts: 6 }), defenderTpl: tpl({ smarts: 4 }) };
  const lvl2 = createPet(tpl(), 2);
  assert.equal(hitChance({ ...base, attacker: lvl2, isPlayer: true, difficulty: 1 }), 12);
  assert.equal(hitChance({ ...base, attacker: lvl2, isPlayer: true, difficulty: 0 }), 15);
  assert.equal(hitChance({ ...base, attacker: createPet(tpl(), 1), isPlayer: true, difficulty: 0 }), 18);
  assert.equal(hitChance({ ...base, attacker: createPet(tpl(), 1), isPlayer: false, difficulty: 0 }), 12);
});

test('accuracy debuff raises hit chance (original sign quirk), truncating toward zero', () => {
  const attacker = withStatus(createPet(tpl(), 2), 3, -0.75);
  const params = { attacker, attackerTpl: tpl({ smarts: 4 }), defenderTpl: tpl({ smarts: 5 }), isPlayer: false, difficulty: 1 };
  assert.equal(hitChance(params), 10); // trunc(4 + 0.75 - 5) = trunc(-0.25) = 0
});

test('rollHit compares rand()%20 against the chance; buffs always hit', () => {
  const params = { attacker: createPet(tpl(), 2), attackerTpl: tpl(), defenderTpl: tpl(), isPlayer: false, difficulty: 1 };
  const roll = rand(1).value % 20; // 41 % 20 = 1
  assert.equal(rollHit(params, zap, 1).hit, 10 > roll);
  const hopeless = { ...params, attackerTpl: tpl({ smarts: -100 }) };
  assert.equal(rollHit(hopeless, zap, 1).hit, false);
  assert.equal(rollHit(hopeless, powerShell, 1).hit, true);
  assert.equal(rollHit(params, zap, 1).seed, rand(1).seed);
});

test('damage = trunc(level * multiplier) + offense - defense, clamped', () => {
  const att = createPet(tpl(), 5);
  const def = createPet(tpl(), 5); // 20 hp
  assert.equal(damageFor(att, def, { damage: 2 }), 10);
  assert.equal(damageFor(withStatus(att, 5, 1), withStatus(def, 4, -1), { damage: 2 }), 12);
  assert.equal(damageFor(att, withStatus(def, 4, 20), { damage: 1 }), 0);
  assert.equal(damageFor(att, { ...def, hp: 3 }, { damage: 3 }), 3);
});

test('turnsLeft matches the "%d more turns" message', () => {
  assert.equal(turnsLeft(-1), 3);
  assert.equal(turnsLeft(-2), 7);
  assert.equal(turnsLeft(-0.25), 0);
});

test('decayStatuses ticks debuffs toward zero and leaves buffs alone', () => {
  const pet = { ...createPet(tpl(), 1), status: [-1, -0.25, 0, 2, -0.5, 0, 0] };
  assert.deepEqual(decayStatuses(pet).status, [-0.75, 0, 0, 2, -0.25, 0, 0]);
});

test('applyEffects: debuff lands when roll beats resistance', () => {
  const att = createPet(tpl(), 6);
  const def = createPet(tpl(), 1);
  // seed 1 -> rand 41 -> roll 0.41 > 0.4 resist
  const res = applyEffects({ attacker: att, defender: def, defenderTpl: tpl({ resist: [0, 0.4, 0, 0, 0, 0, 0] }), spell: poisonBite, seed: 1 });
  assert.deepEqual(res.effect, { index: 1, resisted: false, turns: 3 });
  assert.equal(res.defender.status[1], -1);
  assert.equal(res.defender.poisonDamage, 2);
});

test('applyEffects: roll <= resistance resists (even 0 vs 0)', () => {
  const def = createPet(tpl(), 1);
  const res = applyEffects({ attacker: createPet(tpl(), 1), defender: def, defenderTpl: tpl({ resist: [0.41, 0, 0, 0, 0, 0, 0] }), spell: hypnotize, seed: 1 });
  assert.deepEqual(res.effect, { index: 0, resisted: true });
  assert.equal(res.defender, def);
});

test('applyEffects: self buffs apply silently to the caster', () => {
  const res = applyEffects({ attacker: createPet(tpl(), 1), defender: createPet(tpl(), 1), defenderTpl: tpl(), spell: powerShell, seed: 7 });
  assert.equal(res.effect, null);
  assert.equal(res.attacker.status[4], 1);
  assert.equal(res.seed, 7, 'no random roll for buffs');
});

test('catchable at a quarter hp or 1 hp', () => {
  const e = createPet(tpl(), 2); // max 8
  assert.equal(catchable({ ...e, hp: 3 }, tpl()), false);
  assert.equal(catchable({ ...e, hp: 2 }, tpl()), true);
  assert.equal(catchable({ ...createPet(tpl({ toughness: 1 }), 1), hp: 1 }, tpl({ toughness: 1 })), true);
});

test('first catch always succeeds, later ones are 1 in 4', () => {
  assert.deepEqual(rollCatch(false, 5), { caught: true, seed: 5 });
  assert.equal(rollCatch(true, 1).caught, 41 % 4 === 0);
});
