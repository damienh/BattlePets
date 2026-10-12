// Pure combat formulas from the state machine at 0x402390. All x87 float->int
// conversions truncate (MSVC _ftol); statuses and resistances are float32.

import { rand, ftol } from './rng.js';
import { STATUS, STATUS_COUNT, maxHp } from './pet.js';

const HIT_DIE = 20;
const BASE_HIT = 10;
const EASY_BONUS = 3;
const ROOKIE_BONUS = 3;
const STATUS_DECAY = 0.25;

/** Index (1-based) of the first negative status, 0 if none (0x40f5a0). */
export function firstAffliction(pet) {
  const i = pet.status.findIndex((s) => s < 0);
  return i + 1;
}

/** Player acts first unless the enemy is strictly faster (0x4030f0). */
export function playerGoesFirst(player, playerTpl, enemy, enemyTpl) {
  const p = Math.fround(playerTpl.speed + player.status[STATUS.SPEED]);
  const e = Math.fround(enemyTpl.speed + enemy.status[STATUS.SPEED]);
  return p >= e;
}

/**
 * Hit chance out of 20. Note the original subtracts the accuracy status, so an
 * accuracy debuff (negative status) *raises* the chance - reproduced faithfully.
 */
export function hitChance({ attacker, attackerTpl, defenderTpl, isPlayer, difficulty }) {
  const raw = attackerTpl.smarts - attacker.status[STATUS.ACCURACY] - defenderTpl.smarts;
  const easy = isPlayer && difficulty === 0 ? EASY_BONUS : 0;
  const rookie = isPlayer && attacker.level === 1 ? ROOKIE_BONUS : 0;
  return ftol(raw) + BASE_HIT + easy + rookie;
}

/** Rolls to hit; self-buff spells (damage < 0) always hit. */
export function rollHit(params, spell, seed) {
  const r = rand(seed);
  const hit = hitChance(params) > r.value % HIT_DIE || spell.damage < 0;
  return { hit, seed: r.seed };
}

/** Damage before application, clamped to [0, defender.hp]. */
export function damageFor(attacker, defender, spell) {
  const base = ftol(attacker.level * Math.fround(spell.damage));
  const dmg = ftol(base + attacker.status[STATUS.OFFENSE] - defender.status[STATUS.DEFENSE]);
  return Math.min(Math.max(dmg, 0), defender.hp);
}

export function withStatus(pet, index, value) {
  return { ...pet, status: pet.status.map((s, i) => (i === index ? value : s)) };
}

/** Turns reported in "...for %d more turns!" for a status value. */
export function turnsLeft(statusValue) {
  return Math.max(Math.ceil(-statusValue / STATUS_DECAY), 0) - 1;
}

/** End-of-round recovery: negative statuses tick up by 0.25 (0x4045c0). */
export function decayStatuses(pet) {
  return {
    ...pet,
    status: pet.status.map((s) => {
      if (!(s < 0)) return s;
      const next = Math.fround(s + STATUS_DECAY);
      return next > 0 ? 0 : next;
    }),
  };
}

/**
 * Applies the first debuff of a spell that hit (state 4). Self buffs (effect < 0)
 * are applied silently to the caster. Returns the new pets, seed and message.
 */
export function applyEffects({ attacker, defender, defenderTpl, spell, seed }) {
  let att = attacker;
  let def = defender;
  let s = seed;
  for (let i = 0; i < STATUS_COUNT; i += 1) {
    const effect = spell.effects[i];
    if (effect > 0) {
      const r = rand(s);
      s = r.seed;
      const roll = Math.fround((r.value % 100) * 0.01);
      if (roll <= Math.fround(defenderTpl.resist[i])) {
        return { attacker: att, defender: def, seed: s, effect: { index: i, resisted: true } };
      }
      const value = Math.fround(def.status[i] - 1);
      def = withStatus(def, i, value);
      if (i === STATUS.POISON) def = { ...def, poisonDamage: Math.trunc(att.level / 4) + 1 };
      return {
        attacker: att, defender: def, seed: s,
        effect: { index: i, resisted: false, turns: turnsLeft(value) },
      };
    }
    if (effect < 0) att = withStatus(att, i, Math.fround(att.status[i] - effect));
  }
  return { attacker: att, defender: def, seed: s, effect: null };
}

/** Catch button condition: hp at or below a quarter, or 1 hp left. */
export function catchable(enemy, enemyTpl) {
  return enemy.hp * 4 <= maxHp(enemy, enemyTpl) || enemy.hp < 2;
}

/** Catch roll (button 2): first ever catch is guaranteed, then 1 in 4. */
export function rollCatch(caughtBefore, seed) {
  if (!caughtBefore) return { caught: true, seed };
  const r = rand(seed);
  return { caught: r.value % 4 === 0, seed: r.seed };
}
