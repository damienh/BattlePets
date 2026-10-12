// PAUSE OPTION MODE (0x40e810, input 0x40ed80): Continue / Save / Options / Quit.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { OptionsMode } from './options.js';
import { saveGameToFile } from './saveFiles.js';

const ID = Object.freeze({ CONTINUE: 0, SAVE: 1, OPTIONS: 2, QUIT: 3 });
const MUSIC = 'dat/pcmonst1.wav';

export class PauseMode extends Mode {
  async load() {
    this.back = await this.app.assets.image('dat/back1.bmp');
    this.quitToTitle = false;
    this.buttons = new ButtonList();
    this.buttons.addText(ID.CONTINUE, 'Continue Game', [0, 280, 640, 310]);
    this.buttons.addText(ID.SAVE, 'Save Game', [0, 310, 640, 340]);
    this.buttons.addText(ID.OPTIONS, 'Gameplay Options', [0, 340, 640, 370]);
    this.buttons.addText(ID.QUIT, 'Quit Game', [0, 410, 640, 440]);
    this.app.audio.play(MUSIC, { loop: true });
  }

  resume(child) {
    if (!(child instanceof OptionsMode)) this.app.audio.play(MUSIC, { loop: true });
  }

  leave(quitToTitle) {
    this.quitToTitle = quitToTitle;
    this.app.audio.stop(MUSIC);
    this.app.modes.pop();
  }

  async activate(id) {
    if (id === NONE) return;
    const { app } = this;
    app.sound('click');
    if (id === ID.CONTINUE) this.leave(false);
    else if (id === ID.SAVE) {
      saveGameToFile(app);
      this.leave(false);
    } else if (id === ID.OPTIONS) await app.modes.push(new OptionsMode(app));
    else if (id === ID.QUIT) this.leave(true);
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y));
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
  }

  draw(gfx) {
    gfx.blitOpaque(this.back, 0, 0);
    this.buttons.draw(gfx);
  }
}
