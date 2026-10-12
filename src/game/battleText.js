// Combat messages, formatted exactly as the original's sprintf calls.

const EFFECT_LANDED = [
  (n) => `is paralyzed for ${n} more turns!`,
  (n) => `is poisoned for ${n} more turns!`,
  (n) => `is moving at half-speed for ${n} more turns!`,
  () => 'has less accuracy!',
  () => 'has less defense!',
  () => 'has less power!',
  () => 'has less speed!',
];

const EFFECT_RESISTED = [
  'resists being paralyzed!',
  'resists being poisoned!',
  'resists being slowed down!',
  'resists being made less accurate!',
  'resists being made less defensive!',
  'resists being made less powerful!',
  'resists being made less speedy!',
];

const points = (n) => (n < 2 ? 'point' : 'points');

export const battleText = Object.freeze({
  battling: (pet, enemy) => `${pet} is battling a ${enemy}!`,
  nowBattling: (pet, enemy) => `${pet} is now battling the ${enemy}!`,
  chooseSpell: 'Choose a spell.',
  chooseAnother: 'Choose another BattlePet!',
  entersBattle: (pet) => `${pet} enters the battle!`,
  caught: (enemy) => `You caught the ${enemy}!`,
  notCaught: (enemy) => `You didn't catch the ${enemy}!`,
  win: 'You win this battle!',
  lost: 'You have lost!',
  retreats: (enemy) => `The ${enemy} retreats!`,
  levelUp: (pet, level) => `${pet} is now level ${level}!`,

  playerAttacks: (pet, spell, enemy) => `${pet} uses ${spell} on the ${enemy}!`,
  playerBuffs: (pet, spell) => `${pet} uses ${spell}!`,
  enemyAttacks: (enemy, spell, pet) => `The ${enemy} uses ${spell} on ${pet}!`,
  enemyBuffs: (enemy, spell) => `The ${enemy} uses ${spell}!`,

  playerMisses: (pet) => `${pet} misses!`,
  enemyMisses: (enemy) => `The ${enemy} misses!`,
  enemyHurt: (enemy, n) => (n < 1 ? `The ${enemy} is not hurt!` : `The ${enemy} loses ${n} ${points(n)}!`),
  playerHurt: (pet, n) => (n < 1 ? `${pet} is not hurt!` : `${pet} loses ${n} ${points(n)}!`),

  paralyzed: (name, isPlayer) => `${isPlayer ? '' : 'The '}${name} is paralyzed and can't attack!`,
  tooSlow: (name, isPlayer) => `${isPlayer ? '' : 'The '}${name} is too slow to attack this time!`,
  poisoned: (name, isPlayer, n) => `${isPlayer ? '' : 'The '}${name} loses ${n} points to poison!`,

  /** "The <enemy> " / "<pet> " prefix followed by the effect line. */
  effect: (name, targetIsPlayer, { index, resisted, turns }) => {
    const prefix = targetIsPlayer ? `${name} ` : `The ${name} `;
    return prefix + (resisted ? EFFECT_RESISTED[index] : EFFECT_LANDED[index](turns));
  },
});
