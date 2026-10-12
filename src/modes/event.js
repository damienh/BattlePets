// EVENT MODE (0x406050, draw 0x4065b0): a maze event's text over a frozen
// snapshot of the maze, with a Continue button.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { DT } from '../engine/text.js';
import { resolveEvent } from '../game/event.js';

const PANEL_POS = [7, 54];
const TEXT_RECT = [120, 130, 520, 370];
const CONTINUE_RECT = [220, 370, 420, 395];

export class EventMode extends Mode {
  constructor(app, { event, backdrop }) {
    super(app);
    this.event = event;
    this.backdrop = backdrop;
  }

  async load() {
    this.panel = await this.app.assets.image('dat/event-back.bmp');
    this.outcome = resolveEvent(this.event, this.app.state.items);
    this.buttons = new ButtonList();
    this.buttons.addText(0, 'Continue', CONTINUE_RECT);
  }

  /** Whether the player must step back off the event cell (0x827bbc). */
  get blocked() {
    return this.outcome.blocked;
  }

  activate(id) {
    if (id === NONE) return;
    this.app.sound('click');
    // The reward is granted as the event closes (0x406280).
    this.app.updateState((s) => ({ ...s, items: this.outcome.items }));
    this.app.modes.pop();
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y));
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
  }

  draw(gfx) {
    gfx.blitOpaque(this.backdrop, 0, 0);
    gfx.blit(this.panel, ...PANEL_POS, true);
    gfx.text(2, this.outcome.text, TEXT_RECT, DT.CENTER | DT.WORDBREAK, [255, 255, 255]);
    this.buttons.draw(gfx);
  }
}
