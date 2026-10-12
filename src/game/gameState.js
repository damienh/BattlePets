// Whole-game state: party, map progress, options, keys and the .gam save format
// (new game 0x40f410/0x40a278, load 0x40a160, save 0x40ed80).

import { createPet, healPet, isHealthy } from './pet.js';

export const LOCATION_ICON = Object.freeze({
  HOME: 0, CAVE: 1, TOWER: 2, MARKET: 3, TEMPLE: 4, FOREST: 5, RUIN: 6, CASTLE: 7,
});
const STARTER = { templateId: 4, level: 1, name: 'Mookie' };
const PARTY_SIZE = 6;
const WIZARD_COUNT = 6;
const ALWAYS_VISIBLE = new Set([LOCATION_ICON.HOME, LOCATION_ICON.TEMPLE, LOCATION_ICON.MARKET]);
const ADVENTURE = new Set([
  LOCATION_ICON.CAVE, LOCATION_ICON.FOREST, LOCATION_ICON.RUIN, LOCATION_ICON.CASTLE, LOCATION_ICON.TOWER,
]);

export function newGame(data, seed) {
  const starter = createPet(data.pets[STARTER.templateId], STARTER.level, STARTER.name);
  return {
    party: [starter, ...Array(PARTY_SIZE - 1).fill(null)],
    location: data.locations.findIndex((l) => l.icon === LOCATION_ICON.HOME),
    visible: data.locations.map((l) => ALWAYS_VISIBLE.has(l.icon) || l.index === 0),
    wizardsDefeated: Array(WIZARD_COUNT).fill(false),
    // Option globals live in zero-initialised memory in the original.
    difficulty: 0,
    gender: 0,
    textSpeed: 0,
    caughtBefore: false,
    items: [],
    seed,
  };
}

export const anyHealthy = (state) => state.party.some(isHealthy);

export function locationEnterable(state, data, index) {
  const loc = data.locations[index];
  if (!state.visible[index]) return false;
  if (!ADVENTURE.has(loc.icon)) return true;
  if (!anyHealthy(state)) return false;
  return !(loc.icon === LOCATION_ICON.TOWER && state.wizardsDefeated[loc.index]);
}

export function healParty(state, data) {
  return { ...state, party: state.party.map((p) => (p ? healPet(p, data.pets[p.templateId]) : p)) };
}

/** Wizard k beaten: mark it and reveal every location with index k + 1 (0x412940). */
export function defeatWizard(state, data, wizard) {
  return {
    ...state,
    wizardsDefeated: state.wizardsDefeated.map((d, i) => d || i === wizard),
    visible: state.visible.map((v, i) => v || data.locations[i].index === wizard + 1),
  };
}

export function giveAway(state, slot) {
  const count = state.party.filter(Boolean).length;
  if (!state.party[slot] || count < 2) return state;
  return { ...state, party: state.party.map((p, i) => (i === slot ? null : p)) };
}

export function swapPets(state, a, b) {
  const party = state.party.map((p, i) => {
    if (i === a) return state.party[b];
    if (i === b) return state.party[a];
    return p;
  });
  return { ...state, party };
}

// ---- .gam save files -----------------------------------------------------------

export function serializeSave(state, data) {
  const loc = data.locations[state.location];
  const lines = [`${loc.x} ${loc.y}`];
  state.party.forEach((p) => {
    if (p) lines.push('YES', p.name, `${p.templateId} ${p.level} ${p.hp} ${p.xp}`);
    else lines.push('NO');
  });
  lines.push(state.visible.map((v) => (v ? '1 ' : '0 ')).join(''));
  lines.push(state.wizardsDefeated.map((d) => `${d ? 1 : 0} `).join(''));
  lines.push(`${state.difficulty} ${state.gender} ${state.textSpeed} ${state.caughtBefore ? 1 : 0}`);
  lines.push(...state.items, 'ITEMEND', '');
  return lines.join('\n');
}

function reader(text) {
  const lines = text.split(/\r?\n/);
  let i = 0;
  return {
    line() {
      if (i >= lines.length) throw new Error('Not a BattlePets save file (unexpected end of file)');
      const line = lines[i];
      i += 1;
      return line;
    },
    ints(count) {
      const nums = this.line().trim().split(/\s+/).map(Number);
      if (nums.length < count || nums.slice(0, count).some((n) => !Number.isInteger(n))) {
        throw new Error('Not a BattlePets save file (expected numbers)');
      }
      return nums.slice(0, count);
    },
  };
}

function readPet(r, data) {
  const flag = r.line().trim();
  if (flag.charAt(0) !== 'Y') return null;
  const name = r.line().slice(0, 127);
  const [templateId, level, hp, xp] = r.ints(4);
  const template = data.pets[templateId];
  if (!template) throw new Error(`Not a BattlePets save file (unknown pet ${templateId})`);
  return { ...createPet(template, level, name), hp, xp };
}

export function parseSave(text, data, seed) {
  const r = reader(text);
  const [x, y] = r.ints(2);
  const location = data.locations.findIndex((l) => l.x === x && l.y === y);
  const party = Array.from({ length: PARTY_SIZE }, () => readPet(r, data));
  const visible = r.ints(data.locations.length).map((v) => v !== 0);
  const wizardsDefeated = r.ints(WIZARD_COUNT).map((v) => v !== 0);
  const [difficulty, gender, textSpeed, caught] = r.ints(4);
  const items = [];
  for (let item = r.line(); item !== 'ITEMEND'; item = r.line()) items.push(item);
  return {
    party,
    location: location >= 0 ? location : 0,
    visible,
    wizardsDefeated,
    difficulty,
    gender,
    textSpeed,
    caughtBefore: caught !== 0,
    items,
    seed,
  };
}
