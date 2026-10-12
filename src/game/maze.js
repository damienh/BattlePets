// Maze files (dat/*.dat) and maze movement rules (parser 0x40c4a0, move 0x40d340).
// Cells: '0' floor, '1' wall, '2' exit/start, other chars are events or area markers.

import { rand } from './rng.js';

const WALL = '1';
const FLOOR = '0';
const EXIT = '2';

const normalisePath = (p) => p.replace(/\\+/g, '/');
const restOf = (line, keyword) => line.slice(keyword.length).trim();

function emptyEvent(char) {
  return { char, x: -1, y: -1, mainText: '', needText: '', needs: '', gives: '' };
}

function parseLines(text) {
  const rows = [];
  const events = [];
  const areaDefs = [];
  let art = null;
  let current = null;
  const setField = (field, value) => {
    if (current) current[field] = value;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('ROW ')) rows.push(restOf(line, 'ROW'));
    else if (line.startsWith('EVENT ')) {
      current = emptyEvent(restOf(line, 'EVENT').charAt(0));
      events.push(current);
    } else if (line.startsWith('MAINTEXT ')) setField('mainText', restOf(line, 'MAINTEXT'));
    else if (line.startsWith('NEEDTEXT ')) setField('needText', restOf(line, 'NEEDTEXT'));
    else if (line.startsWith('NEEDS ')) setField('needs', restOf(line, 'NEEDS'));
    else if (line.startsWith('GIVES ')) setField('gives', restOf(line, 'GIVES'));
    else if (line.startsWith('AREA ')) {
      const [char, ...nums] = restOf(line, 'AREA').split(/\s+/);
      const [minPet, maxPet, minLevel, maxLevel] = nums.map(Number);
      areaDefs.push({ char, minPet, maxPet, minLevel, maxLevel });
    } else if (line.startsWith('ART ')) {
      const [wall, floor] = restOf(line, 'ART').split(/\s+/).map(normalisePath);
      art = { wall, floor };
    }
  }
  return { rows, events, areaDefs, art };
}

function locate(rows, predicate) {
  const hits = [];
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (predicate(c)) hits.push({ x, y });
    });
  });
  return hits;
}

function placeEvent(rows, event) {
  const hits = locate(rows, (c) => c === event.char);
  const last = hits[hits.length - 1];
  return last ? { ...event, x: last.x, y: last.y } : event;
}

function placeArea(rows, def) {
  const hits = locate(rows, (c) => c === def.char);
  if (hits.length === 0) return { char: def.char, x1: -1, y1: -1, x2: -1, y2: -1, ...def };
  const first = hits[0];
  const last = hits[hits.length - 1];
  return {
    char: def.char, x1: first.x, y1: first.y, x2: last.x, y2: last.y,
    minPet: def.minPet, maxPet: def.maxPet, minLevel: def.minLevel, maxLevel: def.maxLevel,
  };
}

/** Parse a maze .dat file's text. */
export function parseMaze(text) {
  const { rows, events, areaDefs, art } = parseLines(text);
  if (rows.length === 0) throw new Error('Maze file has no ROW lines');
  const exits = locate(rows, (c) => c === EXIT);
  if (exits.length === 0) throw new Error('Maze file has no exit (2) cell');
  return Object.freeze({
    width: rows[0].length,
    height: rows.length,
    rows,
    start: exits[exits.length - 1],
    events: events.map((e) => placeEvent(rows, e)),
    areas: areaDefs.map((a) => placeArea(rows, a)),
    art: art ?? { wall: 'dat/maze00.bmp', floor: 'dat/maze01.bmp' },
  });
}

export function cellAt(maze, x, y) {
  if (y < 0 || y >= maze.height || x < 0 || x >= maze.width) return WALL;
  return maze.rows[y].charAt(x) || WALL;
}

/** Last AREA whose rectangle contains (x, y), or null. */
export function areaAt(maze, x, y) {
  return maze.areas.reduce(
    (found, a) => (x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2 ? a : found),
    null,
  );
}

function rollCounter(seed) {
  const r = rand(seed);
  return { steps: (r.value % 10) + 15, seed: r.seed };
}

export function startRun(maze, seed) {
  const { steps, seed: next } = rollCounter(seed);
  return { pos: maze.start, prev: maze.start, stepsToEncounter: steps, seed: next };
}

function rollEncounter(area, seed) {
  const pet = rand(seed);
  const petId = area.minPet + (pet.value % (area.maxPet - area.minPet + 1));
  if (area.minLevel === area.maxLevel) return { encounter: { petId, level: area.minLevel }, seed: pet.seed };
  // Max level is exclusive in the original (rand() % (max - min)).
  const lvl = rand(pet.seed);
  const level = area.minLevel + (lvl.value % (area.maxLevel - area.minLevel));
  return { encounter: { petId, level }, seed: lvl.seed };
}

function countDown(maze, run) {
  const steps = run.stepsToEncounter - 1;
  if (steps >= 1) return { kind: 'moved', run: { ...run, stepsToEncounter: steps } };
  const counter = rollCounter(run.seed);
  const reset = { ...run, stepsToEncounter: counter.steps, seed: counter.seed };
  const area = areaAt(maze, run.pos.x, run.pos.y);
  if (!area) return { kind: 'moved', run: reset };
  const { encounter, seed } = rollEncounter(area, reset.seed);
  return { kind: 'battle', encounter, run: { ...reset, seed, pos: run.prev } };
}

/**
 * Attempt a one-cell move. Returns { kind, run, event?, encounter? } where kind is
 * 'blocked' | 'moved' | 'exit' | 'event' | 'battle'.
 */
export function tryMove(maze, run, dx, dy) {
  const target = { x: run.pos.x + dx, y: run.pos.y + dy };
  const cell = cellAt(maze, target.x, target.y);
  if (cell === WALL) return { kind: 'blocked', run };
  const moved = { ...run, prev: run.pos, pos: target };
  if (cell === EXIT) return { kind: 'exit', run: moved };
  if (cell !== FLOOR) {
    const event = maze.events.find((e) => e.x === target.x && e.y === target.y);
    if (event) return { kind: 'event', event, run: moved };
  }
  return countDown(maze, moved);
}

/** Undo the last move (used when an event's NEEDS is not met). */
export function stepBack(run) {
  return { ...run, pos: run.prev };
}
