// TOWER MODE (0x412610, draw 0x412db0, input 0x412b20, resume 0x412940).

import { DT } from '../engine/text.js';
import { defeatWizard } from '../game/gameState.js';
import { RESULT } from '../game/battle.js';
import { BuildingMode, TEXT_RGB } from './building.js';
import { CombatMode } from './combat.js';
import { InfoMode } from './info.js';

const BATTLE_ID = 0;
const PORTRAIT_POS = [100, 170];
const TEXT_RECT = [220, 80, 540, 330];
const FINAL_WIZARD = 5;

export class TowerMode extends BuildingMode {
  constructor(app, { wizard }) {
    super(app, { background: 'dat/tower-back.bmp', firstSlotId: 1 });
    this.wizard = wizard;
    this.battled = false;
    this.result = null;
  }

  async load() {
    await super.load();
    this.portrait = await this.app.assets.image(this.app.data.wizards[this.wizard].portrait);
  }

  addButtons(buttons) {
    buttons.addText(BATTLE_ID, 'Battle!', [220, 350, 420, 370]);
  }

  resume(child) {
    if (!(child instanceof CombatMode)) return;
    this.battled = true;
    this.result = child.result;
    this.buttons.setLabel(BATTLE_ID, 'Leave Tower');
    if (this.result === RESULT.WON) {
      this.app.updateState((s) => defeatWizard(s, this.app.data, this.wizard));
    }
  }

  async press(id) {
    if (id !== BATTLE_ID) return;
    const { app } = this;
    app.sound('click');
    if (!this.battled) {
      const opponents = app.data.wizards[this.wizard].team;
      await app.modes.push(new CombatMode(app, { opponents, wild: false, background: 'dat/tower-back.bmp' }));
      return;
    }
    app.modes.pop();
    if (this.result === RESULT.WON && this.wizard === FINAL_WIZARD) {
      await app.modes.push(new InfoMode(app, { text: '', background: 'dat/win1.bmp' }));
    }
  }

  text() {
    const wizard = this.app.data.wizards[this.wizard];
    if (!this.battled) return wizard.intro;
    return this.result === RESULT.WON ? wizard.defeat : this.app.data.texts.towerLost;
  }

  drawContent(gfx) {
    gfx.blit(this.portrait, ...PORTRAIT_POS);
    gfx.text(2, this.text(), TEXT_RECT, DT.CENTER | DT.WORDBREAK, TEXT_RGB);
  }
}
