// GDI DrawText emulation for the original's nine fonts (0x4096c0).

export const DT = Object.freeze({ LEFT: 0, CENTER: 1, RIGHT: 2, VCENTER: 4, WORDBREAK: 0x10, SINGLELINE: 0x20 });

// [face, cell height in px, bold]; GDI positive lfHeight is the cell height.
const FONTS = [
  ['Arial', 14, true],
  ['Arial', 16, true],
  ['Arial', 24, true],
  ['Arial', 32, true],
  ['monospace', 10, false],
  ['monospace', 10, false],
  ['Arial', 12, false],
  ['Arial', 9, false],
  ['Arial', 20, true],
];
const ARIAL_CELL_TO_EM = 1.15;

export function fontSpec(index) {
  const [face, cell, bold] = FONTS[index] ?? FONTS[0];
  const em = Math.round(cell / ARIAL_CELL_TO_EM);
  return { css: `${bold ? 'bold ' : ''}${em}px ${face}, Helvetica, sans-serif`, lineHeight: cell };
}

function wrapParagraph(ctx, paragraph, width) {
  const words = paragraph.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (line !== '' && ctx.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

export function layoutLines(ctx, text, width, flags) {
  if (flags & DT.SINGLELINE) return [text.replace(/\n/g, ' ')];
  const paragraphs = text.split('\n');
  // A trailing newline (as in "%d\n%d\n") does not add a visible line.
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1] === '') paragraphs.pop();
  if (!(flags & DT.WORDBREAK)) return paragraphs;
  return paragraphs.flatMap((p) => wrapParagraph(ctx, p, width));
}

/**
 * Draw text in rect [l, t, r, b] with DrawText flags, colour [r, g, b].
 */
export function drawText(ctx, fontIndex, text, rect, flags, rgb) {
  const [l, t, r, b] = rect;
  const { css, lineHeight } = fontSpec(fontIndex);
  ctx.save();
  ctx.font = css;
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.textBaseline = 'top';
  const lines = layoutLines(ctx, text, r - l, flags);
  let y = t;
  if (flags & DT.VCENTER && flags & DT.SINGLELINE) y = t + Math.floor((b - t - lineHeight) / 2);
  ctx.beginPath();
  ctx.rect(l, t, r - l, b - t);
  ctx.clip();
  for (const line of lines) {
    let x = l;
    if (flags & DT.CENTER) {
      ctx.textAlign = 'center';
      x = (l + r) / 2;
    } else if (flags & DT.RIGHT) {
      ctx.textAlign = 'right';
      x = r;
    } else {
      ctx.textAlign = 'left';
    }
    ctx.fillText(line, x, y + 1);
    y += lineHeight;
  }
  ctx.restore();
}
