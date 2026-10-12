// Per-maze weather particles (emitters 0x422900..0x4229c0, per-frame 0x40dfd0).

import { PI, emit } from '../engine/particles.js';

const f = Math.fround;

function emitters(rand) {
  return {
    snow: {
      rgbMin: [255, 255, 255], rgbMax: [255, 255, 255], x: [0, 640], y: [0, 400],
      angle: [PI, PI], speed: [2, 2], life: [50, 50],
      callback: (p) => { p.angle = f((rand() % 100) * 0.01 + PI); },
    },
    rain: {
      rgbMin: [155, 155, 255], rgbMax: [155, 155, 255], x: [0, 740], y: [-200, 400],
      angle: [f(PI * 1.1), f(PI * 1.1)], speed: [26, 26], life: [5, 10],
    },
    petals: {
      rgbMin: [255, 200, 200], rgbMax: [255, 200, 200], x: [0, 740], y: [0, 400],
      angle: [PI, PI], speed: [5, 10], life: [50, 50],
      callback: (p) => { p.angle = f((rand() % 40) * 0.025 + PI * 1.25); },
    },
    drips: {
      rgbMin: [155, 155, 255], rgbMax: [155, 155, 255], x: [0, 640], y: [-20, 0],
      angle: [PI, PI], speed: [1, 1], life: [20, 20],
      callback: (p) => { p.speed = f(p.speed + 1); },
    },
  };
}

/** Maze index (0 Genwood .. 5 Dismal Forest) -> what falls from the sky. */
export function weatherFor(mazeIndex, rand) {
  const e = emitters(rand);
  const plan = [
    { emitter: e.petals, count: 1, every: 1 },
    { emitter: e.drips, count: 1, every: 5 },
    { emitter: e.drips, count: 1, every: 5 },
    { emitter: e.snow, count: 3, every: 1 },
    null,
    { emitter: e.rain, count: 10, every: 1 },
  ][mazeIndex];
  return {
    tick(system, frame) {
      if (!plan || frame % plan.every !== 0) return;
      for (let i = 0; i < plan.count; i += 1) emit(system, plan.emitter, rand);
    },
  };
}
