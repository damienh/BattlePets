// INSPECT_MODE (0x407d30, draw 0x408470, input 0x408170/0x408300): a pet's stats,
// renaming (the name box is an editable button) and swapping party slots.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { DT } from '../engine/text.js';
import { maxHp, spellsAvailable, xpForLevel } from '../game/pet.js';
import { swapPets } from '../game/gameState.js';
import { addPartyButtons, drawPartyBar } from './partyBar.js';

const ID = Object.freeze({ EXIT: 0, SWAP: 1, NAME: 2, FIRST_SLOT: 3 });
const WHITE = [255, 255, 255];
const NAME_RECT = [20, 20, 205, 120];
const SPRITE_POS = [80, 130];
const BASICS = [180, 10, 390, 370];
const SPELLS = [400, 10, 640, 370];
const STATUS = [100, 200, 640, 370];
const TITLE_GAP = 28;
const VALUE_X = 90;
const STATUS_VALUE_X = 120;
const RESIST_X = 240;
const RESIST_RIGHT = 410;
const NAME_MAX = 64;

const BASIC_LABELS = 'Hit Points:\nLevel:\nExperience:\nNext Level:\nToughness:\nSpeed:\nSmarts:\n';
const STATUS_LABELS = 'Paralyzed:\nPoisoned:\nSlow:\nAccuracy:\nDefense:\nOffense:\nSpeed:\n';

/** Status column text (0x408746). */
export function statusWords(status) {
  return status.map((s, i) => {
    if (i < 3) return s < 0 ? 'YES' : 'NO';
    if (s < 0) return s.toFixed(1);
    if (s > 0) return `+${Math.trunc(s)}`;
    return 'NORMAL';
  });
}

const percent = (r) => `${Math.round(Math.fround(r) * 100)}%`;

export class InspectMode extends Mode {
  constructor(app, { slot }) {
    super(app);
    this.slot = slot;
    this.swapping = false;
  }

  async load() {
    this.back = await this.app.assets.image('dat/home-back.bmp');
    this.buttons = new ButtonList();
    addPartyButtons(this.buttons, ID.FIRST_SLOT, this.app.images.mapOutline);
    this.buttons.addText(ID.SWAP, 'SWAP', [540, 310, 640, 340]);
    this.buttons.addText(ID.EXIT, 'EXIT', [540, 340, 640, 370]);
    this.nameBox = this.buttons.addText(ID.NAME, this.pet()?.name ?? ' ', NAME_RECT, {
      editable: true, maxLength: NAME_MAX,
    });
  }

  pet() {
    return this.app.state.party[this.slot] ?? null;
  }

  /** The name box is copied into the pet every frame (0x408140). */
  update() {
    const pet = this.pet();
    if (!pet || pet.name === this.nameBox.label) return;
    const name = this.nameBox.label;
    this.app.updateState((s) => ({
      ...s, party: s.party.map((p, i) => (i === this.slot ? { ...p, name } : p)),
    }));
  }

  selectSlot(slot) {
    if (this.swapping) {
      this.swapping = false;
      this.app.updateState((s) => swapPets(s, this.slot, slot));
    }
    this.slot = slot;
    this.nameBox.label = this.pet()?.name ?? ' ';
  }

  activate(id) {
    if (id === NONE) return;
    if (id === ID.EXIT) {
      this.app.sound('click');
      this.app.modes.pop();
    } else if (id === ID.SWAP) {
      if (this.pet()) this.swapping = true;
    } else if (id >= ID.FIRST_SLOT) {
      this.selectSlot(id - ID.FIRST_SLOT);
    }
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y));
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
    else if (e.type === 'char') this.buttons.type(e.char);
  }

  drawBasics(gfx, pet, tpl) {
    const [l, t, r, b] = BASICS;
    gfx.text(2, 'BASICS', BASICS, DT.LEFT, WHITE);
    gfx.text(8, BASIC_LABELS, [l, t + TITLE_GAP, r, b], DT.WORDBREAK, WHITE);
    const values = `${pet.hp}/${maxHp(pet, tpl)}\n${pet.level}\n${pet.xp}\n${xpForLevel(pet.level)}\n`
      + `${tpl.toughness}\n${tpl.speed}\n${tpl.smarts}\n`;
    gfx.text(8, values, [l + VALUE_X, t + TITLE_GAP, r, b], DT.WORDBREAK, WHITE);
  }

  drawStatus(gfx, pet, tpl) {
    const [l, t, r, b] = STATUS;
    const top = t + TITLE_GAP;
    gfx.text(2, 'STATUS', STATUS, DT.LEFT, WHITE);
    gfx.text(8, STATUS_LABELS, [l, top, r, b], DT.WORDBREAK, WHITE);
    gfx.text(8, `${statusWords(pet.status).join('\n')}\n`, [l + STATUS_VALUE_X, top, r, b], DT.WORDBREAK, WHITE);
    gfx.text(2, 'RESISTANCE', [l + RESIST_X, t, r, b], DT.LEFT, WHITE);
    const resist = `${tpl.resist.map(percent).join('\n')}\n`;
    gfx.text(8, resist, [l + RESIST_X, top, RESIST_RIGHT, b], DT.RIGHT | DT.WORDBREAK, WHITE);
  }

  drawSpells(gfx, pet, tpl) {
    const [l, t, r, b] = SPELLS;
    gfx.text(2, 'SPELLS', SPELLS, DT.LEFT, WHITE);
    const names = tpl.spells.slice(0, spellsAvailable(pet.level)).map((id) => this.app.data.spells[id].name);
    gfx.text(8, `${names.join('\n')}\n`, [l, t + TITLE_GAP, r, b], DT.WORDBREAK, WHITE);
  }

  draw(gfx) {
    gfx.tile(this.back);
    drawPartyBar(gfx, this.app, { outline: this.app.images.outline });
    const pet = this.pet();
    if (pet) {
      const tpl = this.app.data.pets[pet.templateId];
      gfx.blit(this.app.petSprite(pet.templateId), ...SPRITE_POS);
      this.drawBasics(gfx, pet, tpl);
      if (!this.swapping) this.drawStatus(gfx, pet, tpl);
      this.drawSpells(gfx, pet, tpl);
      const [l, t, r, b] = NAME_RECT;
      gfx.text(0, `A ${tpl.name}-type BattlePet\n`, [l, t + 25, r, b + 25], DT.WORDBREAK, WHITE);
    }
    if (this.swapping && pet) {
      gfx.text(2, `Click on the BattlePet to change places with ${pet.name}.`, [0, 260, 640, 290], DT.CENTER, [255, 255, 0]);
    }
    this.buttons.draw(gfx);
  }
}
