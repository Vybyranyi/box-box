/**
 * Seeded pseudo-random number generator (mulberry32).
 * The engine must use this instead of Math.random so races are reproducible.
 */
export type Rng = {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Normally distributed value (Box-Muller). */
  normal(mean?: number, stdDev?: number): number;
  /** True with the given probability. */
  chance(probability: number): boolean;
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    normal: (mean = 0, stdDev = 1) => {
      const u = 1 - next();
      const v = next();
      return (
        mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      );
    },
    chance: (probability) => next() < probability,
  };
}
