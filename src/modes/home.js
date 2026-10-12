// HEAL MODE (0x406740): entering home heals the whole party and clears statuses.

import { DT } from '../engine/text.js';
import { healParty } from '../game/gameState.js';
import { BuildingMode, TEXT_RGB } from './building.js';

const EXIT_ID = 0;

export class HomeMode extends BuildingMode {
  constructor(app) {
    super(app, { background: 'dat/home-back.bmp', firstSlotId: 1, fanfare: 'dat/fanfare8.wav' });
  }

  async load() {
    await super.load();
    this.app.updateState((s) => healParty(s, this.app.data));
  }

  addButtons(buttons) {
    buttons.addText(EXIT_ID, 'EXIT', [220, 350, 420, 370]);
  }

  press(id) {
    if (id === EXIT_ID) this.leave();
  }

  drawContent(gfx) {
    gfx.text(2, this.app.data.texts.homeRest, [100, 80, 540, 330], DT.CENTER | DT.WORDBREAK, TEXT_RGB);
  }
}
