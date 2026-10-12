import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEvent } from '../src/game/event.js';

const chest = { mainText: 'Opened!', needText: 'Locked.', needs: 'Red key', gives: 'Blue key' };

test('without the needed item the event shows NEEDTEXT and blocks', () => {
  assert.deepEqual(resolveEvent(chest, []), { text: 'Locked.', blocked: true, items: [] });
});

test('with the needed item it shows MAINTEXT and grants the reward', () => {
  const items = ['Red key'];
  const result = resolveEvent(chest, items);
  assert.deepEqual(result, { text: 'Opened!', blocked: false, items: ['Red key', 'Blue key'] });
  assert.deepEqual(items, ['Red key'], 'input not mutated');
});

test('needs is a case-sensitive prefix match (strncmp)', () => {
  assert.equal(resolveEvent(chest, ['Red keyring']).blocked, false);
});

test('needs matching is case-sensitive but gives is not duplicated case-insensitively', () => {
  assert.equal(resolveEvent(chest, ['red key']).blocked, true);
  assert.deepEqual(resolveEvent(chest, ['Red key', 'BLUE KEY']).items, ['Red key', 'BLUE KEY']);
});

test('plain events and give-only events never block', () => {
  assert.deepEqual(resolveEvent({ mainText: 'Hi', needText: '', needs: '', gives: '' }, []),
    { text: 'Hi', blocked: false, items: [] });
  assert.deepEqual(resolveEvent({ mainText: 'Key!', needText: '', needs: '', gives: 'Red key' }, []).items,
    ['Red key']);
});
