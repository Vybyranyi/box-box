import { drivers, getTrack, teams } from "@/data";
import type { Driver } from "@/data/types";
import { describe, expect, it } from "vitest";
import { carFactor, expectedLapTime, type LapInputs } from "./pace";
import { simulateQualifying } from "./qualifying";
import { createRng } from "./rng";
import {
  conditionPenalty,
  compoundOffset,
  idealCompoundFor,
  wearPenalty,
  wearPerLap,
} from "./tyres";
import type { Compound } from "./types";
import { generateWeather, initialWeather, updateWeather } from "./weather";

const monza = getTrack("monza");
const mercedes = teams.find((t) => t.id === "mercedes")!;
const cadillac = teams.find((t) => t.id === "cadillac")!;
const driver = (code: string) => drivers.find((d) => d.code === code)!;

const lap = (overrides: Partial<LapInputs> = {}) =>
  expectedLapTime({
    track: monza,
    team: mercedes,
    driver: driver("RUS"),
    compound: "medium",
    wear: 0,
    fuelKg: 0,
    wetness: 0,
    paceMode: "balanced",
    outLap: false,
    ...overrides,
  });

describe("tyres", () => {
  it("lose time gently, then fall off a cliff past 70%", () => {
    expect(wearPenalty(0)).toBe(0);
    const early = wearPenalty(40) - wearPenalty(30);
    const late = wearPenalty(90) - wearPenalty(80);
    expect(late).toBeGreaterThan(early * 5);
  });

  it("orders dry compounds soft < medium < hard on pace, and the reverse on wear", () => {
    const wear = (compound: Compound) =>
      wearPerLap({
        compound,
        tyreDegradation: 3,
        carTyreWear: 1,
        tyreManagement: 85,
        paceModeWear: 1,
        wetness: 0,
      });
    expect(compoundOffset("soft", 90)).toBeLessThan(
      compoundOffset("medium", 90),
    );
    expect(compoundOffset("medium", 90)).toBeLessThan(
      compoundOffset("hard", 90),
    );
    expect(wear("soft")).toBeGreaterThan(wear("medium"));
    expect(wear("medium")).toBeGreaterThan(wear("hard"));
  });

  it("wears faster on high-degradation tracks and for weaker tyre managers", () => {
    const base = {
      compound: "medium" as const,
      carTyreWear: 1,
      paceModeWear: 1,
      wetness: 0,
    };
    expect(
      wearPerLap({ ...base, tyreDegradation: 5, tyreManagement: 85 }),
    ).toBeGreaterThan(
      wearPerLap({ ...base, tyreDegradation: 1, tyreManagement: 85 }),
    );
    expect(
      wearPerLap({ ...base, tyreDegradation: 3, tyreManagement: 70 }),
    ).toBeGreaterThan(
      wearPerLap({ ...base, tyreDegradation: 3, tyreManagement: 95 }),
    );
  });

  it("picks the right tyre for the conditions", () => {
    const total = (c: Compound, w: number) =>
      compoundOffset(c, 90) + conditionPenalty(c, w, 90);
    expect(total("soft", 0)).toBeLessThan(total("intermediate", 0));
    expect(total("intermediate", 0.45)).toBeLessThan(total("soft", 0.45));
    expect(total("intermediate", 0.45)).toBeLessThan(total("wet", 0.45));
    expect(total("wet", 0.95)).toBeLessThan(total("intermediate", 0.95));
    expect(idealCompoundFor(0.05)).toBe("dry");
    expect(idealCompoundFor(0.4)).toBe("intermediate");
    expect(idealCompoundFor(0.9)).toBe("wet");
  });
});

describe("pace", () => {
  it("rewards a faster car, a lighter car and fresher tyres", () => {
    expect(carFactor(mercedes, monza)).toBeLessThan(carFactor(cadillac, monza));
    expect(lap({ team: mercedes })).toBeLessThan(lap({ team: cadillac }));
    expect(lap({ fuelKg: 0 })).toBeLessThan(lap({ fuelKg: 50 }));
    expect(lap({ wear: 10 })).toBeLessThan(lap({ wear: 60 }));
  });

  it("trades pace modes and out-laps sensibly", () => {
    expect(lap({ paceMode: "push" })).toBeLessThan(
      lap({ paceMode: "balanced" }),
    );
    expect(lap({ paceMode: "balanced" })).toBeLessThan(
      lap({ paceMode: "conserve" }),
    );
    expect(lap({ outLap: true })).toBeGreaterThan(lap());
  });

  it("separates drivers by wet skill only in the wet", () => {
    const wetMaster: Driver = {
      ...driver("RUS"),
      ratings: { ...driver("RUS").ratings, wetSkill: 98 },
    };
    const wetNovice: Driver = {
      ...driver("RUS"),
      ratings: { ...driver("RUS").ratings, wetSkill: 70 },
    };
    expect(lap({ driver: wetMaster })).toBeCloseTo(lap({ driver: wetNovice }));
    const wet = { wetness: 0.8, compound: "wet" as const };
    expect(lap({ ...wet, driver: wetMaster })).toBeLessThan(
      lap({ ...wet, driver: wetNovice }) - 0.5,
    );
  });

  it("lands in a realistic range against the real race laps", () => {
    const fresh = lap({ compound: "soft" });
    expect(fresh).toBeGreaterThan(monza.poleTimeSeconds);
    expect(fresh).toBeLessThan(monza.fastestRaceLapSeconds + 0.5);
  });
});

describe("qualifying", () => {
  const run = (seed: number) =>
    simulateQualifying({ seed, track: monza, teams, drivers });

  it("runs a three-part knockout", () => {
    const result = run(1);
    expect(result).toHaveLength(22);
    expect(new Set(result.map((r) => r.driverId)).size).toBe(22);
    expect(result.filter((r) => r.reached === 3)).toHaveLength(10);
    expect(result.filter((r) => r.reached === 2)).toHaveLength(6);
    expect(result.filter((r) => r.reached === 1)).toHaveLength(6);
    expect(result.slice(0, 10).every((r) => r.q3 !== null)).toBe(true);
    expect(result.slice(16).every((r) => r.q2 === null)).toBe(true);
  });

  it("is deterministic and favours faster cars", () => {
    expect(run(5)).toEqual(run(5));
    let mercedesAvg = 0;
    let cadillacAvg = 0;
    for (let seed = 0; seed < 50; seed++) {
      for (const r of run(seed)) {
        if (r.teamId === "mercedes") mercedesAvg += r.position / 100;
        if (r.teamId === "cadillac") cadillacAvg += r.position / 100;
      }
    }
    expect(mercedesAvg).toBeLessThan(6);
    expect(cadillacAvg).toBeGreaterThan(17);
  });
});

describe("weather", () => {
  it("stays dry in dry mode and rains in wet mode", () => {
    const rng = createRng(1);
    expect(
      generateWeather("dry", 1, 5000, rng).every((k) => k.rain === 0),
    ).toBe(true);
    expect(
      generateWeather("wet", 0, 5000, rng).every((k) => k.rain > 0.3),
    ).toBe(true);
  });

  it("wets the track while it rains and dries it afterwards", () => {
    const weather = initialWeather([
      { time: 0, rain: 0 },
      { time: 100, rain: 0.8 },
      { time: 1000, rain: 0.8 },
      { time: 1010, rain: 0 },
    ]);
    for (let t = 0; t < 1000; t += 1) updateWeather(weather, t, 1);
    expect(weather.wetness).toBeGreaterThan(0.6);
    for (let t = 1000; t < 2500; t += 1) updateWeather(weather, t, 1);
    expect(weather.wetness).toBe(0);
  });
});
