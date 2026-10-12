// INFO_MODE (0x407860): a full-screen bitmap with optional centred text and a
// Continue button. Used for the credits and the final victory picture.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { DT } from '../engine/text.js';

const TEXT_RECT = [120, 80, 520, 370];
const CONTINUE_RECT = [220, 370, 420, 395];

export class InfoMode extends Mode {
  constructor(app, { text, background }) {
    super(app);
    this.text = text;
    this.background = background;
  }

  async load() {
    this.back = await this.app.assets.image(this.background);
    this.buttons = new ButtonList();
    this.buttons.addText(0, 'Continue', CONTINUE_RECT);
  }

  activate(id) {
    if (id === NONE) return;
    this.app.sound('click');
    this.app.modes.pop();
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y));
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
  }

  draw(gfx) {
    gfx.blitOpaque(this.back, 0, 0);
    // With no text (the victory picture) neither text nor button is drawn.
    if (this.text) {
      gfx.text(2, this.text, TEXT_RECT, DT.CENTER | DT.WORDBREAK, [255, 255, 255]);
      this.buttons.draw(gfx);
    }
  }
}
