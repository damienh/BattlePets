import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startBattle, tick, chooseSpell, retreat, requestChange, attemptCatch, selectSlot,
  PHASE, RESULT, textDelay, activePet,
} from '../src/game/battle.js';
import { createPet } from '../src/game/pet.js';

const noEffects = [0, 0, 0, 0, 0, 0, 0];
const spells = [
  { id: 0, name: 'Zap', damage: 1, effects: noEffects },
  { id: 1, name: 'Hypnotize', damage: 0, effects: [0.5, 0, 0, 0, 0, 0, 0] },
  { id: 2, name: 'Mega Zap', damage: 3, effects: noEffects },
  { id: 3, name: 'Power Shell', damage: -1, effects: [0, 0, 0, 0, -1, 0, 0] },
];
const tpl = (id, over = {}) => ({
  id, name: `Pet${id}`, toughness: 4, speed: 4, smarts: 4,
  resist: [0, 0, 0, 0, 0, 0, 0], spells: [0, 1, 2, 3, 0], ...over,
});
const pets = [
  tpl(0, { smarts: 50, speed: 9 }), // sure-hitting, fast player pet
  tpl(1, { smarts: 50, speed: 1 }), // sure-hitting, slow enemy
  tpl(2, { smarts: -50, speed: 1, toughness: 1 }), // harmless enemy
];
const ctx = { pets, spells, difficulty: 1, textSpeed: 5, caughtBefore: false };
const T = textDelay(5);

const empty = () => [null, null, null, null, null];
const setup = (over = {}) => ({
  party: [createPet(pets[0], 5, 'Mookie'), ...empty()],
  opponents: [{ petId: 2, level: 4 }],
  wild: true,
  seed: 1,
  ...over,
});

/** Tick until predicate holds (or fail after a bound); returns battle and collected messages. */
function runUntil(b0, pred, limit = 2000) {
  let b = b0;
  const messages = [b.message];
  const cues = [];
  for (let i = 0; i < limit; i += 1) {
    if (pred(b)) return { b, messages, cues };
    const r = tick(ctx, b);
    if (r.battle.message !== b.message) messages.push(r.battle.message);
    cues.push(...r.cues);
    b = r.battle;
  }
  throw new Error(`condition not reached; phase=${b.phase} message=${b.message}`);
}

const idle = (b) => b.phase === PHASE.IDLE;

test('textDelay is (15 - textSpeed) * 3 frames', () => {
  assert.equal(textDelay(5), 30);
  assert.equal(textDelay(14), 3);
});

test('battle opens with the encounter line and waits 2T before asking for a spell', () => {
  const { battle, cues } = startBattle(ctx, setup());
  assert.equal(battle.message, 'Mookie is battling a Pet2!');
  assert.deepEqual(cues, [{ type: 'sfx', name: 'fanfare' }]);
  assert.equal(battle.timer, 2 * T);
  const { b, messages } = runUntil(battle, idle);
  assert.deepEqual(messages, ['Mookie is battling a Pet2!', 'Choose a spell.']);
  assert.equal(b.enemy.hp, 4);
});

test('first healthy pet from the left leads', () => {
  const party = [{ ...createPet(pets[0], 5, 'Down'), hp: 0 }, createPet(pets[0], 2, 'Up'), ...empty().slice(1)];
  assert.equal(activePet(startBattle(ctx, setup({ party })).battle).name, 'Up');
});

test('input is ignored until the battle is waiting for a choice', () => {
  const { battle } = startBattle(ctx, setup());
  const r = chooseSpell(ctx, battle, 0);
  assert.equal(r.battle, battle);
  assert.deepEqual(r.cues, [{ type: 'sfx', name: 'invalid' }]);
});

test('a full round: faster player strikes, enemy faints, xp and win', () => {
  const ready = runUntil(startBattle(ctx, setup()).battle, idle).b;
  const picked = chooseSpell(ctx, ready, 2).battle; // Mega Zap: 15 dmg
  assert.equal(picked.message, 'Mookie uses Mega Zap on the Pet2!');
  const { b, messages } = runUntil(picked, (x) => x.finished);
  assert.deepEqual(messages, [
    'Mookie uses Mega Zap on the Pet2!',
    'The Pet2 loses 4 points!',
    'The Pet2 retreats!',
    'You win this battle!',
  ]);
  assert.equal(b.result, RESULT.WON);
  assert.equal(b.party[0].xp, 35); // 10*4 - 5
});

