// Game mode stack (the original's "No game mode on stack" machinery). The top mode
// receives input, update() and draw() every frame; when a child is popped its parent
// gets resume(child) - the original's vtable slot 6.

export class Mode {
  constructor(app) {
    this.app = app;
  }

  /** Preload assets; called before the mode is shown. */
  async load() {}

  resume(_child) {}

  update() {}

  draw(_gfx) {}

  handle(_event) {}
}

export class ModeStack {
  constructor() {
    this.modes = [];
    this.pending = null;
  }

  get top() {
    return this.modes[this.modes.length - 1] ?? null;
  }

  async push(mode) {
    this.pending = mode;
    await mode.load();
    this.modes = [...this.modes, mode];
    this.pending = null;
    return mode;
  }

  pop() {
    const child = this.top;
    this.modes = this.modes.slice(0, -1);
    if (this.top) this.top.resume(child);
    return child;
  }

  /** Pop every mode above (and excluding) the first one matching the predicate. */
  popTo(predicate) {
    while (this.top && !predicate(this.top)) this.modes = this.modes.slice(0, -1);
    if (this.top) this.top.resume(null);
  }

  get busy() {
    return this.pending !== null;
  }
}
