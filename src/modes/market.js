// MARKET MODE (0x40b560, input 0x40ba40, draw 0x40bb20): give a pet away.
// Needs at least two pets; the emptied slot is left as a gap.

import { DT } from '../engine/text.js';
import { giveAway } from '../game/gameState.js';
import { BuildingMode, TEXT_RGB } from './building.js';

const ID = Object.freeze({ DONE: 0, GIVE_AWAY: 1 });
const TEXT_RECT = [100, 80, 540, 330];

export class MarketMode extends BuildingMode {
  constructor(app) {
    super(app, { background: 'dat/market-back.bmp', firstSlotId: 2, fanfare: 'dat/fanfare5.wav' });
    this.selected = 6;
  }

  addButtons(buttons) {
    buttons.addText(ID.GIVE_AWAY, 'Give Away', [120, 340, 320, 370]);
    buttons.addText(ID.DONE, 'Done', [320, 340, 520, 370]);
  }

  async pressSlot(slot) {
    this.selected = slot;
  }

  press(id) {
    if (id === ID.DONE) {
      this.leave();
    } else if (id === ID.GIVE_AWAY && this.selected < 6) {
      this.app.updateState((s) => giveAway(s, this.selected));
    }
  }

  drawContent(gfx) {
    const pet = this.selected < 6 ? this.app.state.party[this.selected] : null;
    if (!pet) {
      gfx.text(2, 'Choose a BattlePet you want to give away.', TEXT_RECT, DT.CENTER | DT.WORDBREAK, TEXT_RGB);
      return;
    }
    gfx.text(2, `Do you want to give away ${pet.name}?`, TEXT_RECT, DT.CENTER | DT.WORDBREAK, TEXT_RGB);
    gfx.blit(this.app.petSprite(pet.templateId), 320, 240);
  }
}
