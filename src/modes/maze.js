// MAZE MODE (0x40bf30; per-frame 0x40dfd0; input 0x40ce50; resume 0x40cd50).

import { Mode } from '../engine/modeStack.js';
import { ButtonList, NORMAL_RGB } from '../engine/ui.js';
import { DT } from '../engine/text.js';
import { VK } from '../engine/input.js';
import { mirrored, loadText } from '../engine/assets.js';
import { ParticleSystem, emit } from '../engine/particles.js';
import { parseMaze, startRun, tryMove, stepBack } from '../game/maze.js';
import { LOCATION_ICON } from '../game/gameState.js';
import { RESULT } from '../game/battle.js';
import {
  drawMaze, renderMinimap, centredOrigin, needsRecentre, screenToCell, directionTo,
} from './mazeView.js';
import { weatherFor } from './weather.js';
import { CombatMode } from './combat.js';
import { EventMode } from './event.js';
import { InspectMode } from './inspect.js';

const AMBIENT = ['dat/forestlp.wav', 'dat/driploop.wav', 'dat/driploop.wav', 'dat/windloop.wav', 'dat/castlelp.wav', 'dat/rainloop.wav'];
const WALK_FRAMES = 7;
// Keyboard and mouse directions -> [dx, dy, walk sprite set].
const KEY_MOVES = {
  [VK.LEFT]: [0, 1, 1], [VK.NUMPAD1]: [0, 1, 1],
  [VK.UP]: [-1, 0, 2], [VK.NUMPAD7]: [-1, 0, 2],
  [VK.RIGHT]: [0, -1, 0], [VK.NUMPAD9]: [0, -1, 0],
  [VK.DOWN]: [1, 0, 3], [VK.NUMPAD3]: [1, 0, 3],
};
const MOUSE_MOVES = [[0, -1, 0], [-1, 0, 2], [1, 0, 3], [0, 1, 1]];
const WALK_SETS = {
  male: ['dat/walk00', 'dat/boy00'],
  female: ['dat/gwalk00', 'dat/girlf'],
};

function walkPaths(gender) {
  const [away, toward] = gender === 1 ? WALK_SETS.male : WALK_SETS.female;
  const range = (prefix, start) => Array.from({ length: 7 }, (_, i) => `${prefix}${i + start}.bmp`);
  return gender === 1 ? [range(away, 0), range(toward, 0)] : [range(away, 1), range(toward, 1)];
}

export class MazeMode extends Mode {
  constructor(app, { location }) {
    super(app);
    this.location = location;
  }

  async load() {
    const { assets } = this.app;
    this.maze = parseMaze(await loadText(this.location.file));
    const [wall, floor, point, ladder, cursor, pointFloor, ...arrows] = await assets.imageList([
      this.maze.art.wall, this.maze.art.floor, 'dat/maze-point.bmp', 'dat/maze-ladder.bmp',
      'dat/maze02.bmp', 'dat/maze-point2.bmp',
      'dat/arrow-RU.bmp', 'dat/arrow-LU.bmp', 'dat/arrow-RD.bmp', 'dat/arrow-LD.bmp',
    ]);
    const [awayPaths, towardPaths] = walkPaths(this.app.state.gender);
    const away = await assets.imageList(awayPaths);
    const toward = await assets.imageList(towardPaths);
    // Directions: 0 up-right, 1 down-left, 2 up-left (mirrored), 3 down-right (mirrored).
    const walk = [away, toward, away.map(mirrored), toward.map(mirrored)];
    this.sprites = { wall, floor, point, ladder, cursor, pointFloor, arrows, walk };
    this.run = startRun(this.maze, this.app.takeSeed());
    this.app.putSeed(this.run.seed);
    this.origin = centredOrigin(this.run.pos.x, this.run.pos.y);
    this.walk = { active: false, frame: 0, dir: 0 };
    this.cursor = { x: 2, y: 2, dir: 0 };
    this.frameCount = 0;
    this.held = false;
    this.drag = null;
    this.minimap = renderMinimap(this.maze, this.run.pos);
    this.particles = new ParticleSystem(1000);
    this.weather = weatherFor(this.location.index, () => this.app.rand());
    this.buttons = new ButtonList();
    this.buttons.addImage(1, [0, 393, 104, 480], this.app.images.monsterButton);
    this.app.audio.play(AMBIENT[this.location.index], { loop: true });
  }

