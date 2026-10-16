import { drivers, getTrack, teams } from "@/data";
import { DT } from "@/engine";
import { describe, expect, it } from "vitest";
import { RaceRunner } from "./race-runner";

const make = () =>
  new RaceRunner({
    seed: 3,
    track: getTrack("monza"),
    teams,
    drivers,
    weather: "dry",
  });

describe("RaceRunner", () => {
  it("turns wall-clock time into engine steps at the chosen speed", () => {
    const runner = make();
    // Steps are 0.5 s: time accumulates until a whole step is due.
    expect(runner.advance(0.2)).toBe(0);
    expect(runner.advance(0.2)).toBe(0);
    expect(runner.advance(0.2)).toBe(1);
    expect(runner.race.time).toBe(DT);
  });

  it("speeds up and pauses", () => {
    const runner = make();
    runner.speed = 16;
    expect(runner.advance(0.25)).toBe(Math.floor((0.25 * 16) / DT));
    runner.paused = true;
    expect(runner.advance(0.25)).toBe(0);
  });

  it("caps catch-up after a long frame", () => {
    const runner = make();
    runner.speed = 4;
    expect(runner.advance(10)).toBe(Math.floor((0.25 * 4) / DT));
  });

  it("interpolates positions smoothly, including across the line", () => {
    const runner = make();
    runner.speed = 16;
    const leader = () => runner.race.cars[runner.race.order[0]];
    const index = leader().index;
    let last = runner.renderDistance(index);
    let lapsSeen = 0;
    for (let i = 0; i < 2000 && lapsSeen < 2; i++) {
      const lap = runner.race.cars[index].lap;
      runner.advance(1 / 60);
      if (runner.race.cars[index].lap > lap) lapsSeen++;
      const now =
        runner.renderDistance(index) +
        runner.race.cars[index].lap * runner.race.lapLength;
      const before = last + lap * runner.race.lapLength;
      // Never jumps backwards and never leaps more than a couple of steps' travel.
      expect(now).toBeGreaterThanOrEqual(before - 1);
      expect(now - before).toBeLessThan(200);
      last = runner.renderDistance(index);
    }
    expect(lapsSeen).toBe(2);
  });
});
