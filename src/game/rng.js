// MSVC C runtime rand(): holdrand = holdrand * 214013 + 2531011; (holdrand >> 16) & 0x7fff.
// Pure: callers thread the seed through their own state.

/** @returns {{ value: number, seed: number }} */
export function rand(seed) {
  const next = (Math.imul(seed | 0, 214013) + 2531011) | 0;
  return { value: (next >> 16) & 0x7fff, seed: next };
}

/** x87 float -> int conversion as done by MSVC _ftol (truncate toward zero). */
export function ftol(x) {
  return Math.trunc(x) | 0;
}

/** Seed from wall-clock time, as srand(time(NULL)) did. */
export function timeSeed() {
  return Math.floor(Date.now() / 1000) | 0;
}
