import { drivers, getTrack, teams } from "@/data";
import { describe, expect, it } from "vitest";
import { referenceLap } from "./pace";
import { createRng } from "./rng";
import {
  decidePit,
  MAX_PLANNED_WEAR,
  planStrategy,
  type PitDecisionInput,
  type WearRates,
} from "./strategy";
import { DRY_COMPOUNDS, wearPerLap } from "./tyres";

const ratesFor = (trackId: string): WearRates => {
  const track = getTrack(trackId);
  const team = teams.find((t) => t.id === "mclaren")!;
  const driver = drivers.find((d) => d.code === "NOR")!;
  const rates = {} as WearRates;
  for (const c of DRY_COMPOUNDS) {
    rates[c] = wearPerLap({
      compound: c,
      tyreDegradation: track.tyreDegradation,
      carTyreWear: team.car.tyreWear,
      tyreManagement: driver.ratings.tyreManagement,
      paceModeWear: 1,
      wetness: 0,
    });
  }
  return rates;
};

const plan = (trackId: string, seed: number, overrides = {}) => {
  const track = getTrack(trackId);
  return planStrategy({
    fromLap: 0,
    totalLaps: track.laps,
    wearRates: ratesFor(trackId),
    referenceLap: referenceLap(track),
    pitLaneLoss: track.pitLaneLossSeconds,
    overtakingDifficulty: track.overtakingDifficulty,
    requireTwoCompounds: true,
    usedCompounds: [],
    rng: createRng(seed),
    ...overrides,
  });
};

describe("planStrategy", () => {
  it("one-stops a low-degradation track like Monza", () => {
    const stops = Array.from(
      { length: 40 },
      (_, seed) => plan("monza", seed).stints.length - 1,
    );
    expect(stops.filter((s) => s === 1).length).toBeGreaterThan(30);
  });

  it("needs more stops at a high-degradation track like Lusail", () => {
    const stops = Array.from(
      { length: 40 },
      (_, seed) => plan("losail", seed).stints.length - 1,
    );
    expect(stops.every((s) => s >= 2)).toBe(true);
  });

  it("always uses two compounds and keeps every stint inside the wear limit", () => {
    for (const trackId of [
      "monza",
      "monaco",
      "silverstone",
      "losail",
      "marina_bay",
    ]) {
      const rates = ratesFor(trackId);
      for (let seed = 0; seed < 10; seed++) {
        const { stints } = plan(trackId, seed);
        expect(
          new Set(stints.map((s) => s.compound)).size,
          trackId,
        ).toBeGreaterThanOrEqual(2);
        expect(stints[stints.length - 1].endLap).toBe(getTrack(trackId).laps);
        let start = 0;
        for (const s of stints) {
          expect(
            (s.endLap - start) * rates[s.compound],
            trackId,
          ).toBeLessThanOrEqual(MAX_PLANNED_WEAR + 0.001);
          start = s.endLap;
        }
      }
    }
  });

  it("allows a single compound without the two-compound rule", () => {
    const short = plan("monza", 1, {
      totalLaps: 10,
      requireTwoCompounds: false,
    });
    expect(short.stints).toHaveLength(1);
  });
});

describe("decidePit", () => {
  const base: PitDecisionInput = {
    lap: 20,
    totalLaps: 53,
    compound: "medium",
    wear: 40,
    tyreAge: 20,
    wetness: 0,
    trackStatus: "green",
    stoppedUnderThisNeutralisation: false,
    plan: {
      stints: [
        { compound: "medium", endLap: 25 },
        { compound: "hard", endLap: 53 },
      ],
    },
    nextStopLap: 25,
    weatherMismatchLaps: 0,
    weatherReaction: 1,
    requireTwoCompounds: true,
    usedCompounds: ["medium"],
    rng: createRng(1),
  };

  it("follows the plan", () => {
    expect(decidePit(base).pit).toBe(false);
    expect(decidePit({ ...base, lap: 25 })).toMatchObject({
      pit: true,
      compound: "hard",
      reason: "plan",
    });
  });

  it("stops for worn-out tyres", () => {
    expect(decidePit({ ...base, wear: 88 })).toMatchObject({
      pit: true,
      reason: "wear",
    });
  });

  it("takes a cheap stop under the Safety Car when one is due", () => {
    const stops = Array.from({ length: 50 }, (_, seed) =>
      decidePit({ ...base, trackStatus: "sc", rng: createRng(seed) }),
    ).filter((d) => d.pit).length;
    expect(stops).toBeGreaterThan(35);
    expect(
      decidePit({
        ...base,
        trackStatus: "sc",
        stoppedUnderThisNeutralisation: true,
      }).pit,
    ).toBe(false);
    expect(
      decidePit({ ...base, trackStatus: "sc", tyreAge: 3, lap: 3 }).pit,
    ).toBe(false);
  });

  it("switches to wet-weather tyres after its reaction delay", () => {
    expect(
      decidePit({ ...base, wetness: 0.5, weatherMismatchLaps: 1 }).pit,
    ).toBe(false);
    expect(
      decidePit({ ...base, wetness: 0.5, weatherMismatchLaps: 2 }),
    ).toMatchObject({
      pit: true,
      compound: "intermediate",
      reason: "weather",
    });
  });

  it("never finishes without using a second compound", () => {
    expect(
      decidePit({
        ...base,
        lap: 51,
        plan: { stints: [{ compound: "medium", endLap: 53 }] },
        nextStopLap: null,
      }),
    ).toMatchObject({ pit: true, reason: "rule" });
  });
});
