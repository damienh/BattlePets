// DirectSound-style playback: one buffer per wave file, replaying restarts it.

import { loadBinary, normalisePath } from './assets.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.playing = new Map();
    this.muted = false;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async #buffer(path) {
    const key = normalisePath(path).toLowerCase();
    if (!this.buffers.has(key)) {
      const pending = loadBinary(path)
        .then((data) => this.ctx.decodeAudioData(data))
        .catch((error) => {
          this.buffers.delete(key);
          throw error;
        });
      this.buffers.set(key, pending);
    }
    return this.buffers.get(key);
  }

  stop(path) {
    const key = normalisePath(path).toLowerCase();
    const source = this.playing.get(key);
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
      this.playing.delete(key);
    }
  }

  /** Play a wave file; returns a promise that resolves once playback has started. */
  async play(path, { loop = false } = {}) {
    if (!this.ctx || this.muted || !path) return;
    try {
      const buffer = await this.#buffer(path);
      this.stop(path);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(this.ctx.destination);
      const key = normalisePath(path).toLowerCase();
      source.onended = () => {
        if (this.playing.get(key) === source) this.playing.delete(key);
      };
      this.playing.set(key, source);
      source.start();
    } catch (error) {
      // A missing or undecodable sound must never stop the game.
      console.warn(`Sound unavailable: ${path}`, error);
    }
  }
}
