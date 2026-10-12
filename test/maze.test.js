import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMaze, cellAt, tryMove, startRun, areaAt } from '../src/game/maze.js';
import { hasOriginal, loadText } from './helpers.js';

const TINY = [
  '// test maze',
  'ROW 11111',
  'ROW 1a031',
  'ROW 10b01',
  'ROW 1020b',
  'ROW 11111',
  'EVENT 3 // chest',
  'MAINTEXT You got the key!',
  'NEEDTEXT Locked.',
  'NEEDS Red key',
  'GIVES Blue key',
  'AREA a 0 6 1 1',
  'AREA b 7 7 3 3',
  'ART dat\\\\maze00.bmp dat\\\\maze01.bmp',
].join('\r\n');

test('parses rows, start position and art', () => {
  const maze = parseMaze(TINY);
  assert.equal(maze.width, 5);
  assert.equal(maze.height, 5);
  assert.equal(cellAt(maze, 0, 0), '1');
  assert.equal(cellAt(maze, 3, 1), '3');
  assert.equal(cellAt(maze, 9, 9), '1', 'outside counts as wall');
  assert.deepEqual(maze.start, { x: 2, y: 3 });
  assert.deepEqual(maze.art, { wall: 'dat/maze00.bmp', floor: 'dat/maze01.bmp' });
});

test('events take their text and position from the grid', () => {
  const [event] = parseMaze(TINY).events;
  assert.deepEqual(event, {
    char: '3', x: 3, y: 1, mainText: 'You got the key!', needText: 'Locked.',
    needs: 'Red key', gives: 'Blue key',
  });
});

test('areas span first to last occurrence of their letter', () => {
  const maze = parseMaze(TINY);
  assert.deepEqual(maze.areas.map(({ char, x1, y1, x2, y2 }) => ({ char, x1, y1, x2, y2 })), [
    { char: 'a', x1: 1, y1: 1, x2: 1, y2: 1 },
    { char: 'b', x1: 2, y1: 2, x2: 4, y2: 3 },
  ]);
  assert.equal(areaAt(maze, 3, 3).char, 'b');
  assert.equal(areaAt(maze, 1, 1).char, 'a');
  assert.equal(areaAt(maze, 1, 3), null);
});

test('startRun primes the encounter counter with 15..24 steps', () => {
  const run = startRun(parseMaze(TINY), 1);
  assert.deepEqual(run.pos, { x: 2, y: 3 });
  assert.ok(run.stepsToEncounter >= 15 && run.stepsToEncounter <= 24);
});

test('walls and bounds block movement without consuming a step', () => {
  const maze = parseMaze(TINY);
  const run = startRun(maze, 1);
  const result = tryMove(maze, run, 0, 1);
  assert.equal(result.kind, 'blocked');
  assert.equal(result.run, run);
});

test('stepping on the exit leaves the maze', () => {
  const maze = parseMaze(TINY);
  const run = { ...startRun(maze, 1), pos: { x: 1, y: 3 } };
  assert.equal(tryMove(maze, run, 1, 0).kind, 'exit');
});

test('stepping on an event cell opens the event', () => {
  const maze = parseMaze(TINY);
  const run = { ...startRun(maze, 1), pos: { x: 3, y: 2 } };
  const result = tryMove(maze, run, 0, -1);
  assert.equal(result.kind, 'event');
  assert.equal(result.event.char, '3');
  assert.deepEqual(result.run.pos, { x: 3, y: 1 });
  assert.deepEqual(result.run.prev, { x: 3, y: 2 });
});

test('floor steps count down and spawn from the containing area', () => {
  const maze = parseMaze(TINY);
  const run = { ...startRun(maze, 1), pos: { x: 3, y: 2 }, stepsToEncounter: 1 };
  const result = tryMove(maze, run, -1, 0); // onto 'b' at (2,2)
  assert.equal(result.kind, 'battle');
  assert.deepEqual(result.encounter, { petId: 7, level: 3 });
  assert.deepEqual(result.run.pos, { x: 3, y: 2 }, 'the triggering move is undone');
  assert.ok(result.run.stepsToEncounter >= 15);
});

test('countdown without a matching area just resets', () => {
  const maze = parseMaze(TINY);
  const run = { ...startRun(maze, 1), pos: { x: 2, y: 3 }, stepsToEncounter: 1 };
  const result = tryMove(maze, run, -1, 0); // (1,3) is floor outside any area
  assert.equal(result.kind, 'moved');
  assert.ok(result.run.stepsToEncounter >= 15);
});

test('parses every original maze file', { skip: !hasOriginal }, () => {
  for (const name of ['genwood', 'beachcave', 'ruins', 'icecave', 'castle', 'forest2']) {
    const maze = parseMaze(loadText(`dat/${name}.dat`));
    assert.equal(maze.width, 50, name);
    assert.equal(maze.height, 50, name);
    assert.ok(maze.events.length >= 3, name);
    assert.equal(maze.areas[0].char, 'a', name);
  }
  const genwood = parseMaze(loadText('dat/genwood.dat'));
  assert.deepEqual(genwood.areas[1], {
    char: 'b', x1: 39, y1: 1, x2: 48, y2: 4, minPet: 7, maxPet: 7, minLevel: 3, maxLevel: 3,
  });
});
