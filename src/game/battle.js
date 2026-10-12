// Combat state machine, a 1:1 port of the original's states 0..10 (0x402390).
// Pure: every function takes a battle and returns { battle, cues }.
// Cues tell the presentation layer which sounds to play.

import { rand } from './rng.js';
import { createPet, addXp, killXp, spellsAvailable, caughtPet, isHealthy } from './pet.js';
import {
  firstAffliction, playerGoesFirst, rollHit, damageFor, applyEffects, decayStatuses,
  catchable, rollCatch,
} from './battleRules.js';
import { battleText as say } from './battleText.js';

export const PHASE = Object.freeze({
  CHOOSE: 0, IDLE: 1, CAST: 2, FLY: 3, IMPACT: 4, AFTER: 5, OVER: 6,
  READY: 7, RETREAT: 8, CATCH: 9, NEXT: 10,
});
export const RESULT = Object.freeze({ WON: 'won', LOST: 'lost', RETREATED: 'retreated' });
export const PARTY_SIZE = 6;

/** Message delay in frames: (15 - textSpeed) * 3 (0x401704). */
export const textDelay = (textSpeed) => (15 - textSpeed) * 3;

// ---- helpers ----------------------------------------------------------------

const tplOf = (ctx, pet) => ctx.pets[pet.templateId];
const player = (b) => b.party[b.active];
const setPlayer = (b, pet) => ({ ...b, party: b.party.map((p, i) => (i === b.active ? pet : p)) });
const spellOf = (ctx, pet, slot) => ctx.spells[tplOf(ctx, pet).spells[slot]];
const at = (b, phase, timer = b.timer) => ({ ...b, phase, timer });
const out = (battle, cues = []) => ({ battle, cues });
const spellCue = (phase, b) => ({ type: 'spell', phase, spellId: b.spellId });

function spawnEnemy(ctx, b) {
  const { petId, level } = b.opponents[b.opponentIndex];
  return createPet(ctx.pets[petId], level);
}

function firstHealthy(party) {
  return party.findIndex(isHealthy);
}

/** "%s uses %s ..." announcement for the current actor (0x404aa0). */
function announce(ctx, b) {
  const spell = ctx.spells[b.spellId];
  const pet = player(b).name;
  const enemy = b.enemy.name;
  if (b.playerActing) {
    return spell.damage < 0 ? say.playerBuffs(pet, spell.name) : say.playerAttacks(pet, spell.name, enemy);
  }
  return spell.damage < 0 ? say.enemyBuffs(enemy, spell.name) : say.enemyAttacks(enemy, spell.name, pet);
}

function withActor(ctx, b, playerActing) {
  const actor = playerActing ? player(b) : b.enemy;
  const slot = playerActing ? b.playerSpell : b.enemySpell;
  const next = { ...b, playerActing, spellId: tplOf(ctx, actor).spells[slot] };
  return { ...next, message: announce(ctx, next) };
}

// ---- construction -----------------------------------------------------------

/**
 * @param ctx { pets, spells, difficulty, textSpeed, caughtBefore }
 * @param setup { party, opponents: [{petId, level}], wild, seed }
 */
export function startBattle(ctx, { party, opponents, wild, seed }) {
  const T = textDelay(ctx.textSpeed);
  const base = {
    phase: PHASE.CHOOSE, timer: 2 * T, T,
    party, active: firstHealthy(party), opponents, opponentIndex: 0, wild,
    enemy: null, playerSpell: 0, enemySpell: 0, spellId: 0,
    playerActing: false, playerDone: false, enemyDone: false, hit: false,
    slowToggle: 0, caught: false, changing: false, catchShown: false,
    caughtBefore: ctx.caughtBefore, result: RESULT.LOST, finished: false, seed, message: '',
  };
  const enemy = spawnEnemy(ctx, base);
  const b = { ...base, enemy, message: say.battling(base.party[base.active].name, enemy.name) };
  return out(b, [{ type: 'sfx', name: 'fanfare' }]);
}

