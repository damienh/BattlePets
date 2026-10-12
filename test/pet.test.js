import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPet, maxHp, spellsAvailable, addXp, hpColor, killXp, healPet, xpForLevel, caughtPet,
} from '../src/game/pet.js';

const fleenu = { id: 4, name: 'Fleenu', toughness: 3, speed: 4, smarts: 4, resist: [0, 0, 0, 0, 0, 0, 0], spells: [0, 2, 12, 6, 7] };

test('createPet starts at full health with no status and template name', () => {
  const pet = createPet(fleenu, 3);
  assert.deepEqual(pet, {
    templateId: 4, name: 'Fleenu', level: 3, xp: 0, hp: 9,
    status: [0, 0, 0, 0, 0, 0, 0], poisonDamage: 0,
  });
});

test('max HP is toughness times level', () => {
  assert.equal(maxHp(createPet(fleenu, 7), fleenu), 21);
});

test('spells unlock at levels 5, 9 and 13', () => {
  assert.deepEqual([1, 4, 5, 8, 9, 12, 13, 30].map(spellsAvailable), [2, 2, 3, 3, 4, 4, 5, 5]);
});

test('addXp levels up once at 10 * level^2 and fully heals', () => {
  const hurt = { ...createPet(fleenu, 1), hp: 1 };
  const { pet, leveled } = addXp(hurt, fleenu, 10);
  assert.equal(leveled, true);
  assert.equal(pet.level, 2);
  assert.equal(pet.hp, 6);
  assert.equal(pet.xp, 10);
  assert.equal(hurt.level, 1, 'input not mutated');
});

test('addXp only gains one level per call even with surplus xp', () => {
  const { pet } = addXp(createPet(fleenu, 1), fleenu, 1000);
  assert.equal(pet.level, 2);
});

test('addXp below threshold keeps level and hp', () => {
  const start = { ...createPet(fleenu, 2), xp: 10, hp: 3 };
  const { pet, leveled } = addXp(start, fleenu, 29);
  assert.equal(leveled, false);
  assert.deepEqual([pet.level, pet.xp, pet.hp], [2, 39, 3]);
});

test('xpForLevel is 10 * level^2', () => {
  assert.equal(xpForLevel(2), 40);
});

test('hp colour is green above half, yellow above a quarter, else red', () => {
  const at = (hp) => hpColor({ ...createPet(fleenu, 4), hp }, fleenu); // max 12
  assert.deepEqual([at(12), at(7), at(6), at(4), at(3), at(0)],
    ['green', 'green', 'yellow', 'yellow', 'red', 'red']);
});

test('kill xp is 10L-5, two thirds on hard', () => {
  assert.equal(killXp(1, 1), 5);
  assert.equal(killXp(4, 0), 35);
  assert.equal(killXp(4, 2), 23); // floor(2*70/3)=46, /2 = 23
});

test('healPet restores hp and clears every status', () => {
  const pet = { ...createPet(fleenu, 2), hp: 1, status: [-1, 0, 0, 1, 0, -0.5, 0] };
  const healed = healPet(pet, fleenu);
  assert.equal(healed.hp, 6);
  assert.deepEqual(healed.status, [0, 0, 0, 0, 0, 0, 0]);
});

test('caughtPet keeps its battle state and gets xp for its current level', () => {
  const wild = { ...createPet(fleenu, 3), hp: 2, status: [-1, 0, 0, 0, 0, 0, 0] };
  const pet = caughtPet(wild);
  assert.equal(pet.xp, 40);
  assert.equal(pet.hp, 2);
  assert.deepEqual(pet.status, wild.status);
});
