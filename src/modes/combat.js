// COMBAT MODE (0x4011b0): presentation of the battle state machine in game/battle.js.
// Layout from the draw routine at 0x401e30.

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NONE } from '../engine/ui.js';
import { DT } from '../engine/text.js';
import { HP_RGB, hpColor, maxHp, spellsAvailable } from '../game/pet.js';
import {
  startBattle, tick, chooseSpell, retreat, requestChange, attemptCatch, selectSlot, PHASE, activePet,
} from '../game/battle.js';
import { addPartyButtons, drawPartyBar } from './partyBar.js';
import { InspectMode } from './inspect.js';
import { CombatFx } from './combatFx.js';

const ID = Object.freeze({ RETREAT: 0, CHANGE: 1, CATCH: 2, FIRST_SLOT: 3, FIRST_SPELL: 9 });
export const PLAYER_POS = [168, 150];
export const ENEMY_POS = [472, 150];
const PLAYER_BAR = [20, 80, 220, 95];
const ENEMY_BAR = [420, 80, 620, 95];
const MESSAGE_RECT = [0, 340, 640, 370];
const FIRST_SPELL_RECT = [20, 200, 200, 225];
const BAR_BACK = [128, 128, 128];
const NAME_RGB = [155, 155, 255];
const WHITE = [255, 255, 255];
const SPELL_PHASES = { 2: 'cast', 3: 'fly', 4: 'impact' };

export class CombatMode extends Mode {
  constructor(app, { opponents, wild, background }) {
    super(app);
    this.opponents = opponents;
    this.wild = wild;
    this.background = background;
    this.result = null;
  }

  ctx() {
    const { data, state } = this.app;
    return {
      pets: data.pets, spells: data.spells,
      difficulty: state.difficulty, textSpeed: state.textSpeed, caughtBefore: state.caughtBefore,
    };
  }

  async load() {
    this.back = await this.app.assets.image(this.background);
    this.fx = new CombatFx(this.app);
    await this.fx.load();
    const { battle, cues } = startBattle(this.ctx(), {
      party: this.app.state.party, opponents: this.opponents, wild: this.wild, seed: this.app.takeSeed(),
    });
    this.buttons = new ButtonList();
    addPartyButtons(this.buttons, ID.FIRST_SLOT, this.app.images.mapOutline);
    this.buttons.addText(ID.CHANGE, 'Change', [540, 320, 640, 345]);
    this.buttons.addText(ID.RETREAT, 'Retreat', [540, 345, 640, 370]);
    this.battle = battle;
    this.spellsFor = -1;
    this.rebuildSpells();
    this.playCues(cues);
  }

  /** Recreates the spell buttons for the active pet (0x404d30). */
  rebuildSpells() {
    // Only rebuilt when the active pet changes, so a level-up mid-battle does not
    // reveal a new spell until the next switch - as in the original.
    const pet = activePet(this.battle);
    if (this.battle.active === this.spellsFor) return;
    this.spellsFor = this.battle.active;
    for (let i = 0; i < 5; i += 1) this.buttons.remove(ID.FIRST_SPELL + i);
    if (!pet) return;
    const tpl = this.app.data.pets[pet.templateId];
    const [l, t, r, b] = FIRST_SPELL_RECT;
    const step = b - t + 1;
    for (let i = 0; i < spellsAvailable(pet.level); i += 1) {
      const spell = this.app.data.spells[tpl.spells[i]];
      this.buttons.addText(ID.FIRST_SPELL + i, spell.name, [l, t + i * step, r, b + i * step]);
    }
  }

  syncCatchButton() {
    if (this.battle.catchShown && !this.buttons.has(ID.CATCH)) {
      this.buttons.addText(ID.CATCH, 'Catch', [540, 285, 640, 320]);
    } else if (!this.battle.catchShown && this.buttons.has(ID.CATCH)) {
      this.buttons.remove(ID.CATCH);
    }
  }

