import { drivers, getTrack, teams } from "@/data";
import { describe, expect, it } from "vitest";
import {
  createQualifying,
  QUALI_PHASES,
  SOFT_SETS,
  type QualiSession,
} from "./quali-session";
import type { RaceConfig } from "./types";

const config: RaceConfig = {
  seed: 7,
  track: getTrack("silverstone"),
  teams,
  drivers,
  weather: "dry",
  playerTeamId: "alpine",
};

function runUntil(session: QualiSession, done: () => boolean) {
  while (session.state !== "finished" && !done()) {
    if (session.state === "break") session.nextPhase();
    else session.step();
  }
}

describe("qualifying session", () => {
  it("knocks out six after Q1 and Q2 and sets a full grid", () => {
    const session = createQualifying({ ...config, playerTeamId: null });
    const results = session.run();
    expect(results.map((r) => r.position)).toEqual(
      Array.from({ length: 22 }, (_, i) => i + 1),
    );
    expect(new Set(results.map((r) => r.driverId)).size).toBe(22);
    expect(results.filter((r) => r.reached === 3)).toHaveLength(10);
    expect(results.filter((r) => r.reached === 2)).toHaveLength(6);
    expect(results.filter((r) => r.reached === 1)).toHaveLength(6);
    for (const r of results.filter((r) => r.reached === 3)) {
      expect(r.q1).not.toBeNull();
      expect(r.q2).not.toBeNull();
    }
    expect(session.grid()).toEqual(results.map((r) => r.driverId));
  });

  it("is deterministic for the same seed and commands", () => {
    const play = () => {
      const s = createQualifying(config);
      for (const car of s.cars.filter((c) => c.isPlayer))
        s.command({
          type: "run",
          driverId: car.driverId,
          tyre: "soft-new",
          pushLaps: 2,
        });
      return s.run();
    };
    expect(play()).toEqual(play());
  });

  it("leaves idle player cars at the back", () => {
    const results = createQualifying(config).run();
    expect(results.slice(-2).map((r) => r.teamId)).toEqual([
      "alpine",
      "alpine",
    ]);
    expect(results.slice(-2).every((r) => r.q1 === null)).toBe(true);
  });

  it("only counts laps started before the chequered flag", () => {
    const session = createQualifying(config);
    const [early, late] = session.cars.filter((c) => c.isPlayer);
    const latest = session.latestStart(early);
    runUntil(session, () => session.clock >= latest - 10);
    session.command({
      type: "run",
      driverId: early.driverId,
      tyre: "soft-new",
      pushLaps: 1,
    });
    runUntil(session, () => session.clock >= latest + 15);
    session.command({
      type: "run",
      driverId: late.driverId,
      tyre: "soft-new",
      pushLaps: 1,
    });
    runUntil(session, () => session.state === "break");
    // (The early lap may still be deleted for track limits, but it is run and recorded.)
    expect(early.laps.filter((l) => l.phase === 0)).toHaveLength(1);
    expect(late.laps.filter((l) => l.phase === 0)).toHaveLength(0);
  });

  it("gets faster as the track rubbers in", () => {
    const session = createQualifying(config);
    const car = session.cars[0];
    const start = session.expectedLap(car);
    runUntil(session, () => session.clock >= QUALI_PHASES[0].seconds - 5);
    expect(session.expectedLap(car)).toBeLessThan(start - 0.2);
  });

  it("uses up new soft sets and offers used or harder tyres after", () => {
    const session = createQualifying(config);
    const car = session.cars.find((c) => c.isPlayer)!;
    expect(session.tyreOptions(car)).toContain("soft-new");
    car.softSets = 0;
    car.tyreAge = 2;
    expect(session.tyreOptions(car)).toEqual(["soft-used", "medium"]);
    car.softSets = SOFT_SETS;
    session.command({
      type: "run",
      driverId: car.driverId,
      tyre: "soft-new",
      pushLaps: 1,
    });
    session.step();
    expect(car.softSets).toBe(SOFT_SETS - 1);
    expect(car.stage).toBe("out");
  });

  it("hands the player's cars to the AI on request", () => {
    const session = createQualifying(config);
    session.command({ type: "auto" });
    const results = session.run();
    for (const r of results.filter((r) => r.teamId === "alpine"))
      expect(r.q1).not.toBeNull();
  });

  it("has more traffic when more cars are on track", () => {
    const session = createQualifying({ ...config, playerTeamId: null });
    const quiet = session.trafficChance();
    runUntil(session, () => session.carsOnTrack() >= 8);
    expect(session.trafficChance()).toBeGreaterThan(quiet);
  });
});
