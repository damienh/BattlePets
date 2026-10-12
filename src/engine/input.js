// Translates browser input into the Windows messages the original handled:
// mouse move/down/up (screen coords), WM_KEYDOWN virtual-key codes and WM_CHAR.

export const VK = Object.freeze({
  BACK: 8, RETURN: 13, ESCAPE: 27, SPACE: 32,
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
  NUMPAD1: 97, NUMPAD3: 99, NUMPAD7: 103, NUMPAD9: 105,
});

const CODE_TO_VK = {
  Enter: VK.RETURN, NumpadEnter: VK.RETURN, Escape: VK.ESCAPE, Space: VK.SPACE, Backspace: VK.BACK,
  ArrowLeft: VK.LEFT, ArrowUp: VK.UP, ArrowRight: VK.RIGHT, ArrowDown: VK.DOWN,
  Numpad1: VK.NUMPAD1, Numpad3: VK.NUMPAD3, Numpad7: VK.NUMPAD7, Numpad9: VK.NUMPAD9,
};

export class Input {
  constructor(canvas, width, height) {
    this.queue = [];
    this.mouse = { x: 0, y: 0, left: false, right: false };
    const toScreen = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.floor(((e.clientX - r.left) * width) / r.width),
        y: Math.floor(((e.clientY - r.top) * height) / r.height),
      };
    };
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousemove', (e) => {
      const p = toScreen(e);
      this.mouse = { ...this.mouse, ...p };
      this.queue.push({ type: 'mousemove', ...p });
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = toScreen(e);
      const button = e.button === 2 ? 'right' : 'left';
      this.mouse = { ...this.mouse, ...p, [button]: true };
      this.queue.push({ type: 'mousedown', button, ...p });
    });
    window.addEventListener('mouseup', (e) => {
      const button = e.button === 2 ? 'right' : 'left';
      this.mouse = { ...this.mouse, [button]: false };
      this.queue.push({ type: 'mouseup', button, x: this.mouse.x, y: this.mouse.y });
    });
    window.addEventListener('keydown', (e) => {
      const vk = CODE_TO_VK[e.code];
      if (vk !== undefined) {
        e.preventDefault();
        this.queue.push({ type: 'keydown', vk });
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        this.queue.push({ type: 'char', char: e.key });
      } else if (e.key === 'Backspace') {
        this.queue.push({ type: 'char', char: '\b' });
      }
    });
  }

  drain() {
    const events = this.queue;
    this.queue = [];
    return events;
  }
}