// ---- status messages before an action (0x404690) -----------------------------

function afflictionStep(ctx, b, affliction) {
  const T2 = 2 * b.T;
  const ready = { ...at(b, PHASE.READY, 1) };
  const isPlayer = b.playerActing;
  const actor = isPlayer ? player(b) : b.enemy;
  if (affliction === 1) {
    return out({ ...ready, timer: T2, message: say.paralyzed(actor.name, isPlayer) });
  }
  if (affliction === 2) {
    const dmg = Math.min(actor.poisonDamage, actor.hp);
    const hurt = { ...actor, hp: actor.hp - dmg };
    const next = isPlayer ? setPlayer(ready, hurt) : { ...ready, enemy: hurt };
    const shown = !isPlayer ? showCatchIfAllowed(ctx, next) : next;
    return out({ ...shown, timer: T2, message: say.poisoned(actor.name, isPlayer, dmg) });
  }
  if (affliction === 3 && b.slowToggle % 2 === 1) {
    return out({ ...ready, timer: T2, message: say.tooSlow(actor.name, isPlayer) });
  }
  return out(ready);
}

/** Starts an action after announcing it (shared tail of 0x4030f0 / 0x404940). */
function beginAction(ctx, b) {
  const actor = b.playerActing ? player(b) : b.enemy;
  const affliction = firstAffliction(actor);
  if (affliction !== 0) return afflictionStep(ctx, b, affliction);
  return out(at(b, PHASE.CAST, b.T), [spellCue(2, b)]);
}

/** Round start after the player picks a spell or fails a catch (0x4030f0). */
function startRound(ctx, b) {
  const r = rand(b.seed);
  const enemySpell = r.value % spellsAvailable(b.enemy.level);
  const rolled = { ...b, enemySpell, seed: r.seed, changing: false };
  const playerFirst = !rolled.playerDone
    && playerGoesFirst(player(b), tplOf(ctx, player(b)), b.enemy, tplOf(ctx, b.enemy));
  return beginAction(ctx, withActor(ctx, rolled, playerFirst));
}

function endRound(b) {
  return {
    ...at(b, PHASE.IDLE),
    party: b.party.map((p, i) => (i === b.active ? decayStatuses(p) : p)),
    enemy: decayStatuses(b.enemy),
    message: say.chooseSpell,
  };
}

/** After an action: the other side acts, or the round ends (0x404940). */
function advance(ctx, b) {
  if (b.playerActing) {
    const done = { ...b, playerDone: true };
    if (done.enemyDone) return out(endRound(done));
    return beginAction(ctx, withActor(ctx, done, false));
  }
  const done = { ...b, enemyDone: true };
  if (done.playerDone) return out(endRound(done));
  return beginAction(ctx, withActor(ctx, done, true));
}

// ---- states -----------------------------------------------------------------

function showCatchIfAllowed(ctx, b) {
  if (b.catchShown || !b.wild) return b;
  if (!catchable(b.enemy, tplOf(ctx, b.enemy))) return b;
  if (!b.party.some((p) => p === null)) return b;
  return { ...b, catchShown: true };
}

function castState(ctx, b) {
  const spell = ctx.spells[b.spellId];
  const att = b.playerActing ? player(b) : b.enemy;
  const def = b.playerActing ? b.enemy : player(b);
  const { hit, seed } = rollHit({
    attacker: att, attackerTpl: tplOf(ctx, att), defenderTpl: tplOf(ctx, def),
    isPlayer: b.playerActing, difficulty: ctx.difficulty,
  }, spell, b.seed);
  return out({ ...at(b, PHASE.FLY, b.T), hit, seed }, [spellCue(3, b)]);
}

