# BattlePets (T2R Associates, 1999) — reverse-engineering notes

Source: `BattlePets.exe` v1.0 full (PE32, MSVC, 163840 bytes, image base 0x400000,
file offset == VA − 0x400000 for all sections). Disassembled with capstone.
Addresses below are virtual addresses.

## Static data tables (`.data`)

| Table | VA | Stride | Count |
|---|---|---|---|
| Locations | 0x422e50 | 0xA8 | 16 (Home .. Vile Wizard) |
| Spells | 0x423828 | 0x64 | 36 |
| Pets | 0x424638 | 0xC4 | 36 |
| Wizard team ids | 0x4266c0 | 6×int32 per wizard, −1 terminated | 6 |
| Wizard team levels | 0x426750 | 6×int32 per wizard | 6 |

**Location** (0xA8): `name[64]`, `+40 icon` (0 home, 1 mine/cave, 2 wizard tower,
3 market/adoption, 4 temple, 5 forest, 6 ruin, 7 castle), `+44 index` (maze /
wizard number 0..5), `+48 x`, `+4C y` (map coords), `+50 visible`, `+54..+60`
(id/level ranges, unused at runtime — the maze `.dat` AREA lines are used),
`+64 file[64]` (maze file).

**Spell** (0x64): `+0 id`, `+4 name[64]`, `+44 float[8]` =
`damage, paralyze, poison, slow, accuracy, defense, offense, speed`.
damage > 0 → attack multiplier; damage < 0 → self buff (always hits).
effect > 0 → debuff on target (value only acts as a flag); effect < 0 → self buff.

**Pet** (0xC4): `+0 id`, `+4 name[64]`, `+44 bitmap[64]`, `+84 toughness`,
`+88 speed`, `+8C smarts`, `+90 float resist[7]` (paralyze, poison, slow, accuracy,
defense, offense, speed), `+AC int spells[5]`, `+C0 int level` (scratch field the
game writes before spawning an opponent).

## Pet instance (runtime, 0x78 bytes)
`+0 name[64]`, `+40 template*`, `+44 level`, `+48 xp`, `+4C hp`,
`+50 float status[7]` (same order as resist), `+6C spellsAvailable`,
`+70 poisonDamage`, `+74 sprite`.

* create (0x40f480): status = 0, xp = 0, hp = toughness × level,
  spellsAvailable = min(5, (level−1)/4 + 2) → 2 at L1, 3 at L5, 4 at L9, 5 at L13.
* addXp (0x40f540): xp += n; if xp ≥ 10·level² → level+1, hp = toughness × newLevel
  (full heal), recompute spellsAvailable. Only one level per call. XP is cumulative.
* Max HP = toughness × level.
* HP colour (0x40f5d0): 2·hp > max → green, 4·hp > max → yellow, else red.

## Globals
`0x827d88[6]` party, `0x827da4` current location, `0x827db0[6]` wizard defeated,
`0x827dc8` difficulty (0 easy, 1 normal, 2 hard), `0x827dcc` text speed,
`0x827dd0` gender, `0x827dd4` "has caught before" flag, `0x827dd8` item (key) list,
`0x4261c8` message delay = (15 − textSpeed) × 3 frames, `0x427ad0` battle result
(1 lost, 0 won, 2 retreated).

## New game (0x40f410, 0x40a278)
Party = one Fleenu (id 4) level 1 renamed "Mookie". Location = Home.
Visible locations: icon ∈ {home, temple, market} or index == 0 (Genwood, Earth Wizard).

## Combat (class at 0x4011b0; state machine 0x402390, states 0..10)
Constructor args: opponent template list, count, background, wild flag.
Wild (maze) battles: 1 opponent, background `forest-back.bmp` if location icon is
forest else `mine-back.bmp`. Tower battles: wizard team, `tower-back.bmp`, not wild.
Active player pet = left-most pet with hp > 0.

Buttons: 0 Retreat, 1 Change, 2 Catch, 3..8 party slots, 9..13 spells.
Rects (l,t,r,b): Catch (540,285,640,320), Change (540,320,640,345),
Retreat (540,345,640,370), spell 0 (20,200,200,225) then stacked +26 px,
player HP bar (20,80,220,95), enemy HP bar (420,80,620,95), message (0,340,640,370),
party slot 0 (6,375,110,480) then +105 px. Pet sprites at x 168 / 472, y 150.

### Round
1. Player picks spell s (button 9+s): slowToggle++, playerDone = enemyDone = 0.
2. Enemy picks `rand() % enemy.spellsAvailable`.
3. Player acts first iff `enemy.speed + enemy.status[speed] <= player.speed + player.status[speed]`.
4. Each action: `r = first i with status[i] < 0` (1-based, 0 = none).
   * r = 1 (paralyzed): "…is paralyzed and can't attack!", skip.
   * r = 2 (poisoned): hp −= min(hp, poisonDamage), "…loses %d points to poison!", then act.
   * r = 3 (slowed) and slowToggle odd: "…is too slow to attack this time!", skip.
   * Only the *first* negative status is considered (original quirk).
5. Announce: damage ≥ 0 → "%s uses %s on the %s!" / "The %s uses %s on %s!";
   damage < 0 → "%s uses %s!" / "The %s uses %s!".
6. Hit roll (`_ftol` truncates toward zero):
   `chance = trunc(att.smarts − att.status[accuracy] − def.smarts) + 10`
   (+3 on Easy and +3 if player pet level 1 — player attacks only).
   Hit iff `rand() % 20 < chance`, or spell damage < 0.
   NB: accuracy status sign is inverted vs. the other stats — a debuff *raises*
   the target's hit chance. Reproduced faithfully.
