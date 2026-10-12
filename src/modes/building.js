// Shared shape of the town buildings (home, market, temple, tower): a tiled
// background, the party bar whose slots open the pet screen, and text buttons.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { addPartyButtons, drawPartyBar } from './partyBar.js';
import { InspectMode } from './inspect.js';

export const TEXT_RGB = [255, 255, 255];

export class BuildingMode extends Mode {
  /**
   * @param app
   * @param {{ background: string, firstSlotId: number, fanfare?: string }} layout
   */
  constructor(app, layout) {
    super(app);
    this.layout = layout;
  }

  async load() {
    this.back = await this.app.assets.image(this.layout.background);
    this.buttons = new ButtonList();
    addPartyButtons(this.buttons, this.layout.firstSlotId, this.app.images.mapOutline);
    this.addButtons(this.buttons);
    if (this.layout.fanfare) this.app.audio.play(this.layout.fanfare);
  }

  /** Subclasses add their own text buttons (added last, so one starts current). */
  addButtons(_buttons) {}

  /** Subclasses handle their non-slot buttons. */
  press(_id) {}

  slotOf(id) {
    const slot = id - this.layout.firstSlotId;
    return slot >= 0 && slot < 6 ? slot : -1;
  }

  async activate(id, rightButton = false) {
    if (id === NONE) return;
    const slot = this.slotOf(id);
    if (slot >= 0) {
      await this.pressSlot(slot, rightButton);
      return;
    }
    await this.press(id);
  }

  async pressSlot(slot) {
    if (this.app.state.party[slot]) {
      await this.app.modes.push(new InspectMode(this.app, { slot }));
    }
  }

  leave() {
    this.app.sound('click');
    this.app.modes.pop();
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y), e.button === 'right');
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
  }

  drawContent(_gfx) {}

  draw(gfx) {
    gfx.tile(this.back);
    drawPartyBar(gfx, this.app, { outline: this.app.images.outline });
    this.drawContent(gfx);
    this.buttons.draw(gfx);
  }
}
