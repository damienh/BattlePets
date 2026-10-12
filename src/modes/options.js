// DIFF_MODE (0x405770, input 0x405d40): gender / difficulty / text speed toggles.
// Left click cycles forward, right click backward.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';

const ID = Object.freeze({ CONTINUE: 0, GENDER: 1, DIFFICULTY: 2, TEXT_SPEED: 3 });
const DIFFICULTY = ['Difficulty: EASY', 'Difficulty: NORMAL', 'Difficulty: HARD'];
const MAX_TEXT_SPEED = 10;

const genderLabel = (g) => (g === 1 ? 'Player is MALE' : 'Player is FEMALE');
const cycle = (value, min, max, back) => {
  if (back) return value - 1 < min ? max : value - 1;
  return value + 1 > max ? min : value + 1;
};

export class OptionsMode extends Mode {
  async load() {
    this.back = await this.app.assets.image('dat/back1.bmp');
    const o = this.current();
    this.buttons = new ButtonList();
    this.buttons.addText(ID.GENDER, genderLabel(o.gender), [0, 310, 640, 340]);
    this.buttons.addText(ID.DIFFICULTY, DIFFICULTY[o.difficulty], [0, 340, 640, 370]);
    this.buttons.addText(ID.TEXT_SPEED, `Text Speed: ${o.textSpeed}`, [0, 370, 640, 400]);
    this.buttons.addText(ID.CONTINUE, 'Continue', [0, 270, 640, 310]);
  }

  current() {
    return this.app.state ?? this.app.options;
  }

  activate(id, back) {
    if (id === NONE) return;
    const { app } = this;
    app.sound('click');
    const o = this.current();
    if (id === ID.CONTINUE) {
      app.modes.pop();
    } else if (id === ID.GENDER) {
      const gender = cycle(o.gender, 0, 1, back);
      app.setOptions({ gender });
      this.buttons.setLabel(id, genderLabel(gender));
    } else if (id === ID.DIFFICULTY) {
      const difficulty = cycle(o.difficulty, 0, 2, back);
      app.setOptions({ difficulty });
      this.buttons.setLabel(id, DIFFICULTY[difficulty]);
    } else if (id === ID.TEXT_SPEED) {
      const textSpeed = cycle(o.textSpeed, 1, MAX_TEXT_SPEED, back);
      app.setOptions({ textSpeed });
      this.buttons.setLabel(id, `Text Speed: ${textSpeed}`);
    }
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y), e.button === 'right');
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk), false);
  }

  draw(gfx) {
    gfx.blitOpaque(this.back, 0, 0);
    this.buttons.draw(gfx);
  }
}
