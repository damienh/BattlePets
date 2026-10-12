// Application shell: boots from the original files, owns the shared services and
// runs the 30 Hz frame loop (the original ticked every 33 ms, 0x409559).

import { AssetCache, loadBinary, loadText } from './engine/assets.js';
import { Audio } from './engine/audio.js';
import { Gfx, WIDTH, HEIGHT } from './engine/gfx.js';
import { Input } from './engine/input.js';
import { ModeStack } from './engine/modeStack.js';
import { parseExe } from './game/exedata.js';
import { rand, timeSeed } from './game/rng.js';
import { newGame } from './game/gameState.js';

export const FRAME_MS = 33;
export const SOUNDS = Object.freeze({
  click: 'dat/button2.wav',
  invalid: 'dat/button2.wav',
  levelUp: 'dat/common2.wav',
  fanfare: 'dat/fanfare4.wav',
});
const SHARED_IMAGES = ['dat/outline2.bmp', 'dat/mapModeOutline.bmp', 'dat/monst-butt.bmp'];

export class App {
  constructor(canvas) {
    this.gfx = new Gfx(canvas);
    this.input = new Input(canvas, WIDTH, HEIGHT);
    this.audio = new Audio();
    this.assets = new AssetCache();
    this.modes = new ModeStack();
    this.data = null;
    this.state = null;
    this.helpText = '';
    this.options = { difficulty: 0, gender: 0, textSpeed: 0 };
    this.seed = timeSeed();
    this.pets = [];
    this.images = {};
  }

  async boot(onProgress = () => {}) {
    onProgress('Reading BattlePets.exe');
    this.data = parseExe(await loadBinary('BattlePets.exe'));
    onProgress('Reading help.dat');
    this.helpText = await loadText('help.dat');
    onProgress('Loading pictures');
    this.pets = await this.assets.imageList(this.data.pets.map((p) => p.bitmap));
    const [outline, mapOutline, monsterButton] = await this.assets.imageList(SHARED_IMAGES);
    this.images = { outline, mapOutline, monsterButton };
  }

  petSprite(templateId) {
    return this.pets[templateId];
  }

  /** Next value from the shared C runtime rand() stream. */
  rand() {
    const r = rand(this.seed);
    this.seed = r.seed;
    return r.value;
  }

  /** Take/return the shared seed when a pure module consumes random numbers. */
  takeSeed() {
    return this.seed;
  }

  putSeed(seed) {
    this.seed = seed;
  }

  sound(name) {
    this.audio.play(SOUNDS[name] ?? name);
  }

  startNewGame() {
    this.state = { ...newGame(this.data, this.seed), ...this.options };
  }

  /** Options live outside the save so the menu's choices carry into a new game. */
  setOptions(options) {
    this.options = { ...this.options, ...options };
    if (this.state) this.state = { ...this.state, ...options };
  }

  updateState(fn) {
    this.state = fn(this.state);
  }

  frame() {
    const mode = this.modes.top;
    if (!mode || this.modes.busy) return;
    for (const event of this.input.drain()) {
      if (this.modes.top !== mode) break;
      mode.handle(event);
    }
    const top = this.modes.top;
    if (!top || this.modes.busy) return;
    top.update();
    top.draw(this.gfx);
  }

  run() {
    let last = performance.now();
    let pending = 0;
    const loop = (now) => {
      pending += now - last;
      last = now;
      // Catch up at most a few frames so a backgrounded tab doesn't fast-forward.
      pending = Math.min(pending, FRAME_MS * 4);
      while (pending >= FRAME_MS) {
        pending -= FRAME_MS;
        try {
          this.frame();
        } catch (error) {
          this.fail(error);
          return;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  fail(error) {
    console.error(error);
    this.gfx.clear([0, 0, 64]);
    this.gfx.text(2, 'Game Failure', [0, 180, 640, 220], 1, [255, 255, 255]);
    this.gfx.text(6, String(error.message ?? error), [40, 230, 600, 400], 0x11, [255, 255, 255]);
  }
}
