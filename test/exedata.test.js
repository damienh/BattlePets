import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExe } from '../src/game/exedata.js';
import { hasOriginal, loadExe } from './helpers.js';

const opts = { skip: !hasOriginal && 'original BattlePets.exe not found' };

test('rejects a buffer that is not the v1.0 executable', () => {
  assert.throws(() => parseExe(new ArrayBuffer(1024)), /Unsupported/);
});

test('parses 36 spells with names and 8 effect floats', opts, () => {
  const { spells } = parseExe(loadExe());
  assert.equal(spells.length, 36);
  assert.deepEqual(spells[0], { id: 0, name: 'Zap', damage: 1, effects: [0, 0, 0, 0, 0, 0, 0] });
  assert.equal(spells[2].name, 'Hypnotize');
  assert.equal(spells[2].effects[0], 0.5);
  assert.equal(spells[35].name, 'Light Speed');
  assert.equal(spells[35].damage, -3);
  assert.equal(spells[35].effects[6], -1);
});

test('parses 36 pets with stats, 7 resistances and 5 spells', opts, () => {
  const { pets } = parseExe(loadExe());
  assert.equal(pets.length, 36);
  const fleenu = pets[4];
  assert.equal(fleenu.name, 'Fleenu');
  assert.equal(fleenu.bitmap, 'dat\\PUFFBALL.bmp');
  assert.deepEqual([fleenu.toughness, fleenu.speed, fleenu.smarts], [3, 4, 4]);
  assert.deepEqual(fleenu.resist, [0.2, 0, 0.9, 0, 0, 0.2, 0.2].map(Math.fround));
  assert.deepEqual(fleenu.spells, [0, 2, 12, 6, 7]);
  assert.equal(pets[35].name, 'Stondre');
});

test('parses 15 map locations', opts, () => {
  const { locations } = parseExe(loadExe());
  assert.equal(locations.length, 15);
  assert.deepEqual(locations[0], {
    name: 'Home', icon: 0, index: 0, x: 320, y: 200, visible: true, file: '',
  });
  assert.equal(locations[1].name, 'Genwood Forest');
  assert.equal(locations[1].file, 'dat\\genwood.dat');
  assert.equal(locations[14].name, 'Vile Wizard');
  assert.equal(locations[14].icon, 2);
  assert.equal(locations[14].index, 5);
});

test('parses wizard teams, portraits and dialogue', opts, () => {
  const { wizards } = parseExe(loadExe());
  assert.equal(wizards.length, 6);
  assert.deepEqual(wizards[0].team, [{ petId: 16, level: 1 }, { petId: 15, level: 1 }]);
  assert.equal(wizards[5].team.length, 6);
  assert.equal(wizards[0].portrait, 'dat\\DIRTWIZARD.bmp');
  assert.match(wizards[0].intro, /^I am the Wizard of Earth/);
  assert.match(wizards[5].defeat, /^NOOOO!!!/);
});

test('exposes fixed texts used by the game', opts, () => {
  const { texts } = parseExe(loadExe());
  assert.match(texts.homeRest, /^You and your BattlePets spend the night/);
  assert.equal(texts.towerLost, 'Hah! Come back when you have tougher BattlePets!');
});