7. On hit, if spell damage ≥ 1:
   `dmg = trunc(trunc(att.level × spell.damage) + att.status[offense] − def.status[defense])`,
   clamp to [0, def.hp]. "…is not hurt!" / "…loses %d point(s)!".
   Miss → "%s misses!" / "The %s misses!".
8. Effects (only on hit), for i in 0..6:
   * effect > 0: roll `(rand()%100)·0.01`; if roll ≤ def.resist[i] → "resists being …";
     else def.status[i] −= 1, message "is paralyzed for %d more turns!" etc.
     (turns = ceil(−status/0.25) − 1). Poison sets `def.poisonDamage = att.level/4 + 1`.
     Slow resets slowToggle to 0.
   * effect < 0: att.status[i] −= effect (buff, silent).
9. End of round: every negative status += 0.25, clamp to 0. Positive buffs never decay.
10. "Catch" button appears in wild battles when enemy hp ≤ max/4 or hp ≤ 1 and the
    party has a free slot.

### Catch (button 2)
slowToggle++. First catch of the game always succeeds; afterwards `rand() % 4 == 0`.
Success: pet joins first empty slot with xp = 10·(level−1)², no XP is awarded.
Failure: "You didn't catch the %s!" and the enemy gets a free action.

### Faint / victory (0x403230)
Enemy fainted: xp = 10·L − 5 per kill (`(20L−10)/2`; on Hard `floor(2·(20L−10)/3)/2`),
"%s is now level %d!" when it levels, then "The %s retreats!", next opponent or
"You win this battle!". Player pet fainted: next healthy pet "%s is now battling the %s!",
else "You have lost!".

Change (button 1): "Choose another BattlePet!" then click a slot → "%s enters the battle!"
(no turn cost). Retreat (button 0): leave immediately.

## Mazes (`dat/*.dat`, parser 0x40c4a0, movement 0x40d340)
Lines: `ROW <50 chars>`, `EVENT <c>`, `MAINTEXT`, `NEEDTEXT`, `NEEDS`, `GIVES`,
`AREA <c> minPet maxPet minLvl maxLvl`, `ART <wall.bmp> <floor.bmp>`, `//` comments.
Cells: `0` floor, `1` wall, `2` exit (also start position), digit/letter = event or area marker.
AREA rectangle = x/y between the first and last occurrence of its letter in
row-major order. Last matching AREA wins.
Step counter: starts at `rand()%10 + 15`, decremented per step; on reaching < 1,
reset and spawn `pet = min + rand()%(max−min+1)`, `level = min==max ? min : min + rand()%(max−min)`
(max level exclusive — original quirk). The move that triggers a battle is undone.
Isometric: `sx = (x−y)·tileW/2 + ox`, `sy = (x+y)·tileH/2 + oy`; recentre when the
player leaves (128..512, 96..384).
Ambient loops by maze index: 0 forest, 1 drip, 2 wind, 3 drip?, 4 castle, 5 rain (jump table 0x40ce14).

## Map / wizards
Wizard k won → reveal locations with index k+1 (maze + wizard), mark defeated.
Vile Wizard (5) defeated → `win1.bmp`.

## Save file (`<name>.gam`, text)
`%d %d` current location map x y; 6× (`YES` + name line + `%d %d %d %d` id? level xp hp | `NO`);
visible flags `1 `/`0 ` per location; wizard defeated `%d ` ×6;
`difficulty textSpeed gender caughtBefore`; item names; `ITEMEND`.

## Presentation layer

* Frame loop: 33 ms ticks (GetTickCount, 0x409559). Fonts (0x4096c0): 0-3 Arial Bold
  14/16/24/32, 4 System 10, 5 fixedsys 10, 6/7 Arial 12/9, 8 Arial Bold 20.
* Blits: flag 0 = centred, 1 = top-left; black is the colour key. 0x411040 is a
  saturating additive blend ("translucency blitting") used for the map cloud,
  spell sprites and combat particles.
* Buttons (0x411e30): normal (180,180,230), hover (100,255,100); the last added
  button starts current; hover persists; Up/Down cycle; Enter/Space activate.
* Party boxes (0x40f630): slot i at (6+105i, 375); HP bar 5 px wide on the right,
  "Level: n" and name with black shadows, "Fainted!" in font 3.
* Screens and rects: main menu buttons y 280/310/340/370/410; options toggles
  cycle gender 0..1 (1 = male), difficulty 0..2, text speed 1..10; map hover
  label (255,255,55) at (x±70, y+20..40), "Defeated" red, cloud additive at y 40
  scrolling +1/frame; tower portrait (100,170), text (220,80,540,330), button
  "Battle!" -> "Leave Tower"; home/market text (100,80,540,330); temple text
  (100,80,540,300) with the page index kept between visits; event panel at (7,54),
  text (120,130,520,370); inspect columns BASICS (180,10) values +90, SPELLS
  (400,10), STATUS (100,200) values +120, RESISTANCE right-aligned to x 410.
* Maze: tiles 109x28 (half step 54x14), wall/floor bottoms at the floor line,
  markers bob by sin(frame%20 * pi/10)*5+40, minimap 2 px/cell at (4,4)
  (walls green, you blue, events red), walk 7 frames, mirrored sprites for the
  left-hand directions, gender 1 = walk/boy sprites, 0 = gwalk/girlf.
* Weather by maze index: 0 petals x1/frame, 1-2 drips every 5 frames, 3 snow x3,
  4 none, 5 rain x10. Ambient loops: forest, drip, drip, wind, castle, rain.
* Spell sounds: three 36-entry tables of 64-byte paths at 0x41f828 / 0x420128 /
  0x420a28 (cast / fly / impact), "X" = silent.
* Spell effects: see src/modes/combatFx.js (projectiles, two global emitters,
  15 flr-* sprites).