function flyState(ctx, b) {
  const next = at(b, PHASE.IMPACT, b.T);
  const spell = ctx.spells[b.spellId];
  if (!b.hit) {
    const message = b.playerActing ? say.playerMisses(player(b).name) : say.enemyMisses(b.enemy.name);
    return out({ ...next, message });
  }
  const cues = [spellCue(4, b)];
  if (spell.damage < 1) return out(next, cues);
  if (b.playerActing) {
    const dmg = damageFor(player(b), b.enemy, spell);
    const enemy = { ...b.enemy, hp: b.enemy.hp - dmg };
    const shown = showCatchIfAllowed(ctx, { ...next, enemy });
    return out({ ...shown, message: say.enemyHurt(enemy.name, dmg) }, cues);
  }
  const dmg = damageFor(b.enemy, player(b), spell);
  const pet = { ...player(b), hp: player(b).hp - dmg };
  return out({ ...setPlayer(next, pet), message: say.playerHurt(pet.name, dmg) }, cues);
}

function impactState(ctx, b) {
  const next = at(b, PHASE.AFTER, 1);
  if (!b.hit) return out(next);
  const isPlayer = b.playerActing;
  const att = isPlayer ? player(b) : b.enemy;
  const def = isPlayer ? b.enemy : player(b);
  const res = applyEffects({
    attacker: att, defender: def, defenderTpl: tplOf(ctx, def), spell: ctx.spells[b.spellId], seed: b.seed,
  });
  const pets = isPlayer
    ? { ...setPlayer(next, res.attacker), enemy: res.defender }
    : { ...setPlayer(next, res.defender), enemy: res.attacker };
  const updated = { ...pets, seed: res.seed };
  if (!res.effect) return out(updated);
  const slowed = !res.effect.resisted && res.effect.index === 2 ? { slowToggle: 0 } : {};
  const message = say.effect(isPlayer ? b.enemy.name : player(b).name, !isPlayer, res.effect);
  return out({ ...updated, ...slowed, timer: b.T, message });
}

/** Someone fainted (0x403230). */
function faint(ctx, b) {
  if (player(b).hp > 0) {
    const tpl = tplOf(ctx, player(b));
    const { pet, leveled } = addXp(player(b), tpl, killXp(b.enemy.level, ctx.difficulty));
    const awarded = setPlayer(b, pet);
    if (leveled) {
      return out({ ...at(awarded, PHASE.RETREAT, 2 * b.T), message: say.levelUp(pet.name, pet.level) },
        [{ type: 'sfx', name: 'levelUp' }]);
    }
    return out({ ...at(awarded, PHASE.NEXT, b.T), result: RESULT.WON, message: say.retreats(b.enemy.name) });
  }
  const next = firstHealthy(b.party);
  if (next < 0) {
    return out({ ...at(b, PHASE.OVER, b.T), result: RESULT.LOST, message: say.lost });
  }
  const swapped = { ...b, active: next };
  return out({ ...at(swapped, PHASE.CHOOSE, 2 * b.T), message: say.nowBattling(player(swapped).name, b.enemy.name) });
}

function afterState(ctx, b) {
  if (player(b).hp > 0 && b.enemy.hp > 0) return advance(ctx, b);
  return faint(ctx, b);
}

function readyState(ctx, b) {
  if (!(player(b).hp > 0 && b.enemy.hp > 0)) return faint(ctx, b);
  const actor = b.playerActing ? player(b) : b.enemy;
  const affliction = firstAffliction(actor);
  if (affliction === 1 || (affliction === 3 && b.slowToggle % 2 === 1)) return advance(ctx, b);
  const timer = Math.trunc((2 * b.T) / 3);
  return out({ ...at(b, PHASE.CAST, timer), message: announce(ctx, b) }, [spellCue(2, b)]);
}

function nextOpponent(ctx, b) {
  const opponentIndex = b.opponentIndex + 1;
  const timer = Math.trunc((3 * b.T) / 2);
  if (opponentIndex >= b.opponents.length) {
    return out({ ...at(b, PHASE.OVER, timer), opponentIndex, result: RESULT.WON, message: say.win });
  }
  const advanced = { ...b, opponentIndex, catchShown: false };
  const enemy = spawnEnemy(ctx, advanced);
  return out({
    ...at(advanced, PHASE.CHOOSE, timer), enemy, message: say.battling(player(b).name, enemy.name),
  });
}

