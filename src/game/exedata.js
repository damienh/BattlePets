// Reads the static game tables straight out of the original BattlePets.exe
// (v1.0 full, 163840 bytes). Nothing from the original is bundled with the
// remake; offsets are documented in docs/RE-NOTES.md.

const IMAGE_BASE = 0x400000;
const EXE_SIZE = 163840;
const SIGNATURE = { offset: 0x2463c, text: 'Bluberd' };

const LOCATIONS = { offset: 0x22e50, stride: 0xa8, count: 15 };
const SPELLS = { offset: 0x23828, stride: 0x64, count: 36 };
const PETS = { offset: 0x24638, stride: 0xc4, count: 36 };
const WIZARD_IDS = 0x266c0;
const WIZARD_LEVELS = 0x26750;
const WIZARD_PORTRAITS = { offset: 0x267e0, stride: 64 };
const TEAM_SIZE = 6;
const WIZARD_COUNT = 6;

const WIZARD_INTRO_VAS = [0x426b7c, 0x426b28, 0x426ad4, 0x426aa8, 0x426a58, 0x4269d8];
const WIZARD_DEFEAT_VAS = [0x426e38, 0x426d9c, 0x426d04, 0x426c98, 0x426c3c, 0x426bfc];
// Per-spell wave files for the cast / fly / impact phases (0x404c70); "X" = none.
const SPELL_SOUNDS = { cast: 0x1f828, fly: 0x20128, impact: 0x20a28, stride: 64 };

const TEXT_VAS = {
  credits: 0x422244,
  homeRest: 0x421c90,
  towerLost: 0x4269a4,
};

function cString(view, offset, maxLen = 512) {
  let out = '';
  for (let i = 0; i < maxLen; i += 1) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

const i32 = (view, offset) => view.getInt32(offset, true);
const f32 = (view, offset) => view.getFloat32(offset, true);
const floats = (view, offset, n) => Array.from({ length: n }, (_, i) => f32(view, offset + i * 4));
const ints = (view, offset, n) => Array.from({ length: n }, (_, i) => i32(view, offset + i * 4));

function records(table, read) {
  return Array.from({ length: table.count }, (_, i) => read(table.offset + i * table.stride, i));
}

function spellSound(view, table, id) {
  const path = cString(view, table + id * SPELL_SOUNDS.stride, SPELL_SOUNDS.stride);
  return path.startsWith('X') ? null : path;
}

function parseSpells(view) {
  return records(SPELLS, (o, i) => {
    const [damage, ...effects] = floats(view, o + 0x44, 8);
    const sounds = {
      cast: spellSound(view, SPELL_SOUNDS.cast, i),
      fly: spellSound(view, SPELL_SOUNDS.fly, i),
      impact: spellSound(view, SPELL_SOUNDS.impact, i),
    };
    return { id: i32(view, o), name: cString(view, o + 4, 64), damage, effects, sounds };
  });
}

function parsePets(view) {
  return records(PETS, (o) => ({
    id: i32(view, o),
    name: cString(view, o + 4, 64),
    bitmap: cString(view, o + 0x44, 64),
    toughness: i32(view, o + 0x84),
    speed: i32(view, o + 0x88),
    smarts: i32(view, o + 0x8c),
    resist: floats(view, o + 0x90, 7),
    spells: ints(view, o + 0xac, 5),
  }));
}

function parseLocations(view) {
  return records(LOCATIONS, (o) => ({
    name: cString(view, o, 64),
    icon: i32(view, o + 0x40),
    index: i32(view, o + 0x44),
    x: i32(view, o + 0x48),
    y: i32(view, o + 0x4c),
    visible: i32(view, o + 0x50) !== 0,
    file: cString(view, o + 0x64, 64),
  }));
}

function parseWizards(view) {
  const atVa = (va) => cString(view, va - IMAGE_BASE);
  return Array.from({ length: WIZARD_COUNT }, (_, w) => {
    const ids = ints(view, WIZARD_IDS + w * TEAM_SIZE * 4, TEAM_SIZE);
    const levels = ints(view, WIZARD_LEVELS + w * TEAM_SIZE * 4, TEAM_SIZE);
    const team = ids
      .map((petId, i) => ({ petId, level: levels[i] }))
      .filter(({ petId }) => petId >= 0);
    return {
      team,
      portrait: cString(view, WIZARD_PORTRAITS.offset + w * WIZARD_PORTRAITS.stride, 64),
      intro: atVa(WIZARD_INTRO_VAS[w]),
      defeat: atVa(WIZARD_DEFEAT_VAS[w]),
    };
  });
}

function parseTexts(view) {
  return Object.fromEntries(
    Object.entries(TEXT_VAS).map(([key, va]) => [key, cString(view, va - IMAGE_BASE)]),
  );
}

/**
 * Parse the game tables from the original executable.
 * @param {ArrayBuffer} buffer contents of BattlePets.exe
 */
export function parseExe(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== EXE_SIZE) {
    throw new Error('Unsupported BattlePets.exe: expected the 163840-byte v1.0 full version');
  }
  const view = new DataView(buffer);
  if (cString(view, SIGNATURE.offset, 16) !== SIGNATURE.text) {
    throw new Error('Unsupported BattlePets.exe: data tables not found at the expected offsets');
  }
  return Object.freeze({
    spells: parseSpells(view),
    pets: parsePets(view),
    locations: parseLocations(view),
    wizards: parseWizards(view),
    texts: parseTexts(view),
  });
}
