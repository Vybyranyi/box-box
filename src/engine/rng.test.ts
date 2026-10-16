import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("has a roughly correct normal distribution", () => {
    const rng = createRng(123);
    const n = 20_000;
    const samples = Array.from({ length: n }, () => rng.normal(10, 2));
    const mean = samples.reduce((s, x) => s + x, 0) / n;
    const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    expect(mean).toBeCloseTo(10, 1);
    expect(Math.sqrt(variance)).toBeCloseTo(2, 1);
  });
});