function catchState(ctx, b) {
  if (!b.caught) return startRound(ctx, { ...b, playerDone: true, enemyDone: false });
  const slot = b.party.findIndex((p) => p === null);
  const party = b.party.map((p, i) => (i === slot ? caughtPet(b.enemy) : p));
  return nextOpponent(ctx, { ...b, party, enemy: null });
}

const STATES = {
  [PHASE.CHOOSE]: (ctx, b) => out({ ...at(b, PHASE.IDLE), message: say.chooseSpell }),
  [PHASE.IDLE]: (ctx, b) => out(b),
  [PHASE.CAST]: castState,
  [PHASE.FLY]: flyState,
  [PHASE.IMPACT]: impactState,
  [PHASE.AFTER]: afterState,
  [PHASE.OVER]: (ctx, b) => out({ ...b, finished: true }),
  [PHASE.READY]: readyState,
  [PHASE.RETREAT]: (ctx, b) => out({
    ...at(b, PHASE.NEXT, b.T), result: RESULT.WON, message: say.retreats(b.enemy.name),
  }),
  [PHASE.CATCH]: catchState,
  [PHASE.NEXT]: (ctx, b) => nextOpponent(ctx, { ...b, enemy: null }),
};

/** Advance one 30 Hz frame. */
export function tick(ctx, battle) {
  if (battle.finished) return out(battle);
  const timer = battle.timer - 1;
  if (timer > 0) return out({ ...battle, timer });
  return STATES[battle.phase](ctx, { ...battle, timer });
}

// ---- player input (0x401b30); ignored unless waiting for a choice -------------

const accepting = (b) => b.phase === PHASE.IDLE && !b.finished;
const rejected = (b) => out(b, [{ type: 'sfx', name: 'invalid' }]);
const clicked = (battle, cues = []) => out(battle, [{ type: 'sfx', name: 'click' }, ...cues]);

export function chooseSpell(ctx, b, slot) {
  if (!accepting(b)) return rejected(b);
  if (slot >= spellsAvailable(player(b).level)) return out(b);
  const picked = {
    ...b, slowToggle: b.slowToggle + 1, playerSpell: slot, playerDone: false, enemyDone: false,
  };
  const { battle, cues } = startRound(ctx, picked);
  return clicked(battle, cues);
}

export function retreat(b) {
  if (!accepting(b)) return rejected(b);
  return clicked({ ...b, result: RESULT.RETREATED, finished: true });
}

export function requestChange(b) {
  if (!accepting(b)) return rejected(b);
  return clicked({ ...b, changing: true, message: say.chooseAnother });
}

export function attemptCatch(b) {
  if (!accepting(b) || !b.catchShown) return rejected(b);
  const { caught, seed } = rollCatch(b.caughtBefore, b.seed);
  const message = caught ? say.caught(b.enemy.name) : say.notCaught(b.enemy.name);
  return clicked({
    ...at(b, PHASE.CATCH, b.T), slowToggle: b.slowToggle + 1, caught, seed, message,
    caughtBefore: true,
  });
}

/**
 * Party slot click. While changing, swaps the active pet (no fainted check, as in
 * the original). Otherwise returns { inspect: slot } for the UI to open the pet screen.
 */
export function selectSlot(ctx, b, slot) {
  if (!accepting(b)) return rejected(b);
  if (!b.party[slot]) return clicked({ ...b, changing: false });
  if (!b.changing) return { ...clicked({ ...b, changing: false }), inspect: slot };
  const swapped = { ...b, active: slot, changing: false };
  return clicked({ ...swapped, message: say.entersBattle(player(swapped).name) });
}

export const activePet = player;
