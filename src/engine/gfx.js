// Drawing primitives matching DrawLib (0x410xxx/0x411xxx): colour-keyed and opaque
// blits (centred unless topLeft), additive "translucency" blits, filled rects,
// tiled backgrounds and single-pixel particles.

import { drawText as gdiDrawText } from './text.js';

export const WIDTH = 640;
export const HEIGHT = 480;

export class Gfx {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(rgb = [0, 0, 0]) {
    this.fillRect([0, 0, WIDTH, HEIGHT], rgb);
  }

  fillRect([l, t, r, b], [red, green, blue]) {
    this.ctx.fillStyle = `rgb(${red},${green},${blue})`;
    this.ctx.fillRect(l, t, r - l, b - t);
  }

  #origin(spr, x, y, topLeft) {
    return topLeft ? [x, y] : [x - (spr.width >> 1), y - (spr.height >> 1)];
  }

  /** Colour-keyed blit (0x411770). */
  blit(spr, x, y, topLeft = false) {
    if (!spr) return;
    const [ox, oy] = this.#origin(spr, x, y, topLeft);
    this.ctx.drawImage(spr.keyed, ox, oy);
  }

  /** Opaque blit (0x411730). */
  blitOpaque(spr, x, y, topLeft = true) {
    if (!spr) return;
    const [ox, oy] = this.#origin(spr, x, y, topLeft);
    this.ctx.drawImage(spr.opaque, ox, oy);
  }

  /** Saturating additive blend, black skipped (0x411040). */
  blitAdditive(spr, x, y, topLeft = true) {
    if (!spr) return;
    const [ox, oy] = this.#origin(spr, x, y, topLeft);
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(spr.keyed, ox, oy);
    this.ctx.restore();
  }

  /** Fill the whole screen with a bitmap, as each mode's background loop does. */
  tile(spr) {
    if (!spr) return;
    for (let y = 0; y < HEIGHT; y += spr.height) {
      for (let x = 0; x < WIDTH; x += spr.width) this.ctx.drawImage(spr.opaque, x, y);
    }
  }

  pixel(x, y, [r, g, b], additive = false) {
    this.ctx.save();
    if (additive) this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.fillStyle = `rgb(${r},${g},${b})`;
    this.ctx.fillRect(Math.trunc(x), Math.trunc(y), 1, 1);
    this.ctx.restore();
  }

  text(font, text, rect, flags, rgb) {
    gdiDrawText(this.ctx, font, text, rect, flags, rgb);
  }

  /** Text with the 1px dark shadow used for labels. */
  shadowText(font, text, [l, t, r, b], flags, rgb, shadow = [0, 0, 0]) {
    gdiDrawText(this.ctx, font, text, [l + 1, t + 1, r + 1, b + 1], flags, shadow);
    gdiDrawText(this.ctx, font, text, [l, t, r, b], flags, rgb);
  }

  /** Copy of the current frame (used as the event screen's backdrop). */
  snapshot() {
    const c = document.createElement('canvas');
    c.width = WIDTH;
    c.height = HEIGHT;
    c.getContext('2d').drawImage(this.canvas, 0, 0);
    return { opaque: c, keyed: c, width: WIDTH, height: HEIGHT };
  }
}
