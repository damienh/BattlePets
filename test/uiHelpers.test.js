import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cellToScreen, centredOrigin, needsRecentre, screenToCell, directionTo,
} from '../src/modes/mazeView.js';
import { helpPages } from '../src/modes/temple.js';
import { statusWords } from '../src/modes/inspect.js';
import { hasOriginal, loadText } from './helpers.js';

test('centredOrigin puts the cell at screen centre', () => {
  const origin = centredOrigin(10, 4);
  assert.deepEqual(cellToScreen(origin, 10, 4), [320, 240]);
  assert.deepEqual(cellToScreen(origin, 11, 4), [374, 254]);
  assert.deepEqual(cellToScreen(origin, 10, 5), [266, 254]);
});

test('recentre only when the player leaves the 128..512 x 96..384 box', () => {
  const origin = centredOrigin(10, 10);
  assert.equal(needsRecentre(origin, 12, 10), false);
  assert.equal(needsRecentre(origin, 14, 10), true);
});

test('screenToCell inverts the projection near cell centres', () => {
  const origin = centredOrigin(10, 10);
  assert.deepEqual(screenToCell(origin, 320, 233), { x: 10, y: 10 });
  assert.deepEqual(screenToCell(origin, 374, 247), { x: 11, y: 10 });
});

test('directionTo picks the dominant axis, null on ties', () => {
  const at = { x: 5, y: 5 };
  assert.equal(directionTo(at, { x: 5, y: 2 }), 0);
  assert.equal(directionTo(at, { x: 5, y: 9 }), 3);
  assert.equal(directionTo(at, { x: 1, y: 5 }), 1);
  assert.equal(directionTo(at, { x: 9, y: 6 }), 2);
  assert.equal(directionTo(at, { x: 6, y: 6 }), null);
});

test('helpPages extracts INFO lines in order', () => {
  const pages = helpPages('// help.dat\r\n\r\nINFO First page.\r\n  INFO Second.\r\n// end\r\n');
  assert.deepEqual(pages, ['First page.', 'Second.']);
});

test('the original help.dat has 40 pages', { skip: !hasOriginal }, () => {
  const pages = helpPages(loadText('help.dat'));
  assert.equal(pages.length, 40);
  assert.match(pages[0], /^Welcome to BattlePets!/);
});

test('statusWords formats YES/NO, NORMAL, +n and -n.n', () => {
  assert.deepEqual(statusWords([-1, 0, 0, 0, 2, -0.75, 0]),
    ['YES', 'NO', 'NO', 'NORMAL', '+2', '-0.8', 'NORMAL']);
});
