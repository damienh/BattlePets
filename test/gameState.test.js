import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, healParty, defeatWizard, giveAway, swapPets, anyHealthy, serializeSave, parseSave,
  locationEnterable, LOCATION_ICON,
} from '../src/game/gameState.js';
import { parseExe } from '../src/game/exedata.js';
import { hasOriginal, loadExe } from './helpers.js';

const opts = { skip: !hasOriginal && 'original BattlePets.exe not found' };
const data = hasOriginal ? parseExe(loadExe()) : null;

test('new game: Mookie the Fleenu at home, starter locations visible, zeroed options', opts, () => {
  const state = newGame(data, 99);
  assert.equal(state.party[0].name, 'Mookie');
  assert.equal(state.party[0].templateId, 4);
  assert.equal(state.party[0].level, 1);
  assert.deepEqual(state.party.slice(1), [null, null, null, null, null]);
  assert.equal(data.locations[state.location].name, 'Home');
  const visible = data.locations.filter((_, i) => state.visible[i]).map((l) => l.name);
  assert.deepEqual(visible, ['Home', 'Genwood Forest', 'Temple of Knowledge', 'Market', 'Earth Wizard']);
  assert.deepEqual([state.difficulty, state.gender, state.textSpeed, state.caughtBefore], [0, 0, 0, false]);
  assert.deepEqual(state.items, []);
});

test('defeating a wizard marks it and reveals the next maze and wizard', opts, () => {
  const state = defeatWizard(newGame(data, 1), data, 0);
  assert.equal(state.wizardsDefeated[0], true);
  const visible = data.locations.filter((_, i) => state.visible[i]).map((l) => l.name);
  assert.ok(visible.includes('Beach Caves'));
  assert.ok(visible.includes('Storm Wizard'));
  assert.ok(!visible.includes('Ocean Wizard'));
});

test('mazes and towers need a healthy pet; defeated towers are closed', opts, () => {
  const state = newGame(data, 1);
  const genwood = 1;
  const earth = data.locations.findIndex((l) => l.name === 'Earth Wizard');
  assert.equal(locationEnterable(state, data, genwood), true);
  const fainted = { ...state, party: state.party.map((p) => (p ? { ...p, hp: 0 } : p)) };
  assert.equal(anyHealthy(fainted), false);
  assert.equal(locationEnterable(fainted, data, genwood), false);
  assert.equal(locationEnterable(fainted, data, 0), true, 'home is always open');
  assert.equal(locationEnterable(defeatWizard(state, data, 0), data, earth), false);
  assert.equal(data.locations[earth].icon, LOCATION_ICON.TOWER);
});

test('healParty restores every pet', opts, () => {
  const state = newGame(data, 1);
  const hurt = { ...state, party: [{ ...state.party[0], hp: 0, status: [-1, 0, 0, 2, 0, 0, 0] }, ...state.party.slice(1)] };
  const healed = healParty(hurt, data);
  assert.equal(healed.party[0].hp, 3);
  assert.deepEqual(healed.party[0].status, [0, 0, 0, 0, 0, 0, 0]);
});

test('giveAway needs at least two pets and leaves a gap', opts, () => {
  const state = newGame(data, 1);
  assert.equal(giveAway(state, 0), state, 'cannot give away the last pet');
  const two = { ...state, party: [state.party[0], null, { ...state.party[0], name: 'Two' }, null, null, null] };
  const after = giveAway(two, 0);
  assert.deepEqual(after.party.map((p) => p && p.name), [null, null, 'Two', null, null, null]);
});

test('swapPets exchanges two slots', opts, () => {
  const state = newGame(data, 1);
  const swapped = swapPets(state, 0, 3);
  assert.equal(swapped.party[0], null);
  assert.equal(swapped.party[3].name, 'Mookie');
});

test('save files round-trip in the original .gam text format', opts, () => {
  const base = defeatWizard(newGame(data, 1), data, 0);
  const state = {
    ...base,
    location: 1,
    difficulty: 2, gender: 1, textSpeed: 7, caughtBefore: true,
    items: ['Red key', 'Blue key'],
    party: [{ ...base.party[0], level: 3, xp: 95, hp: 7 }, null, null, null, null, null],
  };
  const text = serializeSave(state, data);
  assert.equal(text, [
    '320 240',
    'YES', 'Mookie', '4 3 7 95',
    'NO', 'NO', 'NO', 'NO', 'NO',
    '1 1 1 0 0 0 0 1 1 1 1 0 0 0 0 ',
    '1 0 0 0 0 0 ',
    '2 1 7 1',
    'Red key', 'Blue key',
    'ITEMEND', '',
  ].join('\n'));
  const loaded = parseSave(text, data, 5);
  assert.deepEqual(loaded.party, state.party);
  assert.deepEqual(
    { ...loaded, seed: 0 },
    { ...state, seed: 0 },
  );
});

test('parseSave rejects garbage with a clear message', opts, () => {
  assert.throws(() => parseSave('hello', data, 1), /not a BattlePets save/i);
});
