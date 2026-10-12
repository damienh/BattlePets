import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** Directory of the original install (parent of remake/). */
export const ORIGINAL_DIR = join(here, '..', '..');
export const EXE_PATH = join(ORIGINAL_DIR, 'BattlePets.exe');
export const hasOriginal = existsSync(EXE_PATH);

export function loadExe() {
  const buf = readFileSync(EXE_PATH);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export function loadText(relPath) {
  return readFileSync(join(ORIGINAL_DIR, relPath), 'latin1');
}
