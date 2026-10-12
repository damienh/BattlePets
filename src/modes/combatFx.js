// Combat spell effects, ported from the post-state handlers:
//   cast windup 0x403420, projectile setup 0x403580, flight 0x403710,
//   impact burst 0x4040e0, hit shake 0x404390, defeated-enemy slide 0x40305d.
// Spell ids follow the table in docs/RE-NOTES.md (families repeat every 12).

import { PHASE } from '../game/battle.js';
import { ParticleSystem, PI, emit } from '../engine/particles.js';
import { PLAYER_POS, ENEMY_POS } from './combat.js';

const f = Math.fround;
const TWO_PI = f(PI * 2);
const SPRITES = [
  'lrg-white', 'lrg-yellow', 'lrg-red', 'lrg-green', 'lrg-blue',
  'med-white', 'med-yellow', 'med-red', 'med-green', 'med-blue',
  'sml-white', 'sml-yellow', 'sml-red', 'sml-green', 'sml-blue',
].map((n) => `dat/flr-${n}.bmp`);

// The two emitters are globals in the original (0x4216e8, 0x421728): settings
// changed by one spell carry over to the next, so they are module state here too.
const emitterA = {
  rgbMin: [0, 0, 0], rgbMax: [0, 0, 0], x: [0, 0], y: [0, 0],
  angle: [0, TWO_PI], speed: [1, 4], life: [10, 20], callback: () => {},
};
const DRIFT = f(PI * 0.02703);
const emitterB = {
  ...emitterA,
  // 0x401170: curve each particle's heading toward straight down.
  callback: (p) => { p.angle = p.angle > PI ? f(p.angle - DRIFT) : f(p.angle + DRIFT); },
};

const colour = (e, max, min = max) => { e.rgbMax = max; e.rgbMin = min; };
const speed = (e, max, min) => { e.speed = [min, max]; };
const life = (e, max, min) => { e.life = [min, max]; };
const family = (s) => s % 12;

export class CombatFx {
  constructor(app) {
    this.app = app;
    this.system = new ParticleSystem(1000);
    this.projectiles = [];
    this.sprite = null;
    this.shake = { player: 0, enemy: 0 };
    this.enemySlide = 0;
    this.rand = () => 0;
  }

  async load() {
    this.sprites = await this.app.assets.imageList(SPRITES);
  }

  /** Effects draw from the battle's rand() stream, interleaved as in the original. */
  useRandom(rand) {
    this.rand = rand;
  }

  cue() {}

  emitAt(e, x, y, count) {
    const cfg = { ...e, x: [x, x], y: [y, y] };
    for (let i = 0; i < count; i += 1) emit(this.system, cfg, this.rand);
  }

  emitRect(e, [l, t, r, b], count) {
    const cfg = { ...e, x: [l, r], y: [t, b] };
    for (let i = 0; i < count; i += 1) emit(this.system, cfg, this.rand);
  }

  /** Emit from random opaque pixels of a sprite centred at (cx, cy) (0x4044c0). */
  emitFromSprite(e, spr, cx, cy, count) {
    const mask = this.opacity(spr);
    const left = cx - (spr.width >> 1);
    const top = cy - (spr.height >> 1);
    let remaining = count;
    for (let guard = 0; remaining > 0 && guard < count * 50; guard += 1) {
      const px = this.rand() % spr.width;
      const py = this.rand() % spr.height;
      if (mask[py * spr.width + px]) {
        this.emitAt(e, left + px, top + py, 1);
        remaining -= 1;
      }
    }
  }

  opacity(spr) {
    if (!spr.mask) {
      const ctx = spr.keyed.getContext('2d');
      const data = ctx.getImageData(0, 0, spr.width, spr.height).data;
      spr.mask = Uint8Array.from({ length: spr.width * spr.height }, (_, i) => data[i * 4 + 3]);
    }
    return spr.mask;
  }

  positions(battle) {
    return battle.playerActing ? [PLAYER_POS, ENEMY_POS] : [ENEMY_POS, PLAYER_POS];
  }

