// Loads original assets over HTTP from the original install (served at ORIGINAL_ROOT).
// Bitmaps become canvases; pure black is the DirectDraw colour key (transparent).

export const ORIGINAL_ROOT = 'original/';

/** "dat\\FOO.bmp" / "dat\\\\foo.bmp" -> "dat/FOO.bmp" */
export const normalisePath = (p) => p.replace(/\\+/g, '/');

async function fetchOk(path) {
  const res = await fetch(ORIGINAL_ROOT + normalisePath(path));
  if (!res.ok) throw new Error(`Missing original file: ${normalisePath(path)} (HTTP ${res.status})`);
  return res;
}

export async function loadBinary(path) {
  return (await fetchOk(path)).arrayBuffer();
}

export async function loadText(path) {
  const buf = await loadBinary(path);
  return new TextDecoder('latin1').decode(buf);
}

function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  return new Promise((resolveImg, reject) => {
    const img = new Image();
    img.onload = () => resolveImg(img);
    img.onerror = () => reject(new Error('Bitmap could not be decoded'));
    img.src = URL.createObjectURL(blob);
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Returns { opaque, keyed, width, height }: keyed has black made transparent. */
function sprite(source) {
  const { width, height } = source;
  const opaque = makeCanvas(width, height);
  opaque.getContext('2d').drawImage(source, 0, 0);
  const keyed = makeCanvas(width, height);
  const kctx = keyed.getContext('2d');
  const pixels = opaque.getContext('2d').getImageData(0, 0, width, height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) d[i + 3] = 0;
  }
  kctx.putImageData(pixels, 0, 0);
  return { opaque, keyed, width, height };
}

/** Horizontally mirrored copy (0x4117e0). */
export function mirrored(spr) {
  const flip = (src) => {
    const c = makeCanvas(spr.width, spr.height);
    const ctx = c.getContext('2d');
    ctx.translate(spr.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  };
  return { ...spr, opaque: flip(spr.opaque), keyed: flip(spr.keyed) };
}

export class AssetCache {
  constructor() {
    this.images = new Map();
  }

  async image(path) {
    const key = normalisePath(path).toLowerCase();
    if (!this.images.has(key)) {
      const pending = fetchOk(path).then((r) => r.blob()).then(decodeImage).then(sprite);
      this.images.set(key, pending);
    }
    return this.images.get(key);
  }

  async imageList(paths) {
    return Promise.all(paths.map((p) => this.image(p)));
  }
}
