import { drivers, teams, tracks } from "@/data";
import { describe, expect, it } from "vitest";
import { createRace } from "./race";
import type { ClassifiedResult } from "./types";

/**
 * Plausibility over many races: not exact numbers, but the shape of a real season.
 * Runs 500 full-distance races across every circuit with random weather.
 */
const RACES = 500;

type Summary = {
  results: ClassifiedResult[];
  trackId: string;
  safetyCar: boolean;
  rain: boolean;
  overtakes: number;
  winnerMedianLap: number;
  fastestRaceLap: number;
  aiDisqualified: number;
};

const races: Summary[] = [];
for (let i = 0; i < RACES; i++) {
  const track = tracks[i % tracks.length];
  const race = createRace({ seed: 1000 + i, track, teams, drivers });
  const results = race.run();
  const winner = race.carByDriver(results[0].driverId)!;
  const laps = winner.lapTimes.slice(1).sort((a, b) => a - b);
  races.push({
    results,
    trackId: track.id,
    safetyCar: race.safetyCar.deployments.some((d) => d.type === "sc"),
    rain: race.weather.timeline.some((k) => k.rain > 0),
    overtakes: race.events.filter((e) => e.type === "overtake").length,
    winnerMedianLap: laps[laps.length >> 1],
    fastestRaceLap: track.fastestRaceLapSeconds,
    aiDisqualified: results.filter((r) => r.status === "dsq").length,
  });
}

const share = (pred: (r: Summary) => boolean) =>
  races.filter(pred).length / RACES;
const average = (f: (r: Summary) => number) =>
  races.reduce((s, r) => s + f(r), 0) / RACES;

describe(`sanity over ${RACES} races`, () => {
  it("finishes every race with a full-distance winner", () => {
    for (const r of races)
      expect(r.results[0].status, r.trackId).toBe("finished");
  });

  it("is won mostly by the top teams, Mercedes most of all", () => {
    const wins = new Map<string, number>();
    for (const r of races)
      wins.set(r.results[0].teamId, (wins.get(r.results[0].teamId) ?? 0) + 1);
    const topFour = ["mercedes", "ferrari", "mclaren", "red_bull"].reduce(
      (s, t) => s + (wins.get(t) ?? 0),
      0,
    );
    expect(topFour / RACES).toBeGreaterThan(0.85);
    const mostWins = [...wins.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(mostWins).toBe("mercedes");
    // ...but not a foregone conclusion.
    expect((wins.get("mercedes") ?? 0) / RACES).toBeLessThan(0.75);
  });

  it("has a realistic number of pit stops", () => {
    const finishers = races.flatMap((r) =>
      r.results.filter((x) => x.status !== "dnf"),
    );
    const stops =
      finishers.reduce((s, x) => s + x.pitStops, 0) / finishers.length;
    expect(stops).toBeGreaterThan(1);
    expect(stops).toBeLessThan(2.5);
  });

  it("has a realistic number of retirements", () => {
    const dnfs = average(
      (r) => r.results.filter((x) => x.status === "dnf").length,
    );
    expect(dnfs).toBeGreaterThan(1);
    expect(dnfs).toBeLessThan(4);
    expect(
      share((r) => r.results.filter((x) => x.status !== "dnf").length < 12),
    ).toBeLessThan(0.03);
  });

  it("brings out the Safety Car about as often as history says", () => {
    const expected =
      races.reduce(
        (s, r) =>
          s + tracks.find((t) => t.id === r.trackId)!.safetyCarProbability,
        0,
      ) / RACES;
    expect(Math.abs(share((r) => r.safetyCar) - expected)).toBeLessThan(0.12);
  });

  it("rains about as often as the climate says", () => {
    const expected =
      races.reduce(
        (s, r) => s + tracks.find((t) => t.id === r.trackId)!.rainProbability,
        0,
      ) / RACES;
    expect(Math.abs(share((r) => r.rain) - expected)).toBeLessThan(0.08);
  });

  it("has overtaking, more at easy tracks than at Monaco", () => {
    const at = (id: string) =>
      races
        .filter((r) => r.trackId === id)
        .reduce((s, r, _, a) => s + r.overtakes / a.length, 0);
    expect(average((r) => r.overtakes)).toBeGreaterThan(15);
    expect(at("monaco")).toBeLessThan(at("monza") / 2);
  });

  it("runs race laps close to the real ones", () => {
    for (const r of races.filter((x) => !x.rain)) {
      expect(r.winnerMedianLap - r.fastestRaceLap, r.trackId).toBeGreaterThan(
        0.3,
      );
      expect(r.winnerMedianLap - r.fastestRaceLap, r.trackId).toBeLessThan(5);
    }
  });

  it("never disqualifies an AI car for the tyre rule", () => {
    expect(races.reduce((s, r) => s + r.aiDisqualified, 0)).toBe(0);
  });
});