  /** 0x403580: projectiles from caster to target (overshooting on a miss). */
  setup(battle) {
    const s = battle.spellId;
    const [from, to] = this.positions(battle);
    const miss = battle.playerActing ? 150 : -150;
    const end = [battle.hit ? to[0] : to[0] + miss, to[1]];
    const duration = ENEMY_POS[0] - PLAYER_POS[0];
    emitterA.angle = [0, TWO_PI];
    const count = family(s) === 2 && s <= 26 ? 3 : 1;
    this.projectiles = Array.from({ length: count }, () => ({
      start: from, end, cur: [...from], progress: 0, duration,
    }));
    if (family(s) === 0 && s <= 24) life(emitterA, 7, 3);
  }

  /** 0x403420: buff spells shower sparks up from the caster's silhouette. */
  windup(battle) {
    const s = battle.spellId;
    const kind = s - 8;
    if (kind < 0 || kind > 27) return;
    const group = [0, 1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 4][kind % 12];
    if (group === 4) return;
    const colours = [[[255, 255, 255], [0, 0, 0]], [[0, 255, 0]], [[255, 0, 0]], [[255, 255, 0]]];
    colour(emitterA, ...colours[group]);
    speed(emitterA, 3, 3);
    emitterA.angle = [0, 0];
    // Quirk: the player's sprite is used even when the enemy is casting.
    const playerSprite = this.app.petSprite(battle.party[battle.active].templateId);
    const [x, y] = battle.playerActing ? PLAYER_POS : ENEMY_POS;
    this.emitFromSprite(emitterA, playerSprite, x, y, 20);
  }

  advanceProjectiles(battle) {
    const elapsed = (battle.reload - battle.timer) / battle.reload;
    for (const p of this.projectiles) {
      p.progress = Math.trunc(elapsed * p.duration);
      p.cur = [
        Math.trunc(((p.end[0] - p.start[0]) / p.duration) * p.progress) + p.start[0],
        Math.trunc((p.progress / p.duration) * (p.end[1] - p.start[1])) + p.start[1],
      ];
    }
  }

  lob(p, freq, height) {
    return Math.trunc(p.cur[1] - Math.sin((p.progress / p.duration) * freq) * height);
  }

  fly(battle) {
    this.advanceProjectiles(battle);
    const s = battle.spellId;
    const [p] = this.projectiles;
    if (!p || s > 31) return;
    const tier = Math.trunc(s / 12);
    const [, to] = this.positions(battle);
    switch (s <= 29 ? family(s) : 7) {
      case 0: {
        colour(emitterA, [255, 255, 0], [200, 200, 0]);
        speed(emitterA, [2, 4, 6][tier], [0, 2, 4][tier]);
        this.emitAt(emitterA, p.cur[0], p.cur[1], 30);
        if (tier > 0) this.emitAt(emitterA, p.cur[0], p.cur[1], tier === 1 ? 20 : 40);
        this.sprite = { index: [11, 6, 1][tier], x: p.cur[0], y: p.cur[1] };
        break;
      }
      case 1: {
        colour(emitterA, [200, 225, 200], [200, 230, 200]);
        speed(emitterA, 1, 0);
        const y = this.lob(p, 3, 40);
        this.emitAt(emitterA, p.cur[0], y, 5);
        this.sprite = { index: [13, 8, 3][tier], x: p.cur[0], y };
        break;
      }
      case 2: {
        speed(emitterA, 1, 0);
        this.projectiles.forEach((q, i) => {
          colour(emitterA, [[0, 255, 0], [255, 0, 0], [0, 0, 255]][i]);
          const y = Math.trunc(q.cur[1] - Math.sin((q.progress / q.duration) * 18 + i * 2) * 15);
          this.emitAt(emitterA, q.cur[0], y, 15);
        });
        break;
      }
      case 3: {
        emitterA.angle = [f(PI * 0.3), f(PI * 0.3)];
        colour(emitterA, [238, 175, 130]);
        speed(emitterA, 3, 3);
        this.emitRect(emitterA, [to[0] - 70, to[1] - 70, to[0] + 70, to[1] + 70], 50);
        break;
      }
      case 4: {
        colour(emitterA, [255, 0, 0]);
        speed(emitterA, 3, 0);
        const y = this.lob(p, 3, 20);
        this.emitAt(emitterA, p.cur[0], y, 15);
        this.sprite = { index: [12, 7, 2][tier], x: p.cur[0], y };
        break;
      }
      case 5: {
        speed(emitterA, 5, 3);
        colour(emitterA, [128, 128, 128]);
        emitterA.angle = [PI, PI];
        this.emitRect(emitterA, [to[0] - 60, to[1] - 160, to[0] + 60, to[1]], 50);
        break;
      }
      case 6: this.glare(battle, s, to); break;
      case 7: this.web(battle, s, p); break;
      default: break;
    }
  }