  playCues(cues) {
    for (const cue of cues) {
      if (cue.type === 'sfx') this.app.sound(cue.name);
      else if (cue.type === 'spell') {
        this.app.audio.play(this.app.data.spells[cue.spellId].sounds[SPELL_PHASES[cue.phase]]);
        this.fx.cue(cue, this.battle);
      }
    }
  }

  apply({ battle, cues, inspect }) {
    this.battle = battle;
    this.app.updateState((s) => ({ ...s, party: battle.party, caughtBefore: battle.caughtBefore }));
    this.playCues(cues);
    this.rebuildSpells();
    this.syncCatchButton();
    if (inspect !== undefined) this.app.modes.push(new InspectMode(this.app, { slot: inspect }));
  }

  /** The pet screen can rename or reorder pets; pick that up (party is shared by index). */
  resume() {
    const { party } = this.app.state;
    // Swapping an empty slot into the fighting position would leave no active pet;
    // fall back to the left-most healthy one rather than crash.
    const active = party[this.battle.active] ? this.battle.active : party.findIndex((p) => p && p.hp > 0);
    this.battle = { ...this.battle, party, active: Math.max(active, 0) };
  }

  activate(id) {
    if (id === NONE) return;
    const ctx = this.ctx();
    const b = this.battle;
    if (id === ID.RETREAT) this.apply(retreat(b));
    else if (id === ID.CHANGE) this.apply(requestChange(b));
    else if (id === ID.CATCH) this.apply(attemptCatch(b));
    else if (id >= ID.FIRST_SPELL) this.apply(chooseSpell(ctx, b, id - ID.FIRST_SPELL));
    else this.apply(selectSlot(ctx, b, id - ID.FIRST_SLOT));
  }

  handle(e) {
    if (e.type === 'mousemove') this.buttons.hover(e.x, e.y);
    else if (e.type === 'mousedown') this.activate(this.buttons.click(e.x, e.y));
    else if (e.type === 'keydown') this.activate(this.buttons.key(e.vk));
  }

  update() {
    const before = this.battle.phase;
    this.apply(tick(this.ctx(), this.battle));
    this.fx.update(this.battle, before);
    if (this.battle.finished) {
      this.result = this.battle.result;
      this.app.putSeed(this.battle.seed);
      this.app.modes.pop();
    }
  }

  drawCombatant(gfx, pet, bar, align, isPlayer) {
    const tpl = this.app.data.pets[pet.templateId];
    const [l, t, r, b] = bar;
    gfx.fillRect(bar, BAR_BACK);
    const filled = Math.trunc(((r - l) * pet.hp) / maxHp(pet, tpl));
    const fill = isPlayer ? [r - filled, t, r, b] : [l, t, l + filled, b];
    gfx.fillRect(fill, HP_RGB[hpColor(pet, tpl)]);
    if (isPlayer) gfx.text(1, String(pet.hp), bar, DT.RIGHT, [0, 0, 155]);
    gfx.text(2, `Level: ${pet.level}`, [l, t - 26, r, t - 1], align, WHITE);
    gfx.text(2, pet.name, [l, t - 52, r, t - 27], align, NAME_RGB);
  }

  draw(gfx) {
    gfx.tile(this.back);
    drawPartyBar(gfx, this.app, { outline: this.app.images.outline });
    const b = this.battle;
    const player = activePet(b);
    const offsets = this.fx.offsets();
    if (player) {
      gfx.blit(this.app.petSprite(player.templateId), PLAYER_POS[0] + offsets.playerX, PLAYER_POS[1] + offsets.playerY);
    }
    if (b.enemy) {
      gfx.blit(this.app.petSprite(b.enemy.templateId), ENEMY_POS[0] + offsets.enemyX, ENEMY_POS[1] + offsets.enemyY);
    }
    gfx.text(2, b.message, MESSAGE_RECT, DT.CENTER, WHITE);
    if (player) this.drawCombatant(gfx, player, PLAYER_BAR, DT.LEFT, true);
    if (b.enemy) this.drawCombatant(gfx, b.enemy, ENEMY_BAR, DT.RIGHT, false);
    if (b.phase === PHASE.IDLE) this.buttons.draw(gfx);
    this.fx.draw(gfx);
  }
}
