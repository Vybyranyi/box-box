import { describe, expect, it } from "vitest";
import type { Point } from "../../src/data/types";
import {
  closedLength,
  openRing,
  resampleClosed,
  scaleToLength,
  signedArea,
  smoothClosed,
} from "./geometry";

const square: Point[] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

describe("geometry", () => {
  it("measures a closed polyline", () => {
    expect(closedLength(square)).toBeCloseTo(400);
  });

  it("drops a repeated closing point", () => {
    expect(openRing([...square, [0, 0]])).toHaveLength(4);
    expect(openRing(square)).toHaveLength(4);
  });

  it("resamples to evenly spaced points", () => {
    const points = resampleClosed(square, 40);
    expect(points).toHaveLength(40);
    expect(points[1][0]).toBeCloseTo(10);
    expect(points[10]).toEqual([100, 0]);
  });

  it("rounds corners without changing straights", () => {
    const smooth = smoothClosed(square, 5, 5, 1);
    expect(smooth).toHaveLength(80);
    // Middle of the bottom straight is untouched, the corner is pulled inwards.
    expect(smooth[10][0]).toBeCloseTo(50);
    expect(smooth[10][1]).toBeCloseTo(0);
    expect(smooth[0][0]).toBeGreaterThan(0);
    expect(smooth[0][1]).toBeGreaterThan(0);
  });

  it("tells anticlockwise from clockwise", () => {
    expect(signedArea(square)).toBeCloseTo(10_000);
    expect(signedArea([...square].reverse())).toBeCloseTo(-10_000);
  });

  it("scales to a target length", () => {
    expect(closedLength(scaleToLength(square, 1000))).toBeCloseTo(1000);
  });
});
