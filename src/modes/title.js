// MAIN_OPTION_MODE (0x409a10, input 0x40a160): the title menu over back1.bmp.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { OptionsMode } from './options.js';
import { InfoMode } from './info.js';
import { MapMode } from './map.js';
import { loadGameFromFile } from './saveFiles.js';

const BUTTONS = [
  [0, 'Start New Game', [0, 280, 640, 310]],
  [1, 'Load Game', [0, 310, 640, 340]],
  [2, 'Gameplay Options', [0, 340, 640, 370]],
  [3, 'Credits', [0, 370, 640, 400]],
  [4, 'Quit to Desktop', [0, 410, 640, 440]],
];
const MUSIC = 'dat/pcmonst1.wav';

export class TitleMode extends Mode {
  async load() {
    this.back = await this.app.assets.image('dat/back1.bmp');
    this.buttons = new ButtonList();
    BUTTONS.forEach(([id, label, rect]) => this.buttons.addText(id, label, rect));
    this.app.audio.play(MUSIC, { loop: true });
  }

  /** The theme restarts on return, except from the options screen (0x409f50). */
  resume(child) {
    if (!(child instanceof OptionsMode)) this.app.audio.play(MUSIC, { loop: true });
  }

  async activate(id) {
    const { app } = this;
    if (id === NONE) return;
    app.sound('click');
    if (id === 0) {
      app.startNewGame();
      app.audio.stop(MUSIC);
      await app.modes.push(new MapMode(app));
    } else if (id === 1) {
      if (await loadGameFromFile(app)) {
        app.audio.stop(MUSIC);
        await app.modes.push(new MapMode(app));
      }
    } else if (id === 2) {
      await app.modes.push(new OptionsMode(app));
    } else if (id === 3) {
      await app.modes.push(new InfoMode(app, { text: app.data.texts.credits, background: 'dat/back1.bmp' }));
    } else if (id === 4) {
      app.audio.stop(MUSIC);
      window.close();
    }
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown' && e.button === 'left') this.activate(this.buttons.click(e.x, e.y));
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
  }

  draw(gfx) {
    gfx.blitOpaque(this.back, 0, 0);
    this.buttons.draw(gfx);
  }
}
