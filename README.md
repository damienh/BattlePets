# BattlePets remake

A like-for-like browser reimplementation of **BattlePets V1.0** (T2R Associates /
Thom Robertson, 1999), rebuilt by reverse-engineering the original `BattlePets.exe`.

The remake contains **no original content**. Stats, spells, wizard teams, dialogue,
art, sounds and mazes are all read at runtime from your own copy of the game, the
way OpenTTD or OpenRCT2 use original data files.

> Copyright note: a 1999 game is still under copyright (typically 70+ years), even
> if it is abandonware. Keep the original files to yourself and don't redistribute
> them with this code.

## Running

Requires Node 20+ and no other dependencies.

```sh
cd remake          # this folder, inside the original install
npm start          # http://localhost:8080/
```

The server serves the remake and the original install. It defaults to the parent
folder; use `--original /path/to/BattlePets` and `--port N` to change that. File
names are resolved case-insensitively, as on Windows. Click **Click to play** to
start (browsers need a click before playing sound).

Saves use the original `.gam` text format, so saves from the 1999 game load here
and the other way round. *Save Game* downloads a `.gam` file and *Load Game* opens
one.

## Controls (as in the original)

| Where | Input |
|---|---|
| Menus | Mouse, or Up/Down plus Enter/Space |
| Map | Click a building, maze or tower. *Options* opens save/options/quit |
| Maze | Arrow keys or numpad 1/3/7/9. Left mouse walks toward the arrow (hold to keep walking). Right-drag pans the view. Enter views your pets |
| Combat | Click a spell, *Catch*, *Change* (then a pet) or *Retreat* |
| Pet screen | Type to rename while the name box is highlighted. *SWAP* then a pet changes places |
| Options | Left click cycles forward, right click backward |

## Faithfulness

Every rule was taken from the disassembly; see `docs/RE-NOTES.md`. This includes the
original's quirks, kept deliberately:

- Accuracy debuffs *raise* the target's hit chance (sign error in the hit roll).
- Only a pet's first negative status is checked at the start of its action.
- Wild pet levels never reach the AREA maximum (`rand() % (max - min)`).
- Buffs and debuffs persist between battles until you rest at home.
- The first catch always succeeds; after that it's 1 in 4.
- Options start at Easy / Female / Text Speed 0, the original's zeroed globals.
- An enemy's buff sparkles use the *player's* silhouette.
- The C runtime `rand()` LCG is used, and combat and particle effects share one
  random stream, as in the original.

Known differences: no CD audio tracks (the original only played these from the
retail CD), and the browser save dialog replaces the Windows one.

## Layout

```
src/game/     pure, tested rules: exe tables, pets, combat state machine, mazes, saves
src/engine/   canvas blits, GDI-style text, buttons, input, audio, particles
src/modes/    one file per original game mode (map, maze, combat, tower, ...)
tools/        local server
docs/         reverse-engineering notes
test/         node:test suites (npm test, npm run coverage)
```
