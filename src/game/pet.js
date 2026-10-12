// Pet instances and levelling rules (0x40f480, 0x40f540, 0x40f5d0, 0x403230).
// Pets are plain immutable objects; templates come from exedata.pets.

export const STATUS = Object.freeze({
  PARALYZE: 0, POISON: 1, SLOW: 2, ACCURACY: 3, DEFENSE: 4, OFFENSE: 5, SPEED: 6,
});
export const STATUS_COUNT = 7;
export const MAX_SPELLS = 5;
const CLEAR_STATUS = Object.freeze(Array(STATUS_COUNT).fill(0));

export function spellsAvailable(level) {
  return Math.min(MAX_SPELLS, Math.trunc((level - 1) / 4) + 2);
}

export function maxHp(pet, template) {
  return template.toughness * pet.level;
}

export function xpForLevel(level) {
  return 10 * level * level;
}

export function createPet(template, level, name = template.name) {
  return {
    templateId: template.id,
    name,
    level,
    xp: 0,
    hp: template.toughness * level,
    status: [...CLEAR_STATUS],
    poisonDamage: 0,
  };
}

/** Adds xp; levels up (once) and fully heals when xp reaches 10·level². */
export function addXp(pet, template, amount) {
  const xp = pet.xp + amount;
  if (xp < xpForLevel(pet.level)) return { pet: { ...pet, xp }, leveled: false };
  const level = pet.level + 1;
  return { pet: { ...pet, xp, level, hp: template.toughness * level }, leveled: true };
}

/** XP for defeating an opponent of the given level (difficulty 2 = hard). */
export function killXp(level, difficulty) {
  const base = 20 * level - 10;
  const scaled = difficulty === 2 ? Math.floor((2 * base) / 3) : base;
  return Math.floor(scaled / 2);
}

export function hpColor(pet, template) {
  const max = maxHp(pet, template);
  if (2 * pet.hp > max) return 'green';
  if (4 * pet.hp > max) return 'yellow';
  return 'red';
}

export const HP_RGB = Object.freeze({ green: [0, 255, 0], yellow: [255, 255, 0], red: [255, 0, 0] });

export function healPet(pet, template) {
  return { ...pet, hp: maxHp(pet, template), status: [...CLEAR_STATUS] };
}

/** A newly caught pet keeps its battle state; xp is set to the start of its level. */
export function caughtPet(wild) {
  return { ...wild, xp: 10 * (wild.level - 1) * (wild.level - 1) };
}

export function isHealthy(pet) {
  return pet !== null && pet.hp > 0;
}
