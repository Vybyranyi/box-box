import { drivers, getTrack, teams } from "@/data";
import { createRace, type Race } from "@/engine";
import { describe, expect, it } from "vitest";
import {
  battleInsight,
  boxCalls,
  boxNow,
  carInsights,
  pitWindow,
  undercutGain,
} from "./insights";
import { planSummary, recommendedCompound } from "./pit-wall";

const raceAt = (trackId: string, seed: number, laps?: number) =>
  createRace({
    seed,
    track: getTrack(trackId),
    teams,
    drivers,
    weather: "dry",
    laps,
    playerTeamId: "alpine",
  });

/** Play the race following the strategy desk: box whenever it says "box this lap". */
function followAdvice(race: Race, onLap?: () => void) {
  let lap = -1;
  while (!race.finished) {
    race.step();
    if (race.leaderLap === lap) continue;
    lap = race.leaderLap;
    for (const car of race.cars.filter((c) => c.isPlayer))
      if (boxNow(race, car))
        race.command({
          type: "pit",
          driverId: car.driverId,
          compound: recommendedCompound(race, car),
        });
    onLap?.();
  }
}

describe("strategy desk", () => {
  it("says when to box, and the car never runs its tyres to destruction", () => {
    for (const seed of [1, 2, 3]) {
      const race = raceAt("silverstone", seed);
      let calls = 0;
      let maxWear = 0;
      followAdvice(race, () => {
        for (const car of race.cars.filter((c) => c.isPlayer)) {
          maxWear = Math.max(maxWear, car.tyre.wear);
          if (boxNow(race, car)) {
            calls++;
            expect(planSummary(race, car).key).toBe("advice.boxNow");
          }
        }
      });
      expect(calls).toBeGreaterThan(0);
      expect(maxWear).toBeLessThan(95);
      for (const car of race.cars.filter((c) => c.isPlayer && !c.disqualified))
        expect(car.pitStops.length).toBeGreaterThan(0);
    }
  });

  it("does about as well as the AI teams when followed", () => {
    let gained = 0;
    let cars = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const race = raceAt("silverstone", seed);
      followAdvice(race);
      for (const car of race.cars.filter(
        (c) => c.isPlayer && c.status === "finished",
      )) {
        gained += car.gridPosition - car.position;
        cars++;
      }
    }
    expect(gained / cars).toBeGreaterThan(-1.5);
  });

  it("calls each stop on the radio once", () => {
    const race = raceAt("silverstone", 2);
    const said = new Set<string>();
    const calls: string[] = [];
    while (!race.finished && race.leaderLap < 30) {
      race.step();
      for (const call of boxCalls(race, "alpine", said))
        calls.push(String(call.values!.car));
    }
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls).size).toBe(calls.length);
  });
});

describe("pit window and battles", () => {
  it("predicts the rejoin position", () => {
    const race = raceAt("silverstone", 4);
    while (race.leaderLap < 10) race.step();
    const car = race.cars.find((c) => c.isPlayer && c.status === "racing")!;
    const window = pitWindow(race, car)!;
    expect(window.message.key).toMatch(/^insight\.rejoin/);
    if (window.message.values?.position !== undefined)
      expect(window.message.values.position).toBeGreaterThanOrEqual(
        car.position,
      );
  });

  it("values an undercut by how worn the rival's tyres are", () => {
    const race = raceAt("silverstone", 4);
    while (race.leaderLap < 12) race.step();
    const [a, b] = race.cars.filter((c) => c.status === "racing");
    b.tyre.wear = 20;
    const small = undercutGain(race, a, b, "hard");
    b.tyre.wear = 65;
    const big = undercutGain(race, a, b, "hard");
    expect(big).toBeGreaterThan(small + 0.5);
  });

  it("explains battles: attacking, stuck with a reason, and defending", () => {
    const keys = new Set<string>();
    const tips = new Set<string>();
    for (const seed of [1, 2, 3, 4]) {
      const race = raceAt("hungaroring", seed, 30);
      followAdvice(race, () => {
        for (const car of race.cars) {
          for (const insight of carInsights(race, car)) {
            keys.add(insight.message.key);
            if (insight.tip) tips.add(insight.tip.key);
          }
          const battle = battleInsight(race, car);
          if (battle?.message.key.startsWith("insight.stuck"))
            expect(battle.tip).toBeDefined();
        }
      });
    }
    expect(keys).toContain("insight.attacking");
    expect([...keys].some((k) => k.startsWith("insight.stuck"))).toBe(true);
    expect(keys).toContain("insight.defending");
    expect(tips).toContain("insight.tipWait");
  });
});
