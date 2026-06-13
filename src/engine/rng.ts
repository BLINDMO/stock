// Deterministic, seedable pseudo-random number generator.
// The whole world is reproducible from a single seed, yet no outcome is
// pre-ordained: the player's choices interact freely with the random walk.

export class RNG {
  private s: number;

  constructor(seed: number) {
    // Avoid a zero state.
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** mulberry32 — fast, good-enough statistical quality for a game. */
  next(): number {
    this.s |= 0;
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Standard normal via Box–Muller. */
  normal(mean = 0, std = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * std + mean;
  }

  /** Snapshot/restore so a saved world resumes the exact sequence. */
  get state(): number {
    return this.s >>> 0;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
}

/** Cheap string hash → 32-bit seed. */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
