// Combat animation layer: sprite offsets and spell effects driven by the battle
// phase (post-state handlers at 0x403042..0x40305d).

import { PHASE } from '../game/battle.js';

export class CombatFx {
  constructor(app) {
    this.app = app;
    this.enemyX = 0;
  }

  async load() {}

  cue(_cue, _battle) {}

  update(battle, previousPhase) {
    if (battle.phase === PHASE.NEXT) {
      // A beaten opponent slides away to the right, accelerating (0x40305d).
      this.enemyX = this.enemyX * 1.5 + 1;
    } else if (previousPhase === PHASE.NEXT || battle.phase !== previousPhase) {
      this.enemyX = 0;
    }
  }

  offsets() {
    return { playerX: 0, playerY: 0, enemyX: this.enemyX, enemyY: 0 };
  }

  draw(_gfx) {}
}
