// The six "MonsterBox" slots along the bottom of most screens (0x40f630).

import { HP_RGB, hpColor } from '../game/pet.js';
import { DT } from '../engine/text.js';

export const SLOT_COUNT = 6;
const FIRST_SLOT = [6, 375, 110, 480];
const SLOT_STEP = 105;
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

export function slotRect(i) {
  const [l, t, r, b] = FIRST_SLOT;
  return [l + i * SLOT_STEP, t, r + i * SLOT_STEP, b];
}

/** Adds the six party image buttons with ids firstId..firstId+5. */
export function addPartyButtons(buttons, firstId, outlineImage) {
  for (let i = 0; i < SLOT_COUNT; i += 1) buttons.addImage(firstId + i, slotRect(i), outlineImage);
}

function drawPet(gfx, app, pet, rect) {
  const [l, t, r, b] = rect;
  const tpl = app.data.pets[pet.templateId];
  gfx.blit(app.petSprite(pet.templateId), l, t, true);
  const max = tpl.toughness * pet.level;
  const span = b - 1 - (t + 1);
  const filled = max > 0 ? Math.trunc((span * pet.hp) / max) : 0;
  gfx.fillRect([r - 5, b - 1 - filled, r, b - 1], HP_RGB[hpColor(pet, tpl)]);
  gfx.shadowText(0, `Level: ${pet.level}`, [l + 1, t + 1, r, b], DT.LEFT, WHITE, BLACK);
  gfx.shadowText(0, pet.name, [l + 1, b - 14, r, b], DT.LEFT, WHITE, BLACK);
  if (pet.hp <= 0) {
    gfx.shadowText(3, 'Fainted!', [l + 1, t + 40, r, b], DT.CENTER, WHITE, BLACK);
  }
}

/**
 * Draws the box frames and every pet except `skip` (the pet currently in combat).
 */
export function drawPartyBar(gfx, app, { outline, skip = -1 } = {}) {
  for (let i = 0; i < SLOT_COUNT; i += 1) gfx.blit(outline, ...slotRect(i).slice(0, 2), true);
  app.state.party.forEach((pet, i) => {
    if (pet && i !== skip) drawPet(gfx, app, pet, slotRect(i));
  });
}
