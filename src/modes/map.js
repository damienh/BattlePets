// MAP_MODE (0x40a8d0, draw 0x40b2b0, input 0x40ad10): the island of Enchantia.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { DT } from '../engine/text.js';
import { LOCATION_ICON, anyHealthy } from '../game/gameState.js';
import { addPartyButtons, drawPartyBar } from './partyBar.js';
import { PauseMode } from './pause.js';
import { InspectMode } from './inspect.js';
import { HomeMode } from './home.js';
import { MarketMode } from './market.js';
import { TempleMode } from './temple.js';
import { TowerMode } from './tower.js';
import { MazeMode } from './maze.js';

const ICONS = [
  'dat/home.bmp', 'dat/mine.bmp', 'dat/wiz-blue.bmp', 'dat/adoption.bmp',
  'dat/temple.bmp', 'dat/forest.bmp', 'dat/ruin.bmp', 'dat/castle.bmp',
];
const OPTIONS_ID = 0;
const FIRST_SLOT_ID = 1;
const PICK_RADIUS = 20;
const CLOUD_Y = 40;
const CLOUD_WRAP_X = 650;
const MUSIC = 'dat/pcmonst2.wav';
const MAZE_ICONS = new Set([LOCATION_ICON.CAVE, LOCATION_ICON.FOREST, LOCATION_ICON.RUIN, LOCATION_ICON.CASTLE]);

const near = (loc, x, y) => Math.hypot(loc.x - x, loc.y - y) <= PICK_RADIUS;

export class MapMode extends Mode {
  async load() {
    const { assets } = this.app;
    this.island = await assets.image('dat/island1.bmp');
    this.cloud = await assets.image('dat/skycloud.bmp');
    this.icons = await assets.imageList(ICONS);
    this.cloudX = 0;
    this.hovered = null;
    this.buttons = new ButtonList();
    addPartyButtons(this.buttons, FIRST_SLOT_ID, this.app.images.mapOutline);
    this.buttons.addText(OPTIONS_ID, 'Options', [540, 345, 640, 370]);
    this.app.audio.play(MUSIC, { loop: true });
  }

  resume(child) {
    if (child?.quitToTitle) {
      this.app.audio.stop(MUSIC);
      this.app.modes.pop();
      return;
    }
    this.app.audio.play(MUSIC, { loop: true });
  }

  async push(mode) {
    this.app.audio.stop(MUSIC);
    await this.app.modes.push(mode);
  }

  async pressButton(id) {
    const { app } = this;
    if (id === OPTIONS_ID) {
      app.sound('click');
      await this.push(new PauseMode(app));
    } else if (id >= FIRST_SLOT_ID && app.state.party[id - FIRST_SLOT_ID]) {
      await app.modes.push(new InspectMode(app, { slot: id - FIRST_SLOT_ID }));
    }
  }

  /** Click on the island (0x40ae9d): the first visible location within 20 px. */
  async pressLocation(x, y) {
    const { app } = this;
    const index = app.data.locations.findIndex((loc, i) => app.state.visible[i] && near(loc, x, y));
    if (index < 0) return;
    app.updateState((s) => ({ ...s, location: index }));
    const loc = app.data.locations[index];
    if (loc.icon === LOCATION_ICON.HOME) await this.push(new HomeMode(app));
    else if (loc.icon === LOCATION_ICON.MARKET) await this.push(new MarketMode(app));
    else if (loc.icon === LOCATION_ICON.TEMPLE) await this.push(new TempleMode(app));
    else if (!anyHealthy(app.state)) return;
    else if (MAZE_ICONS.has(loc.icon)) await this.push(new MazeMode(app, { location: loc }));
    else if (loc.icon === LOCATION_ICON.TOWER && !app.state.wizardsDefeated[loc.index]) {
      await this.push(new TowerMode(app, { wizard: loc.index }));
    }
  }

  hoverLocation(x, y) {
    const { data, state } = this.app;
    data.locations.forEach((loc, i) => {
      if (state.visible[i] && near(loc, x, y)) this.hovered = loc;
    });
  }

  handle(e) {
    if (e.type === 'mousemove') {
      this.buttons.hover(e.x, e.y);
      this.hoverLocation(e.x, e.y);
    } else if (e.type === 'mousedown') {
      const id = this.buttons.click(e.x, e.y);
      if (id !== NONE) this.pressButton(id);
      else if (e.button === 'left') this.pressLocation(e.x, e.y);
    } else if (e.type === 'keydown') {
      const id = this.buttons.key(e.vk);
      if (id !== NONE) this.pressButton(id);
    }
  }

  update() {
    this.cloudX += 1;
    if (this.cloudX > CLOUD_WRAP_X) this.cloudX = -this.cloud.width;
  }

  drawLocations(gfx) {
    const { data, state } = this.app;
    data.locations.forEach((loc, i) => {
      if (!state.visible[i]) return;
      gfx.blit(this.icons[loc.icon], loc.x, loc.y);
      if (loc.icon === LOCATION_ICON.TOWER && state.wizardsDefeated[loc.index]) {
        gfx.text(1, 'Defeated', [loc.x - 60, loc.y - 10, loc.x + 60, loc.y + 10], DT.CENTER, [255, 0, 0]);
      }
    });
  }

  draw(gfx) {
    gfx.blitOpaque(this.island, 0, 0);
    this.drawLocations(gfx);
    drawPartyBar(gfx, this.app, { outline: this.app.images.outline });
    if (this.hovered) {
      const { x, y, name } = this.hovered;
      gfx.text(1, name, [x - 69, y + 21, x + 71, y + 41], DT.CENTER, [15, 15, 15]);
      gfx.text(1, name, [x - 70, y + 20, x + 70, y + 40], DT.CENTER, [255, 255, 55]);
    }
    this.buttons.draw(gfx);
    gfx.blitAdditive(this.cloud, this.cloudX, CLOUD_Y);
  }
}
