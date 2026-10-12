import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ButtonList, NONE, HOVER_RGB, NORMAL_RGB } from '../src/engine/ui.js';
import { Mode, ModeStack } from '../src/engine/modeStack.js';
import { layoutLines, DT, fontSpec } from '../src/engine/text.js';

function list() {
  const b = new ButtonList();
  b.addText(0, 'A', [0, 0, 100, 20]);
  b.addText(1, 'B', [0, 20, 100, 40]);
  b.addText(2, 'C', [0, 40, 100, 60]);
  return b;
}

test('the last added button starts current and Enter activates it', () => {
  assert.equal(list().key(13), 2);
});

test('hover changes current; hover misses keep it (original behaviour)', () => {
  const b = list();
  assert.equal(b.hover(10, 25), 1);
  assert.equal(b.hover(500, 500), NONE);
  assert.equal(b.current.id, 1);
  assert.equal(b.click(10, 5), 0);
  assert.equal(b.click(500, 500), NONE);
});

test('up/down cycle with wrap-around', () => {
  const b = list();
  b.key(40);
  assert.equal(b.current.id, 0);
  b.key(38);
  assert.equal(b.current.id, 2);
});

test('editable buttons take typed characters, backspace and a length cap', () => {
  const b = new ButtonList();
  const name = b.addText(5, 'Mo', [0, 0, 10, 10], { editable: true, maxLength: 4 });
  b.type('o');
  b.type('k');
  b.type('X');
  assert.equal(name.label, 'Mook');
  b.type('\b');
  assert.equal(name.label, 'Moo');
});

test('remove, has, byId and setLabel', () => {
  const b = list();
  b.remove(2);
  assert.equal(b.has(2), false);
  assert.equal(b.current.id, 0);
  b.setLabel(1, 'Z');
  assert.equal(b.byId(1).label, 'Z');
});

test('draw uses hover colour for the current button only', () => {
  const calls = [];
  const gfx = { text: (font, label, rect, flags, rgb) => calls.push([label, rgb]), blit: () => {} };
  list().draw(gfx, 0);
  assert.deepEqual(calls, [['A', NORMAL_RGB], ['B', NORMAL_RGB], ['C', HOVER_RGB]]);
});

test('mode stack resumes the parent with the popped child', async () => {
  const stack = new ModeStack();
  const seen = [];
  class Parent extends Mode {
    resume(child) { seen.push(child); }
  }
  const parent = await stack.push(new Parent(null));
  const child = await stack.push(new Mode(null));
  assert.equal(stack.top, child);
  stack.pop();
  assert.equal(stack.top, parent);
  assert.deepEqual(seen, [child]);
});

test('text layout honours newlines, trailing newline and word wrap', () => {
  const ctx = { measureText: (s) => ({ width: s.length * 10 }) };
  assert.deepEqual(layoutLines(ctx, 'a\nb\n', 100, DT.WORDBREAK), ['a', 'b']);
  assert.deepEqual(layoutLines(ctx, 'one two three', 80, DT.WORDBREAK), ['one two', 'three']);
  assert.deepEqual(layoutLines(ctx, 'x\ny', 100, DT.SINGLELINE), ['x y']);
  assert.equal(fontSpec(2).lineHeight, 24);
});
