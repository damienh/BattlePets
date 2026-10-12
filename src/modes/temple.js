// HELP MODE (0x406e10): the Temple of Knowledge reads help.dat "INFO" lines one
// page at a time. The page index survives between visits (0x827bc8).

import { DT } from '../engine/text.js';
import { BuildingMode, TEXT_RGB } from './building.js';

const ID = Object.freeze({ EXIT: 0, LEARN_MORE: 1 });

/** All INFO lines of help.dat, in order. */
export function helpPages(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s+/, ''))
    .filter((line) => line.length >= 3 && line.startsWith('INFO'))
    .map((line) => line.slice('INFO'.length).trim());
}

let pageIndex = 0;

export class TempleMode extends BuildingMode {
  constructor(app) {
    super(app, { background: 'dat/temple-back.bmp', firstSlotId: 2, fanfare: 'dat/fanfare7.wav' });
  }

  async load() {
    this.pages = helpPages(this.app.helpText);
    await super.load();
    this.nextPage();
  }

  nextPage() {
    if (pageIndex >= this.pages.length) pageIndex = 0;
    this.page = this.pages[pageIndex] ?? '';
    pageIndex += 1;
  }

  addButtons(buttons) {
    buttons.addText(ID.EXIT, 'Exit', [320, 310, 520, 340]);
    buttons.addText(ID.LEARN_MORE, 'Learn More', [120, 310, 320, 340]);
  }

  press(id) {
    if (id === ID.EXIT) this.leave();
    else if (id === ID.LEARN_MORE) this.nextPage();
  }

  drawContent(gfx) {
    gfx.text(2, this.page, [100, 80, 540, 300], DT.CENTER | DT.WORDBREAK, TEXT_RGB);
  }
}