  leave() {
    this.app.audio.stop(AMBIENT[this.location.index]);
    this.app.modes.pop();
  }

  resume(child) {
    this.held = false;
    this.drag = null;
    if (child instanceof EventMode && child.blocked) {
      this.run = stepBack(this.run);
      this.walk = { ...this.walk, active: false };
    }
    if (child instanceof CombatMode && child.result === RESULT.LOST) {
      this.leave();
      return;
    }
    if (child instanceof CombatMode) this.app.audio.play(AMBIENT[this.location.index], { loop: true });
    this.minimap = renderMinimap(this.maze, this.run.pos);
  }

  move([dx, dy, dir]) {
    if (this.walk.active) return;
    const result = tryMove(this.maze, { ...this.run, seed: this.app.takeSeed() }, dx, dy);
    this.app.putSeed(result.run.seed);
    if (result.kind === 'blocked') return;
    // The view recentres on the target cell even if a battle then cancels the step.
    const target = { x: this.run.pos.x + dx, y: this.run.pos.y + dy };
    if (needsRecentre(this.origin, target.x, target.y)) {
      this.origin = centredOrigin(target.x, target.y);
      this.cursor = { ...this.cursor, ...target };
    }
    this.run = result.run;
    if (result.kind === 'battle') {
      this.startBattle(result.encounter);
      return;
    }
    this.walk = { active: true, frame: 0, dir };
    if (result.kind === 'exit') this.leave();
    else if (result.kind === 'event') {
      this.drawFrame(this.app.gfx);
      this.app.modes.push(new EventMode(this.app, { event: result.event, backdrop: this.app.gfx.snapshot() }));
    }
  }

  startBattle(encounter) {
    this.app.audio.stop(AMBIENT[this.location.index]);
    const background = this.location.icon === LOCATION_ICON.FOREST ? 'dat/forest-back.bmp' : 'dat/mine-back.bmp';
    this.app.modes.push(new CombatMode(this.app, { opponents: [encounter], wild: true, background }));
  }

  pointAt(x, y) {
    if (this.drag) {
      this.origin = { x: this.drag.origin.x + x - this.drag.x, y: this.drag.origin.y + y - this.drag.y };
      return;
    }
    const cell = screenToCell(this.origin, x, y);
    const dir = directionTo(this.run.pos, cell);
    this.cursor = { x: cell.x, y: cell.y, dir: dir ?? this.cursor.dir };
  }

  handle(e) {
    if (e.type === 'keydown') {
      if (e.vk === VK.RETURN && this.buttons.key(e.vk) === 1) {
        this.app.sound('click');
        this.app.modes.push(new InspectMode(this.app, { slot: 0 }));
      } else if (KEY_MOVES[e.vk]) this.move(KEY_MOVES[e.vk]);
    } else if (e.type === 'mousemove') {
      this.pointAt(e.x, e.y);
    } else if (e.type === 'mousedown' && e.button === 'left') {
      this.held = true;
      this.move(MOUSE_MOVES[this.cursor.dir]);
    } else if (e.type === 'mousedown' && e.button === 'right') {
      this.drag = { x: e.x, y: e.y, origin: this.origin };
      this.pointAt(e.x, e.y);
    } else if (e.type === 'mouseup') {
      if (e.button === 'left') this.held = false;
      else this.drag = null;
    }
  }

  update() {
    this.frameCount += 1;
    if (this.walk.active) {
      const frame = this.walk.frame + 1;
      this.walk = frame >= WALK_FRAMES ? { ...this.walk, active: false, frame: 0 } : { ...this.walk, frame };
      if (!this.walk.active) this.minimap = renderMinimap(this.maze, this.run.pos);
    }
    if (this.held && !this.walk.active && this.app.modes.top === this) this.move(MOUSE_MOVES[this.cursor.dir]);
    this.weather.tick(this.particles, this.frameCount);
  }

  drawFrame(gfx) {
    drawMaze(gfx, {
      maze: this.maze, origin: this.origin, pos: this.run.pos, prev: this.run.prev,
      walk: this.walk, frame: this.frameCount, cursor: this.cursor,
    }, this.sprites);
    gfx.text(8, 'Hit RETURN to view your BattlePets', [150, 3, 640, 40], DT.CENTER, NORMAL_RGB);
    gfx.blitOpaque(this.minimap, 4, 4);
    this.particles.step(gfx);
  }

  draw(gfx) {
    this.drawFrame(gfx);
  }
}
