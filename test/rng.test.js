import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rand, ftol } from '../src/game/rng.js';

test('rand reproduces the MSVC C runtime sequence for seed 1', () => {
  const values = [];
  let seed = 1;
  for (let i = 0; i < 5; i += 1) {
    const r = rand(seed);
    values.push(r.value);
    seed = r.seed;
  }
  assert.deepEqual(values, [41, 18467, 6334, 26500, 19169]);
});

test('rand is pure: same seed gives same result', () => {
  assert.deepEqual(rand(12345), rand(12345));
});

test('ftol truncates toward zero like MSVC _ftol', () => {
  assert.equal(ftol(2.9), 2);
  assert.equal(ftol(-2.9), -2);
  assert.equal(ftol(-0.25), 0);
  assert.equal(ftol(-0), 0);
});
