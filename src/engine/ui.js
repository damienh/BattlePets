// Button list (0x411e30..0x4121b0). Text buttons and image ("MonsterBox") buttons;
// the most recently added button starts as the current one, hover persists after
// the mouse leaves, Up/Down cycle the current button and Enter/Space activate it.

import { DT } from './text.js';

export const NORMAL_RGB = [180, 180, 230];
export const HOVER_RGB = [100, 255, 100];
export const NONE = -2;
const BLINK_MS = 550;

const inRect = ([l, t, r, b], x, y) => x >= l && x < r && y >= t && y < b;

export class ButtonList {
  constructor() {
    this.buttons = [];
    this.current = null;
  }

  /** Text button; options: { font, editable, maxLength }. */
  addText(id, label, rect, { font = 2, editable = false, maxLength = 64 } = {}) {
    const button = { id, label, rect, font, editable, maxLength, image: null };
    this.buttons = [...this.buttons, button];
    this.current = button;
    return button;
  }

  /** Image button that shows `image` at its top-left only while current. */
  addImage(id, rect, image) {
    const button = { id, label: null, rect, font: 0, editable: false, maxLength: 0, image };
    this.buttons = [...this.buttons, button];
    this.current = button;
    return button;
  }

  remove(id) {
    const removed = this.buttons.find((b) => b.id === id);
    this.buttons = this.buttons.filter((b) => b.id !== id);
    if (this.current === removed) this.current = this.buttons[0] ?? null;
  }

  has(id) {
    return this.buttons.some((b) => b.id === id);
  }

  byId(id) {
    return this.buttons.find((b) => b.id === id) ?? null;
  }

  setLabel(id, label) {
    const button = this.byId(id);
    if (button) button.label = label;
  }

  /** Mouse move/click hit test; returns NONE when nothing is under the pointer. */
  hover(x, y) {
    const hit = this.buttons.find((b) => inRect(b.rect, x, y));
    if (!hit) return NONE;
    this.current = hit;
    return hit.id;
  }

  /** Mouse click: activates the button under the pointer. */
  click(x, y) {
    return this.hover(x, y) === NONE ? NONE : this.current.id;
  }

  step(delta) {
    if (this.buttons.length === 0) return;
    const index = this.buttons.indexOf(this.current);
    const next = (index + delta + this.buttons.length) % this.buttons.length;
    this.current = this.buttons[next];
  }

  /** Keyboard: returns the activated id, or NONE. */
  key(vk) {
    if (vk === 38) this.step(-1);
    else if (vk === 40) this.step(1);
    else if ((vk === 13 || vk === 32) && this.current) return this.current.id;
    return NONE;
  }

  /** WM_CHAR into the current editable button (0x411d50). */
  type(char) {
    const b = this.current;
    if (!b || !b.editable) return;
    if (char === '\b') b.label = b.label.slice(0, -1);
    else if (char !== '\r' && b.label.length < b.maxLength) b.label += char;
  }

  draw(gfx, now = performance.now()) {
    for (const b of this.buttons) {
      const isCurrent = b === this.current;
      if (b.image && isCurrent) gfx.blit(b.image, b.rect[0], b.rect[1], true);
      if (b.label !== null) {
        const rgb = isCurrent ? HOVER_RGB : NORMAL_RGB;
        if (b.editable) {
          const cursor = Math.floor(now / BLINK_MS) % 2 === 1 ? '_' : '';
          gfx.text(b.font, b.label + cursor, b.rect, DT.LEFT, rgb);
        } else {
          gfx.text(b.font, b.label, b.rect, DT.CENTER, rgb);
        }
      }
    }
  }
}