  /** Glare / Trip: flickering bursts around the target every 4th frame. */
  glare(battle, s, to) {
    if (battle.timer % 4 !== 0) return;
    colour(emitterA, s === 6 ? [0, 0, 255] : [255, 0, 0]);
    emitterA.angle = [0, TWO_PI];
    speed(emitterA, 3, 3);
    const x = (this.rand() % 50) + to[0] - 25;
    const y = (this.rand() % 50) + to[1] - 25;
    this.emitAt(emitterA, x, y, 50);
    this.sprite = { index: s === 6 ? 9 : 7, x, y };
  }

  /** Web / Acid Glue / Acid Spray / Glue Coat: strands arcing from the caster. */
  web(battle, s, p) {
    life(emitterB, 20, 20);
    let k1 = f(1.8);
    let k2 = f(1.75);
    if (s === 7) {
      colour(emitterB, [255, 255, 255]);
      k1 = f(1.85);
      k2 = f(1.7);
    } else if (s === 19) {
      colour(emitterB, [155, 255, 155]);
      k2 = f(1.8);
    } else if (s === 31) {
      colour(emitterB, [55, 55, 255]);
    } else {
      colour(emitterB, [0, 255, 0]);
    }
    speed(emitterB, 17, 15);
    emitterB.angle = battle.playerActing
      ? [f(TWO_PI - PI * k1), f(TWO_PI - PI * k2)]
      : [f(PI * k2), f(PI * k1)];
    this.emitAt(emitterB, Math.trunc(p.start[0]), Math.trunc(p.start[1]), 5);
  }

  /** 0x4040e0: burst at the target as the spell lands. */
  impact(battle) {
    const s = battle.spellId;
    if (s > 28) return;
    const group = [0, 1, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3][family(s)];
    if (group === 3 || !battle.hit) return;
    const [, [x, y]] = this.positions(battle);
    if (group === 0 || group === 1) {
      life(emitterA, 20, 5);
      speed(emitterA, 4, 1);
      if (group === 0) colour(emitterA, [255, 255, 0], [200, 200, 0]);
      else colour(emitterA, [200, 225, 200], [200, 230, 200]);
      this.emitAt(emitterA, x, y, 650);
      return;
    }
    life(emitterA, 20, 20);
    speed(emitterA, 5, 5);
    colour(emitterA, [255, 0, 0]);
    const burst = battle.playerActing ? 250 : 650;
    this.emitAt(emitterA, x, y, burst);
    speed(emitterA, 3, 2);
    this.emitAt(emitterA, x, y, burst);
  }

  update(battle, previousPhase) {
    if (previousPhase === PHASE.CAST && battle.phase === PHASE.FLY) this.setup(battle);
    if (previousPhase === PHASE.FLY && battle.phase === PHASE.IMPACT) this.impact(battle);
    this.shake = { player: 0, enemy: 0 };
    if (battle.phase === PHASE.CAST) this.windup(battle);
    else if (battle.phase === PHASE.FLY) this.fly(battle);
    else if (battle.phase === PHASE.IMPACT && battle.hit && this.app.data.spells[battle.spellId].damage >= 0) {
      const wobble = Math.sin(((battle.reload - battle.timer) / battle.reload) * 60) * 2;
      this.shake = battle.playerActing ? { player: 0, enemy: wobble } : { player: wobble, enemy: 0 };
    }
    if (battle.phase === PHASE.NEXT) this.enemySlide = this.enemySlide * 1.5 + 1;
    else this.enemySlide = 0;
  }

  offsets() {
    return { playerX: this.shake.player, playerY: 0, enemyX: this.shake.enemy + this.enemySlide, enemyY: 0 };
  }

  draw(gfx) {
    if (this.sprite) gfx.blitAdditive(this.sprites[this.sprite.index], this.sprite.x, this.sprite.y, false);
    this.sprite = null;
    this.system.step(gfx, { additive: true });
  }
}
