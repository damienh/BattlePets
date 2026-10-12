// Isometric maze rendering (0x40d830) and the minimap (0x40e110).

import { cellAt } from '../game/maze.js';

export const TILE_W = 109;
export const TILE_H = 28;
const HALF_W = Math.trunc(TILE_W / 2);
const SCREEN_CENTER = [320, 240];
const KEEP_IN_VIEW = { left: 128, right: 512, top: 96, bottom: 384 };
const WALK_FRAMES = 7;

/** Screen position (bottom-centre of the floor diamond) of a cell. */
export function cellToScreen(origin, x, y) {
  return [(x - y) * HALF_W + origin.x, Math.trunc(((x + y) * TILE_H) / 2) + origin.y];
}

/** Origin that puts cell (x, y) at the screen centre. */
export function centredOrigin(x, y) {
  return {
    x: (y - x) * HALF_W + SCREEN_CENTER[0],
    y: SCREEN_CENTER[1] - Math.trunc(((x + y) * TILE_H) / 2),
  };
}

export function needsRecentre(origin, x, y) {
  const [sx, sy] = cellToScreen(origin, x, y);
  return sx > KEEP_IN_VIEW.right || sx < KEEP_IN_VIEW.left || sy > KEEP_IN_VIEW.bottom || sy < KEEP_IN_VIEW.top;
}

/** Cell under a screen point, using the original's float maths (0x40d076). */
export function screenToCell(origin, mx, my) {
  const halfW = TILE_W * 0.5;
  const halfH = TILE_H * 0.5;
  const cx = Math.trunc(((((my - origin.y) / halfH + 1) * halfW + mx - origin.x) * 0.5) / halfW);
  const cy = Math.trunc((my - origin.y) / halfH - cx + 1);
  return { x: cx, y: cy };
}

/** Mouse direction 0..3 toward a cell, or null on a tie (0x40d0df). */
export function directionTo(player, cell) {
  const dx = cell.x - player.x;
  const dy = cell.y - player.y;
  if (Math.abs(dx) < Math.abs(dy)) return dy < 0 ? 0 : 3;
  if (Math.abs(dx) === Math.abs(dy)) return null;
  return dx < 0 ? 1 : 2;
}

const MINIMAP_RGB = {
  player: [0, 0, 255], floor: [40, 40, 40], wall: [0, 255, 0], area: [40, 40, 40], special: [255, 0, 0],
};

function minimapColour(maze, x, y, pos) {
  if (x === pos.x && y === pos.y) return MINIMAP_RGB.player;
  const c = cellAt(maze, x, y);
  if (c === '0') return MINIMAP_RGB.floor;
  if (c === '1') return MINIMAP_RGB.wall;
  if (c >= 'a') return MINIMAP_RGB.area;
  return MINIMAP_RGB.special;
}

/** 2 px per cell, drawn opaque at (4, 4). */
export function renderMinimap(maze, pos) {
  const canvas = document.createElement('canvas');
  canvas.width = maze.width * 2;
  canvas.height = maze.height * 2;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);
  for (let py = 0; py < canvas.height - 1; py += 1) {
    for (let px = 0; px < canvas.width - 1; px += 1) {
      const [r, g, b] = minimapColour(maze, px >> 1, py >> 1, pos);
      const o = (py * canvas.width + px) * 4;
      image.data.set([r, g, b, 255], o);
    }
  }
  ctx.putImageData(image, 0, 0);
  return { opaque: canvas, keyed: canvas, width: canvas.width, height: canvas.height };
}

function bob(frame) {
  return Math.sin((frame % 20) * Math.fround(3.1415297985076904) * 0.1) * 5 + 40;
}

function drawPlayer(gfx, view, sprites, floorH) {
  const { walk, origin } = view;
  const frames = sprites.walk[walk.dir];
  if (!walk.active) {
    const [sx, sy] = cellToScreen(origin, view.pos.x, view.pos.y);
    const spr = frames[0];
    gfx.blit(spr, sx, sy - (floorH >> 1) - (spr.height >> 1));
    return;
  }
  const t = walk.frame / WALK_FRAMES;
  const spr = frames[walk.frame] ?? frames[0];
  const [px, py] = cellToScreen(origin, view.prev.x, view.prev.y);
  const [cx, cy] = cellToScreen(origin, view.pos.x, view.pos.y);
  const lift = (floorH >> 1) + (spr.height >> 1);
  gfx.blit(spr, Math.trunc((1 - t) * px + t * cx), Math.trunc((1 - t) * (py - lift) + t * (cy - lift)));
}

function drawMarker(gfx, sprites, cell, sx, sy, frame) {
  const floorH = sprites.floor.height;
  const pointH = sprites.point.height;
  const y = Math.trunc(sy - (pointH >> 1) - (floorH >> 1) - bob(frame));
  gfx.blit(cell === '2' ? sprites.ladder : sprites.point, sx, y);
  gfx.blit(sprites.pointFloor, sx, sy - (floorH >> 1));
}

/**
 * @param view { maze, origin, pos, prev, walk:{active,frame,dir}, frame, cursor:{x,y,dir} }
 */
export function drawMaze(gfx, view, sprites) {
  const { maze, origin } = view;
  const floorH = sprites.floor.height;
  const playerCell = view.walk.active ? view.prev : view.pos;
  gfx.clear();
  for (let y = 0; y < maze.height; y += 1) {
    for (let x = 0; x < maze.width; x += 1) {
      const cell = cellAt(maze, x, y);
      const [sx, sy] = cellToScreen(origin, x, y);
      const tile = cell === '1' ? sprites.wall : sprites.floor;
      gfx.blit(tile, sx, sy - (tile.height >> 1));
      if (cell !== '0' && cell !== '1' && cell < 'a') drawMarker(gfx, sprites, cell, sx, sy, view.frame);
      if (x === playerCell.x && y === playerCell.y) drawPlayer(gfx, view, sprites, floorH);
    }
  }
  const { cursor } = view;
  const [ax, ay] = cellToScreen(origin, cursor.x, cursor.y);
  const marker = cursor.dir === null ? sprites.cursor : sprites.arrows[cursor.dir];
  gfx.blit(marker, ax, ay - (floorH >> 1));
}