test('slow enemy acts second and the round ends with "Choose a spell."', () => {
  const opponents = [{ petId: 1, level: 3 }];
  const ready = runUntil(startBattle(ctx, setup({ opponents })).battle, idle).b;
  const picked = chooseSpell(ctx, ready, 0).battle; // Zap: 5 dmg of 12
  const { b, messages } = runUntil(picked, idle);
  assert.equal(messages[0], 'Mookie uses Zap on the Pet1!');
  assert.equal(messages[1], 'The Pet1 loses 5 points!');
  assert.match(messages[2], /^The Pet1 uses \w[\w ]* (on Mookie)?!?/);
  assert.equal(messages[messages.length - 1], 'Choose a spell.');
  assert.equal(b.playerDone && b.enemyDone, true);
});

test('self buff announces without a target and raises the caster status', () => {
  const opponents = [{ petId: 1, level: 3 }];
  const party = [createPet(pets[0], 9, 'Mookie'), ...empty()];
  const ready = runUntil(startBattle(ctx, setup({ opponents, party })).battle, idle).b;
  const picked = chooseSpell(ctx, ready, 3).battle;
  assert.equal(picked.message, 'Mookie uses Power Shell!');
  const { b } = runUntil(picked, idle);
  assert.equal(b.party[0].status[4], 1);
});

test('retreat ends the battle immediately', () => {
  const ready = runUntil(startBattle(ctx, setup()).battle, idle).b;
  const { battle } = retreat(ready);
  assert.equal(battle.finished, true);
  assert.equal(battle.result, RESULT.RETREATED);
});

test('change then slot click swaps pets without using a turn', () => {
  const party = [createPet(pets[0], 5, 'A'), createPet(pets[0], 2, 'B'), ...empty().slice(1)];
  const ready = runUntil(startBattle(ctx, setup({ party })).battle, idle).b;
  const changing = requestChange(ready).battle;
  assert.equal(changing.message, 'Choose another BattlePet!');
  const swapped = selectSlot(ctx, changing, 1).battle;
  assert.equal(swapped.message, 'B enters the battle!');
  assert.equal(activePet(swapped).name, 'B');
  assert.equal(swapped.phase, PHASE.IDLE);
});

test('clicking a slot without change asks to inspect it', () => {
  const ready = runUntil(startBattle(ctx, setup()).battle, idle).b;
  assert.equal(selectSlot(ctx, ready, 0).inspect, 0);
});

test('catch appears at low hp in wild battles; first catch always succeeds', () => {
  const opponents = [{ petId: 1, level: 3 }]; // 12 hp; Zap lvl5 = 5 dmg -> 7, then 2
  let b = runUntil(startBattle(ctx, setup({ opponents })).battle, idle).b;
  for (let i = 0; i < 2; i += 1) {
    b = runUntil(chooseSpell(ctx, b, 0).battle, idle).b;
  }
  assert.equal(b.enemy.hp, 2);
  assert.equal(b.catchShown, true);
  const caught = attemptCatch(b).battle;
  assert.equal(caught.message, 'You caught the Pet1!');
  const { b: end, messages } = runUntil(caught, (x) => x.finished);
  assert.deepEqual(messages.slice(-1), ['You win this battle!']);
  assert.equal(end.party[1].name, 'Pet1');
  assert.equal(end.party[1].xp, 40);
  assert.equal(end.party[0].xp, 0, 'no xp for a catch');
});

test('wizard battles never offer a catch', () => {
  const opponents = [{ petId: 1, level: 3 }];
  let b = runUntil(startBattle(ctx, setup({ opponents, wild: false })).battle, idle).b;
  for (let i = 0; i < 2; i += 1) b = runUntil(chooseSpell(ctx, b, 0).battle, idle).b;
  assert.equal(b.catchShown, false);
  assert.deepEqual(attemptCatch(b).cues, [{ type: 'sfx', name: 'invalid' }]);
});

test('losing every pet ends the battle as lost', () => {
  const party = [{ ...createPet(pets[2], 1, 'Weak'), hp: 1 }, ...empty()];
  const opponents = [{ petId: 0, level: 9 }];
  let b = runUntil(startBattle(ctx, setup({ party, opponents })).battle, idle).b;
  let messages = [];
  for (let round = 0; round < 20 && !b.finished; round += 1) {
    const r = runUntil(chooseSpell(ctx, b, 0).battle, (x) => x.finished || idle(x));
    b = r.b;
    messages = r.messages;
  }
  b = runUntil(b, (x) => x.finished).b;
  assert.equal(messages[messages.length - 1], 'You have lost!');
  assert.equal(b.result, RESULT.LOST);
});

test('wizard teams are fought one after another', () => {
  const opponents = [{ petId: 2, level: 1 }, { petId: 2, level: 2 }];
  let b = runUntil(startBattle(ctx, setup({ opponents, wild: false })).battle, idle).b;
  b = runUntil(chooseSpell(ctx, b, 2).battle, idle).b;
  assert.equal(b.message, 'Choose a spell.');
  assert.equal(b.opponentIndex, 1);
  assert.equal(b.enemy.level, 2);
});
