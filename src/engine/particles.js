// "Super-fast particle system" (0x40faf0..0x41022d): a ring buffer of single-pixel
// particles. Each frame a particle moves by (sin a, -cos a) * speed, runs its
// callback, ages, and is plotted if still alive and inside the clip rect.

export const PI = Math.fround(3.1415297985076904); // the original's slightly-off constant

const toByte = (v) => v & 0xff;

export class ParticleSystem {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.particles = Array.from({ length: capacity }, () => null);
    this.next = 0;
  }

  /** Add a particle; an occupied slot is skipped (the original does not overwrite). */
  spawn(p) {
    if (!this.particles[this.next]) this.particles[this.next] = { ...p };
    this.next = (this.next + 1) % this.capacity;
  }

  clear() {
    this.particles = this.particles.map(() => null);
  }

  /** Update and draw; additive matches 0x40fe20, otherwise 0x40fc40. */
  step(gfx, { clip = [0, 0, 640, 480], additive = false } = {}) {
    const [l, t, r, b] = clip;
    for (let i = 0; i < this.capacity; i += 1) {
      const p = this.particles[i];
      if (p) {
        p.x = Math.fround(p.x + Math.sin(p.angle) * p.speed);
        p.y = Math.fround(p.y - Math.cos(p.angle) * p.speed);
        p.callback(p);
        p.life -= 1;
        if (p.life < 1) this.particles[i] = null;
        else if (p.x >= l && p.x < r && p.y >= t && p.y < b) gfx.pixel(p.x, p.y, p.rgb, additive);
      }
    }
  }
}

/**
 * Emitter (64-byte struct at e.g. 0x422900). Ranges are [min, max).
 * @param {{ rgbMin:number[], rgbMax:number[], x:number[], y:number[], angle:number[],
 *           speed:number[], life:number[], callback?:(p)=>void }} config
 */
export function emit(system, config, rand) {
  const between = (min, max) => (max - min === 0 ? min : min + (rand() % (max - min)));
  const rgb = config.rgbMin.map((min, i) => toByte(between(min, config.rgbMax[i])));
  const x = between(config.x[0], config.x[1]);
  const y = between(config.y[0], config.y[1]);
  const fraction = ([min, max]) => {
    const span = Math.fround(max - min);
    if (span === 0) return min;
    return Math.fround((rand() % Math.trunc(span * 100)) * 0.01 + min);
  };
  const angle = fraction(config.angle);
  const speed = fraction(config.speed);
  const life = between(config.life[0], config.life[1]);
  system.spawn({ rgb, x, y, angle, speed, life, callback: config.callback ?? (() => {}) });
}
